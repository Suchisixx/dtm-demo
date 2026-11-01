const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { runCrawler } = require('../utils/crawler');
const { requireAdmin } = require('../middleware/auth');
const logger = require('../utils/logger');
const { CRAWLER_SETTING_KEY } = require('../utils/constants');

// 1. GET settings (Trạng thái quét tự động)
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settingRes = await db.query('SELECT value FROM system_settings WHERE key = $1', [CRAWLER_SETTING_KEY]);
    const isEnabled = settingRes.rowCount > 0 && settingRes.rows[0].value === 'true';
    return res.json({ success: true, autoCrawlEnabled: isEnabled });
  } catch (err) {
    logger.error('Lỗi khi lấy cấu hình crawler:', err);
    return res.status(500).json({ error: 'Không thể lấy cấu hình từ cơ sở dữ liệu.' });
  }
});

// 2. POST update settings (Bật/tắt quét tự động)
router.post('/settings', requireAdmin, async (req, res) => {
  const { enabled } = req.body;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'Dữ liệu enabled không hợp lệ. Phải là true hoặc false.' });
  }

  try {
    await db.query(
      `INSERT INTO system_settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [CRAWLER_SETTING_KEY, enabled ? 'true' : 'false']
    );
    
    return res.json({
      success: true,
      message: `Đã ${enabled ? 'BẬT' : 'TẮT'} tính năng tự động cập nhật văn bản pháp lý định kỳ.`
    });
  } catch (err) {
    logger.error('Lỗi khi cập nhật cấu hình crawler:', err);
    return res.status(500).json({ error: 'Không thể lưu cấu hình mới.' });
  }
});

// 3. POST run (Chạy crawler thủ công ngay lập tức)
router.post('/run', requireAdmin, async (req, res) => {
  try {
    logger.info(`[Admin Manual Trigger] Admin ${req.user.fullName} kích hoạt cập nhật thủ công.`);
    
    // Run the crawler asynchronously or synchronously.
    // Since it takes a little time (scanning sitemap and pulling new pages), we do it synchronously
    // but with a polite response when done.
    const result = await runCrawler(req.user.id);
    
    return res.json({
      success: true,
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      message: `Quá trình quét hoàn tất! Đã thêm mới ${result.createdCount} và cập nhật ${result.updatedCount} văn bản pháp lý.`
    });
  } catch (err) {
    logger.error('Lỗi trong quá trình quét thủ công:', err);
    return res.status(500).json({ error: `Có lỗi xảy ra: ${err.message}` });
  }
});

// 4. GET history (Lịch sử cập nhật văn bản)
router.get('/history', requireAdmin, async (req, res) => {
  try {
    const historyRes = await db.query(`
      SELECT h.id, h.law_id, h.action, h.updated_at, h.description, u.full_name as updated_by_name
      FROM law_update_history h
      LEFT JOIN users u ON h.updated_by = u.id
      ORDER BY h.updated_at DESC
      LIMIT 100
    `);
    
    return res.json({
      success: true,
      history: historyRes.rows
    });
  } catch (err) {
    logger.error('Lỗi lấy lịch sử cập nhật:', err);
    return res.status(500).json({ error: 'Không thể lấy danh sách lịch sử cập nhật.' });
  }
});

module.exports = router;
