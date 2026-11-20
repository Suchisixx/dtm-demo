// backend/routes/admin-rules.js
// Trung tâm kiểm duyệt dữ liệu pháp lý (Văn bản pháp luật, Quy tắc phân loại, Danh mục QCVN).
// Sử dụng mã trạng thái tiếng Việt thống nhất:
//   cho_duyet             : Chờ kiểm duyệt
//   can_xac_minh_phap_ly  : Cần xác minh pháp lý
//   da_xac_minh           : Đã phê duyệt / Đã xác minh
//   tu_choi               : Từ chối
//   can_bo_sung           : Cần bổ sung thông tin
//   het_hieu_luc          : Ngừng áp dụng / Hết hiệu lực

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { ACTIONS } = require('../utils/constants');
const { toVietnameseErrorMessage } = require('../utils/error-messages');
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
  listThresholdRules,
  updateThresholdRule,
  verifyThresholdRule,
  validateQcvnParameters,
  toVietnameseModerationStatus,
  getVietnameseStatusLabel,
  getModerationOverview,
  listLawsForModeration,
  getLawModerationDetail,
  reviewLawRecord,
  getThresholdModerationDetail,
  createModerationProposal,
  reviewThresholdRuleRecord,
  getQcvnModerationDetail,
  reviewQcvnCatalogRecord,
  recordRuleVersionSnapshot,
  saveModerationChecklist,
  listModerationHistory,
} = require('../services/rule-repository');

router.use(requireAdmin);

// GET /api/admin/rules/moderation-overview — Thống kê 3 nhóm KPI (Chờ xử lý, Đã phê duyệt, Đã từ chối) & hàng đợi công việc
router.get('/moderation-overview', async (req, res) => {
  try {
    const overview = await getModerationOverview({ db });
    return res.json(overview);
  } catch (error) {
    logger.error('Lỗi tải tổng quan kiểm duyệt pháp lý:', error);
    return res.status(500).json({ error: 'Không thể tải thống kê tổng quan kiểm duyệt!' });
  }
});

// GET /api/admin/rules/moderation-history — Tab Lịch sử kiểm duyệt (Đã phê duyệt, Đã từ chối, Yêu cầu bổ sung, Phiên bản)
router.get('/moderation-history', async (req, res) => {
  try {
    const data = await listModerationHistory({
      targetType: req.query.targetType || req.query.loai || null,
      status: req.query.status || req.query.trang_thai || null,
      actor: req.query.actor || req.query.nguoi_thuc_hien || null,
      dateFrom: req.query.dateFrom || req.query.tu_ngay || null,
      dateTo: req.query.dateTo || req.query.den_ngay || null,
      search: req.query.search || req.query.tu_khoa || null,
      db,
    });
    return res.json(data);
  } catch (error) {
    logger.error('Lỗi tải lịch sử kiểm duyệt pháp lý:', error);
    return res.status(500).json({ error: 'Không thể tải lịch sử kiểm duyệt!' });
  }
});

// PUT /api/admin/rules/checklist — Lưu trạng thái checklist rà soát thật vào PostgreSQL
router.put('/checklist', async (req, res) => {
  try {
    const { targetType, targetId, checklist } = req.body || {};
    const actorName = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    const saved = await saveModerationChecklist(db, {
      targetType,
      targetId,
      checklist,
      updatedBy: req.user.id,
      updatedByName: actorName,
    });
    return res.json({
      message: 'Đã lưu trạng thái danh mục kiểm tra!',
      ...saved,
    });
  } catch (error) {
    if (error.message === 'RECORD_NOT_FOUND') return res.status(404).json({ error: toVietnameseErrorMessage('RECORD_NOT_FOUND') });
    if (['TARGET_ID_REQUIRED', 'INVALID_TARGET_TYPE', 'INVALID_RULE_ID', 'INVALID_CANDIDATE_ID'].includes(error.message)) {
      return res.status(400).json({ error: toVietnameseErrorMessage(error.message) });
    }
    logger.error('Lỗi lưu checklist kiểm duyệt:', error);
    return res.status(500).json({ error: 'Không thể lưu trạng thái danh mục kiểm tra!' });
  }
});

