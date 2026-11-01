// frontend/src/utils/logger.js
// Logger wrapper — chỉ log ở development mode

const isDev = import.meta.env.DEV

export const logger = {
  error: (...args) => { if (isDev) console.error(...args) },
  warn:  (...args) => { if (isDev) console.warn(...args) },
  info:  (...args) => { if (isDev) console.log(...args) },
}
