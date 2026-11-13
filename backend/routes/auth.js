const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAudit } = require('../utils/audit');
const logger = require('../utils/logger');
const { JWT_SECRET, JWT_EXPIRY, COOKIE_NAME, COOKIE_MAX_AGE, ACTIONS } = require('../utils/constants');
require('dotenv').config();

// POST /api/auth/login — đăng nhập
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tên đăng nhập và mật khẩu!' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase().trim()]);
    
    if (userRes.rowCount === 0) {
      await logAudit(null, ACTIONS.LOGIN_FAILED, req, { username });
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      await logAudit(user.id, ACTIONS.LOGIN_FAILED, req, { username });
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    // Tạo JWT Token
    const payload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

    // Gửi Token qua cookie HttpOnly để bảo mật tuyệt đối chống XSS
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE // 24 giờ
    });

    await logAudit(user.id, ACTIONS.LOGIN, req);

    return res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Lỗi API Login:', error);
    return res.status(500).json({ error: 'Đã xảy ra lỗi trên hệ thống!' });
  }
});

// POST /api/auth/logout — đăng xuất
router.post('/logout', async (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      await logAudit(decoded.id, ACTIONS.LOGOUT, req);
    } catch (e) {
      // Bỏ qua lỗi khi xóa cookie phiên
    }
  }
  res.clearCookie(COOKIE_NAME);
  return res.json({ message: 'Đăng xuất thành công!' });
});

// GET /api/auth/me — lấy thông tin phiên hiện tại
router.get('/me', async (req, res) => {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    return res.json({ loggedIn: false });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({
      loggedIn: true,
      user: decoded
    });
  } catch (error) {
    res.clearCookie(COOKIE_NAME);
    return res.json({ loggedIn: false });
  }
});

module.exports = router;