// ============================================================================
// NHÓM 3.1: KIỂM DUYỆT VĂN BẢN PHÁP LUẬT (luat / laws)
// ============================================================================

// GET /api/admin/rules/laws — danh sách văn bản pháp luật phục vụ kiểm duyệt
router.get('/laws', async (req, res) => {
  try {
    const laws = await listLawsForModeration({
      verificationStatus: req.query.verificationStatus || req.query.trang_thai || null,
      detectionSource: req.query.detectionSource || req.query.nguon || null,
      type: req.query.type || req.query.loai || null,
      dateFrom: req.query.dateFrom || req.query.tu_ngay || null,
      dateTo: req.query.dateTo || req.query.den_ngay || null,
      search: req.query.search || req.query.tu_khoa || null,
      db,
    });
    return res.json({ laws });
  } catch (error) {
    logger.error('Lỗi tải danh sách văn bản kiểm duyệt:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách văn bản pháp luật!' });
  }
});

// GET /api/admin/rules/laws/:id — chi tiết văn bản pháp luật kèm lịch sử kiểm duyệt & quy tắc liên quan
router.get('/laws/:id', async (req, res) => {
  try {
    const detail = await getLawModerationDetail(req.params.id, { db });
    return res.json(detail);
  } catch (error) {
    if (error.message === 'LAW_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy văn bản pháp luật!' });
    if (error.message === 'LAW_ID_REQUIRED') return res.status(400).json({ error: 'Mã văn bản không hợp lệ!' });
    logger.error('Lỗi tải chi tiết văn bản kiểm duyệt:', error);
    return res.status(500).json({ error: 'Không thể tải thông tin chi tiết văn bản!' });
  }
});

// POST /api/admin/rules/laws/:id/review — phê duyệt, từ chối, yêu cầu bổ sung thông tin, hoặc cập nhật metadata văn bản
router.post('/laws/:id/review', async (req, res) => {
  const { decision, reviewNote = null, reason = null, metadataPatch = null } = req.body || {};
  const reviewerName = req.user.username || req.user.fullName || `admin#${req.user.id}`;
  const noteText = reviewNote || reason || null;

  const usePoolTx = db.pool && typeof db.pool.connect === 'function';
  let txClient = null;
  try {
    const runner = usePoolTx ? (txClient = await db.pool.connect()) : db;
    if (txClient) await txClient.query('BEGIN');

    const result = await reviewLawRecord(runner, {
      lawId: req.params.id,
      decision,
      reviewNote: noteText,
      reviewedByUserId: req.user.id,
      reviewedByName: reviewerName,
      metadataPatch,
    });

    if (txClient) await txClient.query('COMMIT');

    await logAudit(req.user.id, ACTIONS.REVIEW_LAW, req, {
      law_id: result.after.id,
      so: result.after.so,
      decision: result.after.verification_status,
      decision_label: result.after.verification_status_label,
      reason: noteText,
      before: {
        verification_status: result.before.verification_status,
        status: result.before.status,
        so: result.before.so,
        ten: result.before.ten,
      },
      after: {
        verification_status: result.after.verification_status,
        status: result.after.status,
        so: result.after.so,
        ten: result.after.ten,
      },
    });

    return res.json({
      message: `Đã cập nhật kiểm duyệt văn bản "${result.after.so}" sang trạng thái "${result.after.verification_status_label}"! (Lưu ý: Các quy tắc phân loại vẫn giữ nguyên cho đến khi được kiểm duyệt riêng).`,
      law: result.after,
      before: result.before,
    });
  } catch (error) {
    if (txClient) {
      try { await txClient.query('ROLLBACK'); } catch {}
    }
    if (error.message === 'LAW_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy văn bản pháp luật!' });
    if (error.message === 'INVALID_REVIEW_DECISION') {
      return res.status(400).json({ error: 'Quyết định kiểm duyệt không hợp lệ (chỉ chấp nhận: da_xac_minh, tu_choi, can_bo_sung, het_hieu_luc, cho_duyet)!' });
    }
    if (error.message === 'REVIEW_REASON_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin!' });
    }
    logger.error('Lỗi kiểm duyệt văn bản pháp luật:', error);
    return res.status(500).json({ error: 'Không thể lưu kết quả kiểm duyệt văn bản!' });
  } finally {
    if (txClient && typeof txClient.release === 'function') txClient.release();
  }
});

