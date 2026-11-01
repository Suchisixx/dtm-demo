const cron = require('node-cron');
const db = require('../config/db');
const { runCrawler } = require('./crawler');
const logger = require('./logger');
const { CRAWLER_SETTING_KEY, CRON_SCHEDULE } = require('./constants');

function init() {
  logger.info('--- Khởi tạo Scheduler quét văn bản tự động ---');
  
  // Đặt lịch tác vụ chạy định kỳ
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      // Đọc cấu hình từ DB xem tính năng quét tự động có được bật không
      const settingRes = await db.query('SELECT value FROM system_settings WHERE key = $1', [CRAWLER_SETTING_KEY]);
      const isEnabled = settingRes.rowCount > 0 && settingRes.rows[0].value === 'true';
      
      if (!isEnabled) {
        logger.info('[Scheduler] Tự động cập nhật luật đang bị tắt trong cấu hình hệ thống.');
        return;
      }
      
      logger.info('[Scheduler] Kích hoạt tự động quét cập nhật luật hàng tháng (ngày 1 hàng tháng lúc 00:00)...');
      await runCrawler();
    } catch (err) {
      logger.error('[Scheduler] Lỗi trong tiến trình quét tự động:', err.message);
    }
  });

  logger.info('✔ Scheduler đã đăng ký tác vụ node-cron hàng tháng thành công.');
}

module.exports = {
  init
};
