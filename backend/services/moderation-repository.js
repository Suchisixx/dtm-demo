// backend/services/moderation-repository.js
// Kho dữ liệu kiểm duyệt dữ liệu pháp lý (Văn bản pháp luật, Quy tắc phân loại, Danh mục QCVN).
// Sử dụng mã trạng thái tiếng Việt thống nhất:
//   cho_duyet             : Chờ kiểm duyệt
//   can_xac_minh_phap_ly  : Cần xác minh pháp lý
//   da_xac_minh           : Đã phê duyệt / Đã xác minh
//   tu_choi               : Từ chối
//   can_bo_sung           : Cần bổ sung thông tin
//   het_hieu_luc          : Ngừng áp dụng / Hết hiệu lực
//   ban_nhap              : Bản nháp

const {
  defaultDb,
  isVietnamesePhysicalSchema,
  parseJsonSafe,
  formatDateOnly,
  toDbVerificationStatus,
  toCanonicalVerificationStatus,
  toDbPublicationStatus,
  toCanonicalPublicationStatus,
  toDbCandidateStatus,
  toCanonicalCandidateStatus,
  toDbQcvnStatus,
  toCanonicalQcvnStatus,
  toDbScale,
} = require('./repository-shared');

// Nhãn tiếng Việt hiển thị cho mọi mã trạng thái kiểm duyệt
const VIETNAMESE_STATUS_LABELS = {
  cho_duyet: 'Chờ kiểm duyệt',
  can_xac_minh_phap_ly: 'Cần xác minh pháp lý',
  da_xac_minh: 'Đã phê duyệt',
  da_duyet: 'Đã phê duyệt',
  da_ap_dung: 'Đã áp dụng',
  tu_choi: 'Từ chối',
  can_bo_sung: 'Cần bổ sung thông tin',
  het_hieu_luc: 'Ngừng áp dụng / Hết hiệu lực',
  lich_su: 'Ngừng áp dụng / Lịch sử',
  ban_nhap: 'Bản nháp',
  da_cong_bo: 'Đã công bố',
  con_hieu_luc: 'Đang có hiệu lực',
  da_sua_doi: 'Đã sửa đổi',
  dang_mo: 'Đang chờ xử lý',
  da_xu_ly: 'Đã xử lý',
  bo_qua: 'Đã bỏ qua',
};

// Chuẩn hóa mọi mã trạng thái (cả tiếng Việt lẫn mã cũ trong DB) về mã tiếng Việt thống nhất
function toVietnameseModerationStatus(raw, fallback = 'can_xac_minh_phap_ly') {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const val = String(raw).trim().toLowerCase();
  if (val === 'cho_duyet' || val === 'pending_review' || val === 'extracted' || val === 'da_trich_xuat' || val === 'pending_verification' || val === 'cho_xac_minh') {
    return 'cho_duyet';
  }
  if (val === 'can_xac_minh_phap_ly' || val === 'needs_legal_verification' || val === 'needs_review' || val === 'can_ra_soat') {
    return 'can_xac_minh_phap_ly';
  }
  if (val === 'da_xac_minh' || val === 'verified' || val === 'da_duyet' || val === 'approved' || val === 'da_ap_dung' || val === 'applied') {
    return 'da_xac_minh';
  }
  if (val === 'tu_choi' || val === 'rejected') {
    return 'tu_choi';
  }
  if (val === 'can_bo_sung' || val === 'need_more_info') {
    return 'can_bo_sung';
  }
  if (val === 'het_hieu_luc' || val === 'expired' || val === 'lich_su' || val === 'historical' || val === 'superseded') {
    return 'het_hieu_luc';
  }
  if (val === 'ban_nhap' || val === 'draft') {
    return 'ban_nhap';
  }
  return val;
}

function getVietnameseStatusLabel(code) {
  const norm = toVietnameseModerationStatus(code, 'cho_duyet');
  return VIETNAMESE_STATUS_LABELS[norm] || VIETNAMESE_STATUS_LABELS[code] || 'Chờ kiểm duyệt';
}

function inferIssuingAgency(so = '', type = '', ten = '') {
  const s = String(so || '').toUpperCase();
  const t = String(type || '').toLowerCase();
  const title = String(ten || '').toLowerCase();
  if (s.includes('QH') || t === 'luat') return 'Quốc hội';
  if (s.includes('NĐ-CP') || s.includes('ND-CP') || s.includes('NQ-CP') || t === 'nd') return 'Chính phủ';
  if (s.includes('BNNMT') || title.includes('nông nghiệp và môi trường')) return 'Bộ Nông nghiệp và Môi trường';
  if (s.includes('BTNMT') || t === 'tt' || t === 'qcvn' || t === 'vbhn') return 'Bộ Tài nguyên và Môi trường';
  if (s.includes('QĐ-TTG') || s.includes('QD-TTG')) return 'Thủ tướng Chính phủ';
  return 'Cơ quan nhà nước có thẩm quyền';
}

let moderationSchemaReady = false;

/**
 * Migration an toàn, không xóa dữ liệu cũ:
 * Bổ sung các cột kiểm duyệt cho bảng vật lý `luat` (hoặc `laws` trong môi trường test mock)
 * và cập nhật View `laws` tương ứng.
 */
