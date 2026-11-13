const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { paginate, buildPagination, logQuery } = require('../utils/helpers');
const { ACTIONS, JWT_SECRET, COOKIE_NAME, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
const { loadQcvnCatalog } = require('../services/rule-repository');
const {
  evaluateQcvnSampleWithDb,
  selectQcvnForProjectWithDb,
  INDUSTRY_TO_QCVN_SOURCE,
} = require('../services/qcvn-service');

function resolveOptionalUser(req) {
  if (req.user) return req.user;
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// GET /api/qcvns — lấy danh sách QCVN và metadata từ PostgreSQL
router.get('/', async (req, res) => {
  try {
    const loaded = await loadQcvnCatalog({ db });
    if (!loaded.ok || !loaded.catalog || Object.keys(loaded.catalog).length === 0) {
      res.set('X-Rule-Source', 'FALLBACK_UNVERIFIED');
      return res.status(503).json({
        error: 'Danh mục QCVN từ cơ sở dữ liệu hiện không khả dụng hoặc chưa có bản ghi ban hành.',
        ruleSource: 'FALLBACK_UNVERIFIED',
        reason: loaded.error || 'EMPTY_QCVNS_TABLE'
      });
    }

    const qcvnsObj = {};
    for (const [id, item] of Object.entries(loaded.catalog)) {
      qcvnsObj[id] = {
        ...item,
        ruleSource: 'DATABASE'
      };
    }

    res.set('X-Rule-Source', 'DATABASE');
    return res.json(qcvnsObj);
  } catch (error) {
    logger.error('Lỗi lấy danh sách QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu quy chuẩn QCVN!' });
  }
});

// POST /api/qcvns/select — xác định QCVN áp dụng hoàn toàn ở máy chủ
router.post('/select', async (req, res) => {
  try {
    const body = req.body || {};
    const projectId = body.project_id ?? body.projectId ?? null;
    const optionalUser = resolveOptionalUser(req);

    if (projectId) {
      if (!optionalUser) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để chọn QCVN theo dự án đã lưu!' });
      }
      const ownerRes = await db.query(
        'SELECT id, user_id FROM projects WHERE id = $1',
        [Number(projectId)]
      );
      if (!ownerRes || ownerRes.rowCount === 0) {
        return res.status(404).json({ error: 'Không tìm thấy dự án liên kết!' });
      }
      const ownerRow = ownerRes.rows[0];
      if (optionalUser.role !== ROLES.ADMIN && ownerRow.user_id !== optionalUser.id) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập dự án này!' });
      }
    }

    const selection = await selectQcvnForProjectWithDb({
      projectId,
      nganh: body.nganh || null,
      sourceType: body.sourceType || body.type || null,
      receivingWaterClass: body.receivingWaterClass || null,
      receivingWaterConfirmed: body.receivingWaterConfirmed,
      flowRate: body.flowRate ?? null,
      isUrbanArea: body.isUrbanArea,
      isExistingFacility: body.isExistingFacility,
      evaluationDate: body.evaluationDate || new Date().toISOString().slice(0, 10),
    }, { db });

    res.set('X-Rule-Source', selection.ruleSource || 'FALLBACK_UNVERIFIED');
    return res.json({
      ...selection,
      industrySources: body.includeMapping ? INDUSTRY_TO_QCVN_SOURCE : undefined,
    });
  } catch (error) {
    logger.error('Lỗi xác định QCVN phía server:', error);
    return res.status(500).json({ error: 'Không thể xác định bộ QCVN áp dụng trên server!' });
  }
});

