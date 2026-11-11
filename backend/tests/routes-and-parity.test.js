const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const db = require('../config/db');
const { IND_DB, INDUSTRY_META } = require('../services/classification-service');
const { QCVN_DATA } = require('../../frontend/src/data/qcvn-db.js');
const {
  seedClassificationCatalog,
  seedQcvnCatalog,
} = require('../services/rule-repository');

function createExpressMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(k, v) {
      this.headers[k] = v;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function getRouteHandler(router, method, routePath) {
  const layer = router.stack.find(
    l => l.route && l.route.path === routePath && l.route.methods[method.toLowerCase()]
  );
  assert.ok(layer, `Route ${method.toUpperCase()} ${routePath} khong ton tai`);
  const stack = layer.route.stack;
  return stack[stack.length - 1].handle;
}

test('Server-Authoritative Routes: POST /api/projects, POST /api/qcvns/samples, GET /api/qcvns, GET /api/dashboard/stats', async () => {
  const originalQuery = db.query.bind(db);

  // Tao DB gia lap cho ca industries, classification_thresholds, qcvns, projects, qcvn_samples, dashboard
  const mem = {
    laws: [{ id: 'luat_bvmt_2020' }, { id: 'nd_08_2022' }],
    industries: [],
    legal_appendices: [],
    classification_thresholds: [],
    qcvns: [],
    projects: [],
    qcvn_samples: [],
    audit_logs: [],
    query_logs: [],
    failQcvnSelect: false,
  };

  // Seed in-memory tables thong qua dung helper cua du an
  const memQuery = async (sql, params = []) => {
    const q = sql.trim().replace(/\s+/g, ' ');
    if (/^ALTER TABLE/i.test(q)) return { rows: [], rowCount: 0 };
    if (q.startsWith('SELECT id FROM laws')) return { rows: mem.laws, rowCount: mem.laws.length };
    if (q.startsWith('SELECT code, display_name, verification_status, publication_status FROM industries WHERE code = $1')) {
      const rows = mem.industries.filter(r => r.code === params[0]);
      return { rows, rowCount: rows.length };
    }
    if (q.startsWith('INSERT INTO industries')) {
      mem.industries.push({
        code: params[0], name: params[1], risk_level: params[2], display_name: params[3],
        capacity_label: params[4], unit: params[5], note: params[6], audit_note: params[7],
        process_stages_meta: params[8], verification_status: params[9], publication_status: 'PUBLISHED', rule_version: params[10],
      });
      return { rows: [], rowCount: 1 };
    }
    if (q.includes('FROM classification_thresholds WHERE industry_code = $1')) {
      return { rows: mem.classification_thresholds.filter(r => r.industry_code === params[0] && (r.process_stage || '') === (params[1] || '')), rowCount: 0 };
    }
    if (q.startsWith('INSERT INTO legal_appendices')) {
      mem.legal_appendices.push({ id: params[0] });
      return { rows: [], rowCount: 1 };
    }
    if (q.startsWith('INSERT INTO classification_thresholds')) {
      mem.classification_thresholds.push({
        id: mem.classification_thresholds.length + 1,
        industry_code: params[0], process_stage: params[1], min_value: params[2], max_value: params[3],
        operator: params[4], unit: params[5], capacity_scale: params[6], project_group: params[7],
        legal_doc_required: params[8], tq: params[9], historical_tq: params[10], phu_luc: params[11],
        legal_ref: params[12], law_id: params[13], effective_from: params[14], effective_to: params[15],
        verification_status: params[16], publication_status: 'PUBLISHED', tier_order: params[17],
        rule_version: params[18], source_ref: params[19], appendix_id: params[20],
      });
      return { rows: [], rowCount: 1 };
    }
    if (q.includes('FROM industries ORDER BY code')) return { rows: mem.industries, rowCount: mem.industries.length };
    if (q.includes('FROM classification_thresholds ORDER BY')) return { rows: mem.classification_thresholds, rowCount: mem.classification_thresholds.length };
    if (q.startsWith('SELECT id, standard_code, verification_status, publication_status, verified_by FROM qcvns WHERE id = $1')) {
      const rows = mem.qcvns.filter(r => r.id === params[0]);
      return { rows, rowCount: rows.length };
    }
    if (q.startsWith('INSERT INTO qcvns')) {
      mem.qcvns.push({
        id: params[0], ten: params[1], ap_dung: params[2], tham_so: JSON.parse(params[3]),
        standard_code: params[4], standard_version: params[5], status: params[6], source_type: params[7],
        column_code: params[8], flow_range: params[9], effective_from: params[10], effective_to: params[11],
        mandatory_for_all_from: params[12], replaces: null, transition_rules: null,
        verification_status: params[15], publication_status: 'PUBLISHED', source_document: params[16], rule_version: params[17],
      });
      return { rows: [], rowCount: 1 };
    }
    if (q.includes('FROM qcvns ORDER BY id')) {
      if (mem.failQcvnSelect) throw new Error('QCVN_DB_OFFLINE');
      return { rows: mem.qcvns, rowCount: mem.qcvns.length };
    }
    if (q.startsWith('INSERT INTO projects')) {
      const proj = {
        id: mem.projects.length + 1,
        user_id: params[0],
        name: params[1],
        form_data: JSON.parse(params[2]),
        checklist_state: JSON.parse(params[3]),
        classification_result: JSON.parse(params[9]),
        created_at: new Date().toISOString(),
      };
      mem.projects.push(proj);
      return { rows: [proj], rowCount: 1 };
    }
    if (q.startsWith('INSERT INTO qcvn_samples')) {
      const sample = {
        id: mem.qcvn_samples.length + 1,
        user_id: params[0],
        name: params[1],
        type: params[2],
        sub_type: params[3],
        values: JSON.parse(params[4]),
        project_id: params[5],
        trang_thai_tong_quat: params[6],
        overall_status: params[7],
        evaluation_details: JSON.parse(params[8]),
        evaluated_rule_version: params[9],
        evaluated_verification_status: params[10],
        created_at: new Date().toISOString(),
      };
      mem.qcvn_samples.push(sample);
      return { rows: [sample], rowCount: 1 };
    }
    if (q.startsWith('INSERT INTO audit_logs') || q.startsWith('INSERT INTO query_logs')) {
      return { rows: [], rowCount: 1 };
    }
    if (q.includes('FROM projects p')) {
      return { rows: mem.projects, rowCount: mem.projects.length };
    }
    if (q.includes('FROM qcvn_samples s')) {
      return { rows: mem.qcvn_samples, rowCount: mem.qcvn_samples.length };
    }
    if (q.includes('FROM laws GROUP BY')) {
      return { rows: [{ status: 'valid', count: 2 }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  };

  await seedClassificationCatalog({ query: memQuery }, { indDb: IND_DB, industryMeta: INDUSTRY_META });
  await seedQcvnCatalog({ query: memQuery }, { qcvnData: QCVN_DATA });

  db.query = memQuery;
  try {
    const projectsRouter = require('../routes/projects');
    const qcvnsRouter = require('../routes/qcvns');
    const dashboardRouter = require('../routes/dashboard');

    // 1. POST /api/projects phai bo qua req.body.classification_result gia mao
    const createProjectHandler = getRouteHandler(projectsRouter, 'post', '/');
    const projRes = createExpressMockRes();
    await createProjectHandler({
      user: { id: 1, role: 'user' },
      headers: {},
      ip: '127.0.0.1',
      body: {
        name: 'Du an Thep luyen kim',
        form_data: { nganh: 'thep', processStage: 'ore_smelting', capacity: 300000, tinh: 'Quang Ngai' },
        classification_result: {
          hs: 'DKMT',
          nhom: 'Nhóm IV',
          tq: 'cap_xa',
          verificationStatus: 'VERIFIED',
          isOfficialConclusion: true,
        },
      },
    }, projRes);

    const savedClass = projRes.body.project.classification_result;
    assert.equal(savedClass.hs, 'DTM');
    assert.equal(savedClass.nhom, 'Nhóm I');
    assert.equal(savedClass.isOfficialConclusion, false);
    assert.equal(savedClass.conclusionStatus, 'NEEDS_LEGAL_VERIFICATION');

    // 2. GET /api/qcvns giu nguyen metadata va bao loi 503 + FALLBACK_UNVERIFIED khi DB loi
    const getQcvnsHandler = getRouteHandler(qcvnsRouter, 'get', '/');
    const qGetOk = createExpressMockRes();
    await getQcvnsHandler({}, qGetOk);
    assert.equal(qGetOk.statusCode, 200);
    assert.equal(qGetOk.headers['X-Rule-Source'], 'DATABASE');
    assert.equal(qGetOk.body.qcvn40_a_low.status, 'current');
    assert.equal(qGetOk.body.qcvn40_a_low.mandatoryForAllFrom, '2032-01-01');
    assert.equal(qGetOk.body.qcvn40_a_low.verificationStatus, 'NEEDS_LEGAL_VERIFICATION');

    mem.failQcvnSelect = true;
    const qGetFail = createExpressMockRes();
    await getQcvnsHandler({}, qGetFail);
    assert.equal(qGetFail.statusCode, 503);
    assert.equal(qGetFail.body.ruleSource, 'FALLBACK_UNVERIFIED');
    mem.failQcvnSelect = false;

    // 3. POST /api/qcvns/samples khong tin trang_thai_tong_quat: 'dat' tu client
    const saveSampleHandler = getRouteHandler(qcvnsRouter, 'post', '/samples');
    const sRes1 = createExpressMockRes();
    await saveSampleHandler({
      user: { id: 1 },
      headers: {},
      ip: '127.0.0.1',
      body: {
        name: 'Mau thieu chi tieu',
        type: 'nuoc_thai_cn',
        sub_type: 'qcvn40_a_low',
        values: { pH: 7.0 },
        receivingWaterConfirmed: true,
        trang_thai_tong_quat: 'dat',
      },
    }, sRes1);
    assert.equal(sRes1.body.sample.trang_thai_tong_quat, 'chua_du_thong_so');
    assert.equal(sRes1.body.evaluation.overallStatus, 'INCOMPLETE');

    const sRes2 = createExpressMockRes();
    await saveSampleHandler({
      user: { id: 1 },
      headers: {},
      ip: '127.0.0.1',
      body: {
        name: 'Mau chua xac nhan nguon tiep nhan',
        type: 'nuoc_thai_cn',
        sub_type: 'qcvn40_a_low',
        values: { pH: 7.0 },
        trang_thai_tong_quat: 'dat',
      },
    }, sRes2);
    assert.equal(sRes2.body.sample.trang_thai_tong_quat, 'can_ra_soat');

    // 4. Dashboard: chua_du_thong_so & can_ra_soat KHONG duoc tinh vao passSamples / dat / complianceRate
    const statsHandler = getRouteHandler(dashboardRouter, 'get', '/stats');
    const dashRes = createExpressMockRes();
    await statsHandler({ user: { id: 1, role: 'admin' }, query: {} }, dashRes);
    assert.equal(dashRes.body.kpis.totalSamples, 2);
    assert.equal(dashRes.body.kpis.passSamples, 0);
    assert.equal(dashRes.body.kpis.incompleteSamples, 1);
    assert.equal(dashRes.body.kpis.reviewSamples, 1);
    assert.equal(dashRes.body.kpis.complianceRate, 0);
  } finally {
    db.query = originalQuery;
  }
});

test('Parity UI - Backend - Seed: loai bo fallback 100/F2, loai option chet, sua MAP_KEYWORDS & khong TRUNCATE', () => {
  const classifyVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/ClassifyTab.vue'), 'utf8');
  const qcvnVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/QCVNTab.vue'), 'utf8');
  const initDbJs = fs.readFileSync(path.join(__dirname, '../init-db.js'), 'utf8');

  assert.ok(!classifyVue.includes('<option value="dien_hat_nhan">'), 'Khong con option chet dien_hat_nhan');
  assert.ok(!classifyVue.includes('<option value="cang_song">'), 'Khong con option chet cang_song');
  assert.ok(!classifyVue.includes('<option value="san_bay">'), 'Khong con option lech san_bay');
  assert.ok(classifyVue.includes('processStage'), 'ClassifyTab phai ho tro processStage');
  assert.ok(classifyVue.includes('CLASSIFY_METADATA'), 'ClassifyTab phai nap danh muc tu API metadata');

  assert.ok(!qcvnVue.includes('nt > 0 ? nt : 100'), 'QCVNTab khong duoc gan mac dinh flowRate 100');
  assert.ok(!qcvnVue.includes("{ ...QCVN_DATA, ...dbData }"), 'QCVNTab khong duoc merge nong lam mat metadata DB');
  assert.ok(qcvnVue.includes("'cr': 'Cr_tong'"), 'MAP_KEYWORDS phai anh xa Cr_tong');
  assert.ok(qcvnVue.includes("'sunfua': 'Sulfide'"), 'MAP_KEYWORDS phai anh xa Sulfide');
  assert.ok(!initDbJs.includes('TRUNCATE TABLE'), 'init-db.js khong duoc chay TRUNCATE TABLE');

  // Phase 2-3 Parity checks across MapTab, DashboardTab, ClassifyTab, QCVNTab, AdminTab
  const mapVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/MapTab.vue'), 'utf8');
  const dashboardVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/DashboardTab.vue'), 'utf8');
  const adminVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/AdminTab.vue'), 'utf8');

  assert.ok(!mapVue.includes('value="dat_chuan"'), 'MapTab khong con option dat_chuan sai contract');
  assert.ok(mapVue.includes('value="chua_du_thong_so"'), 'MapTab phai co filter chua_du_thong_so');
  assert.ok(mapVue.includes('value="can_ra_soat"'), 'MapTab phai co filter can_ra_soat');
  assert.ok(mapVue.includes('getQcvnBadgeMeta'), 'MapTab phai dung shared helper getQcvnBadgeMeta');
  assert.ok(mapVue.includes('value="Cần rà soát"'), 'MapTab phai co nhom Cần rà soát');

  assert.ok(dashboardVue.includes("key: 'cap_xa'"), 'DashboardTab phai co cap_xa rieng biet');
  assert.ok(dashboardVue.includes('getDashboardSampleBadge'), 'DashboardTab phai map du 5 trang thai QCVN');
  assert.ok(dashboardVue.includes('needsReviewProjects'), 'DashboardTab phai ho tro needsReviewProjects KPI');

  assert.ok(classifyVue.includes('evaluationDate'), 'ClassifyTab phai co input evaluationDate');
  assert.ok(classifyVue.includes('insideCoreProtectedZone'), 'ClassifyTab phai co khai bao vung nhay cam');
  assert.ok(classifyVue.includes('projectSensitiveVerification'), 'ClassifyTab phai ho tro xac minh Admin phia server');

  assert.ok(!qcvnVue.includes('const industrialNganh ='), 'QCVNTab khong con mang industrialNganh hardcode');
  assert.ok(!qcvnVue.includes('const domesticNganh ='), 'QCVNTab khong con mang domesticNganh hardcode');
  assert.ok(qcvnVue.includes('API.QCVN_SELECT'), 'QCVNTab phai goi POST /api/qcvns/select');
  assert.ok(qcvnVue.includes('API.QCVN_EVALUATE'), 'QCVNTab phai goi POST /api/qcvns/evaluate');

  assert.ok(!adminVue.includes('IND_DB'), 'AdminTab khong duoc phu thuoc IND_DB tinh');
  assert.ok(adminVue.includes('ADMIN_RULES_IMPACTS'), 'AdminTab phai ho tro tab kiem duyet law_rule_impacts');
  assert.ok(adminVue.includes('ADMIN_RULES_CANDIDATES'), 'AdminTab phai ho tro duyet rule_candidates');
  assert.ok(adminVue.includes('ADMIN_RULES_QCVN_TRANSITIONAL'), 'AdminTab phai ho tro nhap QCVN chuyen tiep');
});

test('Phase 2-3 Routes & Crawler Sync: /geo, sensitive-verification, qcvn /select+/evaluate+mismatch+IDOR, dashboard cap_xa & crawler PENDING_REVIEW', async () => {
  const originalQuery = db.query.bind(db);
  const { seedClassificationCatalog, seedQcvnCatalog } = require('../services/rule-repository');
  const { detectImpactedRules, extractRuleCandidatesFromLaw } = require('../services/crawler-sync-service');
  const { requireAdmin } = require('../middleware/auth');

  const mem = {
    industries: [],
    legal_appendices: [],
    classification_thresholds: [],
    qcvns: [],
    gis_layers: [],
    sensitiveVerifications: [
      {
        id: 1,
        project_id: 101,
        declared_flags: { rung: true },
        declared_details: { insideCoreProtectedZone: true },
        verification_status: 'PENDING_VERIFICATION',
        verified_by: null,
        evidence_ref: null,
        verification_note: null,
      },
    ],
    projects: [
      {
        id: 101,
        user_id: 1,
        user_name: 'Chuyen vien A',
        name: 'Du an Go khong hop le',
        form_data: { nganh: 'nganh_khong_ton_tai', capacity: 100, nt: 0, kt: 0, tinh: 'Dong Nai' },
        checklist_state: {},
        latitude: '10.95',
        longitude: '106.85',
        dia_chi_hien_thi: 'Dong Nai',
        quan_huyen: null,
        phuong_xa: 'An Hoa',
        classification_result: null,
      },
      {
        id: 102,
        user_id: 2,
        user_name: 'Chuyen vien B',
        name: 'Nha may Thep B',
        form_data: { nganh: 'thep', processStage: 'rolling_only', capacity: 0.4, nt: 200, kt: 0, tinh: 'Ba Ria - Vung Tau', receivingWaterClass: 'A', receivingWaterConfirmed: true },
        checklist_state: {},
        latitude: '10.50',
        longitude: '107.15',
        dia_chi_hien_thi: 'Ba Ria - Vung Tau',
        quan_huyen: null,
        phuong_xa: null,
        classification_result: { hs: 'DKMT', nhom: 'Nhóm IV', competentAuthority: { authorityLevel: 'cap_xa', label: 'UBND Cấp Xã' }, evaluationDate: '2026-06-01' },
      },
    ],
    qcvn_samples: [
      { id: 1, user_id: 1, project_id: 101, name: 'Mau Thieu', type: 'nuoc_mat', sub_type: 'qcvn08_a', trang_thai_tong_quat: 'chua_du_thong_so', overall_status: 'INCOMPLETE', created_at: new Date().toISOString() },
      { id: 2, user_id: 1, project_id: 102, name: 'Mau Ra Soat', type: 'nuoc_thai_cn', sub_type: 'qcvn40_a_low', trang_thai_tong_quat: 'can_ra_soat', overall_status: 'NEEDS_REVIEW', created_at: new Date().toISOString() },
    ],
    laws: [
      { id: 'nd_08_2022', ten: 'Nghi dinh 08/2022', so: '08/2022/ND-CP', status: 'valid' },
    ],
    law_rule_impacts: [],
    rule_candidates: [],
    audit_logs: [],
    query_logs: [],
    users: [{ id: 1, full_name: 'Admin', role: 'admin', username: 'admin' }],
  };

  const mockDb = {
    async query(sql, params = []) {
      const s = String(sql).replace(/\s+/g, ' ').trim();
      if (/^(CREATE|ALTER)/i.test(s)) return { rows: [], rowCount: 0 };
      if (/INSERT INTO industries/i.test(s)) {
        const obj = { code: params[0], name: params[1], display_name: params[2], unit: params[3], verification_status: 'VERIFIED', publication_status: 'PUBLISHED' };
        mem.industries.push(obj);
        return { rows: [obj], rowCount: 1 };
      }
      if (/FROM industries WHERE code = \$1/i.test(s)) {
        const hits = mem.industries.filter(i => i.code === params[0]);
        return { rows: hits, rowCount: hits.length };
      }
      if (/SELECT \* FROM industries/i.test(s) || /FROM industries ORDER BY/i.test(s)) {
        return { rows: mem.industries, rowCount: mem.industries.length };
      }
      if (/INSERT INTO legal_appendices/i.test(s)) return { rows: [], rowCount: 0 };
      if (/SELECT code, appendix_code/i.test(s) || /SELECT \* FROM legal_appendices/i.test(s)) {
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO classification_thresholds/i.test(s)) {
        const obj = {
          id: mem.classification_thresholds.length + 1,
          industry_code: params[0],
          process_stage: params[1],
          min_value: params[2],
          max_value: params[3],
          operator: params[4],
          unit: params[5],
          capacity_scale: params[6],
          project_group: params[7],
          legal_doc_required: params[8],
          tq: params[9],
          historical_tq: params[10],
          phu_luc: params[11],
          legal_ref: params[12],
          law_id: params[13],
          effective_from: params[14],
          effective_to: params[15],
          verification_status: 'VERIFIED',
          publication_status: 'PUBLISHED',
          tier_order: params[18] ?? 0,
          rule_version: params[19],
        };
        mem.classification_thresholds.push(obj);
        return { rows: [obj], rowCount: 1 };
      }
      if (/SELECT id, industry_code, process_stage, verification_status/i.test(s)) {
        return { rows: [], rowCount: 0 };
      }
      if (/FROM classification_thresholds/i.test(s)) {
        if (/law_id = \$1/i.test(s)) {
          const hits = mem.classification_thresholds.filter(t => t.law_id === params[0]);
          return { rows: hits, rowCount: hits.length };
        }
        return { rows: mem.classification_thresholds, rowCount: mem.classification_thresholds.length };
      }
      if (/INSERT INTO qcvns/i.test(s)) {
        const obj = {
          id: params[0],
          ten: params[1],
          ap_dung: params[2],
          tham_so: JSON.parse(params[3]),
          standard_code: params[4],
          standard_version: params[5],
          status: params[6],
          source_type: params[7],
          column_code: params[8],
          flow_range: params[9],
          effective_from: params[10],
          effective_to: params[11],
          mandatory_for_all_from: params[12],
          verification_status: 'VERIFIED',
          publication_status: 'PUBLISHED',
          rule_version: params[17] || '2026.2',
        };
        mem.qcvns.push(obj);
        return { rows: [obj], rowCount: 1 };
      }
      if (/FROM qcvns WHERE id = \$1/i.test(s)) {
        const hits = mem.qcvns.filter(q => q.id === params[0]);
        return { rows: hits, rowCount: hits.length };
      }
      if (/FROM qcvns/i.test(s)) {
        return { rows: mem.qcvns, rowCount: mem.qcvns.length };
      }
      if (/FROM gis_layers/i.test(s)) {
        return { rows: mem.gis_layers, rowCount: mem.gis_layers.length };
      }
      if (/FROM project_sensitive_verifications WHERE project_id = \$1/i.test(s)) {
        const v = mem.sensitiveVerifications.find(x => x.project_id === Number(params[0]));
        return { rows: v ? [v] : [], rowCount: v ? 1 : 0 };
      }
      if (/UPDATE project_sensitive_verifications/i.test(s)) {
        const v = mem.sensitiveVerifications[0];
        v.verification_status = params[0];
        v.verified_by = params[1];
        v.evidence_ref = params[2];
        v.verification_note = params[3];
        return { rows: [v], rowCount: 1 };
      }
      if (/INSERT INTO project_sensitive_verifications/i.test(s)) {
        const v = {
          id: mem.sensitiveVerifications.length + 1,
          project_id: Number(params[0]),
          verification_status: params[4],
          verified_by: params[5],
          evidence_ref: params[7],
          verification_note: params[8],
        };
        mem.sensitiveVerifications.push(v);
        return { rows: [v], rowCount: 1 };
      }
      if (/SELECT .+ FROM projects WHERE id = \$1/i.test(s)) {
        const p = mem.projects.find(x => x.id === Number(params[0]));
        return { rows: p ? [p] : [], rowCount: p ? 1 : 0 };
      }
      if (/UPDATE projects SET classification_result = \$1 WHERE id = \$2/i.test(s)) {
        const p = mem.projects.find(x => x.id === Number(params[1]));
        if (p) p.classification_result = JSON.parse(params[0]);
        return { rows: p ? [p] : [], rowCount: p ? 1 : 0 };
      }
      if (/FROM projects p/i.test(s)) {
        return {
          rows: mem.projects.map(p => ({ ...p, ten_du_an: p.name, quan_trac_gan_nhat_ngay: null, quan_trac_gan_nhat_trang_thai: 'chua_du_thong_so' })),
          rowCount: mem.projects.length,
        };
      }
      if (/SELECT \* FROM projects/i.test(s)) {
        return { rows: mem.projects, rowCount: mem.projects.length };
      }
      if (/FROM qcvn_samples s/i.test(s)) {
        return { rows: mem.qcvn_samples, rowCount: mem.qcvn_samples.length };
      }
      if (/SELECT \* FROM qcvn_samples/i.test(s)) {
        return { rows: mem.qcvn_samples, rowCount: mem.qcvn_samples.length };
      }
      if (/INSERT INTO qcvn_samples/i.test(s)) {
        const obj = { id: 99, name: params[1], type: params[2], sub_type: params[3], trang_thai_tong_quat: params[6], overall_status: params[7] };
        return { rows: [obj], rowCount: 1 };
      }
      if (/SELECT COUNT\(\*\) AS total/i.test(s) && /FROM laws/i.test(s)) {
        return { rows: [{ total: 1, valid_count: 1, amended_count: 0 }], rowCount: 1 };
      }
      if (/FROM users WHERE role/i.test(s)) {
        return { rows: mem.users, rowCount: mem.users.length };
      }
      if (/FROM law_rule_impacts/i.test(s) && /SELECT/i.test(s)) {
        return { rows: mem.law_rule_impacts.filter(i => i.law_id === params[0]), rowCount: mem.law_rule_impacts.length };
      }
      if (/INSERT INTO law_rule_impacts/i.test(s)) {
        const row = { id: mem.law_rule_impacts.length + 1, law_id: params[0], event_action: params[2], target_type: params[3], target_id: params[4], status: 'OPEN' };
        mem.law_rule_impacts.push(row);
        return { rows: [row], rowCount: 1 };
      }
      if (/FROM rule_candidates/i.test(s) && /SELECT/i.test(s)) {
        return { rows: mem.rule_candidates.filter(c => c.law_id === params[0]), rowCount: mem.rule_candidates.length };
      }
      if (/INSERT INTO rule_candidates/i.test(s)) {
        const row = { id: mem.rule_candidates.length + 1, law_id: params[0], target_type: params[2], target_code: params[3], status: 'PENDING_REVIEW' };
        mem.rule_candidates.push(row);
        return { rows: [row], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  };

  await seedClassificationCatalog(mockDb, { indDb: IND_DB, industryMeta: INDUSTRY_META });
  await seedQcvnCatalog(mockDb, { qcvnData: QCVN_DATA });

  db.query = mockDb.query;
  try {
    const projectsRouter = require('../routes/projects');
    const qcvnsRouter = require('../routes/qcvns');
    const dashboardRouter = require('../routes/dashboard');

    // 1. GET /api/projects/geo must not crash and must return 'Cần rà soát' for invalid nganh (no 'Nhóm II' fallback)
    const geoHandler = getRouteHandler(projectsRouter, 'get', '/geo');
    const geoRes = createExpressMockRes();
    await geoHandler({ user: { id: 1, role: 'admin' } }, geoRes);
    assert.equal(geoRes.statusCode, 200);
    assert.ok(Array.isArray(geoRes.body));
    const badProj = geoRes.body.find(p => p.id === 101);
    assert.equal(badProj.nhom_du_an, 'Cần rà soát');

    // 2. Sensitive verification route requires Admin (non-admin blocked) and succeeds for Admin
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET, COOKIE_NAME } = require('../utils/constants');
    const staffToken = jwt.sign({ id: 2, role: 'staff', username: 'staff' }, JWT_SECRET);
    const nonAdminRes = createExpressMockRes();
    let passedNext = false;
    requireAdmin({ cookies: { [COOKIE_NAME]: staffToken }, headers: {} }, nonAdminRes, () => { passedNext = true; });
    assert.equal(passedNext, false);
    assert.equal(nonAdminRes.statusCode, 403);

    const sensHandler = getRouteHandler(projectsRouter, 'put', '/:id/sensitive-verification');
    const sensRes = createExpressMockRes();
    await sensHandler(
      {
        headers: {},
        socket: {},
        user: { id: 1, role: 'admin', username: 'admin' },
        params: { id: '101' },
        body: { verification_status: 'VERIFIED', evidence_ref: 'QĐ-123', verification_note: 'Ok' },
      },
      sensRes
    );
    assert.equal(sensRes.statusCode, 200);
    assert.equal(sensRes.body.sensitiveVerification.verification_status, 'VERIFIED');

    // 3. POST /api/qcvns/select & POST /api/qcvns/evaluate & mismatch gate
    const selectHandler = getRouteHandler(qcvnsRouter, 'post', '/select');
    const selRes = createExpressMockRes();
    await selectHandler(
      { headers: {}, body: { nganh: 'thep', receivingWaterClass: 'A', receivingWaterConfirmed: true, flowRate: 200, isExistingFacility: false } },
      selRes
    );
    assert.equal(selRes.statusCode, 200);
    assert.equal(selRes.body.qcvnId, 'qcvn40_a_low');

    const evalHandler = getRouteHandler(qcvnsRouter, 'post', '/evaluate');
    const mismatchRes = createExpressMockRes();
    await evalHandler(
      {
        headers: {},
        body: {
          sub_type: 'qcvn08_a', // Mismatch vs server selection qcvn40_a_low for 'thep'
          nganh: 'thep',
          receivingWaterClass: 'A',
          receivingWaterConfirmed: true,
          flowRate: 200,
          isExistingFacility: false,
          values: { pH: 7.2, COD: 20 },
        },
      },
      mismatchRes
    );
    assert.equal(mismatchRes.statusCode, 200);
    assert.equal(mismatchRes.body.evaluation.reason, 'QCVN_SELECTION_MISMATCH');
    assert.equal(mismatchRes.body.evaluation.trang_thai_tong_quat, 'can_ra_soat');

    // 4. POST /api/qcvns/samples blocks IDOR project_id for non-owner staff
    const postSampleHandler = getRouteHandler(qcvnsRouter, 'post', '/samples');
    const idorRes = createExpressMockRes();
    await postSampleHandler(
      {
        user: { id: 99, role: 'staff' },
        body: { name: 'Mau IDOR', type: 'nuoc_thai_cn', sub_type: 'qcvn40_a_low', project_id: 102, values: { pH: 7 } },
      },
      idorRes
    );
    assert.equal(idorRes.statusCode, 403);

    // 5. GET /api/dashboard/stats includes cap_xa, needsReviewProjects & does not count chua_du_thong_so/can_ra_soat into passSamples
    const dashHandler = getRouteHandler(dashboardRouter, 'get', '/stats');
    const dashRes = createExpressMockRes();
    await dashHandler({ user: { id: 1, role: 'admin' }, query: {} }, dashRes);
    assert.equal(dashRes.statusCode, 200);
    assert.equal(dashRes.body.kpis.passSamples, 0);
    assert.equal(dashRes.body.kpis.incompleteSamples, 1);
    assert.equal(dashRes.body.kpis.needsReviewSamples, 1);
    assert.equal(dashRes.body.kpis.needsReviewProjects >= 1, true);
    assert.equal(typeof dashRes.body.distributions.byAuthority.cap_xa, 'number');

    // 6. Crawler sync service detects impacts & extracts PENDING_REVIEW candidates only
    const impacted = await detectImpactedRules({
      lawId: 'nd_08_2022',
      lawTitle: 'Nghi dinh 08/2022 QCVN 40:2025',
      so: '08/2022/ND-CP',
      eventAction: 'AUTO_CRAWL_UPDATE',
    }, { db: mockDb });
    assert.ok(impacted.length >= 1);
    assert.equal(impacted[0].status, 'OPEN');

    const extracted = await extractRuleCandidatesFromLaw({
      id: 'tt_99_2026',
      ten: 'Thong tu ban hanh QCVN 40:2025',
      so: '99/2026/TT-BTNMT',
      dieu_khoang: [{ tieu_de: 'Dieu 1', noi_dung: 'Ap dung Phu luc III va QCVN 40:2025/BTNMT' }],
    }, { db: mockDb });
    assert.ok(extracted.length >= 1);
    assert.ok(extracted.every(c => c.status === 'PENDING_REVIEW'));
  } finally {
    db.query = originalQuery;
  }
});

test('UX Simplification & Vietnamese Localization Parity + DB Bootstrap Export', async () => {
  const { pathToFileURL } = require('url');
  const labels = await import(pathToFileURL(path.join(__dirname, '../../frontend/src/utils/legalLabels.js')).href);
  const { evaluateClassification } = require('../services/classification-service');
  const { ensureRuntimeDatabaseReady } = require('../services/db-bootstrap');
  const serverJs = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const classifyVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/ClassifyTab.vue'), 'utf8');
  const qcvnVue = fs.readFileSync(path.join(__dirname, '../../frontend/src/components/QCVNTab.vue'), 'utf8');

  // 1. Server startup invokes non-destructive DB schema readiness
  assert.equal(typeof ensureRuntimeDatabaseReady, 'function');
  assert.ok(serverJs.includes('ensureRuntimeDatabaseReady'), 'server.js phai goi ensureRuntimeDatabaseReady luc khoi dong');

  // 2. Vietnamese label mappings & internal audit text sanitization
  assert.equal(labels.getSensitiveStatusLabel('NOT_REQUIRED'), 'Không yêu cầu xác minh');
  assert.equal(labels.getRuleSourceLabel('DATABASE'), 'Dữ liệu quy chuẩn hệ thống');
  assert.equal(labels.getQcvnOverallStatusMeta('PASS_WITH_WARNING').tone, 'warn');
  const sanitized = labels.formatReasonForEndUser('Mục 4.2 README: Gộp nhiều ngành (NEEDS_LEGAL_VERIFICATION)');
  assert.ok(!sanitized.includes('README'));
  assert.ok(!sanitized.includes('NEEDS_LEGAL_VERIFICATION'));
  const sanitizedDbErr = labels.formatReasonForEndUser('column "display_name" does not exist');
  assert.ok(!sanitizedDbErr.includes('display_name'));

  // 3. UI templates avoid exposing raw enum badges & developer notes directly on primary labels
  assert.ok(!classifyVue.includes('(NEEDS_REVIEW)'), 'ClassifyTab khong hien raw (NEEDS_REVIEW)');
  assert.ok(!classifyVue.includes('Xác nhận hợp lệ (VERIFIED)'), 'ClassifyTab nut Admin phai thuan Viet');
  assert.ok(classifyVue.includes('shouldShowAdminSensitivePanel'), 'ClassifyTab an khung Admin khi khong co yeu to nhay cam');
  assert.ok(classifyVue.includes('isFallbackOrIncompleteResult'), 'ClassifyTab khong tu mau thuan CHUA XAC DINH vs GPMT');

  assert.ok(!qcvnVue.includes('(QCVN_SELECTION_MISMATCH)'), 'QCVNTab khong hien raw (QCVN_SELECTION_MISMATCH)');
  assert.ok(!qcvnVue.includes('(INCOMPLETE —'), 'QCVNTab khong hien raw (INCOMPLETE)');
  assert.ok(!qcvnVue.includes('(PERIOD_MISMATCH —'), 'QCVNTab khong hien raw (PERIOD_MISMATCH)');
  assert.ok(!qcvnVue.includes('Catalog: {{'), 'QCVNTab chip catalog phai thuan Viet');

  // 4. Engine output keeps auditNote on definition but strips README prefix from user-facing warnings
  const res = evaluateClassification({ nganh: 'thuc_pham', capacity: 13000, tinh: 'Cần Thơ' }, { ruleSource: 'FALLBACK_UNVERIFIED' });
  assert.equal(res.isOfficialConclusion, false);
  assert.equal(res.hs, null);
  assert.ok(res.unverifiedReasons.every(r => !r.includes('README')));
  assert.ok(res.cauNhom.every(c => !String(c.text || '').includes('README')));
});
