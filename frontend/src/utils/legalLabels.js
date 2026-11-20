// frontend/src/utils/legalLabels.js
// Ánh xạ toàn bộ mã trạng thái kỹ thuật / pháp lý nội bộ sang tiếng Việt dễ hiểu cho người dùng cuối.

export const RULE_SOURCE_LABELS = {
  DATABASE: 'Dữ liệu quy chuẩn hệ thống',
  FALLBACK_UNVERIFIED: 'Dữ liệu dự phòng chưa xác minh',
  STATIC_FIXTURE: 'Dữ liệu mẫu mặc định',
  LOADING: 'Đang tải danh mục...',
  UNKNOWN: 'Chưa rõ nguồn dữ liệu',
};

export const GIS_SOURCE_LABELS = {
  DATABASE: 'Dữ liệu bản đồ trong hệ thống',
  FALLBACK_UNVERIFIED: 'Dữ liệu bản đồ dự phòng',
  STATIC_FIXTURE: 'Dữ liệu bản đồ nền mặc định',
};

export const CONCLUSION_STATUS_LABELS = {
  VERIFIED: {
    title: 'Đủ điều kiện kết luận chính thức',
    short: 'Đã xác minh chính thức',
    tone: 'success',
  },
  NEEDS_LEGAL_VERIFICATION: {
    title: 'Kết quả tham khảo sơ bộ — Chờ xác minh quy định ngành',
    short: 'Chờ xác minh quy định',
    tone: 'warn',
  },
  NEEDS_REVIEW: {
    title: 'Cần rà soát thêm — Chưa thể kết luận tự động',
    short: 'Cần rà soát',
    tone: 'warn',
  },
};

export const SENSITIVE_STATUS_LABELS = {
  NOT_REQUIRED: 'Không yêu cầu xác minh',
  NONE: 'Không yêu cầu xác minh',
  PENDING_VERIFICATION: 'Chờ quản trị viên xác minh',
  PENDING_SERVER_VERIFICATION: 'Chờ quản trị viên xác minh',
  UNVERIFIED: 'Chờ quản trị viên xác minh',
  VERIFIED: 'Đã xác minh hợp lệ',
  REJECTED: 'Không công nhận / Từ chối',
};

export const PROCEDURE_LABELS = {
  DTM: 'ĐTM (Đánh giá tác động môi trường)',
  GPMT: 'GPMT (Giấy phép môi trường)',
  DKMT: 'ĐKMT (Đăng ký môi trường)',
  EXEMPT_DKMT: 'Miễn đăng ký môi trường',
};

export const QCVN_OVERALL_STATUS_LABELS = {
  PASS: { label: 'Đạt quy chuẩn', tone: 'success' },
  dat: { label: 'Đạt quy chuẩn', tone: 'success' },
  PASS_WITH_WARNING: { label: 'Đạt quy chuẩn (gần chạm ngưỡng)', tone: 'warn' },
  WARNING: { label: 'Cảnh báo (gần chạm ngưỡng)', tone: 'warn' },
  canh_bao: { label: 'Cảnh báo (gần chạm ngưỡng)', tone: 'warn' },
  FAIL: { label: 'Vượt ngưỡng quy chuẩn', tone: 'danger' },
  vuot_nguong: { label: 'Vượt ngưỡng quy chuẩn', tone: 'danger' },
  INCOMPLETE: { label: 'Chưa đủ thông số bắt buộc', tone: 'warn' },
  chua_du_thong_so: { label: 'Chưa đủ thông số bắt buộc', tone: 'warn' },
  PERIOD_MISMATCH: { label: 'Sai chu kỳ trung bình lấy mẫu', tone: 'warn' },
  period_mismatch: { label: 'Sai chu kỳ trung bình lấy mẫu', tone: 'warn' },
  NEEDS_REVIEW: { label: 'Cần rà soát thêm', tone: 'warn' },
  can_ra_soat: { label: 'Cần rà soát thêm', tone: 'warn' },
};

