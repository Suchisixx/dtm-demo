// Hàm dùng chung cho các nhóm kho dữ liệu.
const defaultDb = require('../config/db');

const EXCLUDED_PUBLICATION_STATUSES = new Set([
  'DRAFT',
  'PENDING_REVIEW',
  'EXTRACTED',
  'RAW',
  'REJECTED',
  'ARCHIVED',
  'BAN_NHAP',
  'CHO_DUYET',
  'DA_TRICH_XUAT',
  'THO',
  'TU_CHOI',
  'LUU_TRU',
]);

function makeBidirectionalMapper(canonicalToDb, defaultCanonical = null, defaultDb = null) {
  const toDbMap = new Map();
  const toCanonicalMap = new Map();
  for (const [canon, dbVal] of Object.entries(canonicalToDb)) {
    const cKey = String(canon).trim().toUpperCase();
    const dKey = String(dbVal).trim().toUpperCase();
    toDbMap.set(cKey, dbVal);
    toDbMap.set(dKey, dbVal);
    toCanonicalMap.set(dKey, canon);
    toCanonicalMap.set(cKey, canon);
  }
  return {
    toDb(val, fallback = defaultDb) {
      if (val === undefined || val === null || val === '') return fallback;
      const key = String(val).trim().toUpperCase();
      return toDbMap.get(key) || String(val).trim();
    },
    toCanonical(val, fallback = defaultCanonical) {
      if (val === undefined || val === null || val === '') return fallback;
      const key = String(val).trim().toUpperCase();
      return toCanonicalMap.get(key) || String(val).trim();
    },
  };
}

const VERIFICATION_STATUS_MAPPER = makeBidirectionalMapper({
  VERIFIED: 'da_xac_minh',
  NEEDS_LEGAL_VERIFICATION: 'can_xac_minh_phap_ly',
  PENDING_VERIFICATION: 'cho_xac_minh',
  PENDING_REVIEW: 'cho_duyet',
  NEED_MORE_INFO: 'can_bo_sung',
  EXPIRED: 'het_hieu_luc',
  DRAFT: 'ban_nhap',
  REJECTED: 'tu_choi',
}, 'NEEDS_LEGAL_VERIFICATION', 'can_xac_minh_phap_ly');

const PUBLICATION_STATUS_MAPPER = makeBidirectionalMapper({
  PUBLISHED: 'da_cong_bo',
  DRAFT: 'ban_nhap',
  PENDING_REVIEW: 'cho_duyet',
  EXTRACTED: 'da_trich_xuat',
  RAW: 'tho',
  REJECTED: 'tu_choi',
  ARCHIVED: 'luu_tru',
}, 'PUBLISHED', 'da_cong_bo');

const CAPACITY_SCALE_MAPPER = makeBidirectionalMapper({
  LARGE: 'lon',
  MEDIUM: 'trung_binh',
  SMALL: 'nho',
}, null, null);

const QCVN_STATUS_MAPPER = makeBidirectionalMapper({
  current: 'hien_hanh',
  superseded: 'het_hieu_luc',
  historical: 'lich_su',
  transitional: 'chuyen_tiep',
}, 'current', 'hien_hanh');

const SAMPLE_STATUS_MAPPER = makeBidirectionalMapper({
  PASS: 'dat',
  FAIL: 'vuot',
  INCOMPLETE: 'chua_du_thong_so',
  PERIOD_MISMATCH: 'sai_chu_ky',
  NEEDS_REVIEW: 'can_ra_soat',
}, null, null);

const GIS_LAYER_TYPE_MAPPER = makeBidirectionalMapper({
  INDUSTRIAL_PARK: 'khu_cong_nghiep',
  SENSITIVE_ZONE: 'vung_nhay_cam',
}, null, null);

const IMPACT_STATUS_MAPPER = makeBidirectionalMapper({
  OPEN: 'dang_mo',
  RESOLVED: 'da_xu_ly',
  IGNORED: 'bo_qua',
}, 'OPEN', 'dang_mo');

const CANDIDATE_STATUS_MAPPER = makeBidirectionalMapper({
  PENDING_REVIEW: 'cho_duyet',
  EXTRACTED: 'da_trich_xuat',
  APPROVED: 'da_duyet',
  REJECTED: 'tu_choi',
  NEED_MORE_INFO: 'can_bo_sung',
}, 'PENDING_REVIEW', 'cho_duyet');

