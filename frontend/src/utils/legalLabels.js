// frontend/src/utils/legalLabels.js
// Ánh xạ toàn bộ mã trạng thái kỹ thuật / pháp lý nội bộ sang tiếng Việt dễ hiểu cho người dùng cuối.

export const RULE_SOURCE_LABELS = {
  DATABASE: 'Dữ liệu quy chuẩn hệ thống',
  FALLBACK_UNVERIFIED: 'Dữ liệu dự phòng (chưa kết nối CSDL)',
  STATIC_FIXTURE: 'Dữ liệu bản đồ mặc định',
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
  VERIFIED: 'Đã xác minh',
  NEEDS_LEGAL_VERIFICATION: 'Chờ xác minh quy chuẩn',
  DRAFT: 'Bản nháp',
  PENDING_REVIEW: 'Chờ duyệt',
  REJECTED: 'Từ chối',
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
  MEDIUM: { label: 'Mức độ trung bình', color: '#B45309', bg: '#FEF3C7' },
  LOW: { label: 'Mức độ thấp', color: '#1D4ED8', bg: '#DBEAFE' },
};

export const ADMIN_EVENT_LABELS = {
  AUTO_CRAWL_UPDATE: 'Cập nhật từ bóc tách tự động',
  MANUAL_LEGAL_OVERRIDE: 'Điều chỉnh quy định thủ công',
  THRESHOLD_CHANGE: 'Thay đổi ngưỡng quy định',
  TRANSITIONAL_RULE_APPLIED: 'Áp dụng bảng chuyển tiếp',
};

export const ADMIN_STATUS_LABELS = {
  OPEN: 'Đang chờ xử lý',
  RESOLVED: 'Đã xử lý',
  IGNORED: 'Bỏ qua',
  PENDING_REVIEW: 'Chờ kiểm duyệt',
  APPLIED: 'Đã áp dụng',
  REJECTED: 'Đã từ chối',
  VERIFIED: 'Đã xác minh',
  NEEDS_LEGAL_VERIFICATION: 'Chờ đối chiếu văn bản',
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã công bố',
};

export const ADMIN_TARGET_TYPE_LABELS = {
  INDUSTRY: 'Ngành nghề',
  THRESHOLD: 'Ngưỡng công suất',
  QCVN: 'Quy chuẩn QCVN',
  PARAMETER: 'Chỉ tiêu giới hạn',
  RULE: 'Quy tắc phân loại',
};

export function getAdminSeverityMeta(severity) {
  return ADMIN_SEVERITY_LABELS[severity] || { label: severity || 'Thông thường', color: '#475569', bg: '#F1F5F9' };
}

export function getAdminEventActionLabel(action) {
  return ADMIN_EVENT_LABELS[action] || action;
}

export function getAdminStatusLabel(status) {
  return ADMIN_STATUS_LABELS[status] || status;
}

export function getAdminTargetTypeLabel(type) {
  return ADMIN_TARGET_TYPE_LABELS[type] || type;
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
    .replace(/\bserver\b/gi, 'máy chủ')
    .replace(/\badmin\b/gi, 'quản trị viên')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text;
}