export const QCVN_LIFECYCLE_LABELS = {
  current: 'Đang hiệu lực',
  transitional: 'Giai đoạn chuyển tiếp',
  historical: 'Hết hiệu lực (lịch sử)',
  expired: 'Hết hiệu lực',
};

export const QCVN_VERIFICATION_LABELS = {
  VERIFIED: 'Đã phê duyệt',
  da_xac_minh: 'Đã phê duyệt',
  NEEDS_LEGAL_VERIFICATION: 'Cần xác minh pháp lý',
  can_xac_minh_phap_ly: 'Cần xác minh pháp lý',
  DRAFT: 'Bản nháp',
  ban_nhap: 'Bản nháp',
  PENDING_REVIEW: 'Chờ kiểm duyệt',
  cho_duyet: 'Chờ kiểm duyệt',
  NEED_MORE_INFO: 'Cần bổ sung thông tin',
  can_bo_sung: 'Cần bổ sung thông tin',
  REJECTED: 'Từ chối',
  tu_choi: 'Từ chối',
  EXPIRED: 'Ngừng áp dụng / Hết hiệu lực',
  het_hieu_luc: 'Ngừng áp dụng / Hết hiệu lực',
};

export const QCVN_REASON_LABELS = {
  QCVN_SELECTION_MISMATCH: 'Quy chuẩn bạn chọn chưa khớp với đề xuất từ máy chủ.',
  MISSING_FLOW_RATE: 'Vui lòng nhập lưu lượng xả thải F (m³/ngày) để chọn đúng bảng giới hạn.',
  MISSING_RECEIVING_SOURCE: 'Vui lòng chọn cột / phân vùng nguồn tiếp nhận nước thải.',
  TRANSITION_TABLE_NOT_AVAILABLE: 'Chưa có bảng QCVN chuyển tiếp (2008/2011) được duyệt cho cơ sở hiện hữu.',
  INCOMPLETE: 'Còn thiếu chỉ tiêu bắt buộc nên chưa thể kết luận Đạt.',
  PERIOD_MISMATCH: 'Có chỉ tiêu lệch chu kỳ trung bình lấy mẫu nên cần rà soát lại.',
  NEEDS_REVIEW: 'Cần bổ sung thông tin hoặc rà soát lại trước khi kết luận.',
  SERVER_UNREACHABLE: 'Không kết nối được máy chủ đối chiếu quy chuẩn.',
};

export function getRuleSourceLabel(code) {
  return RULE_SOURCE_LABELS[code] || RULE_SOURCE_LABELS.UNKNOWN;
}

export function getGisSourceLabel(code) {
  return GIS_SOURCE_LABELS[code] || GIS_SOURCE_LABELS.STATIC_FIXTURE;
}

export function getConclusionStatusMeta(code) {
  return CONCLUSION_STATUS_LABELS[code] || CONCLUSION_STATUS_LABELS.NEEDS_REVIEW;
}

export function getSensitiveStatusLabel(code) {
  if (!code) return SENSITIVE_STATUS_LABELS.NOT_REQUIRED;
  return SENSITIVE_STATUS_LABELS[code] || SENSITIVE_STATUS_LABELS.PENDING_VERIFICATION;
}

export function getProcedureLabel(code) {
  if (!code) return 'Chưa xác định';
  return PROCEDURE_LABELS[code] || code;
}

export function getQcvnOverallStatusMeta(code) {
  if (!code) return QCVN_OVERALL_STATUS_LABELS.NEEDS_REVIEW;
  return QCVN_OVERALL_STATUS_LABELS[code] || { label: 'Cần rà soát thêm', tone: 'warn' };
}