async function ensureModerationSchema(db = defaultDb) {
  if (moderationSchemaReady) return;
  try {
    const isVi = await isVietnamesePhysicalSchema(db);
    if (isVi) {
      await db.query(`
        ALTER TABLE public.luat
          ADD COLUMN IF NOT EXISTS co_quan_ban_hanh TEXT,
          ADD COLUMN IF NOT EXISTS ngay_ban_hanh DATE,
          ADD COLUMN IF NOT EXISTS ngay_hieu_luc DATE,
          ADD COLUMN IF NOT EXISTS nguon_phat_hien TEXT DEFAULT 'he_thong',
          ADD COLUMN IF NOT EXISTS phat_hien_luc TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS trang_thai_kiem_duyet TEXT DEFAULT 'da_xac_minh',
          ADD COLUMN IF NOT EXISTS nguoi_duyet TEXT,
          ADD COLUMN IF NOT EXISTS duyet_luc TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS ghi_chu_duyet TEXT,
          ADD COLUMN IF NOT EXISTS danh_sach_kiem_tra JSONB DEFAULT '{}'::jsonb;
      `);

      await db.query(`
        ALTER TABLE public.nguong_phan_loai
          ADD COLUMN IF NOT EXISTS danh_sach_kiem_tra JSONB DEFAULT '{}'::jsonb;
      `).catch(() => {});

      await db.query(`
        ALTER TABLE public.quy_chuan_qcvn
          ADD COLUMN IF NOT EXISTS danh_sach_kiem_tra JSONB DEFAULT '{}'::jsonb;
      `).catch(() => {});

      await db.query(`
        ALTER TABLE public.de_xuat_quy_tac
          ADD COLUMN IF NOT EXISTS danh_sach_kiem_tra JSONB DEFAULT '{}'::jsonb;
      `).catch(() => {});

      await db.query(`
        CREATE OR REPLACE VIEW public.laws AS
        SELECT
          t.ma AS id,
          t.loai AS type,
          t.nam AS year,
          t.ngay_sap_xep AS sort_date,
          t.so_hieu AS so,
          t.ten_van_ban AS ten,
          t.hieu_luc AS hieuluc,
          t.trang_thai AS status,
          t.mo_ta AS mo_ta,
          t.dieu_khoan AS dieu_khoang,
          t.ghi_chu AS note,
          t.lien_ket AS link,
          t.crawler_cap_nhat_luc AS last_crawled_mod,
          t.cap_nhat_luc AS updated_at,
          t.co_quan_ban_hanh AS issuing_agency,
          t.ngay_ban_hanh AS issued_date,
          t.ngay_hieu_luc AS effective_date,
          t.nguon_phat_hien AS detection_source,
          t.phat_hien_luc AS detected_at,
          t.trang_thai_kiem_duyet AS verification_status,
          t.nguoi_duyet AS reviewed_by,
          t.duyet_luc AS reviewed_at,
          t.ghi_chu_duyet AS review_note,
          t.danh_sach_kiem_tra AS review_checklist
        FROM public.luat t;
      `);

      await db.query(`
        CREATE OR REPLACE VIEW public.classification_thresholds AS
        SELECT
          t.ma AS id, t.nganh_nghe_ma AS industry_code, t.gia_tri_toi_thieu AS min_value,
          t.gia_tri_toi_da AS max_value, t.don_vi AS unit, t.nhom_du_an AS project_group,
          t.ho_so_phap_ly AS legal_doc_required, t.phu_luc_phap_ly_ma AS appendix_id,
          t.cong_doan AS process_stage, t.toan_tu AS operator, t.quy_mo_cong_suat AS capacity_scale,
          t.tham_quyen AS tq, t.tham_quyen_lich_su AS historical_tq, t.phu_luc AS phu_luc,
          t.can_cu_phap_ly AS legal_ref, t.luat_ma AS law_id, t.hieu_luc_tu AS effective_from,
          t.hieu_luc_den AS effective_to, t.trang_thai_xac_minh AS verification_status,
          t.trang_thai_cong_bo AS publication_status, t.thu_tu_nguong AS tier_order,
          t.phien_ban_quy_tac AS rule_version, t.nguon_tham_chieu AS source_ref,
          t.nguoi_duyet AS approved_by, t.duyet_luc AS approved_at,
          t.la_phien_ban_hieu_luc AS is_active_version, t.het_hieu_luc_luc AS superseded_at,
          t.cap_nhat_luc AS updated_at, t.danh_sach_kiem_tra AS review_checklist
        FROM public.nguong_phan_loai t;
      `).catch(() => {});

      await db.query(`
        CREATE OR REPLACE VIEW public.qcvns AS
        SELECT
          t.ma AS id, t.ten_quy_chuan AS ten, t.pham_vi_ap_dung AS ap_dung,
          t.tham_so AS tham_so, t.ma_tieu_chuan AS standard_code,
          t.phien_ban_tieu_chuan AS standard_version, t.trang_thai AS status,
          t.loai_nguon AS source_type, t.ma_cot AS column_code,
          t.khoang_luu_luong AS flow_range, t.hieu_luc_tu AS effective_from,
          t.hieu_luc_den AS effective_to, t.bat_buoc_tu AS mandatory_for_all_from,
          t.thay_the AS replaces, t.quy_tac_chuyen_tiep AS transition_rules,
          t.trang_thai_xac_minh AS verification_status, t.trang_thai_cong_bo AS publication_status,
          t.tai_lieu_nguon AS source_document, t.phien_ban_quy_tac AS rule_version,
          t.nguoi_xac_minh AS verified_by, t.xac_minh_luc AS verified_at,
          t.cong_bo_luc AS published_at, t.cap_nhat_luc AS updated_at,
          t.danh_sach_kiem_tra AS review_checklist
        FROM public.quy_chuan_qcvn t;
      `).catch(() => {});

      await db.query(`
        CREATE OR REPLACE VIEW public.rule_candidates AS
        SELECT
          t.ma AS id, t.luat_ma AS law_id, t.ten_van_ban AS law_title,
          t.loai_doi_tuong AS target_type, t.ma_doi_tuong AS target_code,
          t.tieu_de AS title, t.du_lieu_de_xuat AS proposed_data,
          t.tom_tat_thay_doi AS diff_summary, t.do_tin_cay_trich_xuat AS extraction_confidence,
          t.trich_doan_nguon AS source_excerpt, t.trang_thai AS status,
          t.nguoi_duyet_ma AS reviewed_by, t.duyet_luc AS reviewed_at,
          t.ghi_chu_duyet AS review_note, t.tao_luc AS created_at,
          t.cap_nhat_luc AS updated_at, t.danh_sach_kiem_tra AS review_checklist
        FROM public.de_xuat_quy_tac t;
      `).catch(() => {});

      // Chuẩn hóa dữ liệu cũ chưa có trạng thái kiểm duyệt hoặc nguồn phát hiện
      await db.query(`
        UPDATE public.luat
        SET trang_thai_kiem_duyet = CASE
              WHEN trang_thai IN ('het_hieu_luc', 'expired') THEN 'het_hieu_luc'
              ELSE COALESCE(NULLIF(trang_thai_kiem_duyet, ''), 'da_xac_minh')
            END,
            nguon_phat_hien = CASE
              WHEN crawler_cap_nhat_luc IS NOT NULL AND (nguon_phat_hien IS NULL OR nguon_phat_hien = 'he_thong') THEN 'crawler'
              ELSE COALESCE(NULLIF(nguon_phat_hien, ''), 'he_thong')
            END,
            ngay_ban_hanh = COALESCE(ngay_ban_hanh, CASE WHEN ngay_sap_xep ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN ngay_sap_xep::date ELSE NULL END)
        WHERE trang_thai_kiem_duyet IS NULL OR co_quan_ban_hanh IS NULL OR nguon_phat_hien IS NULL;
      `);
    } else {
      await db.query(`
        ALTER TABLE laws
          ADD COLUMN IF NOT EXISTS issuing_agency TEXT,
          ADD COLUMN IF NOT EXISTS issued_date DATE,
          ADD COLUMN IF NOT EXISTS effective_date DATE,
          ADD COLUMN IF NOT EXISTS detection_source TEXT DEFAULT 'he_thong',
          ADD COLUMN IF NOT EXISTS detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'da_xac_minh',
          ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
          ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS review_note TEXT;
      `).catch(() => {});
    }

    // Đảm bảo bảng phien_ban_quy_tac / rule_versions tồn tại để lưu lịch sử phiên bản quy tắc
    if (!isVi) {
      await db.query(`
        CREATE TABLE IF NOT EXISTS rule_versions (
          id SERIAL PRIMARY KEY,
          rule_id INTEGER,
          version VARCHAR(50),
          expression JSONB,
          changed_by INTEGER,
          changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          change_reason TEXT
        );
      `).catch(() => {});
    }
    moderationSchemaReady = true;
  } catch {
    // Trong môi trường mock DB đơn giản không hỗ trợ DDL đầy đủ thì bỏ qua lỗi DDL
  }
}

/**
 * Lưu một bản chụp phiên bản cũ/mới vào bảng `phien_ban_quy_tac` (`rule_versions`)
 * để không bao giờ mất quy tắc cũ khi chỉnh sửa hoặc phê duyệt đề xuất.
 */
async function recordRuleVersionSnapshot(
  db,
  { ruleId = null, version = '2026.2', targetType = 'quy_tac', targetCode = '', beforeData = null, afterData = null, changedBy = null, changedByName = 'admin', legalBasis = null, effectiveFrom = null, effectiveTo = null, changeReason = '' } = {}
) {
  try {
    await ensureModerationSchema(db);
    const numericRuleId = Number.isInteger(Number(ruleId)) && Number(ruleId) > 0 ? Number(ruleId) : null;
    const expressionPayload = {
      loai_doi_tuong: targetType,
      ma_doi_tuong: String(targetCode || numericRuleId || ''),
      phien_ban: version,
      nguoi_thuc_hien: changedByName,
      can_cu_phap_ly: legalBasis,
      hieu_luc_tu: effectiveFrom,
      hieu_luc_den: effectiveTo,
      ly_do: changeReason,
      du_lieu_truoc: beforeData,
      du_lieu_sau: afterData,
      ghi_nhan_luc: new Date().toISOString(),
    };

    const res = await db.query(
      `INSERT INTO rule_versions (rule_id, version, expression, changed_by, changed_at, change_reason)
       VALUES ($1, $2, $3::jsonb, $4, CURRENT_TIMESTAMP, $5)
       RETURNING *`,
      [
        numericRuleId,
        String(version || '2026.2').slice(0, 50),
        JSON.stringify(expressionPayload),
        Number.isInteger(Number(changedBy)) ? Number(changedBy) : null,
        changeReason || `Cập nhật phiên bản ${targetType} ${targetCode || numericRuleId || ''}`.trim(),
      ]
    );
    return res.rows?.[0] || null;
  } catch {
    return null;
  }
}

function normalizeLawModerationRow(row) {
  if (!row) return null;
  const rawVerification = row.verification_status || row.trang_thai_kiem_duyet || (row.status === 'het_hieu_luc' ? 'het_hieu_luc' : 'da_xac_minh');
  const statusVi = toVietnameseModerationStatus(rawVerification, 'da_xac_minh');
  const detectionSource = row.detection_source || row.nguon_phat_hien || (row.last_crawled_mod ? 'crawler' : 'he_thong');
  const issuingAgency = row.issuing_agency || row.co_quan_ban_hanh || inferIssuingAgency(row.so, row.type, row.ten);
  const issuedDate = formatDateOnly(row.issued_date || row.ngay_ban_hanh || row.sort_date) || (row.year ? `${row.year}-01-01` : null);
  const effectiveDate = formatDateOnly(row.effective_date || row.ngay_hieu_luc) || row.hieuluc || null;
  const detectedAt = row.detected_at || row.phat_hien_luc || row.last_crawled_mod || row.updated_at || null;
  const dieuKhoang = parseJsonSafe(row.dieu_khoang, []);

  return {
    id: row.id,
    ten: row.ten,
    so: row.so,
    type: row.type,
    year: row.year,
    issuing_agency: issuingAgency,
    issued_date: issuedDate,
    effective_date: effectiveDate,
    hieuluc: row.hieuluc || effectiveDate || 'Đang có hiệu lực',
    status: row.status || 'con_hieu_luc',
    detection_source: detectionSource,
    detection_source_label: detectionSource === 'crawler' ? 'Trình thu thập tự động' : (detectionSource === 'thu_cong' ? 'Thêm thủ công' : 'Cơ sở dữ liệu hệ thống'),
    detected_at: detectedAt,
    verification_status: statusVi,
    verification_status_label: getVietnameseStatusLabel(statusVi),
    reviewed_by: row.reviewed_by || row.nguoi_duyet || null,
    reviewed_at: row.reviewed_at || row.duyet_luc || null,
    review_note: row.review_note || row.ghi_chu_duyet || null,
    review_checklist: parseJsonSafe(row.review_checklist || row.danh_sach_kiem_tra, {}),
    mo_ta: row.mo_ta || '',
    note: row.note || '',
    link: row.link || '',
    dieu_khoang: Array.isArray(dieuKhoang) ? dieuKhoang : [],
    provisions_count: Array.isArray(dieuKhoang) ? dieuKhoang.length : 0,
    last_crawled_mod: row.last_crawled_mod || null,
    updated_at: row.updated_at || null,
  };
}