async function runServerQcvnEvaluationWithSelection({
  subType,
  values,
  samplingPeriods = {},
  permitLimits = null,
  receivingWaterConfirmed,
  projectId = null,
  nganh = null,
  sourceType = null,
  flowRate = null,
  receivingWaterClass = null,
  isUrbanArea = undefined,
  isExistingFacility = undefined,
  evaluationDate = undefined,
}) {
  const serverEvaluation = await evaluateQcvnSampleWithDb({
    qcvnId: subType,
    measuredValues: values,
    samplingPeriods,
    permitLimits,
    receivingWaterConfirmed,
  }, { db });

  const hasSelectionContext = Boolean(
    projectId
    || nganh
    || sourceType
    || (flowRate !== null && flowRate !== undefined && flowRate !== '')
    || receivingWaterClass
    || isExistingFacility !== undefined
    || isUrbanArea !== undefined
  );

  let serverSelection = null;
  if (hasSelectionContext) {
    serverSelection = await selectQcvnForProjectWithDb({
      projectId,
      nganh,
      sourceType,
      receivingWaterClass,
      receivingWaterConfirmed,
      flowRate,
      isUrbanArea,
      isExistingFacility,
      evaluationDate: evaluationDate || new Date().toISOString().slice(0, 10),
    }, { db });

    const unverifiedReasons = Array.isArray(serverEvaluation.unverifiedReasons)
      ? [...serverEvaluation.unverifiedReasons]
      : [];

    if (serverSelection.status !== 'OK') {
      unverifiedReasons.push(serverSelection.message || 'Chưa đủ điều kiện xác định QCVN áp dụng phía server.');
      Object.assign(serverEvaluation, {
        overallStatus: 'NEEDS_REVIEW',
        conclusionStatus: 'NEEDS_REVIEW',
        trang_thai_tong_quat: 'can_ra_soat',
        reason: serverSelection.reason || 'QCVN_SELECTION_NEEDS_REVIEW',
        isOfficialConclusion: false,
        canExportOfficialReport: false,
        unverifiedReasons,
      });
    } else if (serverSelection.qcvnId && serverSelection.qcvnId !== subType) {
      unverifiedReasons.push(
        `Bộ QCVN gửi lên (${subType}) không khớp kết quả lựa chọn phía server (${serverSelection.qcvnId}). Hệ thống hạ trạng thái cần rà soát.`
      );
      Object.assign(serverEvaluation, {
        overallStatus: 'NEEDS_REVIEW',
        conclusionStatus: 'NEEDS_REVIEW',
        trang_thai_tong_quat: 'can_ra_soat',
        reason: 'QCVN_SELECTION_MISMATCH',
        expectedQcvnId: serverSelection.qcvnId,
        isOfficialConclusion: false,
        canExportOfficialReport: false,
        unverifiedReasons,
      });
    }
  }

  return { serverEvaluation, serverSelection };
}

// POST /api/qcvns/evaluate — đối chiếu bảng thông số quan trắc ở máy chủ
router.post('/evaluate', async (req, res) => {
  try {
    const body = req.body || {};
    const subType = body.sub_type || body.qcvnId;
    const values = body.values || body.measuredValues;
    if (!subType || !values || typeof values !== 'object') {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã quy chuẩn (sub_type/qcvnId) và giá trị thông số (values)!' });
    }

    const projectId = body.project_id ?? body.projectId ?? null;
    if (projectId) {
      const optionalUser = resolveOptionalUser(req);
      if (!optionalUser) {
        return res.status(401).json({ error: 'Vui lòng đăng nhập để đối chiếu theo dự án đã lưu!' });
      }
      const ownerRes = await db.query('SELECT id, user_id FROM projects WHERE id = $1', [Number(projectId)]);
      if (!ownerRes || ownerRes.rowCount === 0) {
        return res.status(404).json({ error: 'Không tìm thấy dự án liên kết!' });
      }
      if (optionalUser.role !== ROLES.ADMIN && ownerRes.rows[0].user_id !== optionalUser.id) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập dự án này!' });
      }
    }

    const { serverEvaluation, serverSelection } = await runServerQcvnEvaluationWithSelection({
      subType,
      values,
      samplingPeriods: body.samplingPeriods || {},
      permitLimits: body.permitLimits || null,
      receivingWaterConfirmed: body.receivingWaterConfirmed,
      projectId,
      nganh: body.nganh || null,
      sourceType: body.sourceType || body.type || null,
      flowRate: body.flowRate ?? null,
      receivingWaterClass: body.receivingWaterClass || null,
      isUrbanArea: body.isUrbanArea,
      isExistingFacility: body.isExistingFacility,
      evaluationDate: body.evaluationDate,
    });

    res.set('X-Rule-Source', serverEvaluation.ruleSource || 'FALLBACK_UNVERIFIED');
    return res.json({
      evaluation: serverEvaluation,
      serverSelection,
    });
  } catch (error) {
    logger.error('Lỗi đối chiếu QCVN trên server:', error);
    return res.status(500).json({ error: 'Không thể thực hiện đối chiếu QCVN trên server!' });
  }
});