export function getQcvnCatalogChipText({ ruleSource, lifecycleStatus, verificationStatus, ruleVersion } = {}) {
  const parts = [];
  parts.push(ruleSource === 'DATABASE' ? 'Quy chuẩn hệ thống' : 'Quy chuẩn dự phòng');
  if (lifecycleStatus && QCVN_LIFECYCLE_LABELS[lifecycleStatus]) {
    parts.push(QCVN_LIFECYCLE_LABELS[lifecycleStatus]);
  }
  if (verificationStatus && QCVN_VERIFICATION_LABELS[verificationStatus]) {
    parts.push(QCVN_VERIFICATION_LABELS[verificationStatus]);
  }
  if (ruleVersion) {
    parts.push(`Phiên bản ${ruleVersion}`);
  }
  return parts.join(' · ');
}

export const ADMIN_SEVERITY_LABELS = {
  HIGH: { label: 'Mức độ cao', color: '#B91C1C', bg: '#FEE2E2' },
  cao: { label: 'Mức độ cao', color: '#B91C1C', bg: '#FEE2E2' },
  MEDIUM: { label: 'Mức độ trung bình', color: '#B45309', bg: '#FEF3C7' },
  trung_binh: { label: 'Mức độ trung bình', color: '#B45309', bg: '#FEF3C7' },
  LOW: { label: 'Mức độ thấp', color: '#1D4ED8', bg: '#DBEAFE' },
  thap: { label: 'Mức độ thấp', color: '#1D4ED8', bg: '#DBEAFE' },
};

export const ADMIN_EVENT_LABELS = {
  AUTO_CRAWL_CREATE: 'Cập nhật tự động từ nguồn pháp lý (thêm mới)',
  AUTO_CRAWL_UPDATE: 'Cập nhật tự động từ nguồn pháp lý',
  AUTO_CRAWL_EXPIRE: 'Cập nhật tự động ghi nhận hết hiệu lực',
  MANUAL_LEGAL_OVERRIDE: 'Điều chỉnh pháp lý thủ công',
  THRESHOLD_CHANGE: 'Thay đổi ngưỡng phân loại',
  TRANSITIONAL_RULE_APPLIED: 'Áp dụng quy tắc chuyển tiếp',
  REVIEW_LAW: 'Kiểm duyệt văn bản pháp luật',
  REVIEW_RULE: 'Kiểm duyệt quy tắc phân loại',
  REVIEW_THRESHOLD_RULE: 'Kiểm duyệt quy tắc phân loại',
  REVIEW_QCVN: 'Kiểm duyệt quy chuẩn QCVN',
  REVIEW_QCVN_CATALOG: 'Kiểm duyệt quy chuẩn QCVN',
  RESOLVE_LAW_IMPACT: 'Xử lý cảnh báo tác động pháp lý',
  CREATE_MODERATION_PROPOSAL: 'Tạo đề xuất thay đổi quy tắc / QCVN',
  APPROVE_RULE_CANDIDATE: 'Phê duyệt đề xuất quy tắc',
  REJECT_RULE_CANDIDATE: 'Từ chối đề xuất quy tắc',
  VERIFY_RULE_CATALOG: 'Xác minh danh mục quy tắc / QCVN',
  UPDATE_RULE: 'Cập nhật quy tắc phân loại',
};

export const AUDIT_SOURCE_LABELS = {
  audit_logs: 'Nhật ký kiểm toán hệ thống',
  law_update_history: 'Lịch sử cập nhật văn bản pháp lý',
  crawler: 'Trình thu thập dữ liệu tự động',
  thu_cong: 'Đề xuất / Nhập thủ công',
  he_thong: 'Cơ sở dữ liệu hệ thống',
  DATABASE: 'Cơ sở dữ liệu hệ thống',
  FALLBACK_UNVERIFIED: 'Dữ liệu dự phòng chưa xác minh',
  STATIC_FIXTURE: 'Dữ liệu mẫu mặc định',
};

export const AUTHORITY_LABELS = {
  cap_bo: 'Bộ NN&MT / Bộ TN&MT',
  btnmt: 'Bộ NN&MT / Bộ TN&MT',
  cap_so: 'UBND cấp Tỉnh / Sở NN&MT',
  ubnd_tinh: 'UBND cấp Tỉnh / Sở NN&MT',
  cap_huyen: 'UBND cấp Huyện (lịch sử)',
  cap_xa: 'UBND cấp Xã',
  bql_kcn: 'Ban Quản lý KCN',
  bo_khac: 'Bộ quản lý chuyên ngành khác',
};

