// backend/utils/error-messages.js
// Ánh xạ tập trung các mã lỗi kỹ thuật nội bộ sang thông báo tiếng Việt thân thiện cho người dùng cuối.
// Log lỗi gốc vẫn được ghi đầy đủ qua logger.error ở backend để phục vụ gỡ lỗi kỹ thuật.

const EXACT_ERROR_MESSAGES = {
  LAW_NOT_FOUND: 'Không tìm thấy văn bản pháp luật.',
  LAW_ID_REQUIRED: 'Vui lòng cung cấp mã văn bản pháp luật hợp lệ.',
  RECORD_NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  RULE_NOT_FOUND: 'Không tìm thấy quy tắc phân loại.',
  INVALID_RULE_ID: 'Mã quy tắc phân loại không hợp lệ.',
  CANDIDATE_NOT_FOUND: 'Không tìm thấy đề xuất thay đổi quy tắc.',
  INVALID_CANDIDATE_ID: 'Mã đề xuất quy tắc không hợp lệ.',
  IMPACT_NOT_FOUND: 'Không tìm thấy bản ghi cảnh báo tác động.',
  INVALID_IMPACT_ID: 'Mã cảnh báo tác động không hợp lệ.',
  QCVN_NOT_FOUND: 'Không tìm thấy quy chuẩn kỹ thuật QCVN.',
  QCVN_ID_REQUIRED: 'Vui lòng cung cấp mã quy chuẩn QCVN.',
  QCVN_NAME_REQUIRED: 'Vui lòng nhập tên quy chuẩn QCVN.',
  INDUSTRY_NOT_FOUND: 'Không tìm thấy ngành nghề yêu cầu.',
  INDUSTRY_CODE_REQUIRED: 'Vui lòng chọn mã ngành nghề.',
  TARGET_ID_REQUIRED: 'Thiếu mã đối tượng cần xử lý.',
  TARGET_CODE_REQUIRED: 'Thiếu mã đối tượng quy tắc hoặc QCVN.',
  INVALID_TARGET_TYPE: 'Loại dữ liệu kiểm duyệt không hợp lệ.',
  INVALID_REVIEW_DECISION: 'Quyết định kiểm duyệt không hợp lệ.',
  REVIEW_REASON_REQUIRED: 'Bắt buộc nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin.',
  SOURCE_DOCUMENT_REQUIRED: 'Bắt buộc nhập số hiệu văn bản hoặc căn cứ pháp lý trước khi phê duyệt.',
  LEGAL_REF_AND_EFFECTIVE_DATE_REQUIRED: 'Bắt buộc nhập đầy đủ căn cứ pháp lý và ngày bắt đầu hiệu lực trước khi phê duyệt.',
  VERIFIED_BY_REQUIRED: 'Thiếu thông tin người thực hiện xác minh.',
  CRAWLER_BUSY: 'Quá trình đồng bộ dữ liệu pháp lý đang được thực hiện. Vui lòng thử lại sau ít phút.',
  DATABASE_UNAVAILABLE: 'Hiện không thể kết nối cơ sở dữ liệu hệ thống.',
  SERVER_UNREACHABLE: 'Không thể kết nối đến máy chủ xử lý.',
  INVALID_TRANSITIONAL_QCVN_ID: 'Mã quy chuẩn chuyển tiếp không đúng định dạng cho phép (QCVN 40:2011 hoặc QCVN 14:2008).',
  QCVN_PARAMETERS_REQUIRED: 'Vui lòng nhập tối thiểu một thông số môi trường cho quy chuẩn.',
  QCVN_PARAMETER_INVALID: 'Cấu trúc danh sách thông số môi trường không hợp lệ.',
  QCVN_PARAMETER_NAME_REQUIRED: 'Mỗi thông số môi trường phải có tên hoặc mã chỉ tiêu.',
  INVALID_THRESHOLD_MIN_VALUE: 'Giá trị ngưỡng công suất tối thiểu phải là số hợp lệ.',
};

function toVietnameseErrorMessage(rawCode, fallback = 'Dữ liệu không hợp lệ hoặc không thể xử lý yêu cầu.') {
  if (!rawCode) return fallback;
  const text = String(rawCode).trim();
  if (EXACT_ERROR_MESSAGES[text]) return EXACT_ERROR_MESSAGES[text];

  if (text.startsWith('CANDIDATE_ALREADY_PROCESSED')) {
    return 'Đề xuất quy tắc này đã được xử lý trước đó.';
  }
  if (text.startsWith('QCVN_PARAMETER_LIMIT_REQUIRED:')) {
    const paramName = text.split(':')[1] || '';
    return `Thông số "${paramName}" chưa có giá trị giới hạn cho phép.`;
  }
  if (text.startsWith('QCVN_PARAMETER_RANGE_INVALID:')) {
    const paramName = text.split(':')[1] || '';
    return `Khoảng giới hạn của thông số "${paramName}" không hợp lệ (giá trị nhỏ nhất lớn hơn giá trị lớn nhất).`;
  }
  if (text.startsWith('INVALID_PARAM_MIN:') || text.startsWith('INVALID_PARAM_MAX:') || text.startsWith('INVALID_PARAM_LIMIT:')) {
    const paramName = text.split(':')[1] || '';
    return `Giá trị giới hạn của thông số "${paramName}" phải là số hợp lệ.`;
  }
  if (text.startsWith('UNSUPPORTED_CANDIDATE_TARGET')) {
    return 'Loại đối tượng của đề xuất hiện chưa được hỗ trợ tự động áp dụng.';
  }
  if (/^[A-Z0-9_]+(?::.*)?$/.test(text)) {
    return fallback;
  }
  return text;
}

module.exports = {
  EXACT_ERROR_MESSAGES,
  toVietnameseErrorMessage,
};
