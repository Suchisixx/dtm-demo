// backend/services/qcvn-service.js
// Service đối chiếu QCVN phía Backend: nạp catalog từ PostgreSQL qua rule-repository
// và thực thi đánh giá dùng chung với frontend thông qua qcvn-evaluator.

const defaultDb = require('../config/db');
const { loadQcvnCatalog } = require('./rule-repository');
const { resolveIndustryCode } = require('./classification-service');
const {
  QCVN_STATUS_TO_DB,
  parsePermitLimit,
  selectApplicableQcvn,
  evaluateQcvnSample,
} = require('../../frontend/src/utils/qcvn-evaluator');

const INDUSTRY_TO_QCVN_SOURCE = {
  che_bien_go: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'], note: 'Chế biến gỗ: nước thải công nghiệp và bụi, khí thải lò hơi.' },
  xi_mang: { defaultSourceType: 'khi_thai_cn', secondarySources: ['nuoc_thai_cn'], note: 'Xi măng/clinker: trọng tâm bụi, khí thải công nghiệp; kiểm tra thêm nước thải làm mát.' },
  thep: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'], note: 'Luyện kim/thép: nước thải giải nhiệt/tẩy rửa và khí thải lò luyện.' },
  nhiet_dien: { defaultSourceType: 'khi_thai_cn', secondarySources: ['nuoc_thai_cn'], note: 'Nhiệt điện: khí thải ống khói và nước thải làm mát/FGD.' },
  khai_thac_ks: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khong_khi'], note: 'Khai thác khoáng sản: nước thải mỏ và môi trường không khí xung quanh.' },
  hoa_chat: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  giay_bot: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  det_nhuom: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  thuc_pham: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  nhua_cao_su: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  cao_su_cb: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  duoc_pham: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  dien_tu: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  vat_lieu_xd: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  kcn: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn', 'nuoc_mat'] },
  khu_cong_nghe: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  xl_chat_thai: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn', 'dat'] },
  xl_nuoc_thai: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['nuoc_mat'] },
  khai_thac_nuoc: { defaultSourceType: 'nuoc_mat', secondarySources: ['nuoc_ngam'] },
  khai_thac_dau_khi: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn'] },
  do_thi: { defaultSourceType: 'nuoc_thai_sh', secondarySources: ['khong_khi', 'nuoc_mat'] },
  cao_toc: { defaultSourceType: 'khong_khi', secondarySources: ['nuoc_mat'] },
  duong_sat: { defaultSourceType: 'khong_khi', secondarySources: ['nuoc_thai_sh'] },
  cang_bien: { defaultSourceType: 'nuoc_mat', secondarySources: ['khong_khi', 'nuoc_thai_sh'] },
  cang_hang_khong: { defaultSourceType: 'khong_khi', secondarySources: ['nuoc_thai_sh'] },
  trung_tam_tm: { defaultSourceType: 'nuoc_thai_sh', secondarySources: ['khong_khi'] },
  khach_san: { defaultSourceType: 'nuoc_thai_sh', secondarySources: ['nuoc_mat'] },
  benh_vien: { defaultSourceType: 'nuoc_thai_sh', secondarySources: ['nuoc_thai_cn', 'khi_thai_cn'], note: 'Cơ sở y tế: đối chiếu quy chuẩn nước thải y tế chuyên ngành (nếu có) và QCVN tương ứng.' },
  nuoi_thuy_san: { defaultSourceType: 'nuoc_mat', secondarySources: ['nuoc_thai_cn'] },
  nuoi_ts_bien: { defaultSourceType: 'nuoc_mat', secondarySources: [] },
  xu_ly_ctnh: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn', 'dat'] },
  xu_ly_ctr: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['khi_thai_cn', 'dat'] },
  bai_rac: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['nuoc_ngam', 'dat'] },
  chan_nuoi: { defaultSourceType: 'nuoc_thai_cn', secondarySources: ['nuoc_thai_sh', 'khi_thai_cn'], note: 'Chăn nuôi: cần đối chiếu thêm quy chuẩn nước thải chăn nuôi chuyên ngành.' },
  thuy_dien: { defaultSourceType: 'nuoc_mat', secondarySources: ['nuoc_thai_sh'] },
  dien_mat_troi: { defaultSourceType: 'khong_khi', secondarySources: ['nuoc_thai_sh', 'dat'] },
  dien_gio: { defaultSourceType: 'khong_khi', secondarySources: ['nuoc_thai_sh'] },
  nao_vet: { defaultSourceType: 'nuoc_mat', secondarySources: ['dat'] },
  ho_chua: { defaultSourceType: 'nuoc_mat', secondarySources: [] },
};

