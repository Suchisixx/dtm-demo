const test = require('node:test');
const assert = require('node:assert/strict');

const { QCVN_DATA } = require('../../frontend/src/data/qcvn-db.js');
const {
  seedQcvnCatalog,
  loadQcvnCatalog,
} = require('../services/rule-repository');
const {
  selectApplicableQcvn,
  evaluateQcvnSample,
  selectApplicableQcvnWithDb,
  evaluateQcvnSampleWithDb,
} = require('../services/qcvn-service');

function createMockQcvnDb({ failQuery = false } = {}) {
  const state = {
    qcvns: [],
    queries: [],
  };
  const db = {
    state,
    async query(sql, params = []) {
      if (failQuery) throw new Error('MOCK_QCVN_DB_DOWN');
      const trimmed = sql.trim().replace(/\s+/g, ' ');
      state.queries.push(trimmed);

      if (/^ALTER TABLE/i.test(trimmed)) return { rows: [], rowCount: 0 };
      if (trimmed.startsWith('SELECT id, standard_code, verification_status, publication_status, verified_by FROM qcvns WHERE id = $1')) {
        const rows = state.qcvns.filter(r => r.id === params[0]);
        return { rows, rowCount: rows.length };
      }
      if (trimmed.startsWith('INSERT INTO qcvns')) {
        state.qcvns.push({
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
          replaces: params[13] ? JSON.parse(params[13]) : null,
          transition_rules: params[14] ? JSON.parse(params[14]) : null,
          verification_status: params[15],
          publication_status: 'PUBLISHED',
          source_document: params[16],
          rule_version: params[17],
          verified_by: null,
          verified_at: null,
          published_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1 };
      }
      if (trimmed.startsWith('UPDATE qcvns')) {
        const row = state.qcvns.find(r => r.id === params[18]);
        if (row) {
          row.standard_code = row.standard_code || params[4];
          row.verification_status = row.verification_status || params[15];
        }
        return { rows: [], rowCount: row ? 1 : 0 };
      }
      if (trimmed.includes('FROM qcvns ORDER BY id')) {
        return { rows: state.qcvns.map(r => ({ ...r })), rowCount: state.qcvns.length };
      }
      throw new Error('Unhandled mock SQL: ' + trimmed);
    },
  };
  return db;
}

test('QV-01 & QV-06 & QV-07: Thieu luu luong hoac thieu/chua xac nhan nguon tiep nhan -> NEEDS_REVIEW', async () => {
  const db = createMockQcvnDb();
  await seedQcvnCatalog(db, { qcvnData: QCVN_DATA });

  // QV-01: Nuoc thai CN thieu flowRate -> khong mac dinh 100 hay F2
  for (const flowRate of [null, undefined, 0, '', -5]) {
    const res = await selectApplicableQcvnWithDb(
      { sourceType: 'nuoc_thai_cn', receivingWaterClass: 'B', receivingWaterConfirmed: true, flowRate },
      { db }
    );
    assert.equal(res.status, 'NEEDS_REVIEW');
    assert.equal(res.reason, 'MISSING_FLOW_RATE');
    assert.equal(res.qcvnId, null);
  }

  // QV-06: Thieu cot nguon tiep nhan -> khong tu chon B
  const noCol = await selectApplicableQcvnWithDb(
    { sourceType: 'nuoc_thai_cn', receivingWaterClass: null, flowRate: 100 },
    { db }
  );
  assert.equal(noCol.status, 'NEEDS_REVIEW');
  assert.equal(noCol.reason, 'MISSING_RECEIVING_WATER_CLASS');
  assert.equal(noCol.qcvnId, null);

  // QV-07: Co cot nhung receivingWaterConfirmed = false -> NEEDS_REVIEW
  const unconfirmed = await selectApplicableQcvnWithDb(
    { sourceType: 'nuoc_thai_cn', receivingWaterClass: 'A', receivingWaterConfirmed: false, flowRate: 100 },
    { db }
  );
  assert.equal(unconfirmed.status, 'NEEDS_REVIEW');
  assert.equal(unconfirmed.reason, 'MISSING_RECEIVING_SOURCE');
  assert.equal(unconfirmed.qcvnId, null);

  // Danh gia mau nuoc thai ma quen truyen receivingWaterConfirmed: true -> phai fail-closed
  const evalUnconfirmed = await evaluateQcvnSampleWithDb(
    { qcvnId: 'qcvn40_a_low', measuredValues: { pH: 7.0 } },
    { db }
  );
  assert.equal(evalUnconfirmed.overallStatus, 'NEEDS_REVIEW');
  assert.equal(evalUnconfirmed.trang_thai_tong_quat, 'can_ra_soat');
  assert.equal(evalUnconfirmed.reason, 'MISSING_RECEIVING_SOURCE');
});

test('Q-09 Transition Guard: Co so chuyen tiep QCVN 40:2011 / 14:2008 khi thieu bang cu -> NEEDS_REVIEW (khong map sang bang 2025)', async () => {
  const db = createMockQcvnDb();
  await seedQcvnCatalog(db, { qcvnData: QCVN_DATA });

  const q40Transition = await selectApplicableQcvnWithDb({
    sourceType: 'nuoc_thai_cn',
    receivingWaterClass: 'A',
    receivingWaterConfirmed: true,
    flowRate: 100,
    isExistingFacility: true,
    evaluationDate: '2026-11-11',
  }, { db });
  assert.equal(q40Transition.status, 'NEEDS_REVIEW');
  assert.equal(q40Transition.reason, 'TRANSITION_TABLE_NOT_AVAILABLE');
  assert.equal(q40Transition.qcvnId, null);

  const q14Transition = await selectApplicableQcvnWithDb({
    sourceType: 'nuoc_thai_sh',
    receivingWaterClass: 'B',
    receivingWaterConfirmed: true,
    isExistingFacility: true,
    evaluationDate: '2026-11-11',
  }, { db });
  assert.equal(q14Transition.status, 'NEEDS_REVIEW');
  assert.equal(q14Transition.reason, 'TRANSITION_TABLE_NOT_AVAILABLE');
  assert.equal(q14Transition.qcvnId, null);
});

test('QV-08 & QV-09: Seed QCVN giu metadata day du, khong ghi de VERIFIED, va DB update anh huong evaluator ngay', async () => {
  const db = createMockQcvnDb();
  const s1 = await seedQcvnCatalog(db, { qcvnData: QCVN_DATA });
  assert.equal(s1.inserted, Object.keys(QCVN_DATA).length);

  // Duyet QCVN 08 Mức A va dat lai 1 nguong BOD5 trong DB
  const q8 = db.state.qcvns.find(r => r.id === 'qcvn08_a');
  q8.verification_status = 'VERIFIED';
  q8.verified_by = 'reviewer_qcvn';
  q8.rule_version = '2026.5-verified';
  q8.tham_so.forEach(p => {
    if (!p.nhom) p.verificationStatus = 'VERIFIED';
  });
  const bodParam = q8.tham_so.find(p => p.key === 'BOD5');
  bodParam.gioi_han = 4;

  // Seed lai voi force: true van phai giu nguyen ban ghi VERIFIED
  const s2 = await seedQcvnCatalog(db, { qcvnData: QCVN_DATA, force: true });
  assert.ok(s2.skippedVerified >= 1);
  assert.equal(q8.tham_so.find(p => p.key === 'BOD5').gioi_han, 4);

  const loaded = await loadQcvnCatalog({ db });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.catalog.qcvn08_a.status, 'current');
  assert.equal(loaded.catalog.qcvn08_a.sourceType, 'nuoc_mat');
  assert.equal(loaded.catalog.qcvn08_a.verificationStatus, 'VERIFIED');
  assert.equal(loaded.catalog.qcvn08_a.ruleVersion, '2026.5-verified');

  // Ban ghi DRAFT bi loai bo khoi runtime catalog
  db.state.qcvns.push({
    id: 'qcvn_draft_new',
    ten: 'Draft QCVN',
    tham_so: [{ key: 'COD', ten: 'COD', don_vi: 'mg/L', gioi_han: 50, loai: 'max', required: true }],
    verification_status: 'VERIFIED',
    publication_status: 'DRAFT',
  });
  const loadedWithDraft = await loadQcvnCatalog({ db });
  assert.equal(loadedWithDraft.catalog.qcvn_draft_new, undefined);

  // Cap nhat nguong COD trong DB -> FAIL ngay lap tuc
  const allParams = {};
  q8.tham_so.forEach(p => {
    if (p.nhom) return;
    if (p.loai === 'range') allParams[p.key] = (p.min + p.max) / 2;
    else if (p.loai === 'min') allParams[p.key] = p.gioi_han * 2;
    else allParams[p.key] = p.gioi_han * 0.1;
  });

  const passRes = await evaluateQcvnSampleWithDb({
    qcvnId: 'qcvn08_a',
    measuredValues: allParams,
    receivingWaterConfirmed: true,
  }, { db });
  assert.equal(passRes.overallStatus, 'PASS');
  assert.equal(passRes.trang_thai_tong_quat, 'dat');
  assert.equal(passRes.isOfficialConclusion, true);

  // Sua gioi han BOD5 xuong 0.1 trong DB -> vuot nguong ngay khong can sua code
  bodParam.gioi_han = 0.1;
  const failRes = await evaluateQcvnSampleWithDb({
    qcvnId: 'qcvn08_a',
    measuredValues: allParams,
    receivingWaterConfirmed: true,
  }, { db });
  assert.equal(failRes.overallStatus, 'FAIL');
  assert.equal(failRes.trang_thai_tong_quat, 'vuot_nguong');
});