/**
 * 3.1. Danh sách văn bản pháp luật phục vụ kiểm duyệt
 */
async function listLawsForModeration({
  verificationStatus = null,
  detectionSource = null,
  type = null,
  dateFrom = null,
  dateTo = null,
  search = null,
  db = defaultDb,
} = {}) {
  await ensureModerationSchema(db);
  const res = await db.query('SELECT * FROM laws ORDER BY COALESCE(sort_date, \'\') DESC, year DESC, id ASC');
  let items = (res.rows || []).map(normalizeLawModerationRow);

  if (verificationStatus && verificationStatus !== 'tat_ca' && verificationStatus !== 'ALL') {
    const targetStatus = toVietnameseModerationStatus(verificationStatus);
    items = items.filter(item => item.verification_status === targetStatus);
  }
  if (detectionSource && detectionSource !== 'tat_ca' && detectionSource !== 'ALL') {
    items = items.filter(item => item.detection_source === detectionSource);
  }
  if (type && type !== 'tat_ca' && type !== 'ALL') {
    items = items.filter(item => item.type === type);
  }
  if (dateFrom) {
    const fromStr = String(dateFrom).slice(0, 10);
    items = items.filter(item => !item.issued_date || String(item.issued_date).slice(0, 10) >= fromStr);
  }
  if (dateTo) {
    const toStr = String(dateTo).slice(0, 10);
    items = items.filter(item => !item.issued_date || String(item.issued_date).slice(0, 10) <= toStr);
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    items = items.filter(item =>
      String(item.ten || '').toLowerCase().includes(q)
      || String(item.so || '').toLowerCase().includes(q)
      || String(item.id || '').toLowerCase().includes(q)
      || String(item.issuing_agency || '').toLowerCase().includes(q)
      || String(item.mo_ta || '').toLowerCase().includes(q)
    );
  }

  return items;
}

/**
 * 3.1. Xem chi tiết một văn bản pháp luật kèm lịch sử kiểm duyệt & quy tắc liên quan
 */
async function getLawModerationDetail(lawId, { db = defaultDb } = {}) {
  await ensureModerationSchema(db);
  const cleanId = String(lawId || '').trim();
  if (!cleanId) throw new Error('LAW_ID_REQUIRED');

  const lawRes = await db.query('SELECT * FROM laws WHERE id = $1', [cleanId]);
  if (!lawRes.rows || lawRes.rowCount === 0) throw new Error('LAW_NOT_FOUND');
  const law = normalizeLawModerationRow(lawRes.rows[0]);

  const [historyRes, impactsRes, candidatesRes, thresholdsRes] = await Promise.all([
    db.query(
      `SELECT h.*, u.username AS actor_username, u.full_name AS actor_name
       FROM law_update_history h
       LEFT JOIN users u ON h.updated_by = u.id
       WHERE h.law_id = $1
       ORDER BY h.updated_at DESC, h.id DESC`,
      [cleanId]
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT * FROM law_rule_impacts WHERE law_id = $1 ORDER BY created_at DESC, id DESC`,
      [cleanId]
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT * FROM rule_candidates WHERE law_id = $1 ORDER BY created_at DESC, id DESC`,
      [cleanId]
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT ct.id, ct.industry_code, COALESCE(ind.display_name, ind.name, ct.industry_code) AS industry_name,
              ct.project_group, ct.legal_doc_required, ct.tq, ct.legal_ref, ct.verification_status
       FROM classification_thresholds ct
       LEFT JOIN industries ind ON ct.industry_code = ind.code
       WHERE ct.law_id = $1 OR ct.legal_ref ILIKE $2
       ORDER BY ct.industry_code, ct.tier_order ASC
       LIMIT 50`,
      [cleanId, `%${law.so || cleanId}%`]
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    law,
    history: historyRes.rows || [],
    impacts: (impactsRes.rows || []).map(r => ({
      ...r,
      status: toVietnameseModerationStatus(r.status, r.status),
    })),
    candidates: (candidatesRes.rows || []).map(r => ({
      ...r,
      status: toVietnameseModerationStatus(r.status, 'cho_duyet'),
      proposed_data: parseJsonSafe(r.proposed_data, {}),
    })),
    relatedThresholds: (thresholdsRes.rows || []).map(r => ({
      ...r,
      verification_status: toVietnameseModerationStatus(r.verification_status, 'can_xac_minh_phap_ly'),
    })),
  };
}

/**
 * 3.1. Kiểm duyệt văn bản pháp luật (Phê duyệt / Từ chối / Cần bổ sung thông tin / Ngừng áp dụng)
 * Lưu ý quan trọng: Phê duyệt văn bản KHÔNG tự động ghi đè các quy tắc phân loại hiện hành.
 */
async function reviewLawRecord(
  db,
  {
    lawId,
    decision,
    reviewNote = null,
    reviewedByUserId = null,
    reviewedByName = 'admin',
    metadataPatch = null,
  } = {}
) {
  await ensureModerationSchema(db);
  const cleanId = String(lawId || '').trim();
  if (!cleanId) throw new Error('LAW_ID_REQUIRED');

  const existingRes = await db.query('SELECT * FROM laws WHERE id = $1', [cleanId]);
  if (!existingRes.rows || existingRes.rowCount === 0) throw new Error('LAW_NOT_FOUND');
  const beforeLaw = normalizeLawModerationRow(existingRes.rows[0]);

  const normDecision = toVietnameseModerationStatus(decision, '');
  if (!['da_xac_minh', 'tu_choi', 'can_bo_sung', 'het_hieu_luc', 'cho_duyet'].includes(normDecision)) {
    throw new Error('INVALID_REVIEW_DECISION');
  }

  const cleanNote = String(reviewNote || '').trim();
  if ((normDecision === 'tu_choi' || normDecision === 'can_bo_sung') && !cleanNote) {
    throw new Error('REVIEW_REASON_REQUIRED');
  }

  const nextStatus = normDecision === 'het_hieu_luc'
    ? 'het_hieu_luc'
    : (metadataPatch?.status || existingRes.rows[0].status || 'con_hieu_luc');
  const nextHieuluc = normDecision === 'het_hieu_luc'
    ? 'Hết hiệu lực'
    : (metadataPatch?.hieuluc || existingRes.rows[0].hieuluc || 'Đang có hiệu lực');

  const patchTen = metadataPatch?.ten !== undefined ? String(metadataPatch.ten).trim() : existingRes.rows[0].ten;
  const patchSo = metadataPatch?.so !== undefined ? String(metadataPatch.so).trim() : existingRes.rows[0].so;
  const patchType = metadataPatch?.type !== undefined ? String(metadataPatch.type).trim() : existingRes.rows[0].type;
  const patchAgency = metadataPatch?.issuing_agency !== undefined
    ? String(metadataPatch.issuing_agency).trim()
    : (existingRes.rows[0].issuing_agency || inferIssuingAgency(patchSo, patchType, patchTen));
  const patchIssuedDate = metadataPatch?.issued_date !== undefined
    ? formatDateOnly(metadataPatch.issued_date)
    : formatDateOnly(existingRes.rows[0].issued_date || existingRes.rows[0].sort_date);
  const patchEffectiveDate = metadataPatch?.effective_date !== undefined
    ? formatDateOnly(metadataPatch.effective_date)
    : formatDateOnly(existingRes.rows[0].effective_date);
  const patchLink = metadataPatch?.link !== undefined ? metadataPatch.link : existingRes.rows[0].link;
  const patchMoTa = metadataPatch?.mo_ta !== undefined ? metadataPatch.mo_ta : existingRes.rows[0].mo_ta;
  const patchNote = metadataPatch?.note !== undefined ? metadataPatch.note : existingRes.rows[0].note;

  const updRes = await db.query(
    `UPDATE laws
     SET ten = $1,
         so = $2,
         type = $3,
         status = $4,
         hieuluc = $5,
         issuing_agency = $6,
         issued_date = $7,
         effective_date = $8,
         link = $9,
         mo_ta = $10,
         note = $11,
         verification_status = $12,
         reviewed_by = $13,
         reviewed_at = CURRENT_TIMESTAMP,
         review_note = $14
     WHERE id = $15
     RETURNING *`,
    [
      patchTen,
      patchSo,
      patchType,
      nextStatus,
      nextHieuluc,
      patchAgency,
      patchIssuedDate,
      patchEffectiveDate,
      patchLink,
      patchMoTa,
      patchNote,
      normDecision,
      String(reviewedByName),
      cleanNote || null,
      cleanId,
    ]
  );

  const afterLaw = normalizeLawModerationRow(updRes.rows[0]);

  const actionDesc = `[Kiểm duyệt văn bản: ${getVietnameseStatusLabel(normDecision)}] ${afterLaw.so || afterLaw.id}${cleanNote ? ` — Lý do/Ghi chú: ${cleanNote}` : ''}`;
  await db.query(
    `INSERT INTO law_update_history (law_id, action, updated_by, description)
     VALUES ($1, $2, $3, $4)`,
    [cleanId, `kiem_duyet_${normDecision}`, reviewedByUserId, actionDesc]
  ).catch(() => {});

  return {
    before: beforeLaw,
    after: afterLaw,
  };
}

/**
 * 3.2. Xem chi tiết một quy tắc phân loại kèm lịch sử phiên bản (`phien_ban_quy_tac`) & đề xuất thay đổi
 */
async function getThresholdModerationDetail(id, { db = defaultDb } = {}) {
  await ensureModerationSchema(db);
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error('INVALID_RULE_ID');

  const res = await db.query(
    `SELECT ct.*, COALESCE(ind.display_name, ind.name, ct.industry_code) AS industry_name,
            ind.verification_status AS industry_verification_status,
            ind.source_document AS industry_source_document
     FROM classification_thresholds ct
     LEFT JOIN industries ind ON ct.industry_code = ind.code
     WHERE ct.id = $1`,
    [numericId]
  );
  if (!res.rows || res.rowCount === 0) throw new Error('RULE_NOT_FOUND');
  const row = res.rows[0];
  const statusVi = toVietnameseModerationStatus(row.verification_status, 'can_xac_minh_phap_ly');

  const [versionsRes, proposalsRes, lawRes] = await Promise.all([
    db.query(
      `SELECT rv.*, u.username AS actor_username, u.full_name AS actor_name
       FROM rule_versions rv
       LEFT JOIN users u ON rv.changed_by = u.id
       WHERE rv.rule_id = $1
       ORDER BY rv.changed_at DESC, rv.id DESC`,
      [numericId]
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT * FROM rule_candidates
       WHERE target_code = $1 OR target_code = $2
       ORDER BY created_at DESC, id DESC`,
      [String(numericId), String(row.industry_code)]
    ).catch(() => ({ rows: [] })),
    row.law_id
      ? db.query('SELECT id, so, ten, status, hieuluc, link FROM laws WHERE id = $1', [row.law_id]).catch(() => ({ rows: [] }))
      : Promise.resolve({ rows: [] }),
  ]);

  return {
    rule: {
      ...row,
      industry_name: row.industry_name || row.industry_code,
      min_value: parseFloat(row.min_value),
      max_value: row.max_value !== null && row.max_value !== undefined ? parseFloat(row.max_value) : null,
      effective_from: formatDateOnly(row.effective_from),
      effective_to: formatDateOnly(row.effective_to),
      verification_status: statusVi,
      verification_status_label: getVietnameseStatusLabel(statusVi),
      publication_status: toDbPublicationStatus(row.publication_status || 'da_cong_bo'),
      review_checklist: parseJsonSafe(row.review_checklist || row.danh_sach_kiem_tra, {}),
    },
    relatedLaw: lawRes.rows?.[0] || null,
    versions: (versionsRes.rows || []).map(v => ({
      ...v,
      expression: parseJsonSafe(v.expression, {}),
    })),
    proposals: (proposalsRes.rows || []).map(p => ({
      ...p,
      status: toVietnameseModerationStatus(p.status, 'cho_duyet'),
      status_label: getVietnameseStatusLabel(p.status),
      proposed_data: parseJsonSafe(p.proposed_data, {}),
      diff_summary: parseJsonSafe(p.diff_summary, {}),
    })),
  };
}