let cachedFallbackData = null;

function getFallbackQcvnFixture() {
  if (!cachedFallbackData) {
    try {
      const fixture = require('../../frontend/src/data/qcvn-db');
      cachedFallbackData = {
        QCVN_DATA: fixture.QCVN_DATA || {},
        SUB_TYPES: fixture.SUB_TYPES || {},
      };
    } catch {
      cachedFallbackData = { QCVN_DATA: {}, SUB_TYPES: {} };
    }
  }
  return cachedFallbackData;
}

/**
 * Nạp catalog QCVN từ DB. Nếu DB lỗi hoặc rỗng, dùng fallback kèm cờ FALLBACK_UNVERIFIED.
 */
async function getRuntimeQcvnCatalog({ db = defaultDb } = {}) {
  const loaded = await loadQcvnCatalog({ db });
  if (loaded.ok && loaded.catalog && Object.keys(loaded.catalog).length > 0) {
    return {
      catalog: loaded.catalog,
      ruleSource: 'DATABASE',
      fallbackReason: null,
    };
  }

  const fallback = getFallbackQcvnFixture();
  return {
    catalog: fallback.QCVN_DATA,
    ruleSource: 'FALLBACK_UNVERIFIED',
    fallbackReason: loaded.error || 'DB_UNAVAILABLE',
  };
}

async function selectApplicableQcvnWithDb(options = {}, { db = defaultDb } = {}) {
  const { catalog, ruleSource, fallbackReason } = await getRuntimeQcvnCatalog({ db });
  const fallback = getFallbackQcvnFixture();
  const res = selectApplicableQcvn({
    ...options,
    qcvnDatabase: catalog,
    subTypes: fallback.SUB_TYPES,
    ruleSource,
  });
  return {
    ...res,
    fallbackReason: fallbackReason || null,
  };
}

async function evaluateQcvnSampleWithDb(sampleInput = {}, { db = defaultDb } = {}) {
  const { catalog, ruleSource, fallbackReason } = await getRuntimeQcvnCatalog({ db });
  const res = evaluateQcvnSample({
    ...sampleInput,
    qcvnDatabase: catalog,
    ruleSource,
  });
  return {
    ...res,
    fallbackReason: fallbackReason || null,
  };
}

function getIndustryQcvnMapping(industryCode) {
  const { resolvedCode } = resolveIndustryCode(industryCode || '');
  const matchedCode = (resolvedCode && INDUSTRY_TO_QCVN_SOURCE[resolvedCode])
    ? resolvedCode
    : (industryCode && INDUSTRY_TO_QCVN_SOURCE[industryCode] ? industryCode : null);
  if (!matchedCode) return null;
  const entry = INDUSTRY_TO_QCVN_SOURCE[matchedCode];
  return {
    industryCode: matchedCode,
    sourceType: entry.defaultSourceType,
    defaultSourceType: entry.defaultSourceType,
    secondarySources: entry.secondarySources || [],
    isUrbanArea: matchedCode === 'do_thi',
    note: entry.note || null,
  };
}

/**
 * Xác định QCVN áp dụng hoàn toàn trên server từ projectId hoặc ngữ cảnh nguồn thải.
 * Trả cả kết quả lựa chọn fail-closed + metadata catalog + ruleSource.
 */