export const QCVN_DOMAIN_LABELS = {
  nuoc_thai_cn: 'Nước thải công nghiệp',
  nuoc_thai_sh: 'Nước thải sinh hoạt',
  nuoc_mat: 'Chất lượng nước mặt',
  nuoc_ngam: 'Chất lượng nước dưới đất',
  khong_khi: 'Chất lượng không khí xung quanh',
  khi_thai: 'Khí thải công nghiệp',
  dat: 'Chất lượng đất',
};

export const LAW_TYPE_LABELS = {
  luat: 'Luật',
  nd: 'Nghị định',
  vbhn: 'Văn bản hợp nhất',
  tt: 'Thông tư',
  qcvn: 'Quy chuẩn kỹ thuật (QCVN)',
  qd: 'Quyết định',
  nq: 'Nghị quyết',
};

export const PROCEDURE_SHORT_LABELS = {
  DTM: 'ĐTM',
  GPMT: 'GPMT',
  DKMT: 'ĐKMT',
  EXEMPT_DKMT: 'Miễn ĐKMT',
};

const unmappedLocalizationCodes = new Set();

function recordUnmappedCode(category, rawCode) {
  if (!rawCode) return;
  const entry = `${category}:${rawCode}`;
  if (!unmappedLocalizationCodes.has(entry)) {
    unmappedLocalizationCodes.add(entry);
  }
}

export function getUnmappedLocalizationCodes() {
  return Array.from(unmappedLocalizationCodes);
}

export function toModerationStatusCode(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (['cho_duyet', 'pending_review', 'extracted', 'da_trich_xuat', 'pending_verification', 'cho_xac_minh'].includes(s)) return 'cho_duyet';
  if (['can_xac_minh_phap_ly', 'needs_legal_verification', 'needs_review', 'can_ra_soat'].includes(s)) return 'can_xac_minh_phap_ly';
  if (['da_xac_minh', 'verified', 'da_duyet', 'approved', 'da_ap_dung', 'applied'].includes(s)) return 'da_xac_minh';
  if (['tu_choi', 'rejected'].includes(s)) return 'tu_choi';
  if (['can_bo_sung', 'need_more_info'].includes(s)) return 'can_bo_sung';
  if (['het_hieu_luc', 'expired', 'lich_su', 'historical', 'superseded'].includes(s)) return 'het_hieu_luc';
  if (['ban_nhap', 'draft'].includes(s)) return 'ban_nhap';
  return s || 'can_xac_minh_phap_ly';
}

export function getModerationStatusMeta(raw) {
  const code = toModerationStatusCode(raw);
  const map = {
    cho_duyet: { label: 'Chờ kiểm duyệt', cls: 'st-pending' },
    can_xac_minh_phap_ly: { label: 'Cần xác minh pháp lý', cls: 'st-pending' },
    can_bo_sung: { label: 'Cần bổ sung thông tin', cls: 'st-info' },
    da_xac_minh: { label: 'Đã phê duyệt', cls: 'st-approved' },
    tu_choi: { label: 'Đã từ chối', cls: 'st-rejected' },
    het_hieu_luc: { label: 'Hết hiệu lực', cls: 'st-muted' },
    ban_nhap: { label: 'Bản nháp', cls: 'st-muted' },
  };
  return map[code] || { label: 'Chờ kiểm duyệt', cls: 'st-pending' };
}

export function getAuthorityLabel(tq) {
  if (!tq) return '—';
  return AUTHORITY_LABELS[tq] || tq;
}

export function getQcvnDomainLabel(sourceType) {
  if (!sourceType) return 'Quy chuẩn môi trường';
  return QCVN_DOMAIN_LABELS[sourceType] || sourceType;
}

