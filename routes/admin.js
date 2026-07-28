const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

// Yêu cầu phân quyền Admin cho tất cả các định tuyến dưới đây
router.use(requireAdmin);

// =================================================================
// 👥 QUẢN LÝ NHÂN VIÊN (ACCOUNTS CRUD)
// =================================================================

// GET /api/admin/users - Danh sách toàn bộ tài khoản
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Lỗi lấy danh sách tài khoản:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách tài khoản!' });
  }
});

// POST /api/admin/users - Tạo tài khoản mới
router.post('/users', async (req, res) => {
  const { username, password, fullName, role } = req.body;

  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc!' });
  }

  const cleanUsername = username.toLowerCase().trim();

  try {
    // Kiểm tra trùng lặp
    const checkDup = await db.query('SELECT 1 FROM users WHERE username = $1', [cleanUsername]);
    if (checkDup.rowCount > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại trên hệ thống!' });
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, full_name, role, created_at`,
      [cleanUsername, hashedPw, fullName, role]
    );

    const newUser = result.rows[0];
    await logAudit(req.user.id, 'CREATE_USER', req, { target_id: newUser.id, target_username: newUser.username });

    return res.json({
      message: 'Tạo tài khoản nhân viên thành công!',
      user: newUser
    });
  } catch (error) {
    console.error('Lỗi tạo tài khoản nhân viên:', error);
    return res.status(500).json({ error: 'Không thể tạo tài khoản!' });
  }
});

// PUT /api/admin/users/:id - Cập nhật thông tin tài khoản
router.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { username, password, fullName, role } = req.body;

  if (!username || !fullName || !role) {
    return res.status(400).json({ error: 'Vui lòng cung cấp các thông tin bắt buộc!' });
  }

  const cleanUsername = username.toLowerCase().trim();

  try {
    // Kiểm tra trùng username với người khác
    const checkDup = await db.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2', [cleanUsername, userId]);
    if (checkDup.rowCount > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại cho tài khoản khác!' });
    }

    if (password && password.trim() !== '') {
      // Nếu có cập nhật mật khẩu
      const hashedPw = await bcrypt.hash(password, 10);
      const result = await db.query(
        `UPDATE users 
         SET username = $1, password_hash = $2, full_name = $3, role = $4 
         WHERE id = $5 
         RETURNING id, username, full_name, role, created_at`,
        [cleanUsername, hashedPw, fullName, role, userId]
      );
      const updatedUser = result.rows[0];
      await logAudit(req.user.id, 'UPDATE_USER', req, { target_id: updatedUser.id, target_username: updatedUser.username, password_changed: true });
      return res.json({
        message: 'Cập nhật tài khoản và mật khẩu thành công!',
        user: updatedUser
      });
    } else {
      // Nếu giữ nguyên mật khẩu cũ
      const result = await db.query(
        `UPDATE users 
         SET username = $1, full_name = $2, role = $3 
         WHERE id = $4 
         RETURNING id, username, full_name, role, created_at`,
        [cleanUsername, fullName, role, userId]
      );
      const updatedUser = result.rows[0];
      await logAudit(req.user.id, 'UPDATE_USER', req, { target_id: updatedUser.id, target_username: updatedUser.username, password_changed: false });
      return res.json({
        message: 'Cập nhật thông tin tài khoản thành công!',
        user: updatedUser
      });
    }
  } catch (error) {
    console.error('Lỗi cập nhật tài khoản:', error);
    return res.status(500).json({ error: 'Không thể cập nhật tài khoản!' });
  }
});

// DELETE /api/admin/users/:id - Xóa tài khoản
router.delete('/users/:id', async (req, res) => {
  const targetId = parseInt(req.params.id);
  const currentAdminId = req.user.id;

  if (targetId === currentAdminId) {
    return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình!' });
  }

  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [targetId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại!' });
    }
    const deletedUser = result.rows[0];
    await logAudit(req.user.id, 'DELETE_USER', req, { target_id: deletedUser.id, target_username: deletedUser.username });

    return res.json({
      message: 'Xóa tài khoản nhân viên thành công!',
      deletedUser: {
        id: deletedUser.id,
        username: deletedUser.username,
        fullName: deletedUser.full_name
      }
    });
  } catch (error) {
    console.error('Lỗi xóa tài khoản:', error);
    return res.status(500).json({ error: 'Không thể xóa tài khoản này!' });
  }
});

// =================================================================
// 📂 QUẢN LÝ DỰ ÁN (PROJECT MANAGEMENT)
// =================================================================

// GET /api/admin/projects - Xem toàn bộ dự án của tất cả tài khoản
router.get('/projects', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.name, p.form_data, p.checklist_state, p.created_at, 
             u.username as owner_username, u.full_name as owner_name
      FROM projects p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error('Lỗi lấy toàn bộ dự án:', error);
    return res.status(500).json({ error: 'Không thể tải toàn bộ danh sách dự án!' });
  }
});

// DELETE /api/admin/projects/:id - Xóa dự án bất kỳ
router.delete('/projects/:id', async (req, res) => {
  const projectId = req.params.id;
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dự án không tồn tại!' });
    }
    const deletedProject = result.rows[0];
    await logAudit(req.user.id, 'DELETE_PROJECT_ADMIN', req, { project_id: deletedProject.id, project_name: deletedProject.name });

    return res.json({
      message: 'Xóa dự án thành công!',
      deletedProject: deletedProject
    });
  } catch (error) {
    console.error('Lỗi xóa dự án bởi admin:', error);
    return res.status(500).json({ error: 'Không thể xóa dự án!' });
  }
});

module.exports = router;
