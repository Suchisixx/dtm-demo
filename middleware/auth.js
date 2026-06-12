const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'etc_legalhub_jwt_secret_key_2026';

function requireAuth(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập! Vui lòng đăng nhập.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, fullName }
    next();
  } catch (error) {
    res.clearCookie('token');
    return res.status(401).json({ error: 'Phiên làm việc hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
  }
}

module.exports = {
  requireAuth
};