export function getLawTypeLabelVi(type) {
  if (!type) return 'Văn bản';
  return LAW_TYPE_LABELS[type] || 'Văn bản pháp luật';
}

export function getProcedureShortLabel(code) {
  if (!code) return '—';
  return PROCEDURE_SHORT_LABELS[code] || code;
}

export function getAuditSourceLabel(source) {
  if (!source) return 'Cơ sở dữ liệu hệ thống';
  return AUDIT_SOURCE_LABELS[source] || 'Cơ sở dữ liệu hệ thống';
}

export const ADMIN_STATUS_LABELS = {
  OPEN: 'Đang chờ xử lý',
  dang_mo: 'Đang chờ xử lý',
  RESOLVED: 'Đã xử lý',
  da_xu_ly: 'Đã xử lý',
  IGNORED: 'Bỏ qua',
  bo_qua: 'Bỏ qua',
  EXTRACTED: 'Chờ kiểm duyệt',
  da_trich_xuat: 'Chờ kiểm duyệt',
  PENDING_REVIEW: 'Chờ kiểm duyệt',
  cho_duyet: 'Chờ kiểm duyệt',
  PENDING_VERIFICATION: 'Chờ kiểm duyệt',
  cho_xac_minh: 'Chờ kiểm duyệt',
  NEEDS_REVIEW: 'Cần xác minh pháp lý',
  can_ra_soat: 'Cần xác minh pháp lý',
  APPLIED: 'Đã phê duyệt',
  da_ap_dung: 'Đã phê duyệt',
  APPROVED: 'Đã phê duyệt',
  da_duyet: 'Đã phê duyệt',
  REJECTED: 'Từ chối',
  tu_choi: 'Từ chối',
  NEED_MORE_INFO: 'Cần bổ sung thông tin',
  can_bo_sung: 'Cần bổ sung thông tin',
  VERIFIED: 'Đã phê duyệt',
  da_xac_minh: 'Đã phê duyệt',
  NEEDS_LEGAL_VERIFICATION: 'Cần xác minh pháp lý',
  can_xac_minh_phap_ly: 'Cần xác minh pháp lý',
  DRAFT: 'Bản nháp',
  ban_nhap: 'Bản nháp',
  PUBLISHED: 'Đã công bố',
  da_cong_bo: 'Đã công bố',
  EXPIRED: 'Ngừng áp dụng / Hết hiệu lực',
  het_hieu_luc: 'Ngừng áp dụng / Hết hiệu lực',
  HISTORICAL: 'Ngừng áp dụng / Hết hiệu lực',
  lich_su: 'Ngừng áp dụng / Hết hiệu lực',
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngưng hoạt động',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
};

export const ADMIN_TARGET_TYPE_LABELS = {
  INDUSTRY: 'Ngành nghề',
  nganh_nghe: 'Ngành nghề',
  THRESHOLD: 'Ngưỡng công suất',
  CLASSIFICATION_THRESHOLD: 'Quy tắc phân loại',
  INDUSTRY_TIER: 'Quy tắc phân loại',
  nguong_phan_loai: 'Quy tắc phân loại',
  QCVN: 'Quy chuẩn QCVN',
  quy_chuan_qcvn: 'Quy chuẩn QCVN',
  PARAMETER: 'Chỉ tiêu giới hạn',
  RULE: 'Quy tắc phân loại',
};

export function getAdminSeverityMeta(severity) {
  return ADMIN_SEVERITY_LABELS[severity] || { label: 'Thông thường', color: '#475569', bg: '#F1F5F9' };
}

export function getAdminEventActionLabel(action) {
  if (!action) return 'Thao tác nghiệp vụ hệ thống';
  if (ADMIN_EVENT_LABELS[action]) return ADMIN_EVENT_LABELS[action];
  const upper = String(action).trim().toUpperCase();
  if (ADMIN_EVENT_LABELS[upper]) return ADMIN_EVENT_LABELS[upper];
  if (/^[A-Z0-9_]+$/.test(upper)) {
    recordUnmappedCode('action', action);
    return 'Thao tác cập nhật dữ liệu pháp lý';
  }
  return action;
}

