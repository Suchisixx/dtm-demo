// frontend/src/data/classification-db.js
// Đồng bộ 100% với backend/services/classification-service.js sau Kiểm toán Pháp lý

export const RULE_SCHEMA_VERSION = '2026.2-audit';
export const TWO_TIER_GOV_EFFECTIVE_DATE = '2025-07-01';
export const VBHN_49_EFFECTIVE_DATE = '2026-01-29';

export const IND_DB = {
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
        { min: 0.3, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      rolling_only: [
        { min: 0.5, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
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
        { min: 600, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      gas_fired: [
        { min: 600, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
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
        { min: 5000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 1000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      blending_packaging_only: [
        { min: 10000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
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
        { min: 50000, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 7', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 5000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV, Mục 7', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      paper_from_commercial_pulp: [
        { min: 100000, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 10000, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'MEDIUM', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 7', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
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
        { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 8', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 5, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV, Mục 8', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 8', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      weaving_garment_no_dyeing: [
        { min: 50, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'LARGE', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 8', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
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
        { min: 50, operator: '>=', projectGroup: 'Nhóm I', capacityScale: 'LARGE', hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục II & III, Mục 13', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0.1, operator: '>=', projectGroup: 'Nhóm II', capacityScale: 'MEDIUM', hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục II & IV, Mục 13', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'SMALL', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
      ],
      assembly_only: [
        { min: 50, operator: '>=', projectGroup: 'Nhóm III', capacityScale: 'LARGE', hs: 'GPMT', tq: 'cap_so', phu_luc: 'Phụ lục IV, Mục 13', ref: 'VBHN 49/2026', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
        { min: 0, operator: '>=', projectGroup: 'Nhóm IV', capacityScale: 'SMALL', hs: 'DKMT', tq: 'cap_xa', historicalTq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020', verificationStatus: 'NEEDS_LEGAL_VERIFICATION' },
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

export const TQ_LABEL = {
  cap_bo: 'Bộ Nông nghiệp và Môi trường',
  cap_so: 'UBND cấp tỉnh (Cơ quan chuyên môn: Sở Nông nghiệp và Môi trường)',
  cap_xa: 'UBND cấp xã',
  cap_huyen: 'UBND cấp huyện (Thẩm quyền lịch sử trước 01/07/2025)',
};

export const THOI_HAN = {
  DTM_cap_bo: '45 ngày làm việc',
  DTM_cap_so: '30 ngày làm việc',
  GPMT_cap_bo: '45 ngày làm việc',
  GPMT_cap_so: '30 ngày làm việc',
  GPMT_cap_xa: 'Theo phân cấp địa phương',
  GPMT_cap_huyen: '15 ngày làm việc (trước 01/07/2025)',
  DKMT_cap_xa: 'Tiếp nhận trực tiếp / trực tuyến tại UBND cấp xã (trước khi vận hành)',
  DKMT_cap_huyen: '5 ngày làm việc (trước 01/07/2025)',
};

export const HS_INFO = {
  DTM: { icon: '📋', label: 'Báo cáo Đánh giá tác động môi trường', class: 'chip-dtm', bg: '#EEF3FF' },
  GPMT: { icon: '🪪', label: 'Giấy phép môi trường', class: 'chip-gpmt', bg: '#EEF8F3' },
  DKMT: { icon: '📝', label: 'Đăng ký môi trường', class: 'chip-dkmt', bg: '#F8F8F5' },
};
