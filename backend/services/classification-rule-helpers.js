// Tiện ích xác định ngành, ngưỡng và ngày hiệu lực cho bộ phân loại.
const { INDUSTRY_ALIASES, INDUSTRY_META, IND_DB } = require('../fixtures/classification-catalog');
function matchesThreshold(value, min, operator = '>=') {
  if (operator === '>') return value > min;
  return value >= min;
}

function resolveIndustryCode(projectType, catalog = null) {
  if (!projectType || typeof projectType !== 'string') {
    return { resolvedCode: '', aliasedFrom: null };
  }
  const normalized = projectType.trim();
  if (INDUSTRY_ALIASES[normalized]) {
    return { resolvedCode: INDUSTRY_ALIASES[normalized], aliasedFrom: normalized };
  }
  if (catalog && typeof catalog === 'object') {
    if (catalog[normalized]) {
      return { resolvedCode: normalized, aliasedFrom: null };
    }
    const cleanInput = normalized.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
    for (const [code, item] of Object.entries(catalog)) {
      if (Array.isArray(item.aliases)) {
        if (item.aliases.includes(normalized) || item.aliases.includes(cleanInput)) {
          return { resolvedCode: code, aliasedFrom: normalized };
        }
      }
      if (item.name && item.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd') === cleanInput) {
        return { resolvedCode: code, aliasedFrom: normalized };
      }
    }
  }
  return { resolvedCode: normalized, aliasedFrom: null };
}

function getAvailableProcessStages(industryKey, industryObj) {
  const keys = industryObj?.processRules ? Object.keys(industryObj.processRules) : [];
  const metaStages = industryObj?.processStagesMeta || INDUSTRY_META[industryKey]?.processStages || [];
  const metaMap = new Map(metaStages.map(item => [item.key, item.label]));
  return keys.map(key => ({ key, label: metaMap.get(key) || key }));
}

function isValidDateString(str) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const d = new Date(`${trimmed}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === trimmed;
}

function isEffectiveOnDate(item = {}, evaluationDate = null) {
  if (!evaluationDate) return true;
  const target = String(evaluationDate).slice(0, 10);
  const from = item.effectiveFrom ? String(item.effectiveFrom).slice(0, 10) : null;
  const to = item.effectiveTo ? String(item.effectiveTo).slice(0, 10) : null;
  if (from && target < from) return false;
  if (to && target > to) return false;
  return true;
}

/**
 * Tìm tier công suất kèm chi tiết hiệu lực theo evaluationDate (fail-closed theo ngày hiệu lực).
 */
function findIndustryTierDetailed(projectType, capacity, processStage = null, catalog = IND_DB, evaluationDate = null) {
  const { resolvedCode } = resolveIndustryCode(projectType);
  const industry = catalog?.[resolvedCode];
  if (!industry) return { tier: null, reason: 'UNKNOWN_INDUSTRY', totalTiers: 0, activeTiers: 0 };

  const hasProcessRules = Boolean(industry.processRules && Object.keys(industry.processRules).length > 0);
  if (hasProcessRules) {
    if (!processStage || !Array.isArray(industry.processRules[processStage])) {
      return { tier: null, reason: 'INVALID_PROCESS_STAGE', totalTiers: 0, activeTiers: 0 };
    }
  }

  const allTiers = hasProcessRules
    ? industry.processRules[processStage]
    : (Array.isArray(industry.t) ? industry.t : []);

  if (!allTiers || allTiers.length === 0) {
    return { tier: null, reason: 'NO_ACTIVE_RULES', totalTiers: 0, activeTiers: 0 };
  }

  const activeTiers = allTiers.filter(t => isEffectiveOnDate(t, evaluationDate));
  if (activeTiers.length === 0) {
    return { tier: null, reason: 'NO_ACTIVE_RULE_FOR_DATE', totalTiers: allTiers.length, activeTiers: 0 };
  }

  const sortedTiers = [...activeTiers].sort((a, b) => {
    if ((a.tierOrder ?? 0) !== (b.tierOrder ?? 0)) return (a.tierOrder ?? 0) - (b.tierOrder ?? 0);
    if (b.min !== a.min) return b.min - a.min;
    const effA = a.effectiveFrom || '';
    const effB = b.effectiveFrom || '';
    return effB.localeCompare(effA);
  });

  for (const tier of sortedTiers) {
    if (matchesThreshold(capacity, tier.min, tier.operator || '>=')) {
      return { tier, reason: null, totalTiers: allTiers.length, activeTiers: sortedTiers.length };
    }
  }
  return { tier: null, reason: 'NO_MATCHING_TIER', totalTiers: allTiers.length, activeTiers: sortedTiers.length };
}

/**
 * Tìm tier công suất theo ngành, công suất, công đoạn và ngày hiệu lực.
 * Trả về null nếu ngành không tồn tại hoặc không có ngưỡng hiệu lực phù hợp; không tự dùng dữ liệu dự phòng.
 */
function findIndustryTier(projectType, capacity, processStage = null, catalog = IND_DB, evaluationDate = null) {
  return findIndustryTierDetailed(projectType, capacity, processStage, catalog, evaluationDate).tier;
}

function formatAuditTextForUser(text) {
  if (!text) return '';
  return String(text)
    .replace(/^\[NEEDS_LEGAL_VERIFICATION\]\s*/i, '')
    .replace(/^Mục\s*4\.[0-9]+\s*README\s*:\s*/i, '')
    .replace(/\s*\(NEEDS_LEGAL_VERIFICATION\)/gi, '')
    .trim();
}

/**
 * Kiểm tra tính đầy đủ và hợp lệ của đầu vào trước khi chạy 3 bước đánh giá (fail-closed)
 */
module.exports = {
  matchesThreshold,
  resolveIndustryCode,
  getAvailableProcessStages,
  isValidDateString,
  isEffectiveOnDate,
  findIndustryTierDetailed,
  findIndustryTier,
  formatAuditTextForUser,
};
