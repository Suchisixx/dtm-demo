const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit, logLawHistory } = require('../utils/audit');
const logger = require('../utils/logger');
const { ACTIONS } = require('../utils/constants');

function formatLawRecord(row) {
  return {
    ...row,
    year: parseInt(row.year, 10),
    dieu_khoang: Array.isArray(row.dieu_khoang) ? row.dieu_khoang : (typeof row.dieu_khoang === 'string' ? JSON.parse(row.dieu_khoang) : []),
    sortDate: row.sort_date || (row.year ? new Date(parseInt(row.year, 10), 0).getTime() : 0)
  };
}

// GET /api/laws — lấy danh sách văn bản pháp lý công khai
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM laws ORDER BY sort_date DESC, id DESC');
    
    // Ánh xạ sort_date -> sortDate và bảo đảm dieu_khoang là mảng
    const laws = result.rows.map(row => {
      const formatted = formatLawRecord(row);
      return {
        id: formatted.id,
        type: formatted.type,
        year: formatted.year,
        sortDate: formatted.sortDate,
        so: formatted.so,
        ten: formatted.ten,
        hieuluc: formatted.hieuluc,
        status: formatted.status,
        mo_ta: formatted.mo_ta,
        dieu_khoang: formatted.dieu_khoang,
        note: formatted.note,
        link: formatted.link
      };
    });

    return res.json(laws);
  } catch (error) {
    logger.error('Lỗi lấy danh sách văn bản pháp lý:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách văn bản pháp lý!' });
  }
});

// Các API dưới đây yêu cầu quyền Admin
// POST /api/laws — thêm văn bản pháp lý
router.post('/', requireAdmin, async (req, res) => {
  const { id, type, year, sortDate, so, ten, hieuluc, status, mo_ta, dieu_khoang, note, link } = req.body;

  if (!id || !type || !year || !so || !ten) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các thông tin bắt buộc (Mã, Loại, Năm, Số hiệu, Tên văn bản)!' });
  }

  try {
    // Kiểm tra trùng ID
    const checkDup = await db.query('SELECT 1 FROM laws WHERE id = $1', [id.trim()]);
    if (checkDup.rowCount > 0) {
      return res.status(400).json({ error: 'Mã văn bản pháp lý đã tồn tại!' });
    }

    const result = await db.query(
      `INSERT INTO laws (id, type, year, sort_date, so, ten, hieuluc, status, mo_ta, dieu_khoang, note, link)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        id.trim(),
        type,
        parseInt(year, 10),
        sortDate || null,
        so,
        ten,
        hieuluc || null,
        status || 'valid',
        mo_ta || null,
        JSON.stringify(dieu_khoang || []),
        note || null,
        link || null
      ]
    );

    const newLaw = result.rows[0];
    
    // Ghi log bảo mật và lịch sử
    await logAudit(req.user.id, ACTIONS.CREATE_LAW, req, { id: newLaw.id, so: newLaw.so });
    await logLawHistory(newLaw.id, 'create', req.user.id, `Thêm mới văn bản pháp luật: ${newLaw.so} - ${newLaw.ten}`);

    return res.json({
      message: 'Thêm mới văn bản pháp lý thành công!',
      law: formatLawRecord(newLaw)
    });
  } catch (error) {
    logger.error('Lỗi thêm văn bản pháp lý:', error);
    return res.status(500).json({ error: 'Không thể thêm văn bản pháp lý mới!' });
  }
});

// PUT /api/laws/:id — cập nhật văn bản pháp lý
router.put('/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  const { type, year, sortDate, so, ten, hieuluc, status, mo_ta, dieu_khoang, note, link } = req.body;

  if (!type || !year || !so || !ten) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ các thông tin bắt buộc!' });
  }

  try {
    const result = await db.query(
      `UPDATE laws
       SET type = $1, year = $2, sort_date = $3, so = $4, ten = $5, hieuluc = $6, status = $7, mo_ta = $8, dieu_khoang = $9, note = $10, link = $11
       WHERE id = $12
       RETURNING *`,
      [
        type,
        parseInt(year, 10),
        sortDate || null,
        so,
        ten,
        hieuluc || null,
        status || 'valid',
        mo_ta || null,
        JSON.stringify(dieu_khoang || []),
        note || null,
        link || null,
        targetId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy văn bản pháp lý cần cập nhật!' });
    }

    const updatedLaw = result.rows[0];
    
    // Ghi log bảo mật và lịch sử
    await logAudit(req.user.id, ACTIONS.UPDATE_LAW, req, { id: updatedLaw.id, so: updatedLaw.so });
    await logLawHistory(updatedLaw.id, 'update', req.user.id, `Cập nhật văn bản pháp luật: ${updatedLaw.so}`);

    return res.json({
      message: 'Cập nhật văn bản pháp lý thành công!',
      law: formatLawRecord(updatedLaw)
    });
  } catch (error) {
    logger.error('Lỗi cập nhật văn bản pháp lý:', error);
    return res.status(500).json({ error: 'Không thể cập nhật văn bản pháp lý!' });
  }
});

// DELETE /api/laws/:id — xóa văn bản pháp lý
router.delete('/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;

  try {
    const result = await db.query('DELETE FROM laws WHERE id = $1 RETURNING *', [targetId]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy văn bản pháp lý cần xóa!' });
    }

    const deletedLaw = result.rows[0];
    
    // Ghi log bảo mật và lịch sử
    await logAudit(req.user.id, ACTIONS.DELETE_LAW, req, { id: deletedLaw.id, so: deletedLaw.so });
    await logLawHistory(deletedLaw.id, 'expire', req.user.id, `Xóa/Ngừng áp dụng văn bản pháp luật: ${deletedLaw.so}`);

    return res.json({
      message: 'Xóa văn bản pháp lý thành công!',
      deletedLaw
    });
  } catch (error) {
    logger.error('Lỗi xóa văn bản pháp lý:', error);
    return res.status(500).json({ error: 'Không thể xóa văn bản pháp lý!' });
  }
});

module.exports = router;
