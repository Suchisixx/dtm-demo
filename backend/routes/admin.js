const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const logger = require('../utils/logger');
const { BCRYPT_SALT_ROUNDS, ACTIONS } = require('../utils/constants');

// Yêu cầu phân quyền Admin cho tất cả các định tuyến dưới đây
router.use(requireAdmin);

// Quản lý nhân viên và tài khoản

// GET /api/admin/users — danh sách toàn bộ tài khoản
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, full_name, role, created_at FROM users ORDER BY created_at DESC'
    );
    return res.json(result.rows);
  } catch (error) {
    logger.error('Lỗi lấy danh sách tài khoản:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách tài khoản!' });
  }
});

// POST /api/admin/users — tạo tài khoản mới
router.post('/users', async (req, res) => {
  const { username, password, fullName, role } = req.body;

  if (!username || !password || !fullName || !role) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ các thông tin bắt buộc!' });
  }

  const cleanUsername = username.toLowerCase().trim();

  try {
    // Kiểm tra trùng lặp
    const checkDup = await db.query('SELECT 1 FROM users WHERE username = $1', [cleanUsername]);
    if (checkDup.rowCount > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại trên hệ thống!' });
    }

    const hashedPw = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const result = await db.query(
      `INSERT INTO users (username, password_hash, full_name, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, username, full_name, role, created_at`,
      [cleanUsername, hashedPw, fullName, role]
    );

    const newUser = result.rows[0];
    await logAudit(req.user.id, ACTIONS.CREATE_USER, req, { target_id: newUser.id, target_username: newUser.username });

    return res.json({
      message: 'Tạo tài khoản nhân viên thành công!',
      user: newUser
    });
  } catch (error) {
    logger.error('Lỗi tạo tài khoản nhân viên:', error);
    return res.status(500).json({ error: 'Không thể tạo tài khoản!' });
  }
});

