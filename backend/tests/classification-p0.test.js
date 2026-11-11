const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IND_DB,
  INDUSTRY_META,
  evaluateClassification,
  evaluateClassificationWithDb,
  getClassificationMetadata,
} = require('../services/classification-service');
const {
  seedClassificationCatalog,
  loadClassificationCatalog,
} = require('../services/rule-repository');

function createMockClassificationDb({ failQuery = false } = {}) {
  const state = {
    laws: [{ id: 'luat_bvmt_2020' }, { id: 'nd_08_2022' }, { id: 'vbhn_49_2026' }],
    industries: [],
    legal_appendices: [],
    classification_thresholds: [],
    nextId: 1,
    queries: [],
  };

  const db = {
    state,
    async query(sql, params = []) {
      if (failQuery) {
        throw new Error('MOCK_DB_CONNECTION_FAILED');
      }
      const trimmed = sql.trim().replace(/\s+/g, ' ');
      state.queries.push(trimmed);

      if (/^ALTER TABLE/i.test(trimmed)) {
        return { rows: [], rowCount: 0 };
      }
      if (trimmed.startsWith('SELECT id FROM laws')) {
        return { rows: state.laws.map(l => ({ ...l })), rowCount: state.laws.length };
      }
      if (trimmed.startsWith('SELECT code, display_name, verification_status, publication_status FROM industries WHERE code = $1')) {
        const rows = state.industries.filter(r => r.code === params[0]);
        return { rows, rowCount: rows.length };
      }
      if (trimmed.startsWith('INSERT INTO industries')) {
        state.industries.push({
          code: params[0],
          name: params[1],
          risk_level: params[2],
          display_name: params[3],
          capacity_label: params[4],
          unit: params[5],
          note: params[6],
          audit_note: params[7],
          process_stages_meta: params[8],
          verification_status: params[9],
          publication_status: 'PUBLISHED',
          rule_version: params[10],
        });
        return { rows: [], rowCount: 1 };
      }
      if (trimmed.startsWith('UPDATE industries')) {
        const code = params[7];
        const row = state.industries.find(r => r.code === code);
        if (row) {
          row.name = params[0] || row.name;
          row.display_name = params[0] || row.display_name;
          row.capacity_label = params[1] || row.capacity_label;
          row.unit = params[2] || row.unit;
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }
      if (trimmed.includes('FROM classification_thresholds WHERE industry_code = $1')) {
        const [code, stage] = params;
        const rows = state.classification_thresholds.filter(
          r => r.industry_code === code && (r.process_stage || '') === (stage || '')
        );
        return { rows, rowCount: rows.length };
      }
      if (trimmed.startsWith('DELETE FROM classification_thresholds')) {
        const [code, stage] = params;
        state.classification_thresholds = state.classification_thresholds.filter(
          r => !(r.industry_code === code && (r.process_stage || '') === (stage || '') && r.verification_status !== 'VERIFIED' && !r.approved_by)
        );
        return { rows: [], rowCount: 1 };
      }
      if (trimmed.startsWith('INSERT INTO legal_appendices')) {
        const existing = state.legal_appendices.find(a => a.id === params[0]);
        if (!existing) {
          state.legal_appendices.push({ id: params[0], law_id: params[1], appendix_name: params[2], item_number: params[3], content_summary: params[4] });
        }
        return { rows: [], rowCount: 1 };
      }
      if (trimmed.startsWith('INSERT INTO classification_thresholds')) {
        state.classification_thresholds.push({
          id: state.nextId++,
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
          verification_status: params[16],
          publication_status: 'PUBLISHED',
          tier_order: params[17],
          rule_version: params[18],
          source_ref: params[19],
          appendix_id: params[20],
          approved_by: null,
          approved_at: null,
        });
        return { rows: [], rowCount: 1 };
      }
      if (trimmed.includes('FROM industries ORDER BY code')) {
        return { rows: state.industries.map(r => ({ ...r })), rowCount: state.industries.length };
      }
      if (trimmed.includes('FROM classification_thresholds ORDER BY')) {
        return { rows: state.classification_thresholds.map(r => ({ ...r })), rowCount: state.classification_thresholds.length };
      }
      throw new Error('Unhandled mock SQL: ' + trimmed);
    },
  };
  return db;
}

test('Seed phan loai an toan: khong TRUNCATE, seed du 39 nganh + 6 processRules va giu nguyen ban ghi VERIFIED', async () => {
  const db = createMockClassificationDb();
  const stats1 = await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META });

  assert.equal(stats1.industriesInserted, 39);
  assert.ok(db.state.queries.every(q => !/TRUNCATE/i.test(q)), 'Khong duoc chay TRUNCATE');

  const processStages = new Set(
    db.state.classification_thresholds.filter(r => r.process_stage).map(r => `${r.industry_code}:${r.process_stage}`)
  );
  assert.ok(processStages.has('thep:ore_smelting'));
  assert.ok(processStages.has('thep:rolling_only'));
  assert.ok(processStages.has('nhiet_dien:coal_fired'));
  assert.ok(processStages.has('hoa_chat:basic_inorganic_or_pesticide'));
  assert.ok(processStages.has('giay_bot:pulp_or_recycled'));
  assert.ok(processStages.has('det_nhuom:dyeing_washing'));
  assert.ok(processStages.has('dien_tu:surface_chemical_or_component'));

  // Danh dau 1 nganh va tier la VERIFIED roi seed lai (ke ca force: true) -> khong duoc ghi de
  const xiMangInd = db.state.industries.find(i => i.code === 'xi_mang');
  xiMangInd.verification_status = 'VERIFIED';
  xiMangInd.display_name = 'Xi mang da duyet thu cong';
  const xiMangTier = db.state.classification_thresholds.find(t => t.industry_code === 'xi_mang');
  xiMangTier.verification_status = 'VERIFIED';
  xiMangTier.approved_by = 'chuyen_vien_phap_ly';
  const originalMin = xiMangTier.min_value;
  xiMangTier.min_value = 999999;

  const stats2 = await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META, force: true });
  assert.ok(stats2.skippedVerified >= 1);
  assert.equal(xiMangInd.display_name, 'Xi mang da duyet thu cong');
  assert.equal(xiMangTier.min_value, 999999);
  assert.notEqual(originalMin, 999999);
});