export function getAdminStatusLabel(status) {
  if (!status) return 'Chờ rà soát';
  if (ADMIN_STATUS_LABELS[status]) return ADMIN_STATUS_LABELS[status];
  const upper = String(status).trim().toUpperCase();
  if (ADMIN_STATUS_LABELS[upper]) return ADMIN_STATUS_LABELS[upper];
  if (/^[A-Z0-9_]+$/.test(upper)) {
    recordUnmappedCode('status', status);
    return 'Chờ rà soát';
  }
  return status;
}

export function getAdminTargetTypeLabel(type) {
  if (!type) return 'Quy định';
  if (ADMIN_TARGET_TYPE_LABELS[type]) return ADMIN_TARGET_TYPE_LABELS[type];
  const upper = String(type).trim().toUpperCase();
  if (ADMIN_TARGET_TYPE_LABELS[upper]) return ADMIN_TARGET_TYPE_LABELS[upper];
  if (/^[A-Z0-9_]+$/.test(upper)) {
    recordUnmappedCode('target_type', type);
    return 'Quy định pháp lý';
  }
  return type;
}

const AUDIT_FIELD_LABELS = {
  law_id: 'Mã văn bản',
  law_so: 'Số hiệu văn bản',
  law_ten: 'Tên văn bản',
  so: 'Số hiệu',
  ten: 'Tên đối tượng',
  id: 'Mã bản ghi',
  industry_code: 'Mã ngành nghề',
  targetType: 'Loại đối tượng',
  targetCode: 'Mã đối tượng',
  decision: 'Quyết định kiểm duyệt',
  decision_label: 'Quyết định kiểm duyệt',
  verification_status: 'Trạng thái xác minh',
  status: 'Trạng thái',
  reason: 'Lý do / Ghi chú',
  reviewNote: 'Ghi chú kiểm duyệt',
  sourceDocument: 'Căn cứ pháp lý ban hành',
  legalRef: 'Căn cứ pháp lý',
  legal_ref: 'Căn cứ pháp lý',
  effectiveFrom: 'Ngày bắt đầu hiệu lực',
  effective_from: 'Ngày bắt đầu hiệu lực',
  min_value: 'Ngưỡng tối thiểu',
  max_value: 'Ngưỡng tối đa',
  legal_doc_required: 'Loại hồ sơ môi trường',
  tq: 'Thẩm quyền giải quyết',
  project_name: 'Tên dự án',
  project_id: 'Mã dự án',
  target_username: 'Tài khoản mục tiêu',
  username: 'Tên đăng nhập',
  impactId: 'Mã cảnh báo tác động',
  candidateId: 'Mã đề xuất quy tắc',
  description: 'Mô tả thay đổi',
  before: 'Dữ liệu trước thay đổi',
  after: 'Dữ liệu sau thay đổi',
};

function formatAuditValueVi(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'tq') return getAuthorityLabel(val);
  if (key === 'legal_doc_required') return getProcedureShortLabel(val);
  if (key === 'targetType') return getAdminTargetTypeLabel(val);
  if (key === 'decision' || key === 'verification_status' || key === 'status') {
    return getAdminStatusLabel(val);
  }
  if (typeof val === 'boolean') return val ? 'Có' : 'Không';
  if (typeof val === 'object') {
    const summaryParts = [];
    if (val.verification_status) summaryParts.push(`Trạng thái: ${getAdminStatusLabel(val.verification_status)}`);
    if (val.status) summaryParts.push(`Hiệu lực: ${getAdminStatusLabel(val.status)}`);
    if (val.so) summaryParts.push(`Số hiệu: ${val.so}`);
    if (val.min_value !== undefined) summaryParts.push(`Ngưỡng tối thiểu: ${val.min_value}`);
    if (val.project_group) summaryParts.push(`Nhóm: ${val.project_group}`);
    if (val.legal_doc_required) summaryParts.push(`Hồ sơ: ${getProcedureShortLabel(val.legal_doc_required)}`);
    if (val.source_document) summaryParts.push(`Căn cứ: ${val.source_document}`);
    if (summaryParts.length > 0) return summaryParts.join(' · ');
    return 'Đã ghi nhận bản chụp dữ liệu';
  }
  const str = String(val);
  if (ADMIN_STATUS_LABELS[str]) return ADMIN_STATUS_LABELS[str];
  if (ADMIN_EVENT_LABELS[str]) return ADMIN_EVENT_LABELS[str];
  return str;
}