// GET /api/qcvns/samples — lấy danh sách mẫu đã lưu, có phân trang
router.get('/samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { page, limit, offset } = paginate(req.query);

  try {
    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM qcvn_samples WHERE user_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const samplesRes = await db.query(
      `SELECT s.*, p.name AS project_name,
              p.form_data AS project_form_data,
              p.classification_result AS project_classification_result,
              p.dia_chi_hien_thi AS project_dia_chi
       FROM qcvn_samples s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json({
      samples: samplesRes.rows,
      pagination: buildPagination(totalCount, page, limit)
    });
  } catch (error) {
    logger.error('Lỗi lấy danh sách mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách mẫu đã lưu!' });
  }
});

// GET /api/qcvns/samples/:id — lấy mẫu cụ thể để mở từ màn hình khác
router.get('/samples/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const sampleId = parseInt(req.params.id, 10);

  try {
    const result = await db.query(
      `SELECT s.*, p.name AS project_name,
              p.form_data AS project_form_data,
              p.classification_result AS project_classification_result,
              p.dia_chi_hien_thi AS project_dia_chi
       FROM qcvn_samples s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sampleId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy mẫu!' });
    }

    return res.json({ sample: result.rows[0] });
  } catch (error) {
    logger.error('Lỗi lấy mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải mẫu!' });
  }
});

