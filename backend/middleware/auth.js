const jwt = require('jsonwebtoken');
require('dotenv').config();
const { JWT_SECRET, COOKIE_NAME, ROLES } = require('../utils/constants');

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập! Vui lòng đăng nhập.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, fullName }
    next();
  } catch (error) {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Phiên làm việc hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ error: 'Quyền truy cập bị từ chối! Bạn không có quyền Quản trị.' });
    }
    next();
  });
}

module.exports = {
  requireAuth,
  requireAdmin
};
