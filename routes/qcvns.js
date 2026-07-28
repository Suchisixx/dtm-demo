const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

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
    console.error('Lỗi lấy danh sách QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu quy chuẩn QCVN!' });
  }
});

// GET /api/qcvns/samples - Lấy danh sách kết quả mẫu đã lưu (Hỗ trợ phân trang)
router.get('/samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page || '1');
  const limit = parseInt(req.query.limit || '5');
  const offset = (page - 1) * limit;

  try {
    const countRes = await db.query(
      'SELECT COUNT(*) as count FROM qcvn_samples WHERE user_id = $1',
      [userId]
    );
    const totalCount = parseInt(countRes.rows[0].count);
    const totalPages = Math.ceil(totalCount / limit);

    const samplesRes = await db.query(
      'SELECT * FROM qcvn_samples WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [userId, limit, offset]
    );

    return res.json({
      samples: samplesRes.rows,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Lỗi lấy danh sách mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách mẫu đã lưu!' });
  }
});

// POST /api/qcvns/samples - Lưu mẫu kết quả quan trắc (Tạo mới hoặc Cập nhật)
router.post('/samples', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id, name, type, sub_type, values } = req.body;

  if (!name || !type || !sub_type || !values) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ thông tin bắt buộc (Tên mẫu, Loại quy chuẩn, và Dữ liệu thông số)!' });
  }

  try {
    if (id) {
      // Cập nhật mẫu hiện có
      const updateRes = await db.query(
        `UPDATE qcvn_samples 
         SET name = $1, type = $2, sub_type = $3, values = $4 
         WHERE id = $5 AND user_id = $6 
         RETURNING *`,
        [name, type, sub_type, JSON.stringify(values), id, userId]
      );

      if (updateRes.rowCount === 0) {
        return res.status(403).json({ error: 'Không tìm thấy mẫu hoặc bạn không có quyền cập nhật!' });
      }

      const sample = updateRes.rows[0];
      
      // Ghi log bảo mật và truy vấn
      await logAudit(userId, 'UPDATE_QCVN_SAMPLE', req, { id: sample.id, name: sample.name });
      await db.query(
        `INSERT INTO query_logs (user_id, query_type, input_params, output_result)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'qcvn_comparison', JSON.stringify({ type, sub_type, values }), JSON.stringify({ name })]
      );

      return res.json({
        message: 'Cập nhật mẫu kết quả quan trắc thành công!',
        sample: sample
      });
    } else {
      // Tạo mẫu mới
      const insertRes = await db.query(
        `INSERT INTO qcvn_samples (user_id, name, type, sub_type, values) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [userId, name, type, sub_type, JSON.stringify(values)]
      );

      const sample = insertRes.rows[0];

      // Ghi log bảo mật và truy vấn
      await logAudit(userId, 'CREATE_QCVN_SAMPLE', req, { id: sample.id, name: sample.name });
      await db.query(
        `INSERT INTO query_logs (user_id, query_type, input_params, output_result)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'qcvn_comparison', JSON.stringify({ type, sub_type, values }), JSON.stringify({ name })]
      );

      return res.json({
        message: 'Lưu mẫu kết quả quan trắc thành công!',
        sample: sample
      });
    }
  } catch (error) {
    console.error('Lỗi lưu mẫu QCVN:', error);
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
    await logAudit(userId, 'DELETE_QCVN_SAMPLE', req, { id: deletedSample.id, name: deletedSample.name });

    return res.json({
      message: 'Xóa mẫu kết quả quan trắc thành công!',
      deletedSample: deletedSample
    });
  } catch (error) {
    console.error('Lỗi xóa mẫu QCVN:', error);
    return res.status(500).json({ error: 'Không thể xóa mẫu kết quả quan trắc!' });
  }
});

module.exports = router;
