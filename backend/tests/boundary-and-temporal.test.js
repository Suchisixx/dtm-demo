const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const {
  IND_DB,
  evaluateClassification,
  evaluateClassificationWithDb,
} = require('../services/classification-service');
const { matchesThreshold, findIndustryTierDetailed } = require('../services/classification-rule-helpers');
const { getRuntimeQcvnCatalog } = require('../services/qcvn-service');
const { RuleDataUnavailableError } = require('../services/runtime-policy');

function deriveExpectedGroup(tier) {
  if (tier.projectGroup) return tier.projectGroup;
  if (tier.hs === 'DTM' && tier.tq === 'cap_bo') return 'Nhóm I';
  if (tier.hs === 'DTM') return 'Nhóm II';
  if (tier.hs === 'GPMT') return 'Nhóm III';
  return 'Nhóm IV';
}

test('Boundary 3-Point (X - ε, X, X + ε): Operator > vs >= and all 143 catalog thresholds', () => {
  // 1. Kiểm chứng trực tiếp toán tử > so với >= tại điểm biên X = 50
  assert.equal(matchesThreshold(49.999, 50, '>='), false);
  assert.equal(matchesThreshold(50, 50, '>='), true);
  assert.equal(matchesThreshold(50.001, 50, '>='), true);

  assert.equal(matchesThreshold(49.999, 50, '>'), false);
  assert.equal(matchesThreshold(50, 50, '>'), false);
  assert.equal(matchesThreshold(50.001, 50, '>'), true);

  // Kiểm chứng hành vi thực tế trong findIndustryTierDetailed với cặp tier dùng '>' vs '>='
  const strictGtCatalog = {
    test_op: {
      code: 'test_op',
      name: 'Strict Greater Than Test',
      t: [
        { min: 100, operator: '>', projectGroup: 'Nhóm I', hs: 'DTM', tq: 'cap_bo', effectiveFrom: '2026-01-01', ref: 'Test' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm II', hs: 'DTM', tq: 'cap_so', effectiveFrom: '2026-01-01', ref: 'Test' },
      ],
    },
  };
  assert.equal(findIndustryTierDetailed('test_op', 99.99, null, strictGtCatalog, '2026-06-01').tier.projectGroup, 'Nhóm II');
  assert.equal(findIndustryTierDetailed('test_op', 100, null, strictGtCatalog, '2026-06-01').tier.projectGroup, 'Nhóm II');
  assert.equal(findIndustryTierDetailed('test_op', 100.01, null, strictGtCatalog, '2026-06-01').tier.projectGroup, 'Nhóm I');

  // 2. Kiểm tra 3 điểm biên (X - ε, X, X + ε) trên toàn bộ các bậc có min > 0 trong 39 ngành / 143 ngưỡng
  let boundaryGroupsChecked = 0;
  let totalTiersVerified = 0;

  function verifyTierArray(code, stageKey, tiers, catalogOverride) {
    const sorted = [...tiers].sort((a, b) => b.min - a.min);
    for (let i = 0; i < sorted.length; i++) {
      const tier = sorted[i];
      const op = tier.operator || '>=';
      const upperTier = i > 0 ? sorted[i - 1] : null;
      const lowerTier = i + 1 < sorted.length ? sorted[i + 1] : null;
      totalTiersVerified++;

      if (tier.min > 0) {
        boundaryGroupsChecked++;
        const gapBelow = lowerTier ? tier.min - lowerTier.min : tier.min;
        const gapAbove = upperTier ? upperTier.min - tier.min : Math.max(1, tier.min * 0.1);
        const epsBelow = Number(Math.min(0.001, gapBelow / 4).toFixed(6)) || 0.0001;
        const epsAbove = Number(Math.min(0.001, gapAbove / 4).toFixed(6)) || 0.0001;

        const valBelow = Number((tier.min - epsBelow).toFixed(6));
        const valExact = tier.min;
        const valAbove = Number((tier.min + epsAbove).toFixed(6));

        // Điểm X - ε: phải rơi xuống bậc dưới (hoặc không khớp bậc hiện tại nếu bậc trên min > valBelow)
        const resBelow = findIndustryTierDetailed(code, valBelow, stageKey, catalogOverride, '2026-06-01');
        if (lowerTier) {
          assert.equal(
            deriveExpectedGroup(resBelow.tier),
            deriveExpectedGroup(lowerTier),
            `${code}/${stageKey || 'default'} at X-ε (${valBelow}) should match lower tier`
          );
        }

        // Điểm X: khớp bậc hiện tại nếu '>=', rơi xuống bậc dưới nếu '>'
        const resExact = findIndustryTierDetailed(code, valExact, stageKey, catalogOverride, '2026-06-01');
        const expectedAtExact = op === '>' && lowerTier ? lowerTier : tier;
        assert.equal(
          deriveExpectedGroup(resExact.tier),
          deriveExpectedGroup(expectedAtExact),
          `${code}/${stageKey || 'default'} at X (${valExact}, op=${op})`
        );

        // Điểm X + ε: phải khớp bậc hiện tại
        const resAbove = findIndustryTierDetailed(code, valAbove, stageKey, catalogOverride, '2026-06-01');
        assert.equal(
          deriveExpectedGroup(resAbove.tier),
          deriveExpectedGroup(tier),
          `${code}/${stageKey || 'default'} at X+ε (${valAbove})`
        );
      }
    }
  }

  for (const [code, ind] of Object.entries(IND_DB)) {
    const hasProcess = Boolean(ind.processRules && Object.keys(ind.processRules).length > 0);
    if (hasProcess) {
      for (const [stageKey, tiers] of Object.entries(ind.processRules)) {
        verifyTierArray(code, stageKey, tiers, IND_DB);
      }
    }
    if (Array.isArray(ind.t) && ind.t.length > 0) {
      const cat = hasProcess ? { [code]: { ...ind, processRules: null } } : IND_DB;
      verifyTierArray(code, null, ind.t, cat);
    }
  }

  assert.equal(totalTiersVerified, 143, 'Phải quét đủ 143 ngưỡng phân loại');
  assert.ok(boundaryGroupsChecked >= 90, `Phải kiểm tra biên 3 điểm cho tất cả ngưỡng có min > 0 (thực tế: ${boundaryGroupsChecked})`);
});

test('Temporal Boundaries (5 Date Points & Overlapping Effective Windows)', () => {
  const temporalCatalog = {
    demo_temporal: {
      code: 'demo_temporal',
      name: 'Temporal Boundary Industry',
      t: [
        {
          min: 0,
          operator: '>=',
          projectGroup: 'Nhóm IV',
          hs: 'DKMT',
          tq: 'cap_huyen',
          effectiveFrom: '2022-01-10',
          effectiveTo: '2025-06-30',
          ref: 'NĐ 08/2022/NĐ-CP',
        },
        {
          min: 0,
          operator: '>=',
          projectGroup: 'Nhóm IV',
          hs: 'DKMT',
          tq: 'cap_xa',
          historicalTq: 'cap_huyen',
          effectiveFrom: '2025-07-01',
          effectiveTo: '2027-12-31',
          ref: 'NĐ 48/2026 & VBHN 49/2026',
        },
      ],
    },
    overlap_temporal: {
      code: 'overlap_temporal',
      name: 'Overlap Effective Window Industry',
      t: [
        {
          min: 0,
          operator: '>=',
          tierOrder: 1,
          projectGroup: 'Nhóm III',
          hs: 'GPMT',
          tq: 'cap_so',
          effectiveFrom: '2024-01-01',
          effectiveTo: '2026-12-31',
          ref: 'Rule Cũ',
        },
        {
          min: 0,
          operator: '>=',
          tierOrder: 1,
          projectGroup: 'Nhóm II',
          hs: 'DTM',
          tq: 'cap_so',
          effectiveFrom: '2026-01-01',
          effectiveTo: '2027-12-31',
          ref: 'Rule Mới chồng lấn',
        },
      ],
    },
  };

  // Mốc 1: Trước ngày effectiveFrom đầu tiên -> NO_ACTIVE_RULE_FOR_DATE
  const beforeStart = evaluateClassification(
    { nganh: 'demo_temporal', capacity: 10, noWasteGenerated: true, evaluationDate: '2022-01-09' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(beforeStart.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(beforeStart.errorCode, 'NO_ACTIVE_RULE_FOR_DATE');

  // Mốc 2: Đúng ngày effectiveFrom (2022-01-10) -> khớp quy tắc cũ (cap_huyen)
  const onStart = evaluateClassification(
    { nganh: 'demo_temporal', capacity: 10, noWasteGenerated: true, evaluationDate: '2022-01-10' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(onStart.tq, 'cap_huyen');

  // Mốc 3: Đúng ngày effectiveTo cũ (2025-06-30) -> vẫn là cap_huyen
  const onOldEnd = evaluateClassification(
    { nganh: 'demo_temporal', capacity: 10, noWasteGenerated: true, evaluationDate: '2025-06-30' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(onOldEnd.tq, 'cap_huyen');

  // Mốc 4: Đúng ngày chuyển đổi chính quyền 2 cấp (2025-07-01) và trong khoảng hiệu lực mới -> cap_xa
  const onNewStart = evaluateClassification(
    { nganh: 'demo_temporal', capacity: 10, noWasteGenerated: true, evaluationDate: '2025-07-01' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(onNewStart.tq, 'cap_xa');

  // Mốc 5: Đúng ngày effectiveTo cuối cùng (2027-12-31) -> khớp; sau đó 1 ngày (2028-01-01) -> NO_ACTIVE_RULE_FOR_DATE
  const onFinalEnd = evaluateClassification(
    { nganh: 'demo_temporal', capacity: 10, noWasteGenerated: true, evaluationDate: '2027-12-31' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(onFinalEnd.tq, 'cap_xa');

  const afterFinalEnd = evaluateClassification(
    { nganh: 'demo_temporal', capacity: 10, noWasteGenerated: true, evaluationDate: '2028-01-01' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(afterFinalEnd.conclusionStatus, 'NEEDS_REVIEW');
  assert.equal(afterFinalEnd.errorCode, 'NO_ACTIVE_RULE_FOR_DATE');

  // Khoảng hiệu lực chồng lấn (2026-06-01 thuộc cả 2024–2026 và 2026–2027): ưu tiên effectiveFrom mới hơn
  const overlapRes = evaluateClassification(
    { nganh: 'overlap_temporal', capacity: 10, evaluationDate: '2026-06-01' },
    { catalog: temporalCatalog, ruleSource: 'DATABASE' }
  );
  assert.equal(overlapRes.nhom, 'Nhóm II');
  assert.equal(overlapRes.ref, 'Rule Mới chồng lấn');
});

test('Runtime Policy Strict Fail-Closed: ALLOW_STATIC_FALLBACK=false throws 503 RuleDataUnavailableError on DB failure', async () => {
  const prevAllow = process.env.ALLOW_STATIC_FALLBACK;
  const prevNodeEnv = process.env.NODE_ENV;
  const brokenDb = {
    async query() {
      throw new Error('SIMULATED_PG_OUTAGE');
    },
  };

  try {
    process.env.ALLOW_STATIC_FALLBACK = 'false';

    await assert.rejects(
      () => evaluateClassificationWithDb({ nganh: 'che_bien_go', capacity: 60000 }, { db: brokenDb }),
      (err) => err instanceof RuleDataUnavailableError && err.status === 503 && err.errorCode === 'RULE_DB_UNAVAILABLE'
    );

    await assert.rejects(
      () => getRuntimeQcvnCatalog({ db: brokenDb }),
      (err) => err instanceof RuleDataUnavailableError && err.status === 503 && err.errorCode === 'RULE_DB_UNAVAILABLE'
    );
  } finally {
    if (prevAllow === undefined) delete process.env.ALLOW_STATIC_FALLBACK;
    else process.env.ALLOW_STATIC_FALLBACK = prevAllow;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
  }
});

test('Independent Legal Golden Benchmark (18 cases from docs/audit/Legal_Golden_Cases.json)', () => {
  const goldenPath = path.join(__dirname, '../../docs/audit/Legal_Golden_Cases.json');
  const goldenCases = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

  assert.equal(goldenCases.length, 18, 'Bộ benchmark độc lập phải có đủ 18 tình huống chuẩn');

  for (const gc of goldenCases) {
    assert.ok(gc.case_id && gc.source_document && gc.article_or_appendix, `${gc.case_id} thiếu metadata nguồn pháp lý`);
    const res = evaluateClassification(
      { ...gc.input, evaluationDate: gc.effective_date },
      {
        catalog: IND_DB,
        ruleSource: 'DATABASE',
        serverSensitiveVerification: gc.server_sensitive_verification || null,
      }
    );

    assert.equal(res.nhom, gc.expected_group, `${gc.case_id} (${gc.article_or_appendix}) nhom mismatch`);
    assert.equal(res.hs, gc.expected_procedure, `${gc.case_id} procedure mismatch`);
    assert.equal(res.tq, gc.expected_authority, `${gc.case_id} authority mismatch`);
    assert.ok(res.classificationRationale && res.classificationRationale.summaryText, `${gc.case_id} phải có giải trình cấu trúc`);

    if (gc.expected_official_conclusion === false) {
      assert.equal(res.isOfficialConclusion, false, `${gc.case_id} phải khóa kết luận chính thức`);
    }
    if (gc.expected_sensitive_status) {
      assert.equal(res.sensitiveVerificationStatus, gc.expected_sensitive_status, `${gc.case_id} sensitive status mismatch`);
    }
  }
});
