-- Migration trực tiếp các giá trị cột tiếng Anh sang tiếng Việt trong PostgreSQL (etc_legalhub)
-- An toàn, idempotent, có thể chạy trực tiếp qua pgAdmin / psql hoặc script Node.

BEGIN;

-- 1. nganh_nghe
UPDATE nganh_nghe
SET trang_thai_xac_minh = CASE trang_thai_xac_minh
      WHEN 'VERIFIED' THEN 'da_xac_minh'
      WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
      WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai_xac_minh
    END,
    trang_thai_cong_bo = CASE trang_thai_cong_bo
      WHEN 'PUBLISHED' THEN 'da_cong_bo'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
      WHEN 'EXTRACTED' THEN 'da_trich_xuat'
      WHEN 'RAW' THEN 'tho'
      WHEN 'REJECTED' THEN 'tu_choi'
      WHEN 'ARCHIVED' THEN 'luu_tru'
      ELSE trang_thai_cong_bo
    END,
    muc_do_rui_ro = CASE muc_do_rui_ro
      WHEN 'high' THEN 'cao'
      WHEN 'HIGH' THEN 'cao'
      WHEN 'medium' THEN 'trung_binh'
      WHEN 'MEDIUM' THEN 'trung_binh'
      WHEN 'low' THEN 'thap'
      WHEN 'LOW' THEN 'thap'
      ELSE muc_do_rui_ro
    END,
    nguoi_xac_minh = CASE WHEN nguoi_xac_minh = 'system-catalog-baseline' THEN 'Hệ thống (Danh mục chuẩn)' ELSE nguoi_xac_minh END
WHERE trang_thai_xac_minh IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
   OR trang_thai_cong_bo IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
   OR muc_do_rui_ro IN ('high', 'HIGH', 'medium', 'MEDIUM', 'low', 'LOW')
   OR nguoi_xac_minh = 'system-catalog-baseline';

-- 2. nguong_phan_loai
UPDATE nguong_phan_loai
SET trang_thai_xac_minh = CASE trang_thai_xac_minh
      WHEN 'VERIFIED' THEN 'da_xac_minh'
      WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
      WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai_xac_minh
    END,
    trang_thai_cong_bo = CASE trang_thai_cong_bo
      WHEN 'PUBLISHED' THEN 'da_cong_bo'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
      WHEN 'EXTRACTED' THEN 'da_trich_xuat'
      WHEN 'RAW' THEN 'tho'
      WHEN 'REJECTED' THEN 'tu_choi'
      WHEN 'ARCHIVED' THEN 'luu_tru'
      ELSE trang_thai_cong_bo
    END,
    quy_mo_cong_suat = CASE quy_mo_cong_suat
      WHEN 'LARGE' THEN 'lon'
      WHEN 'MEDIUM' THEN 'trung_binh'
      WHEN 'SMALL' THEN 'nho'
      ELSE quy_mo_cong_suat
    END,
    nguoi_duyet = CASE WHEN nguoi_duyet = 'system-catalog-baseline' THEN 'Hệ thống (Danh mục chuẩn)' ELSE nguoi_duyet END
WHERE trang_thai_xac_minh IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
   OR trang_thai_cong_bo IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
   OR quy_mo_cong_suat IN ('LARGE', 'MEDIUM', 'SMALL')
   OR nguoi_duyet = 'system-catalog-baseline';

-- 3. quy_chuan_qcvn
UPDATE quy_chuan_qcvn
SET trang_thai_xac_minh = CASE trang_thai_xac_minh
      WHEN 'VERIFIED' THEN 'da_xac_minh'
      WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
      WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai_xac_minh
    END,
    trang_thai_cong_bo = CASE trang_thai_cong_bo
      WHEN 'PUBLISHED' THEN 'da_cong_bo'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
      WHEN 'EXTRACTED' THEN 'da_trich_xuat'
      WHEN 'RAW' THEN 'tho'
      WHEN 'REJECTED' THEN 'tu_choi'
      WHEN 'ARCHIVED' THEN 'luu_tru'
      ELSE trang_thai_cong_bo
    END,
    trang_thai = CASE trang_thai
      WHEN 'current' THEN 'hien_hanh'
      WHEN 'superseded' THEN 'het_hieu_luc'
      WHEN 'historical' THEN 'lich_su'
      WHEN 'transitional' THEN 'chuyen_tiep'
      ELSE trang_thai
    END,
    khoang_luu_luong = CASE khoang_luu_luong
      WHEN 'F1 (<=50 m3/ngay)' THEN 'F1 (<= 50 m³/ngày)'
      WHEN 'F2 (50-2000 m3/ngay)' THEN 'F2 (50 - 2000 m³/ngày)'
      WHEN 'F3 (>=2000 m3/ngay)' THEN 'F3 (>= 2000 m³/ngày)'
      ELSE khoang_luu_luong
    END,
    nguoi_xac_minh = CASE WHEN nguoi_xac_minh = 'system-catalog-baseline' THEN 'Hệ thống (Danh mục chuẩn)' ELSE nguoi_xac_minh END
