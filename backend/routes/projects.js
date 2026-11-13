const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { paginate, buildPagination, logQuery } = require('../utils/helpers');
const { ACTIONS, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

const {
  IND_DB,
  evaluateClassificationWithDb,
  evaluateStoredProject,
} = require('../services/classification-service');
const { calculateImpactRadius, analyzeSpatialContextWithDb } = require('../services/spatial-gis-service');
const {
  loadClassificationCatalog,
  loadGisLayers,
  getProjectSensitiveVerification,
  upsertProjectSensitiveDeclaration,
  reviewProjectSensitiveVerification,
} = require('../services/rule-repository');
const { syncProjectDefaultObligations } = require('../services/compliance-reminder-service');

async function loadSensitiveVerificationMap() {
  try {
    const res = await db.query(
      `SELECT project_id, declared_flags, declared_details, evidence_ref, verification_status, verified_by, verified_at, verification_note
       FROM project_sensitive_verifications`
    );
    const map = new Map();
    for (const r of (res?.rows || [])) {
      map.set(Number(r.project_id), r);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── API GIS (đặt trước requireAuth vì /geo dùng cách xác thực khác) ──

// GET /api/projects/geo — lấy toàn bộ dự án có tọa độ cho bản đồ GIS
// Route này PHẢI đặt TRƯỚC router.use(requireAuth) và trước GET '/'
router.get('/geo', requireAuth, async (req, res) => {
  try {
    const geoRes = await db.query(`
      SELECT 
        p.id,
        p.name AS ten_du_an,
        p.latitude,
        p.longitude,
        p.dia_chi_hien_thi,
        p.phuong_xa,
        p.quan_huyen,
        p.classification_result,
        p.form_data,
        u.full_name AS user_name,
        latest_qs.created_at AS quan_trac_gan_nhat_ngay,
        latest_qs.trang_thai_tong_quat AS quan_trac_gan_nhat_trang_thai
      FROM projects p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN (
        SELECT DISTINCT ON (project_id)
          project_id, created_at, trang_thai_tong_quat
        FROM qcvn_samples
        WHERE project_id IS NOT NULL
        ORDER BY project_id, created_at DESC
      ) latest_qs ON latest_qs.project_id = p.id
      WHERE p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      ORDER BY p.created_at DESC
    `);

    const [catalogRes, gisLayersRes, verifMap] = await Promise.all([
      loadClassificationCatalog({ db }),
      loadGisLayers({ db }),
      loadSensitiveVerificationMap(),
    ]);

    const activeCatalog = catalogRes.ok && catalogRes.catalog ? catalogRes.catalog : IND_DB;
    const activeRuleSource = catalogRes.ok ? 'DATABASE' : 'FALLBACK_UNVERIFIED';
    const activeGisLayers = gisLayersRes.ok ? gisLayersRes : null;

    const projects = geoRes.rows.map(row => {
      const evaluated = evaluateStoredProject(row, {
        catalog: activeCatalog,
        ruleSource: activeRuleSource,
        fallbackReason: catalogRes.error || null,
        gisLayers: activeGisLayers,
        serverSensitiveVerification: verifMap.get(Number(row.id)) || null,
      });
      const fd = evaluated.formData || {};
      const nhomDuAn = evaluated.nhom || 'Cần rà soát';
      const impactRadiusMeters = evaluated.impactRadiusMeters || calculateImpactRadius(evaluated.nhom || 'Nhóm III', fd.nt, fd.kt);

      return {
        id: row.id,
        ten_du_an: row.ten_du_an,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        dia_chi: row.dia_chi_hien_thi || fd.tinh || '',
        phuong_xa: row.phuong_xa || '',
        loai_ho_so: evaluated.hs || '—',
        nhom_du_an: nhomDuAn,
        tham_quyen: evaluated.tq || null,
        co_quan: evaluated.coQuan || '—',
        conclusion_status: evaluated.conclusionStatus,
        is_official_conclusion: evaluated.isOfficialConclusion,
        verification_status: evaluated.classification?.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
        rule_source: evaluated.classification?.ruleSource || activeRuleSource,
        gis_source: evaluated.spatialAnalysis?.gisSource || (activeGisLayers ? 'DATABASE' : 'FALLBACK_UNVERIFIED'),
        tinh: fd.tinh || '',
        nganh: fd.nganh || '',
        nt: parseFloat(fd.nt) || 0,
        kt: parseFloat(fd.kt) || 0,
        impact_radius_meters: impactRadiusMeters,
        quy_mo: fd.capacity ? `${fd.capacity}` : (fd.cap ? `${fd.cap}` : ''),
        user_name: row.user_name || 'Ẩn danh',
        quan_trac_gan_nhat_ngay: row.quan_trac_gan_nhat_ngay || null,
        quan_trac_gan_nhat_trang_thai: row.quan_trac_gan_nhat_trang_thai || null
      };
    });

    return res.json(projects);
  } catch (error) {
    logger.error('Lỗi lấy dữ liệu GIS:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu bản đồ!' });
  }
});

// GET /api/projects/search — tìm dự án để liên kết với mẫu QCVN
router.get('/search', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const q = (req.query.q || '').trim();

  if (q.length < 2) {
    return res.json([]);
  }

  try {
    const isAdmin = userRole === ROLES.ADMIN;
    const query = `
      SELECT id, name, form_data, classification_result, dia_chi_hien_thi
      FROM projects
      WHERE name ILIKE $1
      ${isAdmin ? '' : 'AND user_id = $2'}
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const params = isAdmin ? [`%${q}%`] : [`%${q}%`, userId];
    const result = await db.query(query, params);

    const projects = result.rows.map(row => {
      const fd = row.form_data || {};
      const cr = row.classification_result || {};
      return {
        id: row.id,
        ten_du_an: row.name,
        loai_ho_so: cr.hs || '—',
        nhom_du_an: cr.nhom || '—',
        tinh_thanh: fd.tinh || '',
        dia_chi_hien_thi: row.dia_chi_hien_thi || fd.tinh || '',
        nganh: fd.nganh || '',
        nt: fd.nt || 0,
        form_data: fd
      };
    });

    return res.json(projects);
  } catch (error) {
    logger.error('Lỗi tìm kiếm dự án:', error);
    return res.status(500).json({ error: 'Không thể tìm kiếm dự án!' });
  }
});

// GET /api/projects/:id/qcvn-samples — lịch sử quan trắc QCVN của dự án
router.get('/:id/qcvn-samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const projectId = parseInt(req.params.id, 10);
  const { page, limit, offset } = paginate(req.query);

  try {
    // Kiểm tra quyền xem dự án
    const isAdmin = userRole === ROLES.ADMIN;
    const checkQuery = isAdmin
      ? 'SELECT id FROM projects WHERE id = $1'
      : 'SELECT id FROM projects WHERE id = $1 AND user_id = $2';
    const checkParams = isAdmin ? [projectId] : [projectId, userId];
    const checkRes = await db.query(checkQuery, checkParams);
    
    if (checkRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy dự án!' });
    }

    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM qcvn_samples WHERE project_id = $1',
      [projectId]
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const samplesRes = await db.query(
      `SELECT id, name, created_at, trang_thai_tong_quat
       FROM qcvn_samples WHERE project_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );

    return res.json({
      samples: samplesRes.rows,
      pagination: buildPagination(totalCount, page, limit)
    });
  } catch (error) {
    logger.error('Lỗi lấy lịch sử quan trắc dự án:', error);
    return res.status(500).json({ error: 'Không thể tải lịch sử quan trắc!' });
  }
});

// PATCH /api/projects/:id/location - Cập nhật vị trí cho dự án
router.patch('/:id/location', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;
  const { latitude, longitude, dia_chi_hien_thi, quan_huyen, phuong_xa } = req.body;

  try {
    const updateRes = await db.query(
      `UPDATE projects 
       SET latitude = $1, longitude = $2, dia_chi_hien_thi = $3, quan_huyen = $4, phuong_xa = $5
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [latitude, longitude, dia_chi_hien_thi || null, quan_huyen || null, phuong_xa || null, projectId, userId]
    );

    if (updateRes.rowCount === 0) {
      return res.status(403).json({ error: 'Không tìm thấy dự án hoặc bạn không có quyền cập nhật!' });
    }

    return res.json({
      message: 'Cập nhật vị trí thành công!',
      project: updateRes.rows[0]
    });
  } catch (error) {
    logger.error('Lỗi cập nhật vị trí:', error);
    return res.status(500).json({ error: 'Không thể cập nhật vị trí!' });
  }
});

// ── Tất cả các tuyến còn lại yêu cầu đăng nhập ──
router.use(requireAuth);

// GET /api/projects — lấy danh sách dự án của người dùng hiện tại, có phân trang
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const { page, limit, offset } = paginate(req.query);

  try {
    // 1. Đếm tổng số dự án của người dùng để phân trang
    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    // 2. Lấy dữ liệu dự án của trang hiện tại
    const projectsRes = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    return res.json({
      projects: projectsRes.rows,
      pagination: buildPagination(totalCount, page, limit)
    });
  } catch (error) {
    logger.error('Lỗi lấy danh sách dự án:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách dự án!' });
  }
});

// GET /api/projects/:id — lấy chi tiết dự án, dùng cả khi mở từ bản đồ GIS
router.get('/:id', async (req, res) => {
  const projectId = req.params.id;
  try {
    const projectRes = await db.query(
      `SELECT p.*, u.full_name AS user_name 
       FROM projects p 
       LEFT JOIN users u ON p.user_id = u.id 
       WHERE p.id = $1`,
      [projectId]
    );

    if (projectRes.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy dự án!' });
    }

    const sensitiveVerification = await getProjectSensitiveVerification(projectId, { db });
    return res.json({ project: projectRes.rows[0], sensitiveVerification });
  } catch (error) {
    logger.error('Lỗi lấy chi tiết dự án:', error);
    return res.status(500).json({ error: 'Không thể tải chi tiết dự án!' });
  }
});

// PUT /api/projects/:id/sensitive-verification — quản trị viên xác minh yếu tố nhạy cảm ở máy chủ
router.put('/:id/sensitive-verification', requireAdmin, async (req, res) => {
  const projectId = parseInt(req.params.id, 10);
  if (Number.isNaN(projectId) || projectId <= 0) {
    return res.status(400).json({ error: 'ID dự án không hợp lệ!' });
  }

  const {
    verification_status,
    verificationStatus,
    evidence_ref = null,
    evidenceRef = null,
    verification_note = null,
    verificationNote = null,
  } = req.body || {};

  const targetStatus = String(verification_status || verificationStatus || '').toUpperCase();
  if (!['VERIFIED', 'REJECTED', 'PENDING_VERIFICATION'].includes(targetStatus)) {
    return res.status(400).json({ error: 'Trạng thái xác minh không hợp lệ (VERIFIED, REJECTED, PENDING_VERIFICATION)!' });
  }

  try {
    const verificationRow = await reviewProjectSensitiveVerification(db, {
      projectId,
      verificationStatus: targetStatus,
      verifiedBy: req.user.id,
      evidenceRef: evidence_ref ?? evidenceRef ?? null,
      verificationNote: verification_note ?? verificationNote ?? null,
    });

    const projRes = await db.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    const projRow = projRes.rows[0];
    const fd = typeof projRow.form_data === 'string'
      ? JSON.parse(projRow.form_data || '{}')
      : (projRow.form_data || {});
    if (projRow.latitude !== null && projRow.latitude !== undefined) fd.latitude = projRow.latitude;
    if (projRow.longitude !== null && projRow.longitude !== undefined) fd.longitude = projRow.longitude;

    const evaluatedResult = await evaluateClassificationWithDb(fd, { db, projectId });
    const updatedProjRes = await db.query(
      'UPDATE projects SET classification_result = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(evaluatedResult), projectId]
    );

    await logAudit(req.user.id, ACTIONS.VERIFY_SENSITIVE_CRITERIA, req, {
      projectId,
      verificationStatus: targetStatus,
      evidenceRef: verificationRow.evidence_ref || null,
      resultingGroup: evaluatedResult.nhom,
    });

    return res.json({
      message: `Đã cập nhật trạng thái xác minh vùng nhạy cảm: ${targetStatus}`,
      sensitiveVerification: verificationRow,
      project: updatedProjRes.rows[0],
      classification: evaluatedResult,
    });
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND') {
      return res.status(404).json({ error: 'Không tìm thấy dự án!' });
    }
    logger.error('Lỗi xác minh vùng nhạy cảm:', error);
    return res.status(500).json({ error: 'Không thể cập nhật trạng thái xác minh vùng nhạy cảm!' });
  }
});

// POST /api/projects — tạo/cập nhật dự án, gồm dữ liệu GIS và xác minh yếu tố nhạy cảm
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { id, name, form_data, checklist_state, latitude, longitude, dia_chi_hien_thi, quan_huyen, phuong_xa } = req.body;

  if (!name || !form_data) {
    return res.status(400).json({ error: 'Tên dự án và dữ liệu biểu mẫu là bắt buộc!' });
  }

  try {
    const resolvedLat = latitude !== undefined && latitude !== null && latitude !== ''
      ? latitude
      : form_data.latitude;
    const resolvedLng = longitude !== undefined && longitude !== null && longitude !== ''
      ? longitude
      : form_data.longitude;

    let spatialSnapshot = null;
    if (resolvedLat !== undefined && resolvedLat !== null && resolvedLng !== undefined && resolvedLng !== null && resolvedLat !== '' && resolvedLng !== '') {
      spatialSnapshot = await analyzeSpatialContextWithDb(resolvedLat, resolvedLng, { db });
    }

    const enrichedFormData = {
      ...form_data,
      ...(resolvedLat !== undefined && resolvedLat !== null ? { latitude: resolvedLat } : {}),
      ...(resolvedLng !== undefined && resolvedLng !== null ? { longitude: resolvedLng } : {}),
    };

    if (id) {
      // Xác nhận quyền sở hữu dự án trước khi đồng bộ khai báo vùng nhạy cảm
      const existingCheck = await db.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      if (!existingCheck || existingCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Không tìm thấy dự án hoặc bạn không có quyền cập nhật!' });
      }

      const sensitiveVerification = await upsertProjectSensitiveDeclaration(db, {
        projectId: id,
        declaredFlags: enrichedFormData,
        declaredDetails: enrichedFormData.sensitiveDetails || {},
        spatialSnapshot,
        evidenceRef: enrichedFormData.sensitiveDetails?.evidenceRef || enrichedFormData.sensitiveEvidenceRef || null,
      });

      const evaluatedResult = await evaluateClassificationWithDb(enrichedFormData, { db, projectId: id });

      const updateRes = await db.query(
        `UPDATE projects 
         SET name = $1, form_data = $2, checklist_state = $3,
             latitude = COALESCE($6, latitude), 
             longitude = COALESCE($7, longitude),
             dia_chi_hien_thi = COALESCE($8, dia_chi_hien_thi),
             quan_huyen = COALESCE($9, quan_huyen),
             phuong_xa = COALESCE($10, phuong_xa),
             classification_result = $11
         WHERE id = $4 AND user_id = $5 
         RETURNING *`,
        [
          name, JSON.stringify(enrichedFormData), JSON.stringify(checklist_state || {}),
          id, userId,
          latitude || null, longitude || null,
          dia_chi_hien_thi || null, quan_huyen || null, phuong_xa || null,
          JSON.stringify(evaluatedResult)
        ]
      );

      if (updateRes.rowCount === 0) {
        return res.status(403).json({ error: 'Không tìm thấy dự án hoặc bạn không có quyền cập nhật!' });
      }

      const project = updateRes.rows[0];
      await logAudit(userId, ACTIONS.UPDATE_PROJECT, req, { id: project.id, name: project.name });
      await logQuery(userId, 'classification', enrichedFormData, evaluatedResult);

      return res.json({
        message: 'Cập nhật dự án thành công!',
        project,
        sensitiveVerification,
      });
    } else {
      // TẠO MỚI dự án: không bao giờ tin sensitiveCriteriaVerified thô từ client -> evaluatedResult giữ PENDING/NEEDS_LEGAL_VERIFICATION
      const evaluatedResult = await evaluateClassificationWithDb(enrichedFormData, { db });

      const insertRes = await db.query(
        `INSERT INTO projects (user_id, name, form_data, checklist_state, latitude, longitude, dia_chi_hien_thi, quan_huyen, phuong_xa, classification_result) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         RETURNING *`,
        [
          userId, name, JSON.stringify(enrichedFormData), JSON.stringify(checklist_state || {}),
          latitude || null, longitude || null,
          dia_chi_hien_thi || null, quan_huyen || null, phuong_xa || null,
          JSON.stringify(evaluatedResult)
        ]
      );

      const project = insertRes.rows[0];
      const sensitiveVerification = await upsertProjectSensitiveDeclaration(db, {
        projectId: project.id,
        declaredFlags: enrichedFormData,
        declaredDetails: enrichedFormData.sensitiveDetails || {},
        spatialSnapshot,
        evidenceRef: enrichedFormData.sensitiveDetails?.evidenceRef || enrichedFormData.sensitiveEvidenceRef || null,
      });

      await syncProjectDefaultObligations({
        db,
        projectRow: project,
        evaluatedResult,
        userId,
      }).catch((err) => logger.warn('Không thể tự động khởi tạo nghĩa vụ mặc định cho dự án:', err.message));

      await logAudit(userId, ACTIONS.CREATE_PROJECT, req, { id: project.id, name: project.name });
      await logQuery(userId, 'classification', enrichedFormData, evaluatedResult);

      return res.json({
        message: 'Lưu dự án thành công!',
        project,
        sensitiveVerification,
      });
    }
  } catch (error) {
    logger.error('Lỗi lưu dự án:', error);
    return res.status(500).json({ error: 'Không thể lưu dự án!' });
  }
});

// DELETE /api/projects/:id — xóa dự án của người dùng hiện tại
router.delete('/:id', async (req, res) => {
  const userId = req.user.id;
  const projectId = req.params.id;

  try {
    const deleteRes = await db.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING *',
      [projectId, userId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(403).json({ error: 'Không tìm thấy dự án hoặc bạn không có quyền xóa!' });
    }

    const deletedProject = deleteRes.rows[0];
    await logAudit(userId, ACTIONS.DELETE_PROJECT, req, { id: deletedProject.id, name: deletedProject.name });

    return res.json({
      message: 'Xóa dự án thành công!',
      deletedProject
    });
  } catch (error) {
    logger.error('Lỗi xóa dự án:', error);
    return res.status(500).json({ error: 'Không thể xóa dự án!' });
  }
});

module.exports = router;