test('CL-01: Ma nganh khong ton tai hoac da loai bo (dien_hat_nhan, cang_song) fail-closed NEEDS_REVIEW, khong gan Nhom IV', async () => {
  const db = createMockClassificationDb();
  await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META });

  for (const badCode of ['dien_hat_nhan', 'cang_song', 'nganh_khong_ton_tai', '']) {
    const res = await evaluateClassificationWithDb({ nganh: badCode, capacity: 1000 }, { db });
    assert.equal(res.conclusionStatus, 'NEEDS_REVIEW');
    assert.equal(res.errorCode, 'UNKNOWN_INDUSTRY');
    assert.equal(res.hs, null);
    assert.equal(res.nhom, null);
    assert.equal(res.tq, null);
    assert.equal(res.isOfficialConclusion, false);
    assert.equal(res.canExportOfficialReport, false);
  }

  // Alias san_bay van anh xa dung sang cang_hang_khong
  const aliasRes = await evaluateClassificationWithDb({ nganh: 'san_bay', capacity: 5 }, { db });
  assert.equal(aliasRes.ruleSource, 'DATABASE');
  assert.equal(aliasRes.preliminary.hs, 'DTM');
});

test('CL-02 & CL-03: Nganh co processRules thieu processStage phai chan; chon 2 processStage cho ket qua khac nhau', async () => {
  const db = createMockClassificationDb();
  await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META });

  const missingStage = await evaluateClassificationWithDb({ nganh: 'thep', capacity: 500000 }, { db });
  assert.equal(missingStage.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(missingStage.errorCode, 'MISSING_PROCESS_STAGE');
  assert.equal(missingStage.hs, null);
  assert.equal(missingStage.nhom, null);
  assert.equal(missingStage.isOfficialConclusion, false);
  assert.ok(Array.isArray(missingStage.availableProcessStages) && missingStage.availableProcessStages.length === 2);

  const invalidStage = await evaluateClassificationWithDb({ nganh: 'thep', processStage: 'sai_cong_doan', capacity: 500000 }, { db });
  assert.equal(invalidStage.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(invalidStage.errorCode, 'INVALID_PROCESS_STAGE');

  const smelting = await evaluateClassificationWithDb({ nganh: 'thep', processStage: 'ore_smelting', capacity: 0.4 }, { db });
  const rolling = await evaluateClassificationWithDb({ nganh: 'thep', processStage: 'rolling_only', capacity: 0.4 }, { db });
  assert.equal(smelting.preliminary.nhom, 'Nhóm I');
  assert.equal(smelting.preliminary.hs, 'DTM');
  assert.equal(rolling.preliminary.nhom, 'Nhóm III');
  assert.equal(rolling.preliminary.hs, 'GPMT');
});