/**
 * 3.2 & 3.3. Tạo đề xuất thay đổi quy tắc phân loại hoặc QCVN (`de_xuat_quy_tac` / `rule_candidates`)
 * Giữ nguyên quy tắc đang có hiệu lực (`da_xac_minh`) cho đến khi đề xuất được phê duyệt!
 */
async function createModerationProposal(
  db,
  {
    targetType = 'nguong_phan_loai',
    targetId = null,
    targetCode = null,
    lawId = null,
    lawTitle = null,
    title = '',
    proposedData = {},
    sourceExcerpt = '',
    reason = '',
    createdByUserId = null,
    createdByName = 'admin',
  } = {}
) {
  await ensureModerationSchema(db);
  const normType = String(targetType || '').toLowerCase();
  const isQcvn = normType === 'qcvn' || normType === 'quy_chuan_qcvn';
  const dbTargetType = isQcvn ? 'QCVN' : 'CLASSIFICATION_THRESHOLD';

  let beforeSnapshot = null;
  let resolvedTargetCode = String(targetCode || targetId || '').trim();
  let resolvedLawId = String(lawId || proposedData.law_id || 'cap_nhat_thu_cong').trim();
  let resolvedTitle = String(title || '').trim();

  if (!isQcvn && targetId) {
    const thrRes = await db.query(
      `SELECT ct.*, COALESCE(ind.display_name, ind.name, ct.industry_code) AS industry_name
       FROM classification_thresholds ct
       LEFT JOIN industries ind ON ct.industry_code = ind.code
       WHERE ct.id = $1`,
      [Number(targetId)]
    );
    if (!thrRes.rows || thrRes.rowCount === 0) throw new Error('RULE_NOT_FOUND');
    beforeSnapshot = thrRes.rows[0];
    resolvedTargetCode = beforeSnapshot.industry_code;
    resolvedLawId = String(lawId || proposedData.law_id || beforeSnapshot.law_id || 'vbhn_49_2026').trim();
    if (!resolvedTitle) {
      resolvedTitle = `Đề xuất điều chỉnh quy tắc #${beforeSnapshot.id} — Ngành ${beforeSnapshot.industry_name}`;
    }
  } else if (isQcvn && resolvedTargetCode) {
    const qRes = await db.query('SELECT * FROM qcvns WHERE id = $1', [resolvedTargetCode]);
    if (qRes.rows && qRes.rowCount > 0) {
      beforeSnapshot = {
        ...qRes.rows[0],
        tham_so: parseJsonSafe(qRes.rows[0].tham_so, []),
      };
      if (!resolvedTitle) {
        resolvedTitle = `Đề xuất cập nhật quy chuẩn ${beforeSnapshot.id} — ${beforeSnapshot.ten}`;
      }
    }
  }

  if (!resolvedTargetCode) throw new Error('TARGET_CODE_REQUIRED');
  if (!resolvedTitle) resolvedTitle = `Đề xuất cập nhật ${resolvedTargetCode}`;

  const enrichedProposedData = {
    ...proposedData,
    ...(targetId && !isQcvn ? { thresholdId: Number(targetId), supersedeThresholdId: Number(targetId) } : {}),
    nguoi_de_xuat: createdByName,
    ly_do_de_xuat: reason,
  };

  const diffSummary = {
    truoc_thay_doi: beforeSnapshot,
    sau_thay_doi: enrichedProposedData,
    nguoi_tao: createdByName,
    ly_do: reason,
    tao_luc: new Date().toISOString(),
  };

  const insRes = await db.query(
    `INSERT INTO rule_candidates (
       law_id, law_title, target_type, target_code, title,
       proposed_data, diff_summary, extraction_confidence, source_excerpt,
       status, review_note, created_at, updated_at
     ) VALUES (
       $1, $2, $3, $4, $5,
       $6::jsonb, $7::jsonb, 'cao', $8,
       'cho_duyet', $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
     )
     RETURNING *`,
    [
      resolvedLawId,
      lawTitle || proposedData.legal_ref || proposedData.sourceDocument || 'Đề xuất kiểm duyệt quản trị viên',
      dbTargetType,
      resolvedTargetCode,
      resolvedTitle,
      JSON.stringify(enrichedProposedData),
      JSON.stringify(diffSummary),
      sourceExcerpt || proposedData.legal_ref || proposedData.sourceDocument || reason || null,
      reason || null,
    ]
  );

  const row = insRes.rows[0];
  return {
    ...row,
    status: toVietnameseModerationStatus(row.status, 'cho_duyet'),
    status_label: getVietnameseStatusLabel(row.status),
    proposed_data: parseJsonSafe(row.proposed_data, {}),
    diff_summary: parseJsonSafe(row.diff_summary, {}),
  };
}