// ============================================================================
// NHÓM 3.2: KIỂM DUYỆT QUY TẮC PHÂN LOẠI & ĐỀ XUẤT THAY ĐỔI
// ============================================================================

// GET /api/admin/rules/impacts — danh sách quy tắc bị ảnh hưởng bởi văn bản thay đổi/hết hiệu lực
router.get('/impacts', async (req, res) => {
  try {
    const status = req.query.status && req.query.status !== 'ALL' && req.query.status !== 'tat_ca' ? req.query.status : null;
    const impacts = await listLawRuleImpacts({ status, limit: req.query.limit, db });
    return res.json({ impacts });
  } catch (error) {
    logger.error('Lỗi tải danh sách law_rule_impacts:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách cảnh báo tác động quy tắc!' });
  }
});

// POST /api/admin/rules/impacts/:id/resolve — đánh dấu tác động văn bản đã được xử lý
router.post('/impacts/:id/resolve', async (req, res) => {
  try {
    const { resolutionNote = null, status = 'da_xu_ly' } = req.body || {};
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

// GET /api/admin/rules/candidates — danh sách đề xuất thay đổi quy tắc / QCVN
router.get('/candidates', async (req, res) => {
  try {
    const status = req.query.status && req.query.status !== 'ALL' && req.query.status !== 'tat_ca' ? req.query.status : null;
    const candidates = await listRuleCandidates({ status, limit: req.query.limit, db });
    const normalized = candidates.map(c => ({
      ...c,
      status_vi: toVietnameseModerationStatus(c.status, 'cho_duyet'),
      status_label: getVietnameseStatusLabel(c.status),
    }));
    return res.json({ candidates: normalized });
  } catch (error) {
    logger.error('Lỗi tải danh sách rule_candidates:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách đề xuất quy tắc!' });
  }
});

// POST /api/admin/rules/proposals — tạo đề xuất thay đổi quy tắc phân loại hoặc QCVN (giữ nguyên quy tắc đang hiệu lực)
router.post('/proposals', async (req, res) => {
  try {
    const body = req.body || {};
    const reviewerName = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    const proposal = await createModerationProposal(db, {
      targetType: body.targetType || 'nguong_phan_loai',
      targetId: body.targetId || null,
      targetCode: body.targetCode || null,
      lawId: body.lawId || null,
      lawTitle: body.lawTitle || null,
      title: body.title || '',
      proposedData: body.proposedData || {},
      sourceExcerpt: body.sourceExcerpt || body.legalRef || '',
      reason: body.reason || '',
      createdByUserId: req.user.id,
      createdByName: reviewerName,
    });

    await logAudit(req.user.id, ACTIONS.CREATE_MODERATION_PROPOSAL, req, {
      candidateId: proposal.id,
      targetType: proposal.target_type,
      targetCode: proposal.target_code,
      reason: body.reason || null,
      before: proposal.diff_summary?.truoc_thay_doi || null,
      after: proposal.proposed_data || null,
    });

    return res.status(201).json({
      message: `Đã tạo đề xuất thay đổi #${proposal.id} (trạng thái: Chờ kiểm duyệt — quy tắc đang áp dụng vẫn được giữ nguyên)!`,
      proposal,
    });
  } catch (error) {
    if (error.message === 'RULE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy quy tắc gốc để tạo đề xuất!' });
    if (error.message === 'TARGET_CODE_REQUIRED') return res.status(400).json({ error: 'Thiếu mã đối tượng quy tắc hoặc QCVN!' });
    logger.error('Lỗi tạo đề xuất thay đổi quy tắc:', error);
    return res.status(500).json({ error: 'Không thể tạo đề xuất thay đổi quy tắc!' });
  }
});

// POST /api/admin/rules/candidates/:id/approve — duyệt đề xuất để đưa vào quy tắc runtime đã công bố
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
      decision: 'da_xac_minh',
      decision_label: 'Đã phê duyệt đề xuất',
      reason: reviewNote,
      after: result.appliedRecord,
    });
    return res.json({
      message: 'Đã phê duyệt đề xuất và cập nhật quy tắc chính thức!',
      ...result,
    });
  } catch (error) {
    if (txClient) {
      try { await txClient.query('ROLLBACK'); } catch {}
    }
    if (error.message === 'CANDIDATE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy đề xuất quy tắc!' });
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc nhập số hiệu văn bản / căn cứ pháp lý trước khi phê duyệt!' });
    }
    if (error.message.startsWith('CANDIDATE_ALREADY_PROCESSED') || error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_') || error.message.startsWith('UNSUPPORTED_')) {
      return res.status(400).json({ error: toVietnameseErrorMessage(error.message) });
    }
    logger.error('Lỗi duyệt đề xuất quy tắc:', error);
    return res.status(500).json({ error: 'Không thể duyệt đề xuất quy tắc!' });
  } finally {
    if (txClient && typeof txClient.release === 'function') txClient.release();
  }
});