test('Cong suat am hoac NaN fail-closed INVALID_CAPACITY', async () => {
  const db = createMockClassificationDb();
  await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META });

  for (const badCap of [-10, 'abc', null, undefined, '']) {
    const res = await evaluateClassificationWithDb({ nganh: 'xi_mang', capacity: badCap }, { db });
    assert.equal(res.conclusionStatus, 'NEEDS_REVIEW');
    assert.equal(res.errorCode, 'INVALID_CAPACITY');
    assert.equal(res.hs, null);
    assert.equal(res.nhom, null);
    assert.equal(res.isOfficialConclusion, false);
  }
});

test('CL-07: Rule NEEDS_LEGAL_VERIFICATION khong duoc tra ket luan chinh thuc, chi co preliminary & bi khoa export', async () => {
  const db = createMockClassificationDb();
  await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META });

  const unverifiedRes = await evaluateClassificationWithDb({ nganh: 'che_bien_go', capacity: 250000 }, { db });
  assert.equal(unverifiedRes.ruleSource, 'DATABASE');
  assert.equal(unverifiedRes.conclusionStatus, 'NEEDS_LEGAL_VERIFICATION');
  assert.equal(unverifiedRes.verificationStatus, 'NEEDS_LEGAL_VERIFICATION');
  assert.equal(unverifiedRes.isOfficialConclusion, false);
  assert.equal(unverifiedRes.canExportOfficialReport, false);
  assert.equal(unverifiedRes.officialConclusion, null);
  assert.equal(unverifiedRes.competentAuthority.verificationStatus, 'NEEDS_LEGAL_VERIFICATION');
  assert.ok(unverifiedRes.unverifiedReasons.length > 0);
  assert.equal(unverifiedRes.preliminary.hs, 'DTM');

  // Khi duoc duyet VERIFIED ca nganh lan tier (DTM Nhom I) -> cho phep ket luan chinh thuc
  db.state.industries.find(i => i.code === 'che_bien_go').verification_status = 'VERIFIED';
  db.state.classification_thresholds
    .filter(t => t.industry_code === 'che_bien_go')
    .forEach(t => { t.verification_status = 'VERIFIED'; });

  const verifiedRes = await evaluateClassificationWithDb({ nganh: 'che_bien_go', capacity: 250000 }, { db });
  assert.equal(verifiedRes.conclusionStatus, 'VERIFIED');
  assert.equal(verifiedRes.verificationStatus, 'VERIFIED');
  assert.equal(verifiedRes.isOfficialConclusion, true);
  assert.equal(verifiedRes.canExportOfficialReport, true);
  assert.equal(verifiedRes.officialConclusion.hs, 'DTM');
  assert.equal(verifiedRes.competentAuthority.verificationStatus, 'VERIFIED');
});

