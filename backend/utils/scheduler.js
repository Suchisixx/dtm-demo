const cron = require('node-cron');
const db = require('../config/db');
const { runCrawler } = require('./crawler');
const logger = require('./logger');
const { CRAWLER_SETTING_KEY, CRON_SCHEDULE } = require('./constants');

let cronTask = null;

function init() {
  logger.info('--- Khởi tạo Scheduler quét văn bản (Mặc định: TẮT tự động) ---');
  
  if (cronTask) {
    cronTask.stop();
  }

  // Đặt lịch tác vụ kiểm tra định kỳ (chỉ chạy khi admin chủ động bật)
  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    try {
      // Đọc cấu hình từ DB xem tính năng quét tự động có được bật không
      const settingRes = await db.query('SELECT value FROM system_settings WHERE key = $1', [CRAWLER_SETTING_KEY]);
      const isEnabled = settingRes.rowCount > 0 && settingRes.rows[0].value === 'true';
      
      if (!isEnabled) {
        logger.info('[Scheduler] Tự động cập nhật luật đang bị tắt trong cấu hình hệ thống (Quản trị viên sử dụng nút cập nhật thủ công trên web).');
        return;
      }
      
      logger.info('[Scheduler] Kích hoạt tự động quét cập nhật luật hàng tháng...');
      await runCrawler();
    } catch (err) {
      logger.error('[Scheduler] Lỗi trong tiến trình quét tự động:', err.message);
    }
  });

  logger.info('✔ Scheduler sẵn sàng (Tự động cập nhật đã tắt theo mặc định).');
}

module.exports = {
  init
};
