// backend/routes/admin-rules.js
// Admin Review Center: Kiểm duyệt rule_candidates từ Crawler, xử lý law_rule_impacts,
// và xác minh/ban hành VERIFIED cho danh mục Ngành nghề, Ngưỡng phân loại & QCVN (gồm bảng chuyển tiếp 2011/2008).

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { ACTIONS } = require('../utils/constants');
const logger = require('../utils/logger');
const {
  listLawRuleImpacts,
  resolveLawRuleImpact,
  listRuleCandidates,
  approveRuleCandidate,
  rejectRuleCandidate,
  getRuleManagementCatalog,
  verifyAndPublishQcvn,
  upsertTransitionalQcvn,
  verifyAndPublishIndustryRules,
} = require('../services/rule-repository');

router.use(requireAdmin);

// GET /api/admin/rules/impacts - Danh sách rule chịu tác động từ văn bản thay đổi/hết hiệu lực
router.get('/impacts', async (req, res) => {
  try {
    const status = req.query.status && req.query.status !== 'ALL' ? req.query.status : null;
    const impacts = await listLawRuleImpacts({ status, limit: req.query.limit, db });
    return res.json({ impacts });
  } catch (error) {
    logger.error('Lỗi tải danh sách law_rule_impacts:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách cảnh báo tác động quy tắc!' });
  }
});

// POST /api/admin/rules/impacts/:id/resolve - Đánh dấu đã rà soát/xử lý tác động văn bản
router.post('/impacts/:id/resolve', async (req, res) => {
  try {
    const { resolutionNote = null, status = 'RESOLVED' } = req.body || {};
    const impact = await resolveLawRuleImpact(db, {
      impactId: req.params.id,
      resolvedBy: req.user.id,
      resolutionNote,
      status,
    });
    await logAudit(req.user.id, ACTIONS.RESOLVE_LAW_IMPACT, req, { impactId: impact.id, status: impact.status });
    return res.json({ message: 'Đã cập nhật trạng thái cảnh báo tác động!', impact });
  } catch (error) {
    if (error.message === 'IMPACT_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy bản ghi cảnh báo!' });
    if (error.message === 'INVALID_IMPACT_ID') return res.status(400).json({ error: 'ID cảnh báo không hợp lệ!' });
    logger.error('Lỗi cập nhật law_rule_impacts:', error);
    return res.status(500).json({ error: 'Không thể cập nhật trạng thái cảnh báo!' });
  }
});

// GET /api/admin/rules/candidates - Danh sách rule_candidates do crawler trích xuất (PENDING_REVIEW)
router.get('/candidates', async (req, res) => {
  try {
    const status = req.query.status && req.query.status !== 'ALL' ? req.query.status : null;
    const candidates = await listRuleCandidates({ status, limit: req.query.limit, db });
    return res.json({ candidates });
  } catch (error) {
    logger.error('Lỗi tải danh sách rule_candidates:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách đề xuất rule!' });
  }
});

// POST /api/admin/rules/candidates/:id/approve - Duyệt candidate đưa vào rule runtime đã công bố
router.post('/candidates/:id/approve', async (req, res) => {
  const { reviewNote = null, sourceDocument = null, proposedData = null } = req.body || {};
  const reviewerName = req.user.username || req.user.fullName || `admin#${req.user.id}`;

  const usePoolTx = db.pool && typeof db.pool.connect === 'function';
  let txClient = null;
  try {
    const runner = usePoolTx ? (txClient = await db.pool.connect()) : db;
    if (txClient) await txClient.query('BEGIN');

    const result = await approveRuleCandidate(runner, {
      candidateId: req.params.id,
      reviewedBy: req.user.id,
      reviewedByName: reviewerName,
      reviewNote,
      sourceDocument,
      overrideProposedData: proposedData,
    });

    if (txClient) await txClient.query('COMMIT');
    await logAudit(req.user.id, ACTIONS.APPROVE_RULE_CANDIDATE, req, {
      candidateId: result.candidate.id,
      targetType: result.candidate.target_type,
      targetCode: result.candidate.target_code,
      sourceDocument,
    });
    return res.json({
      message: 'Đã duyệt đề xuất và cập nhật rule runtime chính thức!',
      ...result,
    });
  } catch (error) {
    if (txClient) {
      try { await txClient.query('ROLLBACK'); } catch {}
    }
    if (error.message === 'CANDIDATE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy đề xuất rule!' });
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc nhập số hiệu văn bản / chứng từ pháp lý (sourceDocument) trước khi duyệt!' });
    }
    if (error.message.startsWith('CANDIDATE_ALREADY_PROCESSED') || error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_') || error.message.startsWith('UNSUPPORTED_')) {
      return res.status(400).json({ error: `Dữ liệu duyệt không hợp lệ: ${error.message}` });
    }
    logger.error('Lỗi duyệt rule candidate:', error);
    return res.status(500).json({ error: 'Không thể duyệt đề xuất rule!' });
  } finally {
    if (txClient && typeof txClient.release === 'function') txClient.release();
  }
});

