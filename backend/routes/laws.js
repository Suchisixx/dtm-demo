const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit, logLawHistory } = require('../utils/audit');
const logger = require('../utils/logger');
const { ACTIONS } = require('../utils/constants');
const {
  toDbLawStatus,
  normalizeLawNote,
  normalizeLawDescription,
  normalizeLawProvisions,
} = require('../services/repository-shared');

function formatLawRecord(row) {
  const parsedProvisions = Array.isArray(row.dieu_khoang)
    ? row.dieu_khoang
    : (typeof row.dieu_khoang === 'string' ? JSON.parse(row.dieu_khoang) : []);
  return {
    ...row,
    year: parseInt(row.year, 10),
    mo_ta: normalizeLawDescription(row.mo_ta),
    note: normalizeLawNote(row.note),
    dieu_khoang: normalizeLawProvisions(parsedProvisions),
    sortDate: row.sort_date || (row.year ? new Date(parseInt(row.year, 10), 0).getTime() : 0)
  };
}

function extractLeadingNumber(so = '') {
  const m = String(so || '').trim().match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function buildActiveLegalBasis(rows = []) {
  const activeRows = (rows || []).filter(r => !['het_hieu_luc', 'expired'].includes(String(r.status || '').toLowerCase()));

  const vbhns = activeRows
    .filter(r => r.type === 'vbhn' || /vbhn/i.test(String(r.so || '')) || /vbhn/i.test(String(r.id || '')))
    .map(r => ({
      id: r.id,
      so: String(r.so || '').replace(/\/VBHN\/([A-Z0-9-]+)$/i, '/VBHN-$1'),
      year: parseInt(r.year, 10) || 2026,
      ten: r.ten || '',
      mo_ta: r.mo_ta || '',
      num: extractLeadingNumber(r.so),
    }))
    .sort((a, b) => (b.year - a.year) || (b.num - a.num));

  // Phân biệt VBHN Nghị định (hợp nhất NĐ 08/2022, ví dụ 49/VBHN-BNNMT) và VBHN Thông tư / mới nhất (ví dụ 55/VBHN-BNNMT)
  const decreeVbhn = vbhns.find(v => /08\/2022|nghị định|nghi dinh|vbhn_49/i.test(`${v.id} ${v.ten} ${v.mo_ta}`)) || vbhns[vbhns.length - 1] || { so: '49/VBHN-BNNMT', year: 2026 };
  const circularOrLatestVbhn = vbhns.find(v => v.so !== decreeVbhn.so && (/thông tư|thong tu|thi hành một số điều của luật bảo vệ môi trường|^tt_/i.test(`${v.id} ${v.ten} ${v.mo_ta}`) || v.num > (decreeVbhn.num || 0))) || vbhns[0] || { so: '55/VBHN-BNNMT', year: 2026 };

  const ndVbhnSo = decreeVbhn.so || '49/VBHN-BNNMT';
  const ttVbhnSo = circularOrLatestVbhn.so || '55/VBHN-BNNMT';
  const vbhnPairLabel = ndVbhnSo === ttVbhnSo ? ndVbhnSo : `${ndVbhnSo} & ${ttVbhnSo}`;

  return {
    ndVbhnSo,
    ttVbhnSo,
    latestVbhnSo: vbhns[0]?.so || ttVbhnSo,
    activeVbhnList: vbhns.map(v => v.so),
    badgeText: `Chuẩn pháp lý: NĐ 48/2026 • ${vbhnPairLabel}`,
    classificationSubText: `Căn cứ Nghị định 08/2022/NĐ-CP (${ndVbhnSo}) & ${ttVbhnSo}`,
    dashboardSubText: `Theo Điều 28 Luật BVMT 2020, NĐ 08/2022 (NĐ 48/2026 • ${vbhnPairLabel})`,
    footerText: `Dữ liệu đồng bộ theo chuỗi Nghị định 08/2022/NĐ-CP, NĐ 48/2026/NĐ-CP (${vbhnPairLabel})`,
    noticeText: `Nghị định 08/2022/NĐ-CP và Thông tư 02/2022/TT-BTNMT hiện được áp dụng đồng thời với chuỗi sửa đổi, bổ sung tại Nghị định 05/2025/NĐ-CP, Nghị định 48/2026/NĐ-CP, Nghị định 110/2026/NĐ-CP cùng các Văn bản hợp nhất hiện hành trong CSDL: ${ndVbhnSo} (hợp nhất Nghị định) và ${ttVbhnSo} (hợp nhất Thông tư).`,
  };
}

// GET /api/laws/active-basis — lấy thông tin chuẩn pháp lý hiện hành tổng hợp động từ DB
router.get('/active-basis', async (req, res) => {
  try {
    const result = await db.query('SELECT id, type, year, sort_date, so, ten, status, mo_ta FROM laws ORDER BY year DESC, sort_date DESC, id DESC');
    return res.json(buildActiveLegalBasis(result.rows));
  } catch (error) {
    logger.error('Lỗi tổng hợp chuẩn pháp lý hiện hành:', error);
    return res.json(buildActiveLegalBasis([]));
  }
});

// GET /api/laws — lấy danh sách văn bản pháp lý công khai
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM laws ORDER BY sort_date DESC, id DESC');
    
    // Ánh xạ sort_date -> sortDate và bảo đảm dieu_khoang là mảng, đồng thời đồng bộ bản ghi đã chuẩn hóa vào DB nếu còn ký tự sao/tiếng Anh cũ
    const laws = [];
    for (const row of result.rows) {
      const formatted = formatLawRecord(row);
      if ((row.note || null) !== formatted.note || (row.mo_ta || null) !== formatted.mo_ta) {
        db.query(
          'UPDATE laws SET note = $1, mo_ta = $2, dieu_khoang = $3 WHERE id = $4',
          [formatted.note, formatted.mo_ta, JSON.stringify(formatted.dieu_khoang || []), row.id]
        ).catch(() => {});
      }
      laws.push({
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
      });
    }

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
        toDbLawStatus(status, 'con_hieu_luc'),
        normalizeLawDescription(mo_ta),
        JSON.stringify(normalizeLawProvisions(dieu_khoang || [])),
        normalizeLawNote(note),
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
    const prevRes = await db.query(
      'SELECT so, ten, status, hieuluc, mo_ta FROM laws WHERE id = $1',
      [targetId]
    );
    const prevLaw = prevRes?.rows?.[0] || null;

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
        toDbLawStatus(status, 'con_hieu_luc'),
        normalizeLawDescription(mo_ta),
        JSON.stringify(normalizeLawProvisions(dieu_khoang || [])),
        normalizeLawNote(note),
        link || null,
        targetId
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy văn bản pháp lý cần cập nhật!' });
    }

    const updatedLaw = result.rows[0];
    const changedFields = {};
    if (prevLaw) {
      if (prevLaw.so !== updatedLaw.so) changedFields.so = { from: prevLaw.so, to: updatedLaw.so };
      if (prevLaw.ten !== updatedLaw.ten) changedFields.ten = { from: prevLaw.ten, to: updatedLaw.ten };
      if (prevLaw.status !== updatedLaw.status) changedFields.status = { from: prevLaw.status, to: updatedLaw.status };
      if ((prevLaw.hieuluc || '') !== (updatedLaw.hieuluc || '')) changedFields.hieuluc = { from: prevLaw.hieuluc, to: updatedLaw.hieuluc };
      if ((prevLaw.mo_ta || '') !== (updatedLaw.mo_ta || '')) changedFields.mo_ta = { from: 'Đã cập nhật mô tả', to: updatedLaw.mo_ta?.slice(0, 120) || '' };
    }
    const diffSummary = Object.keys(changedFields).length > 0
      ? ` (${Object.keys(changedFields).join(', ')})`
      : '';
    
    // Ghi log bảo mật và lịch sử
    await logAudit(req.user.id, ACTIONS.UPDATE_LAW, req, {
      id: updatedLaw.id,
      so: updatedLaw.so,
      changedFields,
    });
    await logLawHistory(updatedLaw.id, 'update', req.user.id, `Cập nhật văn bản pháp luật: ${updatedLaw.so}${diffSummary}`);

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