export function formatAuditDetailsForUser(details) {
  if (!details || typeof details !== 'object') return [];
  const rows = [];
  for (const [key, val] of Object.entries(details)) {
    if (val === null || val === undefined || val === '') continue;
    if (key === 'asDraft' || key === 'password_changed' || key === 'target_id') continue;
    const label = AUDIT_FIELD_LABELS[key] || null;
    if (!label) continue;
    rows.push({
      label,
      value: formatAuditValueVi(key, val),
    });
  }
  return rows;
}

export function formatReasonForEndUser(rawReason) {
  if (!rawReason) return '';
  let text = String(rawReason).trim();

  if (/FALLBACK_UNVERIFIED|DB_UNAVAILABLE|EMPTY_INDUSTRIES_TABLE|column\s+".*"\s+does not exist|error|exception/i.test(text)) {
    return 'Hiện chưa tải được danh mục quy chuẩn từ cơ sở dữ liệu; hệ thống tạm thời giữ trạng thái cần rà soát để đảm bảo an toàn pháp lý.';
  }

  text = text
    .replace(/^\[NEEDS_LEGAL_VERIFICATION\]\s*/i, '')
    .replace(/^Mục\s*4\.[0-9]+\s*README\s*:\s*/i, '')
    .replace(/\s*\(NEEDS_LEGAL_VERIFICATION\)/gi, '')
    .replace(/\s*\(PENDING_SERVER_VERIFICATION\)/gi, '')
    .replace(/\s*\(QCVN_SELECTION_MISMATCH\)/gi, '')
    .replace(/\s*\(historicalTq\)/gi, '')
    .replace(/xác minh VERIFIED phía server/gi, 'được quản trị viên xác minh hợp lệ')
    .replace(/xác minh VERIFIED/gi, 'được quản trị viên xác minh hợp lệ')
    .replace(/đang gắn trạng thái NEEDS_LEGAL_VERIFICATION/gi, 'đang chờ chuyên viên pháp lý xác minh chi tiết')
    .replace(/đang ở trạng thái NEEDS_LEGAL_VERIFICATION/gi, 'đang chờ đối chiếu xác minh từ văn bản gốc')
    .replace(/gắn cờ NEEDS_LEGAL_VERIFICATION/gi, 'đang chờ xác minh ngưỡng từ văn bản gốc')
    .replace(/quyết định xác minh VERIFIED phía server/gi, 'quyết định xác minh hợp lệ của quản trị viên')
    .replace(/\bNEEDS_LEGAL_VERIFICATION\b/g, 'chờ xác minh quy định pháp lý')
    .replace(/\bNEEDS_REVIEW\b/g, 'cần rà soát lại')
    .replace(/\bMISSING_PROCESS_STAGE\b/g, 'thiếu thông tin công đoạn/loại hình')
    .replace(/\bINVALID_PROCESS_STAGE\b/g, 'công đoạn/loại hình chưa hợp lệ')
    .replace(/\bINVALID_CAPACITY\b/g, 'quy mô công suất chưa hợp lệ')
    .replace(/\bUNKNOWN_INDUSTRY\b/g, 'chưa xác định được ngành nghề')
    .replace(/\bMISSING_FLOW_RATE\b/g, 'chưa có lưu lượng xả thải')
    .replace(/\bMISSING_RECEIVING_SOURCE\b/g, 'chưa xác nhận nguồn tiếp nhận')
    .replace(/\bTRANSITION_TABLE_NOT_AVAILABLE\b/g, 'chưa có bảng quy chuẩn chuyển tiếp được phê duyệt')
    .replace(/\bPERIOD_MISMATCH\b/g, 'lệch chu kỳ trung bình lấy mẫu')
    .replace(/\bPENDING_REVIEW\b/g, 'chờ kiểm duyệt')
    .replace(/\bVERIFIED\b/g, 'đã xác minh')
    .replace(/\bDRAFT\b/g, 'bản nháp')
    .replace(/\bserver\b/gi, 'máy chủ')
    .replace(/\badmin\b/gi, 'quản trị viên')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}