// PUT /api/admin/users/:id — cập nhật thông tin tài khoản
router.put('/users/:id', async (req, res) => {
  const targetId = req.params.id;
  const { username, password, fullName, role } = req.body;

  if (!username || !fullName || !role) {
    return res.status(400).json({ error: 'Vui lòng cung cấp các thông tin bắt buộc!' });
  }

  const cleanUsername = username.toLowerCase().trim();

  try {
    // Kiểm tra trùng username với người khác
    const checkDup = await db.query('SELECT 1 FROM users WHERE username = $1 AND id <> $2', [cleanUsername, targetId]);
    if (checkDup.rowCount > 0) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại cho tài khoản khác!' });
    }

    const fields = ['username = $1', 'full_name = $2', 'role = $3'];
    const values = [cleanUsername, fullName, role];

    if (password && password.trim() !== '') {
      const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      fields.push(`password_hash = $${fields.length + 1}`);
      values.push(hashedPassword);
    }

    values.push(targetId);

    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING id, username, full_name, role, created_at`,
      values
    );

    const updatedUser = result.rows[0];
    const password_changed = !!(password && password.trim() !== '');

    await logAudit(req.user.id, ACTIONS.UPDATE_USER, req, {
      target_id: updatedUser.id,
      target_username: updatedUser.username,
      password_changed
    });

    return res.json({
      message: password_changed ? 'Cập nhật tài khoản và mật khẩu thành công!' : 'Cập nhật thông tin tài khoản thành công!',
      user: updatedUser
    });
  } catch (error) {
    logger.error('Lỗi cập nhật tài khoản:', error);
    return res.status(500).json({ error: 'Không thể cập nhật tài khoản!' });
  }
});

// DELETE /api/admin/users/:id — xóa tài khoản
router.delete('/users/:id', async (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const currentAdminId = req.user.id;

  if (targetId === currentAdminId) {
    return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản của chính mình!' });
  }

  try {
    const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [targetId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tài khoản không tồn tại!' });
    }
    const deletedUser = result.rows[0];
    await logAudit(req.user.id, ACTIONS.DELETE_USER, req, { target_id: deletedUser.id, target_username: deletedUser.username });

    return res.json({
      message: 'Xóa tài khoản nhân viên thành công!',
      deletedUser: {
        id: deletedUser.id,
        username: deletedUser.username,
        fullName: deletedUser.full_name
      }
    });
  } catch (error) {
    logger.error('Lỗi xóa tài khoản:', error);
    return res.status(500).json({ error: 'Không thể xóa tài khoản này!' });
  }
});

// Quản lý dự án

// GET /api/admin/projects — xem dự án của mọi tài khoản
router.get('/projects', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT p.id, p.name, p.form_data, p.checklist_state, p.created_at, 
             u.username as owner_username, u.full_name as owner_name
      FROM projects p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    logger.error('Lỗi lấy toàn bộ dự án:', error);
    return res.status(500).json({ error: 'Không thể tải toàn bộ danh sách dự án!' });
  }
});

// DELETE /api/admin/projects/:id — xóa dự án
router.delete('/projects/:id', async (req, res) => {
  const projectId = req.params.id;
  try {
    const result = await db.query('DELETE FROM projects WHERE id = $1 RETURNING *', [projectId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Dự án không tồn tại!' });
    }
    const deletedProject = result.rows[0];
    await logAudit(req.user.id, ACTIONS.DELETE_PROJECT_ADMIN, req, { project_id: deletedProject.id, project_name: deletedProject.name });

    return res.json({
      message: 'Xóa dự án thành công!',
      deletedProject
    });
  } catch (error) {
    logger.error('Lỗi xóa dự án bởi admin:', error);
    return res.status(500).json({ error: 'Không thể xóa dự án!' });
  }
});

const AUDIT_ACTION_META = {
  CREATE_LAW: { label: 'Thêm văn bản pháp lý', category: 'legal' },
  UPDATE_LAW: { label: 'Sửa văn bản pháp lý', category: 'legal' },
  DELETE_LAW: { label: 'Xóa văn bản pháp lý', category: 'legal' },
  create: { label: 'Thêm văn bản pháp lý', category: 'legal' },
  update: { label: 'Cập nhật văn bản pháp lý', category: 'legal' },
  expire: { label: 'Hết hiệu lực / Xóa văn bản', category: 'legal' },
  AUTO_CRAWL_CREATE: { label: 'Crawler thêm văn bản mới', category: 'legal' },
  AUTO_CRAWL_UPDATE: { label: 'Crawler cập nhật văn bản', category: 'legal' },
  AUTO_CRAWL_EXPIRE: { label: 'Crawler ghi nhận hết hiệu lực', category: 'legal' },
  auto_crawl_insert: { label: 'Crawler thêm văn bản mới', category: 'legal' },
  auto_crawl_update: { label: 'Crawler cập nhật văn bản', category: 'legal' },
  auto_crawl_expire: { label: 'Crawler ghi nhận hết hiệu lực', category: 'legal' },
  UPDATE_RULE: { label: 'Sửa ngưỡng phân loại', category: 'legal' },
  VERIFY_RULE_CATALOG: { label: 'Xác minh quy tắc / QCVN', category: 'legal' },
  APPROVE_RULE_CANDIDATE: { label: 'Duyệt đề xuất quy tắc', category: 'legal' },
  REJECT_RULE_CANDIDATE: { label: 'Từ chối đề xuất quy tắc', category: 'legal' },
  RESOLVE_LAW_IMPACT: { label: 'Xử lý tác động văn bản', category: 'legal' },
  REVIEW_LAW: { label: 'Kiểm duyệt văn bản pháp luật', category: 'legal' },
  CREATE_MODERATION_PROPOSAL: { label: 'Tạo đề xuất thay đổi quy tắc / QCVN', category: 'legal' },
  REVIEW_THRESHOLD_RULE: { label: 'Kiểm duyệt quy tắc phân loại', category: 'legal' },
  REVIEW_QCVN_CATALOG: { label: 'Kiểm duyệt danh mục QCVN', category: 'legal' },
  kiem_duyet_da_xac_minh: { label: 'Phê duyệt văn bản pháp luật', category: 'legal' },
  kiem_duyet_tu_choi: { label: 'Từ chối văn bản pháp luật', category: 'legal' },
  kiem_duyet_can_bo_sung: { label: 'Yêu cầu bổ sung thông tin văn bản', category: 'legal' },
  kiem_duyet_het_hieu_luc: { label: 'Ngừng áp dụng văn bản pháp luật', category: 'legal' },
  CREATE_PROJECT: { label: 'Tạo hồ sơ dự án', category: 'projects' },
  UPDATE_PROJECT: { label: 'Cập nhật hồ sơ dự án', category: 'projects' },
  DELETE_PROJECT: { label: 'Xóa hồ sơ dự án', category: 'projects' },
  DELETE_PROJECT_ADMIN: { label: 'Admin xóa hồ sơ dự án', category: 'projects' },
  VERIFY_SENSITIVE_CRITERIA: { label: 'Xác minh vùng nhạy cảm', category: 'projects' },
  CREATE_QCVN_SAMPLE: { label: 'Tạo mẫu quan trắc QCVN', category: 'projects' },
  UPDATE_QCVN_SAMPLE: { label: 'Cập nhật mẫu quan trắc QCVN', category: 'projects' },
  DELETE_QCVN_SAMPLE: { label: 'Xóa mẫu quan trắc QCVN', category: 'projects' },
  CREATE_USER: { label: 'Tạo tài khoản nhân sự', category: 'system' },
  UPDATE_USER: { label: 'Cập nhật tài khoản nhân sự', category: 'system' },
  DELETE_USER: { label: 'Xóa tài khoản nhân sự', category: 'system' },
  LOGIN: { label: 'Đăng nhập hệ thống', category: 'system' },
  LOGIN_FAILED: { label: 'Đăng nhập thất bại', category: 'system' },
  LOGOUT: { label: 'Đăng xuất', category: 'system' },
};

function parsePayloadObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function summarizeAuditEntry(action, payload = {}) {
  const target =
    payload.so
    || payload.law_id
    || payload.industry_code
    || payload.project_name
    || (payload.project_id ? `Dự án #${payload.project_id}` : null)
    || payload.target_username
    || payload.username
    || (payload.id ? `#${payload.id}` : null)
    || 'Hệ thống';

  const parts = [];
  if (payload.so) parts.push(`Số hiệu: ${payload.so}`);
  if (payload.changedFields && typeof payload.changedFields === 'object') {
    const diffs = Object.entries(payload.changedFields).map(([field, diff]) => {
      if (diff && typeof diff === 'object' && ('from' in diff || 'to' in diff)) {
        return `${field}: "${diff.from ?? '—'}" → "${diff.to ?? '—'}"`;
      }
      return `${field}: ${String(diff)}`;
    });
    if (diffs.length > 0) parts.push(`Thay đổi: ${diffs.join('; ')}`);
  }
  if (payload.industry_code) parts.push(`Ngành: ${payload.industry_code}`);
  if (payload.min_value !== undefined) parts.push(`Ngưỡng min: ${payload.min_value}`);
  if (payload.max_value !== undefined && payload.max_value !== null) parts.push(`Ngưỡng max: ${payload.max_value}`);
  if (payload.legal_doc_required) parts.push(`Hồ sơ: ${payload.legal_doc_required}`);
  if (payload.tq) parts.push(`Thẩm quyền: ${payload.tq}`);
  if (payload.legalRef || payload.legal_ref) parts.push(`Căn cứ: ${payload.legalRef || payload.legal_ref}`);
  if (payload.verification_status) parts.push(`Trạng thái: ${payload.verification_status}`);
  if (payload.project_name || payload.name) parts.push(`Tên: ${payload.project_name || payload.name}`);
  if (payload.target_username) parts.push(`Tài khoản: ${payload.target_username}`);
  if (payload.impactId) parts.push(`Tác động #${payload.impactId} (${payload.status || ''})`);
  if (payload.candidateId) parts.push(`Đề xuất #${payload.candidateId}`);
  if (payload.decision_label || payload.decision) parts.push(`Quyết định: ${payload.decision_label || payload.decision}`);
  if (payload.reason || payload.reviewNote) parts.push(`Lý do/Ghi chú: ${payload.reason || payload.reviewNote}`);

  return {
    targetLabel: String(target),
    summary: parts.join(' · ') || AUDIT_ACTION_META[action]?.label || action,
  };
}

// GET /api/admin/audit-logs — truy vết thao tác văn bản pháp lý & người dùng (dùng lại audit_logs + law_update_history)
router.get('/audit-logs', async (req, res) => {
  try {
    const scope = String(req.query.scope || 'all').trim().toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const rawLimit = Number(req.query.limit || 100);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 100, 1), 300);

    const [auditRes, lawHistRes] = await Promise.all([
      db.query(
        `SELECT al.id, al.user_id, al.action, al.ip_address, al.payload, al.created_at,
                u.username AS actor_username, u.full_name AS actor_name
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC, al.id DESC
         LIMIT $1`,
        [limit]
      ),
      db.query(
        `SELECT h.id, h.law_id, h.action, h.updated_by, h.updated_at, h.description,
                u.username AS actor_username, u.full_name AS actor_name,
                l.so AS law_so, l.ten AS law_ten
         FROM law_update_history h
         LEFT JOIN users u ON h.updated_by = u.id
         LEFT JOIN laws l ON h.law_id = l.id
         ORDER BY h.updated_at DESC, h.id DESC
         LIMIT $1`,
        [limit]
      ),
    ]);

    const items = [];

    for (const row of (auditRes?.rows || [])) {
      const payload = parsePayloadObject(row.payload);
      const meta = AUDIT_ACTION_META[row.action] || { label: row.action, category: 'system' };
      const { targetLabel, summary } = summarizeAuditEntry(row.action, payload);
      items.push({
        uid: `audit-${row.id}`,
        id: row.id,
        source: 'audit_logs',
        created_at: row.created_at,
        actor_id: row.user_id || null,
        actor_name: row.actor_name || row.actor_username || (payload.username ? payload.username : 'Hệ thống'),
        actor_username: row.actor_username || payload.username || null,
        action: row.action,
        action_label: meta.label,
        category: meta.category,
        target_label: targetLabel,
        summary,
        details: payload,
        ip_address: row.ip_address || null,
      });
    }

    for (const h of (lawHistRes?.rows || [])) {
      const meta = AUDIT_ACTION_META[h.action] || { label: h.action, category: 'legal' };
      const isCrawler = String(h.action || '').startsWith('auto_crawl');
      items.push({
        uid: `lawhist-${h.id}`,
        id: h.id,
        source: 'law_update_history',
        created_at: h.updated_at,
        actor_id: h.updated_by || null,
        actor_name: h.actor_name || h.actor_username || (isCrawler ? 'Hệ thống (Crawler)' : 'Quản trị viên'),
        actor_username: h.actor_username || (isCrawler ? 'crawler' : null),
        action: h.action,
        action_label: meta.label,
        category: 'legal',
        target_label: h.law_so || h.law_id || 'Văn bản pháp lý',
        summary: h.description || meta.label,
        details: {
          law_id: h.law_id,
          law_so: h.law_so || null,
          law_ten: h.law_ten || null,
          description: h.description || null,
        },
        ip_address: null,
      });
    }

    const filtered = items
      .filter(item => (scope === 'all' ? true : item.category === scope))
      .filter(item => {
        if (!search) return true;
        const haystack = [
          item.actor_name,
          item.actor_username,
          item.action,
          item.action_label,
          item.target_label,
          item.summary,
          JSON.stringify(item.details || {}),
        ].join(' ').toLowerCase();
        return haystack.includes(search);
      })
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, limit);

    return res.json({
      logs: filtered,
      total: filtered.length,
    });
  } catch (error) {
    logger.error('Lỗi tải nhật ký truy vết dữ liệu:', error);
    return res.status(500).json({ error: 'Không thể tải nhật ký truy vết dữ liệu!' });
  }
});

module.exports = router;
