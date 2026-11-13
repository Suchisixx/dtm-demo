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
const { migrateVietnameseSchema } = require('../services/vietnamese-schema');

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
  const schemaState = await pgPool.query(
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'nguoi_dung' AND c.relkind IN ('r', 'p')
     ) AS vietnamese_schema`
  );
  if (!schemaState.rows[0].vietnamese_schema) {
    // Tạo các bảng cũ tối thiểu để kiểm tra migration tại chỗ.
    await pgPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      reset_token_hash VARCHAR(255),
      reset_token_expires TIMESTAMP,
      role VARCHAR(20) NOT NULL DEFAULT 'staff',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
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
    ALTER TABLE laws ADD COLUMN IF NOT EXISTS last_crawled_mod VARCHAR(100);
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
    CREATE TABLE IF NOT EXISTS rules (
      id VARCHAR(100) PRIMARY KEY, rule_name VARCHAR(255) NOT NULL,
      rule_type VARCHAR(50), expression TEXT NOT NULL, is_active BOOLEAN DEFAULT TRUE, version INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS rule_versions (
      id SERIAL PRIMARY KEY, rule_id VARCHAR(100) REFERENCES rules(id) ON DELETE CASCADE,
      version INTEGER NOT NULL, expression TEXT NOT NULL, changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, change_reason TEXT
    );
    CREATE TABLE IF NOT EXISTS law_update_history (
      id SERIAL PRIMARY KEY, law_id VARCHAR(100), action VARCHAR(50) NOT NULL,
      updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, description TEXT
    );
    CREATE TABLE IF NOT EXISTS system_settings (key VARCHAR(100) PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS query_logs (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      query_type VARCHAR(50) NOT NULL, input_params JSONB NOT NULL, output_result JSONB NOT NULL,
      queried_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(100) NOT NULL, ip_address VARCHAR(50), user_agent TEXT, payload JSONB,
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
    await migrateVietnameseSchema(pgPool);
  } else {
    await migrateVietnameseSchema(pgPool);
  }

  await seedClassificationCatalog(pgPool, { indDb: IND_DB, industryMeta: INDUSTRY_META });
  await seedQcvnCatalog(pgPool, { qcvnData: QCVN_DATA });
  await seedGisLayers(pgPool, {
    sensitiveZones: VIETNAM_SENSITIVE_ZONES,
    industrialParks: VIETNAM_INDUSTRIAL_PARKS,
  });

  const uRes = await pgPool.query(
    `INSERT INTO nguoi_dung (ten_dang_nhap, ho_ten, mat_khau_bam, vai_tro)
     VALUES ('pg_admin_test', 'PG Admin Test', 'hash', 'admin')
     ON CONFLICT (ten_dang_nhap) DO UPDATE SET vai_tro = 'admin'
     RETURNING ma`
  );
  testUserId = uRes.rows[0].ma;
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
    // Bỏ qua lỗi khi dọn dữ liệu kiểm thử.
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

  // Chạy lại seed và xác nhận bản ghi VERIFIED không bị ghi đè.
  await seedClassificationCatalog(pgPool, { indDb: IND_DB, industryMeta: INDUSTRY_META });
  const checkInd = await pgPool.query(
    `SELECT verification_status, source_document FROM industries WHERE code = 'che_bien_go'`
  );
  assert.equal(checkInd.rows[0].verification_status, 'VERIFIED');
  assert.equal(checkInd.rows[0].source_document, 'PG_VERIFIED_TEST');

  // Thêm ngành DRAFT/PENDING_REVIEW và xác nhận danh mục runtime loại bỏ chúng.
  await pgPool.query(
    `INSERT INTO nganh_nghe (ma_nganh, ten_nganh, ten_hien_thi, don_vi, trang_thai_xac_minh, trang_thai_cong_bo)
     VALUES ('pg_draft_ind', 'Draft Ind', 'Draft Ind', 'm3', 'NEEDS_LEGAL_VERIFICATION', 'DRAFT'),
            ('pg_pending_ind', 'Pending Ind', 'Pending Ind', 'm3', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_REVIEW')
     ON CONFLICT (ma_nganh) DO UPDATE SET trang_thai_cong_bo = EXCLUDED.trang_thai_cong_bo`
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

  // Trước khi quản trị viên duyệt, không được chính thức nâng từ Nhóm II lên Nhóm I.
  const beforeEval = await evaluateClassificationWithDb(
    { ...project.form_data, latitude: Number(project.latitude), longitude: Number(project.longitude) },
    { db: pgPool, projectId: project.id }
  );
  assert.notEqual(beforeEval.sensitiveVerificationStatus, 'VERIFIED');
  assert.equal(beforeEval.nhom, 'Nhóm II');
  assert.equal(beforeEval.isOfficialConclusion, false);

  // Sau khi quản trị viên xác minh, hai hàm đánh giá cho kết quả Nhóm I/ĐTM.
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

  // Khi nội dung khai báo thay đổi, trạng thái tự quay về PENDING_VERIFICATION.
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

  // Duyệt đề xuất ngưỡng cần sourceDocument và tạo bản ghi ngưỡng VERIFIED.
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

  // Thêm/cập nhật, xác minh QCVN 40:2011 chuyển tiếp và chọn cho cơ sở hiện hữu.
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

  // Dọn dữ liệu kiểm thử trong cơ sở dữ liệu riêng.
  await pgPool.query(`DELETE FROM classification_thresholds WHERE industry_code = 'che_bien_go' AND min_value = 99999999`);
  await pgPool.query(`DELETE FROM rule_candidates WHERE law_id = 'vb_pg_test_2026'`);
  await pgPool.query(`DELETE FROM law_rule_impacts WHERE law_id = 'nd_08_2022'`);
  await pgPool.query(`DELETE FROM qcvns WHERE id = 'qcvn40_2011_b'`);
});
