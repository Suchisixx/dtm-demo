// frontend/src/utils/qcvn-evaluator.js
// Thuật toán dùng chung (UI + Backend API) cho lựa chọn QCVN và đánh giá mẫu quan trắc.
// Tuyệt đối không tự gắn hard-code QCVN_DATA làm nguồn runtime chính thức khi thiếu DB.

export const QCVN_STATUS_TO_DB = {
  PASS: 'dat',
  PASS_WITH_WARNING: 'canh_bao',
  FAIL: 'vuot_nguong',
  INCOMPLETE: 'chua_du_thong_so',
  NEEDS_REVIEW: 'can_ra_soat',
  NEEDS_LEGAL_VERIFICATION: 'can_ra_soat',
};

const WATER_CONFIRMATION_SOURCES = new Set(['nuoc_thai_cn', 'nuoc_thai_sh', 'nuoc_mat']);
const WATER_ID_PREFIXES = ['qcvn40_', 'qcvn14_', 'qcvn08_'];

function requiresReceivingWaterConfirmation(qcvnId = '', qcvn = null) {
  if (qcvn && qcvn.sourceType) {
    return WATER_CONFIRMATION_SOURCES.has(qcvn.sourceType);
  }
  return WATER_ID_PREFIXES.some(prefix => String(qcvnId).startsWith(prefix));
}

function emptySummary() {
  return {
    total: 0,
    pass: 0,
    near: 0,
    fail: 0,
    qcvnFail: 0,
    permitFail: 0,
    missingRequired: 0,
    missingOptional: 0,
    periodMismatch: 0,
    invalidPermitLimits: 0,
  };
}

/**
 * Chuẩn hóa giới hạn GPMT (hỗ trợ cả max, min, range).
 * Với loại range (ví dụ pH), không chấp nhận 1 số đơn lẻ để tránh bỏ sót biên trên/dưới.
 */
export function parsePermitLimit(rawValue, paramType = 'max') {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { provided: false, valid: true, value: null, min: null, max: null };
  }

  if (paramType === 'range') {
    if (Array.isArray(rawValue) && rawValue.length === 2) {
      const min = rawValue[0] !== null && rawValue[0] !== '' ? parseFloat(rawValue[0]) : null;
      const max = rawValue[1] !== null && rawValue[1] !== '' ? parseFloat(rawValue[1]) : null;
      if ((min !== null && !Number.isNaN(min)) || (max !== null && !Number.isNaN(max))) {
        if (min !== null && max !== null && !Number.isNaN(min) && !Number.isNaN(max) && min <= max) {
          return { provided: true, valid: true, value: `${min}-${max}`, min, max };
        }
      }
      return { provided: true, valid: false, value: rawValue, error: 'Khoảng giới hạn GPMT (min-max) không hợp lệ.' };
    }

    if (typeof rawValue === 'object') {
      const min = rawValue.min !== undefined && rawValue.min !== null && rawValue.min !== '' ? parseFloat(rawValue.min) : null;
      const max = rawValue.max !== undefined && rawValue.max !== null && rawValue.max !== '' ? parseFloat(rawValue.max) : null;
      if (min !== null && max !== null && !Number.isNaN(min) && !Number.isNaN(max) && min <= max) {
        return { provided: true, valid: true, value: `${min}-${max}`, min, max };
      }
      return { provided: true, valid: false, value: rawValue, error: 'Giới hạn GPMT dạng khoảng phải có đủ cả min và max (min <= max).' };
    }

    const str = String(rawValue).trim();
    const rangeMatch = str.match(/^(-?\d+(?:\.\d+)?)\s*(?:-|–|\.\.|~|đến)\s*(-?\d+(?:\.\d+)?)$/i);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      if (!Number.isNaN(min) && !Number.isNaN(max) && min <= max) {
        return { provided: true, valid: true, value: `${min}-${max}`, min, max };
      }
    }

    return {
      provided: true,
      valid: false,
      value: rawValue,
      error: 'Thông số dạng khoảng (như pH) yêu cầu giới hạn GPMT dạng "min-max" (ví dụ: 6.5-8.5), không dùng 1 số đơn.',
    };
  }

  const num = parseFloat(rawValue);
  if (Number.isNaN(num)) {
    return { provided: true, valid: false, value: rawValue, error: 'Giá trị giới hạn GPMT không phải số hợp lệ.' };
  }
  return { provided: true, valid: true, value: num, min: null, max: null };
}

