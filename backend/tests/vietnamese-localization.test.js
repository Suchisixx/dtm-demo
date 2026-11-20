// backend/tests/vietnamese-localization.test.js
// Kiểm thử tự động Việt hóa toàn bộ giao diện & thông báo ETC LegalHub (Mục 9).
// Phân biệt rõ:
// - Mã kỹ thuật nội bộ (Loại A) vẫn được bảo toàn trong DB/API/Logic.
// - Nội dung hiển thị trên giao diện (Loại B) tuyệt đối không hiển thị nguyên mã kỹ thuật tiếng Anh.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { toVietnameseErrorMessage } = require('../utils/error-messages');

async function loadLegalLabels() {
  const fileUrl = pathToFileURL(path.join(__dirname, '../../frontend/src/utils/legalLabels.js')).href;
  return import(fileUrl);
}

test('Từ điển legalLabels.js ánh xạ đầy đủ mọi mã trạng thái, hành động và nguồn dữ liệu sang tiếng Việt', async () => {
  const labels = await loadLegalLabels();

  const statusCodes = [
    'PENDING_REVIEW',
    'PENDING_VERIFICATION',
    'NEEDS_LEGAL_VERIFICATION',
    'NEEDS_REVIEW',
    'VERIFIED',
    'APPROVED',
    'REJECTED',
    'NEED_MORE_INFO',
    'EXPIRED',
    'DRAFT',
    'ACTIVE',
    'INACTIVE',
    'SUCCESS',
    'FAILED',
    'OPEN',
    'RESOLVED',
    'IGNORED',
  ];

  for (const code of statusCodes) {
    const vi = labels.getAdminStatusLabel(code);
    assert.ok(vi && typeof vi === 'string', `Thiếu nhãn tiếng Việt cho trạng thái ${code}`);
    assert.notEqual(vi, code, `Trạng thái ${code} không được hiển thị nguyên mã tiếng Anh`);
    assert.ok(!/^[A-Z0-9_]+$/.test(vi), `Nhãn của ${code} vẫn là mã kỹ thuật: ${vi}`);
  }

  const eventActions = [
    'AUTO_CRAWL_CREATE',
    'AUTO_CRAWL_UPDATE',
    'AUTO_CRAWL_EXPIRE',
    'MANUAL_LEGAL_OVERRIDE',
    'THRESHOLD_CHANGE',
    'TRANSITIONAL_RULE_APPLIED',
    'REVIEW_LAW',
    'REVIEW_RULE',
    'REVIEW_QCVN',
    'RESOLVE_LAW_IMPACT',
  ];

  for (const act of eventActions) {
    const vi = labels.getAdminEventActionLabel(act);
    assert.ok(vi && typeof vi === 'string', `Thiếu nhãn tiếng Việt cho hành động ${act}`);
    assert.notEqual(vi, act, `Hành động ${act} không được hiển thị nguyên mã tiếng Anh`);
    assert.ok(!/^[A-Z0-9_]+$/.test(vi), `Nhãn của ${act} vẫn là mã kỹ thuật: ${vi}`);
  }

  // Kiểm tra nguồn dữ liệu
  assert.equal(labels.getRuleSourceLabel('DATABASE'), 'Dữ liệu quy chuẩn hệ thống');
  assert.equal(labels.getRuleSourceLabel('FALLBACK_UNVERIFIED'), 'Dữ liệu dự phòng chưa xác minh');
  assert.equal(labels.getRuleSourceLabel('STATIC_FIXTURE'), 'Dữ liệu mẫu mặc định');
  assert.equal(labels.getAuditSourceLabel('audit_logs'), 'Nhật ký kiểm toán hệ thống');
  assert.equal(labels.getAuditSourceLabel('law_update_history'), 'Lịch sử cập nhật văn bản pháp lý');

  // Kiểm tra fallback an toàn khi gặp mã kỹ thuật mới chưa có trong từ điển
  const unknownAction = labels.getAdminEventActionLabel('SOME_FUTURE_ACTION_CODE');
  assert.notEqual(unknownAction, 'SOME_FUTURE_ACTION_CODE');
  assert.ok(!/^[A-Z0-9_]+$/.test(unknownAction));
  assert.ok(labels.getUnmappedLocalizationCodes().includes('action:SOME_FUTURE_ACTION_CODE'));
});

