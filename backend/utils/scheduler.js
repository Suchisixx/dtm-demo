const cron = require('node-cron');
const db = require('../config/db');
const { runCrawler } = require('./crawler');
const { runComplianceDeadlineScan } = require('../services/compliance-reminder-service');
const logger = require('./logger');
const { CRAWLER_SETTING_KEY, CRON_SCHEDULE } = require('./constants');

let cronTask = null;
let reminderCronTask = null;

function init() {
  logger.info('--- Khởi tạo Bộ lập lịch quét văn bản & nhắc hạn tuân thủ ---');
  
  if (cronTask) {
    cronTask.stop();
  }
  if (reminderCronTask) {
    reminderCronTask.stop();
  }

  // Đặt lịch tác vụ kiểm tra cập nhật văn bản định kỳ (chỉ chạy khi admin chủ động bật)
  cronTask = cron.schedule(CRON_SCHEDULE, async () => {
    try {
      // Đọc cấu hình từ DB xem tính năng quét tự động có được bật không
      const settingRes = await db.query('SELECT value FROM system_settings WHERE key = $1', [CRAWLER_SETTING_KEY]);
      const isEnabled = settingRes.rowCount > 0 && settingRes.rows[0].value === 'true';
      
      if (!isEnabled) {
        logger.info('[Bộ lập lịch] Tự động cập nhật luật đang bị tắt trong cấu hình hệ thống (Quản trị viên sử dụng nút cập nhật thủ công trên web).');
        return;
      }
      
      logger.info('[Bộ lập lịch] Kích hoạt tự động quét cập nhật luật hàng tháng...');
      await runCrawler();
    } catch (err) {
      logger.error('[Bộ lập lịch] Lỗi trong tiến trình quét tự động:', err.message);
    }
  });

  // Đặt lịch quét nhắc hạn nghĩa vụ tuân thủ hàng ngày lúc 07:00 sáng
  reminderCronTask = cron.schedule('0 7 * * *', async () => {
    try {
      await runComplianceDeadlineScan({ db });
    } catch (err) {
      logger.error('[Bộ lập lịch] Lỗi trong tiến trình quét nhắc hạn tuân thủ:', err.message);
    }
  });

  logger.info('✔ Bộ lập lịch sẵn sàng (Quét nhắc hạn tuân thủ chạy lúc 07:00 hàng ngày).');
}

module.exports = {
  init
};
