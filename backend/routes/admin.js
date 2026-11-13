const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const logger = require('../utils/logger');
const { BCRYPT_SALT_ROUNDS, ACTIONS } = require('../utils/constants');

// Yêu cầu phân quyền Admin cho tất cả các định tuyến dưới đây
router.use(requireAdmin);

// Quản lý nhân viên và tài khoản

// GET /api/admin/users — danh sách toàn bộ tài khoản
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(result.rows);
  } catch (error) {
    logger.error('Lỗi lấy danh sách tài khoản:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách tài khoản!' });
  }
});

// POST /api/admin/users — tạo tài khoản mới
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

    const hashedPw = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, full_name, role, created_at`,
      [cleanUsername, hashedPw, fullName, role]
    );

    const newUser = result.rows[0];
    await logAudit(req.user.id, ACTIONS.CREATE_USER, req, { target_id: newUser.id, target_username: newUser.username });

    return res.json({
      message: 'Tạo tài khoản nhân viên thành công!',
      user: newUser
    });
  } catch (error) {
    logger.error('Lỗi tạo tài khoản nhân viên:', error);
    return res.status(500).json({ error: 'Không thể tạo tài khoản!' });
  }
});

// PUT /api/admin/users/:id — cập nhật thông tin tài khoản
router.put('/users/:id', async (req, res) => {
  const targetId = req.params.id;
  const { username, password, fullName, role } = req.body;

  if (!username || !fullName || !role) {
    return res.status(400).json({ error: 'Vui lòng cung cấp các thông tin bắt buộc!' });
  }

  const cleanUsername = username.toLowerCase().trim();

  try {
    // Kiểm tra trùng username với người khác
    const checkDup = await db.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2', [cleanUsername, targetId]);
    if (checkDup.rowCount > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại cho tài khoản khác!' });
    }

    const fields = ['username = $1', 'full_name = $2', 'role = $3'];
    const values = [cleanUsername, fullName, role];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      fields.push(`password_hash = $${fields.length + 1}`);
      values.push(hashedPassword);
    }

    values.push(targetId);

    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, username, full_name, role, created_at`,
      values
    );

    const updatedUser = result.rows[0];
    const password_changed = !!(password && password.trim() !== '');

    await logAudit(req.user.id, ACTIONS.UPDATE_USER, req, {
      target_id: updatedUser.id,
      target_username: updatedUser.username,
      password_changed
    });

    return res.json({
      message: password_changed ? 'Cập nhật tài khoản và mật khẩu thành công!' : 'Cập nhật thông tin tài khoản thành công!',
      user: updatedUser
    });
  } catch (error) {
    logger.error('Lỗi cập nhật tài khoản:', error);
    return res.status(500).json({ error: 'Không thể cập nhật tài khoản!' });
  }
});

// DELETE /api/admin/users/:id — xóa tài khoản
router.delete('/users/:id', async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
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
    await logAudit(req.user.id, ACTIONS.DELETE_USER, req, { target_id: deletedUser.id, target_username: deletedUser.username });

    return res.json({
      message: 'Xóa tài khoản nhân viên thành công!',
      deletedUser: {
        id: deletedUser.id,
        username: deletedUser.username,
        fullName: deletedUser.full_name
      }
    });
  } catch (error) {
    logger.error('Lỗi xóa tài khoản:', error);
    return res.status(500).json({ error: 'Không thể xóa tài khoản này!' });
  }
});

// Quản lý dự án

// GET /api/admin/projects — xem dự án của mọi tài khoản
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
    logger.error('Lỗi lấy toàn bộ dự án:', error);
    return res.status(500).json({ error: 'Không thể tải toàn bộ danh sách dự án!' });
  }
});

// DELETE /api/admin/projects/:id — xóa dự án
router.delete('/projects/:id', async (req, res) => {
  const projectId = req.params.id;
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dự án không tồn tại!' });
    }
    const deletedProject = result.rows[0];
    await logAudit(req.user.id, ACTIONS.DELETE_PROJECT_ADMIN, req, { project_id: deletedProject.id, project_name: deletedProject.name });

    return res.json({
      message: 'Xóa dự án thành công!',
      deletedProject
    });
  } catch (error) {
    logger.error('Lỗi xóa dự án bởi admin:', error);
    return res.status(500).json({ error: 'Không thể xóa dự án!' });
  }
});

module.exports = router;
