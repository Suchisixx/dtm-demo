// backend/routes/reminders.js
// Tuyến API Giám sát nhắc hạn nghĩa vụ tuân thủ môi trường
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
const { IND_DB, evaluateStoredProject } = require('../services/classification-service');
const { loadClassificationCatalog, loadGisLayers } = require('../services/rule-repository');
const {
  listComplianceObligations,
  assertProjectAccess,
  syncProjectDefaultObligations,
  createComplianceObligation,
  completeComplianceObligation,
  deleteComplianceObligation,
  runComplianceDeadlineScan,
} = require('../services/compliance-reminder-service');

router.use(requireAuth);

// GET /api/reminders — Danh sách nhắc hạn tuân thủ & thống kê
router.get('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === ROLES.ADMIN;
    const projectId = req.query.project_id ? parseInt(req.query.project_id, 10) : null;
    const filterUserId = isAdmin && req.query.user_id && req.query.user_id !== 'all'
      ? parseInt(req.query.user_id, 10)
      : null;
    const alertLevel = req.query.muc_canh_bao ? String(req.query.muc_canh_bao).trim() : null;

    const data = await listComplianceObligations({
      db,
      userId: req.user.id,
      isAdmin,
      projectId: Number.isInteger(projectId) && projectId > 0 ? projectId : null,
      alertLevel,
      filterUserId: Number.isInteger(filterUserId) && filterUserId > 0 ? filterUserId : null,
    });

    return res.json(data);
  } catch (err) {
    logger.error('Lỗi GET /api/reminders:', err);
    return res.status(500).json({ error: 'Không thể tải danh sách nhắc hạn tuân thủ.' });
  }
});

// POST /api/reminders — Thêm mốc nhắc hạn mới cho dự án
router.post('/', async (req, res) => {
  try {
    const isAdmin = req.user.role === ROLES.ADMIN;
    const created = await createComplianceObligation({
      db,
      payload: req.body || {},
      userId: req.user.id,
      isAdmin,
    });
    return res.status(201).json({
      message: 'Đã thêm mốc nhắc hạn tuân thủ thành công.',
      item: created,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error('Lỗi POST /api/reminders:', err);
    return res.status(status).json({ error: err.message || 'Không thể tạo mốc nhắc hạn.' });
  }
});

// POST /api/reminders/projects/:projectId/sync — Tự động sinh nghĩa vụ mặc định theo kết quả phân loại
router.post('/projects/:projectId/sync', async (req, res) => {
  try {
    const isAdmin = req.user.role === ROLES.ADMIN;
    const projectId = parseInt(req.params.projectId, 10);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ error: 'Mã dự án không hợp lệ.' });
    }

    const project = await assertProjectAccess({ db, projectId, userId: req.user.id, isAdmin });
    const [catalogRes, gisRes] = await Promise.all([
      loadClassificationCatalog({ db }),
      loadGisLayers({ db }),
    ]);

    const evaluated = evaluateStoredProject(project, {
      catalog: catalogRes.ok && catalogRes.catalog ? catalogRes.catalog : IND_DB,
      ruleSource: catalogRes.ok ? 'DATABASE' : 'FALLBACK_UNVERIFIED',
      fallbackReason: catalogRes.error || null,
      gisLayers: gisRes.ok ? gisRes : null,
    });

    const syncRes = await syncProjectDefaultObligations({
      db,
      projectRow: project,
      evaluatedResult: evaluated,
      userId: project.user_id || req.user.id,
    });

    return res.json({
      message: syncRes.inserted > 0
        ? `Đã khởi tạo ${syncRes.inserted} nghĩa vụ tuân thủ theo hồ sơ dự án.`
        : 'Các nghĩa vụ mặc định cho dự án đã tồn tại đầy đủ.',
      inserted: syncRes.inserted,
      items: syncRes.items,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error('Lỗi POST /api/reminders/projects/:projectId/sync:', err);
    return res.status(status).json({ error: err.message || 'Không thể đồng bộ nghĩa vụ mặc định.' });
  }
});

// PATCH /api/reminders/:id/complete — Đánh dấu hoàn thành nghĩa vụ (và sinh kỳ tiếp theo nếu định kỳ)
router.patch('/:id/complete', async (req, res) => {
  try {
    const isAdmin = req.user.role === ROLES.ADMIN;
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Mã mốc nhắc hạn không hợp lệ.' });
    }

    const createNextPeriod = req.body?.tao_ky_tiep_theo !== false;
    const note = req.body?.ghi_chu_hoan_thanh || req.body?.note || '';

    const result = await completeComplianceObligation({
      db,
      id,
      userId: req.user.id,
      isAdmin,
      note,
      createNextPeriod,
    });

    return res.json({
      message: result.nextItem
        ? 'Đã đánh dấu hoàn thành và tự động tạo kỳ nhắc hạn tiếp theo.'
        : 'Đã đánh dấu hoàn thành nghĩa vụ tuân thủ.',
      ...result,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error('Lỗi PATCH /api/reminders/:id/complete:', err);
    return res.status(status).json({ error: err.message || 'Không thể cập nhật trạng thái nghĩa vụ.' });
  }
});

// DELETE /api/reminders/:id — Xóa mốc nhắc hạn
router.delete('/:id', async (req, res) => {
  try {
    const isAdmin = req.user.role === ROLES.ADMIN;
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Mã mốc nhắc hạn không hợp lệ.' });
    }

    const deleted = await deleteComplianceObligation({
      db,
      id,
      userId: req.user.id,
      isAdmin,
    });

    return res.json({
      message: 'Đã xóa mốc nhắc hạn tuân thủ.',
      ...deleted,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) logger.error('Lỗi DELETE /api/reminders/:id:', err);
    return res.status(status).json({ error: err.message || 'Không thể xóa mốc nhắc hạn.' });
  }
});

// POST /api/reminders/scan — Chạy quét hạn tuân thủ ngay (dùng cho Admin / kiểm tra trực tiếp)
router.post('/scan', async (req, res) => {
  try {
    const summary = await runComplianceDeadlineScan({ db });
    return res.json({
      message: 'Đã hoàn tất quét giám sát nhắc hạn tuân thủ.',
      summary,
    });
  } catch (err) {
    logger.error('Lỗi POST /api/reminders/scan:', err);
    return res.status(500).json({ error: 'Không thể chạy quét nhắc hạn.' });
  }
});

module.exports = router;
