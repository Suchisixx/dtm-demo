const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  ensureClassificationSchema,
  ensureQcvnSchema,
  ensureSensitiveVerificationSchema,
  ensureGisSchema,
  ensureCrawlerSyncSchema,
  seedClassificationCatalog,
  seedQcvnCatalog,
  seedGisLayers,
  loadClassificationCatalog,
  loadQcvnCatalog,
  loadGisLayers,
  upsertProjectSensitiveDeclaration,
  reviewProjectSensitiveVerification,
  listLawRuleImpacts,
  listRuleCandidates,
  approveRuleCandidate,
  upsertTransitionalQcvn,
} = require('../services/rule-repository');

const { QCVN_DATA } = require('../../frontend/src/data/qcvn-db');

const {
  IND_DB,
  INDUSTRY_META,
  evaluateClassificationWithDb,
  evaluateStoredProject,
} = require('../services/classification-service');

const {
  VIETNAM_SENSITIVE_ZONES,
  VIETNAM_INDUSTRIAL_PARKS,
} = require('../services/spatial-gis-service');

const {
  selectQcvnForProjectWithDb,
} = require('../services/qcvn-service');

const {
  detectImpactedRules,
  extractRuleCandidatesFromLaw,
} = require('../services/crawler-sync-service');

const TEST_DB_NAME = process.env.PGDATABASE_TEST || 'etc_legalhub_test';
assert.notEqual(TEST_DB_NAME, 'etc_legalhub', 'TUYET DOI KHONG chay test PG truc tiep tren DB etc_legalhub');

function buildPgConfig(database) {
  return {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: String(process.env.PGPASSWORD ?? process.env.DB_PASSWORD ?? 'admin'),
    database,
  };
}

let pgPool = null;
let testUserId = null;

