// backend/utils/helpers.js
// Các hàm hỗ trợ dùng chung giữa các tuyến API

const db = require('../config/db')

/**
 * Phân tích tham số phân trang từ chuỗi truy vấn
 */
const paginate = (query) => {
  const page = parseInt(query.page || '1', 10)
  const limit = parseInt(query.limit || '5', 10)
  const offset = (page - 1) * limit
  return { page, limit, offset }
}

/**
 * Tạo đối tượng phân trang cho phản hồi
 */
const buildPagination = (totalCount, page, limit) => ({
  totalCount,
  totalPages: Math.ceil(totalCount / limit),
  currentPage: page,
  limit
})

/**
 * Ghi nhật ký truy vấn vào bảng query_logs; lỗi ghi log không làm hỏng yêu cầu chính
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
