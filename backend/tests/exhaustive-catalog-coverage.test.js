const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IND_DB,
  evaluateClassification,
} = require('../services/classification-service');
const { evaluateQcvnSample } = require('../services/qcvn-service');

async function loadQcvnFixture() {
  try {
    return require('../../frontend/src/data/qcvn-db.js');
  } catch {
    const path = require('path');
    const { pathToFileURL } = require('url');
    return import(pathToFileURL(path.join(__dirname, '../../frontend/src/data/qcvn-db.js')).href);
  }
}

function deriveExpectedGroup(tier) {
  if (tier.projectGroup) return tier.projectGroup;
  if (tier.hs === 'DTM' && tier.tq === 'cap_bo') return 'Nhóm I';
  if (tier.hs === 'DTM') return 'Nhóm II';
  if (tier.hs === 'GPMT') return 'Nhóm III';
  return 'Nhóm IV';
}

function buildSampleCapacityForTier(tiers, idx) {
  const tier = tiers[idx];
  const op = tier.operator || '>=';
  const upperMin = idx > 0 ? tiers[idx - 1].min : null;

  if (upperMin === null) {
    return op === '>' ? tier.min + 1 : tier.min;
  }

  // Khoảng giữa tier.min và upperMin (tránh chạm vào bậc trên nếu bậc trên dùng >=)
  if (upperMin > tier.min) {
    const boundaryVal = op === '>' ? tier.min + Math.min(0.01, (upperMin - tier.min) / 4) : tier.min;
    return Number(boundaryVal.toFixed(4));
  }
  return tier.min;
}

test('Coverage 100%: All 39 industries, 12 processStages, and 143 classification thresholds evaluate accurately at boundaries', () => {
  const industryCodes = Object.keys(IND_DB);
  assert.equal(industryCodes.length, 39, 'Catalog must cover exactly 39 industries');

  let checkedTiers = 0;
  let checkedProcessStages = 0;

  for (const code of industryCodes) {
    const ind = IND_DB[code];
    const hasProcessRules = Boolean(ind.processRules && Object.keys(ind.processRules).length > 0);

    if (hasProcessRules) {
      // Cổng fail-closed: bắt buộc chặn khi thiếu công đoạn sản xuất
      const missingStageRes = evaluateClassification(
        { nganh: code, capacity: 10, processStage: '' },
        { catalog: IND_DB, ruleSource: 'DATABASE' }
      );
      assert.equal(missingStageRes.errorCode, 'MISSING_PROCESS_STAGE', `${code} missing processStage must fail-closed`);
      assert.equal(missingStageRes.conclusionStatus, 'NEEDS_REVIEW');

      for (const [stageKey, tiers] of Object.entries(ind.processRules)) {
        checkedProcessStages++;
        const sortedTiers = [...tiers].sort((a, b) => b.min - a.min);
        for (let i = 0; i < sortedTiers.length; i++) {
          const tier = sortedTiers[i];
          const cap = buildSampleCapacityForTier(sortedTiers, i);
          const form = { nganh: code, processStage: stageKey, capacity: cap };
          if (tier.hs === 'DKMT') form.noWasteGenerated = true;

          const res = evaluateClassification(form, { catalog: IND_DB, ruleSource: 'DATABASE' });
          assert.equal(res.nhom, deriveExpectedGroup(tier), `${code}/${stageKey} tier#${i} cap=${cap}`);
          assert.equal(res.hs, tier.hs, `${code}/${stageKey} tier#${i} hs mismatch`);
          assert.ok(res.ref && res.ref.length > 0, `${code}/${stageKey} tier#${i} missing legal ref`);
          assert.ok(tier.effectiveFrom, `${code}/${stageKey} tier#${i} missing effectiveFrom`);
          checkedTiers++;
        }
      }
    }

    if (Array.isArray(ind.t) && ind.t.length > 0) {
      const sortedTiers = [...ind.t].sort((a, b) => b.min - a.min);
      const testCatalog = hasProcessRules
        ? { [code]: { ...ind, processRules: null } }
        : IND_DB;
      for (let i = 0; i < sortedTiers.length; i++) {
        const tier = sortedTiers[i];
        const cap = buildSampleCapacityForTier(sortedTiers, i);
        const form = { nganh: code, capacity: cap };
        if (tier.hs === 'DKMT') form.noWasteGenerated = true;

        const res = evaluateClassification(form, { catalog: testCatalog, ruleSource: 'DATABASE' });
        assert.equal(res.nhom, deriveExpectedGroup(tier), `${code} tier#${i} cap=${cap}`);
        assert.equal(res.hs, tier.hs, `${code} tier#${i} hs mismatch`);
        assert.ok(res.ref && res.ref.length > 0, `${code} tier#${i} missing legal ref`);
        assert.ok(tier.effectiveFrom, `${code} tier#${i} missing effectiveFrom`);
        checkedTiers++;
      }
    }
  }

  assert.equal(checkedProcessStages, 12, 'Must cover all 12 processStages across 6 branched industries');
  assert.equal(checkedTiers, 143, 'Must verify 100% of 143 thresholds');
});