test('QV-10: DB QCVN loi hoac rong -> FALLBACK_UNVERIFIED va chan PASS', async () => {
  const brokenDb = createMockQcvnDb({ failQuery: true });
  const res = await evaluateQcvnSampleWithDb({
    qcvnId: 'qcvn05_8h',
    measuredValues: { CO: 5000 },
  }, { db: brokenDb });
  assert.equal(res.ruleSource, 'FALLBACK_UNVERIFIED');
  assert.equal(res.overallStatus, 'NEEDS_REVIEW');
  assert.equal(res.trang_thai_tong_quat, 'can_ra_soat');
  assert.equal(res.isOfficialConclusion, false);
});

test('QV-11 & QV-17 & Q-10 Range GPMT: Thieu chi tieu bat buoc, sai chu ky CO 8h vs 24h, va GPMT range pH', () => {
  const customCatalog = {
    qcvn_test_verified: {
      ten: 'QCVN Test Verified',
      sourceType: 'nuoc_thai_cn',
      verificationStatus: 'VERIFIED',
      ruleVersion: '2026.test',
      tham_so: [
        { key: 'pH', ten: 'pH', don_vi: '-', min: 6, max: 9, loai: 'range', required: true },
        { key: 'COD', ten: 'COD', don_vi: 'mg/L', gioi_han: 75, loai: 'max', required: true },
      ],
    },
    qcvn_air_verified: {
      ten: 'QCVN 05 Test Verified',
      sourceType: 'khong_khi',
      verificationStatus: 'VERIFIED',
      ruleVersion: '2026.test',
      tham_so: [
        { key: 'CO', ten: 'CO', don_vi: 'µg/m³', gioi_han: 10000, loai: 'max', averagingPeriod: '8 giờ', required: true },
      ],
    },
  };

  // QV-11: Thieu COD bat buoc -> INCOMPLETE / chua_du_thong_so
  const incompleteRes = evaluateQcvnSample({
    qcvnId: 'qcvn_test_verified',
    measuredValues: { pH: 7.2 },
    receivingWaterConfirmed: true,
    qcvnDatabase: customCatalog,
    ruleSource: 'DATABASE',
  });
  assert.equal(incompleteRes.overallStatus, 'INCOMPLETE');
  assert.equal(incompleteRes.trang_thai_tong_quat, 'chua_du_thong_so');
  assert.equal(incompleteRes.summary.missingRequired, 1);

  // QV-17: CO 8h nhung nhap chu ky 24h -> NEEDS_REVIEW / period_mismatch
  const mismatchRes = evaluateQcvnSample({
    qcvnId: 'qcvn_air_verified',
    measuredValues: { CO: 5000 },
    samplingPeriods: { CO: '24 giờ' },
    qcvnDatabase: customCatalog,
    ruleSource: 'DATABASE',
  });
  assert.equal(mismatchRes.overallStatus, 'NEEDS_REVIEW');
  assert.equal(mismatchRes.trang_thai_tong_quat, 'can_ra_soat');
  assert.equal(mismatchRes.summary.periodMismatch, 1);
  assert.equal(mismatchRes.evaluatedParams[0].status, 'period_mismatch');

  // Q-10 Range GPMT bug fix:
  // 1) Scalar permitLimit tren thong so range (pH = 6.1, permitLimit = 6.5) KHONG DUOC tra permitCompliant: true
  const scalarRangeRes = evaluateQcvnSample({
    qcvnId: 'qcvn_test_verified',
    measuredValues: { pH: 6.1, COD: 30 },
    permitLimits: { pH: 6.5 },
    receivingWaterConfirmed: true,
    qcvnDatabase: customCatalog,
    ruleSource: 'DATABASE',
  });
  assert.notEqual(scalarRangeRes.evaluatedParams[0].permitCompliant, true);
  assert.equal(scalarRangeRes.overallStatus, 'NEEDS_REVIEW');
  assert.equal(scalarRangeRes.trang_thai_tong_quat, 'can_ra_soat');

  // 2) Range format hop le "6.5-8.5": pH = 6.1 phai FAIL (vi pham GPMT) con pH = 7.2 phai PASS
  const validRangeFail = evaluateQcvnSample({
    qcvnId: 'qcvn_test_verified',
    measuredValues: { pH: 6.1, COD: 30 },
    permitLimits: { pH: '6.5-8.5' },
    receivingWaterConfirmed: true,
    qcvnDatabase: customCatalog,
    ruleSource: 'DATABASE',
  });
  assert.equal(validRangeFail.overallStatus, 'FAIL');
  assert.equal(validRangeFail.evaluatedParams[0].qcvnCompliant, true);
  assert.equal(validRangeFail.evaluatedParams[0].permitCompliant, false);

  const validRangePass = evaluateQcvnSample({
    qcvnId: 'qcvn_test_verified',
    measuredValues: { pH: 7.2, COD: 30 },
    permitLimits: { pH: { min: 6.5, max: 8.5 } },
    receivingWaterConfirmed: true,
    qcvnDatabase: customCatalog,
    ruleSource: 'DATABASE',
  });
  assert.equal(validRangePass.overallStatus, 'PASS');
  assert.equal(validRangePass.trang_thai_tong_quat, 'dat');
  assert.equal(validRangePass.evaluatedParams[0].permitCompliant, true);
});