test('formatAuditDetailsForUser chuyển đổi chi tiết nhật ký kiểm toán sang tiếng Việt, không lộ mã kỹ thuật', async () => {
  const { formatAuditDetailsForUser } = await loadLegalLabels();
  const rows = formatAuditDetailsForUser({
    targetType: 'CLASSIFICATION_THRESHOLD',
    decision: 'VERIFIED',
    verification_status: 'NEEDS_LEGAL_VERIFICATION',
    tq: 'cap_bo',
    legal_doc_required: 'DTM',
    reason: 'Đã đối chiếu Phụ lục III',
    before: { verification_status: 'PENDING_REVIEW', min_value: 50000 },
    after: { verification_status: 'VERIFIED', min_value: 100000 },
  });

  assert.ok(rows.length >= 6);
  const renderedText = rows.map(r => `${r.label}: ${r.value}`).join('\n');
  for (const forbidden of ['VERIFIED', 'PENDING_REVIEW', 'NEEDS_LEGAL_VERIFICATION', 'CLASSIFICATION_THRESHOLD', 'AUTO_CRAWL_UPDATE']) {
    assert.ok(!renderedText.includes(forbidden), `Chi tiết nhật ký kiểm toán không được lộ mã ${forbidden}`);
  }
  assert.ok(renderedText.includes('ĐTM'));
  assert.ok(renderedText.includes('Bộ NN&MT'));
});

test('Bộ chuyển đổi lỗi backend error-messages.js không trả nguyên mã lỗi nội bộ cho người dùng', () => {
  const errorCodes = [
    'LAW_NOT_FOUND',
    'RECORD_NOT_FOUND',
    'RULE_NOT_FOUND',
    'CRAWLER_BUSY',
    'DATABASE_UNAVAILABLE',
    'SERVER_UNREACHABLE',
    'INVALID_REVIEW_DECISION',
    'REVIEW_REASON_REQUIRED',
    'SOURCE_DOCUMENT_REQUIRED',
    'LEGAL_REF_AND_EFFECTIVE_DATE_REQUIRED',
    'QCVN_PARAMETERS_REQUIRED',
    'QCVN_PARAMETER_LIMIT_REQUIRED:COD',
    'CANDIDATE_ALREADY_PROCESSED:da_duyet',
    'UNKNOWN_INTERNAL_ERROR_999',
  ];

  for (const code of errorCodes) {
    const msg = toVietnameseErrorMessage(code);
    assert.ok(msg && typeof msg === 'string');
    assert.ok(!msg.includes(code), `Thông báo lỗi không được chứa nguyên mã kỹ thuật ${code}: ${msg}`);
  }
});

test('Quét toàn bộ <template> của 12 tệp Vue: không lộ mã kỹ thuật tiếng Anh hay JSON thô lên giao diện', () => {
  const vueFiles = [
    'frontend/src/App.vue',
    'frontend/src/components/AdminTab.vue',
    'frontend/src/components/AuthModal.vue',
    'frontend/src/components/classify/SavedProjectsDrawer.vue',
    'frontend/src/components/ClassifyTab.vue',
    'frontend/src/components/DashboardTab.vue',
    'frontend/src/components/LawsTab.vue',
    'frontend/src/components/LegalDetailModal.vue',
    'frontend/src/components/MapTab.vue',
    'frontend/src/components/moderation/ModerationDetailDrawer.vue',
    'frontend/src/components/moderation/ModerationWorkspace.vue',
    'frontend/src/components/QCVNTab.vue',
    'frontend/src/components/SearchableSelect.vue',
  ];

  const FORBIDDEN_VISIBLE_CODES = /\b(AUTO_CRAWL_UPDATE|AUTO_CRAWL_CREATE|MANUAL_LEGAL_OVERRIDE|THRESHOLD_CHANGE|PENDING_REVIEW|NEEDS_LEGAL_VERIFICATION|FALLBACK_UNVERIFIED|STATIC_FIXTURE|Fast Cache Skip|On-demand|Human-in-the-loop|JSON Array)\b/;

  for (const rel of vueFiles) {
    const content = fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8');
    const tplMatch = content.match(/<template>([\s\S]*?)<\/template>/);
    if (!tplMatch) continue;
    const tpl = tplMatch[1].replace(/<!--[\s\S]*?-->/g, '');

    // 1. Không đổ JSON.stringify thô trực tiếp trong template
    assert.ok(!tpl.includes('JSON.stringify('), `${rel} không được dùng JSON.stringify trực tiếp trong <template>`);

    // 2. Không hiển thị trực tiếp các mã kỹ thuật bị cấm trong text hiển thị
    const visibleText = tpl
      .replace(/<[^>]+>/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}/g, ' ')
      .replace(/\s+/g, ' ');
    const match = visibleText.match(FORBIDDEN_VISIBLE_CODES);
    assert.equal(match, null, `${rel} để lộ mã kỹ thuật / chuỗi tiếng Anh trong giao diện: ${match?.[0]}`);
  }
});

