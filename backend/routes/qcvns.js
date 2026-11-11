const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { paginate, buildPagination, logQuery } = require('../utils/helpers');
const { ACTIONS } = require('../utils/constants');
const logger = require('../utils/logger');
const { loadQcvnCatalog } = require('../services/rule-repository');
const { evaluateQcvnSampleWithDb } = require('../services/qcvn-service');

// GET /api/qcvns - Lấy toàn bộ danh sách QCVN kèm metadata đầy đủ từ PostgreSQL
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

// GET /api/qcvns/samples - Lấy danh sách kết quả mẫu đã lưu (Hỗ trợ phân trang)
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

// GET /api/qcvns/samples/:id - Lấy 1 mẫu cụ thể theo ID (hỗ trợ cross-tab loading)
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

// POST /api/qcvns/samples - Lưu mẫu kết quả quan trắc (Luôn đánh giá lại ở Server)
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
  } = req.body;

  if (!name || !type || !sub_type || !values) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (Tên mẫu, Loại quy chuẩn, và Dữ liệu thông số)!' });
  }

  try {
    // Luôn tự đánh giá lại mẫu phía Backend theo catalog QCVN trong DB
    const serverEvaluation = await evaluateQcvnSampleWithDb({
      qcvnId: sub_type,
      measuredValues: values,
      samplingPeriods,
      permitLimits,
      receivingWaterConfirmed,
    });

    const computedDbStatus = serverEvaluation.trang_thai_tong_quat || 'can_ra_soat';
    const evaluationDetails = {
      overallStatus: serverEvaluation.overallStatus,
      conclusionStatus: serverEvaluation.conclusionStatus,
      preliminaryStatus: serverEvaluation.preliminaryStatus,
      reason: serverEvaluation.reason || null,
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

// DELETE /api/qcvns/samples/:id - Xóa mẫu kết quả quan trắc
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