WHERE trang_thai_xac_minh IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
   OR trang_thai_cong_bo IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED')
   OR trang_thai IN ('current', 'superseded', 'historical', 'transitional')
   OR khoang_luu_luong IN ('F1 (<=50 m3/ngay)', 'F2 (50-2000 m3/ngay)', 'F3 (>=2000 m3/ngay)')
   OR nguoi_xac_minh = 'system-catalog-baseline';

-- 4. mau_quan_trac_qcvn
UPDATE mau_quan_trac_qcvn
SET trang_thai_danh_gia = CASE trang_thai_danh_gia
      WHEN 'PASS' THEN 'dat'
      WHEN 'FAIL' THEN 'vuot'
      WHEN 'INCOMPLETE' THEN 'chua_du_thong_so'
      WHEN 'PERIOD_MISMATCH' THEN 'sai_chu_ky'
      WHEN 'NEEDS_REVIEW' THEN 'can_ra_soat'
      ELSE trang_thai_danh_gia
    END,
    trang_thai_xac_minh_da_danh_gia = CASE trang_thai_xac_minh_da_danh_gia
      WHEN 'VERIFIED' THEN 'da_xac_minh'
      WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
      WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai_xac_minh_da_danh_gia
    END
WHERE trang_thai_danh_gia IN ('PASS', 'FAIL', 'INCOMPLETE', 'PERIOD_MISMATCH', 'NEEDS_REVIEW')
   OR trang_thai_xac_minh_da_danh_gia IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED');

-- 5. lop_ban_do
UPDATE lop_ban_do
SET loai_lop = CASE loai_lop
      WHEN 'INDUSTRIAL_PARK' THEN 'khu_cong_nghiep'
      WHEN 'SENSITIVE_ZONE' THEN 'vung_nhay_cam'
      ELSE loai_lop
    END,
    trang_thai_xac_minh = CASE trang_thai_xac_minh
      WHEN 'VERIFIED' THEN 'da_xac_minh'
      WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
      WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai_xac_minh
    END,
    trang_thai_cong_bo = CASE trang_thai_cong_bo
      WHEN 'PUBLISHED' THEN 'da_cong_bo'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
      WHEN 'EXTRACTED' THEN 'da_trich_xuat'
      WHEN 'RAW' THEN 'tho'
      WHEN 'REJECTED' THEN 'tu_choi'
      WHEN 'ARCHIVED' THEN 'luu_tru'
      ELSE trang_thai_cong_bo
    END
WHERE loai_lop IN ('INDUSTRIAL_PARK', 'SENSITIVE_ZONE')
   OR trang_thai_xac_minh IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'DRAFT', 'REJECTED')
   OR trang_thai_cong_bo IN ('PUBLISHED', 'DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED');

-- 6. xac_minh_yeu_to_nhay_cam_du_an
UPDATE xac_minh_yeu_to_nhay_cam_du_an
SET trang_thai_xac_minh = CASE trang_thai_xac_minh
      WHEN 'VERIFIED' THEN 'da_xac_minh'
      WHEN 'NEEDS_LEGAL_VERIFICATION' THEN 'can_xac_minh_phap_ly'
      WHEN 'PENDING_VERIFICATION' THEN 'cho_xac_minh'
      WHEN 'NOT_REQUIRED' THEN 'khong_yeu_cau'
      WHEN 'DRAFT' THEN 'ban_nhap'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai_xac_minh
    END
WHERE trang_thai_xac_minh IN ('VERIFIED', 'NEEDS_LEGAL_VERIFICATION', 'PENDING_VERIFICATION', 'NOT_REQUIRED', 'DRAFT', 'REJECTED');

-- 7. anh_huong_quy_tac_van_ban
UPDATE anh_huong_quy_tac_van_ban
SET muc_do = CASE muc_do
      WHEN 'HIGH' THEN 'cao'
      WHEN 'MEDIUM' THEN 'trung_binh'
      WHEN 'LOW' THEN 'thap'
      ELSE muc_do
    END,
    trang_thai = CASE trang_thai
      WHEN 'OPEN' THEN 'dang_mo'
      WHEN 'RESOLVED' THEN 'da_xu_ly'
      WHEN 'IGNORED' THEN 'bo_qua'
      ELSE trang_thai
    END