test('Cơ chế hiển thị chi tiết pháp lý dùng chung ở trung tâm màn hình và không điều hướng mất ngữ cảnh', () => {
  const modalVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/LegalDetailModal.vue'), 'utf8');
  const modDrawerVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/moderation/ModerationDetailDrawer.vue'), 'utf8');
  const lawsVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/LawsTab.vue'), 'utf8');
  const classifyVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/ClassifyTab.vue'), 'utf8');
  const qcvnVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/QCVNTab.vue'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../../frontend/src/assets/css/styles.css'), 'utf8');

  // 1. Modal dùng chung hỗ trợ Escape, khóa cuộn nền, căn giữa màn hình
  assert.ok(modalVue.includes('legal-modal-overlay') && modalVue.includes('legal-modal-card'));
  assert.ok(modalVue.includes("e.key === 'Escape'"), 'LegalDetailModal phải hỗ trợ đóng bằng phím Escape');
  assert.ok(modalVue.includes("document.body.style.overflow = isOpen ? 'hidden' : ''"), 'LegalDetailModal phải giữ nguyên vị trí cuộn trang nền');
  assert.ok(css.includes('align-items: center;') && css.includes('justify-content: center;'), 'CSS .legal-modal-overlay phải căn giữa cả 2 chiều');

  // 2. Kiểm duyệt Admin & Thư viện văn bản dùng LegalDetailModal, không còn drawer lệch góc phải
  assert.ok(modDrawerVue.includes('<LegalDetailModal') && !modDrawerVue.includes('mod-drawer-overlay'));
  assert.ok(lawsVue.includes('<LegalDetailModal') && !lawsVue.includes('class="drawer-overlay"'));

  // 3. Phân loại dự án mở modal căn cứ tại chỗ, không emit('view-law') điều hướng sang trang khác
  assert.ok(classifyVue.includes('<LegalDetailModal') && classifyVue.includes('openLegalBasisModal'));
  assert.ok(!classifyVue.includes("emit('view-law'"), 'ClassifyTab không được điều hướng sang /laws khi xem căn cứ pháp lý');

  // 4. QCVNTab hỗ trợ mở chi tiết quy chuẩn qua LegalDetailModal
  assert.ok(qcvnVue.includes('<LegalDetailModal') && qcvnVue.includes('mode="qcvn"'));
  assert.ok(modDrawerVue.includes('isReviewAlertCandidate'), 'ModerationDetailDrawer phải phân biệt đề xuất rà soát với đề xuất sửa ngưỡng');
});

test('formatLegalTextLines tách dòng rõ ràng tại các mục đánh số và câu viết hoa đầu dòng', async () => {
  const { pathToFileURL } = require('url');
  const labels = await import(pathToFileURL(path.join(__dirname, '../../frontend/src/utils/legalLabels.js')).href);

  const sample = 'Điều 84. Hiệu lực thi hành: 1. Thông tư này có hiệu lực thi hành kể từ ngày 10 tháng 01 năm 2022.2. Kể từ ngày Thông tư này có hiệu lực thi hành, các thông tư sau hết hiệu lực thi hành:a) Thông tư số 19/2015/TT-BTNMT ngày 23 tháng 4 năm 2015;b) Thông tư số 22/2015/TT-BTNMT ngày 28 tháng 5 năm 2015.';
  const lines = labels.formatLegalTextLines(sample);

  assert.ok(lines.length >= 5, `Phải tách được tối thiểu 5 dòng rõ ràng, thực tế: ${lines.length}`);
  assert.ok(lines.some(l => l.startsWith('1. Thông tư này')));
  assert.ok(lines.some(l => l.startsWith('2. Kể từ ngày')));
  assert.ok(lines.some(l => l.startsWith('a) Thông tư số 19/2015/TT-BTNMT')));
  assert.ok(lines.some(l => l.startsWith('b) Thông tư số 22/2015/TT-BTNMT')));
  assert.equal(labels.getRuleVersionTargetLabel('#rule_qcvn_monitoring_check'), 'Bộ quy tắc đối chiếu QCVN');
  assert.equal(labels.getRuleVersionTargetLabel('#rule_project_classification'), 'Bộ quy tắc phân loại dự án');
});