test.before(async () => {
  const adminPool = new Pool(buildPgConfig('postgres'));
  try {
    const existsRes = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [TEST_DB_NAME]
    );
    if (existsRes.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await adminPool.end();
  }

  pgPool = new Pool(buildPgConfig(TEST_DB_NAME));

  // Minimal core tables required by foreign keys and services
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'staff',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS laws (
      id VARCHAR(100) PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      year INTEGER NOT NULL,
      sort_date VARCHAR(20),
      so VARCHAR(100) NOT NULL,
      ten TEXT NOT NULL,
      status VARCHAR(30) NOT NULL,
      hieuluc VARCHAR(50),
      mo_ta TEXT,
      dieu_khoang JSONB DEFAULT '[]'::jsonb,
      note TEXT,
      link TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      form_data JSONB NOT NULL,
      checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      classification_result JSONB,
      latitude DECIMAL(10, 7),
      longitude DECIMAL(10, 7),
      dia_chi_hien_thi TEXT,
      quan_huyen VARCHAR(100),
      phuong_xa VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgPool.query(
    `INSERT INTO laws (id, type, year, so, ten, status)
     VALUES ('luat_bvmt_2020', 'luat', 2020, '72/2020/QH14', 'Luat BVMT 2020', 'valid'),
            ('nd_08_2022', 'nd', 2022, '08/2022/ND-CP', 'Nghi dinh 08/2022/ND-CP', 'valid'),
            ('vbhn_49_2026', 'vbhn', 2026, '49/VBHN-BNNMT', 'VBHN 49/VBHN-BNNMT', 'valid')
     ON CONFLICT (id) DO NOTHING`
  );

  await ensureClassificationSchema(pgPool);
  await ensureQcvnSchema(pgPool);
  await ensureSensitiveVerificationSchema(pgPool);
  await ensureGisSchema(pgPool);
  await ensureCrawlerSyncSchema(pgPool);

  await seedClassificationCatalog(pgPool, { indDb: IND_DB, industryMeta: INDUSTRY_META });
  await seedQcvnCatalog(pgPool, { qcvnData: QCVN_DATA });
  await seedGisLayers(pgPool, {
    sensitiveZones: VIETNAM_SENSITIVE_ZONES,
    industrialParks: VIETNAM_INDUSTRIAL_PARKS,
  });

  const uRes = await pgPool.query(
    `INSERT INTO users (username, full_name, password_hash, role)
     VALUES ('pg_admin_test', 'PG Admin Test', 'hash', 'admin')
     ON CONFLICT (username) DO UPDATE SET role = 'admin'
     RETURNING id`
  );
  testUserId = uRes.rows[0].id;
});

test.after(async () => {
  if (pgPool) {
    await pgPool.end();
  }
  try {
    const defaultDb = require('../config/db');
    if (defaultDb?.pool) {
      await defaultDb.pool.end();
    }
  } catch {
    // ignore cleanup error
  }
});

test('PG Integration: Idempotent seed preserves VERIFIED rows & filters out DRAFT/PENDING_REVIEW/REJECTED', async () => {
  await pgPool.query(
    `UPDATE industries
     SET verification_status = 'VERIFIED',
         publication_status = 'PUBLISHED',
         source_document = 'PG_VERIFIED_TEST',
         verified_by = 'pg_admin_test'
     WHERE code = 'che_bien_go'`
  );
  await pgPool.query(
    `UPDATE classification_thresholds
     SET verification_status = 'VERIFIED',
         publication_status = 'PUBLISHED',
         source_ref = 'PG_VERIFIED_TEST',
         approved_by = 'pg_admin_test'
     WHERE industry_code = 'che_bien_go'`
  );

  // Re-run seed idempotently and assert VERIFIED row was not overwritten
  await seedClassificationCatalog(pgPool, { indDb: IND_DB, industryMeta: INDUSTRY_META });
  const checkInd = await pgPool.query(
    `SELECT verification_status, source_document FROM industries WHERE code = 'che_bien_go'`
  );
  assert.equal(checkInd.rows[0].verification_status, 'VERIFIED');
  assert.equal(checkInd.rows[0].source_document, 'PG_VERIFIED_TEST');

  // Insert DRAFT and PENDING_REVIEW industries and assert loadClassificationCatalog excludes them
  await pgPool.query(
    `INSERT INTO industries (code, name, display_name, unit, verification_status, publication_status)
     VALUES ('pg_draft_ind', 'Draft Ind', 'Draft Ind', 'm3', 'NEEDS_LEGAL_VERIFICATION', 'DRAFT'),
            ('pg_pending_ind', 'Pending Ind', 'Pending Ind', 'm3', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_REVIEW')
     ON CONFLICT (code) DO UPDATE SET publication_status = EXCLUDED.publication_status`
  );

  const loaded = await loadClassificationCatalog({ db: pgPool });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.catalog.pg_draft_ind, undefined);
  assert.equal(loaded.catalog.pg_pending_ind, undefined);
  assert.ok(loaded.catalog.che_bien_go);
  await pgPool.query(`DELETE FROM industries WHERE code IN ('pg_draft_ind', 'pg_pending_ind')`);
});

