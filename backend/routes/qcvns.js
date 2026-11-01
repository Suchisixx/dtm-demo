const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { paginate, buildPagination, logQuery } = require('../utils/helpers');
const { ACTIONS, ROLES } = require('../utils/constants');
const logger = require('../utils/logger');

// GET /api/qcvns - Lấy toàn bộ danh sách QCVN (Công khai)
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM qcvns');
    
    // Ánh xạ thành object dạng: { id: { ten, ap_dung, tham_so }, ... }
    const qcvnsObj = {};
    result.rows.forEach(row => {
      qcvnsObj[row.id] = {
        ten: row.ten,
        ap_dung: row.ap_dung,
        tham_so: Array.isArray(row.tham_so) ? row.tham_so : (typeof row.tham_so === 'string' ? JSON.parse(row.tham_so) : [])
      };
    });

    return res.json(qcvnsObj);
  } catch (error) {
    logger.error('Lỗi lấy danh sách QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu quy chuẩn QCVN!' });
  }
});

// GET /api/qcvns/samples - Lấy danh sách kết quả mẫu đã lưu (Hỗ trợ phân trang)
router.get('/samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { page, limit, offset } = paginate(req.query);

  try {
    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM qcvn_samples WHERE user_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0].count, 10);

    const samplesRes = await db.query(
      `SELECT s.*, p.name AS project_name,
              p.form_data AS project_form_data,
              p.classification_result AS project_classification_result,
              p.dia_chi_hien_thi AS project_dia_chi
       FROM qcvn_samples s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.user_id = $1
       ORDER BY s.created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json({
      samples: samplesRes.rows,
      pagination: buildPagination(totalCount, page, limit)
    });
  } catch (error) {
    logger.error('Lỗi lấy danh sách mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách mẫu đã lưu!' });
  }
});

// GET /api/qcvns/samples/:id - Lấy 1 mẫu cụ thể theo ID (hỗ trợ cross-tab loading)
router.get('/samples/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const sampleId = parseInt(req.params.id, 10);

  try {
    const result = await db.query(
      `SELECT s.*, p.name AS project_name,
              p.form_data AS project_form_data,
              p.classification_result AS project_classification_result,
              p.dia_chi_hien_thi AS project_dia_chi
       FROM qcvn_samples s
       LEFT JOIN projects p ON s.project_id = p.id
       WHERE s.id = $1 AND s.user_id = $2`,
      [sampleId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy mẫu!' });
    }

    return res.json({ sample: result.rows[0] });
  } catch (error) {
    logger.error('Lỗi lấy mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải mẫu!' });
  }
});

// POST /api/qcvns/samples - Lưu mẫu kết quả quan trắc (Tạo mới hoặc Cập nhật)
router.post('/samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id, name, type, sub_type, values, project_id, trang_thai_tong_quat } = req.body;

  if (!name || !type || !sub_type || !values) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (Tên mẫu, Loại quy chuẩn, và Dữ liệu thông số)!' });
  }

  try {
    if (id) {
      // Cập nhật mẫu hiện có
      const updateRes = await db.query(
        `UPDATE qcvn_samples 
         SET name = $1, type = $2, sub_type = $3, values = $4, project_id = $5, trang_thai_tong_quat = $6
         WHERE id = $7 AND user_id = $8 
         RETURNING *`,
        [name, type, sub_type, JSON.stringify(values), project_id || null, trang_thai_tong_quat || null, id, userId]
      );

      if (updateRes.rowCount === 0) {
        return res.status(403).json({ error: 'Không tìm thấy mẫu hoặc bạn không có quyền cập nhật!' });
      }

      const sample = updateRes.rows[0];
      
      // Ghi log bảo mật và truy vấn
      await logAudit(userId, ACTIONS.UPDATE_QCVN_SAMPLE, req, { id: sample.id, name: sample.name });
      await logQuery(userId, 'qcvn_comparison', { type, sub_type, values }, { name });

      return res.json({
        message: 'Cập nhật mẫu kết quả quan trắc thành công!',
        sample
      });
    } else {
      // Tạo mẫu mới
      const insertRes = await db.query(
        `INSERT INTO qcvn_samples (user_id, name, type, sub_type, values, project_id, trang_thai_tong_quat) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [userId, name, type, sub_type, JSON.stringify(values), project_id || null, trang_thai_tong_quat || null]
      );

      const sample = insertRes.rows[0];

      // Ghi log bảo mật và truy vấn
      await logAudit(userId, ACTIONS.CREATE_QCVN_SAMPLE, req, { id: sample.id, name: sample.name });
      await logQuery(userId, 'qcvn_comparison', { type, sub_type, values }, { name });

      return res.json({
        message: 'Lưu mẫu kết quả quan trắc thành công!',
        sample
      });
    }
  } catch (error) {
    logger.error('Lỗi lưu mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể lưu mẫu kết quả quan trắc!' });
  }
});

// DELETE /api/qcvns/samples/:id - Xóa mẫu kết quả quan trắc
router.delete('/samples/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const sampleId = req.params.id;

  try {
    const deleteRes = await db.query(
      'DELETE FROM qcvn_samples WHERE id = $1 AND user_id = $2 RETURNING *',
      [sampleId, userId]
    );

    if (deleteRes.rowCount === 0) {
      return res.status(403).json({ error: 'Không tìm thấy mẫu hoặc bạn không có quyền xóa!' });
    }

    const deletedSample = deleteRes.rows[0];
    await logAudit(userId, ACTIONS.DELETE_QCVN_SAMPLE, req, { id: deletedSample.id, name: deletedSample.name });

    return res.json({
      message: 'Xóa mẫu kết quả quan trắc thành công!',
      deletedSample
    });
  } catch (error) {
    logger.error('Lỗi xóa mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể xóa mẫu kết quả quan trắc!' });
  }
});

module.exports = router;