/**
 * Cây quyết định chọn bộ QCVN, Cột (A/B/C), khoảng lưu lượng (F1/F2/F3) và kiểm tra chuyển tiếp.
 * Luôn fail-closed khi thiếu dữ liệu hoặc thiếu bảng chuyển tiếp trong catalog.
 */
export function selectApplicableQcvn({
  sourceType = 'nuoc_thai_cn',
  receivingWaterClass = null,
  receivingWaterConfirmed = undefined,
  flowRate = null,
  isUrbanArea = false,
  isExistingFacility = false,
  evaluationDate = new Date().toISOString().slice(0, 10),
  qcvnDatabase = null,
  subTypes = null,
  ruleSource = 'UNKNOWN',
} = {}) {
  const catalog = qcvnDatabase || {};
  if (Object.keys(catalog).length === 0) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'NO_QCVN_CATALOG',
      message: 'Chưa tải được danh mục QCVN từ cơ sở dữ liệu.',
      qcvnId: null,
      isOfficialConclusion: false,
      ruleSource,
    };
  }

  if (sourceType === 'nuoc_thai_cn' || sourceType === 'nuoc_thai_sh') {
    if (receivingWaterConfirmed === false) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'MISSING_RECEIVING_SOURCE',
        message: 'Chưa xác nhận nguồn nước tiếp nhận thực tế. Hệ thống không tự động chọn cột quy chuẩn.',
        qcvnId: null,
        isOfficialConclusion: false,
        ruleSource,
      };
    }

    if (!receivingWaterClass) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'MISSING_RECEIVING_WATER_CLASS',
        message: 'Thiếu thông tin phân vùng/mục đích sử dụng nguồn nước tiếp nhận (Cột A, B hoặc C). Hệ thống không tự động chọn cột và không kết luận đạt/không đạt.',
        qcvnId: null,
        isOfficialConclusion: false,
        ruleSource,
      };
    }

    const col = String(receivingWaterClass).toUpperCase();
    if (!['A', 'B', 'C'].includes(col)) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'INVALID_RECEIVING_WATER_CLASS',
        message: `Cột nguồn tiếp nhận "${receivingWaterClass}" không hợp lệ (chỉ chấp nhận A, B, C).`,
        qcvnId: null,
        isOfficialConclusion: false,
        ruleSource,
      };
    }

    if (sourceType === 'nuoc_thai_cn') {
      if (flowRate === null || flowRate === undefined || flowRate === '' || Number.isNaN(Number(flowRate)) || Number(flowRate) <= 0) {
        return {
          status: 'NEEDS_REVIEW',
          reason: 'MISSING_FLOW_RATE',
          message: 'Thiếu lưu lượng xả thải F (m³/ngày đêm) để xác định khoảng lưu lượng F1 (≤50), F2 (50–2.000) hay F3 (≥2.000).',
          qcvnId: null,
          isOfficialConclusion: false,
          ruleSource,
        };
      }

      const f = Number(flowRate);
      let flowKey = 'low';
      let flowCode = 'F2';
      if (f <= 50) {
        flowKey = 'f1';
        flowCode = 'F1';
      } else if (f >= 2000) {
        flowKey = 'high';
        flowCode = 'F3';
      }

      const qcvnId2025 = `qcvn40_${col.toLowerCase()}_${flowKey}`;
      const qcvnObj2025 = catalog[qcvnId2025];
      const mandatoryFrom = qcvnObj2025?.mandatoryForAllFrom || '2032-01-01';
      const inTransition = Boolean(isExistingFacility && evaluationDate < mandatoryFrom);

      if (inTransition) {
        const legacyId = [`qcvn40_2011_${col.toLowerCase()}_${flowKey}`, `qcvn40_2011_${col.toLowerCase()}`, 'qcvn40_2011']
          .find(candidate => Boolean(catalog[candidate]));
        if (!legacyId) {
          return {
            status: 'NEEDS_REVIEW',
            reason: 'TRANSITION_TABLE_NOT_AVAILABLE',
            qcvnId: null,
            column: col,
            flowCode,
            inTransition: true,
            requestedTransitionStandard: 'QCVN 40:2011/BTNMT',
            applicableStandard: 'QCVN 40:2011/BTNMT (chưa có bảng giới hạn trong CSDL)',
            message: 'Cơ sở thuộc giai đoạn chuyển tiếp áp dụng QCVN 40:2011/BTNMT (đến 31/12/2031), nhưng CSDL hiện chưa có bảng giới hạn QCVN 40:2011/BTNMT. Hệ thống không dùng bảng QCVN 40:2025 thay thế.',
            isOfficialConclusion: false,
            ruleSource,
          };
        }

        const legacyObj = catalog[legacyId];
        const verified = ruleSource === 'DATABASE' && legacyObj.verificationStatus === 'VERIFIED';
        return {
          status: ruleSource === 'FALLBACK_UNVERIFIED' ? 'NEEDS_REVIEW' : 'OK',
          reason: ruleSource === 'FALLBACK_UNVERIFIED' ? 'FALLBACK_UNVERIFIED_CATALOG' : null,
          qcvnId: legacyId,
          column: col,
          flowCode,
          inTransition: true,
          applicableStandard: legacyObj.ten || 'QCVN 40:2011/BTNMT',
          verificationStatus: verified ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
          isOfficialConclusion: verified,
          ruleSource,
        };
      }

      if (!qcvnObj2025) {
        return {
          status: 'NEEDS_REVIEW',
          reason: 'QCVN_NOT_FOUND_IN_CATALOG',
          message: `Không tìm thấy bộ quy chuẩn ${qcvnId2025} trong CSDL.`,
          qcvnId: null,
          isOfficialConclusion: false,
          ruleSource,
        };
      }

      const verified = ruleSource === 'DATABASE' && qcvnObj2025.verificationStatus === 'VERIFIED';
      return {
        status: ruleSource === 'FALLBACK_UNVERIFIED' ? 'NEEDS_REVIEW' : 'OK',
        reason: ruleSource === 'FALLBACK_UNVERIFIED' ? 'FALLBACK_UNVERIFIED_CATALOG' : null,
        qcvnId: qcvnId2025,
        column: col,
        flowCode,
        inTransition: false,
        applicableStandard: 'QCVN 40:2025/BTNMT',
        verificationStatus: verified ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
        isOfficialConclusion: verified,
        ruleSource,
      };
    }

    // nuoc_thai_sh
    const prefix = isUrbanArea ? 'qcvn14_urban' : 'qcvn14';
    const qcvnId2025 = `${prefix}_${col.toLowerCase()}`;
    const qcvnObj2025 = catalog[qcvnId2025];
    const mandatoryFrom = qcvnObj2025?.mandatoryForAllFrom || '2032-01-01';
    const inTransition = Boolean(isExistingFacility && evaluationDate < mandatoryFrom);

    if (inTransition) {
      const legacyId = [`qcvn14_2008_${prefix}_${col.toLowerCase()}`, `qcvn14_2008_${col.toLowerCase()}`, 'qcvn14_2008']
        .find(candidate => Boolean(catalog[candidate]));
      if (!legacyId) {
        return {
          status: 'NEEDS_REVIEW',
          reason: 'TRANSITION_TABLE_NOT_AVAILABLE',
          qcvnId: null,
          column: col,
          inTransition: true,
          requestedTransitionStandard: 'QCVN 14:2008/BTNMT',
          applicableStandard: 'QCVN 14:2008/BTNMT (chưa có bảng giới hạn trong CSDL)',
          message: 'Cơ sở thuộc giai đoạn chuyển tiếp áp dụng QCVN 14:2008/BTNMT (đến 31/12/2031), nhưng CSDL hiện chưa có bảng giới hạn QCVN 14:2008/BTNMT. Hệ thống không dùng bảng QCVN 14:2025 thay thế.',
          isOfficialConclusion: false,
          ruleSource,
        };
      }

      const legacyObj = catalog[legacyId];
      const verified = ruleSource === 'DATABASE' && legacyObj.verificationStatus === 'VERIFIED';
      return {
        status: ruleSource === 'FALLBACK_UNVERIFIED' ? 'NEEDS_REVIEW' : 'OK',
        reason: ruleSource === 'FALLBACK_UNVERIFIED' ? 'FALLBACK_UNVERIFIED_CATALOG' : null,
        qcvnId: legacyId,
        column: col,
        inTransition: true,
        applicableStandard: legacyObj.ten || 'QCVN 14:2008/BTNMT',
        verificationStatus: verified ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
        isOfficialConclusion: verified,
        ruleSource,
      };
    }

    if (!qcvnObj2025) {
      return {
        status: 'NEEDS_REVIEW',
        reason: 'QCVN_NOT_FOUND_IN_CATALOG',
        message: `Không tìm thấy bộ quy chuẩn ${qcvnId2025} trong CSDL.`,
        qcvnId: null,
        isOfficialConclusion: false,
        ruleSource,
      };
    }

    const verified = ruleSource === 'DATABASE' && qcvnObj2025.verificationStatus === 'VERIFIED';
    return {
      status: ruleSource === 'FALLBACK_UNVERIFIED' ? 'NEEDS_REVIEW' : 'OK',
      reason: ruleSource === 'FALLBACK_UNVERIFIED' ? 'FALLBACK_UNVERIFIED_CATALOG' : null,
      qcvnId: qcvnId2025,
      column: col,
      inTransition: false,
      applicableStandard: 'QCVN 14:2025/BTNMT',
      verificationStatus: verified ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
      isOfficialConclusion: verified,
      ruleSource,
    };
  }

  if (sourceType === 'khi_thai_cn') {
    const inTransition = Boolean(isExistingFacility && evaluationDate < '2032-01-01');
    const colKey = String(receivingWaterClass || 'B').toLowerCase() === 'a' ? 'a' : 'b';
    const qcvnId = inTransition ? `qcvn19_2009_${colKey}` : `qcvn19_2024_${colKey}`;
    if (!catalog[qcvnId]) {
      return {
        status: 'NEEDS_REVIEW',
        reason: inTransition ? 'TRANSITION_TABLE_NOT_AVAILABLE' : 'QCVN_NOT_FOUND_IN_CATALOG',
        qcvnId: null,
        column: colKey.toUpperCase(),
        inTransition,
        message: `Chưa có bảng giới hạn ${qcvnId} trong CSDL.`,
        isOfficialConclusion: false,
        ruleSource,
      };
    }
    const obj = catalog[qcvnId];
    const verified = ruleSource === 'DATABASE' && obj.verificationStatus === 'VERIFIED';
    return {
      status: ruleSource === 'FALLBACK_UNVERIFIED' ? 'NEEDS_REVIEW' : 'OK',
      reason: ruleSource === 'FALLBACK_UNVERIFIED' ? 'FALLBACK_UNVERIFIED_CATALOG' : null,
      qcvnId,
      column: colKey.toUpperCase(),
      inTransition,
      applicableStandard: inTransition ? 'QCVN 19:2009/BTNMT (Chuyển tiếp)' : 'QCVN 19:2024/BTNMT',
      verificationStatus: verified ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
      isOfficialConclusion: verified,
      ruleSource,
    };
  }

  const defaultId = subTypes?.[sourceType]?.[0]?.value || null;
  if (!defaultId || !catalog[defaultId]) {
    return {
      status: 'NEEDS_REVIEW',
      reason: 'QCVN_NOT_FOUND_IN_CATALOG',
      qcvnId: null,
      message: `Không tìm thấy quy chuẩn phù hợp cho nguồn "${sourceType}" trong CSDL.`,
      isOfficialConclusion: false,
      ruleSource,
    };
  }

  const defaultObj = catalog[defaultId];
  const verified = ruleSource === 'DATABASE' && defaultObj.verificationStatus === 'VERIFIED';
  return {
    status: ruleSource === 'FALLBACK_UNVERIFIED' ? 'NEEDS_REVIEW' : 'OK',
    reason: ruleSource === 'FALLBACK_UNVERIFIED' ? 'FALLBACK_UNVERIFIED_CATALOG' : null,
    qcvnId: defaultId,
    inTransition: false,
    verificationStatus: verified ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
    isOfficialConclusion: verified,
    ruleSource,
  };
}

