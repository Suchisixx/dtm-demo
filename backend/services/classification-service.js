// backend/services/classification-service.js
// Dịch vụ Phân loại Hồ sơ Môi trường & Xác định Thẩm quyền (Kiến trúc 3 bước độc lập sau Kiểm toán Pháp lý)
const defaultDb = require('../config/db');
const { loadClassificationCatalog, getProjectSensitiveVerification } = require('./rule-repository');
const { calculateImpactRadius, analyzeSpatialContext, analyzeSpatialContextWithDb } = require('./spatial-gis-service');

const RULE_SCHEMA_VERSION = '2026.2-audit';
const TWO_TIER_GOV_EFFECTIVE_DATE = '2025-07-01';
const VBHN_49_EFFECTIVE_DATE = '2026-01-29';

const {
  INDUSTRY_ALIASES,
  INDUSTRY_META,
  IND_DB,
  CHECKLIST,
  LAW_REFS,
  SENSITIVE_AREAS,
  LAW_CHANGE_WARNINGS,
  TQ_LABEL,
  THOI_HAN,
  HS_INFO,
} = require('../fixtures/classification-catalog');

/**
 * So sánh công suất với ngưỡng tier theo đúng toán tử >= hoặc > (T01, T02, T03)
 */
function matchesThreshold(value, min, operator = '>=') {
  if (operator === '>') return value > min;
  return value >= min;
}

