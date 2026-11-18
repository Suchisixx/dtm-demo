-- ============================================================================
-- CƠ SỞ DỮ LIỆU: etc_legalhub (PostgreSQL)
-- Hệ thống: LegalHub - Tra cứu Pháp luật Môi trường, Phân loại Hồ sơ & QCVN
-- Ghi chú:
--   - Hệ thống sử dụng 19 bảng vật lý đặt tên tiếng Việt không dấu.
--   - Mỗi bảng có kèm View tương thích tên tiếng Anh (1-1) ở cuối file.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- NHÓM 1: NGƯỜI DÙNG & NHẬT KÝ HỆ THỐNG
-- ----------------------------------------------------------------------------

-- 1. Người dùng (View tương thích: users)
CREATE TABLE IF NOT EXISTS nguoi_dung (
    ma SERIAL PRIMARY KEY,
    ten_dang_nhap VARCHAR(50) UNIQUE NOT NULL,
    mat_khau_bam VARCHAR(255) NOT NULL,
    ma_dat_lai_mat_khau_bam VARCHAR(255) NULL,
    ma_dat_lai_het_han_luc TIMESTAMP NULL,
    ho_ten VARCHAR(100) NOT NULL,
    vai_tro VARCHAR(20) DEFAULT 'staff',
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Nhật ký kiểm toán (View tương thích: audit_logs)
CREATE TABLE IF NOT EXISTS nhat_ky_kiem_toan (
    ma SERIAL PRIMARY KEY,
    nguoi_dung_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    hanh_dong VARCHAR(100) NOT NULL,
    dia_chi_ip VARCHAR(50),
    trinh_duyet TEXT,
    du_lieu JSONB,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Nhật ký truy vấn (View tương thích: query_logs)
CREATE TABLE IF NOT EXISTS nhat_ky_truy_van (
    ma SERIAL PRIMARY KEY,
    nguoi_dung_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    loai_truy_van VARCHAR(50) NOT NULL,
    tham_so_dau_vao JSONB NOT NULL,
    ket_qua_dau_ra JSONB NOT NULL,
    truy_van_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Cài đặt hệ thống (View tương thích: system_settings)
CREATE TABLE IF NOT EXISTS cai_dat_he_thong (
    khoa VARCHAR(100) PRIMARY KEY,
    gia_tri TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- NHÓM 2: VĂN BẢN PHÁP LUẬT, QUY TẮC & CRAWLER ĐỒNG BỘ
-- ----------------------------------------------------------------------------

-- 5. Văn bản pháp luật (View tương thích: laws)
CREATE TABLE IF NOT EXISTS luat (
    ma VARCHAR(100) PRIMARY KEY,
    loai VARCHAR(50) NOT NULL,
    nam INTEGER NOT NULL,
    ngay_sap_xep VARCHAR(50),
    so_hieu VARCHAR(255) NOT NULL,
    ten_van_ban TEXT NOT NULL,
    hieu_luc VARCHAR(255),
    trang_thai VARCHAR(50),
    mo_ta TEXT,
    dieu_khoan JSONB DEFAULT '[]'::jsonb,
    ghi_chu TEXT,
    lien_ket TEXT,
    crawler_cap_nhat_luc VARCHAR(100) NULL,
    cap_nhat_luc TIMESTAMP
);

-- 6. Phụ lục pháp lý (View tương thích: legal_appendices)
CREATE TABLE IF NOT EXISTS phu_luc_phap_ly (
    ma VARCHAR(100) PRIMARY KEY,
    luat_ma VARCHAR(100) REFERENCES luat(ma) ON DELETE SET NULL,
    ten_phu_luc VARCHAR(255),
    so_muc VARCHAR(50),
    tom_tat_noi_dung TEXT
);

-- 7. Quy tắc nghiệp vụ (View tương thích: rules)
CREATE TABLE IF NOT EXISTS quy_tac (
    ma VARCHAR(100) PRIMARY KEY,
    ten_quy_tac VARCHAR(255) NOT NULL,
    loai_quy_tac VARCHAR(50),
    bieu_thuc TEXT NOT NULL,
    dang_hoat_dong BOOLEAN DEFAULT TRUE,
    phien_ban INTEGER DEFAULT 1
);

-- 8. Lịch sử phiên bản quy tắc (View tương thích: rule_versions)
CREATE TABLE IF NOT EXISTS phien_ban_quy_tac (
    ma SERIAL PRIMARY KEY,
    quy_tac_ma VARCHAR(100) REFERENCES quy_tac(ma) ON DELETE CASCADE,
    phien_ban INTEGER NOT NULL,
    bieu_thuc TEXT NOT NULL,
    nguoi_thay_doi_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    thay_doi_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ly_do_thay_doi TEXT
);

-- 9. Lịch sử cập nhật văn bản pháp luật (View tương thích: law_update_history)
CREATE TABLE IF NOT EXISTS lich_su_cap_nhat_van_ban (
    ma SERIAL PRIMARY KEY,
    luat_ma VARCHAR(100),
    hanh_dong VARCHAR(50) NOT NULL,
    nguoi_cap_nhat_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mo_ta TEXT
);

-- 10. Tác động văn bản tới quy tắc (View tương thích: law_rule_impacts)
CREATE TABLE IF NOT EXISTS anh_huong_quy_tac_van_ban (
    ma SERIAL PRIMARY KEY,
    luat_ma VARCHAR(100) NOT NULL,
    ten_van_ban TEXT,
    hanh_dong_su_kien VARCHAR(50) NOT NULL,
    loai_doi_tuong VARCHAR(40) NOT NULL,
    doi_tuong_ma VARCHAR(150) NOT NULL,
    nhan_doi_tuong TEXT,
    muc_do VARCHAR(20) NOT NULL DEFAULT 'cao',
    ly_do_anh_huong TEXT NOT NULL,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'dang_mo',
    nguoi_xu_ly_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    xu_ly_luc TIMESTAMP,
    ghi_chu_xu_ly TEXT,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Đề xuất cập nhật quy tắc từ crawler (View tương thích: rule_candidates)
CREATE TABLE IF NOT EXISTS de_xuat_quy_tac (
    ma SERIAL PRIMARY KEY,
    luat_ma VARCHAR(100) NOT NULL,
    ten_van_ban TEXT,
    loai_doi_tuong VARCHAR(40) NOT NULL,
    ma_doi_tuong VARCHAR(150) NOT NULL,
    tieu_de TEXT,
    du_lieu_de_xuat JSONB NOT NULL DEFAULT '{}'::jsonb,
    tom_tat_thay_doi JSONB NOT NULL DEFAULT '{}'::jsonb,
    do_tin_cay_trich_xuat VARCHAR(30) DEFAULT 'thap',
    trich_doan_nguon TEXT,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'cho_duyet',
    nguoi_duyet_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    duyet_luc TIMESTAMP,
    ghi_chu_duyet TEXT,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- NHÓM 3: DANH MỤC PHÂN LOẠI HỒ SƠ & NGƯỠNG CÔNG SUẤT
-- ----------------------------------------------------------------------------

-- 12. Ngành nghề sản xuất / dự án (View tương thích: industries)
CREATE TABLE IF NOT EXISTS nganh_nghe (
    ma_nganh VARCHAR(50) PRIMARY KEY,
    ten_nganh VARCHAR(255) NOT NULL,
    muc_do_rui_ro VARCHAR(20),
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ten_hien_thi VARCHAR(255),
    ten_goi_khac JSONB DEFAULT '[]'::jsonb,
    nhan_quy_mo TEXT,
    don_vi VARCHAR(100),
    ghi_chu TEXT,
    ghi_chu_ra_soat TEXT,
    mo_ta_cong_doan JSONB,
    trang_thai_xac_minh VARCHAR(50) DEFAULT 'can_xac_minh_phap_ly',
    trang_thai_cong_bo VARCHAR(30) DEFAULT 'da_cong_bo',
    phien_ban_quy_tac VARCHAR(50) DEFAULT '2026.2-audit',
    tai_lieu_nguon TEXT,
    nguoi_xac_minh VARCHAR(100),
    xac_minh_luc TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Ngưỡng phân loại công suất theo ngành (View tương thích: classification_thresholds)
CREATE TABLE IF NOT EXISTS nguong_phan_loai (
    ma SERIAL PRIMARY KEY,
    nganh_nghe_ma VARCHAR(50) REFERENCES nganh_nghe(ma_nganh) ON DELETE CASCADE,
    gia_tri_toi_thieu DECIMAL(15,2) NOT NULL,
    gia_tri_toi_da DECIMAL(15,2),
    don_vi VARCHAR(50),
    nhom_du_an VARCHAR(10),
    ho_so_phap_ly VARCHAR(20),
    phu_luc_phap_ly_ma VARCHAR(100) REFERENCES phu_luc_phap_ly(ma) ON DELETE SET NULL,
    cong_doan VARCHAR(100) DEFAULT '',
    toan_tu VARCHAR(10) DEFAULT '>=',
    quy_mo_cong_suat VARCHAR(20),
    tham_quyen VARCHAR(30),
    tham_quyen_lich_su VARCHAR(30),
    phu_luc VARCHAR(255),
    can_cu_phap_ly TEXT,
    luat_ma VARCHAR(100),
    hieu_luc_tu DATE,
    hieu_luc_den DATE,
    trang_thai_xac_minh VARCHAR(50) DEFAULT 'can_xac_minh_phap_ly',
    trang_thai_cong_bo VARCHAR(30) DEFAULT 'da_cong_bo',
    thu_tu_nguong INTEGER DEFAULT 0,
    phien_ban_quy_tac VARCHAR(50) DEFAULT '2026.2-audit',
    nguon_tham_chieu TEXT,
    nguoi_duyet VARCHAR(100),
    duyet_luc TIMESTAMP,
    la_phien_ban_hieu_luc BOOLEAN DEFAULT TRUE,
    het_hieu_luc_luc DATE,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- NHÓM 4: DỰ ÁN, BẢN ĐỒ GIS, XÁC MINH NHẠY CẢM & NGHĨA VỤ TUÂN THỦ
-- ----------------------------------------------------------------------------

-- 14. Dự án đầu tư (View tương thích: projects)
CREATE TABLE IF NOT EXISTS du_an (
    ma SERIAL PRIMARY KEY,
    nguoi_dung_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE CASCADE,
    ten_du_an VARCHAR(255) NOT NULL,
    du_lieu_bieu_mau JSONB NOT NULL,
    trang_thai_danh_sach_ho_so JSONB NOT NULL,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    vi_do NUMERIC,
    kinh_do NUMERIC,
    dia_chi_hien_thi TEXT,
    quan_huyen TEXT,
    phuong_xa TEXT,
    ket_qua_phan_loai JSONB,
    vi_tri_khong_gian geometry(Point, 4326)
);

-- 15. Xác minh yếu tố nhạy cảm môi trường của dự án (View tương thích: project_sensitive_verifications)
CREATE TABLE IF NOT EXISTS xac_minh_yeu_to_nhay_cam_du_an (
    ma SERIAL PRIMARY KEY,
    du_an_ma INTEGER UNIQUE REFERENCES du_an(ma) ON DELETE CASCADE,
    co_yeu_to_khai_bao JSONB NOT NULL DEFAULT '{}'::jsonb,
    chi_tiet_khai_bao JSONB NOT NULL DEFAULT '{}'::jsonb,
    du_lieu_khong_gian JSONB,
    tai_lieu_chung_minh TEXT,
    trang_thai_xac_minh VARCHAR(40) NOT NULL DEFAULT 'cho_xac_minh',
    nguoi_xac_minh_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    xac_minh_luc TIMESTAMP NULL,
    ghi_chu_xac_minh TEXT,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Lớp bản đồ GIS - KCN & vùng nhạy cảm (View tương thích: gis_layers)
CREATE TABLE IF NOT EXISTS lop_ban_do (
    ma VARCHAR(120) PRIMARY KEY,
    loai_lop VARCHAR(40) NOT NULL,
    ten_lop VARCHAR(255) NOT NULL,
    danh_muc VARCHAR(100),
    ma_co VARCHAR(40),
    vi_do DOUBLE PRECISION NOT NULL,
    kinh_do DOUBLE PRECISION NOT NULL,
    ban_kinh_km DOUBLE PRECISION NOT NULL DEFAULT 1,
    hinh_hoc JSONB,
    hinh_hoc_khong_gian geometry(Geometry, 4326),
    tinh VARCHAR(150),
    can_cu_phap_ly TEXT,
    trang_thai_xac_minh VARCHAR(50) NOT NULL DEFAULT 'can_xac_minh_phap_ly',
    trang_thai_cong_bo VARCHAR(30) NOT NULL DEFAULT 'da_cong_bo',
    tai_lieu_nguon TEXT,
    nguoi_xac_minh VARCHAR(100),
    xac_minh_luc TIMESTAMP,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS du_an_vi_tri_khong_gian_gix ON du_an USING GIST (vi_tri_khong_gian);
CREATE INDEX IF NOT EXISTS lop_ban_do_hinh_hoc_khong_gian_gix ON lop_ban_do USING GIST (hinh_hoc_khong_gian);

-- 17. Nghĩa vụ tuân thủ & nhắc hạn định kỳ (View tương thích: compliance_obligations)
CREATE TABLE IF NOT EXISTS nghia_vu_tuan_thu (
    ma SERIAL PRIMARY KEY,
    du_an_ma INTEGER NOT NULL REFERENCES du_an(ma) ON DELETE CASCADE,
    nguoi_dung_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    ma_nghia_vu VARCHAR(60) NOT NULL DEFAULT 'tuy_chinh',
    tieu_de VARCHAR(255) NOT NULL,
    can_cu_phap_ly VARCHAR(255),
    chu_ky VARCHAR(30) NOT NULL DEFAULT 'mot_lan',
    han_nop DATE NOT NULL,
    so_ngay_nhac_truoc INTEGER NOT NULL DEFAULT 30,
    trang_thai VARCHAR(30) NOT NULL DEFAULT 'chua_hoan_thanh',
    hoan_thanh_luc TIMESTAMP NULL,
    nguoi_hoan_thanh_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE SET NULL,
    ghi_chu_hoan_thanh TEXT NULL,
    muc_canh_bao_cuoi VARCHAR(30) NULL,
    canh_bao_luc TIMESTAMP NULL,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- NHÓM 5: QUY CHUẨN KỸ THUẬT QUỐC GIA (QCVN) & MẪU QUAN TRẮC
-- ----------------------------------------------------------------------------

-- 18. Quy chuẩn QCVN (View tương thích: qcvns)
CREATE TABLE IF NOT EXISTS quy_chuan_qcvn (
    ma VARCHAR(100) PRIMARY KEY,
    ten_quy_chuan VARCHAR(255) NOT NULL,
    pham_vi_ap_dung TEXT,
    tham_so JSONB NOT NULL,
    ma_tieu_chuan VARCHAR(100),
    phien_ban_tieu_chuan VARCHAR(50),
    trang_thai VARCHAR(50),
    loai_nguon VARCHAR(50),
    ma_cot VARCHAR(30),
    khoang_luu_luong VARCHAR(50),
    hieu_luc_tu DATE,
    hieu_luc_den DATE,
    bat_buoc_tu DATE,
    thay_the JSONB,
    quy_tac_chuyen_tiep JSONB,
    trang_thai_xac_minh VARCHAR(50) DEFAULT 'can_xac_minh_phap_ly',
    trang_thai_cong_bo VARCHAR(30) DEFAULT 'da_cong_bo',
    tai_lieu_nguon TEXT,
    phien_ban_quy_tac VARCHAR(50) DEFAULT '2026.2-audit',
    nguoi_xac_minh VARCHAR(100),
    xac_minh_luc TIMESTAMP,
    cong_bo_luc TIMESTAMP,
    cap_nhat_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Mẫu quan trắc môi trường QCVN (View tương thích: qcvn_samples)
CREATE TABLE IF NOT EXISTS mau_quan_trac_qcvn (
    ma SERIAL PRIMARY KEY,
    nguoi_dung_ma INTEGER REFERENCES nguoi_dung(ma) ON DELETE CASCADE,
    ten_mau VARCHAR(255) NOT NULL,
    loai VARCHAR(100) NOT NULL,
    loai_con VARCHAR(100) NOT NULL,
    gia_tri_quan_trac JSONB NOT NULL,
    tao_luc TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    du_an_ma INTEGER REFERENCES du_an(ma) ON DELETE SET NULL,
    trang_thai_tong_quat VARCHAR(40),
    trang_thai_danh_gia VARCHAR(40),
    chi_tiet_danh_gia JSONB,
    phien_ban_quy_tac_da_danh_gia VARCHAR(50),
    trang_thai_xac_minh_da_danh_gia VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_mau_quan_trac_qcvn_du_an_ma
    ON mau_quan_trac_qcvn(du_an_ma);

-- ----------------------------------------------------------------------------
-- VIEW TƯƠNG THÍCH TÊN TIẾNG ANH (1-1 VỚI 19 BẢNG VẬT LÝ)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW users AS
SELECT ma AS id, ten_dang_nhap AS username, mat_khau_bam AS password_hash,
       ma_dat_lai_mat_khau_bam AS reset_token_hash, ma_dat_lai_het_han_luc AS reset_token_expires,
       ho_ten AS full_name, vai_tro AS role, tao_luc AS created_at
FROM nguoi_dung;

CREATE OR REPLACE VIEW laws AS
SELECT ma AS id, loai AS type, nam AS year, ngay_sap_xep AS sort_date,
       so_hieu AS so, ten_van_ban AS ten, hieu_luc AS hieuluc, trang_thai AS status,
       mo_ta, dieu_khoan, ghi_chu AS note, lien_ket AS link,
       crawler_cap_nhat_luc AS last_crawled_mod, cap_nhat_luc AS updated_at
FROM luat;

CREATE OR REPLACE VIEW rules AS
SELECT ma AS id, ten_quy_tac AS rule_name, loai_quy_tac AS rule_type,
       bieu_thuc AS expression, dang_hoat_dong AS is_active, phien_ban AS version
FROM quy_tac;

CREATE OR REPLACE VIEW projects AS
SELECT ma AS id, nguoi_dung_ma AS user_id, ten_du_an AS name,
       du_lieu_bieu_mau AS form_data, trang_thai_danh_sach_ho_so AS checklist_state,
       tao_luc AS created_at, vi_do AS latitude, kinh_do AS longitude,
       dia_chi_hien_thi, quan_huyen, phuong_xa, ket_qua_phan_loai AS classification_result
FROM du_an;

CREATE OR REPLACE VIEW qcvns AS
SELECT ma AS id, ten_quy_chuan AS ten, pham_vi_ap_dung AS ap_dung, tham_so,
       ma_tieu_chuan AS standard_code, phien_ban_tieu_chuan AS standard_version,
       trang_thai AS status, loai_nguon AS source_type, ma_cot AS column_code,
       khoang_luu_luong AS flow_range, hieu_luc_tu AS effective_from,
       hieu_luc_den AS effective_to, bat_buoc_tu AS mandatory_for_all_from,
       thay_the AS replaces, quy_tac_chuyen_tiep AS transition_rules,
       trang_thai_xac_minh AS verification_status, trang_thai_cong_bo AS publication_status,
       tai_lieu_nguon AS source_document, phien_ban_quy_tac AS rule_version,
       nguoi_xac_minh AS verified_by, xac_minh_luc AS verified_at,
       cong_bo_luc AS published_at, cap_nhat_luc AS updated_at
FROM quy_chuan_qcvn;

CREATE OR REPLACE VIEW qcvn_samples AS
SELECT ma AS id, nguoi_dung_ma AS user_id, ten_mau AS name, loai AS type,
       loai_con AS sub_type, gia_tri_quan_trac AS values, tao_luc AS created_at,
       du_an_ma AS project_id, trang_thai_tong_quat,
       trang_thai_danh_gia AS overall_status, chi_tiet_danh_gia AS evaluation_details,
       phien_ban_quy_tac_da_danh_gia AS evaluated_rule_version,
       trang_thai_xac_minh_da_danh_gia AS evaluated_verification_status
FROM mau_quan_trac_qcvn;

CREATE OR REPLACE VIEW industries AS
SELECT ma_nganh AS code, ten_nganh AS name, muc_do_rui_ro AS risk_level,
       tao_luc AS created_at, ten_hien_thi AS display_name, ten_goi_khac AS aliases,
       nhan_quy_mo AS capacity_label, don_vi AS unit, ghi_chu AS note,
       ghi_chu_ra_soat AS audit_note, mo_ta_cong_doan AS process_stages_meta,
       trang_thai_xac_minh AS verification_status, trang_thai_cong_bo AS publication_status,
       phien_ban_quy_tac AS rule_version, tai_lieu_nguon AS source_document,
       nguoi_xac_minh AS verified_by, xac_minh_luc AS verified_at, cap_nhat_luc AS updated_at
FROM nganh_nghe;

CREATE OR REPLACE VIEW legal_appendices AS
SELECT ma AS id, luat_ma AS law_id, ten_phu_luc AS appendix_name,
       so_muc AS item_number, tom_tat_noi_dung AS content_summary
FROM phu_luc_phap_ly;

CREATE OR REPLACE VIEW classification_thresholds AS
SELECT ma AS id, nganh_nghe_ma AS industry_code, gia_tri_toi_thieu AS min_value,
       gia_tri_toi_da AS max_value, don_vi AS unit, nhom_du_an AS project_group,
       ho_so_phap_ly AS legal_doc_required, phu_luc_phap_ly_ma AS appendix_id,
       cong_doan AS process_stage, toan_tu AS operator, quy_mo_cong_suat AS capacity_scale,
       tham_quyen AS tq, tham_quyen_lich_su AS historical_tq, phu_luc,
       can_cu_phap_ly AS legal_ref, luat_ma AS law_id, hieu_luc_tu AS effective_from,
       hieu_luc_den AS effective_to, trang_thai_xac_minh AS verification_status,
       trang_thai_cong_bo AS publication_status, thu_tu_nguong AS tier_order,
       phien_ban_quy_tac AS rule_version, nguon_tham_chieu AS source_ref,
       nguoi_duyet AS approved_by, duyet_luc AS approved_at,
       la_phien_ban_hieu_luc AS is_active_version, het_hieu_luc_luc AS superseded_at,
       cap_nhat_luc AS updated_at
FROM nguong_phan_loai;

CREATE OR REPLACE VIEW audit_logs AS
SELECT ma AS id, nguoi_dung_ma AS user_id, hanh_dong AS action,
       dia_chi_ip AS ip_address, trinh_duyet AS user_agent,
       du_lieu AS payload, tao_luc AS created_at
FROM nhat_ky_kiem_toan;

CREATE OR REPLACE VIEW query_logs AS
SELECT ma AS id, nguoi_dung_ma AS user_id, loai_truy_van AS query_type,
       tham_so_dau_vao AS input_params, ket_qua_dau_ra AS output_result,
       truy_van_luc AS queried_at
FROM nhat_ky_truy_van;

CREATE OR REPLACE VIEW gis_layers AS
SELECT ma AS id, loai_lop AS layer_type, ten_lop AS name, danh_muc AS category,
       ma_co AS flag_key, vi_do AS latitude, kinh_do AS longitude,
       ban_kinh_km AS radius_km, hinh_hoc AS geometry_json, tinh AS province,
       can_cu_phap_ly AS legal_ref, trang_thai_xac_minh AS verification_status,
       trang_thai_cong_bo AS publication_status, tai_lieu_nguon AS source_document,
       nguoi_xac_minh AS verified_by, xac_minh_luc AS verified_at,
       tao_luc AS created_at, cap_nhat_luc AS updated_at
FROM lop_ban_do;

CREATE OR REPLACE VIEW law_rule_impacts AS
SELECT ma AS id, luat_ma AS law_id, ten_van_ban AS law_title,
       hanh_dong_su_kien AS event_action, loai_doi_tuong AS target_type,
       doi_tuong_ma AS target_id, nhan_doi_tuong AS target_label,
       muc_do AS severity, ly_do_anh_huong AS impact_reason, trang_thai AS status,
       nguoi_xu_ly_ma AS resolved_by, xu_ly_luc AS resolved_at,
       ghi_chu_xu_ly AS resolution_note, tao_luc AS created_at, cap_nhat_luc AS updated_at
FROM anh_huong_quy_tac_van_ban;

CREATE OR REPLACE VIEW law_update_history AS
SELECT ma AS id, luat_ma AS law_id, hanh_dong AS action,
       nguoi_cap_nhat_ma AS updated_by, cap_nhat_luc AS updated_at, mo_ta AS description
FROM lich_su_cap_nhat_van_ban;

CREATE OR REPLACE VIEW project_sensitive_verifications AS
SELECT ma AS id, du_an_ma AS project_id, co_yeu_to_khai_bao AS declared_flags,
       chi_tiet_khai_bao AS declared_details, du_lieu_khong_gian AS spatial_snapshot,
       tai_lieu_chung_minh AS evidence_ref, trang_thai_xac_minh AS verification_status,
       nguoi_xac_minh_ma AS verified_by, xac_minh_luc AS verified_at,
       ghi_chu_xac_minh AS verification_note, tao_luc AS created_at, cap_nhat_luc AS updated_at
FROM xac_minh_yeu_to_nhay_cam_du_an;

CREATE OR REPLACE VIEW rule_candidates AS
SELECT ma AS id, luat_ma AS law_id, ten_van_ban AS law_title,
       loai_doi_tuong AS target_type, ma_doi_tuong AS target_code, tieu_de AS title,
       du_lieu_de_xuat AS proposed_data, tom_tat_thay_doi AS diff_summary,
       do_tin_cay_trich_xuat AS extraction_confidence, trich_doan_nguon AS source_excerpt,
       trang_thai AS status, nguoi_duyet_ma AS reviewed_by, duyet_luc AS reviewed_at,
       ghi_chu_duyet AS review_note, tao_luc AS created_at, cap_nhat_luc AS updated_at
FROM de_xuat_quy_tac;

CREATE OR REPLACE VIEW rule_versions AS
SELECT ma AS id, quy_tac_ma AS rule_id, phien_ban AS version,
       bieu_thuc AS expression, nguoi_thay_doi_ma AS changed_by,
       thay_doi_luc AS changed_at, ly_do_thay_doi AS change_reason
FROM phien_ban_quy_tac;

CREATE OR REPLACE VIEW system_settings AS
SELECT khoa AS key, gia_tri AS value
FROM cai_dat_he_thong;

CREATE OR REPLACE VIEW compliance_obligations AS
SELECT ma AS id, du_an_ma AS project_id, nguoi_dung_ma AS user_id,
       ma_nghia_vu AS obligation_code, tieu_de AS title, can_cu_phap_ly AS legal_basis,
       chu_ky AS recurrence, han_nop AS due_date, so_ngay_nhac_truoc AS warning_days,
       trang_thai AS status, hoan_thanh_luc AS completed_at,
       nguoi_hoan_thanh_ma AS completed_by, ghi_chu_hoan_thanh AS completion_note,
       muc_canh_bao_cuoi AS last_alert_level, canh_bao_luc AS last_alerted_at,
       tao_luc AS created_at, cap_nhat_luc AS updated_at
FROM nghia_vu_tuan_thu;