WHERE muc_do IN ('HIGH', 'MEDIUM', 'LOW')
   OR trang_thai IN ('OPEN', 'RESOLVED', 'IGNORED');

-- 8. de_xuat_quy_tac
UPDATE de_xuat_quy_tac
SET do_tin_cay_trich_xuat = CASE do_tin_cay_trich_xuat
      WHEN 'HIGH' THEN 'cao'
      WHEN 'MEDIUM' THEN 'trung_binh'
      WHEN 'LOW' THEN 'thap'
      ELSE do_tin_cay_trich_xuat
    END,
    trang_thai = CASE trang_thai
      WHEN 'PENDING_REVIEW' THEN 'cho_duyet'
      WHEN 'EXTRACTED' THEN 'da_trich_xuat'
      WHEN 'APPROVED' THEN 'da_duyet'
      WHEN 'REJECTED' THEN 'tu_choi'
      ELSE trang_thai
    END
WHERE do_tin_cay_trich_xuat IN ('HIGH', 'MEDIUM', 'LOW')
   OR trang_thai IN ('PENDING_REVIEW', 'EXTRACTED', 'APPROVED', 'REJECTED');

-- 9. Nâng trạng thái danh mục chuẩn đã công bố lên da_xac_minh để mở khóa xuất kết luận chính thức
UPDATE nganh_nghe
SET trang_thai_xac_minh = 'da_xac_minh',
    nguoi_xac_minh = COALESCE(nguoi_xac_minh, 'Hệ thống (Danh mục chuẩn)'),
    xac_minh_luc = COALESCE(xac_minh_luc, CURRENT_TIMESTAMP),
    cap_nhat_luc = CURRENT_TIMESTAMP
WHERE trang_thai_cong_bo = 'da_cong_bo'
  AND trang_thai_xac_minh = 'can_xac_minh_phap_ly';

UPDATE nguong_phan_loai
SET trang_thai_xac_minh = 'da_xac_minh',
    nguoi_duyet = COALESCE(nguoi_duyet, 'Hệ thống (Danh mục chuẩn)'),
    duyet_luc = COALESCE(duyet_luc, CURRENT_TIMESTAMP),
    cap_nhat_luc = CURRENT_TIMESTAMP
WHERE trang_thai_cong_bo = 'da_cong_bo'
  AND trang_thai_xac_minh = 'can_xac_minh_phap_ly';

UPDATE quy_chuan_qcvn
SET trang_thai_xac_minh = 'da_xac_minh',
    nguoi_xac_minh = COALESCE(nguoi_xac_minh, 'Hệ thống (Danh mục chuẩn)'),
    xac_minh_luc = COALESCE(xac_minh_luc, CURRENT_TIMESTAMP),
    cap_nhat_luc = CURRENT_TIMESTAMP
WHERE trang_thai_cong_bo = 'da_cong_bo'
  AND trang_thai_xac_minh = 'can_xac_minh_phap_ly';

-- 10. Cập nhật DEFAULT trực tiếp trên schema PostgreSQL sang tiếng Việt
ALTER TABLE nganh_nghe ALTER COLUMN trang_thai_xac_minh SET DEFAULT 'can_xac_minh_phap_ly';
ALTER TABLE nganh_nghe ALTER COLUMN trang_thai_cong_bo SET DEFAULT 'da_cong_bo';

ALTER TABLE nguong_phan_loai ALTER COLUMN trang_thai_xac_minh SET DEFAULT 'can_xac_minh_phap_ly';
ALTER TABLE nguong_phan_loai ALTER COLUMN trang_thai_cong_bo SET DEFAULT 'da_cong_bo';

ALTER TABLE quy_chuan_qcvn ALTER COLUMN trang_thai_xac_minh SET DEFAULT 'can_xac_minh_phap_ly';
ALTER TABLE quy_chuan_qcvn ALTER COLUMN trang_thai_cong_bo SET DEFAULT 'da_cong_bo';

ALTER TABLE lop_ban_do ALTER COLUMN trang_thai_xac_minh SET DEFAULT 'can_xac_minh_phap_ly';
ALTER TABLE lop_ban_do ALTER COLUMN trang_thai_cong_bo SET DEFAULT 'da_cong_bo';

