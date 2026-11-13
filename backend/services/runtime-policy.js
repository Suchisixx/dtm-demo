// backend/services/runtime-policy.js
// Quản lý chính sách nguồn dữ liệu runtime và cơ chế fail-closed khi DB gặp sự cố.

class RuleDataUnavailableError extends Error {
  constructor(message = 'Dữ liệu quy tắc từ cơ sở dữ liệu PostgreSQL không khả dụng', details = {}) {
    super(message);
    this.name = 'RuleDataUnavailableError';
    this.errorCode = 'RULE_DB_UNAVAILABLE';
    this.status = 503;
    this.details = details;
  }
}

/**
 * Kiểm tra có cho phép dùng dữ liệu tĩnh dự phòng hay không.
 * Trong môi trường production (NODE_ENV === 'production') hoặc khi biến ALLOW_STATIC_FALLBACK='false',
 * hệ thống TUYỆT ĐỐI KHÔNG dùng dữ liệu JS tĩnh một cách âm thầm; phải fail-closed và trả lỗi 503.
 * Trong môi trường phát triển/kiểm thử, dữ liệu dự phòng phải gắn cờ FALLBACK_UNVERIFIED + NEEDS_REVIEW.
 */
function isStaticFallbackAllowed() {
  if (process.env.ALLOW_STATIC_FALLBACK === 'false') {
    return false;
  }
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  return true;
}

module.exports = {
  RuleDataUnavailableError,
  isStaticFallbackAllowed,
};
