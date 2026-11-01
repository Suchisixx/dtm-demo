// frontend/src/utils/string-helpers.js
// Hàm xử lý chuỗi tiếng Việt dùng chung

/**
 * Xóa dấu tiếng Việt và chuẩn hóa chuỗi
 */
export function removeAccents(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

/**
 * Chuẩn hóa chuỗi: xóa dấu + lowercase + trim
 */
export function normalizeString(str) {
  return removeAccents((str || '').toLowerCase().trim())
}
