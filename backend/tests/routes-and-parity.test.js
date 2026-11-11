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
});
