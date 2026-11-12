const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
const { getDashboardStats } = require('../services/dashboard-service');

// GET /api/dashboard/stats - Tổng hợp số liệu thống kê cho Dashboard
router.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === ROLES.ADMIN;
  const filterUserId = isAdmin && req.query.user_id && req.query.user_id !== 'all'
    ? parseInt(req.query.user_id, 10)
    : null;

  try {
    const stats = await getDashboardStats({ userId, isAdmin, filterUserId });
    return res.json(stats);
  } catch (error) {
    logger.error('Lỗi tải số liệu Dashboard:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu thống kê Dashboard!' });
  }
});

module.exports = router;