/**
 * 3.2. Kiểm duyệt trực tiếp một quy tắc phân loại (`nguong_phan_loai` / `classification_thresholds`)
 * Hỗ trợ:
 *   - Phê duyệt (`da_xac_minh`): Bắt buộc căn cứ pháp lý (`legalRef`) & ngày bắt đầu hiệu lực (`effectiveFrom`), lưu snapshot vào `phien_ban_quy_tac`.
 *   - Từ chối (`tu_choi`): Bắt buộc lý do (`reviewNote`), chuyển `publication_status = 'ban_nhap'` để loại khỏi runtime.
 *   - Yêu cầu bổ sung thông tin (`can_bo_sung`): Bắt buộc lý do (`reviewNote`).
 *   - Đánh dấu cần xác minh (`can_xac_minh_phap_ly`).
 */
async function reviewThresholdRuleRecord(
  db,
  {
    id,
    decision,
    legalRef = null,
    sourceRef = null,
    effectiveFrom = null,
    effectiveTo = null,
    reviewNote = null,
    patch = null,
    reviewedByUserId = null,
    reviewedByName = 'admin',
  } = {}
) {
  await ensureModerationSchema(db);
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) throw new Error('INVALID_RULE_ID');

  const existingRes = await db.query('SELECT * FROM classification_thresholds WHERE id = $1', [numericId]);
  if (!existingRes.rows || existingRes.rowCount === 0) throw new Error('RULE_NOT_FOUND');
  const before = existingRes.rows[0];

  const normDecision = toVietnameseModerationStatus(decision, '');
  if (!['da_xac_minh', 'tu_choi', 'can_bo_sung', 'can_xac_minh_phap_ly', 'cho_duyet'].includes(normDecision)) {
    throw new Error('INVALID_REVIEW_DECISION');
  }

  const cleanNote = String(reviewNote || '').trim();
  if ((normDecision === 'tu_choi' || normDecision === 'can_bo_sung') && !cleanNote) {
    throw new Error('REVIEW_REASON_REQUIRED');
  }

  const finalLegalRef = String(legalRef ?? patch?.legal_ref ?? before.legal_ref ?? '').trim();
  const finalSourceRef = String(sourceRef ?? patch?.source_ref ?? before.source_ref ?? finalLegalRef).trim();
  const finalEffectiveFrom = formatDateOnly(effectiveFrom ?? patch?.effective_from ?? before.effective_from);
  const finalEffectiveTo = formatDateOnly(effectiveTo ?? patch?.effective_to ?? before.effective_to);

  if (normDecision === 'da_xac_minh' && (!finalLegalRef || !finalEffectiveFrom)) {
    throw new Error('LEGAL_REF_AND_EFFECTIVE_DATE_REQUIRED');
  }

  const nextMin = patch?.min_value !== undefined ? parseFloat(patch.min_value) : parseFloat(before.min_value);
  const nextMax = patch?.max_value !== undefined
    ? (patch.max_value === null || patch.max_value === '' ? null : parseFloat(patch.max_value))
    : (before.max_value !== null && before.max_value !== undefined ? parseFloat(before.max_value) : null);
  const nextOperator = patch?.operator !== undefined ? patch.operator : (before.operator || '>=');
  const nextUnit = patch?.unit !== undefined ? patch.unit : before.unit;
  const nextGroup = patch?.project_group !== undefined ? patch.project_group : before.project_group;
  const nextDoc = patch?.legal_doc_required !== undefined ? patch.legal_doc_required : before.legal_doc_required;
  const nextTq = patch?.tq !== undefined ? patch.tq : before.tq;
  const nextStage = patch?.process_stage !== undefined ? patch.process_stage : before.process_stage;
  const nextPhuLuc = patch?.phu_luc !== undefined ? patch.phu_luc : before.phu_luc;
  const nextLawId = patch?.law_id !== undefined ? patch.law_id : before.law_id;

  const nextPublicationStatus = normDecision === 'da_xac_minh'
    ? 'da_cong_bo'
    : (normDecision === 'tu_choi' ? 'tu_choi' : toDbPublicationStatus(before.publication_status || 'da_cong_bo'));

  const nextVersion = `v${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${normDecision}`;

  const updRes = await db.query(
    `UPDATE classification_thresholds
     SET min_value = $1,
         max_value = $2,
         operator = $3,
         unit = $4,
         project_group = $5,
         legal_doc_required = $6,
         tq = $7,
         process_stage = $8,
         phu_luc = $9,
         legal_ref = $10,
         source_ref = $11,
         law_id = $12,
         effective_from = $13,
         effective_to = $14,
         verification_status = $15,
         publication_status = $16,
         rule_version = $17,
         approved_by = $18,
         approved_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $19
     RETURNING *`,
    [
      nextMin,
      nextMax,
      nextOperator,
      nextUnit,
      nextGroup,
      nextDoc,
      nextTq,
      nextStage,
      nextPhuLuc,
      finalLegalRef || null,
      finalSourceRef || null,
      nextLawId || null,
      finalEffectiveFrom || null,
      finalEffectiveTo || null,
      normDecision,
      nextPublicationStatus,
      nextVersion,
      String(reviewedByName),
      numericId,
    ]
  );

  const after = updRes.rows[0];

  await recordRuleVersionSnapshot(db, {
    ruleId: numericId,
    version: nextVersion,
    targetType: 'nguong_phan_loai',
    targetCode: `${after.industry_code}#${numericId}`,
    beforeData: before,
    afterData: after,
    changedBy: reviewedByUserId,
    changedByName: reviewedByName,
    legalBasis: finalLegalRef,
    effectiveFrom: finalEffectiveFrom,
    effectiveTo: finalEffectiveTo,
    changeReason: `[${getVietnameseStatusLabel(normDecision)}] ${cleanNote || finalLegalRef || ''}`.trim(),
  });

  return {
    before,
    after: {
      ...after,
      min_value: parseFloat(after.min_value),
      max_value: after.max_value !== null && after.max_value !== undefined ? parseFloat(after.max_value) : null,
      effective_from: formatDateOnly(after.effective_from),
      effective_to: formatDateOnly(after.effective_to),
      verification_status: normDecision,
      verification_status_label: getVietnameseStatusLabel(normDecision),
    },
  };
}

/**
 * 3.3. Xem chi tiết một quy chuẩn QCVN kèm bảng đầy đủ thông số môi trường (`tham_so`) và lịch sử kiểm duyệt
 */
