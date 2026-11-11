// backend/services/classification-service.js
// Dịch vụ Phân loại Hồ sơ Môi trường & Xác định Thẩm quyền (Kiến trúc 3 bước độc lập sau Kiểm toán Pháp lý)
const defaultDb = require('../config/db');
const { loadClassificationCatalog, getProjectSensitiveVerification } = require('./rule-repository');
const { calculateImpactRadius, analyzeSpatialContext, analyzeSpatialContextWithDb } = require('./spatial-gis-service');

const RULE_SCHEMA_VERSION = '2026.2-audit';
const TWO_TIER_GOV_EFFECTIVE_DATE = '2025-07-01';
const VBHN_49_EFFECTIVE_DATE = '2026-01-29';

const INDUSTRY_ALIASES = {
  san_bay: 'cang_hang_khong',
};

const INDUSTRY_META = {
  che_bien_go: { name: 'Chế biến gỗ, dăm gỗ, ván nhân tạo (MDF, ván sàn)', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  xi_mang: { name: 'Xi măng, clinker', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  thep: {
    name: 'Luyện kim, sản xuất thép, phôi thép',
    groupLabel: 'Công nghiệp chế biến & Chế tạo',
    processStages: [
      { key: 'ore_smelting', label: 'Luyện kim / Luyện gang thép từ quặng hoặc phế liệu' },
      { key: 'rolling_only', label: 'Chỉ cán, kéo, tạo hình thép (không luyện kim)' },
    ],
  },
  nhiet_dien: {
    name: 'Nhiệt điện (than, khí, sinh khối)',
    groupLabel: 'Khai thác Khoáng sản & Năng lượng',
    processStages: [
      { key: 'coal_fired', label: 'Nhiệt điện than / Nhiên liệu rắn' },
      { key: 'gas_fired', label: 'Nhiệt điện khí / Tua-bin khí' },
    ],
  },
  khai_thac_ks: { name: 'Khai thác khoáng sản rắn (than, quặng, đá, cát)', groupLabel: 'Khai thác Khoáng sản & Năng lượng' },
  hoa_chat: {
    name: 'Hóa chất, phân bón hóa học, thuốc BVTV',
    groupLabel: 'Công nghiệp chế biến & Chế tạo',
    processStages: [
      { key: 'basic_inorganic_or_pesticide', label: 'Sản xuất hóa chất cơ bản / phân bón hóa học / thuốc BVTV' },
      { key: 'blending_packaging_only', label: 'Chỉ phối trộn, sang chiết, đóng gói (không phản ứng hóa học)' },
    ],
  },
  giay_bot: {
    name: 'Giấy, bột giấy, carton',
    groupLabel: 'Công nghiệp chế biến & Chế tạo',
    processStages: [
      { key: 'pulp_or_recycled', label: 'Có sản xuất bột giấy hoặc tái chế giấy phế liệu' },
      { key: 'paper_from_commercial_pulp', label: 'Chỉ sản xuất giấy từ bột giấy thương phẩm' },
    ],
  },
  det_nhuom: {
    name: 'Dệt, nhuộm, hoàn tất vải sợi',
    groupLabel: 'Công nghiệp chế biến & Chế tạo',
    processStages: [
      { key: 'dyeing_washing', label: 'Có công đoạn nhuộm, giặt mài, hoàn tất hóa chất' },
      { key: 'weaving_garment_no_dyeing', label: 'Chỉ dệt, may mặc (không nhuộm/giặt mài)' },
    ],
  },
  thuc_pham: { name: 'Chế biến thực phẩm, đồ uống, thủy sản', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  nhua_cao_su: { name: 'Nhựa, cao su tổng hợp', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  cao_su_cb: { name: 'Chế biến mủ cao su tự nhiên (mủ khô)', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  duoc_pham: { name: 'Dược phẩm, sinh phẩm, mỹ phẩm', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  dien_tu: {
    name: 'Điện tử, bán dẫn, linh kiện công nghệ',
    groupLabel: 'Công nghiệp chế biến & Chế tạo',
    processStages: [
      { key: 'surface_chemical_or_component', label: 'Sản xuất linh kiện / có xử lý bề mặt, mạ, hóa chất' },
      { key: 'assembly_only', label: 'Chỉ lắp ráp đơn thuần (không xử lý bề mặt/hóa chất)' },
    ],
  },
  vat_lieu_xd: { name: 'Vật liệu xây dựng (gạch, ngói, gốm sứ)', groupLabel: 'Công nghiệp chế biến & Chế tạo' },
  kcn: { name: 'Khu công nghiệp / KCX / Khu kinh tế', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  khu_cong_nghe: { name: 'Khu công nghệ cao, cụm công nghiệp', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  xl_chat_thai: { name: 'Cơ sở tái chế, xử lý chất thải rắn', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  xl_nuoc_thai: { name: 'Hệ thống xử lý nước thải tập trung', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  khai_thac_nuoc: { name: 'Khai thác tài nguyên nước mặt / nước dưới đất', groupLabel: 'Khai thác Khoáng sản & Năng lượng' },
  khai_thac_dau_khi: { name: 'Khai thác dầu khí', groupLabel: 'Khai thác Khoáng sản & Năng lượng' },
  do_thi: { name: 'Khu đô thị, nhà ở, chung cư', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  cao_toc: { name: 'Đường cao tốc, quốc lộ, đường bộ', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  duong_sat: { name: 'Đường sắt, đường sắt đô thị (metro)', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  cang_bien: { name: 'Cảng biển, bến cảng nước sâu', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  cang_hang_khong: { name: 'Cảng hàng không, sân bay', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  trung_tam_tm: { name: 'Trung tâm thương mại, siêu thị, văn phòng', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  khach_san: { name: 'Khách sạn, resort, khu du lịch sinh thái', groupLabel: 'Y tế, Du lịch & Nông — Lâm — Thủy sản' },
  benh_vien: { name: 'Bệnh viện, phòng khám, cơ sở y tế', groupLabel: 'Y tế, Du lịch & Nông — Lâm — Thủy sản' },
  nuoi_thuy_san: { name: 'Nuôi trồng thủy sản nước ngọt / nước lợ', groupLabel: 'Y tế, Du lịch & Nông — Lâm — Thủy sản' },
  nuoi_ts_bien: { name: 'Nuôi trồng thủy sản trên biển / lồng bè', groupLabel: 'Y tế, Du lịch & Nông — Lâm — Thủy sản' },
  xu_ly_ctnh: { name: 'Xử lý, tiêu hủy chất thải nguy hại (CTNH)', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  xu_ly_ctr: { name: 'Xử lý chất thải rắn sinh hoạt / CN thông thường', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  bai_rac: { name: 'Bãi chôn lấp chất thải, khu liên hợp XLCT', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  chan_nuoi: { name: 'Chăn nuôi gia súc, gia cầm tập trung', groupLabel: 'Y tế, Du lịch & Nông — Lâm — Thủy sản' },
  thuy_dien: { name: 'Thủy điện', groupLabel: 'Khai thác Khoáng sản & Năng lượng' },
  dien_mat_troi: { name: 'Nhà máy điện mặt trời', groupLabel: 'Khai thác Khoáng sản & Năng lượng' },
  dien_gio: { name: 'Nhà máy điện gió', groupLabel: 'Khai thác Khoáng sản & Năng lượng' },
  nao_vet: { name: 'Nạo vét luồng hàng hải, kênh rạch', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
  ho_chua: { name: 'Hồ chứa nước, công trình thủy lợi', groupLabel: 'Hạ tầng Kỹ thuật, Giao thông & Môi trường' },
};

// Bảng dữ liệu ngành nghề (IND_DB)
// Lưu ý kiểm toán pháp lý: Mọi ngưỡng chưa có bản phụ lục gốc xác minh trực tiếp trong kho dữ liệu
// đều được gắn verificationStatus: 'NEEDS_LEGAL_VERIFICATION' kèm ghi chú đối chiếu tại auditNote.
const IND_DB = {
  // ── 1. CHẾ BIẾN GỖ, DĂM GỖ, VÁN NHÂN TẠO ──
  che_bien_go: {
    lbl: 'Công suất sản xuất (m³ sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa chứng minh được các ngưỡng 200.000 / 50.000 / 5.000 từ đúng hàng phụ lục hiện hành; cần đối chiếu Phụ lục II, III, IV VBHN 49/VBHN-BNNMT.',
    t: [
      { min: 200000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 50000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 5000, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Ngưỡng công suất cần đối chiếu nguyên văn Phụ lục III, IV VBHN 49/VBHN-BNNMT trước khi kết luận chính thức (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 2. XI MĂNG ──
  xi_mang: {
    lbl: 'Công suất clinker / xi măng (triệu tấn/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Mã nguồn đang đặt 1 / 0,2 triệu tấn clinker/năm; điểm đối chiếu sơ bộ ghi nhận mức lớn từ 1.200.000 tấn sản phẩm/năm. Cần xác minh đúng đơn vị (clinker vs xi măng) từ phụ lục gốc.',
    t: [
      { min: 1.2, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0.2, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần phân biệt công suất tính theo clinker hay xi măng sản phẩm và đối chiếu Phụ lục II, III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 3. LUYỆN THÉP, KIM LOẠI ──
  thep: {
    lbl: 'Công suất sản xuất (triệu tấn sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Cần tách luyện kim từ quặng, từ phế liệu, cán thép, gia công; điểm đối chiếu sơ bộ ghi nhận ngưỡng lớn từ 300.000 tấn sản phẩm/năm (0,3 triệu tấn/năm) kèm điều kiện công đoạn.',
    processRules: {
      ore_smelting: [
        { min: 0.3, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      rolling_only: [
        { min: 0.5, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
    },
    t: [
      { min: 0.3, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 3', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0.1, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 3', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 3', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Phải xác định rõ nguyên liệu (quặng hay phế liệu) và công đoạn (luyện kim hay chỉ cán/kéo) theo Phụ lục II, III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 4. NHIỆT ĐIỆN ──
  nhiet_dien: {
    lbl: 'Công suất lắp đặt (MW)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Cần tách nhiệt điện than (điểm đối chiếu sơ bộ ngưỡng lớn từ 600 MW) với nhiệt điện khí, sinh khối và loại hình khác.',
    processRules: {
      coal_fired: [
        { min: 600, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      gas_fired: [
        { min: 600, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
    },
    t: [
      { min: 600, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 4', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 100, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 4', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'SMALL', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 4', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Phải tách loại nhiên liệu (than, khí, sinh khối) theo Phụ lục II, III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 5. KHAI THÁC KHOÁNG SẢN ──
  khai_thac_ks: {
    lbl: 'Công suất khai thác (m³ nguyên khai/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa phân biệt khai thác với chế biến khoáng sản độc hại, kim loại hoặc sử dụng hóa chất độc.',
    t: [
      { min: 500000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 5', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 50000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 5', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 5', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần phân biệt loại khoáng sản (kim loại, độc hại, vật liệu xây dựng thông thường) và thẩm quyền cấp phép khai thác (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 6. HÓA CHẤT, PHÂN BÓN, THUỐC BVTV ──
  hoa_chat: {
    lbl: 'Công suất sản xuất (tấn sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Một số loại hóa chất vô cơ cơ bản, phân bón hóa học, hóa chất BVTV có ngưỡng lớn từ 5.000 tấn/năm và mức trung bình 1.000 đến dưới 5.000 tấn/năm. Cần tách theo nhóm hóa chất và công đoạn.',
    processRules: {
      basic_inorganic_or_pesticide: [
        { min: 5000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 1000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      blending_packaging_only: [
        { min: 10000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
    },
    t: [
      { min: 5000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 6', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 1000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 6', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 6', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần tách rõ phân nhóm: hóa chất vô cơ cơ bản, phân bón hóa học, thuốc BVTV hay chỉ phối trộn/sang chiết (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 7. GIẤY VÀ BỘT GIẤY ──
  giay_bot: {
    lbl: 'Công suất sản xuất (tấn/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Với loại hình giấy có công đoạn sản xuất bột giấy hoặc sử dụng nguyên liệu tái chế, ngưỡng lớn đã đối chiếu sơ bộ là từ 50.000 tấn/năm; mức trung bình 5.000 đến dưới 50.000 tấn/năm. Cần tách công đoạn bột giấy và giấy thương phẩm.',
    processRules: {
      pulp_or_recycled: [
        { min: 50000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 7', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 5000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV, Mục 7', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      paper_from_commercial_pulp: [
        { min: 100000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 10000, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
    },
    t: [
      { min: 50000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 7', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 5000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 300, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Phải tách rõ có công đoạn sản xuất bột giấy/tái chế hay chỉ sản xuất giấy từ bột giấy thương phẩm (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 8. DỆT NHUỘM, MAY MẶC CÓ NHUỘM ──
  det_nhuom: {
    lbl: 'Công suất dệt nhuộm (triệu m²/năm hoặc tấn sợi/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Phụ lục có tiêu chí riêng theo triệu m²/năm đối với vải dệt nhuộm và tấn/năm đối với sản xuất sợi; cần tách công đoạn nhuộm/giặt mài với chỉ dệt/may không nhuộm.',
    processRules: {
      dyeing_washing: [
        { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 8', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 5, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV, Mục 8', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 8', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      weaving_garment_no_dyeing: [
        { min: 50, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'LARGE', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 8', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
    },
    t: [
      { min: 50000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 8', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 8', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 8', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần xác minh đơn vị tính (triệu m²/năm đối với vải hay tấn/năm đối với sợi) và công đoạn có nhuộm/giặt mài hay không (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 9. CHẾ BIẾN THỰC PHẨM, ĐỒ UỐNG ──
  thuc_pham: {
    lbl: 'Công suất sản xuất (tấn sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Gộp nhiều ngành có tiêu chí khác nhau như bia, đường, thủy sản, tinh bột sắn, sữa, giết mổ.',
    t: [
      { min: 100000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 11', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 20000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 11', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 1000, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 11', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 100, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần tách riêng chế biến thủy sản, mía đường, tinh bột sắn, rượu/bia/nước giải khát theo đúng hàng phụ lục (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 10. NHỰA, CAO SU TỔNG HỢP ──
  nhua_cao_su: {
    lbl: 'Công suất sản xuất (tấn sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Gộp nhựa và cao su tổng hợp; phải tách theo hoạt động (sản xuất hạt nhựa nguyên sinh, tái chế nhựa hay ép phun sản phẩm nhựa).',
    t: [
      { min: 100000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 9', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 9', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 1000, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 9', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần phân biệt tái chế nhựa phế liệu với sản xuất sản phẩm nhựa từ hạt nhựa nguyên sinh (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 11. CHẾ BIẾN MỦ CAO SU THIÊN NHIÊN ──
  cao_su_cb: {
    lbl: 'Công suất chế biến (tấn mủ khô/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Chế biến mủ cao su đã đối chiếu sơ bộ với ngưỡng lớn >= 15.000; trung bình 6.000 đến dưới 15.000; nhỏ dưới 6.000 tấn/năm (mã nguồn cũ đặt 30.000 / 5.000 / 1.000).',
    t: [
      { min: 15000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 10', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 6000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 10', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: 'Phụ lục IV, Mục 10', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Ngưỡng chế biến mủ cao su (15.000 / 6.000 tấn/năm) cần đối chiếu nguyên văn Phụ lục II, III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 12. DƯỢC PHẨM, MỸ PHẨM ──
  duoc_pham: {
    lbl: 'Công suất sản xuất (tấn sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa có căn cứ đủ rõ cho các ngưỡng 10.000 / 1.000 / 100 tấn; cần phân biệt sản xuất hóa dược, vắc-xin với bào chế thuốc thông thường.',
    t: [
      { min: 10000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 12', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 1000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 12', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 100, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 12', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần tách sản xuất nguyên liệu hóa dược/kháng sinh với cơ sở đóng gói, bào chế dược phẩm (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 13. ĐIỆN TỬ, BÁN DẪN, THIẾT BỊ ĐIỆN ──
  dien_tu: {
    lbl: 'Công suất (triệu sản phẩm/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Một số hoạt động có ngưỡng lớn 50 triệu sản phẩm/năm; mức trung bình từ 100.000 (0,1 triệu) đến dưới 50 triệu sản phẩm/năm, kèm điều kiện công đoạn (mạ, làm sạch bề mặt bằng hóa chất, sản xuất linh kiện vs chỉ lắp ráp).',
    processRules: {
      surface_chemical_or_component: [
        { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 13', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0.1, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV, Mục 13', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      assembly_only: [
        { min: 50, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'LARGE', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13', ref: 'VBHN 49/2026', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
    },
    t: [
      { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 13', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0.1, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần đối chiếu đơn vị (triệu sản phẩm/năm hoặc tấn/năm tùy phân nhóm thiết bị điện/điện tử) và công đoạn xử lý bề mặt trong Phụ lục II, III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 14. VẬT LIỆU XÂY DỰNG (GẠCH, NGÓI, GỐM SỨ, KÍNH) ──
  vat_lieu_xd: {
    lbl: 'Công suất sản xuất (triệu viên QTC/năm hoặc tấn/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Gộp gạch, ngói, gốm sứ; không thể dùng một ngưỡng sản phẩm chung nếu phụ lục phân biệt.',
    t: [
      { min: 100, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 14', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 20, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 14', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần tách riêng sản xuất kính xây dựng, gạch ốp lát Ceramic/Granite, sứ vệ sinh và gạch đất sét nung (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 15. KHU CÔNG NGHIỆP, KHU CHẾ XUẤT, CỤM CÔNG NGHIỆP ──
  kcn: {
    lbl: 'Diện tích quy hoạch (ha)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Không thể chỉ dùng diện tích KCN để quyết định toàn bộ nghĩa vụ môi trường; cần phân biệt KCN với Cụm công nghiệp và loại hình ngành nghề thu hút.',
    t: [
      { min: 200, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 15', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 15', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Đầu tư hạ tầng KCN bắt buộc có hệ thống thu gom, xử lý nước thải tập trung đạt QCVN 40:2025/BTNMT và quan trắc tự động (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 16. KHU CÔNG NGHỆ CAO, KHU KINH TẾ ──
  khu_cong_nghe: {
    lbl: 'Diện tích (ha)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Gộp khu công nghệ cao và khu kinh tế; cần đối chiếu điều kiện phân loại riêng.',
    t: [
      { min: 200, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 15', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 15', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 17. XỬ LÝ CHẤT THẢI RẮN, CHẤT THẢI NGUY HẠI ──
  xl_chat_thai: {
    lbl: 'Công suất xử lý (tấn/ngày)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Cần tách xử lý chất thải nguy hại (Nhóm I) với xử lý chất thải rắn sinh hoạt/thông thường.',
    t: [
      { min: 500, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 16', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 16', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Dự án dịch vụ xử lý chất thải nguy hại thuộc Nhóm I thẩm quyền Bộ Nông nghiệp và Môi trường (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 18. HỆ THỐNG XỬ LÝ NƯỚC THẢI TẬP TRUNG ĐÔ THỊ / KCN ──
  xl_nuoc_thai: {
    lbl: 'Công suất thiết kế (m³/ngày đêm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Cần phân biệt hệ thống XLNT tập trung độc lập với công trình XLNT nội bộ dự án.',
    t: [
      { min: 50000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 16', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 5000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 16', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 16', ref: 'NĐ 48/2026, Điều 8', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Kiểm tra điều kiện thay đổi công nghệ HTXLNT lưu lượng ≥50 m³/ngày theo Điều 8 NĐ 48/2026 (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 19. KHAI THÁC NƯỚC MẶT / NƯỚC DƯỚI ĐẤT ──
  khai_thac_nuoc: {
    lbl: 'Lưu lượng khai thác (m³/ngày đêm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Gộp nước mặt và nước dưới đất; phải xét quy định tài nguyên nước (Luật Tài nguyên nước 2023, NĐ 53/2024) và điều kiện môi trường riêng.',
    t: [
      { min: 50000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 17', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 3000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 17', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Luật BVMT 2020 + NĐ 53/2024', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần tách ngưỡng khai thác nước mặt và nước dưới đất theo Luật Tài nguyên nước 2023 và NĐ 53/2024/NĐ-CP (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 20. KHAI THÁC DẦU KHÍ ──
  khai_thac_dau_khi: {
    lbl: 'Sản lượng khai thác (triệu tấn quy dầu/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Loại hình khai thác dầu thô, khí đốt tự nhiên được liệt kê ở nhóm lớn theo phạm vi phụ lục; không dùng ngưỡng tự đặt 0,5 triệu tấn nếu phụ lục không chia theo cách đó.',
    t: [
      { min: 0, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 5', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần đối chiếu ngưỡng phân loại dự án khai thác dầu thô, khí đốt tự nhiên tại Phụ lục III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 21. KHU ĐÔ THỊ, KHU DÂN CƯ ──
  do_thi: {
    lbl: 'Diện tích đất (ha)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'A09 & Mục 4.2 README: Các mốc diện tích 300 ha và 50 ha cần gắn đúng tiêu chí quy mô dự án; ngưỡng 10 ha cho GPMT/ĐKMT chưa có căn cứ thể hiện trong logic. Phải tách tiêu chí diện tích khỏi nghĩa vụ thủ tục môi trường.',
    t: [
      { min: 300, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III (sửa đổi bởi NĐ 48/2026)', ref: 'NĐ 48/2026, Điều 5', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 50, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV (sửa đổi bởi NĐ 48/2026)', ref: 'NĐ 48/2026, Điều 5', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: 'Phụ lục IV (cần xác minh nghĩa vụ GPMT/ĐKMT theo phát sinh chất thải)', ref: 'Điều 39 & Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'A09: Diện tích khu đô thị dùng để xác định quy mô/nhóm dự án; nghĩa vụ GPMT hay ĐKMT phụ thuộc vào tiêu chí phát sinh nước thải/chất thải phải xử lý theo Điều 39, 49 Luật BVMT 2020 (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 22. ĐƯỜNG CAO TỐC, ĐƯỜNG BỘ ──
  cao_toc: {
    lbl: 'Chiều dài tuyến (km)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Phải xét đúng cấp kỹ thuật đường bộ (cấp I, II, III, cao tốc), quy mô sử dụng đất và điều kiện phụ lục; không chỉ chiều dài.',
    t: [
      { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 18', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 18', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 18', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cần xét cấp đường bộ và việc tuyến đi qua địa bàn từ 02 tỉnh trở lên (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 23. ĐƯỜNG SẮT, ĐƯỜNG SẮT ĐÔ THỊ (METRO) ──
  duong_sat: {
    lbl: 'Chiều dài tuyến (km)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Phải xét loại tuyến, quy mô và điều kiện pháp lý.',
    t: [
      { min: 30, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 18', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 18', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 24. CẢNG BIỂN, CẢNG SÔNG ──
  cang_bien: {
    lbl: 'Công suất thông qua (triệu tấn hàng/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa xác minh được ngưỡng 30 và 1 triệu tấn hàng/năm; cần xét loại cảng (đặc biệt, loại I, II, III) và trọng tải tàu tiếp nhận (DWT).',
    t: [
      { min: 30, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 19', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 1, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 19', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 19', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 25. CẢNG HÀNG KHÔNG, SÂN BAY ──
  cang_hang_khong: {
    lbl: 'Công suất thiết kế (triệu hành khách/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa xác minh được ngưỡng 5 triệu hành khách/năm.',
    t: [
      { min: 5, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 19', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 19', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 26. TRUNG TÂM THƯƠNG MẠI, SIÊU THỊ, CHỢ ──
  trung_tam_tm: {
    lbl: 'Diện tích sàn xây dựng (m²)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Không thể mặc định diện tích sàn là tiêu chí duy nhất; phải xét diện tích sử dụng đất và lưu lượng nước thải phát sinh.',
    t: [
      { min: 50000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 20', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10000, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 20', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 27. KHÁCH SẠN, KHU NGHỈ DƯỠNG (RESORT) ──
  khach_san: {
    lbl: 'Quy mô (buồng / phòng lưu trú)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Không thể mặc định số phòng là tiêu chí duy nhất; phải xét diện tích sử dụng đất và phát sinh nước thải.',
    t: [
      { min: 500, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 20', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 100, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 20', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 28. BỆNH VIỆN, CƠ SỞ Y TẾ ──
  benh_vien: {
    lbl: 'Quy mô (giường bệnh)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Không thể chỉ dựa vào số giường bệnh; phải xét phát sinh nước thải y tế và chất thải lây nhiễm.',
    t: [
      { min: 500, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 21', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 50, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 21', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Cơ sở y tế có phát sinh chất thải lây nhiễm/CTNH và nước thải y tế phải xử lý đạt QCVN trước khi xả thải (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 29. NUÔI TRỒNG THỦY SẢN ──
  nuoi_thuy_san: {
    lbl: 'Nuôi trồng thuỷ sản nước ngọt / nước lợ (ha mặt nước)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Phải xét phương pháp nuôi (thâm canh, bán thâm canh, quảng canh), loại hình và khu vực, không chỉ diện tích mặt nước.',
    t: [
      { min: 200, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 13.1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 50, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13.1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13.1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  nuoi_ts_bien: {
    lbl: 'Nuôi trồng thuỷ sản trên biển / lồng bè (ha mặt nước biển)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Cần đối chiếu diện tích khu vực biển giao nuôi trồng thủy sản và thẩm quyền giao khu vực biển.',
    t: [
      { min: 100, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 13.2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13.2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Nuôi trồng thủy sản trên biển cần kiểm tra ranh giới khu bảo tồn biển và thẩm quyền giao khu vực biển (NEEDS_LEGAL_VERIFICATION).',
  },

  xu_ly_ctnh: {
    lbl: 'Xử lý, tiêu huỷ chất thải nguy hại (tấn/ngày)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Dịch vụ xử lý chất thải nguy hại thuộc danh mục dự án có nguy cơ tác động xấu đến môi trường mức độ cao.',
    t: [
      { min: 0, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 14.1', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Dự án thực hiện dịch vụ xử lý chất thải nguy hại thuộc Nhóm I thẩm quyền Bộ Nông nghiệp và Môi trường (NEEDS_LEGAL_VERIFICATION).',
  },

  xu_ly_ctr: {
    lbl: 'Xử lý chất thải rắn sinh hoạt / công nghiệp thông thường (tấn/ngày)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Cần đối chiếu ngưỡng công suất xử lý chất thải rắn sinh hoạt, chất thải rắn công nghiệp thông thường tại Phụ lục II, III, IV VBHN 49/VBHN-BNNMT.',
    t: [
      { min: 500, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 14.2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 14.2', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  bai_rac: {
    lbl: 'Bãi chôn lấp chất thải, khu liên hợp XLCT (ha)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Cần đối chiếu công suất tiếp nhận (tấn/ngày) và quy mô bãi chôn lấp tại Phụ lục II, III, IV VBHN 49/VBHN-BNNMT.',
    t: [
      { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 14.3', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 14.3', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 30. CHĂN NUÔI GIA SÚC, GIA CẦM TẬP TRUNG ──
  chan_nuoi: {
    lbl: 'Quy mô chăn nuôi (đơn vị vật nuôi — ĐVVN)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.1 README: Chăn nuôi gia súc đã được đối chiếu sơ bộ theo Đơn vị vật nuôi (ĐVVN): lớn >= 3.000; trung bình 300 đến dưới 3.000; nhỏ 10 đến dưới 300 ĐVVN (mã nguồn cũ đặt sai 100.000 / 10.000 / 1.000 đầu vật nuôi).',
    t: [
      { min: 3000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 22', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 300, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 22', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', historicalTq: 'cap_huyen', phu_luc: 'Phụ lục IV, Mục 22', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
    note: 'Quy mô chăn nuôi phải quy đổi ra Đơn vị vật nuôi (ĐVVN) theo quy định của pháp luật về chăn nuôi và Phụ lục II, III, IV VBHN 49/VBHN-BNNMT (NEEDS_LEGAL_VERIFICATION).',
  },

  // ── 31. THỦY ĐIỆN ──
  thuy_dien: {
    lbl: 'Công suất lắp máy (MW)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa xác minh được ngưỡng 50 MW / 10 MW là căn cứ duy nhất để suy ra nhóm và thẩm quyền; cần xét dung tích hồ chứa và thẩm quyền Bộ Công Thương / UBND tỉnh.',
    t: [
      { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 32. ĐIỆN MẶT TRỜI, ĐIỆN GIÓ ──
  dien_mat_troi: {
    lbl: 'Công suất lắp đặt (MWp)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa chứng minh được các ngưỡng 100 MWp / 10 MWp theo đúng tiêu chí phụ lục (cần xét diện tích chiếm đất/mặt nước).',
    t: [
      { min: 100, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục IV, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  dien_gio: {
    lbl: 'Công suất lắp đặt (MW)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Chưa chứng minh được các ngưỡng đang dùng; cần xét vị trí trên bờ hay ngoài khơi và diện tích chiếm đất/biển.',
    t: [
      { min: 100, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục IV, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 23', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', effectiveFrom: TWO_TIER_GOV_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  // ── 33. NẠO VÉT LUỒNG, HỒ CHỨA ──
  nao_vet: {
    lbl: 'Khối lượng nạo vét (m³/năm)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Cần xét loại luồng, khu vực nhận chìm, khối lượng và tính chất bùn nạo vét.',
    t: [
      { min: 500000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 24', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 50000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 24', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 24', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },

  ho_chua: {
    lbl: 'Dung tích hồ chứa (triệu m³)',
    verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
    auditNote: 'Mục 4.2 README: Phải phân biệt hồ chứa, đập thủy lợi và điều kiện quy mô/vị trí liên tỉnh.',
    t: [
      { min: 100, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III, Mục 24', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 10, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 24', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 24', ref: 'NĐ 08/2022 (VBHN 49/2026)', effectiveFrom: VBHN_49_EFFECTIVE_DATE, effectiveTo: null, verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
    ],
  },
};

const CHECKLIST = {
  DTM: {
    bat_buoc: [
      'Thuyết minh dự án đầu tư / Báo cáo nghiên cứu tiền khả thi hoặc khả thi',
      'Bản đồ vị trí địa lý và ranh giới dự án (tỷ lệ phù hợp, có tọa độ)',
      'Báo cáo hiện trạng môi trường khu vực thực hiện dự án (nước mặt, nước ngầm, không khí, đất)',
      'Kết quả đo đạc, lấy mẫu và phân tích môi trường nền (đơn vị có chứng nhận đủ điều kiện hoạt động dịch vụ quan trắc môi trường)',
      'Đánh giá, dự báo tác động môi trường trong thi công và vận hành',
      'Chương trình quản lý và giám sát môi trường trong toàn bộ vòng đời dự án',
      'Văn bản kết quả tham vấn UBND cấp xã và cộng đồng dân cư chịu tác động trực tiếp',
      'Cam kết và kế hoạch thực hiện các biện pháp bảo vệ môi trường',
      'Báo cáo ĐTM lập theo biểu mẫu hiện hành (TT 02/2022/TT-BTNMT được sửa đổi, bổ sung bởi TT 09/2026/TT-BNNMT)',
    ],
    bo_sung: [
      'Quyết định chủ trương đầu tư hoặc Giấy chứng nhận đăng ký đầu tư',
      'Hợp đồng thuê đất / Quyết định giao đất / Văn bản chấp thuận sử dụng đất',
      'Bản đồ quy hoạch sử dụng đất được phê duyệt tại khu vực dự án',
      'Hồ sơ địa chất công trình, địa chất thủy văn (nếu dự án ảnh hưởng nguồn nước)',
      'Phương án phòng ngừa và ứng phó sự cố môi trường (nếu có nguy cơ cao)',
    ],
  },
  GPMT: {
    bat_buoc: [
      'Văn bản đề nghị cấp Giấy phép môi trường theo mẫu quy định hiện hành (TT 02/2022 sửa đổi bởi TT 09/2026)',
      'Báo cáo đề xuất cấp GPMT (theo mẫu tương ứng với đối tượng dự án đầu tư hoặc cơ sở đang vận hành)',
      'Hồ sơ pháp lý, kỹ thuật của dự án đầu tư, cơ sở, KCN, cụm công nghiệp',
      'Bản vẽ kỹ thuật và thuyết minh công trình bảo vệ môi trường, hệ thống xử lý nước thải (đối chiếu QCVN 40:2025/BTNMT hoặc QCVN 14:2025/BTNMT và điều khoản chuyển tiếp)',
      'Bản vẽ kỹ thuật và thuyết minh hệ thống xử lý bụi, khí thải (đối chiếu QCVN 19:2024/BTNMT và điều khoản chuyển tiếp liên quan)',
      'Nội dung quản lý chất thải rắn thông thường và khai báo, phân loại, lưu giữ, chuyển giao chất thải nguy hại tích hợp trong GPMT (Điều 83 Luật BVMT 2020)',
      'Quy trình vận hành công trình xử lý chất thải và kế hoạch vận hành thử nghiệm',
      'Hợp đồng chuyển giao chất thải nguy hại với đơn vị có giấy phép môi trường phù hợp (nếu phát sinh CTNH)',
    ],
    bo_sung: [
      'Kết quả quan trắc chất lượng môi trường định kỳ (đối với cơ sở đang vận hành theo quy định)',
      'Quyết định phê duyệt kết quả thẩm định báo cáo ĐTM (nếu thuộc đối tượng phải lập ĐTM)',
      'Kế hoạch phòng ngừa và ứng phó sự cố môi trường tích hợp trong GPMT',
      'Giấy phép khai thác tài nguyên nước (nếu thuộc diện phải cấp phép theo Luật Tài nguyên nước 2023 và NĐ 53/2024/NĐ-CP)',
      'Văn bản thỏa thuận/hợp đồng đấu nối nước thải vào hệ thống XLNT tập trung của KCN (nếu nằm trong KCN)',
    ],
  },
  DKMT: {
    bat_buoc: [
      'Văn bản đăng ký môi trường của chủ dự án đầu tư, cơ sở (theo mẫu tại TT 02/2022 sửa đổi bởi TT 09/2026)',
      'Thông tin chung về dự án đầu tư, cơ sở và quy mô sản xuất, kinh doanh, dịch vụ',
      'Loại và khối lượng chất thải phát sinh (bao gồm khai báo quản lý CTNH theo Điều 83 Luật BVMT 2020 nếu có)',
      'Phương án thu gom, quản lý và xử lý chất thải theo quy định',
      'Cam kết thực hiện công tác bảo vệ môi trường của chủ dự án đầu tư, cơ sở',
    ],
    bo_sung: [
      'Bản sao Giấy chứng nhận đăng ký doanh nghiệp hoặc giấy tờ pháp lý tương đương',
      'Hợp đồng thu gom, vận chuyển và xử lý chất thải rắn sinh hoạt, thông thường',
      'Hợp đồng chuyển giao xử lý CTNH với đơn vị có chức năng (nếu có phát sinh CTNH)',
    ],
  },
};

const LAW_REFS = {
  DTM: [
    { num: 'Điều 25 & Điều 28, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Yếu tố nhạy cảm về môi trường và tiêu chí phân loại dự án đầu tư theo mức độ tác động môi trường' },
    { num: 'Điều 30, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Đối tượng phải thực hiện đánh giá tác động môi trường (dự án Nhóm I và một số dự án Nhóm II)' },
    { num: 'Điều 35, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Thẩm quyền thẩm định báo cáo đánh giá tác động môi trường' },
    { num: 'Điều 37, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Trách nhiệm của chủ dự án đầu tư sau khi có quyết định phê duyệt kết quả thẩm định báo cáo ĐTM' },
    { num: 'VBHN 49/VBHN-BNNMT (NĐ 08/2022 + NĐ 05/2025 + NĐ 48/2026)', law_id: 'vbhn_49_2026', desc: 'Quy định chi tiết một số điều của Luật Bảo vệ môi trường và Phụ lục phân loại dự án (cần đối chiếu nguyên văn phụ lục)' },
    { num: 'TT 02/2022/TT-BTNMT (sửa đổi bởi TT 09/2026/TT-BNNMT)', law_id: 'tt_09_2026', desc: 'Quy định chi tiết thi hành một số điều của Luật BVMT và hệ thống biểu mẫu báo cáo' },
  ],
  GPMT: [
    { num: 'Điều 39, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Đối tượng phải có Giấy phép môi trường (dự án Nhóm I, II, III có phát sinh nước thải, bụi, khí thải xả ra môi trường phải được xử lý hoặc phát sinh CTNH phải được quản lý)' },
    { num: 'Điều 40, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Nội dung Giấy phép môi trường và yêu cầu bảo vệ môi trường đối với nguồn thải' },
    { num: 'Điều 41, Luật BVMT 2020 (và quy định phân quyền hiện hành)', law_id: 'luat_bvmt_2020', desc: 'Thẩm quyền cấp Giấy phép môi trường theo mô hình chính quyền địa phương 02 cấp từ 01/07/2025' },
    { num: 'Điều 83, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Khai báo, phân loại, thu gom, lưu giữ, chuyển giao chất thải nguy hại (tích hợp trong GPMT, không cấp Sổ chủ nguồn thải riêng)' },
    { num: 'VBHN 49/VBHN-BNNMT', law_id: 'vbhn_49_2026', desc: 'Trình tự, thủ tục, hồ sơ đề nghị cấp, cấp đổi, điều chỉnh, cấp lại Giấy phép môi trường' },
    { num: 'TT 02/2022/TT-BTNMT (sửa đổi bởi TT 09/2026/TT-BNNMT)', law_id: 'tt_09_2026', desc: 'Mẫu báo cáo đề xuất cấp Giấy phép môi trường' },
  ],
  DKMT: [
    { num: 'Điều 49, Luật BVMT 2020', law_id: 'luat_bvmt_2020', desc: 'Đối tượng phải đăng ký môi trường và các trường hợp được miễn đăng ký môi trường; cơ quan tiếp nhận là UBND cấp xã' },
    { num: 'VBHN 49/VBHN-BNNMT', law_id: 'vbhn_49_2026', desc: 'Quy định chi tiết về đối tượng được miễn đăng ký môi trường và quản lý đăng ký môi trường' },
    { num: 'TT 02/2022/TT-BTNMT (sửa đổi bởi TT 09/2026/TT-BNNMT)', law_id: 'tt_09_2026', desc: 'Mẫu văn bản đăng ký môi trường' },
  ],
};

// A08: Không tự động xếp Nhóm I chỉ từ boolean khu vực nhạy cảm nếu chưa xác minh điều kiện pháp lý cụ thể.
const SENSITIVE_AREAS = [
  {
    key: 'rung',
    label: 'Sử dụng đất rừng phòng hộ hoặc rừng đặc dụng',
    ref: 'Điểm c, Khoản 1, Điều 28 Luật BVMT 2020; Điều 25 NĐ 08/2022',
    force: false,
    requiresLegalCriteria: 'Phải xác định rõ loại rừng, diện tích chuyển mục đích sử dụng đất rừng và thẩm quyền quyết định chủ trương chuyển mục đích sử dụng rừng.',
  },
  {
    key: 'lua',
    label: 'Chuyển mục đích sử dụng đất trồng lúa nước từ 02 vụ trở lên',
    ref: 'Điểm d, Khoản 1, Điều 28 Luật BVMT 2020; Điều 25 NĐ 08/2022',
    force: false,
    requiresLegalCriteria: 'Phải xác định diện tích đất trồng lúa 02 vụ trở lên xin chuyển mục đích và thẩm quyền chấp thuận theo pháp luật đất đai.',
  },
  {
    key: 'bg',
    label: 'Khu vực gần biên giới đất liền / hải đảo (cảnh báo không gian ≤50km)',
    ref: 'Cảnh báo tham khảo không gian GIS (cần đối chiếu Điều 25 NĐ 08/2022)',
    force: false,
    requiresLegalCriteria: 'Khoảng cách 50km trên GIS không phải là căn cứ pháp lý tự động nâng lên Nhóm I; phải kiểm tra ranh giới hành chính và điều kiện pháp lý cụ thể.',
  },
  {
    key: 'bao_ton',
    label: 'Trong hoặc giáp vùng bảo vệ khu bảo tồn thiên nhiên / Vườn quốc gia',
    ref: 'Điểm c, Khoản 1, Điều 28 Luật BVMT 2020; Điều 25 NĐ 08/2022',
    force: false,
    requiresLegalCriteria: 'Phải xác minh dự án nằm trong vùng lõi, vùng đệm hay ngoài ranh giới theo Quyết định thành lập khu bảo tồn.',
  },
  {
    key: 'di_san',
    label: 'Trong phạm vi khu di sản thế giới, di sản thiên nhiên, di tích quốc gia đặc biệt',
    ref: 'Điểm c, Khoản 1, Điều 28 Luật BVMT 2020; Điều 25 NĐ 08/2022',
    force: false,
    requiresLegalCriteria: 'Phải xác minh ranh giới khoanh vùng bảo vệ khu vực I, khu vực II của di sản/di tích.',
  },
  {
    key: 'ven_bien',
    label: 'Trong hành lang bảo vệ bờ biển',
    ref: 'Điều 25 Nghị định 08/2022/NĐ-CP',
    force: false,
    requiresLegalCriteria: 'Phải đối chiếu danh mục và mốc giới hành lang bảo vệ bờ biển do UBND cấp tỉnh phê duyệt.',
  },
  {
    key: 'nguon_nc',
    label: 'Trong phạm vi hành lang bảo vệ nguồn nước cấp sinh hoạt',
    ref: 'Điểm a, Khoản 4, Điều 25 Nghị định 08/2022/NĐ-CP',
    force: false,
    requiresLegalCriteria: 'Phải kiểm tra quyết định phê duyệt vùng bảo hộ vệ sinh khu vực lấy nước sinh hoạt và khoảng cách xả thải.',
  },
  {
    key: 'dat_ngap',
    label: 'Trong vùng đất ngập nước quan trọng (Ramsar / cấp quốc gia, tỉnh)',
    ref: 'Điều 25 Nghị định 08/2022/NĐ-CP',
    force: false,
    requiresLegalCriteria: 'Phải kiểm tra quyết định xác lập khu bảo tồn đất ngập nước hoặc vùng đất ngập nước quan trọng.',
  },
];

const LAW_CHANGE_WARNINGS = [
  {
    applies_to: 'global',
    icon: '📋',
    text: 'Kết quả phân loại và thẩm quyền cần được chuyên viên đối chiếu trực tiếp với Phụ lục II, III, IV của VBHN 49/VBHN-BNNMT (hợp nhất NĐ 08/2022, NĐ 05/2025, NĐ 48/2026) trước khi nộp hồ sơ chính thức.',
    ref: 'VBHN 49/VBHN-BNNMT',
    law_id: 'vbhn_49_2026',
  },
  {
    applies_to: 'global',
    icon: '📝',
    text: 'Biểu mẫu hồ sơ ĐTM, GPMT, ĐKMT áp dụng theo Thông tư 02/2022/TT-BTNMT được sửa đổi, bổ sung bởi Thông tư 09/2026/TT-BNNMT.',
    ref: 'TT 09/2026/TT-BNNMT',
    law_id: 'tt_09_2026',
  },
  {
    applies_to: 'do_thi',
    icon: '🏙️',
    text: 'A09: Các mốc diện tích khu đô thị (300 ha, 50 ha) dùng để phân loại quy mô dự án; nghĩa vụ GPMT hay ĐKMT phải căn cứ vào việc có phát sinh chất thải thuộc diện phải xử lý hay không.',
    ref: 'NĐ 48/2026 & Điều 39, 49 Luật BVMT 2020',
    law_id: 'nd_48_2026',
  },
  {
    applies_to: 'xl_nuoc_thai',
    icon: '💧',
    text: 'Đối với dự án/cơ sở đang vận hành có thay đổi công trình, công nghệ xử lý nước thải lưu lượng ≥50 m³/ngày cần kiểm tra điều kiện tại Điều 8 NĐ 48/2026.',
    ref: 'NĐ 48/2026, Điều 8',
    law_id: 'nd_48_2026',
  },
  {
    applies_to: 'khai_thac_ks',
    icon: '⛏️',
    text: 'Dự án khai thác khoáng sản cần đối chiếu cả quy mô công suất nguyên khai, loại khoáng sản và thẩm quyền cấp giấy phép khai thác khoáng sản.',
    ref: 'VBHN 49/VBHN-BNNMT',
    law_id: 'vbhn_49_2026',
  },
];

const TQ_LABEL = {
  cap_bo: 'Bộ Nông nghiệp và Môi trường',
  cap_so: 'UBND cấp tỉnh (Cơ quan chuyên môn: Sở Nông nghiệp và Môi trường)',
  cap_xa: 'UBND cấp xã',
  cap_huyen: 'UBND cấp huyện (Thẩm quyền lịch sử trước 01/07/2025)',
};

const THOI_HAN = {
  DTM_cap_bo: '45 ngày làm việc',
  DTM_cap_so: '30 ngày làm việc',
  GPMT_cap_bo: '45 ngày làm việc',
  GPMT_cap_so: '30 ngày làm việc',
  GPMT_cap_xa: 'Theo phân cấp địa phương',
  GPMT_cap_huyen: '15 ngày làm việc (trước 01/07/2025)',
  DKMT_cap_xa: 'Tiếp nhận trực tiếp / trực tuyến tại UBND cấp xã (trước khi vận hành)',
  DKMT_cap_huyen: '5 ngày làm việc (trước 01/07/2025)',
};

const HS_INFO = {
  DTM: { icon: '📋', label: 'Báo cáo Đánh giá tác động môi trường', class: 'chip-dtm', bg: '#EEF3FF' },
  GPMT: { icon: '🪪', label: 'Giấy phép môi trường', class: 'chip-gpmt', bg: '#EEF8F3' },
  DKMT: { icon: '📝', label: 'Đăng ký môi trường', class: 'chip-dkmt', bg: '#F8F8F5' },
};

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
        message: `Ngành "${INDUSTRY_META[resolvedCode]?.name || resolvedCode}" bắt buộc phải chọn công đoạn / loại nhiên liệu (processStage) trước khi phân loại.`,
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
            text: `${area.label}: ${area.requiresLegalCriteria} Chưa có xác minh VERIFIED phía server — không tự động nâng lên Nhóm I (${sensitiveVerificationStatus}).`,
            ref: area.ref,
          });
        });
      }
      if (hasClientSensitiveClaim) {
        cauNhom.push({
          icon: '🔒',
          type: 'warn',
          text: 'Cờ sensitiveCriteriaVerified / diện tích chuyển đổi từ client chỉ mang tính khai báo (PENDING_SERVER_VERIFICATION), chưa có hiệu lực nâng nhóm chính thức cho đến khi Admin duyệt trên server.',
          ref: 'Điều 25 NĐ 08/2022/NĐ-CP',
        });
      }
    }
  }

  // Ghi chú kiểm toán ngành nghề (Mục 4.1 & 4.2)
  const indEntry = catalog?.[resolvedCode];
  if (indEntry?.auditNote && verificationStatus !== 'VERIFIED') {
    cauNhom.push({
      icon: '🔍',
      type: 'warn',
      text: `[NEEDS_LEGAL_VERIFICATION] ${indEntry.auditNote}`,
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

  // A05: Lưu lượng nước thải >= 1.000 m³/ngày không tự động chuyển loại hồ sơ sang ĐTM
  if (actualNt >= 1000) {
    obligationNotes.push({
      icon: '💧',
      type: 'info',
      text: `Lưu lượng nước thải ${actualNt.toLocaleString('vi-VN')} m³/ngày: Hệ thống không tự động nâng lên ĐTM chỉ từ lưu lượng nước thải. Cần đối chiếu xem dự án có thuộc loại hình HTXLNT tập trung hoặc ngưỡng công suất riêng tại Phụ lục III, IV VBHN 49/2026 và kiểm tra nghĩa vụ quan trắc nước thải tự động, liên tục (NEEDS_LEGAL_VERIFICATION).`,
      ref: 'Điều 97 NĐ 08/2022 (VBHN 49/2026)',
    });
  }

  // A06: Lưu lượng khí thải >= 20.000 / 200.000 m³/giờ không tự động nâng GPMT/ĐTM đại trà
  if (actualKt >= 20000) {
    obligationNotes.push({
      icon: '🌫️',
      type: 'info',
      text: `Lưu lượng khí thải ${actualKt.toLocaleString('vi-VN')} m³/giờ: Hệ thống không tự động nâng nhóm/thủ tục ĐTM chỉ theo lưu lượng khí thải chung. Cần đối chiếu quy chuẩn khí thải công nghiệp QCVN 19:2024/BTNMT và danh mục nguồn khí thải lưu lượng lớn phải quan trắc tự động/định kỳ (NEEDS_LEGAL_VERIFICATION).`,
      ref: 'Điều 98 NĐ 08/2022 (VBHN 49/2026) & QCVN 19:2024/BTNMT',
    });
  }

  // A07 & T05: Dự án nằm trong KCN không tự động chuyển từ ĐTM sang GPMT
  if (kcn) {
    obligationNotes.push({
      icon: '🏭',
      type: 'warn',
      text: 'Dự án nằm trong KCN: Hệ thống không tự động miễn ĐTM hoặc hạ nhóm dự án chỉ dựa vào cờ KCN. Cần kiểm tra Quyết định phê duyệt ĐTM của hạ tầng KCN, sự phù hợp phân khu ngành nghề, công suất tiếp nhận của HTXLNT tập trung và văn bản thỏa thuận đấu nối nước thải (NEEDS_LEGAL_VERIFICATION).',
      ref: 'Điều 30 & Điều 39, Luật BVMT 2020',
    });
  }

  // A09: Khu đô thị
  if (nganh === 'do_thi') {
    obligationNotes.push({
      icon: '🏙️',
      type: 'info',
      text: 'Đối với dự án Khu đô thị, khu dân cư: Diện tích đất xác định quy mô nhóm dự án; nghĩa vụ cấp GPMT hay ĐKMT phải căn cứ vào việc dự án có phát sinh nước thải, khí thải phải xử lý theo Điều 39 Luật BVMT 2020 hay không (NEEDS_LEGAL_VERIFICATION).',
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
      text: 'Dự án đầu tư công: cần kiểm tra điều kiện phân cấp/phân quyền thẩm định ĐTM cho UBND cấp tỉnh theo NĐ 48/2026 và Nghị quyết phân quyền hiện hành (NEEDS_LEGAL_VERIFICATION).',
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
        text: `Dự án mở rộng/cải tạo hoặc thay đổi công nghệ xử lý chất thải (NT: ${actualNt} m³/ngày, KT: ${actualKt} m³/h): cần đối chiếu quy định về thay đổi quy mô, công suất, công nghệ làm tăng tác động xấu đến môi trường để xác định nghĩa vụ lập lại ĐTM hoặc cấp đổi/điều chỉnh GPMT (NEEDS_LEGAL_VERIFICATION).`,
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

  // Tổng hợp gate pháp lý & nguồn dữ liệu (A-01, A-04, CL-07)
  const isFromDb = ruleSource === 'DATABASE';
  const unverifiedReasons = [];
  if (!isFromDb) {
    unverifiedReasons.push(`Không tải được dữ liệu rule từ PostgreSQL (đang ở chế độ ${ruleSource}${fallbackReason ? ': ' + fallbackReason : ''}).`);
  }
  if (industryObj.verificationStatus !== 'VERIFIED') {
    unverifiedReasons.push(industryObj.auditNote || `Ngành "${resolvedNganh}" đang gắn trạng thái NEEDS_LEGAL_VERIFICATION.`);
  }
  if (groupResult.verificationStatus !== 'VERIFIED') {
    unverifiedReasons.push('Ngưỡng phân loại theo công suất / công đoạn / yếu tố nhạy cảm chưa hoàn tất xác minh pháp lý (NEEDS_LEGAL_VERIFICATION).');
  }
  if (groupResult.sensitiveVerificationStatus && ['PENDING_SERVER_VERIFICATION', 'UNVERIFIED'].includes(groupResult.sensitiveVerificationStatus)) {
    unverifiedReasons.push('Khai báo vùng nhạy cảm / tiêu chí nâng nhóm chưa có quyết định xác minh VERIFIED phía server.');
  }
  if (authorityResult.competentAuthority.verificationStatus !== 'VERIFIED') {
    unverifiedReasons.push(
      authorityResult.missingHistoricalAuthority
        ? `Chưa có cấu hình thẩm quyền lịch sử (historicalTq) đã xác minh cho thời kỳ trước ${TWO_TIER_GOV_EFFECTIVE_DATE}.`
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
