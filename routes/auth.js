const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { logAudit } = require('../utils/audit');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'etc_legalhub_jwt_secret_key_2026';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tên đăng nhập và mật khẩu!' });
  }

  try {
    const userRes = await db.query('SELECT * FROM users WHERE username = $1', [username.toLowerCase().trim()]);
    
    if (userRes.rowCount === 0) {
      await logAudit(null, 'LOGIN_FAILED', req, { username });
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    const user = userRes.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      await logAudit(user.id, 'LOGIN_FAILED', req, { username });
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    // Tạo JWT Token
    const payload = {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      role: user.role
    };
    
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    // Gửi Token qua cookie HttpOnly để bảo mật tuyệt đối chống XSS
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 giờ
    });

    await logAudit(user.id, 'LOGIN', req);

    return res.json({
      message: 'Đăng nhập thành công!',
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Lỗi API Login:', error);
    return res.status(500).json({ error: 'Đã xảy ra lỗi trên hệ thống!' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      await logAudit(decoded.id, 'LOGOUT', req);
    } catch (e) {
      // ignore
    }
  }
  res.clearCookie('token');
  return res.json({ message: 'Đăng xuất thành công!' });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.cookies.token;

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
    res.clearCookie('token');
    return res.json({ loggedIn: false });
  }
});

module.exports = router;