function resolveIndustryCode(projectType) {
  if (!projectType || typeof projectType !== 'string') {
    return { resolvedCode: '', aliasedFrom: null };
  }
  const normalized = projectType.trim();
  if (INDUSTRY_ALIASES[normalized]) {
    return { resolvedCode: INDUSTRY_ALIASES[normalized], aliasedFrom: normalized };
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
 * Trả về null nếu ngành không tồn tại hoặc không có tier hiệu lực khớp (không fallback im lặng).
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
function validateClassificationInput(formData = {}, catalog = IND_DB) {
  const { resolvedCode, aliasedFrom } = resolveIndustryCode(formData.nganh);
  const industry = resolvedCode ? catalog?.[resolvedCode] : null;

  const hasCustomEvalDate = formData.evaluationDate !== undefined && formData.evaluationDate !== null && formData.evaluationDate !== '';
  const evalDate = hasCustomEvalDate ? String(formData.evaluationDate).trim() : new Date().toISOString().slice(0, 10);
  if (!isValidDateString(evalDate)) {
    return {
      valid: false,
      errorCode: 'INVALID_EVALUATION_DATE',
      resolvedCode,
      aliasedFrom,
      evaluationDate: evalDate,
      message: `Ngày đánh giá / nộp hồ sơ "${formData.evaluationDate}" không đúng định dạng YYYY-MM-DD.`,
    };
  }

  if (!resolvedCode || !industry) {
    return {
      valid: false,
      errorCode: 'UNKNOWN_INDUSTRY',
      resolvedCode,
      aliasedFrom,
      evaluationDate: evalDate,
      message: `Mã ngành nghề "${formData.nganh || '(trống)'}" không tồn tại trong danh mục quy tắc hợp lệ. Hệ thống không gán Nhóm IV/ĐKMT mặc định.`,
    };
  }

  const hasProcessRules = Boolean(industry.processRules && Object.keys(industry.processRules).length > 0);
  if (hasProcessRules) {
    const availableProcessStages = getAvailableProcessStages(resolvedCode, industry);
    if (!formData.processStage) {
      return {
        valid: false,
        errorCode: 'MISSING_PROCESS_STAGE',
        resolvedCode,
        aliasedFrom,
        evaluationDate: evalDate,
        availableProcessStages,
        message: `Ngành "${INDUSTRY_META[resolvedCode]?.name || resolvedCode}" bắt buộc phải chọn công đoạn / loại nhiên liệu trước khi phân loại.`,
      };
    }
    if (!Array.isArray(industry.processRules[formData.processStage]) || industry.processRules[formData.processStage].length === 0) {
      return {
        valid: false,
        errorCode: 'INVALID_PROCESS_STAGE',
        resolvedCode,
        aliasedFrom,
        evaluationDate: evalDate,
        availableProcessStages,
        message: `Công đoạn "${formData.processStage}" không hợp lệ hoặc chưa có quy tắc hoạt động cho ngành "${resolvedCode}".`,
      };
    }
  } else {
    const activeTiers = Array.isArray(industry.t) ? industry.t : [];
    if (activeTiers.length === 0) {
      return {
        valid: false,
        errorCode: 'NO_ACTIVE_RULES',
        resolvedCode,
        aliasedFrom,
        evaluationDate: evalDate,
        message: `Ngành "${resolvedCode}" hiện chưa có ngưỡng quy tắc đã ban hành/hiệu lực trong cơ sở dữ liệu (chỉ có bản nháp hoặc chưa cấu hình).`,
      };
    }
  }

  const rawCap = (formData.capacity !== undefined && formData.capacity !== null && formData.capacity !== '')
    ? formData.capacity
    : formData.cap;
  const numericCap = (rawCap === undefined || rawCap === null || rawCap === '') ? NaN : Number(rawCap);
  if (Number.isNaN(numericCap) || !Number.isFinite(numericCap) || numericCap < 0) {
    return {
      valid: false,
      errorCode: 'INVALID_CAPACITY',
      resolvedCode,
      aliasedFrom,
      evaluationDate: evalDate,
      message: 'Quy mô / công suất thiết kế không hợp lệ (bắt buộc là số >= 0). Hệ thống không tự động chọn bậc công suất thay thế.',
    };
  }

  const tierResult = findIndustryTierDetailed(resolvedCode, numericCap, formData.processStage || null, catalog, evalDate);
  if (!tierResult.tier) {
    const isDateMiss = tierResult.reason === 'NO_ACTIVE_RULE_FOR_DATE';
    return {
      valid: false,
      errorCode: tierResult.reason || 'NO_MATCHING_TIER',
      resolvedCode,
      aliasedFrom,
      evaluationDate: evalDate,
      message: isDateMiss
        ? `Không có quy tắc/ngưỡng phân loại nào đang có hiệu lực tại ngày đánh giá ${evalDate} cho ngành "${resolvedCode}". Hệ thống không tự động dùng quy tắc của thời kỳ khác.`
        : `Không tìm thấy bậc ngưỡng phù hợp cho công suất ${numericCap} tại ngày ${evalDate} trong CSDL.`,
    };
  }

  return {
    valid: true,
    resolvedCode,
    aliasedFrom,
    numericCap,
    evaluationDate: evalDate,
    tier: tierResult.tier,
    industry,
  };
}

/**
 * BƯỚC 1 ĐỘC LẬP (A01): Xác định Nhóm dự án (projectGroup: Nhóm I, II, III, IV)
 * Không suy ngược từ loại hồ sơ và cấp cơ quan.
 */
function determineProjectGroup(formData = {}, options = {}) {
  const catalog = options.catalog || IND_DB;
  const serverSensitiveVerification = options.serverSensitiveVerification || null;
  const {
    nganh,
    capacity,
    cap,
    processStage = null,
    evaluationDate = null,
    rung = false, lua = false, bg = false,
    bao_ton = false, di_san = false,
    ven_bien = false, nguon_nc = false, dat_ngap = false,
    sensitiveCriteriaVerified = false,
    sensitiveDetails = null,
  } = formData;

  const { resolvedCode } = resolveIndustryCode(nganh);
  const rawCap = (capacity !== undefined && capacity !== null && capacity !== '') ? capacity : (cap ?? 0);
  const actualCap = parseFloat(rawCap);
  const flags = { rung, lua, bg, bao_ton, di_san, ven_bien, nguon_nc, dat_ngap };

  const tier = findIndustryTier(resolvedCode, actualCap, processStage, catalog, evaluationDate || null);
  if (!tier) {
    return {
      invalid: true,
      projectGroup: null,
      capacityScale: null,
      tier: null,
      phuluc: null,
      ref: null,
      verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
      sensitiveVerificationStatus: 'UNVERIFIED',
      nangNhom: [],
      cauNhom: [],
    };
  }

  let projectGroup = tier.projectGroup || (tier.hs === 'DTM' && tier.tq === 'cap_bo' ? 'Nhóm I' : tier.hs === 'DTM' ? 'Nhóm II' : tier.hs === 'GPMT' ? 'Nhóm III' : 'Nhóm IV');
  let phuluc = tier.phu_luc || '—';
  let ref = tier.ref || 'Luật BVMT 2020';
  let verificationStatus = tier.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION';
  const nangNhom = [];
  const cauNhom = [];

  // A08 & Hạng mục 6: KHÔNG tin sensitiveCriteriaVerified / sensitiveDetails thô từ client.
  // Chỉ nâng nhóm hợp thức khi có bản ghi xác minh phía server đã duyệt VERIFIED kèm verified_by != null.
  const activeSensitiveAreas = SENSITIVE_AREAS.filter(a => !!flags[a.key]);
  const nonBorderAreas = activeSensitiveAreas.filter(a => a.key !== 'bg');

  const hasClientSensitiveClaim = Boolean(
    sensitiveCriteriaVerified
    || (sensitiveDetails && (
      sensitiveDetails.insideCoreProtectedZone === true
      || Number(sensitiveDetails.paddyConversionAreaHa) > 0
      || Number(sensitiveDetails.forestConversionAreaHa) > 0
      || sensitiveDetails.verifiedByAuthority === true
    ))
  );

  const serverVerifStatus = serverSensitiveVerification
    ? String(serverSensitiveVerification.verification_status || '').toUpperCase()
    : null;
  const serverDetails = (serverSensitiveVerification && typeof serverSensitiveVerification.declared_details === 'object')
    ? serverSensitiveVerification.declared_details
    : {};
  const hasServerVerifiedLegalCondition = Boolean(
    serverSensitiveVerification
    && serverVerifStatus === 'VERIFIED'
    && serverSensitiveVerification.verified_by != null
    && (
      Boolean(serverSensitiveVerification.evidence_ref)
      || serverDetails.insideCoreProtectedZone === true
      || Number(serverDetails.paddyConversionAreaHa) >= 10
      || Number(serverDetails.forestConversionAreaHa) >= 50
    )
  );

  let sensitiveVerificationStatus = 'NOT_REQUIRED';

  if (activeSensitiveAreas.length > 0 || hasClientSensitiveClaim || (serverSensitiveVerification && serverVerifStatus !== 'NOT_REQUIRED')) {
    if (hasServerVerifiedLegalCondition && (nonBorderAreas.length > 0 || serverDetails.insideCoreProtectedZone === true || Number(serverDetails.paddyConversionAreaHa) >= 10 || Number(serverDetails.forestConversionAreaHa) >= 50)) {
      sensitiveVerificationStatus = 'VERIFIED';
      const previousGroup = projectGroup;
      if (tier.capacityScale === 'LARGE' || tier.capacityScale === 'MEDIUM' || projectGroup === 'Nhóm I' || projectGroup === 'Nhóm II') {
        projectGroup = 'Nhóm I';
        phuluc = 'Khoản 3, Điều 28 Luật BVMT 2020 & Phụ lục III VBHN 49/2026';
      } else {
        projectGroup = 'Nhóm II';
        phuluc = 'Khoản 4, Điều 28 Luật BVMT 2020 & Phụ lục IV VBHN 49/2026';
      }
      ref = 'Điều 25 & Điều 28, Luật BVMT 2020';
      const areasForNote = nonBorderAreas.length > 0
        ? nonBorderAreas
        : [{ label: 'Yếu tố nhạy cảm môi trường (điều kiện định lượng)', ref: serverSensitiveVerification.evidence_ref || 'Hồ sơ thẩm định server' }];
      areasForNote.forEach(area => {
        nangNhom.push({
          icon: '⚠️',
          text: `${area.label} (đã xác minh phía server bởi cán bộ thẩm định #${serverSensitiveVerification.verified_by}) → nâng từ ${previousGroup} lên ${projectGroup}`,
          ref: area.ref,
        });
      });
    } else if (serverVerifStatus === 'REJECTED') {
      sensitiveVerificationStatus = 'REJECTED';
      verificationStatus = 'NEEDS_LEGAL_VERIFICATION';
      cauNhom.push({
        icon: '⛔',
        type: 'warn',
        text: `Hồ sơ xác minh vùng nhạy cảm đã bị TỪ CHỐI thẩm định (${serverSensitiveVerification.verification_note || 'Không đạt điều kiện nâng nhóm'}). Giữ nguyên nhóm cơ sở theo công suất ngành.`,
        ref: 'Điều 25 & Điều 28, Luật BVMT 2020',
      });
    } else {
      sensitiveVerificationStatus = (serverVerifStatus === 'PENDING_VERIFICATION' || hasClientSensitiveClaim || nonBorderAreas.length > 0)
        ? 'PENDING_SERVER_VERIFICATION'
        : 'UNVERIFIED';
      verificationStatus = 'NEEDS_LEGAL_VERIFICATION';
      if (activeSensitiveAreas.length > 0) {
        activeSensitiveAreas.forEach(area => {
          cauNhom.push({
            icon: area.key === 'bg' ? 'ℹ️' : '⚠️',
            type: area.key === 'bg' ? 'info' : 'warn',
            text: `${area.label}: ${area.requiresLegalCriteria} Chưa có xác minh hợp lệ từ quản trị viên — hệ thống chưa tự động nâng lên Nhóm I.`,
            ref: area.ref,
          });
        });
      }
      if (hasClientSensitiveClaim) {
        cauNhom.push({
          icon: '🔒',
          type: 'warn',
          text: 'Thông tin vùng nhạy cảm / diện tích chuyển đổi do người dùng khai báo hiện mới ở mức ghi nhận ban đầu, chưa có hiệu lực nâng nhóm chính thức cho đến khi quản trị viên xác minh hợp lệ.',
          ref: 'Điều 25 NĐ 08/2022/NĐ-CP',
        });
      }
    }
  }

  // Ghi chú kiểm toán ngành nghề (lọc bỏ tiền tố tài liệu kỹ thuật trước khi trả về UI)
  const indEntry = catalog?.[resolvedCode];
  if (indEntry?.auditNote && verificationStatus !== 'VERIFIED') {
    cauNhom.push({
      icon: '🔍',
      type: 'warn',
      text: formatAuditTextForUser(indEntry.auditNote),
      ref: 'VBHN 49/VBHN-BNNMT',
    });
  }

  return {
    projectGroup,
    capacityScale: tier.capacityScale || 'SMALL',
    tier,
    phuluc,
    ref,
    verificationStatus,
    sensitiveVerificationStatus,
    nangNhom,
    cauNhom,
  };
}

/**
 * BƯỚC 2 ĐỘC LẬP (A01): Xác định Nghĩa vụ / Thủ tục Môi trường (DTM, GPMT, DKMT, EXEMPT_DKMT)
 * Không làm thay đổi projectGroup đã xác định ở Bước 1.
 * Đã loại bỏ:
 * - A05 (tự nâng ĐTM khi nt >= 1.000 m³/ngày)
 * - A06 (tự nâng GPMT/ĐTM khi kt >= 20.000 / 200.000 m³/giờ)
 * - A07 (tự chuyển ĐTM sang GPMT chỉ vì kcn = true)
 */
function determineEnvironmentalObligations(formData = {}, groupResult) {
  const {
    nganh,
    nt = 0,
    kt = 0,
    ctnh = false,
    kcn = false,
    exemptDkmtVerified = false,
    noWasteGenerated = false,
  } = formData;

  const actualNt = parseFloat(nt || 0);
  const actualKt = parseFloat(kt || 0);
  const hasWaste = !noWasteGenerated && (actualNt > 0 || actualKt > 0 || Boolean(ctnh) || groupResult.tier.hs !== 'DKMT');

  const projectGroup = groupResult.projectGroup;
  const obligations = [];
  const obligationNotes = [];
  let primaryProcedure = groupResult.tier.hs || 'GPMT';

  if (projectGroup === 'Nhóm I') {
    primaryProcedure = 'DTM';
    obligations.push({
      type: 'DTM',
      required: true,
      legalBasis: ['Khoản 1, Điều 30, Luật BVMT 2020'],
    });
    if (hasWaste) {
      obligations.push({
        type: 'GPMT',
        required: true,
        legalBasis: ['Khoản 1, Điều 39, Luật BVMT 2020'],
      });
    }
  } else if (projectGroup === 'Nhóm II') {
    // Dự án Nhóm II thuộc điểm c, d, đ, e khoản 1 Điều 30 phải lập ĐTM
    const requiresDtm = groupResult.tier.hs === 'DTM' || groupResult.nangNhom.length > 0;
    if (requiresDtm) {
      primaryProcedure = 'DTM';
      obligations.push({
        type: 'DTM',
        required: true,
        legalBasis: ['Khoản 1, Điều 30, Luật BVMT 2020'],
      });
    } else {
      primaryProcedure = hasWaste ? 'GPMT' : 'DKMT';
    }

    if (hasWaste) {
      obligations.push({
        type: 'GPMT',
        required: true,
        legalBasis: ['Khoản 1, Điều 39, Luật BVMT 2020'],
      });
    } else if (!requiresDtm) {
      obligations.push({
        type: 'DKMT',
        required: true,
        legalBasis: ['Khoản 1, Điều 49, Luật BVMT 2020'],
      });
    }
  } else if (projectGroup === 'Nhóm III') {
    if (hasWaste) {
      primaryProcedure = 'GPMT';
      obligations.push({
        type: 'GPMT',
        required: true,
        legalBasis: ['Khoản 1, Điều 39, Luật BVMT 2020'],
      });
    } else {
      primaryProcedure = 'DKMT';
      obligations.push({
        type: 'DKMT',
        required: true,
        legalBasis: ['Khoản 1, Điều 49, Luật BVMT 2020'],
      });
    }
  } else {
    // Nhóm IV
    primaryProcedure = 'DKMT';
    if (exemptDkmtVerified) {
      obligations.push({
        type: 'EXEMPT_DKMT',
        required: false,
        legalBasis: ['Khoản 2, Điều 49, Luật BVMT 2020; Điều 32 NĐ 08/2022'],
      });
    } else {
      obligations.push({
        type: 'DKMT',
        required: true,
        legalBasis: ['Khoản 1, Điều 49, Luật BVMT 2020'],
      });
    }
  }

  if (actualNt >= 1000) {
    obligationNotes.push({
      icon: '💧',
      type: 'info',
      text: `Lưu lượng nước thải ${actualNt.toLocaleString('vi-VN')} m³/ngày: Hệ thống không tự động nâng lên ĐTM chỉ từ lưu lượng nước thải. Cần đối chiếu xem dự án có thuộc loại hình HTXLNT tập trung hoặc ngưỡng công suất riêng tại Phụ lục III, IV VBHN 49/2026 và kiểm tra nghĩa vụ quan trắc nước thải tự động, liên tục.`,
      ref: 'Điều 97 NĐ 08/2022 (VBHN 49/2026)',
    });
  }

  if (actualKt >= 20000) {
    obligationNotes.push({
      icon: '🌫️',
      type: 'info',
      text: `Lưu lượng khí thải ${actualKt.toLocaleString('vi-VN')} m³/giờ: Hệ thống không tự động nâng nhóm/thủ tục ĐTM chỉ theo lưu lượng khí thải chung. Cần đối chiếu quy chuẩn khí thải công nghiệp QCVN 19:2024/BTNMT và danh mục nguồn khí thải lưu lượng lớn phải quan trắc tự động/định kỳ.`,
      ref: 'Điều 98 NĐ 08/2022 (VBHN 49/2026) & QCVN 19:2024/BTNMT',
    });
  }

  if (kcn) {
    obligationNotes.push({
      icon: '🏭',
      type: 'warn',
      text: 'Dự án nằm trong KCN: Hệ thống không tự động miễn ĐTM hoặc hạ nhóm dự án chỉ dựa vào cờ KCN. Cần kiểm tra Quyết định phê duyệt ĐTM của hạ tầng KCN, sự phù hợp phân khu ngành nghề, công suất tiếp nhận của HTXLNT tập trung và văn bản thỏa thuận đấu nối nước thải.',
      ref: 'Điều 30 & Điều 39, Luật BVMT 2020',
    });
  }

  // Khu đô thị
  if (nganh === 'do_thi') {
    obligationNotes.push({
      icon: '🏙️',
      type: 'info',
      text: 'Đối với dự án Khu đô thị, khu dân cư: Diện tích đất xác định quy mô nhóm dự án; nghĩa vụ cấp GPMT hay ĐKMT phải căn cứ vào việc dự án có phát sinh nước thải, khí thải phải xử lý theo Điều 39 Luật BVMT 2020 hay không.',
      ref: 'Điều 39 & Điều 49, Luật BVMT 2020',
    });
  }

  return {
    primaryProcedure,
    environmentalObligations: obligations.map(o => o.type),
    obligationDetails: obligations,
    obligationNotes,
  };
}

/**
 * BƯỚC 3 ĐỘC LẬP (A01, A02, A03, A04, A11, T07, T08):
 * Xác định Cơ quan / Người có thẩm quyền, Cơ quan tiếp nhận và Đơn vị chuyên môn thẩm định.
 */
function determineCompetentAuthority(formData = {}, groupResult, obligationsResult) {
  const {
    tinh = '',
    xa = '',
    dtcong = false,
    delegatedToKcnBoard = false,
    publicInvestmentDecentralized = false,
    ministryDefenseOrPolice = false,
    evaluationDate = new Date().toISOString().slice(0, 10),
  } = formData;

  const isHistoricalBeforeTwoTier = Boolean(evaluationDate && evaluationDate < TWO_TIER_GOV_EFFECTIVE_DATE);
  const hs = obligationsResult.primaryProcedure;
  const projectGroup = groupResult.projectGroup;
  let tierTq = groupResult.tier.tq || 'cap_so';

  // T08: Nếu ngày đánh giá trước 01/07/2025 và rule có historicalTq là cap_huyen
  if (isHistoricalBeforeTwoTier && groupResult.tier.historicalTq) {
    tierTq = groupResult.tier.historicalTq;
  }

  // A02: Sau 01/07/2025, tuyệt đối không trả về cap_huyen
  if (!isHistoricalBeforeTwoTier && tierTq === 'cap_huyen') {
    tierTq = hs === 'DKMT' ? 'cap_xa' : 'cap_so';
  }

  // Đảm bảo ĐKMT hiện hành thuộc UBND cấp xã (trừ lịch sử trước 01/07/2025)
  if (hs === 'DKMT' && !isHistoricalBeforeTwoTier) {
    tierTq = 'cap_xa';
  }

  // Xác định cấp thẩm quyền theo nhóm dự án và thủ tục
  if (hs === 'DTM' || hs === 'GPMT') {
    if (projectGroup === 'Nhóm I' && !publicInvestmentDecentralized) {
      tierTq = 'cap_bo';
    } else if (projectGroup === 'Nhóm II' && groupResult.tier.tq === 'cap_bo' && !publicInvestmentDecentralized) {
      tierTq = 'cap_bo';
    } else if (tierTq !== 'cap_bo' && !isHistoricalBeforeTwoTier) {
      tierTq = 'cap_so';
    }
  }

  // T07: Xử lý trường hợp phân quyền / ủy quyền hợp pháp
  const ministryName = isHistoricalBeforeTwoTier
    ? 'Bộ Tài nguyên và Môi trường'
    : 'Bộ Nông nghiệp và Môi trường';
  const deptName = isHistoricalBeforeTwoTier
    ? 'Sở Tài nguyên và Môi trường'
    : 'Sở Nông nghiệp và Môi trường';

  let competentPerson = '';
  let competentAgency = '';
  let receivingAgency = '';
  let processingUnit = '';
  let legalBasis = [];
  let coQuanLabel = '';

  if (ministryDefenseOrPolice) {
    competentPerson = 'Bộ trưởng Bộ Quốc phòng / Bộ trưởng Bộ Công an';
    competentAgency = 'Bộ Quốc phòng / Bộ Công an';
    receivingAgency = 'Cơ quan chuyên môn về bảo vệ môi trường thuộc Bộ Quốc phòng / Bộ Công an';
    processingUnit = 'Cơ quan chuyên môn về bảo vệ môi trường thuộc Bộ Quốc phòng / Bộ Công an';
    legalBasis = ['Khoản 2, Điều 35 & Khoản 2, Điều 41, Luật BVMT 2020'];
    coQuanLabel = competentAgency;
  } else if (delegatedToKcnBoard && tierTq === 'cap_so') {
    competentPerson = tinh
      ? `Trưởng Ban Quản lý các KCN/KKT ${tinh} (theo phân cấp/ủy quyền của UBND cấp tỉnh)`
      : 'Trưởng Ban Quản lý các KCN/KKT cấp tỉnh (theo phân cấp/ủy quyền của UBND cấp tỉnh)';
    competentAgency = tinh
      ? `Ban Quản lý các KCN/KKT ${tinh}`
      : 'Ban Quản lý các KCN/KKT cấp tỉnh';
    receivingAgency = `Bộ phận Một cửa — ${competentAgency}`;
    processingUnit = `Phòng Quản lý Tài nguyên và Môi trường — ${competentAgency}`;
    legalBasis = ['Điều 35, Điều 41 Luật BVMT 2020 & Văn bản phân cấp/ủy quyền của UBND cấp tỉnh'];
    coQuanLabel = `${competentAgency} (theo ủy quyền/phân cấp)`;
  } else if (tierTq === 'cap_bo') {
    competentPerson = `Bộ trưởng ${ministryName}`;
    competentAgency = ministryName;
    receivingAgency = `Bộ phận Một cửa — ${ministryName}`;
    processingUnit = `Cơ quan chuyên môn về BVMT thuộc ${ministryName}`;
    legalBasis = hs === 'DTM'
      ? ['Khoản 1, Điều 35, Luật BVMT 2020']
      : ['Khoản 1, Điều 41, Luật BVMT 2020'];
    coQuanLabel = ministryName;
  } else if (tierTq === 'cap_so') {
    competentPerson = tinh ? `Chủ tịch UBND ${tinh} / UBND ${tinh}` : 'Chủ tịch UBND cấp tỉnh / UBND cấp tỉnh';
    competentAgency = tinh ? `UBND ${tinh}` : 'UBND cấp tỉnh';
    receivingAgency = tinh
      ? `Trung tâm Phục vụ hành chính công ${tinh} (${deptName} ${tinh})`
      : `Trung tâm Phục vụ hành chính công cấp tỉnh (${deptName})`;
    processingUnit = tinh ? `${deptName} ${tinh}` : `${deptName} cấp tỉnh`;
    legalBasis = hs === 'DTM'
      ? ['Khoản 3, Điều 35, Luật BVMT 2020', 'VBHN 49/VBHN-BNNMT']
      : ['Điều 41, Luật BVMT 2020 (áp dụng mô hình chính quyền địa phương 02 cấp)', 'VBHN 49/VBHN-BNNMT'];
    coQuanLabel = tinh
      ? `UBND ${tinh} (Thẩm định: ${deptName})`
      : `UBND cấp tỉnh (Thẩm định: ${deptName})`;
  } else if (tierTq === 'cap_xa') {
    const communeText = xa ? `${xa}${tinh ? ', ' + tinh : ''}` : (tinh ? `cấp xã tại ${tinh}` : 'cấp xã');
    competentPerson = `Chủ tịch UBND ${communeText}`;
    competentAgency = `UBND ${communeText}`;
    receivingAgency = `Bộ phận Tiếp nhận và Trả kết quả UBND ${communeText}`;
    processingUnit = `Công chức chuyên môn Địa chính - Nông nghiệp - Xây dựng và Môi trường ${communeText}`;
    legalBasis = ['Điều 49, Luật BVMT 2020'];
    coQuanLabel = `UBND ${communeText}`;
  } else {
    // Lịch sử trước 01/07/2025: cap_huyen
    competentPerson = 'Chủ tịch UBND cấp huyện / UBND cấp huyện';
    competentAgency = 'UBND cấp huyện (Thẩm quyền lịch sử trước 01/07/2025)';
    receivingAgency = 'Bộ phận Một cửa UBND cấp huyện';
    processingUnit = 'Phòng Tài nguyên và Môi trường cấp huyện';
    legalBasis = ['Khoản 4, Điều 41 Luật BVMT 2020 (trước 01/07/2025)'];
    coQuanLabel = competentAgency;
  }

  const isUpstreamVerified = groupResult?.verificationStatus === 'VERIFIED';
  const missingHistoricalAuthority = isHistoricalBeforeTwoTier && !groupResult?.tier?.historicalTq;

  return {
    tq: tierTq,
    coQuan: coQuanLabel,
    missingHistoricalAuthority,
    competentAuthority: {
      competentPerson,
      competentAgency,
      receivingAgency,
      processingUnit,
      legalBasis,
      effectiveFrom: isHistoricalBeforeTwoTier ? '2022-01-01' : TWO_TIER_GOV_EFFECTIVE_DATE,
      effectiveTo: isHistoricalBeforeTwoTier ? '2025-06-30' : null,
      verificationStatus: (isUpstreamVerified && !missingHistoricalAuthority && !dtcong && !delegatedToKcnBoard && hs !== 'GPMT')
        ? 'VERIFIED'
        : 'NEEDS_LEGAL_VERIFICATION',
    },
  };
}

function getLawChangeWarnings(projectType) {
  return LAW_CHANGE_WARNINGS.filter(w =>
    w.applies_to === 'global' || w.applies_to === projectType
  );
}

/**
 * Hàm tổng hợp đánh giá phân loại dự án và xác định thẩm quyền (độc lập nguồn dữ liệu, fail-closed)
 */
function evaluateClassification(formData = {}, options = {}) {
  const catalog = options.catalog || IND_DB;
  const ruleSource = options.ruleSource || 'FALLBACK_UNVERIFIED';
  const fallbackReason = options.fallbackReason || null;

  const {
    nt = 0,
    kt = 0,
    phanky = false,
    morongdt = false,
    ctnh = false,
    dtcong = false,
    epr = false,
    evaluationDate = new Date().toISOString().slice(0, 10),
  } = formData;

  const validation = validateClassificationInput(formData, catalog);
  if (!validation.valid) {
    return {
      projectGroup: null,
      nhom: null,
      hs: null,
      tq: null,
      coQuan: null,
      phuluc: null,
      ref: null,
      ref_law_id: null,
      thoiHan: null,
      conclusionStatus: 'NEEDS_REVIEW',
      verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
      isOfficialConclusion: false,
      canExportOfficialReport: false,
      isPreliminary: false,
      officialConclusion: null,
      preliminary: null,
      errorCode: validation.errorCode,
      errorMessage: validation.message,
      availableProcessStages: validation.availableProcessStages || null,
      unverifiedReasons: [validation.message],
      environmentalObligations: [],
      obligationDetails: [],
      competentAuthority: {
        competentPerson: null,
        competentAgency: null,
        receivingAgency: null,
        processingUnit: null,
        legalBasis: [],
        effectiveFrom: null,
        effectiveTo: null,
        verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
      },
      ruleSource,
      fallbackReason,
      ruleVersion: RULE_SCHEMA_VERSION,
      appliedRuleVersion: RULE_SCHEMA_VERSION,
      appliedEffectiveFrom: null,
      appliedEffectiveTo: null,
      isHistoricalEvaluation: Boolean(validation.evaluationDate && validation.evaluationDate < TWO_TIER_GOV_EFFECTIVE_DATE),
      sensitiveVerificationStatus: 'NOT_REQUIRED',
      evaluationDate: validation.evaluationDate || evaluationDate,
      hi: null,
      cl: { bat_buoc: [], bo_sung: [] },
      lr: [],
      nangNhom: [],
      cauNhom: [{ icon: '⚠️', type: 'warn', text: validation.message, ref: '' }],
      infoExtra: [],
      luyTien: [],
      industryNote: catalog?.[validation.resolvedCode]?.note || null,
    };
  }

  const evalDate = validation.evaluationDate || evaluationDate;
  const resolvedNganh = validation.resolvedCode;
  const normalizedFormData = {
    ...formData,
    nganh: resolvedNganh,
    capacity: validation.numericCap,
    evaluationDate: evalDate,
  };

  const actualNt = parseFloat(nt || 0);
  const actualKt = parseFloat(kt || 0);

  // 1. Bước 1: Xác định Nhóm dự án (projectGroup)
  const groupResult = determineProjectGroup(normalizedFormData, {
    catalog,
    serverSensitiveVerification: options.serverSensitiveVerification || null,
  });

  // 2. Bước 2: Xác định Nghĩa vụ / Thủ tục môi trường (environmentalObligations)
  const obligationsResult = determineEnvironmentalObligations(normalizedFormData, groupResult);

  // 3. Bước 3: Xác định Thẩm quyền và Cơ quan chuyên môn (competentAuthority)
  const authorityResult = determineCompetentAuthority(normalizedFormData, groupResult, obligationsResult);

  const hs = obligationsResult.primaryProcedure;
  const tq = authorityResult.tq;
  const nhom = groupResult.projectGroup;
  const phuluc = groupResult.phuluc;
  const ref = groupResult.ref;
  const coQuan = authorityResult.coQuan;

  const nangNhom = [...groupResult.nangNhom];
  const cauNhom = [...groupResult.cauNhom];
  const infoExtra = [];
  const luyTien = [];

  if (validation.aliasedFrom) {
    infoExtra.push({
      icon: 'ℹ️',
      type: 'info',
      text: `Mã ngành cũ "${validation.aliasedFrom}" đã được ánh xạ sang "${resolvedNganh}".`,
      ref: '',
    });
  }

  obligationsResult.obligationNotes.forEach(note => {
    if (note.type === 'warn') {
      cauNhom.push(note);
    } else {
      infoExtra.push(note);
    }
  });

  if (dtcong && hs === 'DTM' && tq === 'cap_bo') {
    infoExtra.push({
      icon: '🏛️',
      type: 'info',
      text: 'Dự án đầu tư công: cần kiểm tra điều kiện phân cấp/phân quyền thẩm định ĐTM cho UBND cấp tỉnh theo NĐ 48/2026 và Nghị quyết phân quyền hiện hành.',
      ref: 'NĐ 48/2026, Điều 7',
    });
  }

  if (phanky && hs === 'DTM') {
    infoExtra.push({
      icon: '📅',
      type: 'info',
      text: 'Dự án phân kỳ đầu tư: kiểm tra điều kiện lập báo cáo ĐTM theo phân kỳ đầu tư và nguyên tắc kế thừa/thay thế theo quy định hiện hành.',
      ref: 'NĐ 48/2026 (VBHN 49/2026)',
    });
  }

  if (morongdt) {
    if (actualNt >= 50 || actualKt >= 20000) {
      cauNhom.push({
        icon: '⚠️',
        type: 'warn',
        text: `Dự án mở rộng/cải tạo hoặc thay đổi công nghệ xử lý chất thải (nước thải ${actualNt} m³/ngày, khí thải ${actualKt} m³/giờ): cần đối chiếu quy định về thay đổi quy mô, công suất, công nghệ làm tăng tác động xấu đến môi trường để xác định nghĩa vụ lập lại ĐTM hoặc cấp đổi/điều chỉnh GPMT.`,
        ref: 'Điều 37 & Điều 44 Luật BVMT 2020; NĐ 48/2026',
      });
    } else {
      infoExtra.push({
        icon: '📌',
        type: 'info',
        text: 'Dự án cải tạo, mở rộng, nâng công suất: cần đối chiếu với Quyết định phê duyệt ĐTM hoặc GPMT đã cấp để xác định nghĩa vụ lập lại ĐTM, cấp mới/điều chỉnh GPMT hay đăng ký môi trường.',
        ref: 'Điều 27 NĐ 08/2022 (VBHN 49/2026)',
      });
    }
  }

  // A10: Sửa cảnh báo CTNH theo đúng Điều 83 Luật BVMT 2020 (bỏ cơ chế đăng ký sổ chủ nguồn thải CTNH cũ)
  if (ctnh) {
    cauNhom.push({
      icon: '☣️',
      type: 'warn',
      text: 'Có phát sinh chất thải nguy hại (CTNH): Chủ dự án, cơ sở phải thực hiện khai báo khối lượng, loại CTNH trong hồ sơ đề nghị cấp GPMT hoặc nội dung ĐKMT; phân loại, thu gom, lưu giữ riêng và chuyển giao CTNH cho đơn vị có Giấy phép môi trường phù hợp kèm chứng từ CTNH (không còn thủ tục cấp Sổ đăng ký chủ nguồn thải CTNH riêng).',
      ref: 'Điều 83 Luật BVMT 2020; Điều 71 NĐ 08/2022; TT 02/2022 (sửa đổi bởi TT 09/2026)',
    });
  }

  if (epr) {
    cauNhom.push({
      icon: '♻️',
      type: 'warn',
      text: 'Sản phẩm, bao bì thuộc danh mục EPR: Nhà sản xuất, nhập khẩu phải thực hiện trách nhiệm tái chế hoặc đóng góp tài chính hỗ trợ tái chế theo quy định.',
      ref: 'Điều 54, 55 Luật BVMT 2020 & Nghị định hướng dẫn EPR',
      law_id: 'nd_110_2026',
    });
  }

  const lawWarnings = getLawChangeWarnings(resolvedNganh);
  lawWarnings.forEach(w => {
    luyTien.push({ icon: w.icon, text: w.text, ref: w.ref, law_id: w.law_id });
  });

  const industryObj = catalog?.[resolvedNganh] || {};
  const industryNote = industryObj.note || null;
  const thoiHan = THOI_HAN[`${hs}_${tq}`] || 'Theo quy định pháp luật hiện hành';

  let refLawId = 'luat_bvmt_2020';
  if (ref) {
    if (ref.includes('48/2026')) refLawId = 'nd_48_2026';
    else if (ref.includes('49/2026') || ref.includes('VBHN')) refLawId = 'vbhn_49_2026';
    else if (ref.includes('05/2025')) refLawId = 'nd_05_2025';
    else if (ref.includes('08/2022')) refLawId = 'nd_08_2022';
    else if (ref.includes('110/2026')) refLawId = 'nd_110_2026';
    else if (ref.includes('BVMT')) refLawId = 'luat_bvmt_2020';
  }

  const impactRadiusMeters = calculateImpactRadius(nhom, actualNt, actualKt);
  let spatialAnalysis = options.spatialAnalysisOverride !== undefined ? options.spatialAnalysisOverride : null;
  if (spatialAnalysis === null && formData.latitude !== undefined && formData.longitude !== undefined && formData.latitude !== '' && formData.longitude !== '') {
    spatialAnalysis = analyzeSpatialContext(formData.latitude, formData.longitude, options.gisLayers ? {
      sensitiveZones: options.gisLayers.sensitiveZones,
      industrialParks: options.gisLayers.industrialParks,
      gisSource: options.gisLayers.gisSource || 'DATABASE',
    } : {});
  }

  // Tổng hợp gate pháp lý & nguồn dữ liệu
  const isFromDb = ruleSource === 'DATABASE';
  const unverifiedReasons = [];
  if (!isFromDb) {
    unverifiedReasons.push('Chưa tải được danh mục quy định từ cơ sở dữ liệu; hệ thống đang dùng dữ liệu dự phòng và chỉ hiển thị kết quả ở mức tham khảo.');
  }
  if (industryObj.verificationStatus !== 'VERIFIED') {
    const cleanIndNote = formatAuditTextForUser(industryObj.auditNote);
    unverifiedReasons.push(cleanIndNote || `Ngành nghề này đang chờ chuyên viên pháp lý đối chiếu và xác minh chi tiết.`);
  }
  if (groupResult.verificationStatus !== 'VERIFIED') {
    unverifiedReasons.push('Ngưỡng phân loại theo công suất / công đoạn / yếu tố nhạy cảm hiện chưa hoàn tất bước xác minh pháp lý.');
  }
  if (groupResult.sensitiveVerificationStatus && ['PENDING_SERVER_VERIFICATION', 'UNVERIFIED'].includes(groupResult.sensitiveVerificationStatus)) {
    unverifiedReasons.push('Khai báo vùng nhạy cảm / tiêu chí nâng nhóm chưa có quyết định xác minh hợp lệ từ quản trị viên.');
  }
  if (authorityResult.competentAuthority.verificationStatus !== 'VERIFIED') {
    unverifiedReasons.push(
      authorityResult.missingHistoricalAuthority
        ? `Chưa có cấu hình thẩm quyền lịch sử đã được xác minh cho giai đoạn trước ngày ${TWO_TIER_GOV_EFFECTIVE_DATE}.`
        : 'Thẩm quyền tiếp nhận/thẩm định cần chuyên viên pháp lý kiểm tra thêm các điều kiện phân cấp hoặc ngoại lệ.'
    );
  }

  const overallVerificationStatus = (
    isFromDb
    && industryObj.verificationStatus === 'VERIFIED'
    && groupResult.verificationStatus === 'VERIFIED'
    && authorityResult.competentAuthority.verificationStatus === 'VERIFIED'
  ) ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION';

  const conclusionStatus = !isFromDb
    ? 'NEEDS_REVIEW'
    : (overallVerificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION');

  const isOfficialConclusion = conclusionStatus === 'VERIFIED';
  const canExportOfficialReport = isOfficialConclusion;
  const isPreliminary = !isOfficialConclusion;

  const appliedRuleVersion = groupResult.tier?.ruleVersion || industryObj.ruleVersion || RULE_SCHEMA_VERSION;
  const appliedEffectiveFrom = groupResult.tier?.effectiveFrom || null;
  const appliedEffectiveTo = groupResult.tier?.effectiveTo || null;
  const isHistoricalEvaluation = Boolean(evalDate && evalDate < TWO_TIER_GOV_EFFECTIVE_DATE);

  const preliminary = {
    projectGroup: nhom,
    nhom,
    hs,
    tq,
    coQuan,
    phuluc,
    ref,
    processStage: formData.processStage || null,
    environmentalObligations: obligationsResult.environmentalObligations,
    obligationDetails: obligationsResult.obligationDetails,
    competentAuthority: authorityResult.competentAuthority,
  };

  const officialConclusion = isOfficialConclusion
    ? { ...preliminary }
    : null;

  return {
    // Trạng thái & Cổng kiểm soát kết luận pháp lý
    conclusionStatus,
    verificationStatus: overallVerificationStatus,
    sensitiveVerificationStatus: groupResult.sensitiveVerificationStatus || 'NOT_REQUIRED',
    isOfficialConclusion,
    canExportOfficialReport,
    isPreliminary,
    officialConclusion,
    preliminary,
    unverifiedReasons,
    ruleSource,
    fallbackReason,
    ruleVersion: appliedRuleVersion,
    appliedRuleVersion,
    appliedEffectiveFrom,
    appliedEffectiveTo,
    isHistoricalEvaluation,
    evaluationDate: evalDate,
    gisSource: spatialAnalysis?.gisSource || null,

    // Các trường cấu trúc sau kiểm toán pháp lý
    projectGroup: isFromDb ? nhom : null,
    environmentalObligations: obligationsResult.environmentalObligations,
    obligationDetails: obligationsResult.obligationDetails,
    competentAuthority: authorityResult.competentAuthority,

    // Các trường hiển thị tương thích UI (được đánh dấu isPreliminary khi chưa xác minh; ẩn khi fallback offline)
    hs: isFromDb ? hs : null,
    tq: isFromDb ? tq : null,
    phuluc,
    ref,
    ref_law_id: refLawId,
    nhom: isFromDb ? nhom : null,
    coQuan: isFromDb ? coQuan : null,
    thoiHan,
    impactRadiusMeters,
    spatialAnalysis,
    hi: isFromDb ? (HS_INFO[hs] || { icon: '📋', label: 'Hồ sơ môi trường', class: 'chip-gpmt', bg: '#EEF8F3' }) : null,
    cl: CHECKLIST[hs] || { bat_buoc: [], bo_sung: [] },
    lr: LAW_REFS[hs] || [],
    nangNhom,
    cauNhom,
    infoExtra,
    luyTien,
    industryNote,
  };
}

/**
 * Thực thi phân loại sử dụng catalog runtime từ PostgreSQL (route API chính thức).
 */
async function evaluateClassificationWithDb(formData = {}, { db = defaultDb, projectId = null } = {}) {
  const loaded = await loadClassificationCatalog({ db });
  const targetProjectId = projectId || formData.projectId || null;

  let serverSensitiveVerification = null;
  let spatialAnalysisOverride;

  if (loaded.ok && loaded.catalog) {
    if (targetProjectId) {
      serverSensitiveVerification = await getProjectSensitiveVerification(targetProjectId, { db });
    }
    if (formData.latitude !== undefined && formData.longitude !== undefined && formData.latitude !== '' && formData.longitude !== '') {
      spatialAnalysisOverride = await analyzeSpatialContextWithDb(formData.latitude, formData.longitude, { db });
    }

    return evaluateClassification(formData, {
      catalog: loaded.catalog,
      ruleSource: 'DATABASE',
      fallbackReason: null,
      serverSensitiveVerification,
      spatialAnalysisOverride,
    });
  }

  return evaluateClassification(formData, {
    catalog: IND_DB,
    ruleSource: 'FALLBACK_UNVERIFIED',
    fallbackReason: loaded.error || 'DB_UNAVAILABLE',
    serverSensitiveVerification: null,
  });
}

/**
 * Đánh giá thống nhất cho một bản ghi dự án đã lưu trong DB (dùng chung cho /geo và /dashboard/stats).
 * Không fallback sang 'Nhóm II' / 'Nhóm III' / 'GPMT' / 'cap_so' khi dữ liệu thiếu hoặc lỗi.
 */
function evaluateStoredProject(projectRow = {}, options = {}) {
  const catalog = options.catalog || IND_DB;
  const ruleSource = options.ruleSource || 'FALLBACK_UNVERIFIED';
  const gisLayers = options.gisLayers || null;
  const serverSensitiveVerification = options.serverSensitiveVerification || null;

  const baseForm = (projectRow.form_data && typeof projectRow.form_data === 'object')
    ? { ...projectRow.form_data }
    : {};

  if (projectRow.latitude !== undefined && projectRow.latitude !== null) {
    baseForm.latitude = Number(projectRow.latitude);
  }
  if (projectRow.longitude !== undefined && projectRow.longitude !== null) {
    baseForm.longitude = Number(projectRow.longitude);
  }

  let spatialAnalysisOverride;
  if (
    baseForm.latitude !== undefined
    && baseForm.longitude !== undefined
    && baseForm.latitude !== ''
    && baseForm.longitude !== ''
    && !Number.isNaN(Number(baseForm.latitude))
    && !Number.isNaN(Number(baseForm.longitude))
  ) {
    spatialAnalysisOverride = analyzeSpatialContext(
      baseForm.latitude,
      baseForm.longitude,
      gisLayers
        ? {
            sensitiveZones: gisLayers.sensitiveZones,
            industrialParks: gisLayers.industrialParks,
            gisSource: gisLayers.gisSource || 'DATABASE',
          }
        : {}
    );
  }

  const cr = evaluateClassification(baseForm, {
    catalog,
    ruleSource,
    fallbackReason: options.fallbackReason || null,
    serverSensitiveVerification,
    spatialAnalysisOverride,
  });

  return {
    formData: baseForm,
    classification: cr,
    nhom: cr.nhom || null,
    hs: cr.hs || null,
    tq: cr.tq || null,
    coQuan: cr.coQuan || null,
    conclusionStatus: cr.conclusionStatus || 'NEEDS_REVIEW',
    sensitiveVerificationStatus: cr.sensitiveVerificationStatus || 'NOT_REQUIRED',
    isOfficialConclusion: Boolean(cr.isOfficialConclusion),
    impactRadiusMeters: cr.impactRadiusMeters || null,
    spatialAnalysis: cr.spatialAnalysis || spatialAnalysisOverride || null,
  };
}

/**
 * Trả về metadata danh mục ngành nghề, nhãn hiển thị, công đoạn và vùng nhạy cảm từ DB.
 */
async function getClassificationMetadata({ db = defaultDb } = {}) {
  const loaded = await loadClassificationCatalog({ db });
  const isFromDb = loaded.ok && loaded.catalog;
  const catalog = isFromDb ? loaded.catalog : IND_DB;
  const ruleSource = isFromDb ? 'DATABASE' : 'FALLBACK_UNVERIFIED';

  const enrichedIndustries = {};
  for (const [code, ind] of Object.entries(catalog)) {
    const meta = INDUSTRY_META[code] || {};
    const processStages = getAvailableProcessStages(code, ind);
    enrichedIndustries[code] = {
      ...ind,
      code,
      name: ind.name || meta.name || code,
      groupLabel: meta.groupLabel || 'Ngành nghề khác',
      processStages,
      hasProcessRules: processStages.length > 0,
      verificationStatus: ind.verificationStatus || 'NEEDS_LEGAL_VERIFICATION',
    };
  }

  return {
    industries: enrichedIndustries,
    industryAliases: INDUSTRY_ALIASES,
    sensitiveAreas: SENSITIVE_AREAS,
    ruleSource,
    fallbackReason: isFromDb ? null : (loaded.error || 'DB_UNAVAILABLE'),
    schemaVersion: RULE_SCHEMA_VERSION,
  };
}

module.exports = {
  RULE_SCHEMA_VERSION,
  TWO_TIER_GOV_EFFECTIVE_DATE,
  IND_DB,
  INDUSTRY_META,
  INDUSTRY_ALIASES,
  CHECKLIST,
  LAW_REFS,
  SENSITIVE_AREAS,
  LAW_CHANGE_WARNINGS,
  resolveIndustryCode,
  getAvailableProcessStages,
  isValidDateString,
  isEffectiveOnDate,
  findIndustryTierDetailed,
  findIndustryTier,
  determineProjectGroup,
  determineEnvironmentalObligations,
  determineCompetentAuthority,
  evaluateClassification,
  evaluateClassificationWithDb,
  evaluateStoredProject,
  getClassificationMetadata,
};