// POST /api/admin/rules/candidates/:id/reject — từ chối hoặc yêu cầu bổ sung thông tin cho đề xuất quy tắc
router.post('/candidates/:id/reject', async (req, res) => {
  try {
    const { reviewNote = null, reason = null, status = 'tu_choi', requireReason = false } = req.body || {};
    const noteText = String(reviewNote || reason || '').trim();
    if (requireReason && !noteText) {
      return res.status(400).json({ error: 'Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin!' });
    }
    const candidate = await rejectRuleCandidate(db, {
      candidateId: req.params.id,
      reviewedBy: req.user.id,
      reviewNote: noteText || null,
      status,
    });
    await logAudit(req.user.id, ACTIONS.REJECT_RULE_CANDIDATE, req, {
      candidateId: candidate.id,
      decision: candidate.status_vi || 'tu_choi',
      reason: noteText || null,
    });
    const isMoreInfo = status === 'can_bo_sung';
    return res.json({
      message: isMoreInfo ? 'Đã chuyển đề xuất sang trạng thái Cần bổ sung thông tin!' : 'Đã từ chối đề xuất quy tắc!',
      candidate,
    });
  } catch (error) {
    if (error.message === 'CANDIDATE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy đề xuất quy tắc!' });
    logger.error('Lỗi từ chối đề xuất quy tắc:', error);
    return res.status(500).json({ error: 'Không thể từ chối đề xuất quy tắc!' });
  }
});

// GET /api/admin/rules/catalog — xem danh mục ngành nghề, ngưỡng, QCVN và trạng thái kiểm định
router.get('/catalog', async (req, res) => {
  try {
    const data = await getRuleManagementCatalog({ db });
    const industries = (data.industries || []).map(ind => ({
      ...ind,
      verification_status_vi: toVietnameseModerationStatus(ind.verification_status, 'can_xac_minh_phap_ly'),
      verification_status_label: getVietnameseStatusLabel(ind.verification_status),
    }));
    const qcvns = (data.qcvns || []).map(q => ({
      ...q,
      verification_status_vi: toVietnameseModerationStatus(q.verification_status, 'can_xac_minh_phap_ly'),
      verification_status_label: getVietnameseStatusLabel(q.verification_status),
      parameter_count: Array.isArray(q.tham_so) ? q.tham_so.filter(p => p && (p.ten || p.key || p.chi_tieu)).length : 0,
    }));
    return res.json({
      ...data,
      industries,
      qcvns,
    });
  } catch (error) {
    logger.error('Lỗi tải catalog kiểm duyệt quy tắc:', error);
    return res.status(500).json({ error: 'Không thể tải danh mục quy tắc kiểm duyệt!' });
  }
});

