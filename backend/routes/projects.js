const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { paginate, buildPagination, logQuery } = require('../utils/helpers');
const { ACTIONS, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

const { evaluateClassification } = require('../services/classification-service');

// ── GIS API (trước requireAuth vì route /geo cũng cần auth nhưng query khác) ──

// GET /api/projects/geo - Lấy TẤT CẢ dự án có toạ độ (cho bản đồ GIS)
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

    const projects = geoRes.rows.map(row => {
      const fd = row.form_data || {};
      const fallbackCr = evaluateClassification(fd);
      const cr = (row.classification_result && row.classification_result.nhom)
        ? row.classification_result
        : fallbackCr;

      return {
        id: row.id,
        ten_du_an: row.ten_du_an,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        dia_chi: row.dia_chi_hien_thi || fd.tinh || '',
        loai_ho_so: cr.hs || fallbackCr.hs || '—',
        nhom_du_an: cr.nhom || fallbackCr.nhom || 'Nhóm II',
        co_quan: cr.coQuan || fallbackCr.coQuan || '—',
        tinh: fd.tinh || '',
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

// GET /api/projects/search - Tìm kiếm dự án cho autocomplete liên kết QCVN
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

// GET /api/projects/:id/qcvn-samples - Lịch sử quan trắc QCVN theo dự án
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

// GET /api/projects - Lấy danh sách dự án của user hiện tại (Hỗ trợ phân trang)
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

// GET /api/projects/:id - Lấy chi tiết 1 dự án theo ID (hỗ trợ xem chi tiết từ Bản đồ GIS)
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

    return res.json({ project: projectRes.rows[0] });
  } catch (error) {
    logger.error('Lỗi lấy chi tiết dự án:', error);
    return res.status(500).json({ error: 'Không thể tải chi tiết dự án!' });
  }
});

// POST /api/projects - Lưu dự án (Tạo mới hoặc Cập nhật) — mở rộng với GIS fields
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { id, name, form_data, checklist_state, latitude, longitude, dia_chi_hien_thi, quan_huyen, phuong_xa } = req.body;

  if (!name || !form_data) {
    return res.status(400).json({ error: 'Tên dự án và dữ liệu biểu mẫu là bắt buộc!' });
  }

  // Luôn thực thi và đồng bộ kết quả phân loại trên Backend
  const evaluatedResult = req.body.classification_result || evaluateClassification(form_data);

  try {
    if (id) {
      // CẬP NHẬT dự án hiện có
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
          name, JSON.stringify(form_data), JSON.stringify(checklist_state || {}),
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
      
      // Ghi log bảo mật và truy vấn
      await logAudit(userId, ACTIONS.UPDATE_PROJECT, req, { id: project.id, name: project.name });
      await logQuery(userId, 'classification', form_data, evaluatedResult);

      return res.json({
        message: 'Cập nhật dự án thành công!',
        project
      });
    } else {
      // TẠO MỚI dự án
      const insertRes = await db.query(
        `INSERT INTO projects (user_id, name, form_data, checklist_state, latitude, longitude, dia_chi_hien_thi, quan_huyen, phuong_xa, classification_result) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
         RETURNING *`,
        [
          userId, name, JSON.stringify(form_data), JSON.stringify(checklist_state || {}),
          latitude || null, longitude || null,
          dia_chi_hien_thi || null, quan_huyen || null, phuong_xa || null,
          JSON.stringify(evaluatedResult)
        ]
      );

      const project = insertRes.rows[0];

      // Ghi log bảo mật và truy vấn
      await logAudit(userId, ACTIONS.CREATE_PROJECT, req, { id: project.id, name: project.name });
      await logQuery(userId, 'classification', form_data, evaluatedResult);

      return res.json({
        message: 'Lưu dự án thành công!',
        project
      });
    }
  } catch (error) {
    logger.error('Lỗi lưu dự án:', error);
    return res.status(500).json({ error: 'Không thể lưu dự án!' });
  }
});

// DELETE /api/projects/:id - Xóa dự án của user hiện tại
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