async function getQcvnModerationDetail(qcvnId, { db = defaultDb } = {}) {
  await ensureModerationSchema(db);
  const cleanId = String(qcvnId || '').trim();
  if (!cleanId) throw new Error('QCVN_ID_REQUIRED');

  const res = await db.query('SELECT * FROM qcvns WHERE id = $1', [cleanId]);
  if (!res.rows || res.rowCount === 0) throw new Error('QCVN_NOT_FOUND');
  const row = res.rows[0];
  const statusVi = toVietnameseModerationStatus(row.verification_status, 'can_xac_minh_phap_ly');
  const thamSo = parseJsonSafe(row.tham_so, []);

  const [proposalsRes, versionsRes] = await Promise.all([
    db.query(
      `SELECT * FROM rule_candidates WHERE target_code = $1 ORDER BY created_at DESC, id DESC`,
      [cleanId]
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT rv.*, u.username AS actor_username, u.full_name AS actor_name
       FROM rule_versions rv
       LEFT JOIN users u ON rv.changed_by = u.id
       WHERE rv.change_reason ILIKE $1
       ORDER BY rv.changed_at DESC, rv.id DESC
       LIMIT 30`,
      [`%${cleanId}%`]
    ).catch(() => ({ rows: [] })),
  ]);

  return {
    qcvn: {
      ...row,
      tham_so: Array.isArray(thamSo) ? thamSo : [],
      parameter_count: Array.isArray(thamSo) ? thamSo.filter(p => p && (p.ten || p.key || p.chi_tieu)).length : 0,
      effective_from: formatDateOnly(row.effective_from),
      effective_to: formatDateOnly(row.effective_to),
      mandatory_for_all_from: formatDateOnly(row.mandatory_for_all_from),
      verification_status: statusVi,
      verification_status_label: getVietnameseStatusLabel(statusVi),
      review_checklist: parseJsonSafe(row.review_checklist || row.danh_sach_kiem_tra, {}),
      replaces: parseJsonSafe(row.replaces, null),
      transition_rules: parseJsonSafe(row.transition_rules, null),
    },
    proposals: (proposalsRes.rows || []).map(p => ({
      ...p,
      status: toVietnameseModerationStatus(p.status, 'cho_duyet'),
      status_label: getVietnameseStatusLabel(p.status),
      proposed_data: parseJsonSafe(p.proposed_data, {}),
      diff_summary: parseJsonSafe(p.diff_summary, {}),
    })),
    versions: (versionsRes.rows || []).map(v => ({
      ...v,
      expression: parseJsonSafe(v.expression, {}),
    })),
  };
}

/**
 * 3.3. Kiểm duyệt hoặc cập nhật bản ghi QCVN (Phê duyệt / Từ chối / Cần bổ sung / Cần xác minh / Chỉnh sửa thông số)
 */
async function reviewQcvnCatalogRecord(
  db,
  {
    id,
    decision,
    sourceDocument = null,
    effectiveFrom = null,
    effectiveTo = null,
    reviewNote = null,
    patch = null,
    validateQcvnParametersFn = null,
    reviewedByUserId = null,
    reviewedByName = 'admin',
  } = {}
) {
  await ensureModerationSchema(db);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw new Error('QCVN_ID_REQUIRED');

  const existingRes = await db.query('SELECT * FROM qcvns WHERE id = $1', [cleanId]);
  if (!existingRes.rows || existingRes.rowCount === 0) throw new Error('QCVN_NOT_FOUND');
  const before = existingRes.rows[0];

  const normDecision = toVietnameseModerationStatus(decision, '');
  if (!['da_xac_minh', 'tu_choi', 'can_bo_sung', 'can_xac_minh_phap_ly', 'cho_duyet', 'het_hieu_luc'].includes(normDecision)) {
    throw new Error('INVALID_REVIEW_DECISION');
  }

  const cleanNote = String(reviewNote || '').trim();
  if ((normDecision === 'tu_choi' || normDecision === 'can_bo_sung') && !cleanNote) {
    throw new Error('REVIEW_REASON_REQUIRED');
  }

  const finalSourceDoc = String(sourceDocument ?? patch?.source_document ?? before.source_document ?? '').trim();
  if (normDecision === 'da_xac_minh' && !finalSourceDoc) {
    throw new Error('SOURCE_DOCUMENT_REQUIRED');
  }

  let nextThamSo = parseJsonSafe(before.tham_so, []);
  if (patch?.tham_so !== undefined) {
    nextThamSo = typeof validateQcvnParametersFn === 'function'
      ? validateQcvnParametersFn(patch.tham_so)
      : patch.tham_so;
  }

  const nextTen = patch?.ten !== undefined ? String(patch.ten).trim() : before.ten;
  const nextApDung = patch?.ap_dung !== undefined ? patch.ap_dung : before.ap_dung;
  const nextStandardCode = patch?.standard_code !== undefined ? patch.standard_code : before.standard_code;
  const nextStandardVersion = patch?.standard_version !== undefined ? patch.standard_version : before.standard_version;
  const nextSourceType = patch?.source_type !== undefined ? patch.source_type : before.source_type;
  const nextColumnCode = patch?.column_code !== undefined ? patch.column_code : before.column_code;
  const nextFlowRange = patch?.flow_range !== undefined ? patch.flow_range : before.flow_range;
  const nextEffFrom = formatDateOnly(effectiveFrom ?? patch?.effective_from ?? before.effective_from);
  const nextEffTo = formatDateOnly(effectiveTo ?? patch?.effective_to ?? before.effective_to);

  const nextPublicationStatus = normDecision === 'da_xac_minh'
    ? 'da_cong_bo'
    : (normDecision === 'tu_choi' ? 'tu_choi' : toDbPublicationStatus(before.publication_status || 'da_cong_bo'));
  const nextVersion = `v${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${normDecision}`;

  const updRes = await db.query(
    `UPDATE qcvns
     SET ten = $1,
         ap_dung = $2,
         tham_so = $3::jsonb,
         standard_code = $4,
         standard_version = $5,
         source_type = $6,
         column_code = $7,
         flow_range = $8,
         effective_from = $9,
         effective_to = $10,
         source_document = $11,
         verification_status = $12,
         publication_status = $13,
         rule_version = $14,
         verified_by = $15,
         verified_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $16
     RETURNING *`,
    [
      nextTen,
      nextApDung,
      JSON.stringify(nextThamSo),
      nextStandardCode,
      nextStandardVersion,
      nextSourceType,
      nextColumnCode,
      nextFlowRange,
      nextEffFrom,
      nextEffTo,
      finalSourceDoc || null,
      normDecision,
      nextPublicationStatus,
      nextVersion,
      String(reviewedByName),
      cleanId,
    ]
  );

  const after = updRes.rows[0];

  await recordRuleVersionSnapshot(db, {
    ruleId: null,
    version: nextVersion,
    targetType: 'quy_chuan_qcvn',
    targetCode: cleanId,
    beforeData: { ...before, tham_so: parseJsonSafe(before.tham_so, []) },
    afterData: { ...after, tham_so: nextThamSo },
    changedBy: reviewedByUserId,
    changedByName: reviewedByName,
    legalBasis: finalSourceDoc,
    effectiveFrom: nextEffFrom,
    effectiveTo: nextEffTo,
    changeReason: `[QCVN ${cleanId} - ${getVietnameseStatusLabel(normDecision)}] ${cleanNote || finalSourceDoc || ''}`.trim(),
  });

  return {
    before,
    after: {
      ...after,
      tham_so: nextThamSo,
      effective_from: formatDateOnly(after.effective_from),
      effective_to: formatDateOnly(after.effective_to),
      verification_status: normDecision,
      verification_status_label: getVietnameseStatusLabel(normDecision),
    },
  };
}

/**
 * 5.1. Tổng quan kiểm duyệt dữ liệu pháp lý (6 chỉ số KPI & danh sách cần xử lý gần đây)
 */
async function getModerationOverview({ db = defaultDb } = {}) {
  await ensureModerationSchema(db);
  const [laws, thrRes, qcvnRes, candRes, impRes] = await Promise.all([
    listLawsForModeration({ db }),
    db.query(
      `SELECT ct.id, ct.industry_code, COALESCE(ind.display_name, ind.name, ct.industry_code) AS industry_name,
              ct.project_group, ct.legal_doc_required, ct.tq, ct.legal_ref, ct.effective_from, ct.verification_status, ct.updated_at
       FROM classification_thresholds ct
       LEFT JOIN industries ind ON ct.industry_code = ind.code`
    ),
    db.query('SELECT id, ten, source_type, standard_code, effective_from, verification_status, source_document, updated_at FROM qcvns'),
    db.query('SELECT * FROM rule_candidates ORDER BY created_at DESC, id DESC LIMIT 100').catch(() => ({ rows: [] })),
    db.query('SELECT * FROM law_rule_impacts ORDER BY created_at DESC, id DESC LIMIT 100').catch(() => ({ rows: [] })),
  ]);

  const thresholds = (thrRes.rows || []).map(r => ({
    ...r,
    verification_status: toVietnameseModerationStatus(r.verification_status, 'can_xac_minh_phap_ly'),
  }));
  const qcvns = (qcvnRes.rows || []).map(q => ({
    ...q,
    verification_status: toVietnameseModerationStatus(q.verification_status, 'can_xac_minh_phap_ly'),
  }));
  const candidates = (candRes.rows || []).map(c => ({
    ...c,
    status: toVietnameseModerationStatus(c.status, 'cho_duyet'),
  }));
  const impacts = (impRes.rows || []).map(i => ({
    ...i,
    status: String(i.status || '').toLowerCase() === 'open' || i.status === 'dang_mo' ? 'dang_mo' : 'da_xu_ly',
  }));

  const pendingStatuses = ['cho_duyet', 'can_bo_sung', 'can_xac_minh_phap_ly'];
  const pendingLaws = laws.filter(l => pendingStatuses.includes(l.verification_status));
  const pendingThresholds = thresholds.filter(t => pendingStatuses.includes(t.verification_status));
  const pendingRuleCands = candidates.filter(c => c.target_type !== 'QCVN' && ['cho_duyet', 'can_bo_sung'].includes(c.status));
  const pendingQcvns = qcvns.filter(q => pendingStatuses.includes(q.verification_status));
  const pendingQcvnCands = candidates.filter(c => c.target_type === 'QCVN' && ['cho_duyet', 'can_bo_sung'].includes(c.status));

  const pendingLawsCount = pendingLaws.length;
  const unverifiedRulesCount = pendingThresholds.length + pendingRuleCands.length;
  const unverifiedQcvnsCount = pendingQcvns.length + pendingQcvnCands.length;
  const totalPendingCount = pendingLawsCount + unverifiedRulesCount + unverifiedQcvnsCount;

  const approvedLawsCount = laws.filter(l => l.verification_status === 'da_xac_minh').length;
  const approvedRulesCount =
    thresholds.filter(t => t.verification_status === 'da_xac_minh').length
    + candidates.filter(c => c.target_type !== 'QCVN' && c.status === 'da_xac_minh').length;
  const approvedQcvnsCount =
    qcvns.filter(q => q.verification_status === 'da_xac_minh').length
    + candidates.filter(c => c.target_type === 'QCVN' && c.status === 'da_xac_minh').length;
  const approvedTotalCount = approvedLawsCount + approvedRulesCount + approvedQcvnsCount;

  const rejectedLawsCount = laws.filter(l => l.verification_status === 'tu_choi').length;
  const rejectedRulesCount =
    thresholds.filter(t => t.verification_status === 'tu_choi').length
    + candidates.filter(c => c.target_type !== 'QCVN' && c.status === 'tu_choi').length;
  const rejectedQcvnsCount =
    qcvns.filter(q => q.verification_status === 'tu_choi').length
    + candidates.filter(c => c.target_type === 'QCVN' && c.status === 'tu_choi').length;
  const rejectedTotalCount = rejectedLawsCount + rejectedRulesCount + rejectedQcvnsCount;

  // Hàng đợi công việc cần xử lý (KHÔNG trộn bản ghi đã phê duyệt hoặc đã từ chối)
  const queueItems = [
    ...pendingLaws.map(l => ({
      uid: `van_ban:${l.id}`,
      loai_du_lieu: 'van_ban',
      loai_du_lieu_label: 'Văn bản pháp luật',
      sub_type: 'law',
      ma: l.id,
      so_hieu: l.so,
      tieu_de: l.ten || l.so,
      nguon: l.detection_source || 'he_thong',
      nguon_label: l.detection_source_label,
      nguoi_de_xuat: l.detection_source === 'crawler' ? 'Trình thu thập dữ liệu tự động' : (l.reviewed_by || 'Quản trị viên'),
      thoi_gian: l.detected_at || l.updated_at || l.issued_date,
      ngay_ban_hanh: l.issued_date || null,
      ngay_hieu_luc: l.effective_date || null,
      trang_thai: l.verification_status,
      trang_thai_label: l.verification_status_label,
    })),
    ...pendingRuleCands.map(c => {
      const pData = parseJsonSafe(c.proposed_data, {});
      return {
        uid: `de_xuat:${c.id}`,
        loai_du_lieu: 'quy_tac',
        loai_du_lieu_label: 'Đề xuất quy tắc phân loại',
        sub_type: 'candidate',
        ma: String(c.id),
        so_hieu: c.target_code,
        tieu_de: c.title || `Đề xuất quy tắc #${c.id} (${c.target_code})`,
        nguon: c.law_id && c.law_id !== 'cap_nhat_thu_cong' ? 'crawler' : 'thu_cong',
        nguon_label: c.law_id && c.law_id !== 'cap_nhat_thu_cong' ? 'Đồng bộ văn bản' : 'Đề xuất thủ công',
        nguoi_de_xuat: pData.nguoi_de_xuat || 'Hệ thống / Quản trị viên',
        thoi_gian: c.created_at || c.updated_at,
        ngay_ban_hanh: null,
        ngay_hieu_luc: pData.effective_from || pData.effectiveFrom || null,
        trang_thai: c.status,
        trang_thai_label: getVietnameseStatusLabel(c.status),
      };
    }),
    ...pendingThresholds.map(t => ({
      uid: `quy_tac:${t.id}`,
      loai_du_lieu: 'quy_tac',
      loai_du_lieu_label: 'Quy tắc phân loại',
      sub_type: 'threshold',
      ma: String(t.id),
      so_hieu: `#${t.id}`,
      tieu_de: `${t.industry_name || t.industry_code} — ${t.project_group} (${t.legal_doc_required})`,
      nguon: 'he_thong',
      nguon_label: 'Danh mục hệ thống',
      nguoi_de_xuat: 'Danh mục quy tắc',
      thoi_gian: t.updated_at,
      ngay_ban_hanh: null,
      ngay_hieu_luc: formatDateOnly(t.effective_from),
      trang_thai: t.verification_status,
      trang_thai_label: getVietnameseStatusLabel(t.verification_status),
    })),
    ...pendingQcvnCands.map(c => {
      const pData = parseJsonSafe(c.proposed_data, {});
      return {
        uid: `de_xuat:${c.id}`,
        loai_du_lieu: 'qcvn',
        loai_du_lieu_label: 'Đề xuất QCVN',
        sub_type: 'candidate',
        ma: String(c.id),
        so_hieu: c.target_code,
        tieu_de: c.title || `Đề xuất QCVN #${c.id} (${c.target_code})`,
        nguon: c.law_id && c.law_id !== 'cap_nhat_thu_cong' ? 'crawler' : 'thu_cong',
        nguon_label: c.law_id && c.law_id !== 'cap_nhat_thu_cong' ? 'Đồng bộ văn bản' : 'Đề xuất thủ công',
        nguoi_de_xuat: pData.nguoi_de_xuat || 'Hệ thống / Quản trị viên',
        thoi_gian: c.created_at || c.updated_at,
        ngay_ban_hanh: null,
        ngay_hieu_luc: pData.effective_from || pData.effectiveFrom || null,
        trang_thai: c.status,
        trang_thai_label: getVietnameseStatusLabel(c.status),
      };
    }),
    ...pendingQcvns.map(q => ({
      uid: `qcvn:${q.id}`,
      loai_du_lieu: 'qcvn',
      loai_du_lieu_label: 'Quy chuẩn QCVN',
      sub_type: 'qcvn',
      ma: q.id,
      so_hieu: q.standard_code || q.id,
      tieu_de: q.ten || q.id,
      nguon: 'he_thong',
      nguon_label: 'Danh mục hệ thống',
      nguoi_de_xuat: 'Danh mục QCVN',
      thoi_gian: q.updated_at,
      ngay_ban_hanh: null,
      ngay_hieu_luc: formatDateOnly(q.effective_from),
      trang_thai: q.verification_status,
      trang_thai_label: getVietnameseStatusLabel(q.verification_status),
    })),
  ].sort((a, b) => new Date(b.thoi_gian || 0).getTime() - new Date(a.thoi_gian || 0).getTime());

  const recentActionRequired = queueItems.slice(0, 12);

  return {
    lastUpdatedAt: new Date().toISOString(),
    stats: {
      totalPendingCount,
      pendingLawsCount,
      unverifiedRulesCount,
      unverifiedQcvnsCount,
      approvedTotalCount,
      rejectedTotalCount,
      openImpactsCount: impacts.filter(i => i.status === 'dang_mo').length,
      pending: {
        total: totalPendingCount,
        van_ban: pendingLawsCount,
        quy_tac: unverifiedRulesCount,
        qcvn: unverifiedQcvnsCount,
      },
      approved: {
        total: approvedTotalCount,
        van_ban: approvedLawsCount,
        quy_tac: approvedRulesCount,
        qcvn: approvedQcvnsCount,
      },
      rejected: {
        total: rejectedTotalCount,
        van_ban: rejectedLawsCount,
        quy_tac: rejectedRulesCount,
        qcvn: rejectedQcvnsCount,
      },
    },
    queueItems,
    recentActionRequired,
  };
}