test('Coverage 100%: All 35 QCVN tables pass/fail/incomplete/fail-closed evaluations consistently', async () => {
  const { QCVN_DATA } = await loadQcvnFixture();
  const qcvnIds = Object.keys(QCVN_DATA);
  assert.equal(qcvnIds.length, 35, 'Catalog must contain all 35 QCVN tables');

  for (const id of qcvnIds) {
    const qcvn = QCVN_DATA[id];
    const params = (qcvn.tham_so || []).filter(p => !p.nhom && p.key);
    assert.ok(params.length > 0, `${id} must have parameters`);

    const passValues = {};
    const requiredParams = params.filter(p => p.required !== false);
    for (const p of requiredParams) {
      if (p.loai === 'range') passValues[p.key] = Number(((p.min + p.max) / 2).toFixed(2));
      else if (p.loai === 'min') passValues[p.key] = Number((p.gioi_han * 1.5 + 1).toFixed(2));
      else passValues[p.key] = Number((p.gioi_han * 0.5).toFixed(4));
    }

    // 1. PASS check (với receivingWaterConfirmed: true)
    const verifiedCatalog = {
      [id]: {
        ...qcvn,
        verificationStatus: 'VERIFIED',
        tham_so: (qcvn.tham_so || []).map(p => (p.nhom ? p : { ...p, verificationStatus: 'VERIFIED' })),
      },
    };
    const passRes = evaluateQcvnSample({
      qcvnId: id,
      measuredValues: passValues,
      receivingWaterConfirmed: true,
      qcvnDatabase: verifiedCatalog,
      ruleSource: 'DATABASE',
    });
    assert.equal(passRes.overallStatus, 'PASS', `${id} valid inputs should PASS`);
    assert.equal(passRes.isOfficialConclusion, true);

    // 2. FAIL check (làm 1 thông số vượt ngưỡng)
    const targetFail = requiredParams[0];
    const failValues = { ...passValues };
    if (targetFail.loai === 'range') failValues[targetFail.key] = targetFail.max + 2;
    else if (targetFail.loai === 'min') failValues[targetFail.key] = Math.max(0, targetFail.gioi_han - 2);
    else failValues[targetFail.key] = targetFail.gioi_han + 10;

    const failRes = evaluateQcvnSample({
      qcvnId: id,
      measuredValues: failValues,
      receivingWaterConfirmed: true,
      qcvnDatabase: verifiedCatalog,
      ruleSource: 'DATABASE',
    });
    assert.equal(failRes.overallStatus, 'FAIL', `${id} exceeded parameter must FAIL`);

    // 3. INCOMPLETE check nếu có >= 2 chỉ tiêu bắt buộc
    if (requiredParams.length >= 2) {
      const partialValues = { [requiredParams[0].key]: passValues[requiredParams[0].key] };
      const incRes = evaluateQcvnSample({
        qcvnId: id,
        measuredValues: partialValues,
        receivingWaterConfirmed: true,
        qcvnDatabase: verifiedCatalog,
        ruleSource: 'DATABASE',
      });
      assert.equal(incRes.overallStatus, 'INCOMPLETE', `${id} missing required parameters must be INCOMPLETE`);
    }

    // 4. MISSING_RECEIVING_SOURCE gate cho nhóm nước mặt & nước thải
    if (/^qcvn(08|14|40)_/.test(id)) {
      const unconfRes = evaluateQcvnSample({
        qcvnId: id,
        measuredValues: passValues,
        receivingWaterConfirmed: false,
        qcvnDatabase: verifiedCatalog,
        ruleSource: 'DATABASE',
      });
      assert.equal(unconfRes.overallStatus, 'NEEDS_REVIEW');
      assert.equal(unconfRes.reason, 'MISSING_RECEIVING_SOURCE');
      assert.equal(unconfRes.isOfficialConclusion, false);
    }
  }
});