// POST /api/admin/rules/candidates/:id/reject - Từ chối đề xuất rule từ crawler
router.post('/candidates/:id/reject', async (req, res) => {
  try {
    const { reviewNote = null } = req.body || {};
    const candidate = await rejectRuleCandidate(db, {
      candidateId: req.params.id,
      reviewedBy: req.user.id,
      reviewNote,
    });
    await logAudit(req.user.id, ACTIONS.REJECT_RULE_CANDIDATE, req, { candidateId: candidate.id });
    return res.json({ message: 'Đã từ chối đề xuất rule!', candidate });
  } catch (error) {
    if (error.message === 'CANDIDATE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy đề xuất rule!' });
    logger.error('Lỗi từ chối rule candidate:', error);
    return res.status(500).json({ error: 'Không thể từ chối đề xuất rule!' });
  }
});

// GET /api/admin/rules/catalog - Xem toàn bộ danh mục ngành nghề, ngưỡng & QCVN kèm trạng thái kiểm định
router.get('/catalog', async (req, res) => {
  try {
    const data = await getRuleManagementCatalog({ db });
    return res.json(data);
  } catch (error) {
    logger.error('Lỗi tải catalog kiểm duyệt rule:', error);
    return res.status(500).json({ error: 'Không thể tải danh mục quy tắc kiểm duyệt!' });
  }
});

// PUT /api/admin/rules/qcvns/:id/verify - Admin ký duyệt QCVN lên VERIFIED kèm chứng từ công báo
router.put('/qcvns/:id/verify', async (req, res) => {
  try {
    const body = req.body || {};
    const verifier = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    const qcvn = await verifyAndPublishQcvn(db, {
      ...body,
      id: req.params.id,
      verifiedBy: verifier,
    });
    await logAudit(req.user.id, ACTIONS.VERIFY_RULE_CATALOG, req, {
      targetType: 'QCVN',
      id: qcvn.id,
      sourceDocument: qcvn.source_document,
    });
    return res.json({ message: `Đã ký xác minh VERIFIED cho ${qcvn.id}!`, qcvn });
  } catch (error) {
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED' || error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_PARAM')) {
      return res.status(400).json({ error: `Thiếu hoặc sai dữ liệu xác minh: ${error.message}` });
    }
    logger.error('Lỗi xác minh QCVN:', error);
    return res.status(500).json({ error: 'Không thể xác minh/ban hành QCVN!' });
  }
});

// POST /api/admin/rules/qcvns/transitional/upsert - Admin nhập & ký duyệt bảng chuyển tiếp QCVN 40:2011 / 14:2008 từ tài liệu gốc
router.post('/qcvns/transitional/upsert', async (req, res) => {
  try {
    const body = req.body || {};
    const verifier = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    const qcvn = await upsertTransitionalQcvn(db, {
      ...body,
      verifiedBy: verifier,
    });
    await logAudit(req.user.id, ACTIONS.VERIFY_RULE_CATALOG, req, {
      targetType: 'TRANSITIONAL_QCVN',
      id: qcvn.id,
      sourceDocument: qcvn.source_document,
    });
    return res.json({ message: `Đã lưu và xác minh bảng chuyển tiếp ${qcvn.id}!`, qcvn });
  } catch (error) {
    if (error.message === 'INVALID_TRANSITIONAL_QCVN_ID' || error.message === 'SOURCE_DOCUMENT_REQUIRED' || error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_PARAM')) {
      return res.status(400).json({ error: `Dữ liệu bảng chuyển tiếp không hợp lệ: ${error.message}` });
    }
    logger.error('Lỗi lưu QCVN chuyển tiếp:', error);
    return res.status(500).json({ error: 'Không thể lưu bảng QCVN chuyển tiếp!' });
  }
});

// PUT /api/admin/rules/industries/:code/verify - Admin ký duyệt ngành nghề & ngưỡng phân loại lên VERIFIED
router.put('/industries/:code/verify', async (req, res) => {
  try {
    const body = req.body || {};
    const verifier = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    const industry = await verifyAndPublishIndustryRules(db, {
      ...body,
      code: req.params.code,
      verifiedBy: verifier,
    });
    await logAudit(req.user.id, ACTIONS.VERIFY_RULE_CATALOG, req, {
      targetType: 'INDUSTRY',
      code: industry.code,
      sourceDocument: industry.source_document,
    });
    return res.json({ message: `Đã ký xác minh VERIFIED cho ngành ${industry.code}!`, industry });
  } catch (error) {
    if (error.message === 'INDUSTRY_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy ngành nghề!' });
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc nhập chứng từ pháp lý (sourceDocument) trước khi ký xác minh!' });
    }
    logger.error('Lỗi xác minh ngành nghề:', error);
    return res.status(500).json({ error: 'Không thể ký xác minh ngành nghề!' });
  }
});

module.exports = router;