// GET /api/admin/rules/thresholds — danh sách ngưỡng phân loại, có lọc theo trạng thái
router.get('/thresholds', async (req, res) => {
  try {
    const status = req.query.status || null;
    const allThresholds = await listThresholdRules({ status: null, db });
    let thresholds = allThresholds.map(r => ({
      ...r,
      verification_status_vi: toVietnameseModerationStatus(r.verification_status, 'can_xac_minh_phap_ly'),
      verification_status_label: getVietnameseStatusLabel(r.verification_status),
    }));
    if (status && status !== 'ALL' && status !== 'tat_ca') {
      const targetVi = toVietnameseModerationStatus(status);
      thresholds = thresholds.filter(r => r.verification_status_vi === targetVi);
    }
    return res.json({ thresholds });
  } catch (error) {
    logger.error('Lỗi lấy danh sách ngưỡng phân loại:', error);
    return res.status(500).json({ error: 'Không thể tải danh sách ngưỡng phân loại!' });
  }
});

// GET /api/admin/rules/thresholds/:id — chi tiết quy tắc phân loại kèm lịch sử phiên bản & đề xuất thay đổi
router.get('/thresholds/:id', async (req, res) => {
  try {
    const detail = await getThresholdModerationDetail(req.params.id, { db });
    return res.json(detail);
  } catch (error) {
    if (error.message === 'RULE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy quy tắc ngưỡng!' });
    if (error.message === 'INVALID_RULE_ID') return res.status(400).json({ error: 'Mã quy tắc không hợp lệ!' });
    logger.error('Lỗi tải chi tiết quy tắc ngưỡng:', error);
    return res.status(500).json({ error: 'Không thể tải chi tiết quy tắc ngưỡng!' });
  }
});

// PUT /api/admin/rules/thresholds/:id — sửa ngưỡng và tự hạ cấp trạng thái xác minh pháp lý + lưu lịch sử phiên bản
router.put('/thresholds/:id', async (req, res) => {
  try {
    const patch = req.body || {};
    const asDraft = Boolean(req.body?.asDraft);
    const beforeDetail = await getThresholdModerationDetail(req.params.id, { db }).catch(() => null);
    const rule = await updateThresholdRule(req.params.id, patch, {
      asDraft,
      user: req.user,
      db,
    });
    const reviewerName = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    await recordRuleVersionSnapshot(db, {
      ruleId: rule.id,
      version: rule.rule_version || '2026.2-chinh-sua',
      targetType: 'nguong_phan_loai',
      targetCode: `${rule.industry_code}#${rule.id}`,
      beforeData: beforeDetail?.rule || null,
      afterData: rule,
      changedBy: req.user.id,
      changedByName: reviewerName,
      legalBasis: rule.legal_ref,
      effectiveFrom: formatDateOnlySafe(rule.effective_from),
      effectiveTo: formatDateOnlySafe(rule.effective_to),
      changeReason: patch.changeReason || (asDraft ? 'Lưu bản nháp quy tắc' : 'Chỉnh sửa quy tắc phân loại (chuyển sang cần xác minh pháp lý)'),
    });

    await logAudit(req.user.id, ACTIONS.UPDATE_RULE || 'UPDATE_RULE', req, {
      id: rule.id,
      industry_code: rule.industry_code,
      min_value: rule.min_value,
      max_value: rule.max_value,
      legal_doc_required: rule.legal_doc_required,
      tq: rule.tq,
      legal_ref: rule.legal_ref,
      verification_status: toVietnameseModerationStatus(rule.verification_status),
      asDraft,
      before: beforeDetail?.rule || null,
      after: rule,
    });
    return res.json({
      message: toVietnameseModerationStatus(rule.verification_status) === 'da_xac_minh'
        ? 'Đã cập nhật quy tắc!'
        : 'Đã lưu chỉnh sửa quy tắc và ghi nhận lịch sử phiên bản (trạng thái: Cần xác minh pháp lý)!',
      rule: {
        ...rule,
        verification_status_vi: toVietnameseModerationStatus(rule.verification_status),
        verification_status_label: getVietnameseStatusLabel(rule.verification_status),
      },
    });
  } catch (error) {
    if (error.message === 'RULE_NOT_FOUND') {
      return res.status(404).json({ error: 'Không tìm thấy quy tắc ngưỡng!' });
    }
    logger.error('Lỗi cập nhật ngưỡng phân loại:', error);
    return res.status(500).json({ error: 'Không thể cập nhật quy tắc ngưỡng!' });
  }
});