test('CL-14 & CL-15: Sua rule trong DB doi ket qua ngay; rule DRAFT / PENDING_REVIEW bi loai khoi runtime', async () => {
  const db = createMockClassificationDb();
  await seedClassificationCatalog(db, { indDb: IND_DB, industryMeta: INDUSTRY_META });

  // CL-14: Duyet va ha nguong cao su cb tu 15000 xuong 5000 -> capacity 6000 doi tu Nhom II/III sang Nhom I DTM
  const ind = db.state.industries.find(i => i.code === 'cao_su_cb');
  ind.verification_status = 'VERIFIED';
  const tiers = db.state.classification_thresholds.filter(t => t.industry_code === 'cao_su_cb');
  tiers.forEach(t => { t.verification_status = 'VERIFIED'; });
  const before = await evaluateClassificationWithDb({ nganh: 'cao_su_cb', capacity: 6000 }, { db });
  assert.notEqual(before.nhom, 'Nhóm I');

  tiers[0].min_value = 5000;
  tiers[0].project_group = 'Nhóm I';
  tiers[0].legal_doc_required = 'DTM';
  tiers[0].tq = 'cap_bo';
  tiers[0].rule_version = '2026.9-db-hotfix';

  const after = await evaluateClassificationWithDb({ nganh: 'cao_su_cb', capacity: 6000 }, { db });
  assert.equal(after.nhom, 'Nhóm I');
  assert.equal(after.hs, 'DTM');
  assert.equal(after.tq, 'cap_bo');

  // CL-15: Them rule DRAFT cho cao_su_cb co nguong rat nho (min 0 -> DKMT cap_xa) nhung engine PHAI BO QUA
  db.state.classification_thresholds.unshift({
    id: 9999,
    industry_code: 'cao_su_cb',
    process_stage: '',
    min_value: 0,
    max_value: null,
    operator: '>=',
    unit: 'tan',
    capacity_scale: 'SMALL',
    project_group: 'Nhóm IV',
    legal_doc_required: 'DKMT',
    tq: 'cap_xa',
    verification_status: 'VERIFIED',
    publication_status: 'DRAFT',
    tier_order: -1,
  });

  const withDraft = await evaluateClassificationWithDb({ nganh: 'cao_su_cb', capacity: 6000 }, { db });
  assert.equal(withDraft.nhom, 'Nhóm I');
  assert.equal(withDraft.hs, 'DTM');

  // Nganh moi chi co tier PENDING_REVIEW -> khong co rule active
  db.state.industries.push({
    code: 'nganh_nhap',
    name: 'Nganh dang cho duyet',
    display_name: 'Nganh dang cho duyet',
    verification_status: 'NEEDS_LEGAL_VERIFICATION',
    publication_status: 'PUBLISHED',
  });
  db.state.classification_thresholds.push({
    id: 10000,
    industry_code: 'nganh_nhap',
    process_stage: '',
    min_value: 0,
    operator: '>=',
    project_group: 'Nhóm IV',
    legal_doc_required: 'DKMT',
    tq: 'cap_xa',
    verification_status: 'VERIFIED',
    publication_status: 'PENDING_REVIEW',
    tier_order: 0,
  });

  const pendingOnly = await evaluateClassificationWithDb({ nganh: 'nganh_nhap', capacity: 10 }, { db });
  assert.equal(pendingOnly.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(pendingOnly.errorCode, 'NO_ACTIVE_RULES');
  assert.equal(pendingOnly.hs, null);
});

test('DB mat ket noi / offline fallback -> FALLBACK_UNVERIFIED va ep NEEDS_REVIEW', async () => {
  const brokenDb = createMockClassificationDb({ failQuery: true });
  const res = await evaluateClassificationWithDb({ nganh: 'che_bien_go', capacity: 250000 }, { db: brokenDb });
  assert.equal(res.ruleSource, 'FALLBACK_UNVERIFIED');
  assert.equal(res.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(res.isOfficialConclusion, false);
  assert.equal(res.hs, null);
  assert.equal(res.nhom, null);

  const meta = await getClassificationMetadata({ db: brokenDb });
  assert.equal(meta.ruleSource, 'FALLBACK_UNVERIFIED');
  assert.equal(Object.keys(meta.industries).length, 39);
});