/**
 * Đánh giá mẫu quan trắc so với QCVN và giới hạn riêng trong GPMT.
 * Hỗ trợ đầy đủ max, min, range cho cả QCVN và GPMT, kèm gate fail-closed.
 */
export function evaluateQcvnSample({
  qcvnId,
  measuredValues = {},
  samplingPeriods = {},
  permitLimits = null,
  receivingWaterConfirmed = undefined,
  qcvnDatabase = null,
  ruleSource = 'UNKNOWN',
} = {}) {
  const catalog = qcvnDatabase || {};
  const qcvn = catalog[qcvnId];
  const isFallbackSource = ruleSource === 'FALLBACK_UNVERIFIED' || Object.keys(catalog).length === 0;

  if (!qcvn) {
    return {
      overallStatus: 'NEEDS_REVIEW',
      conclusionStatus: 'NEEDS_REVIEW',
      preliminaryStatus: null,
      trang_thai_tong_quat: 'can_ra_soat',
      reason: Object.keys(catalog).length === 0 ? 'NO_QCVN_CATALOG' : 'UNKNOWN_QCVN',
      isOfficialConclusion: false,
      canExportOfficialReport: false,
      verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
      ruleSource,
      ruleVersion: null,
      unverifiedReasons: [`Không tìm thấy quy chuẩn "${qcvnId || 'N/A'}" trong danh mục hợp lệ.`],
      evaluatedParams: [],
      summary: emptySummary(),
    };
  }

  const needReceivingConfirmation = requiresReceivingWaterConfirmation(qcvnId, qcvn);
  if (receivingWaterConfirmed === false || (needReceivingConfirmation && receivingWaterConfirmed !== true)) {
    return {
      overallStatus: 'NEEDS_REVIEW',
      conclusionStatus: 'NEEDS_REVIEW',
      preliminaryStatus: null,
      trang_thai_tong_quat: 'can_ra_soat',
      reason: 'MISSING_RECEIVING_SOURCE',
      isOfficialConclusion: false,
      canExportOfficialReport: false,
      verificationStatus: qcvn.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'NEEDS_LEGAL_VERIFICATION',
      ruleSource,
      ruleVersion: qcvn.ruleVersion || null,
      unverifiedReasons: ['Chưa xác nhận nguồn tiếp nhận nước thải / nước mặt (Cột A, B hoặc C). Hệ thống không mặc định đạt hay chọn cột thay.'],
      evaluatedParams: [],
      summary: emptySummary(),
    };
  }

  let pass = 0;
  let near = 0;
  let fail = 0;
  let qcvnFail = 0;
  let permitFail = 0;
  let missingRequired = 0;
  let missingOptional = 0;
  let periodMismatch = 0;
  let invalidPermitLimits = 0;
  let hasUnverifiedParam = false;

  const evaluatedParams = (qcvn.tham_so || []).map(p => {
    if (p.nhom) return p;

    const rawVal = measuredValues[p.key] !== undefined
      ? measuredValues[p.key]
      : (p.key === 'Cr_tong' ? measuredValues.Cr3 : undefined);
    const val = (rawVal !== undefined && rawVal !== '' && rawVal !== null) ? parseFloat(rawVal) : undefined;
    const isRequired = p.required !== false;

    if (val === undefined || Number.isNaN(val)) {
      if (isRequired) missingRequired++;
      else missingOptional++;
      return {
        ...p,
        value: undefined,
        status: null,
        qcvnCompliant: null,
        permitCompliant: null,
      };
    }

    if (p.verificationStatus === 'NEEDS_LEGAL_VERIFICATION') {
      hasUnverifiedParam = true;
    }

    const samplePeriod = samplingPeriods?.[p.key] || samplingPeriods?._default;
    if (samplePeriod && p.averagingPeriod && samplePeriod !== p.averagingPeriod) {
      periodMismatch++;
      return {
        ...p,
        value: val,
        status: 'period_mismatch',
        qcvnCompliant: null,
        permitCompliant: null,
        periodMismatchNote: `Sai chu kỳ trung bình: Thông số yêu cầu chu kỳ ${p.averagingPeriod} nhưng mẫu đo ở chu kỳ ${samplePeriod}.`,
      };
    }

    let status = 'pass';
    let qcvnCompliant = true;

    if (p.loai === 'range') {
      if (val < p.min || val > p.max) {
        status = 'fail';
        qcvnCompliant = false;
      } else if (val > p.min && val < p.max && (val < p.min * 1.05 || val > p.max * 0.95)) {
        status = 'near';
      }
    } else if (p.loai === 'min') {
      if (val < p.gioi_han) {
        status = 'fail';
        qcvnCompliant = false;
      } else if (val > p.gioi_han && val < p.gioi_han * 1.2) {
        status = 'near';
      }
    } else {
      if (val > p.gioi_han) {
        status = 'fail';
        qcvnCompliant = false;
      } else if (val > p.gioi_han * 0.8 && val < p.gioi_han) {
        status = 'near';
      }
    }

    if (!qcvnCompliant) qcvnFail++;

    // Đánh giá riêng giới hạn GPMT (hỗ trợ cả range/min/max)
    const rawPermitLimit = permitLimits ? permitLimits[p.key] : undefined;
    const parsedPermit = parsePermitLimit(rawPermitLimit, p.loai || 'max');
    let permitLimit = null;
    let permitCompliant = null;
    let permitNote = null;

    if (parsedPermit.provided) {
      if (!parsedPermit.valid) {
        invalidPermitLimits++;
        permitNote = parsedPermit.error;
        if (qcvnCompliant) {
          status = 'can_ra_soat';
        }
      } else if (p.loai === 'range') {
        permitLimit = parsedPermit.value;
        permitCompliant = val >= parsedPermit.min && val <= parsedPermit.max;
      } else if (p.loai === 'min') {
        permitLimit = parsedPermit.value;
        permitCompliant = val >= parsedPermit.value;
      } else {
        permitLimit = parsedPermit.value;
        permitCompliant = val <= parsedPermit.value;
      }

      if (permitCompliant === false) {
        permitFail++;
        status = 'fail';
      }
    }

    if (status === 'fail') fail++;
    else if (status === 'near') near++;
    else if (status === 'pass') pass++;

    return {
      ...p,
      value: val,
      status,
      qcvnCompliant,
      permitLimit,
      permitCompliant,
      permitNote,
    };
  });

  const total = pass + near + fail + invalidPermitLimits;
  let preliminaryStatus = 'PASS';
  if (fail > 0) {
    preliminaryStatus = 'FAIL';
  } else if (periodMismatch > 0 || invalidPermitLimits > 0) {
    preliminaryStatus = 'NEEDS_REVIEW';
  } else if (total === 0 || missingRequired > 0) {
    preliminaryStatus = 'INCOMPLETE';
  } else if (near > 0) {
    preliminaryStatus = 'PASS_WITH_WARNING';
  }

  const qcvnVerified = qcvn.verificationStatus === 'VERIFIED';
  const unverifiedReasons = [];
  if (isFallbackSource) {
    unverifiedReasons.push('Đang sử dụng dữ liệu QCVN fallback cục bộ (không phải dữ liệu runtime từ PostgreSQL).');
  }
  if (!qcvnVerified) {
    unverifiedReasons.push(`Bộ quy chuẩn "${qcvn.ten || qcvnId}" đang ở trạng thái NEEDS_LEGAL_VERIFICATION (cần đối chiếu văn bản QCVN chính thức).`);
  }
  if (hasUnverifiedParam) {
    unverifiedReasons.push('Mẫu có chứa thông số gắn cờ NEEDS_LEGAL_VERIFICATION.');
  }

  const verificationStatus = (!isFallbackSource && qcvnVerified && !hasUnverifiedParam)
    ? 'VERIFIED'
    : 'NEEDS_LEGAL_VERIFICATION';

  let overallStatus = preliminaryStatus;
  let conclusionStatus = preliminaryStatus;
  let reason = null;

  if (isFallbackSource) {
    reason = 'FALLBACK_UNVERIFIED_CATALOG';
    if (preliminaryStatus === 'PASS' || preliminaryStatus === 'PASS_WITH_WARNING') {
      overallStatus = 'NEEDS_REVIEW';
    }
    conclusionStatus = 'NEEDS_REVIEW';
  } else if (preliminaryStatus === 'FAIL') {
    overallStatus = 'FAIL';
    conclusionStatus = verificationStatus === 'VERIFIED' ? 'FAIL' : 'NEEDS_LEGAL_VERIFICATION';
  } else if (preliminaryStatus === 'INCOMPLETE') {
    overallStatus = 'INCOMPLETE';
    conclusionStatus = 'INCOMPLETE';
    reason = 'MISSING_REQUIRED_PARAMETERS';
  } else if (preliminaryStatus === 'NEEDS_REVIEW') {
    overallStatus = 'NEEDS_REVIEW';
    conclusionStatus = 'NEEDS_REVIEW';
    reason = periodMismatch > 0 ? 'PERIOD_MISMATCH' : 'INVALID_PERMIT_LIMIT';
  } else if (verificationStatus !== 'VERIFIED') {
    overallStatus = 'NEEDS_LEGAL_VERIFICATION';
    conclusionStatus = 'NEEDS_LEGAL_VERIFICATION';
    reason = 'UNVERIFIED_QCVN_RULE';
  }

  const trang_thai_tong_quat = QCVN_STATUS_TO_DB[overallStatus] || 'can_ra_soat';
  const isOfficialConclusion = !isFallbackSource
    && verificationStatus === 'VERIFIED'
    && ['PASS', 'PASS_WITH_WARNING', 'FAIL'].includes(overallStatus);

  return {
    overallStatus,
    conclusionStatus,
    preliminaryStatus,
    trang_thai_tong_quat,
    reason,
    isOfficialConclusion,
    canExportOfficialReport: isOfficialConclusion,
    verificationStatus,
    ruleSource,
    ruleVersion: qcvn.ruleVersion || null,
    unverifiedReasons,
    qcvnComplianceStatus: qcvnFail > 0 ? 'FAIL' : (periodMismatch > 0 ? 'NEEDS_REVIEW' : ((total === 0 || missingRequired > 0) ? 'INCOMPLETE' : 'PASS')),
    permitComplianceStatus: (permitLimits && Object.keys(permitLimits).length > 0)
      ? (invalidPermitLimits > 0 ? 'NEEDS_REVIEW' : (permitFail > 0 ? 'FAIL' : 'PASS'))
      : 'NOT_APPLICABLE',
    evaluatedParams,
    summary: {
      total,
      pass,
      near,
      fail,
      qcvnFail,
      permitFail,
      missingRequired,
      missingOptional,
      periodMismatch,
      invalidPermitLimits,
    },
  };
}