// POST /api/qcvns/samples — lưu mẫu quan trắc và luôn đánh giá lại ở máy chủ
router.post('/samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const {
    id,
    name,
    type,
    sub_type,
    values,
    project_id,
    samplingPeriods = {},
    permitLimits = null,
    receivingWaterConfirmed,
    sourceType = null,
    flowRate = null,
    receivingWaterClass = null,
    isUrbanArea = undefined,
    isExistingFacility = undefined,
    evaluationDate = undefined,
  } = req.body;

  if (!name || !type || !sub_type || !values) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (Tên mẫu, Loại quy chuẩn, và Dữ liệu thông số)!' });
  }

  try {
    if (project_id) {
      const projOwnerRes = await db.query('SELECT id, user_id FROM projects WHERE id = $1', [project_id]);
      if (projOwnerRes && projOwnerRes.rowCount > 0) {
        const projOwner = projOwnerRes.rows[0];
        if (req.user.role !== ROLES.ADMIN && Number(projOwner.user_id) !== Number(userId)) {
          return res.status(403).json({ error: 'Bạn không có quyền gắn mẫu quan trắc vào dự án của người dùng khác!' });
        }
      }
    }

    // Luôn đánh giá lại mẫu và đối chiếu lựa chọn QCVN ở máy chủ theo danh mục trong DB
    const { serverEvaluation, serverSelection } = await runServerQcvnEvaluationWithSelection({
      subType: sub_type,
      values,
      samplingPeriods,
      permitLimits,
      receivingWaterConfirmed,
      projectId: project_id || null,
      nganh: req.body.nganh || null,
      sourceType: sourceType || (project_id ? null : undefined),
      flowRate,
      receivingWaterClass,
      isUrbanArea,
      isExistingFacility,
      evaluationDate,
    });

    const computedDbStatus = serverEvaluation.trang_thai_tong_quat || 'can_ra_soat';
    const evaluationDetails = {
      overallStatus: serverEvaluation.overallStatus,
      conclusionStatus: serverEvaluation.conclusionStatus,
      preliminaryStatus: serverEvaluation.preliminaryStatus,
      reason: serverEvaluation.reason || null,
      expectedQcvnId: serverEvaluation.expectedQcvnId || null,
      isOfficialConclusion: serverEvaluation.isOfficialConclusion,
      canExportOfficialReport: serverEvaluation.canExportOfficialReport,
      verificationStatus: serverEvaluation.verificationStatus,
      ruleSource: serverEvaluation.ruleSource,
      ruleVersion: serverEvaluation.ruleVersion,
      unverifiedReasons: serverEvaluation.unverifiedReasons || [],
      qcvnComplianceStatus: serverEvaluation.qcvnComplianceStatus,
      permitComplianceStatus: serverEvaluation.permitComplianceStatus,
      summary: serverEvaluation.summary,
      samplingPeriods,
      permitLimits,
      receivingWaterConfirmed: receivingWaterConfirmed === true,
      evaluationDate: evaluationDate || serverSelection?.resolvedContext?.evaluationDate || null,
      serverSelectionContext: serverSelection?.resolvedContext || {
        flowRate: flowRate !== undefined ? flowRate : null,
        receivingWaterClass: receivingWaterClass || null,
        isUrbanArea: Boolean(isUrbanArea),
        isExistingFacility: Boolean(isExistingFacility),
      },
      serverSelection: serverSelection
        ? {
            status: serverSelection.status,
            reason: serverSelection.reason || null,
            qcvnId: serverSelection.qcvnId || null,
            sourceType: serverSelection.sourceType || null,
            resolvedContext: serverSelection.resolvedContext || null,
          }
        : null,
    };

    if (id) {
      // Cập nhật mẫu hiện có
      const updateRes = await db.query(
        `UPDATE qcvn_samples 
         SET name = $1, type = $2, sub_type = $3, values = $4, project_id = $5,
             trang_thai_tong_quat = $6, overall_status = $7, evaluation_details = $8,
             evaluated_rule_version = $9, evaluated_verification_status = $10
         WHERE id = $11 AND user_id = $12 
         RETURNING *`,
        [
          name,
          type,
          sub_type,
          JSON.stringify(values),
          project_id || null,
          computedDbStatus,
          serverEvaluation.overallStatus,
          JSON.stringify(evaluationDetails),
          serverEvaluation.ruleVersion || null,
          serverEvaluation.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
          id,
          userId,
        ]
      );

      if (updateRes.rowCount === 0) {
        return res.status(403).json({ error: 'Không tìm thấy mẫu hoặc bạn không có quyền cập nhật!' });
      }

      const sample = updateRes.rows[0];

      // Ghi log bảo mật và truy vấn
      await logAudit(userId, ACTIONS.UPDATE_QCVN_SAMPLE, req, { id: sample.id, name: sample.name });
      await logQuery(userId, 'qcvn_comparison', { type, sub_type, values }, { name, overallStatus: serverEvaluation.overallStatus });

      return res.json({
        message: 'Cập nhật mẫu kết quả quan trắc thành công!',
        sample,
        evaluation: serverEvaluation,
      });
    } else {
      // Tạo mẫu mới
      const insertRes = await db.query(
        `INSERT INTO qcvn_samples (
          user_id, name, type, sub_type, values, project_id,
          trang_thai_tong_quat, overall_status, evaluation_details,
          evaluated_rule_version, evaluated_verification_status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          userId,
          name,
          type,
          sub_type,
          JSON.stringify(values),
          project_id || null,
          computedDbStatus,
          serverEvaluation.overallStatus,
          JSON.stringify(evaluationDetails),
          serverEvaluation.ruleVersion || null,
          serverEvaluation.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
        ]
      );

      const sample = insertRes.rows[0];

      // Ghi log bảo mật và truy vấn
      await logAudit(userId, ACTIONS.CREATE_QCVN_SAMPLE, req, { id: sample.id, name: sample.name });
      await logQuery(userId, 'qcvn_comparison', { type, sub_type, values }, { name, overallStatus: serverEvaluation.overallStatus });

      return res.json({
        message: 'Lưu mẫu kết quả quan trắc thành công!',
        sample,
        evaluation: serverEvaluation,
      });
    }
  } catch (error) {
    logger.error('Lỗi lưu mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể lưu mẫu kết quả quan trắc!' });
  }
});

// DELETE /api/qcvns/samples/:id — xóa mẫu quan trắc
router.delete('/samples/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const sampleId = req.params.id;

  try {
    const deleteRes = await db.query(
      'DELETE FROM qcvn_samples WHERE id = $1 AND user_id = $2 RETURNING *',
      [sampleId, userId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(403).json({ error: 'Không tìm thấy mẫu hoặc bạn không có quyền xóa!' });
    }

    const deletedSample = deleteRes.rows[0];
    await logAudit(userId, ACTIONS.DELETE_QCVN_SAMPLE, req, { id: deletedSample.id, name: deletedSample.name });

    return res.json({
      message: 'Xóa mẫu kết quả quan trắc thành công!',
      deletedSample
    });
  } catch (error) {
    logger.error('Lỗi xóa mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể xóa mẫu kết quả quan trắc!' });
  }
});

module.exports = router;
