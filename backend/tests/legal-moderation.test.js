// backend/tests/legal-moderation.test.js
// Kiểm thử toàn diện 12 kịch bản bắt buộc cho chức năng Kiểm duyệt dữ liệu pháp lý
// (Văn bản pháp luật, Quy tắc phân loại, Danh mục QCVN, Phân quyền Admin/Staff, Lịch sử phiên bản & Nhật ký kiểm toán).

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const db = require('../config/db');
const { JWT_SECRET, COOKIE_NAME } = require('../utils/constants');
const adminRulesRouter = require('../routes/admin-rules');
const adminRouter = require('../routes/admin');

function createToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
}

async function requestApp(app, { method = 'GET', path = '/', token = null, body = null } = {}) {
  const server = app.listen(0);
  const { port } = server.address();
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Cookie = `${COOKIE_NAME}=${token}`;
    }
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      ...(body !== null ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('Kiểm duyệt dữ liệu pháp lý: 12 kịch bản nghiệm thu (Văn bản, Quy tắc phân loại, QCVN, Phân quyền RBAC & Audit Logs)', async () => {
  const originalQuery = db.query.bind(db);
  const originalPool = db.pool;
  db.pool = null;

  // Bộ nhớ giả lập PostgreSQL lưu đầy đủ các bảng kiểm duyệt
  const mem = {
    laws: [
      {
        id: 'vb_crawl_moi_2026',
        type: 'tt',
        year: 2026,
        sort_date: '2026-04-10',
        so: '12/2026/TT-BNNMT',
        ten: 'Thông tư quy định kỹ thuật quan trắc môi trường 2026',
        hieuluc: 'Đang có hiệu lực',
        status: 'con_hieu_luc',
        mo_ta: 'Thông tư mới phát hiện từ crawler cần kiểm duyệt',
        dieu_khoang: [
          { tieu_de: 'Điều 1. Phạm vi điều chỉnh', noi_dung: 'Quy định chi tiết về quan trắc nước thải công nghiệp.' },
          { tieu_de: 'Điều 2. Hiệu lực thi hành', noi_dung: 'Có hiệu lực từ ngày 01/06/2026.' },
        ],
        link: 'https://www.luatmoitruong.vn/thong-tu-12-2026-tt-bnnmt',
        issuing_agency: 'Bộ Nông nghiệp và Môi trường',
        issued_date: '2026-04-10',
        effective_date: '2026-06-01',
        detection_source: 'crawler',
        detected_at: '2026-04-11T08:00:00Z',
        verification_status: 'cho_duyet',
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
      },
      {
        id: 'vbhn_49_2026',
        type: 'vbhn',
        year: 2026,
        sort_date: '2026-01-15',
        so: '49/VBHN-BNNMT',
        ten: 'Văn bản hợp nhất Nghị định quy định chi tiết một số điều của Luật BVMT',
        hieuluc: 'Đang có hiệu lực',
        status: 'con_hieu_luc',
        mo_ta: 'Văn bản hợp nhất nền tảng',
        dieu_khoang: [{ tieu_de: 'Phụ lục III', noi_dung: 'Danh mục dự án nhóm I, II, III' }],
        link: 'https://www.luatmoitruong.vn/van-ban-hop-nhat-49-vbhn-bnnmt',
        issuing_agency: 'Bộ Nông nghiệp và Môi trường',
        issued_date: '2026-01-15',
        effective_date: '2026-01-15',
        detection_source: 'he_thong',
        detected_at: '2026-01-15T00:00:00Z',
        verification_status: 'da_xac_minh',
        reviewed_by: 'admin',
        reviewed_at: '2026-01-15T00:00:00Z',
        review_note: 'Văn bản nền đã xác minh',
      },
    ],
    industries: [
      {
        code: 'che_bien_go',
        name: 'Chế biến gỗ và sản phẩm từ gỗ',
        display_name: 'Chế biến gỗ và sản phẩm từ gỗ',
        unit: 'm³ sản phẩm/năm',
        verification_status: 'can_xac_minh_phap_ly',
        publication_status: 'da_cong_bo',
        source_document: '49/VBHN-BNNMT',
      },
    ],
    thresholds: [
      {
        id: 201,
        industry_code: 'che_bien_go',
        process_stage: '',
        min_value: 100000,
        max_value: null,
        operator: '>=',
        unit: 'm³ sản phẩm/năm',
        project_group: 'Nhóm I',
        legal_doc_required: 'DTM',
        tq: 'cap_bo',
        phu_luc: 'Phụ lục III, Mục 12',
        legal_ref: 'Phụ lục III Nghị định 08/2022/NĐ-CP (VBHN 49/2026)',
        law_id: 'vbhn_49_2026',
        effective_from: '2025-02-01',
        effective_to: null,
        verification_status: 'can_xac_minh_phap_ly',
        publication_status: 'da_cong_bo',
        tier_order: 1,
        rule_version: '2026.2-audit',
        approved_by: null,
        approved_at: null,
      },
    ],
    qcvns: [
      {
        id: 'qcvn40_2025_b_f2',
        ten: 'QCVN 40:2025/BTNMT — Nước thải công nghiệp (Cột B, Lưu lượng F2)',
        ap_dung: 'Áp dụng cho cơ sở xả nước thải công nghiệp vào nguồn nước Cột B',
        standard_code: 'QCVN 40:2025/BTNMT',
        standard_version: '2025',
        status: 'hien_hanh',
        source_type: 'nuoc_thai_cn',
        column_code: 'B',
        flow_range: 'F2 (50 - 2000 m³/ngày)',
        effective_from: '2025-09-01',
        effective_to: null,
        verification_status: 'can_xac_minh_phap_ly',
        publication_status: 'da_cong_bo',
        source_document: null,
        rule_version: '2026.2-audit',
        tham_so: [
          { key: 'pH', ten: 'Độ pH', don_vi: '-', loai: 'range', min: 5.5, max: 9, required: true, averagingPeriod: '24_gio' },
          { key: 'BOD5', ten: 'Nhu cầu oxy sinh hóa (BOD5)', don_vi: 'mg/L', loai: 'max', gioi_han: 50, required: true, averagingPeriod: '24_gio' },
          { key: 'COD', ten: 'Nhu cầu oxy hóa học (COD)', don_vi: 'mg/L', loai: 'max', gioi_han: 150, required: true, averagingPeriod: '24_gio' },
          { key: 'TSS', ten: 'Tổng chất rắn lơ lửng (TSS)', don_vi: 'mg/L', loai: 'max', gioi_han: 100, required: true, averagingPeriod: '24_gio' },
        ],
      },
    ],
    candidates: [],
    impacts: [],
    rule_versions: [],
    law_update_history: [],
    audit_logs: [],
  };

  db.query = async (sql, params = []) => {
    const s = String(sql).trim();
    if (/^(ALTER|CREATE)/i.test(s) || /pg_class/i.test(s)) {
      return { rows: [{ ready: false }], rowCount: 1 };
    }
    if (/FROM\s+laws\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const found = mem.laws.find(l => l.id === params[0]);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }
    if (/SELECT\s+\*\s+FROM\s+laws/i.test(s)) {
      return { rows: mem.laws.map(l => ({ ...l })), rowCount: mem.laws.length };
    }
    if (/UPDATE\s+laws\s+SET\s+review_checklist/i.test(s)) {
      const idx = mem.laws.findIndex(l => l.id === params[1]);
      if (idx === -1) return { rows: [], rowCount: 0 };
      mem.laws[idx].review_checklist = JSON.parse(params[0]);
      return { rows: [{ id: mem.laws[idx].id, review_checklist: mem.laws[idx].review_checklist }], rowCount: 1 };
    }
    if (/UPDATE\s+laws/i.test(s)) {
      const lawId = params[14];
      const idx = mem.laws.findIndex(l => l.id === lawId);
      if (idx === -1) return { rows: [], rowCount: 0 };
      mem.laws[idx] = {
        ...mem.laws[idx],
        ten: params[0],
        so: params[1],
        type: params[2],
        status: params[3],
        hieuluc: params[4],
        issuing_agency: params[5],
        issued_date: params[6],
        effective_date: params[7],
        link: params[8],
        mo_ta: params[9],
        note: params[10],
        verification_status: params[11],
        reviewed_by: params[12],
        reviewed_at: new Date().toISOString(),
        review_note: params[13],
      };
      return { rows: [{ ...mem.laws[idx] }], rowCount: 1 };
    }
    if (/INSERT\s+INTO\s+law_update_history/i.test(s)) {
      const item = {
        id: mem.law_update_history.length + 1,
        law_id: params[0],
        action: params[1],
        updated_by: params[2],
        description: params[3],
        updated_at: new Date().toISOString(),
      };
      mem.law_update_history.push(item);
      return { rows: [item], rowCount: 1 };
    }
    if (/FROM\s+law_update_history/i.test(s)) {
      const list = params[0] && /WHERE\s+h\.law_id/i.test(s)
        ? mem.law_update_history.filter(h => h.law_id === params[0])
        : mem.law_update_history;
      return { rows: list, rowCount: list.length };
    }
    if (/FROM\s+classification_thresholds\s+ct[\s\S]*WHERE\s+ct\.id\s*=\s*\$1/i.test(s) || /SELECT\s+\*\s+FROM\s+classification_thresholds\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const found = mem.thresholds.find(t => t.id === Number(params[0]));
      if (!found) return { rows: [], rowCount: 0 };
      const ind = mem.industries.find(i => i.code === found.industry_code);
      return {
        rows: [{ ...found, industry_name: ind ? ind.display_name : found.industry_code }],
        rowCount: 1,
      };
    }
    if (/FROM\s+classification_thresholds/i.test(s) && /^SELECT/i.test(s)) {
      const rows = mem.thresholds.map(t => {
        const ind = mem.industries.find(i => i.code === t.industry_code);
        return { ...t, industry_name: ind ? ind.display_name : t.industry_code };
      });
      return { rows, rowCount: rows.length };
    }
    if (/UPDATE\s+classification_thresholds/i.test(s)) {
      const ruleId = Number(params[params.length - 1]);
      const idx = mem.thresholds.findIndex(t => t.id === ruleId);
      if (idx === -1) return { rows: [], rowCount: 0 };
      if (params.length === 19) {
        mem.thresholds[idx] = {
          ...mem.thresholds[idx],
          min_value: params[0],
          max_value: params[1],
          operator: params[2],
          unit: params[3],
          project_group: params[4],
          legal_doc_required: params[5],
          tq: params[6],
          process_stage: params[7],
          phu_luc: params[8],
          legal_ref: params[9],
          source_ref: params[10],
          law_id: params[11],
          effective_from: params[12],
          effective_to: params[13],
          verification_status: params[14],
          publication_status: params[15],
          rule_version: params[16],
          approved_by: params[17],
          approved_at: new Date().toISOString(),
        };
      }
      return { rows: [{ ...mem.thresholds[idx] }], rowCount: 1 };
    }
    if (/INSERT\s+INTO\s+rule_candidates/i.test(s)) {
      const cand = {
        id: mem.candidates.length + 1,
        law_id: params[0],
        law_title: params[1],
        target_type: params[2],
        target_code: params[3],
        title: params[4],
        proposed_data: JSON.parse(params[5]),
        diff_summary: JSON.parse(params[6]),
        extraction_confidence: 'cao',
        source_excerpt: params[7],
        status: 'cho_duyet',
        review_note: params[8],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mem.candidates.push(cand);
      return { rows: [cand], rowCount: 1 };
    }
    if (/FROM\s+rule_candidates/i.test(s) && /^SELECT/i.test(s)) {
      return { rows: mem.candidates.map(c => ({ ...c })), rowCount: mem.candidates.length };
    }
    if (/INSERT\s+INTO\s+rule_versions/i.test(s)) {
      const rv = {
        id: mem.rule_versions.length + 1,
        rule_id: params[0],
        version: params[1],
        expression: JSON.parse(params[2]),
        changed_by: params[3],
        change_reason: params[4],
        changed_at: new Date().toISOString(),
      };
      mem.rule_versions.push(rv);
      return { rows: [rv], rowCount: 1 };
    }
    if (/FROM\s+rule_versions/i.test(s)) {
      return { rows: mem.rule_versions, rowCount: mem.rule_versions.length };
    }
    if (/SELECT\s+\*\s+FROM\s+qcvns\s+WHERE\s+id\s*=\s*\$1/i.test(s)) {
      const found = mem.qcvns.find(q => q.id === params[0]);
      return { rows: found ? [{ ...found }] : [], rowCount: found ? 1 : 0 };
    }
    if (/FROM\s+qcvns/i.test(s) && /^SELECT/i.test(s)) {
      return { rows: mem.qcvns.map(q => ({ ...q })), rowCount: mem.qcvns.length };
    }
    if (/UPDATE\s+qcvns/i.test(s)) {
      const qId = params[params.length - 1];
      const idx = mem.qcvns.findIndex(q => q.id === qId);
      if (idx === -1) return { rows: [], rowCount: 0 };
      mem.qcvns[idx] = {
        ...mem.qcvns[idx],
        ten: params[0],
        ap_dung: params[1],
        tham_so: JSON.parse(params[2]),
        standard_code: params[3],
        standard_version: params[4],
        source_type: params[5],
        column_code: params[6],
        flow_range: params[7],
        effective_from: params[8],
        effective_to: params[9],
        source_document: params[10],
        verification_status: params[11],
        publication_status: params[12],
        rule_version: params[13],
        verified_by: params[14],
        verified_at: new Date().toISOString(),
      };
      return { rows: [{ ...mem.qcvns[idx] }], rowCount: 1 };
    }
    if (/FROM\s+industries/i.test(s) && /^SELECT/i.test(s)) {
      return { rows: mem.industries.map(i => ({ ...i })), rowCount: mem.industries.length };
    }
    if (/FROM\s+law_rule_impacts/i.test(s) && /^SELECT/i.test(s)) {
      return { rows: mem.impacts, rowCount: mem.impacts.length };
    }
    if (/INSERT\s+INTO\s+audit_logs/i.test(s)) {
      const log = {
        id: mem.audit_logs.length + 1,
        user_id: params[0],
        action: params[1],
        ip_address: params[2],
        user_agent: params[3],
        payload: typeof params[4] === 'string' ? JSON.parse(params[4]) : params[4],
        created_at: new Date().toISOString(),
      };
      mem.audit_logs.push(log);
      return { rows: [log], rowCount: 1 };
    }
    if (/FROM\s+audit_logs/i.test(s)) {
      return {
        rows: mem.audit_logs.map(l => ({
          ...l,
          actor_username: 'admin_test',
          actor_name: 'Quản trị viên Kiểm thử',
        })),
        rowCount: mem.audit_logs.length,
      };
    }
    return { rows: [], rowCount: 0 };
  };

  try {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/admin/rules', adminRulesRouter);
    app.use('/api/admin', adminRouter);

    const adminToken = createToken({ id: 1, username: 'admin_test', fullName: 'Quản trị viên', role: 'admin' });
    const staffToken = createToken({ id: 2, username: 'staff_test', fullName: 'Chuyên viên', role: 'staff' });

    // Tình huống 11: Tài khoản Nhân viên (staff) không có quyền kiểm duyệt -> bị chặn 403 Forbidden
    const staffRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/moderation-overview',
      token: staffToken,
    });
    assert.equal(staffRes.status, 403, 'Nhân viên thường không được phép truy cập API kiểm duyệt');

    // Tình huống 1: Xem danh sách văn bản chờ kiểm duyệt (cho_duyet)
    const pendingLawsRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/laws?verificationStatus=cho_duyet',
      token: adminToken,
    });
    assert.equal(pendingLawsRes.status, 200);
    assert.equal(pendingLawsRes.data.laws.length, 1);
    assert.equal(pendingLawsRes.data.laws[0].id, 'vb_crawl_moi_2026');
    assert.equal(pendingLawsRes.data.laws[0].verification_status, 'cho_duyet');
    assert.equal(pendingLawsRes.data.laws[0].detection_source, 'crawler');

    // Tình huống 2: Xem chi tiết một văn bản pháp luật
    const lawDetailRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/laws/vb_crawl_moi_2026',
      token: adminToken,
    });
    assert.equal(lawDetailRes.status, 200);
    assert.equal(lawDetailRes.data.law.so, '12/2026/TT-BNNMT');
    assert.equal(lawDetailRes.data.law.dieu_khoang.length, 2);
    assert.ok(lawDetailRes.data.law.link.includes('luatmoitruong.vn'));

    // Tình huống 4: Từ chối văn bản mà không nhập lý do -> bị chặn 400; khi có lý do -> chuyển sang tu_choi
    const rejectLawNoReason = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/laws/vb_crawl_moi_2026/review',
      token: adminToken,
      body: { decision: 'tu_choi', reviewNote: '' },
    });
    assert.equal(rejectLawNoReason.status, 400, 'Phải chặn từ chối văn bản khi thiếu lý do');

    const rejectLawWithReason = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/laws/vb_crawl_moi_2026/review',
      token: adminToken,
      body: { decision: 'tu_choi', reviewNote: 'Văn bản dự thảo chưa có số công báo chính thức' },
    });
    assert.equal(rejectLawWithReason.status, 200);
    assert.equal(rejectLawWithReason.data.law.verification_status, 'tu_choi');
    assert.equal(rejectLawWithReason.data.law.review_note, 'Văn bản dự thảo chưa có số công báo chính thức');

    // Tình huống 3: Phê duyệt một văn bản (da_xac_minh) và bảo đảm quy tắc phân loại không bị tự động thay đổi
    const approveLawRes = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/laws/vb_crawl_moi_2026/review',
      token: adminToken,
      body: { decision: 'da_xac_minh', reviewNote: 'Đã đối chiếu Công báo Chính phủ' },
    });
    assert.equal(approveLawRes.status, 200);
    assert.equal(approveLawRes.data.law.verification_status, 'da_xac_minh');
    assert.equal(mem.thresholds[0].verification_status, 'can_xac_minh_phap_ly', 'Phê duyệt văn bản không tự động thay đổi trạng thái quy tắc phân loại');

    // Tình huống 5: Xem danh sách quy tắc có trạng thái can_xac_minh_phap_ly
    const unverifiedRulesRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/thresholds?status=can_xac_minh_phap_ly',
      token: adminToken,
    });
    assert.equal(unverifiedRulesRes.status, 200);
    assert.equal(unverifiedRulesRes.data.thresholds.length, 1);
    assert.equal(unverifiedRulesRes.data.thresholds[0].id, 201);
    assert.equal(unverifiedRulesRes.data.thresholds[0].verification_status_vi, 'can_xac_minh_phap_ly');

    // Tình huống 6: Tạo đề xuất thay đổi quy tắc phân loại (lưu vào de_xuat_quy_tac với trạng thái cho_duyet mà không làm mất quy tắc cũ)
    const proposalRes = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/proposals',
      token: adminToken,
      body: {
        targetType: 'nguong_phan_loai',
        targetId: 201,
        targetCode: 'che_bien_go',
        reason: 'Đề xuất điều chỉnh ngưỡng công suất theo Phụ lục III mới',
        proposedData: {
          min_value: 120000,
          project_group: 'Nhóm I',
          legal_doc_required: 'DTM',
          tq: 'cap_bo',
          legal_ref: 'Phụ lục III VBHN 49/2026',
          effective_from: '2026-01-15',
        },
      },
    });
    assert.equal(proposalRes.status, 201);
    assert.equal(proposalRes.data.proposal.status, 'cho_duyet');
    assert.equal(mem.thresholds[0].min_value, 100000, 'Quy tắc hiện tại không bị ghi đè khi mới tạo đề xuất');

    // Tình huống 8: Từ chối hoặc yêu cầu bổ sung thông tin (can_bo_sung) cho quy tắc phân loại (bắt buộc có lý do)
    const needInfoRuleNoReason = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/thresholds/201/review',
      token: adminToken,
      body: { decision: 'can_bo_sung', reviewNote: '' },
    });
    assert.equal(needInfoRuleNoReason.status, 400);

    const needInfoRuleOk = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/thresholds/201/review',
      token: adminToken,
      body: { decision: 'can_bo_sung', reviewNote: 'Cần bổ sung trích dẫn mục cụ thể trong Phụ lục III' },
    });
    assert.equal(needInfoRuleOk.status, 200);
    assert.equal(needInfoRuleOk.data.rule.verification_status, 'can_bo_sung');

    // Tình huống 7: Phê duyệt quy tắc phân loại (bắt buộc căn cứ pháp lý & ngày hiệu lực) và lưu lịch sử phiên bản
    const approveRuleMissingRef = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/thresholds/201/review',
      token: adminToken,
      body: { decision: 'da_xac_minh', legalRef: '', effectiveFrom: '' },
    });
    assert.equal(approveRuleMissingRef.status, 400);

    const approveRuleOk = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/thresholds/201/review',
      token: adminToken,
      body: {
        decision: 'da_xac_minh',
        legalRef: 'Phụ lục III Mục 12 Nghị định 08/2022/NĐ-CP (49/VBHN-BNNMT)',
        effectiveFrom: '2025-02-01',
        reviewNote: 'Đã đối chiếu khớp hoàn toàn với Phụ lục III',
      },
    });
    assert.equal(approveRuleOk.status, 200);
    assert.equal(approveRuleOk.data.rule.verification_status, 'da_xac_minh');
    assert.ok(mem.rule_versions.length >= 2, 'Bảng phien_ban_quy_tac (rule_versions) phải lưu đầy đủ các phiên bản trước và sau kiểm duyệt');

    // Tình huống 9: Xem chi tiết một QCVN và danh sách đầy đủ thông số môi trường (tham_so) của QCVN đó
    const qcvnDetailRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/qcvns/qcvn40_2025_b_f2',
      token: adminToken,
    });
    assert.equal(qcvnDetailRes.status, 200);
    assert.equal(qcvnDetailRes.data.qcvn.id, 'qcvn40_2025_b_f2');
    assert.equal(qcvnDetailRes.data.qcvn.tham_so.length, 4);
    assert.equal(qcvnDetailRes.data.qcvn.tham_so[0].key, 'pH');
    assert.equal(qcvnDetailRes.data.qcvn.tham_so[2].key, 'COD');
    assert.equal(qcvnDetailRes.data.qcvn.tham_so[2].gioi_han, 150);

    // Tình huống 10: Phê duyệt hoặc từ chối một bản ghi QCVN
    const rejectQcvnNoReason = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/qcvns/qcvn40_2025_b_f2/review',
      token: adminToken,
      body: { decision: 'tu_choi', reviewNote: '' },
    });
    assert.equal(rejectQcvnNoReason.status, 400);

    const approveQcvnNoSource = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/qcvns/qcvn40_2025_b_f2/review',
      token: adminToken,
      body: { decision: 'da_xac_minh', sourceDocument: '' },
    });
    assert.equal(approveQcvnNoSource.status, 400);

    const approveQcvnOk = await requestApp(app, {
      method: 'POST',
      path: '/api/admin/rules/qcvns/qcvn40_2025_b_f2/review',
      token: adminToken,
      body: {
        decision: 'da_xac_minh',
        sourceDocument: 'Thông tư 05/2025/TT-BTNMT ban hành QCVN 40:2025/BTNMT',
        effectiveFrom: '2025-09-01',
        reviewNote: 'Đã kiểm tra đầy đủ 4 thông số nước thải công nghiệp Cột B',
      },
    });
    assert.equal(approveQcvnOk.status, 200);
    assert.equal(approveQcvnOk.data.qcvn.verification_status, 'da_xac_minh');

    // Tình huống 12: Kiểm tra Nhật ký kiểm toán (audit_logs) ghi nhận đúng người thực hiện, hành động, trước/sau và lý do
    assert.ok(mem.audit_logs.length >= 5, 'Mọi thao tác kiểm duyệt phải được ghi vào audit_logs');
    const auditRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/audit-logs?scope=legal',
      token: adminToken,
    });
    assert.equal(auditRes.status, 200);
    assert.ok(auditRes.data.logs.length >= 5);
    const hasQcvnReviewLog = auditRes.data.logs.some(
      l => l.action === 'REVIEW_QCVN_CATALOG' && l.details?.decision === 'da_xac_minh' && l.details?.before && l.details?.after
    );
    assert.equal(hasQcvnReviewLog, true, 'Audit log phải chứa đầy đủ trạng thái before/after và quyết định da_xac_minh');

    // Tình huống bổ sung Redesign: Lưu Checklist thật vào DB & Kiểm tra Tổng quan 3 nhóm + Lịch sử kiểm duyệt + RBAC staff
    const staffChecklistRes = await requestApp(app, {
      method: 'PUT',
      path: '/api/admin/rules/checklist',
      token: staffToken,
      body: { targetType: 'law', targetId: 'vb_crawl_moi_2026', checklist: { nguon_chinh_thuc: true } },
    });
    assert.equal(staffChecklistRes.status, 403, 'Nhân viên không được lưu checklist kiểm duyệt');

    const saveChecklistRes = await requestApp(app, {
      method: 'PUT',
      path: '/api/admin/rules/checklist',
      token: adminToken,
      body: {
        targetType: 'law',
        targetId: 'vb_crawl_moi_2026',
        checklist: { nguon_chinh_thuc: true, so_hieu_ten: true },
      },
    });
    assert.equal(saveChecklistRes.status, 200);
    assert.equal(saveChecklistRes.data.review_checklist.items.nguon_chinh_thuc, true);
    assert.equal(saveChecklistRes.data.review_checklist.items.so_hieu_ten, true);

    const overviewRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/moderation-overview',
      token: adminToken,
    });
    assert.equal(overviewRes.status, 200);
    assert.ok(overviewRes.data.stats.pending);
    assert.ok(overviewRes.data.stats.approved);
    assert.ok(overviewRes.data.stats.rejected);
    assert.equal(
      overviewRes.data.queueItems.every(i => ['cho_duyet', 'can_xac_minh_phap_ly', 'can_bo_sung'].includes(i.trang_thai)),
      true,
      'Hàng đợi queueItems không được trộn lẫn bản ghi đã phê duyệt hoặc đã từ chối'
    );

    const historyRes = await requestApp(app, {
      method: 'GET',
      path: '/api/admin/rules/moderation-history?status=da_xac_minh',
      token: adminToken,
    });
    assert.equal(historyRes.status, 200);
    assert.ok(historyRes.data.items.length >= 2, 'Lịch sử kiểm duyệt phải trả về các bản ghi đã phê duyệt');
  } finally {
    db.query = originalQuery;
    db.pool = originalPool;
  }
});