// POST /api/admin/rules/thresholds/:id/verify — xác minh ngưỡng (tương thích ngược)
router.post('/thresholds/:id/verify', async (req, res) => {
  try {
    const { legalRef, effectiveFrom } = req.body || {};
    const verifier = req.user.username || req.user.fullName || `admin#${req.user.id}`;
    const rule = await verifyThresholdRule(req.params.id, {
      verifiedBy: verifier,
      legalRef,
      effectiveFrom,
      db,
    });
    await logAudit(req.user.id, ACTIONS.VERIFY_RULE_CATALOG, req, {
      targetType: 'THRESHOLD',
      id: rule.id,
      industry_code: rule.industry_code,
      legalRef: rule.legal_ref,
      effectiveFrom: rule.effective_from,
      decision: 'da_xac_minh',
    });
    return res.json({
      message: `Đã xác minh và phê duyệt quy tắc #${rule.id} (Đã phê duyệt)!`,
      rule: {
        ...rule,
        verification_status_vi: 'da_xac_minh',
        verification_status_label: 'Đã phê duyệt',
      },
    });
  } catch (error) {
    if (error.message === 'RULE_NOT_FOUND') {
      return res.status(404).json({ error: 'Không tìm thấy quy tắc ngưỡng!' });
    }
    if (error.message === 'LEGAL_REF_AND_EFFECTIVE_DATE_REQUIRED') {
      return res.status(400).json({
        error: 'Bắt buộc nhập căn cứ pháp lý (legalRef) và ngày bắt đầu hiệu lực (effectiveFrom) để phê duyệt!',
      });
    }
    logger.error('Lỗi xác minh ngưỡng phân loại:', error);
    return res.status(500).json({ error: 'Không thể xác minh/phê duyệt quy tắc ngưỡng!' });
  }
});

