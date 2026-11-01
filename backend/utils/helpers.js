// backend/utils/helpers.js
// Helper functions dùng chung giữa các route

const db = require('../config/db')

/**
 * Parse phân trang từ query string
 */
const paginate = (query) => {
  const page = parseInt(query.page || '1', 10)
  const limit = parseInt(query.limit || '5', 10)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

/**
 * Tạo object pagination cho response
 */
const buildPagination = (totalCount, page, limit) => ({
  totalCount,
  totalPages: Math.ceil(totalCount / limit),
  currentPage: page,
  limit
})

/**
 * Ghi log truy vấn vào bảng query_logs (không throw lỗi)
 */
const logQuery = async (userId, queryType, inputParams, outputResult) => {
  try {
    await db.query(
      'INSERT INTO query_logs (user_id, query_type, input_params, output_result) VALUES ($1, $2, $3, $4)',
      [userId, queryType, JSON.stringify(inputParams), JSON.stringify(outputResult)]
    )
  } catch (err) {
    // Ghi log không được phép làm sập request chính
  }
}

module.exports = { paginate, buildPagination, logQuery }
