// Classification reference data — v2.0 (cập nhật 06/2026)
// Căn cứ: Luật BVMT 2020 • NĐ 08/2022 • NĐ 05/2025 • NĐ 48/2026 • NĐ 110/2026 • TT 02/2022 • TT 09/2026
(function (global) {
  'use strict';

// ─────────────────────────────────────────────────────────────────
// IND_DB — Database ngành nghề & ngưỡng phân loại
// Cấu trúc mỗi tier: { min, hs, tq, phu_luc, ref, note? }
//   hs  : 'DTM' | 'GPMT' | 'DKMT'
//   tq  : 'cap_bo' | 'cap_so' | 'cap_huyen'
//   note: cảnh báo riêng của tier này (tuỳ chọn)
// ─────────────────────────────────────────────────────────────────
const IND_DB = {

  // ── CÔNG NGHIỆP CHẾ BIẾN ──────────────────────────────────────
  che_bien_go: {
    lbl: 'Chế biến gỗ / MDF (m³ sản phẩm/năm)',
    t: [
      { min: 200000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 10.3', ref: 'NĐ 08/2022 (hợp nhất VBHN 49/2026)' },
      { min: 50000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 10.3',  ref: 'NĐ 08/2022 (hợp nhất VBHN 49/2026)' },
      { min: 5000,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,      hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  giay_bot: {
    lbl: 'Giấy, bột giấy (tấn sản phẩm/năm)',
    t: [
      { min: 100000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 10.4', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 50000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 10.4',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 5000,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,      hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  det_nhuom: {
    lbl: 'Dệt, nhuộm (tấn sản phẩm/năm)',
    t: [
      { min: 50000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 10.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10000, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 10.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,     hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  thuc_pham: {
    lbl: 'Chế biến thực phẩm, đồ uống (tấn/năm)',
    t: [
      { min: 100000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 11',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 20000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 11',   ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 1000,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,      hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  hoa_chat: {
    lbl: 'Hóa chất, phân bón (tấn sản phẩm/năm)',
    t: [
      { min: 50000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 5',   ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10000, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 5',    ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,     hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  nhua_cao_su: {
    lbl: 'Nhựa, cao su tổng hợp (tấn/năm)',
    t: [
      { min: 50000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 6',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10000, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 6',   ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 1000,  hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,     hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  cao_su_cb: {
    lbl: 'Cao su chế biến (tấn mủ khô/năm)',
    t: [
      { min: 30000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 11.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 5000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 11.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 1000,  hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,     hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  duoc_pham: {
    lbl: 'Dược phẩm, sinh phẩm (tấn sản phẩm/năm)',
    t: [
      { min: 10000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 12',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 1000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 12',   ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 100,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,     hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  xi_mang: {
    lbl: 'Xi măng, clinker (triệu tấn clinker/năm)',
    t: [
      { min: 1,   hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 4.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0.2, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 4.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  thep: {
    lbl: 'Luyện kim, thép (triệu tấn/năm)',
    t: [
      { min: 0.5, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 4.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0.1, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 4.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  vat_lieu_xd: {
    lbl: 'Vật liệu xây dựng — gạch, ngói, gốm sứ (triệu sản phẩm/năm)',
    t: [
      { min: 200,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 4.4', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 50,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 4.4',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,    hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  dien_tu: {
    lbl: 'Điện tử, bán dẫn, linh kiện (triệu sản phẩm/năm)',
    t: [
      { min: 500,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 8',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 50,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 8',   ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,    hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Ngành điện tử có nước thải chứa kim loại nặng — thường bị nâng nhóm do Phụ lục II NĐ 08/2022.',
  },

  // ── KHAI THÁC TÀI NGUYÊN ──────────────────────────────────────
  khai_thac_ks: {
    lbl: 'Khai thác khoáng sản rắn — than, quặng, đá, cát (triệu tấn/năm)',
    t: [
      { min: 5,   hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 2.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0.5, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 2.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Dự án khai thác trong vùng đệm khu bảo tồn hoặc đất rừng → tự động Nhóm I (Điều 25, Luật BVMT).',
  },

  khai_thac_dau_khi: {
    lbl: 'Khai thác dầu khí (triệu tấn quy dầu/năm)',
    t: [
      { min: 0.5, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 2.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 2.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
    note: 'Khai thác dầu khí trên biển luôn thuộc Nhóm I — thẩm quyền Bộ NNMT bất kể quy mô.',
  },

  khai_thac_nuoc: {
    lbl: 'Khai thác nước mặt / nước ngầm (m³/ngày)',
    t: [
      { min: 100000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 2.5', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 2.5',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 500,    hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT + NĐ 53/2024' },
      { min: 0,      hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
    note: 'Bắt buộc kết hợp hồ sơ Giấy phép khai thác tài nguyên nước (NĐ 53/2024/NĐ-CP).',
  },

  // ── NĂNG LƯỢNG ────────────────────────────────────────────────
  thuy_dien: {
    lbl: 'Thuỷ điện (MW công suất lắp máy)',
    t: [
      { min: 50,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 3.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 3.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Thuỷ điện làm thay đổi dòng chảy, ảnh hưởng hạ lưu → thường bị nâng Nhóm I dù quy mô nhỏ.',
  },

  dien_mat_troi: {
    lbl: 'Điện mặt trời (MWp công suất lắp đặt)',
    t: [
      { min: 100,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 3.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 3.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,    hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Điện mặt trời trên đất rừng → tự động Nhóm I. Điện mặt trời mái nhà <1MWp → ĐKMT.',
  },

  dien_gio: {
    lbl: 'Điện gió (MW công suất lắp đặt)',
    t: [
      { min: 50,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 3.2', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 3.2',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Điện gió trên biển (offshore) → luôn Nhóm I, thẩm quyền Bộ NNMT.',
  },

  nhiet_dien: {
    lbl: 'Nhiệt điện than / khí (MW công suất lắp máy)',
    t: [
      { min: 100,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 3.4', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,    hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 3.4',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
    note: '⚠️ Nhiệt điện than ≥100MW luôn thuộc Nhóm I. Nhiệt điện than bất kể quy mô phải lập ĐTM.',
  },

  // ── KHU CÔNG NGHIỆP / ĐÔ THỊ ─────────────────────────────────
  kcn: {
    lbl: 'Khu công nghiệp / Khu chế xuất (ha)',
    t: [
      { min: 500, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 1.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 1.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
    note: 'KCN đã có ĐTM riêng: các nhà máy thành viên chỉ cần GPMT cấp Sở, không lập ĐTM riêng (Khoản 2 Điều 35 Luật BVMT).',
  },

  khu_cong_nghe: {
    lbl: 'Khu công nghệ cao / Khu kinh tế (ha)',
    t: [
      { min: 1000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 1.2', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,    hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 1.2',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
  },

  do_thi: {
    lbl: 'Khu đô thị, nhà ở, khu dân cư (ha) — NĐ 48/2026',
    t: [
      { min: 300, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III — dự án lớn (≥300ha)', ref: 'NĐ 48/2026, Điều 5' },
      { min: 50,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV — dự án trung bình (50–300ha)', ref: 'NĐ 48/2026, Điều 5' },
      { min: 10,  hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT + NĐ 48/2026' },
      { min: 0,   hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
    note: '⭐ Ngưỡng diện tích đã đổi theo NĐ 48/2026: ≥300ha=lớn/Bộ, 50-300ha=trung bình/Sở, <50ha=nhỏ. Không dùng NĐ 08/2022 gốc.',
  },

  // ── HẠ TẦNG / GIAO THÔNG ──────────────────────────────────────
  cao_toc: {
    lbl: 'Đường cao tốc, quốc lộ (km)',
    t: [
      { min: 100, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 7.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 7.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
    note: 'Dự án đầu tư công không thuộc QH/TTg: UBND tỉnh có thể được phân cấp thẩm định (NĐ 48/2026 Điều 7).',
  },

  duong_sat: {
    lbl: 'Đường sắt, đường sắt đô thị (km)',
    t: [
      { min: 50,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 7.2', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 7.2',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
  },

  cang_bien: {
    lbl: 'Cảng biển, bến cảng tổng hợp (triệu tấn hàng/năm)',
    t: [
      { min: 30, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 7.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 1,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 7.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,  hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  cang_hang_khong: {
    lbl: 'Cảng hàng không, sân bay (triệu hành khách/năm)',
    t: [
      { min: 5,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 7.4', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 7.4',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
    ],
    note: 'Sân bay quốc tế mới hoặc mở rộng đường băng → luôn Nhóm I.',
  },

  nao_vet: {
    lbl: 'Nạo vét luồng hàng hải, lòng hồ (triệu m³ bùn)',
    t: [
      { min: 5,   hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 7.5', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0.5, hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 7.5',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  ho_chua: {
    lbl: 'Hồ chứa nước, đập thuỷ lợi (triệu m³ dung tích)',
    t: [
      { min: 1000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 3.6', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 50,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 3.6',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,    hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  // ── THƯƠNG MẠI / DỊCH VỤ ──────────────────────────────────────
  trung_tam_tm: {
    lbl: 'Trung tâm thương mại, văn phòng, siêu thị (m² sàn)',
    t: [
      { min: 100000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 9.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 20000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 9.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 3000,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,      hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  khach_san: {
    lbl: 'Khách sạn, resort, khu nghỉ dưỡng (số phòng)',
    t: [
      { min: 1000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 9.4', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 200,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 9.4',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 30,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,    hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
    note: 'Resort trong vùng bảo tồn biển hoặc ven biển <500m → kiểm tra tiêu chí Điều 25 Luật BVMT.',
  },

  // ── Y TẾ ──────────────────────────────────────────────────────
  benh_vien: {
    lbl: 'Bệnh viện, cơ sở y tế có giường bệnh (số giường)',
    t: [
      { min: 1000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 9.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 500,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 9.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 50,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,    hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
    note: 'Bệnh viện phát sinh chất thải y tế nguy hại → bắt buộc bổ sung đăng ký chủ nguồn thải CTNH (TT 02/2022 Điều 13).',
  },

  // ── NÔNG / LÂM / THUỶ SẢN ────────────────────────────────────
  nuoi_thuy_san: {
    lbl: 'Nuôi trồng thuỷ sản nước ngọt / nước lợ (ha mặt nước)',
    t: [
      { min: 200, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 13.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 50,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 13.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,  hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,   hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
  },

  nuoi_ts_bien: {
    lbl: 'Nuôi trồng thuỷ sản trên biển / lồng bè (ha mặt nước biển)',
    t: [
      { min: 100, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 13.2', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 13.2',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Nuôi biển trong vùng bảo tồn biển → tự động Nhóm I (Điều 25 Luật BVMT 2020).',
  },

  chan_nuoi: {
    lbl: 'Chăn nuôi gia súc, gia cầm (đơn vị vật nuôi quy đổi)',
    t: [
      { min: 100000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 13.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 13.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 1000,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
      { min: 0,      hs: 'DKMT', tq: 'cap_huyen', phu_luc: '—', ref: 'Điều 49, Luật BVMT 2020' },
    ],
    note: '1 bò = 1 đơn vị; 1 lợn = 0.5 đơn vị; 1 gà/vịt = 0.01 đơn vị (theo NĐ 08/2022 Phụ lục I).',
  },

  // ── XỬ LÝ CHẤT THẢI ───────────────────────────────────────────
  xu_ly_ctnh: {
    lbl: 'Xử lý, tiêu huỷ chất thải nguy hại (tấn/ngày)',
    t: [
      { min: 50,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 14.1', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 5,   hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 14.1',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: '⚠️ Cơ sở xử lý CTNH luôn phải có Giấy phép xử lý CTNH (NĐ 08/2022 Chương IV), bổ sung vào hồ sơ GPMT.',
  },

  xu_ly_ctr: {
    lbl: 'Xử lý chất thải rắn sinh hoạt / công nghiệp thông thường (tấn/ngày)',
    t: [
      { min: 1000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 14.2', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 200,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 14.2',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,    hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
  },

  bai_rac: {
    lbl: 'Bãi chôn lấp chất thải, khu liên hợp XLCT (ha)',
    t: [
      { min: 50,  hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 14.3', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 10,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 14.3',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,   hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: '⚠️ Bãi chôn lấp không hợp vệ sinh trong nguồn nước cấp sinh hoạt → tự động Nhóm I.',
  },

  xl_nuoc_thai: {
    lbl: 'Hệ thống xử lý nước thải tập trung KCN, đô thị (m³/ngày)',
    t: [
      { min: 50000, hs: 'DTM',  tq: 'cap_bo',    phu_luc: 'Phụ lục III, Mục 14.4', ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 5000,  hs: 'DTM',  tq: 'cap_so',    phu_luc: 'Phụ lục IV, Mục 14.4',  ref: 'NĐ 08/2022 (VBHN 49/2026)' },
      { min: 0,     hs: 'GPMT', tq: 'cap_so',    phu_luc: '—', ref: 'Điều 39, Luật BVMT 2020' },
    ],
    note: 'Thay công nghệ xử lý khiến lưu lượng tăng ≥50m³/ngày → phải lập lại ĐTM/GPMT (NĐ 48/2026 Điều 8).',
  },
};

// ─────────────────────────────────────────────────────────────────
// CHECKLIST — Tài liệu cần chuẩn bị (cập nhật theo TT 09/2026)
// ─────────────────────────────────────────────────────────────────
const CHECKLIST = {
  DTM: {
    bat_buoc: [
      'Thuyết minh dự án đầu tư / Báo cáo nghiên cứu tiền khả thi hoặc khả thi',
      'Bản đồ vị trí địa lý và ranh giới dự án (tỷ lệ phù hợp, có tọa độ)',
      'Báo cáo hiện trạng môi trường khu vực thực hiện dự án (nước mặt, nước ngầm, không khí, đất)',
      'Kết quả đo đạc, lấy mẫu và phân tích môi trường nền (phòng TN phải có VILAS/ISO 17025)',
      'Đánh giá, dự báo tác động môi trường trong thi công và vận hành',
      'Chương trình quản lý và giám sát môi trường trong toàn bộ vòng đời dự án',
      'Văn bản kết quả tham vấn UBND cấp xã và cộng đồng dân cư bị ảnh hưởng',
      'Cam kết và kế hoạch thực hiện các biện pháp bảo vệ môi trường',
      'Mẫu đề cương báo cáo ĐTM (Mẫu 01/ĐTM, TT 02/2022 sửa đổi bởi TT 09/2026)',
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
      'Đơn đề nghị cấp Giấy phép môi trường (Mẫu 01, TT 02/2022 sửa đổi bởi TT 09/2026)',
      'Báo cáo đề xuất cấp GPMT — dự án mới (Mẫu 02) hoặc cơ sở đang vận hành (Mẫu 03)',
      'Hồ sơ pháp lý dự án: giấy phép đầu tư, phê duyệt xây dựng, quyết định giao đất',
      'Bản vẽ kỹ thuật và thuyết minh hệ thống xử lý nước thải (đạt QCVN 40:2011 hoặc QCVN 14:2008)',
      'Bản vẽ kỹ thuật và thuyết minh hệ thống xử lý khí thải (đạt QCVN 19:2009, QCVN 20:2009)',
      'Phương án quản lý chất thải rắn thông thường và chất thải nguy hại (nếu có)',
      'Quy trình vận hành hệ thống xử lý chất thải (có sơ đồ công nghệ chi tiết)',
      'Hợp đồng xử lý chất thải nguy hại với đơn vị được cấp phép (nếu phát sinh CTNH)',
    ],
    bo_sung: [
      'Kết quả quan trắc môi trường định kỳ 02 quý gần nhất (nếu cơ sở đang vận hành)',
      'Báo cáo ĐTM được phê duyệt hoặc GPMT cũ (đối với dự án mở rộng, cải tạo)',
      'Kế hoạch phòng ngừa và ứng phó sự cố môi trường (nếu thuộc danh mục rủi ro cao)',
      'Giấy phép khai thác nước mặt/nước ngầm (nếu có nguồn nước cấp từ thiên nhiên — NĐ 53/2024)',
      'Hợp đồng đấu nối nước thải vào hệ thống XLNT tập trung KCN (nếu trong KCN)',
    ],
  },

  DKMT: {
    bat_buoc: [
      'Mẫu đăng ký môi trường (Mẫu 01/ĐKMT, Phụ lục VI, TT 02/2022 sửa đổi bởi TT 09/2026)',
      'Hồ sơ pháp lý cơ sở: đăng ký kinh doanh, giấy phép xây dựng (bản sao công chứng)',
      'Mô tả loại hình hoạt động, quy mô và khối lượng chất thải dự kiến phát sinh',
      'Biện pháp thu gom, xử lý chất thải đề xuất (thực tế, phù hợp với quy mô)',
      'Cam kết thực hiện đầy đủ các quy định về bảo vệ môi trường',
    ],
    bo_sung: [
      'Sơ đồ mặt bằng tổng thể của cơ sở',
      'Hợp đồng thu gom chất thải sinh hoạt với đơn vị có chức năng',
      'Hợp đồng xử lý CTNH (nếu có phát sinh chất thải y tế, hóa chất, dầu thải)',
    ],
  },
};

// ─────────────────────────────────────────────────────────────────
// LAW_REFS — Căn cứ pháp lý theo từng loại hồ sơ (cập nhật 2026)
// ─────────────────────────────────────────────────────────────────
const LAW_REFS = {
  DTM: [
    { num: 'Điều 25, Luật BVMT 2020',           desc: 'Tiêu chí phân loại Nhóm I tuyệt đối: đất rừng phòng hộ/đặc dụng, đất lúa 2 vụ >10ha, biên giới, di sản thiên nhiên' },
    { num: 'Điều 26, Luật BVMT 2020',           desc: 'Tiêu chí phân loại Nhóm II — dựa trên quy mô, công suất theo Phụ lục III, IV NĐ 08/2022' },
    { num: 'Điều 35, Luật BVMT 2020',           desc: 'Thẩm quyền thẩm định ĐTM: Bộ NNMT (Nhóm I), UBND tỉnh (Nhóm II). Thời hạn 45/30 ngày làm việc' },
    { num: 'Điều 37, Luật BVMT 2020',           desc: 'Các trường hợp phải lập lại ĐTM: thay đổi quy mô, mở rộng, thay đổi công nghệ tăng ô nhiễm' },
    { num: 'NĐ 48/2026, Điều 5',                desc: '⭐ Ngưỡng diện tích mới: ≥300ha=lớn/Bộ NNMT; 50-300ha=TB/Sở; <50ha=nhỏ — thay thế ngưỡng cũ NĐ 08/2022' },
    { num: 'NĐ 48/2026, Điều 7',                desc: 'Phân cấp UBND tỉnh thẩm định ĐTM cho dự án đầu tư công không thuộc QH/TTg' },
    { num: 'NĐ 48/2026, Điều 9 (bổ sung Điều 27a)', desc: 'Dự án phân kỳ đầu tư được lập ĐTM riêng từng giai đoạn — ĐTM sau thay thế ĐTM trước' },
    { num: 'Phụ lục III, VBHN 49/2026',         desc: 'Danh mục ngưỡng công suất Nhóm I theo từng ngành — đọc bản hợp nhất, không dùng NĐ 08/2022 gốc' },
    { num: 'Phụ lục IV, VBHN 49/2026',          desc: 'Danh mục ngưỡng công suất Nhóm II theo từng ngành — thẩm quyền UBND tỉnh/Sở TNMT' },
    { num: 'TT 02/2022 (sửa đổi bởi TT 09/2026)', desc: '⭐ Mẫu đề cương ĐTM (Mẫu 01/ĐTM) — dùng mẫu cập nhật theo TT 09/2026 từ 29/01/2026' },
  ],
  GPMT: [
    { num: 'Điều 39, Luật BVMT 2020',           desc: 'Đối tượng phải có GPMT: dự án Nhóm I, II, III có phát sinh chất thải hoặc tiêu chí kèm theo' },
    { num: 'Điều 40, Luật BVMT 2020',           desc: 'Nội dung GPMT: nguồn thải, giới hạn xả thải, chương trình quan trắc tự động/định kỳ' },
    { num: 'Điều 43, Luật BVMT 2020',           desc: 'Thẩm quyền cấp GPMT: Bộ NNMT / Sở TNMT tỉnh / UBND huyện (thời hạn 45/30/15 ngày)' },
    { num: 'NĐ 08/2022 (VBHN 49/2026), Điều 39–46', desc: 'Trình tự, hồ sơ đề nghị cấp GPMT — đọc bản hợp nhất VBHN 49/2026' },
    { num: 'NĐ 48/2026, Điều 8',                desc: '⭐ HTXLNT ≥50m³/ngày hoặc khí thải ≥20.000m³/h thay công nghệ → phải lập lại ĐTM/GPMT' },
    { num: 'TT 02/2022 (sửa đổi bởi TT 09/2026)', desc: '⭐ Mẫu báo cáo đề xuất GPMT — dùng Mẫu 02 (dự án mới) hoặc Mẫu 03 (cơ sở vận hành) cập nhật TT 09/2026' },
    { num: 'NĐ 53/2024/NĐ-CP',                  desc: 'Giấy phép khai thác tài nguyên nước — tài liệu bổ sung bắt buộc nếu dự án dùng nước mặt/ngầm' },
  ],
  DKMT: [
    { num: 'Điều 49, Luật BVMT 2020',           desc: 'Đối tượng phải đăng ký môi trường: Nhóm IV — quy mô nhỏ, ít nguy cơ ô nhiễm' },
    { num: 'Điều 50, Luật BVMT 2020',           desc: 'Nội dung, thủ tục, thời hạn đăng ký môi trường (5 ngày làm việc)' },
    { num: 'NĐ 08/2022 (VBHN 49/2026), Điều 49–56', desc: 'Trình tự đăng ký, cơ quan tiếp nhận: UBND xã, huyện theo ủy quyền' },
    { num: 'TT 02/2022 (sửa đổi bởi TT 09/2026)', desc: '⭐ Mẫu đăng ký môi trường (Mẫu 01/ĐKMT, Phụ lục VI) — dùng mẫu cập nhật TT 09/2026' },
  ],
};

// ─────────────────────────────────────────────────────────────────
// SENSITIVE_AREAS — Vùng nhạy cảm có thể nâng Nhóm I (Điều 25 mềm)
// Đây là các tiêu chí bổ sung cần hỏi user, ngoài rừng/lúa/biên giới
// ─────────────────────────────────────────────────────────────────
const SENSITIVE_AREAS = [
  { key: 'rung',      label: 'Sử dụng đất rừng phòng hộ hoặc đặc dụng',                  ref: 'Điểm b, Khoản 1, Điều 25, Luật BVMT 2020', force: true  },
  { key: 'lua',       label: 'Chuyển đổi đất trồng lúa 2 vụ trở lên >10ha',               ref: 'Điểm c, Khoản 1, Điều 25, Luật BVMT 2020', force: true  },
  { key: 'bg',        label: 'Trong phạm vi 50km tính từ đường biên giới quốc gia',        ref: 'Điểm d, Khoản 1, Điều 25, Luật BVMT 2020', force: true  },
  { key: 'bao_ton',   label: 'Trong hoặc giáp vùng đệm khu bảo tồn thiên nhiên / VQG',   ref: 'Điểm a, Khoản 1, Điều 25, Luật BVMT 2020', force: true  },
  { key: 'di_san',    label: 'Trong phạm vi di sản thiên nhiên, di sản thế giới UNESCO',   ref: 'Điểm a, Khoản 1, Điều 25, Luật BVMT 2020', force: true  },
  { key: 'ven_bien',  label: 'Trong hành lang bảo vệ bờ biển (theo quy hoạch)',            ref: 'Khoản 2, Điều 25, Luật BVMT 2020',          force: false },
  { key: 'nguon_nc',  label: 'Trong hành lang bảo vệ nguồn nước cấp sinh hoạt',           ref: 'Khoản 3, Điều 25, Luật BVMT 2020',          force: false },
  { key: 'dat_ngap',  label: 'Trong vùng đất ngập nước quan trọng (Ramsar/quốc gia)',      ref: 'Khoản 1, Điều 25, Luật BVMT 2020',          force: false },
];

// ─────────────────────────────────────────────────────────────────
// LAW_CHANGE_WARNINGS — Cảnh báo văn bản đang thay đổi
// key = slug ngành trong IND_DB hoặc 'global'
// ─────────────────────────────────────────────────────────────────
const LAW_CHANGE_WARNINGS = [
  {
    applies_to: 'global',
    icon: '📋',
    text: 'Từ 29/01/2026: dùng bản hợp nhất VBHN 49/2026 thay vì đọc riêng NĐ 08/2022 + NĐ 05/2025 + NĐ 48/2026.',
    ref: 'VBHN 49/VBHN-BNNMT (17/04/2026)',
  },
  {
    applies_to: 'global',
    icon: '📝',
    text: 'Mẫu hồ sơ ĐTM, GPMT, ĐKMT đã được sửa đổi bởi TT 09/2026 (hiệu lực 29/01/2026). Không dùng biểu mẫu cũ của TT 02/2022 bản gốc.',
    ref: 'TT 09/2026/TT-BNNMT',
  },
  {
    applies_to: 'do_thi',
    icon: '🏙️',
    text: 'Ngưỡng diện tích khu đô thị đã đổi theo NĐ 48/2026: ≥300ha → Bộ NNMT; 50–300ha → Sở TNMT. Khác hoàn toàn NĐ 08/2022 gốc.',
    ref: 'NĐ 48/2026, Điều 5',
  },
  {
    applies_to: 'xl_nuoc_thai',
    icon: '💧',
    text: 'Thay thế công nghệ HTXLNT tăng lưu lượng ≥50m³/ngày → phải lập lại ĐTM hoặc GPMT (quy định mới từ NĐ 48/2026).',
    ref: 'NĐ 48/2026, Điều 8',
  },
  {
    applies_to: 'khai_thac_ks',
    icon: '⛏️',
    text: 'Khai thác khoáng sản có liên quan trách nhiệm tái chế/EPR với một số loại bao bì sản phẩm (NĐ 110/2026 mới nhất).',
    ref: 'NĐ 110/2026/NĐ-CP (25/05/2026)',
  },
];

// ─────────────────────────────────────────────────────────────────
// CÁC LOOKUP TABLE TĨNH
// ─────────────────────────────────────────────────────────────────
const TQ_LABEL = {
  cap_bo:    'Bộ Nông nghiệp và Môi trường (Bộ NNMT)',
  cap_so:    'Sở Tài nguyên và Môi trường tỉnh/thành phố',
  cap_huyen: 'UBND cấp huyện (hoặc xã theo ủy quyền)',
};

const THOI_HAN = {
  DTM_cap_bo:    '45 ngày làm việc',
  DTM_cap_so:    '30 ngày làm việc',
  GPMT_cap_bo:   '45 ngày làm việc',
  GPMT_cap_so:   '30 ngày làm việc',
  GPMT_cap_huyen:'15 ngày làm việc',
  DKMT_cap_huyen:'5 ngày làm việc',
};

const HS_INFO = {
  DTM:  { icon: '📋', label: 'Báo cáo Đánh giá tác động môi trường', class: 'chip-dtm',  bg: '#EEF3FF' },
  GPMT: { icon: '🪪', label: 'Giấy phép môi trường',                  class: 'chip-gpmt', bg: '#EEF8F3' },
  DKMT: { icon: '📝', label: 'Đăng ký môi trường',                    class: 'chip-dkmt', bg: '#F8F8F5' },
};

// Export toàn bộ vào window.AppData
global.AppData = Object.assign(global.AppData || {}, {
  IND_DB,
  CHECKLIST,
  LAW_REFS,
  SENSITIVE_AREAS,
  LAW_CHANGE_WARNINGS,
  TQ_LABEL,
  THOI_HAN,
  HS_INFO,
});

})(window);