// POST /api/admin/rules/thresholds/:id/review — kiểm duyệt quy tắc phân loại (da_xac_minh / tu_choi / can_bo_sung / can_xac_minh_phap_ly)
router.post('/thresholds/:id/review', async (req, res) => {
  const { decision, legalRef = null, sourceRef = null, effectiveFrom = null, effectiveTo = null, reviewNote = null, reason = null, patch = null } = req.body || {};
  const reviewerName = req.user.username || req.user.fullName || `admin#${req.user.id}`;
  const noteText = reviewNote || reason || null;

  const usePoolTx = db.pool && typeof db.pool.connect === 'function';
  let txClient = null;
  try {
    const runner = usePoolTx ? (txClient = await db.pool.connect()) : db;
    if (txClient) await txClient.query('BEGIN');

    const result = await reviewThresholdRuleRecord(runner, {
      id: req.params.id,
      decision,
      legalRef,
      sourceRef,
      effectiveFrom,
      effectiveTo,
      reviewNote: noteText,
      patch,
      reviewedByUserId: req.user.id,
      reviewedByName: reviewerName,
    });

    if (txClient) await txClient.query('COMMIT');

    await logAudit(req.user.id, ACTIONS.REVIEW_THRESHOLD_RULE, req, {
      id: result.after.id,
      industry_code: result.after.industry_code,
      decision: result.after.verification_status,
      decision_label: result.after.verification_status_label,
      legalRef: result.after.legal_ref,
      effectiveFrom: result.after.effective_from,
      reason: noteText,
      before: result.before,
      after: result.after,
    });

    return res.json({
      message: `Đã cập nhật kiểm duyệt quy tắc #${result.after.id} sang trạng thái "${result.after.verification_status_label}"!`,
      rule: result.after,
      before: result.before,
    });
  } catch (error) {
    if (txClient) {
      try { await txClient.query('ROLLBACK'); } catch {}
    }
    if (error.message === 'RULE_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy quy tắc ngưỡng!' });
    if (error.message === 'INVALID_RULE_ID') return res.status(400).json({ error: 'Mã quy tắc không hợp lệ!' });
    if (error.message === 'INVALID_REVIEW_DECISION') {
      return res.status(400).json({ error: 'Quyết định kiểm duyệt không hợp lệ!' });
    }
    if (error.message === 'REVIEW_REASON_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin!' });
    }
    if (error.message === 'LEGAL_REF_AND_EFFECTIVE_DATE_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc nhập đầy đủ Căn cứ pháp lý và Ngày bắt đầu hiệu lực trước khi phê duyệt quy tắc!' });
    }
    logger.error('Lỗi kiểm duyệt quy tắc ngưỡng:', error);
    return res.status(500).json({ error: 'Không thể lưu kết quả kiểm duyệt quy tắc!' });
  } finally {
    if (txClient && typeof txClient.release === 'function') txClient.release();
  }
});

// PUT /api/admin/rules/industries/:code/verify — xác minh ngành nghề và ngưỡng phân loại
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
      decision: 'da_xac_minh',
    });
    return res.json({ message: `Đã ký xác minh Đã phê duyệt cho ngành ${industry.code}!`, industry });
  } catch (error) {
    if (error.message === 'INDUSTRY_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy ngành nghề!' });
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc nhập chứng từ pháp lý (sourceDocument) trước khi ký xác minh!' });
    }
    logger.error('Lỗi xác minh ngành nghề:', error);
    return res.status(500).json({ error: 'Không thể ký xác minh ngành nghề!' });
  }
});

// ============================================================================
// NHÓM 3.3: KIỂM DUYỆT DANH MỤC QCVN & BẢNG THÔNG SỐ MÔI TRƯỜNG
// ============================================================================

// GET /api/admin/rules/qcvns/:id — chi tiết một QCVN kèm toàn bộ mảng thông số môi trường (tham_so) và lịch sử phiên bản
router.get('/qcvns/:id', async (req, res) => {
  try {
    const detail = await getQcvnModerationDetail(req.params.id, { db });
    return res.json(detail);
  } catch (error) {
    if (error.message === 'QCVN_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy quy chuẩn QCVN!' });
    if (error.message === 'QCVN_ID_REQUIRED') return res.status(400).json({ error: 'Mã QCVN không hợp lệ!' });
    logger.error('Lỗi tải chi tiết QCVN:', error);
    return res.status(500).json({ error: 'Không thể tải thông tin chi tiết QCVN!' });
  }
});