const SEVERITY_MAPPER = makeBidirectionalMapper({
  HIGH: 'cao',
  MEDIUM: 'trung_binh',
  LOW: 'thap',
}, 'MEDIUM', 'trung_binh');

const LAW_STATUS_MAPPER = makeBidirectionalMapper({
  valid: 'con_hieu_luc',
  amended: 'da_sua_doi',
  expired: 'het_hieu_luc',
}, 'valid', 'con_hieu_luc');

const PROCESS_STAGE_MAPPER = makeBidirectionalMapper({
  ore_smelting: 'luyen_kim_tu_quang_phe_lieu',
  rolling_only: 'chi_can_keo_thep',
  coal_fired: 'nhiet_dien_than',
  gas_fired: 'nhiet_dien_khi',
  basic_inorganic_or_pesticide: 'hoa_chat_co_ban_bvtv',
  blending_packaging_only: 'phoi_tron_dong_goi',
  pulp_or_recycled: 'san_xuat_bot_giay_tai_che',
  paper_from_commercial_pulp: 'giay_tu_bot_thuong_pham',
  dyeing_washing: 'nhuom_giat_hoan_tat',
  weaving_garment_no_dyeing: 'chi_det_may_khong_nhuom',
  surface_chemical_or_component: 'linh_kien_xu_ly_be_mat',
  assembly_only: 'chi_lap_rap_don_thuan',
}, null, null);

const isVerifiedStatusValue = (val) => VERIFICATION_STATUS_MAPPER.toCanonical(val) === 'VERIFIED';

function isActivePublicationStatus(status) {
  if (!status) return true;
  return !EXCLUDED_PUBLICATION_STATUSES.has(String(status).trim().toUpperCase());
}