test('PG Integration: Real DATE effective_from/effective_to comparison & historical authority', async () => {
  await pgPool.query(
    `UPDATE classification_thresholds
     SET effective_from = DATE '2025-01-06'
     WHERE industry_code = 'thuc_pham' AND legal_doc_required = 'DKMT'`
  );

  const histRes = await evaluateClassificationWithDb({
    nganh: 'thuc_pham',
    capacity: 50,
    evaluationDate: '2025-05-01',
  }, { db: pgPool });
  assert.equal(histRes.evaluationDate, '2025-05-01');
  assert.equal(histRes.isHistoricalEvaluation, true);
  assert.equal(histRes.appliedEffectiveFrom, '2025-01-06');
  assert.equal(histRes.tq, 'cap_huyen');

  const curRes = await evaluateClassificationWithDb({
    nganh: 'thuc_pham',
    capacity: 50,
    evaluationDate: '2026-08-01',
  }, { db: pgPool });
  assert.equal(curRes.isHistoricalEvaluation, false);
  assert.equal(curRes.tq, 'cap_xa');

  const noDateRes = await evaluateClassificationWithDb({
    nganh: 'thuc_pham',
    capacity: 50,
    evaluationDate: '2020-01-01',
  }, { db: pgPool });
  assert.equal(noDateRes.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(noDateRes.errorCode, 'NO_ACTIVE_RULE_FOR_DATE');
});

test('PG Integration: DB GIS layers & Server Sensitive Verification lifecycle (escalate + reset on edit)', async () => {
  const gisData = await loadGisLayers({ db: pgPool });
  assert.equal(gisData.ok, true);
  assert.equal(gisData.gisSource, 'DATABASE');
  assert.ok(gisData.sensitiveZones.length > 0);
  assert.ok(gisData.industrialParks.length > 0);

  const projIns = await pgPool.query(
    `INSERT INTO projects (user_id, name, form_data, latitude, longitude)
     VALUES ($1, 'Du an Go Sensitive PG', $2::jsonb, 20.30, 105.65)
     RETURNING *`,
    [
      testUserId,
      JSON.stringify({
        nganh: 'che_bien_go',
        capacity: 60000,
        evaluationDate: '2026-06-01',
        rung: true,
        sensitiveCriteriaVerified: true,
        sensitiveDetails: { insideCoreProtectedZone: true },
      }),
    ]
  );
  const project = projIns.rows[0];

  await upsertProjectSensitiveDeclaration(pgPool, {
    projectId: project.id,
    declaredFlags: { rung: true },
    declaredDetails: { insideCoreProtectedZone: true },
  });

  // Before Admin approval -> cannot escalate to Nhom I officially (base is Nhom II)
  const beforeEval = await evaluateClassificationWithDb(
    { ...project.form_data, latitude: Number(project.latitude), longitude: Number(project.longitude) },
    { db: pgPool, projectId: project.id }
  );
  assert.notEqual(beforeEval.sensitiveVerificationStatus, 'VERIFIED');
  assert.equal(beforeEval.nhom, 'Nhóm II');
  assert.equal(beforeEval.isOfficialConclusion, false);

  // Admin verifies -> evaluateStoredProject & evaluateClassificationWithDb escalate to Nhom I / DTM
  const verifRow = await reviewProjectSensitiveVerification(pgPool, {
    projectId: project.id,
    verificationStatus: 'VERIFIED',
    verifiedBy: testUserId,
    evidenceRef: 'QD-PG-999',
    verificationNote: 'Da xac minh toa do trong Rung Cuc Phuong',
  });

  const loadedCat = await loadClassificationCatalog({ db: pgPool });
  const afterVerifyEval = evaluateStoredProject(project, {
    catalog: loadedCat.catalog,
    ruleSource: loadedCat.ruleSource,
    gisLayers: gisData,
    serverSensitiveVerification: verifRow,
  });
  assert.equal(afterVerifyEval.sensitiveVerificationStatus, 'VERIFIED');
  assert.equal(afterVerifyEval.nhom, 'Nhóm I');
  assert.equal(afterVerifyEval.hs, 'DTM');

  // If declaration changes later -> resets back to PENDING_VERIFICATION automatically
  const afterEditSens = await upsertProjectSensitiveDeclaration(pgPool, {
    projectId: project.id,
    declaredFlags: { rung: true, lua: true },
    declaredDetails: { insideCoreProtectedZone: true, paddyConversionAreaHa: 12 },
  });
  assert.equal(afterEditSens.verification_status, 'PENDING_VERIFICATION');

  await pgPool.query('DELETE FROM projects WHERE id = $1', [project.id]);
});

test('PG Integration: Crawler sync creates PENDING_REVIEW candidates, Admin approves & QCVN transitional upsert', async () => {
  await detectImpactedRules({
    lawId: 'nd_08_2022',
    lawTitle: 'Nghi dinh 08/2022',
    so: '08/2022/ND-CP',
    eventAction: 'AUTO_CRAWL_UPDATE',
  }, { db: pgPool });

  const impacts = await listLawRuleImpacts({ status: 'OPEN', db: pgPool });
  assert.ok(impacts.length >= 1);

  const createdCands = await extractRuleCandidatesFromLaw({
    id: 'vb_pg_test_2026',
    ten: 'Thông tư cập nhật QCVN 40:2025 và Phụ lục III',
    so: '88/2026/TT-BTNMT',
    dieu_khoang: [{ tieu_de: 'Điều 2', noi_dung: 'Sửa đổi Phụ lục III về ngành sản xuất gỗ' }],
  }, { db: pgPool });
  assert.ok(createdCands.length >= 1);

  const pendingList = await listRuleCandidates({ status: 'PENDING_REVIEW', db: pgPool });
  const targetCand = pendingList.find(c => c.law_id === 'vb_pg_test_2026' && c.target_type === 'CLASSIFICATION_THRESHOLD');
  assert.ok(targetCand);

  // Approving threshold candidate requires sourceDocument & creates VERIFIED threshold row
  await approveRuleCandidate(pgPool, {
    candidateId: targetCand.id,
    reviewedBy: testUserId,
    reviewedByName: 'pg_admin_test',
    sourceDocument: '88/2026/TT-BTNMT',
    overrideProposedData: {
      industryCode: 'che_bien_go',
      min: 99999999,
      operator: '>=',
      projectGroup: 'Nhóm I',
      hs: 'DTM',
      tq: 'cap_bo',
      effectiveFrom: '2026-01-01',
    },
  });

  // Upsert & verify transitional QCVN 40:2011 and select it for existing facility
  await upsertTransitionalQcvn(pgPool, {
    id: 'qcvn40_2011_b',
    ten: 'QCVN 40:2011/BTNMT Cột B (PG)',
    apDung: 'Cơ sở cũ trước 01/09/2025',
    columnCode: 'B',
    effectiveFrom: '2011-12-15',
    effectiveTo: '2026-12-31',
    sourceDocument: 'TT 47/2011/TT-BTNMT',
    verifiedBy: 'pg_admin_test',
    thamSo: [
      { key: 'pH', ten: 'pH', don_vi: '-', loai: 'range', min: 5.5, max: 9, required: true },
      { key: 'COD', ten: 'COD', don_vi: 'mg/L', loai: 'max', gioi_han: 150, required: true },
    ],
  });

  const qcvnCatalog = await loadQcvnCatalog({ db: pgPool });
  assert.equal(qcvnCatalog.ok, true);
  assert.ok(qcvnCatalog.catalog.qcvn40_2011_b);

  const selRes = await selectQcvnForProjectWithDb({
    nganh: 'che_bien_go',
    receivingWaterClass: 'B',
    receivingWaterConfirmed: true,
    flowRate: 120,
    isExistingFacility: true,
    evaluationDate: '2026-06-01',
  }, { db: pgPool });
  assert.equal(selRes.status, 'OK');
  assert.equal(selRes.qcvnId, 'qcvn40_2011_b');

  // Cleanup synthetic test records in isolated test DB
  await pgPool.query(`DELETE FROM classification_thresholds WHERE industry_code = 'che_bien_go' AND min_value = 99999999`);
  await pgPool.query(`DELETE FROM rule_candidates WHERE law_id = 'vb_pg_test_2026'`);
  await pgPool.query(`DELETE FROM law_rule_impacts WHERE law_id = 'nd_08_2022'`);
  await pgPool.query(`DELETE FROM qcvns WHERE id = 'qcvn40_2011_b'`);
});