/**
 * Chuẩn hóa đoạn văn bản pháp lý/QCVN thành từng dòng riêng biệt để dễ đọc:
 * - Xuống dòng trước các mục đánh số (1., 2., a), b), Điều ..., Khoản ..., Phụ lục ...).
 * - Xuống dòng sau dấu chấm/chấm phẩy khi câu tiếp theo bắt đầu bằng chữ cái viết hoa,
 *   nhưng bảo toàn viết tắt/ký hiệu pháp lý (TP.HCM, TT-BTNMT, NĐ-CP, QCVN, ngày tháng...).
 */
export function formatLegalTextLines(rawText) {
  const input = String(rawText || '').trim();
  if (!input) return [];

  const protectedAbbrs = [
    'TP.HCM', 'TP.HN', 'Q.1', 'P.', 'Q.', 'TX.', 'TT.', 'ThS.', 'TS.', 'GS.', 'PGS.', 'KS.', 'CN.',
  ];
  let work = input.replace(/\r\n/g, '\n');

  // Tạm bảo vệ các từ viết tắt có dấu chấm
  const placeholders = [];
  for (const abbr of protectedAbbrs) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    work = work.replace(new RegExp(escaped, 'g'), (m) => {
      const token = `__ABBR_${placeholders.length}__`;
      placeholders.push(m);
      return token;
    });
  }

  // Xuống dòng trước Điều / Khoản / Phụ lục khi đứng giữa dòng
  work = work.replace(/([.:;])\s*(?=(?:Điều|Khoản|Phụ\s+lục)\s+[0-9IVX]+)/g, '$1\n');

  // Xuống dòng trước các mục đánh số kiểu "1.", "2." hoặc "a)", "b)", "đ)" sau dấu câu hoặc khoảng trắng
  work = work.replace(/([.:;])\s*(?=(\d{1,2}\.|[a-zđ]\))\s+\p{L})/gu, '$1\n');

  // Xuống dòng sau dấu chấm hoặc chấm phẩy khi theo sau là chữ cái đầu viết hoa (tránh tách ngay sau số thứ tự "1.", "2." hoặc số thập phân/ngày tháng)
  work = work.replace(/(?<![\n\s]\d{1,2})([.;])\s*(?=\p{Lu}[\p{Ll}])/gu, '$1\n');

  // Khôi phục từ viết tắt
  placeholders.forEach((orig, idx) => {
    work = work.replaceAll(`__ABBR_${idx}__`, orig);
  });

  return work
    .split(/\n+/)
    .map(line => line.replace(/\s{2,}/g, ' ').trim())
    .filter(Boolean);
}

export const RULE_VERSION_TARGET_LABELS = {
  rule_qcvn_monitoring_check: 'Bộ quy tắc đối chiếu QCVN',
  rule_project_classification: 'Bộ quy tắc phân loại dự án',
};

export function getRuleVersionTargetLabel(targetCode) {
  const raw = String(targetCode || '').trim();
  if (!raw) return 'Quy tắc hệ thống';
  const normalized = raw.replace(/^#/, '');
  if (RULE_VERSION_TARGET_LABELS[normalized]) {
    return RULE_VERSION_TARGET_LABELS[normalized];
  }
  return raw;
}
