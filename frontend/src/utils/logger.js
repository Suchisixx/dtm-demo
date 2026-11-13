// frontend/src/utils/logger.js
// Lớp ghi nhật ký, chỉ ghi chi tiết trong chế độ phát triển

const isDev = import.meta.env.DEV

export const logger = {
  error: (...args) => { if (isDev) console.error(...args) },
  warn:  (...args) => { if (isDev) console.warn(...args) },
  info:  (...args) => { if (isDev) console.log(...args) },
}
