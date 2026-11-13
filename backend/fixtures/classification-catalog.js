// backend/fixtures/classification-catalog.js
// Danh mục ngành nghề và ngưỡng phân loại dùng làm dữ liệu nền/dự phòng
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
    text: 'Các mốc diện tích khu đô thị (300 ha, 50 ha) dùng để phân loại quy mô dự án; nghĩa vụ GPMT hay ĐKMT phải căn cứ vào việc có phát sinh chất thải thuộc diện phải xử lý hay không.',
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

module.exports = {
  INDUSTRY_ALIASES,
  INDUSTRY_META,
  IND_DB,
  CHECKLIST,
  LAW_REFS,
  SENSITIVE_AREAS,
  LAW_CHANGE_WARNINGS,
  TQ_LABEL,
  THOI_HAN,
  HS_INFO
};
