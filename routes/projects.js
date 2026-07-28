const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// Tất cả các tuyến dự án yêu cầu người dùng phải đăng nhập
router.use(requireAuth);

// GET /api/projects - Lấy danh sách dự án của user hiện tại (Hỗ trợ phân trang)
router.get('/', async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '5');
  const offset = (page - 1) * limit;

  try {
    // 1. Đếm tổng số dự án của người dùng để phân trang
    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    // 2. Lấy dữ liệu dự án của trang hiện tại
    const projectsRes = await db.query(
      'SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    return res.json({
      projects: projectsRes.rows,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách dự án:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách dự án!' });
  }
});

// POST /api/projects - Lưu dự án (Tạo mới hoặc Cập nhật)
router.post('/', async (req, res) => {
  const userId = req.user.id;
  const { id, name, form_data, checklist_state } = req.body;

  if (!name || !form_data) {
    return res.status(400).json({ error: 'Tên dự án và dữ liệu biểu mẫu là bắt buộc!' });
  }

  try {
    if (id) {
      // CẬP NHẬT dự án hiện có
      const updateRes = await db.query(
        `UPDATE projects 
         SET name = $1, form_data = $2, checklist_state = $3 
         WHERE id = $4 AND user_id = $5 
         RETURNING *`,
        [name, JSON.stringify(form_data), JSON.stringify(checklist_state || {}), id, userId]
      );

      if (updateRes.rowCount === 0) {
        return res.status(403).json({ error: 'Không tìm thấy dự án hoặc bạn không có quyền cập nhật!' });
      }

      const project = updateRes.rows[0];
      
      // Ghi log bảo mật và truy vấn
      await logAudit(userId, 'UPDATE_PROJECT', req, { id: project.id, name: project.name });
      await db.query(
        `INSERT INTO query_logs (user_id, query_type, input_params, output_result)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'classification', JSON.stringify(form_data), JSON.stringify(checklist_state || {})]
      );

      return res.json({
        message: 'Cập nhật dự án thành công!',
        project: project
      });
    } else {
      // TẠO MỚI dự án
      const insertRes = await db.query(
        `INSERT INTO projects (user_id, name, form_data, checklist_state) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [userId, name, JSON.stringify(form_data), JSON.stringify(checklist_state || {})]
      );

      const project = insertRes.rows[0];

      // Ghi log bảo mật và truy vấn
      await logAudit(userId, 'CREATE_PROJECT', req, { id: project.id, name: project.name });
      await db.query(
        `INSERT INTO query_logs (user_id, query_type, input_params, output_result)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'classification', JSON.stringify(form_data), JSON.stringify(checklist_state || {})]
      );

      return res.json({
        message: 'Lưu dự án thành công!',
        project: project
      });
    }
  } catch (error) {
    console.error('Lỗi lưu dự án:', error);
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
    await logAudit(userId, 'DELETE_PROJECT', req, { id: deletedProject.id, name: deletedProject.name });

    return res.json({
      message: 'Xóa dự án thành công!',
      deletedProject: deletedProject
    });
  } catch (error) {
    console.error('Lỗi xóa dự án:', error);
    return res.status(500).json({ error: 'Không thể xóa dự án!' });
  }
});

module.exports = router;