/**
 * Mục 9: Lưu trạng thái Checklist xác minh thật vào PostgreSQL (không lưu giả ở frontend).
 * Chỉ hỗ trợ rà soát, KHÔNG tự động thay đổi trạng thái phê duyệt pháp lý.
 */
async function saveModerationChecklist(
  db,
  { targetType, targetId, checklist = {}, updatedBy = null, updatedByName = 'admin' } = {}
) {
  await ensureModerationSchema(db);
  const typeNorm = String(targetType || '').toLowerCase().trim();
  const cleanId = String(targetId || '').trim();
  if (!cleanId) throw new Error('TARGET_ID_REQUIRED');

  const safeChecklist = {};
  if (checklist && typeof checklist === 'object') {
    for (const [k, v] of Object.entries(checklist)) {
      if (typeof k === 'string' && k.length <= 80) {
        safeChecklist[k] = Boolean(v);
      }
    }
  }
  const payload = {
    items: safeChecklist,
    updated_by: updatedByName,
    updated_by_id: updatedBy,
    updated_at: new Date().toISOString(),
  };

  let res;
  if (typeNorm === 'van_ban' || typeNorm === 'law') {
    res = await db.query(
      `UPDATE laws SET review_checklist = $1::jsonb WHERE id = $2 RETURNING id, review_checklist`,
      [JSON.stringify(payload), cleanId]
    );
  } else if (typeNorm === 'quy_tac' || typeNorm === 'threshold') {
    const numId = Number(cleanId);
    if (!Number.isInteger(numId) || numId <= 0) throw new Error('INVALID_RULE_ID');
    res = await db.query(
      `UPDATE classification_thresholds SET review_checklist = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, review_checklist`,
      [JSON.stringify(payload), numId]
    );
  } else if (typeNorm === 'qcvn') {
    res = await db.query(
      `UPDATE qcvns SET review_checklist = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, review_checklist`,
      [JSON.stringify(payload), cleanId]
    );
  } else if (typeNorm === 'de_xuat' || typeNorm === 'candidate') {
    const numId = Number(cleanId);
    if (!Number.isInteger(numId) || numId <= 0) throw new Error('INVALID_CANDIDATE_ID');
    res = await db.query(
      `UPDATE rule_candidates SET review_checklist = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, review_checklist`,
      [JSON.stringify(payload), numId]
    );
  } else {
    throw new Error('INVALID_TARGET_TYPE');
  }

  if (!res.rows || res.rowCount === 0) throw new Error('RECORD_NOT_FOUND');
  return {
    targetType: typeNorm,
    targetId: cleanId,
    review_checklist: parseJsonSafe(res.rows[0].review_checklist, payload),
  };
}