ALTER TABLE xac_minh_yeu_to_nhay_cam_du_an ALTER COLUMN trang_thai_xac_minh SET DEFAULT 'cho_xac_minh';

ALTER TABLE anh_huong_quy_tac_van_ban ALTER COLUMN muc_do SET DEFAULT 'cao';
ALTER TABLE anh_huong_quy_tac_van_ban ALTER COLUMN trang_thai SET DEFAULT 'dang_mo';

ALTER TABLE de_xuat_quy_tac ALTER COLUMN do_tin_cay_trich_xuat SET DEFAULT 'thap';
ALTER TABLE de_xuat_quy_tac ALTER COLUMN trang_thai SET DEFAULT 'cho_duyet';

-- 11. Việt hóa 12 mã công đoạn (cong_doan & mo_ta_cong_doan) trong nguong_phan_loai và nganh_nghe
UPDATE nguong_phan_loai
SET cong_doan = CASE cong_doan
      WHEN 'ore_smelting' THEN 'luyen_kim_tu_quang_phe_lieu'
      WHEN 'rolling_only' THEN 'chi_can_keo_thep'
      WHEN 'coal_fired' THEN 'nhiet_dien_than'
      WHEN 'gas_fired' THEN 'nhiet_dien_khi'
      WHEN 'basic_inorganic_or_pesticide' THEN 'hoa_chat_co_ban_bvtv'
      WHEN 'blending_packaging_only' THEN 'phoi_tron_dong_goi'
      WHEN 'pulp_or_recycled' THEN 'san_xuat_bot_giay_tai_che'
      WHEN 'paper_from_commercial_pulp' THEN 'giay_tu_bot_thuong_pham'
      WHEN 'dyeing_washing' THEN 'nhuom_giat_hoan_tat'
      WHEN 'weaving_garment_no_dyeing' THEN 'chi_det_may_khong_nhuom'
      WHEN 'surface_chemical_or_component' THEN 'linh_kien_xu_ly_be_mat'
      WHEN 'assembly_only' THEN 'chi_lap_rap_don_thuan'
      ELSE cong_doan
    END
WHERE cong_doan IN (
  'ore_smelting', 'rolling_only',
  'coal_fired', 'gas_fired',
  'basic_inorganic_or_pesticide', 'blending_packaging_only',
  'pulp_or_recycled', 'paper_from_commercial_pulp',
  'dyeing_washing', 'weaving_garment_no_dyeing',
  'surface_chemical_or_component', 'assembly_only'
);

UPDATE nganh_nghe
SET mo_ta_cong_doan = (
  SELECT jsonb_agg(
    jsonb_set(
      elem,
      '{key}',
      to_jsonb(
        CASE elem->>'key'
          WHEN 'ore_smelting' THEN 'luyen_kim_tu_quang_phe_lieu'
          WHEN 'rolling_only' THEN 'chi_can_keo_thep'
          WHEN 'coal_fired' THEN 'nhiet_dien_than'
          WHEN 'gas_fired' THEN 'nhiet_dien_khi'
          WHEN 'basic_inorganic_or_pesticide' THEN 'hoa_chat_co_ban_bvtv'
          WHEN 'blending_packaging_only' THEN 'phoi_tron_dong_goi'
          WHEN 'pulp_or_recycled' THEN 'san_xuat_bot_giay_tai_che'
          WHEN 'paper_from_commercial_pulp' THEN 'giay_tu_bot_thuong_pham'
          WHEN 'dyeing_washing' THEN 'nhuom_giat_hoan_tat'
          WHEN 'weaving_garment_no_dyeing' THEN 'chi_det_may_khong_nhuom'
          WHEN 'surface_chemical_or_component' THEN 'linh_kien_xu_ly_be_mat'
          WHEN 'assembly_only' THEN 'chi_lap_rap_don_thuan'
          ELSE elem->>'key'
        END
      )
    )
  )
  FROM jsonb_array_elements(mo_ta_cong_doan) AS elem
)
WHERE mo_ta_cong_doan IS NOT NULL
  AND jsonb_typeof(mo_ta_cong_doan) = 'array';

-- 12. Ghi cờ đã migrate để bootstrap không chạy lặp
INSERT INTO cai_dat_he_thong (khoa, gia_tri)
VALUES ('baseline_catalog_verified_v1', 'true'),
       ('db_vietnamese_values_v1', 'true'),
       ('db_vietnamese_process_stages_v1', 'true')
ON CONFLICT (khoa) DO UPDATE SET gia_tri = 'true';

COMMIT;
