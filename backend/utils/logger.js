// backend/utils/logger.js
// Lightweight logger wrapper thay thế console.log rải rác

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info']

const prefix = () => new Date().toISOString()

const logger = {
  debug: (...args) => { if (CURRENT_LEVEL <= 0) console.log(`[${prefix()}] [DEBUG]`, ...args) },
  info:  (...args) => { if (CURRENT_LEVEL <= 1) console.log(`[${prefix()}] [INFO]`, ...args) },
  warn:  (...args) => { if (CURRENT_LEVEL <= 2) console.warn(`[${prefix()}] [WARN]`, ...args) },
  error: (...args) => { if (CURRENT_LEVEL <= 3) console.error(`[${prefix()}] [ERROR]`, ...args) },
}

module.exports = logger