// POST /api/admin/rules/qcvns/:id/review — kiểm duyệt hoặc chỉnh sửa thông số QCVN (da_xac_minh / tu_choi / can_bo_sung / can_xac_minh_phap_ly)
router.post('/qcvns/:id/review', async (req, res) => {
  const { decision, sourceDocument = null, effectiveFrom = null, effectiveTo = null, reviewNote = null, reason = null, patch = null } = req.body || {};
  const reviewerName = req.user.username || req.user.fullName || `admin#${req.user.id}`;
  const noteText = reviewNote || reason || null;

  const usePoolTx = db.pool && typeof db.pool.connect === 'function';
  let txClient = null;
  try {
    const runner = usePoolTx ? (txClient = await db.pool.connect()) : db;
    if (txClient) await txClient.query('BEGIN');

    const result = await reviewQcvnCatalogRecord(runner, {
      id: req.params.id,
      decision,
      sourceDocument,
      effectiveFrom,
      effectiveTo,
      reviewNote: noteText,
      patch,
      validateQcvnParametersFn: validateQcvnParameters,
      reviewedByUserId: req.user.id,
      reviewedByName: reviewerName,
    });

    if (txClient) await txClient.query('COMMIT');

    await logAudit(req.user.id, ACTIONS.REVIEW_QCVN_CATALOG, req, {
      id: result.after.id,
      ten: result.after.ten,
      decision: result.after.verification_status,
      decision_label: result.after.verification_status_label,
      sourceDocument: result.after.source_document,
      reason: noteText,
      before: {
        verification_status: result.before.verification_status,
        source_document: result.before.source_document,
        effective_from: result.before.effective_from,
      },
      after: {
        verification_status: result.after.verification_status,
        source_document: result.after.source_document,
        effective_from: result.after.effective_from,
      },
    });

    return res.json({
      message: `Đã cập nhật kiểm duyệt quy chuẩn ${result.after.id} sang trạng thái "${result.after.verification_status_label}"!`,
      qcvn: result.after,
      before: result.before,
    });
  } catch (error) {
    if (txClient) {
      try { await txClient.query('ROLLBACK'); } catch {}
    }
    if (error.message === 'QCVN_NOT_FOUND') return res.status(404).json({ error: 'Không tìm thấy quy chuẩn QCVN!' });
    if (error.message === 'INVALID_REVIEW_DECISION') {
      return res.status(400).json({ error: 'Quyết định kiểm duyệt QCVN không hợp lệ!' });
    }
    if (error.message === 'REVIEW_REASON_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin cho QCVN!' });
    }
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED') {
      return res.status(400).json({ error: 'Bắt buộc nhập căn cứ pháp lý ban hành (sourceDocument) trước khi phê duyệt QCVN!' });
    }
    if (error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_PARAM')) {
      return res.status(400).json({ error: toVietnameseErrorMessage(error.message) });
    }
    logger.error('Lỗi kiểm duyệt QCVN:', error);
    return res.status(500).json({ error: 'Không thể lưu kết quả kiểm duyệt QCVN!' });
  } finally {
    if (txClient && typeof txClient.release === 'function') txClient.release();
  }
});

// PUT /api/admin/rules/qcvns/:id/verify — quản trị viên xác minh QCVN kèm chứng từ công báo (tương thích ngược)
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
      decision: 'da_xac_minh',
    });
    return res.json({ message: `Đã ký xác minh Đã phê duyệt cho ${qcvn.id}!`, qcvn });
  } catch (error) {
    if (error.message === 'SOURCE_DOCUMENT_REQUIRED' || error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_PARAM')) {
      return res.status(400).json({ error: toVietnameseErrorMessage(error.message) });
    }
    logger.error('Lỗi xác minh QCVN:', error);
    return res.status(500).json({ error: 'Không thể xác minh/ban hành QCVN!' });
  }
});

// POST /api/admin/rules/qcvns/transitional/upsert — nhập và xác minh bảng QCVN chuyển tiếp từ tài liệu gốc
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
      decision: 'da_xac_minh',
    });
    return res.json({ message: `Đã lưu và xác minh bảng chuyển tiếp ${qcvn.id}!`, qcvn });
  } catch (error) {
    if (error.message === 'INVALID_TRANSITIONAL_QCVN_ID' || error.message === 'SOURCE_DOCUMENT_REQUIRED' || error.message.startsWith('QCVN_PARAMETER') || error.message.startsWith('INVALID_PARAM')) {
      return res.status(400).json({ error: toVietnameseErrorMessage(error.message) });
    }
    logger.error('Lỗi lưu QCVN chuyển tiếp:', error);
    return res.status(500).json({ error: 'Không thể lưu bảng QCVN chuyển tiếp!' });
  }
});

function formatDateOnlySafe(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}

module.exports = router;