/**
 * Mục 5: Danh sách Lịch sử kiểm duyệt (Đã phê duyệt, Đã từ chối, Đã yêu cầu bổ sung, Hết hiệu lực & thay đổi phiên bản)
 */
async function listModerationHistory({
  targetType = null,
  status = null,
  actor = null,
  dateFrom = null,
  dateTo = null,
  search = null,
  db = defaultDb,
} = {}) {
  await ensureModerationSchema(db);
  const [laws, thrRes, qcvnRes, candRes, versionRes] = await Promise.all([
    listLawsForModeration({ db }),
    db.query(
      `SELECT ct.id, ct.industry_code, COALESCE(ind.display_name, ind.name, ct.industry_code) AS industry_name,
              ct.project_group, ct.legal_doc_required, ct.tq, ct.legal_ref, ct.effective_from, ct.effective_to,
              ct.verification_status, ct.approved_by, ct.approved_at, ct.updated_at, ct.rule_version
       FROM classification_thresholds ct
       LEFT JOIN industries ind ON ct.industry_code = ind.code`
    ),
    db.query(
      `SELECT id, ten, standard_code, source_type, source_document, effective_from, effective_to,
              verification_status, verified_by, verified_at, updated_at, rule_version
       FROM qcvns`
    ),
    db.query(
      `SELECT rc.*, u.username AS reviewer_username, u.full_name AS reviewer_name
       FROM rule_candidates rc
       LEFT JOIN users u ON rc.reviewed_by = u.id
       ORDER BY COALESCE(rc.reviewed_at, rc.updated_at, rc.created_at) DESC
       LIMIT 200`
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT rv.*, u.username AS actor_username, u.full_name AS actor_name
       FROM rule_versions rv
       LEFT JOIN users u ON rv.changed_by = u.id
       ORDER BY rv.changed_at DESC, rv.id DESC
       LIMIT 100`
    ).catch(() => ({ rows: [] })),
  ]);

  const historyStatuses = new Set(['da_xac_minh', 'tu_choi', 'can_bo_sung', 'het_hieu_luc']);
  const items = [];

  for (const l of laws) {
    if (!historyStatuses.has(l.verification_status)) continue;
    items.push({
      uid: `hist-van_ban-${l.id}`,
      loai_du_lieu: 'van_ban',
      loai_du_lieu_label: 'Văn bản pháp luật',
      sub_type: 'law',
      ma: l.id,
      so_hieu: l.so,
      tieu_de: l.ten || l.so,
      co_quan: l.issuing_agency,
      can_cu: l.so,
      hieu_luc: l.effective_date || l.hieuluc || '—',
      trang_thai: l.verification_status,
      trang_thai_label: l.verification_status_label,
      nguoi_thuc_hien: l.reviewed_by || 'Hệ thống / Quản trị viên',
      thoi_gian: l.reviewed_at || l.updated_at || l.issued_date,
      ghi_chu: l.review_note || '',
    });
  }

  for (const t of (thrRes.rows || [])) {
    const st = toVietnameseModerationStatus(t.verification_status, 'can_xac_minh_phap_ly');
    if (!historyStatuses.has(st)) continue;
    items.push({
      uid: `hist-quy_tac-${t.id}`,
      loai_du_lieu: 'quy_tac',
      loai_du_lieu_label: 'Quy tắc phân loại',
      sub_type: 'threshold',
      ma: String(t.id),
      so_hieu: `#${t.id}`,
      tieu_de: `${t.industry_name || t.industry_code} — ${t.project_group} (${t.legal_doc_required})`,
      can_cu: t.legal_ref || '—',
      hieu_luc: formatDateOnly(t.effective_from) || '—',
      trang_thai: st,
      trang_thai_label: getVietnameseStatusLabel(st),
      nguoi_thuc_hien: t.approved_by || 'Hệ thống / Quản trị viên',
      thoi_gian: t.approved_at || t.updated_at,
      ghi_chu: t.rule_version ? `Phiên bản ${t.rule_version}` : '',
    });
  }

  for (const q of (qcvnRes.rows || [])) {
    const st = toVietnameseModerationStatus(q.verification_status, 'can_xac_minh_phap_ly');
    if (!historyStatuses.has(st)) continue;
    items.push({
      uid: `hist-qcvn-${q.id}`,
      loai_du_lieu: 'qcvn',
      loai_du_lieu_label: 'Quy chuẩn QCVN',
      sub_type: 'qcvn',
      ma: q.id,
      so_hieu: q.standard_code || q.id,
      tieu_de: q.ten || q.id,
      can_cu: q.source_document || '—',
      hieu_luc: formatDateOnly(q.effective_from) || '—',
      trang_thai: st,
      trang_thai_label: getVietnameseStatusLabel(st),
      nguoi_thuc_hien: q.verified_by || 'Hệ thống / Quản trị viên',
      thoi_gian: q.verified_at || q.updated_at,
      ghi_chu: q.rule_version ? `Phiên bản ${q.rule_version}` : '',
    });
  }

  for (const c of (candRes.rows || [])) {
    const st = toVietnameseModerationStatus(c.status, 'cho_duyet');
    if (!historyStatuses.has(st)) continue;
    items.push({
      uid: `hist-de_xuat-${c.id}`,
      loai_du_lieu: c.target_type === 'QCVN' ? 'qcvn' : 'quy_tac',
      loai_du_lieu_label: c.target_type === 'QCVN' ? 'Đề xuất QCVN' : 'Đề xuất quy tắc',
      sub_type: 'candidate',
      ma: String(c.id),
      so_hieu: `ĐX-#${c.id}`,
      tieu_de: c.title || `${c.target_code}`,
      can_cu: c.source_excerpt || c.law_title || '—',
      hieu_luc: '—',
      trang_thai: st,
      trang_thai_label: getVietnameseStatusLabel(st),
      nguoi_thuc_hien: c.reviewer_name || c.reviewer_username || 'Quản trị viên',
      thoi_gian: c.reviewed_at || c.updated_at || c.created_at,
      ghi_chu: c.review_note || '',
    });
  }

  const versions = (versionRes.rows || []).map(v => {
    const expr = parseJsonSafe(v.expression, {});
    return {
      id: v.id,
      rule_id: v.rule_id,
      version: v.version,
      target_type: expr.loai_doi_tuong || 'nguong_phan_loai',
      target_code: expr.ma_doi_tuong || (v.rule_id ? `#${v.rule_id}` : '—'),
      actor: v.actor_name || v.actor_username || expr.nguoi_thuc_hien || 'Quản trị viên',
      changed_at: v.changed_at,
      change_reason: v.change_reason || expr.ly_do || '',
      legal_basis: expr.can_cu_phap_ly || '',
    };
  });

  let filtered = items;
  if (targetType && targetType !== 'tat_ca' && targetType !== 'ALL') {
    filtered = filtered.filter(i => i.loai_du_lieu === targetType);
  }
  if (status && status !== 'tat_ca' && status !== 'ALL') {
    const targetSt = toVietnameseModerationStatus(status);
    filtered = filtered.filter(i => i.trang_thai === targetSt);
  }
  if (actor && String(actor).trim()) {
    const a = String(actor).trim().toLowerCase();
    filtered = filtered.filter(i => String(i.nguoi_thuc_hien || '').toLowerCase().includes(a));
  }
  if (dateFrom) {
    const df = String(dateFrom).slice(0, 10);
    filtered = filtered.filter(i => !i.thoi_gian || String(i.thoi_gian).slice(0, 10) >= df);
  }
  if (dateTo) {
    const dt = String(dateTo).slice(0, 10);
    filtered = filtered.filter(i => !i.thoi_gian || String(i.thoi_gian).slice(0, 10) <= dt);
  }
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    filtered = filtered.filter(i =>
      String(i.tieu_de || '').toLowerCase().includes(q)
      || String(i.so_hieu || '').toLowerCase().includes(q)
      || String(i.can_cu || '').toLowerCase().includes(q)
      || String(i.ghi_chu || '').toLowerCase().includes(q)
      || String(i.nguoi_thuc_hien || '').toLowerCase().includes(q)
    );
  }

  filtered.sort((a, b) => new Date(b.thoi_gian || 0).getTime() - new Date(a.thoi_gian || 0).getTime());

  return {
    items: filtered,
    versions,
    total: filtered.length,
  };
}

module.exports = {
  VIETNAMESE_STATUS_LABELS,
  toVietnameseModerationStatus,
  getVietnameseStatusLabel,
  inferIssuingAgency,
  ensureModerationSchema,
  recordRuleVersionSnapshot,
  listLawsForModeration,
  getLawModerationDetail,
  reviewLawRecord,
  getThresholdModerationDetail,
  createModerationProposal,
  reviewThresholdRuleRecord,
  getQcvnModerationDetail,
  reviewQcvnCatalogRecord,
  getModerationOverview,
  saveModerationChecklist,
  listModerationHistory,
};
