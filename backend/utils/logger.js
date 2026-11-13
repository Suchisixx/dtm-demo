// backend/utils/logger.js
// Lớp ghi nhật ký gọn, thay cho các lệnh console.log rải rác

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info']

const prefix = () => {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().replace('T', ' ').slice(0, 19) + ' +07:00';
};

const logger = {
  debug: (...args) => { if (CURRENT_LEVEL <= 0) console.log(`[${prefix()}] [DEBUG]`, ...args) },
  info:  (...args) => { if (CURRENT_LEVEL <= 1) console.log(`[${prefix()}] [INFO]`, ...args) },
  warn:  (...args) => { if (CURRENT_LEVEL <= 2) console.warn(`[${prefix()}] [WARN]`, ...args) },
  error: (...args) => { if (CURRENT_LEVEL <= 3) console.error(`[${prefix()}] [ERROR]`, ...args) },
}

module.exports = logger