async function selectQcvnForProjectWithDb(options = {}, { db = defaultDb } = {}) {
  const {
    projectId = null,
    nganh: inputNganh = null,
    sourceType: inputSourceType = null,
    receivingWaterClass: inputReceivingWaterClass = null,
    receivingWaterConfirmed: inputReceivingWaterConfirmed = undefined,
    flowRate: inputFlowRate = null,
    isUrbanArea: inputIsUrbanArea = undefined,
    isExistingFacility: inputIsExistingFacility = undefined,
    evaluationDate = new Date().toISOString().slice(0, 10),
  } = options;

  let projectRow = null;
  let projectFormData = {};
  if (projectId) {
    try {
      const projRes = await db.query(
        'SELECT id, user_id, name, form_data, classification_result FROM projects WHERE id = $1',
        [Number(projectId)]
      );
      if (projRes && projRes.rowCount > 0) {
        projectRow = projRes.rows[0];
        projectFormData = typeof projectRow.form_data === 'string'
          ? JSON.parse(projectRow.form_data || '{}')
          : (projectRow.form_data || {});
      }
    } catch {
      projectRow = null;
    }
  }

  const rawNganh = inputNganh || projectFormData.nganh || null;
  const { resolvedCode } = resolveIndustryCode(rawNganh || '');
  const industryMapping = getIndustryQcvnMapping(resolvedCode || rawNganh);

  let resolvedSourceType = inputSourceType || null;
  if (!resolvedSourceType) {
    if (projectFormData.nt !== undefined && projectFormData.nt !== null && Number(projectFormData.nt) > 0) {
      resolvedSourceType = industryMapping?.defaultSourceType === 'nuoc_thai_sh'
        ? 'nuoc_thai_sh'
        : 'nuoc_thai_cn';
    } else if ((!projectFormData.nt || Number(projectFormData.nt) <= 0) && projectFormData.kt && Number(projectFormData.kt) > 0) {
      resolvedSourceType = 'khi_thai_cn';
    } else {
      resolvedSourceType = industryMapping?.defaultSourceType || 'nuoc_thai_cn';
    }
  }

  const resolvedFlowRate = (inputFlowRate !== null && inputFlowRate !== undefined && inputFlowRate !== '')
    ? Number(inputFlowRate)
    : (projectFormData.nt !== undefined && projectFormData.nt !== null && projectFormData.nt !== '' && Number(projectFormData.nt) > 0
      ? Number(projectFormData.nt)
      : null);

  const resolvedWaterClass = inputReceivingWaterClass !== null && inputReceivingWaterClass !== undefined && inputReceivingWaterClass !== ''
    ? inputReceivingWaterClass
    : (projectFormData.receivingWaterClass || null);

  const resolvedWaterConfirmed = inputReceivingWaterConfirmed !== undefined
    ? inputReceivingWaterConfirmed === true
    : projectFormData.receivingWaterConfirmed === true;

  const resolvedIsUrbanArea = inputIsUrbanArea !== undefined
    ? Boolean(inputIsUrbanArea)
    : Boolean(projectFormData.isUrbanArea || resolvedCode === 'do_thi');

  const resolvedIsExisting = inputIsExistingFacility !== undefined
    ? Boolean(inputIsExistingFacility)
    : Boolean(projectFormData.isExistingFacility);

  const { catalog, ruleSource, fallbackReason } = await getRuntimeQcvnCatalog({ db });
  const fallback = getFallbackQcvnFixture();

  const selection = selectApplicableQcvn({
    sourceType: resolvedSourceType,
    receivingWaterClass: resolvedWaterClass,
    receivingWaterConfirmed: resolvedWaterConfirmed,
    flowRate: resolvedFlowRate,
    isUrbanArea: resolvedIsUrbanArea,
    isExistingFacility: resolvedIsExisting,
    evaluationDate,
    qcvnDatabase: catalog,
    subTypes: fallback.SUB_TYPES,
    ruleSource,
  });

  const applicableCatalogItem = selection.qcvnId ? (catalog[selection.qcvnId] || null) : null;

  return {
    ...selection,
    sourceType: resolvedSourceType,
    industryCode: resolvedCode || rawNganh || null,
    industryMapping,
    resolvedContext: {
      projectId: projectRow?.id || (projectId ? Number(projectId) : null),
      projectName: projectRow?.name || null,
      sourceType: resolvedSourceType,
      flowRate: resolvedFlowRate,
      receivingWaterClass: resolvedWaterClass,
      receivingWaterConfirmed: resolvedWaterConfirmed,
      isUrbanArea: resolvedIsUrbanArea,
      isExistingFacility: resolvedIsExisting,
      evaluationDate,
    },
    applicableCatalogItem,
    ruleSource,
    ruleVersion: applicableCatalogItem?.ruleVersion || '2026.2-audit',
    fallbackReason: fallbackReason || null,
  };
}

module.exports = {
  QCVN_STATUS_TO_DB,
  INDUSTRY_TO_QCVN_SOURCE,
  parsePermitLimit,
  selectApplicableQcvn,
  evaluateQcvnSample,
  getFallbackQcvnFixture,
  getRuntimeQcvnCatalog,
  getIndustryQcvnMapping,
  selectApplicableQcvnWithDb,
  selectQcvnForProjectWithDb,
  evaluateQcvnSampleWithDb,
};