async function isVietnamesePhysicalSchema(client) {
  try {
    const result = await client.query(
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = 'nguong_phan_loai' AND c.relkind IN ('r', 'p')
       ) AS ready`
    );
    return result.rows?.[0]?.ready === true;
  } catch {
    return false;
  }
}

function parseJsonSafe(val, fallback) {
  if (val === undefined || val === null) return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return val;
}

function formatDateOnly(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const match = val.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : null;
  }
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function slugifyId(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function normalizeLawNote(note) {
  if (note === undefined || note === null) return null;
  let cleaned = String(note)
    .replace(/[⭐⚠️🌟]/g, '')
    .trim()
    .replace(/\bDoanh nghiệp có EPR obligation\b/gi, 'Doanh nghiệp thuộc diện phải thực hiện trách nhiệm tái chế, xử lý sản phẩm, bao bì của nhà sản xuất, nhập khẩu')
    .replace(/\bEPR obligation\b/gi, 'nghĩa vụ tái chế, xử lý sản phẩm, bao bì của nhà sản xuất, nhập khẩu')
    .replace(/\bEPR\b/g, 'trách nhiệm tái chế, xử lý của nhà sản xuất, nhập khẩu')
    .replace(/^Thay\s+QCVN\s+/i, 'Thay thế QCVN ')
    .replace(/^Mới\s+2025,\s*thay\s+/i, 'Ban hành mới năm 2025, thay thế ')
    .replace(/^Mới\s*—\s*hiệu lực\s*01\/08\/2025\.\s*Rà soát trước khi lập hồ sơ dự án từ\s*8\/2025\./i, 'Mới ban hành — có hiệu lực từ 01/08/2025. Cần rà soát trước khi lập hồ sơ dự án từ tháng 08/2025.')
    .replace(/^QUAN TRỌNG NHẤT\s*—/i, 'Quan trọng nhất —')
    .replace(/^QUAN TRỌNG\s*—/i, 'Quan trọng —')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || null;
}

function normalizeLawDescription(moTa) {
  if (moTa === undefined || moTa === null) return null;
  let cleaned = String(moTa)
    .replace(/[⭐⚠️🌟]/g, '')
    .replace(/\bPre-2020,\s*vẫn còn hiệu lực\./gi, 'Ban hành trước năm 2020, vẫn còn hiệu lực.')
    .replace(/\bquan trắc tự động liên tục\s*\(CEMS\)/gi, 'quan trắc tự động, liên tục')
    .replace(/\bEPR obligation\b/gi, 'trách nhiệm tái chế, xử lý sản phẩm, bao bì của nhà sản xuất, nhập khẩu')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || null;
}

function normalizeLawProvisions(dieuKhoang) {
  if (!Array.isArray(dieuKhoang)) return dieuKhoang;
  return dieuKhoang.map((item) => {
    if (typeof item === 'string') {
      return item
        .replace(/[⭐⚠️🌟]/g, '')
        .replace(/\bliên quan EPR\b/gi, 'liên quan trách nhiệm tái chế, xử lý của nhà sản xuất, nhập khẩu')
        .replace(/\bEPR obligation\b/gi, 'nghĩa vụ tái chế, xử lý của nhà sản xuất, nhập khẩu')
        .trim();
    }
    if (item && typeof item === 'object') {
      return {
        ...item,
        tieu_de: item.tieu_de ? String(item.tieu_de).replace(/[⭐⚠️🌟]/g, '').trim() : item.tieu_de,
      };
    }
    return item;
  });
}

function stripInternalVerificationTags(text) {
  if (text === undefined || text === null) return text;
  return String(text)
    .replace(/\s*\[NEEDS_LEGAL_VERIFICATION\]\s*/gi, '')
    .replace(/\s*\[CAN_XAC_MINH_PHAP_LY\]\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitizeQcvnThamSo(thamSo) {
  if (!Array.isArray(thamSo)) return [];
  return thamSo.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const cleaned = { ...item };
    if (cleaned.nhom) {
      cleaned.nhom = stripInternalVerificationTags(cleaned.nhom);
    }
    if (cleaned.ten) {
      cleaned.ten = stripInternalVerificationTags(cleaned.ten);
    }
    if (cleaned.note) {
      cleaned.note = stripInternalVerificationTags(cleaned.note);
    }
    return cleaned;
  });
}

module.exports = {
  defaultDb,
  EXCLUDED_PUBLICATION_STATUSES,
  isActivePublicationStatus,
  isVietnamesePhysicalSchema,
  parseJsonSafe,
  formatDateOnly,
  slugifyId,
  normalizeLawNote,
  normalizeLawDescription,
  normalizeLawProvisions,
  stripInternalVerificationTags,
  sanitizeQcvnThamSo,
  toDbVerificationStatus: VERIFICATION_STATUS_MAPPER.toDb,
  toCanonicalVerificationStatus: VERIFICATION_STATUS_MAPPER.toCanonical,
  toDbPublicationStatus: PUBLICATION_STATUS_MAPPER.toDb,
  toCanonicalPublicationStatus: PUBLICATION_STATUS_MAPPER.toCanonical,
  toDbScale: CAPACITY_SCALE_MAPPER.toDb,
  toCanonicalScale: CAPACITY_SCALE_MAPPER.toCanonical,
  toDbQcvnStatus: QCVN_STATUS_MAPPER.toDb,
  toCanonicalQcvnStatus: QCVN_STATUS_MAPPER.toCanonical,
  toDbSampleStatus: SAMPLE_STATUS_MAPPER.toDb,
  toCanonicalSampleStatus: SAMPLE_STATUS_MAPPER.toCanonical,
  toDbGisLayerType: GIS_LAYER_TYPE_MAPPER.toDb,
  toCanonicalGisLayerType: GIS_LAYER_TYPE_MAPPER.toCanonical,
  toDbImpactStatus: IMPACT_STATUS_MAPPER.toDb,
  toCanonicalImpactStatus: IMPACT_STATUS_MAPPER.toCanonical,
  toDbCandidateStatus: CANDIDATE_STATUS_MAPPER.toDb,
  toCanonicalCandidateStatus: CANDIDATE_STATUS_MAPPER.toCanonical,
  toDbSeverity: SEVERITY_MAPPER.toDb,
  toCanonicalSeverity: SEVERITY_MAPPER.toCanonical,
  toDbLawStatus: LAW_STATUS_MAPPER.toDb,
  toCanonicalLawStatus: LAW_STATUS_MAPPER.toCanonical,
  toDbProcessStage: PROCESS_STAGE_MAPPER.toDb,
  toCanonicalProcessStage: PROCESS_STAGE_MAPPER.toCanonical,
  isVerifiedStatusValue,
};