test('Golden Legal Benchmark & Temporal Versioning: Cross-checked against Luật BVMT 2020 & VBHN 49/2026', () => {
  const goldenCases = [
    {
      citation: 'Phụ lục II & III, VBHN 49/2026 — Dệt có nhuộm công suất lớn (>= 50 triệu m²/năm)',
      input: { nganh: 'det_nhuom', processStage: 'dyeing_washing', capacity: 50, evaluationDate: '2026-06-01' },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo' },
    },
    {
      citation: 'Phụ lục IV, VBHN 49/2026 — Chỉ dệt may không nhuộm giặt (không phụ thuộc quy mô)',
      input: { nganh: 'det_nhuom', processStage: 'weaving_garment_no_dyeing', capacity: 80, evaluationDate: '2026-06-01' },
      expected: { nhom: 'Nhóm III', hs: 'GPMT', tq: 'cap_so' },
    },
    {
      citation: 'Phụ lục II & III, VBHN 49/2026 — Luyện gang thép từ quặng công suất >= 0.3 triệu tấn/năm',
      input: { nganh: 'thep', processStage: 'ore_smelting', capacity: 0.35, evaluationDate: '2026-06-01' },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo' },
    },
    {
      citation: 'Phụ lục IV, VBHN 49/2026 — Cán kéo thép cơ khí không nấu luyện',
      input: { nganh: 'thep', processStage: 'rolling_only', capacity: 0.05, evaluationDate: '2026-06-01' },
      expected: { nhom: 'Nhóm III', hs: 'GPMT', tq: 'cap_so' },
    },
    {
      citation: 'Phụ lục II & III — Bột giấy công suất >= 50.000 tấn/năm (Nhóm I, Cấp Bộ)',
      input: { nganh: 'giay_bot', processStage: 'pulp_or_recycled', capacity: 50000, evaluationDate: '2026-06-01' },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo' },
    },
    {
      citation: 'Điều 25 & Điều 28 Luật BVMT 2020 — Dự án Nhóm II nằm trong lõi khu bảo tồn đã xác minh nâng lên Nhóm I',
      input: { nganh: 'che_bien_go', capacity: 60000, bao_ton: true, evaluationDate: '2026-06-01' },
      serverVerif: { verification_status: 'VERIFIED', verified_by: 1, evidence_ref: 'QĐ-108/QĐ-UBND', declared_details: { insideCoreProtectedZone: true } },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo' },
    },
    {
      citation: 'Mô hình 02 cấp từ 01/07/2025 — Dự án Nhóm IV thuộc thẩm quyền UBND cấp xã (cap_xa)',
      input: { nganh: 'trung_tam_tm', capacity: 2000, noWasteGenerated: true, evaluationDate: '2026-06-01' },
      expected: { nhom: 'Nhóm IV', hs: 'DKMT', tq: 'cap_xa' },
    },
  ];

  for (const gc of goldenCases) {
    const res = evaluateClassification(gc.input, {
      catalog: IND_DB,
      ruleSource: 'DATABASE',
      serverSensitiveVerification: gc.serverVerif || null,
    });
    assert.equal(res.nhom, gc.expected.nhom, gc.citation);
    assert.equal(res.hs, gc.expected.hs, gc.citation);
    assert.equal(res.tq, gc.expected.tq, gc.citation);
  }

  // Temporal versioning & Historical Authority (trước 01/07/2025 vs sau 01/07/2025)
  const versionedCatalog = {
    thuc_pham_v: {
      code: 'thuc_pham_v',
      name: 'Chế biến thực phẩm (Versioned)',
      t: [
        { min: 0, hs: 'DKMT', tq: 'cap_huyen', effectiveFrom: '2022-01-10', effectiveTo: '2025-06-30', ref: 'NĐ 08/2022/NĐ-CP' },
        { min: 0, hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', effectiveFrom: '2025-07-01', ref: 'NĐ 48/2026 & VBHN 49/2026' },
      ],
    },
  };
  const before2Tier = evaluateClassification(
    { nganh: 'thuc_pham_v', capacity: 10, noWasteGenerated: true, evaluationDate: '2024-06-01' },
    { catalog: versionedCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(before2Tier.tq, 'cap_huyen');

  const after2Tier = evaluateClassification(
    { nganh: 'thuc_pham_v', capacity: 10, noWasteGenerated: true, evaluationDate: '2026-06-01' },
    { catalog: versionedCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(after2Tier.tq, 'cap_xa');

  const outOfRange = evaluateClassification(
    { nganh: 'thuc_pham_v', capacity: 10, evaluationDate: '2020-01-01' },
    { catalog: versionedCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(outOfRange.errorCode, 'NO_ACTIVE_RULE_FOR_DATE');
});
