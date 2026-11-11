// backend/services/spatial-gis-service.js
// Dịch vụ Phân tích Không gian (Spatial GIS Engine) phục vụ Phân loại Hồ sơ & Giám sát Môi trường
// Căn cứ: Điều 25 Luật BVMT 2020, Nghị định 08/2022/NĐ-CP, Nghị định 48/2026/NĐ-CP (VBHN 49/2026)

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Tính khoảng cách Haversine giữa 2 tọa độ (km)
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Tính khoảng cách ngắn nhất từ điểm P(lat, lng) tới đoạn thẳng AB(lat1, lon1 -> lat2, lon2) theo km
 */
function pointToSegmentDistanceKm(pLat, pLon, aLat, aLon, bLat, bLon) {
  const cosLat = Math.cos(toRad(pLat));
  const px = pLon * cosLat;
  const py = pLat;
  const ax = aLon * cosLat;
  const ay = aLat;
  const bx = bLon * cosLat;
  const by = bLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = 0;
  if (lenSq > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const nearestLon = aLon + t * (bLon - aLon);
  const nearestLat = aLat + t * (bLat - aLat);
  return {
    distanceKm: haversineDistanceKm(pLat, pLon, nearestLat, nearestLon),
    nearestLat,
    nearestLon
  };
}

// Chuỗi tọa độ đường biên giới đất liền Việt Nam (Việt - Trung, Việt - Lào, Việt - Campuchia)
const VIETNAM_LAND_BORDER_POLYLINE = [
  // Biên giới Việt - Trung (Quảng Ninh -> Lạng Sơn -> Cao Bằng -> Hà Giang -> Lào Cai -> Lai Châu -> Điện Biên)
  [21.525, 107.968], [21.552, 107.450], [21.825, 106.950], [21.972, 106.755],
  [22.250, 106.590], [22.580, 106.750], [22.855, 106.650], [22.950, 106.200],
  [22.980, 105.820], [23.350, 105.320], [23.120, 104.780], [22.750, 104.450],
  [22.502, 103.965], [22.680, 103.520], [22.785, 103.150], [22.490, 102.700],
  [22.400, 102.148],
  // Biên giới Việt - Lào (Điện Biên -> Sơn La -> Thanh Hóa -> Nghệ An -> Hà Tĩnh -> Quảng Bình -> Quảng Trị -> Huế -> Đà Nẵng/Quảng Nam -> Kon Tum)
  [21.650, 102.750], [21.150, 103.020], [20.780, 103.450], [20.550, 104.050],
  [20.420, 104.600], [20.150, 104.880], [19.650, 104.720], [19.420, 104.050],
  [19.050, 104.250], [18.620, 104.950], [18.380, 105.150], [17.950, 105.720],
  [17.550, 105.820], [17.080, 106.420], [16.620, 106.580], [16.250, 107.050],
  [15.850, 107.350], [15.420, 107.480], [14.950, 107.550], [14.685, 107.555],
  // Biên giới Việt - Campuchia (Kon Tum -> Gia Lai -> Đắk Lắk -> Đắk Nông -> Bình Phước -> Tây Ninh -> Long An -> Đồng Tháp -> An Giang -> Kiên Giang)
  [14.220, 107.450], [13.680, 107.520], [13.150, 107.480], [12.550, 107.520],
  [12.180, 107.220], [11.950, 106.820], [11.780, 106.450], [11.650, 105.980],
  [11.350, 105.880], [11.050, 106.150], [10.880, 105.850], [10.890, 105.420],
  [10.950, 105.120], [10.550, 104.920], [10.425, 104.460]
];

// Chuỗi tọa độ đường bờ biển Việt Nam
const VIETNAM_COASTLINE_POLYLINE = [
  [21.480, 107.970], [20.950, 107.060], [20.720, 106.790], [20.250, 106.580],
  [19.880, 105.950], [19.020, 105.620], [18.350, 106.050], [17.480, 106.620],
  [16.850, 107.280], [16.320, 107.850], [16.060, 108.240], [15.450, 108.680],
  [14.650, 109.060], [13.770, 109.230], [13.080, 109.320], [12.240, 109.200],
  [11.560, 109.020], [10.920, 108.120], [10.340, 107.080], [10.390, 106.920],
  [10.120, 106.720], [9.780, 106.550], [9.450, 106.120], [9.180, 105.650],
  [8.620, 104.850], [9.180, 104.820], [9.980, 105.080], [10.380, 104.480]
];

// Danh mục các Khu vực Nhạy cảm Môi trường Trọng điểm tại Việt Nam (Điều 25 Luật BVMT 2020)
const VIETNAM_SENSITIVE_ZONES = [
  // 1. Vườn Quốc gia & Khu Bảo tồn Thiên nhiên (bao_ton)
  { id: 'vqg_cat_tien', name: 'Vườn Quốc gia Cát Tiên', category: 'bao_ton', flagKey: 'bao_ton', lat: 11.4232, lng: 107.4285, radiusKm: 18, province: 'Đồng Nai / Lâm Đồng / Bình Phước', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'kdt_can_gio', name: 'Khu Dự trữ Sinh quyển Rừng ngập mặn Cần Giờ', category: 'bao_ton', flagKey: 'bao_ton', lat: 10.5214, lng: 106.8856, radiusKm: 16, province: 'TP. Hồ Chí Minh', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_cuc_phuong', name: 'Vườn Quốc gia Cúc Phương', category: 'bao_ton', flagKey: 'bao_ton', lat: 20.3167, lng: 105.6083, radiusKm: 14, province: 'Ninh Bình / Hòa Bình / Thanh Hóa', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_ba_vi', name: 'Vườn Quốc gia Ba Vì', category: 'bao_ton', flagKey: 'bao_ton', lat: 21.0667, lng: 105.3667, radiusKm: 10, province: 'Hà Nội', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_tam_dao', name: 'Vườn Quốc gia Tam Đảo', category: 'bao_ton', flagKey: 'bao_ton', lat: 21.4583, lng: 105.6458, radiusKm: 14, province: 'Vĩnh Phúc / Thái Nguyên / Tuyên Quang', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_bach_ma', name: 'Vườn Quốc gia Bạch Mã', category: 'bao_ton', flagKey: 'bao_ton', lat: 16.2000, lng: 107.8500, radiusKm: 14, province: 'Huế / Quảng Nam', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'kbt_son_tra', name: 'Khu Bảo tồn Thiên nhiên Sơn Trà', category: 'bao_ton', flagKey: 'bao_ton', lat: 16.1186, lng: 108.2736, radiusKm: 6, province: 'Đà Nẵng', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_lo_go_xa_mat', name: 'Vườn Quốc gia Lò Gò - Xa Mát', category: 'bao_ton', flagKey: 'bao_ton', lat: 11.5833, lng: 105.9333, radiusKm: 12, province: 'Tây Ninh', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_bu_gia_map', name: 'Vườn Quốc gia Bù Gia Mập', category: 'bao_ton', flagKey: 'bao_ton', lat: 12.1833, lng: 107.1833, radiusKm: 14, province: 'Bình Phước', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'kbt_binh_chau', name: 'Khu Bảo tồn Thiên nhiên Bình Châu - Phước Bửu', category: 'bao_ton', flagKey: 'bao_ton', lat: 10.5333, lng: 107.4833, radiusKm: 9, province: 'Bà Rịa - Vũng Tàu', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_phu_quoc', name: 'Vườn Quốc gia Phú Quốc', category: 'bao_ton', flagKey: 'bao_ton', lat: 10.3333, lng: 104.0167, radiusKm: 14, province: 'Kiên Giang', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_u_minh_thuong', name: 'Vườn Quốc gia U Minh Thượng', category: 'bao_ton', flagKey: 'bao_ton', lat: 9.5833, lng: 105.0833, radiusKm: 10, province: 'Kiên Giang', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'vqg_u_minh_ha', name: 'Vườn Quốc gia U Minh Hạ', category: 'bao_ton', flagKey: 'bao_ton', lat: 9.2333, lng: 104.9333, radiusKm: 10, province: 'Cà Mau', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },

  // 2. Di sản Thiên nhiên Thế giới UNESCO (di_san)
  { id: 'ds_ha_long', name: 'Di sản Thiên nhiên Thế giới Vịnh Hạ Long - Quần đảo Cát Bà', category: 'di_san', flagKey: 'di_san', lat: 20.8600, lng: 107.1200, radiusKm: 18, province: 'Quảng Ninh / Hải Phòng', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'ds_trang_an', name: 'Quần thể Danh thắng Tràng An (UNESCO)', category: 'di_san', flagKey: 'di_san', lat: 20.2506, lng: 105.9100, radiusKm: 10, province: 'Ninh Bình', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'ds_phong_nha', name: 'Vườn Quốc gia Phong Nha - Kẻ Bàng (UNESCO)', category: 'di_san', flagKey: 'di_san', lat: 17.5333, lng: 106.1500, radiusKm: 20, province: 'Quảng Bình', ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },

  // 3. Vùng Đất ngập nước Quan trọng / Ramsar (dat_ngap)
  { id: 'ramsar_tram_chim', name: 'Khu Ramsar Vườn Quốc gia Tràm Chim', category: 'dat_ngap', flagKey: 'dat_ngap', lat: 10.7167, lng: 105.5167, radiusKm: 10, province: 'Đồng Tháp', ref: 'Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'ramsar_lang_sen', name: 'Khu Bảo tồn Đất ngập nước Láng Sen (Ramsar)', category: 'dat_ngap', flagKey: 'dat_ngap', lat: 10.7833, lng: 105.7333, radiusKm: 8, province: 'Long An', ref: 'Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'ramsar_xuan_thuy', name: 'Khu Ramsar Vườn Quốc gia Xuân Thủy', category: 'dat_ngap', flagKey: 'dat_ngap', lat: 20.2333, lng: 106.5333, radiusKm: 10, province: 'Nam Định', ref: 'Khoản 1, Điều 25 Luật BVMT 2020' },
  { id: 'ramsar_mui_ca_mau', name: 'Khu Ramsar Vườn Quốc gia Mũi Cà Mau', category: 'dat_ngap', flagKey: 'dat_ngap', lat: 8.6500, lng: 104.7833, radiusKm: 12, province: 'Cà Mau', ref: 'Khoản 1, Điều 25 Luật BVMT 2020' },

  // 4. Nguồn nước cấp sinh hoạt trọng điểm / Hồ chứa lớn (nguon_nc)
  { id: 'nc_ho_tri_an', name: 'Hồ Trị An & Thượng nguồn Sông Đồng Nai (Cấp nước sinh hoạt vùng ĐNB)', category: 'nguon_nc', flagKey: 'nguon_nc', lat: 11.1667, lng: 107.1167, radiusKm: 12, province: 'Đồng Nai', ref: 'Khoản 3, Điều 25 Luật BVMT 2020' },
  { id: 'nc_ho_dau_tieng', name: 'Hồ Dầu Tiếng (Nguồn nước cấp sinh hoạt & nông nghiệp liên tỉnh)', category: 'nguon_nc', flagKey: 'nguon_nc', lat: 11.3833, lng: 106.2667, radiusKm: 14, province: 'Tây Ninh / Bình Dương / Bình Phước', ref: 'Khoản 3, Điều 25 Luật BVMT 2020' },
  { id: 'nc_tram_bom_hoa_an', name: 'Khu vực thu nước mặt Hóa An - Sông Đồng Nai (Cấp nước TP.HCM & Biên Hòa)', category: 'nguon_nc', flagKey: 'nguon_nc', lat: 10.9550, lng: 106.8050, radiusKm: 4, province: 'Đồng Nai / TP. Hồ Chí Minh', ref: 'Khoản 3, Điều 25 Luật BVMT 2020' },
  { id: 'nc_ho_da_den', name: 'Hồ Đá Đen (Nguồn cấp nước sinh hoạt chính tỉnh Bà Rịa - Vũng Tàu)', category: 'nguon_nc', flagKey: 'nguon_nc', lat: 10.5850, lng: 107.1550, radiusKm: 6, province: 'Bà Rịa - Vũng Tàu', ref: 'Khoản 3, Điều 25 Luật BVMT 2020' },
  { id: 'nc_ho_hoa_binh', name: 'Hồ Hòa Bình & Sông Đà (Nguồn cấp nước sinh hoạt Thủ đô Hà Nội)', category: 'nguon_nc', flagKey: 'nguon_nc', lat: 20.7833, lng: 105.2833, radiusKm: 10, province: 'Hòa Bình', ref: 'Khoản 3, Điều 25 Luật BVMT 2020' }
];

// Danh mục các Khu Công nghiệp (KCN) Trọng điểm tại Việt Nam
const VIETNAM_INDUSTRIAL_PARKS = [
  // TP. Hồ Chí Minh
  { id: 'kcn_tan_tao', name: 'Khu công nghiệp Tân Tạo', lat: 10.7538, lng: 106.5912, radiusKm: 2.2, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_hiep_phuoc', name: 'Khu công nghiệp Hiệp Phước', lat: 10.6315, lng: 106.7510, radiusKm: 3.5, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_tan_binh', name: 'Khu công nghiệp Tân Bình', lat: 10.8165, lng: 106.6258, radiusKm: 1.8, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_vinh_loc', name: 'Khu công nghiệp Vĩnh Lộc', lat: 10.8220, lng: 106.5880, radiusKm: 2.0, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_shtp', name: 'Khu Công nghệ cao TP. Hồ Chí Minh (SHTP)', lat: 10.8550, lng: 106.7980, radiusKm: 2.8, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_tay_bac_cu_chi', name: 'Khu công nghiệp Tây Bắc Củ Chi', lat: 10.9735, lng: 106.4810, radiusKm: 2.5, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_dong_nam', name: 'Khu công nghiệp Đông Nam Củ Chi', lat: 10.9950, lng: 106.6420, radiusKm: 2.2, province: 'TP. Hồ Chí Minh' },
  { id: 'kcn_cat_lai', name: 'Khu công nghiệp Cát Lái', lat: 10.7680, lng: 106.7880, radiusKm: 1.8, province: 'TP. Hồ Chí Minh' },
  // Bình Dương
  { id: 'kcn_vsip_1', name: 'Khu công nghiệp VSIP I Bình Dương', lat: 10.9310, lng: 106.7160, radiusKm: 2.8, province: 'Bình Dương' },
  { id: 'kcn_vsip_2', name: 'Khu công nghiệp VSIP II Bình Dương', lat: 11.0890, lng: 106.6850, radiusKm: 3.5, province: 'Bình Dương' },
  { id: 'kcn_my_phuoc', name: 'Khu công nghiệp Mỹ Phước 1 - 2 - 3', lat: 11.1450, lng: 106.6050, radiusKm: 4.5, province: 'Bình Dương' },
  { id: 'kcn_song_than', name: 'Khu công nghiệp Sóng Thần 1 - 2 - 3', lat: 10.8920, lng: 106.7480, radiusKm: 2.5, province: 'Bình Dương' },
  { id: 'kcn_bau_bang', name: 'Khu công nghiệp Bàu Bàng', lat: 11.2580, lng: 106.6320, radiusKm: 3.5, province: 'Bình Dương' },
  // Đồng Nai
  { id: 'kcn_amata', name: 'Khu công nghiệp Amata Biên Hòa', lat: 10.9530, lng: 106.8840, radiusKm: 2.8, province: 'Đồng Nai' },
  { id: 'kcn_bien_hoa_2', name: 'Khu công nghiệp Biên Hòa II', lat: 10.9220, lng: 106.8580, radiusKm: 2.2, province: 'Đồng Nai' },
  { id: 'kcn_nhon_trach', name: 'Tổ hợp Khu công nghiệp Nhơn Trạch 1 - 2 - 3 - 5 - 6', lat: 10.7420, lng: 106.9250, radiusKm: 4.5, province: 'Đồng Nai' },
  { id: 'kcn_long_thanh', name: 'Khu công nghiệp Long Thành', lat: 10.8180, lng: 106.9650, radiusKm: 2.5, province: 'Đồng Nai' },
  { id: 'kcn_giang_dien', name: 'Khu công nghiệp Giang Điền', lat: 10.9350, lng: 106.9950, radiusKm: 2.5, province: 'Đồng Nai' },
  // Bà Rịa - Vũng Tàu
  { id: 'kcn_phu_my', name: 'Khu công nghiệp Phú Mỹ 1 - 2 - 3 & Cái Mép', lat: 10.5820, lng: 107.0380, radiusKm: 4.2, province: 'Bà Rịa - Vũng Tàu' },
  { id: 'kcn_chau_duc', name: 'Khu công nghiệp Sonadezi Châu Đức', lat: 10.6450, lng: 107.1850, radiusKm: 3.8, province: 'Bà Rịa - Vũng Tàu' },
  // Long An
  { id: 'kcn_long_hau', name: 'Khu công nghiệp Long Hậu', lat: 10.6180, lng: 106.7320, radiusKm: 2.2, province: 'Long An' },
  { id: 'kcn_duc_hoa_3', name: 'Khu công nghiệp Đức Hòa III / Xuyên Á', lat: 10.9050, lng: 106.4550, radiusKm: 3.2, province: 'Long An' },
  // Cần Thơ & ĐBSCL
  { id: 'kcn_tra_noc', name: 'Khu công nghiệp Trà Nóc 1 & 2', lat: 10.1050, lng: 105.7120, radiusKm: 2.5, province: 'Cần Thơ' },
  { id: 'kcn_hung_phu', name: 'Khu công nghiệp Hưng Phú 1 & 2', lat: 10.0120, lng: 105.8050, radiusKm: 2.2, province: 'Cần Thơ' },
  { id: 'kcn_long_giang', name: 'Khu công nghiệp Long Giang', lat: 10.4520, lng: 106.3120, radiusKm: 2.5, province: 'Tiền Giang' },
  { id: 'kcn_giao_long', name: 'Khu công nghiệp Giao Long', lat: 10.2780, lng: 106.4250, radiusKm: 2.0, province: 'Bến Tre' },
  // Miền Trung & Miền Bắc
  { id: 'kcn_hoa_khanh', name: 'Khu công nghiệp Hòa Khánh & Liên Chiểu', lat: 16.0850, lng: 108.1380, radiusKm: 2.8, province: 'Đà Nẵng' },
  { id: 'kcn_dinh_vu', name: 'Khu kinh tế - KCN Đình Vũ - Cát Hải', lat: 20.8350, lng: 106.7650, radiusKm: 4.0, province: 'Hải Phòng' },
  { id: 'kcn_vsip_hai_phong', name: 'Khu công nghiệp VSIP Hải Phòng', lat: 20.9150, lng: 106.6650, radiusKm: 2.8, province: 'Hải Phòng' },
  { id: 'kcn_bac_thang_long', name: 'Khu công nghiệp Bắc Thăng Long', lat: 21.1250, lng: 105.7750, radiusKm: 2.5, province: 'Hà Nội' },
  { id: 'kcn_yen_phong', name: 'Khu công nghiệp Yên Phong I & II', lat: 21.2050, lng: 105.9850, radiusKm: 3.5, province: 'Bắc Ninh' },
  { id: 'kcn_que_vo', name: 'Khu công nghiệp Quế Võ I - II - III', lat: 21.1580, lng: 106.1350, radiusKm: 3.2, province: 'Bắc Ninh' }
];

/**
 * Tính khoảng cách ngắn nhất từ điểm (lat, lng) tới chuỗi Polyline
 */
function minDistanceToPolyline(lat, lng, polyline) {
  let minDistance = Infinity;
  let closestPoint = null;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [aLat, aLon] = polyline[i];
    const [bLat, bLon] = polyline[i + 1];
    const seg = pointToSegmentDistanceKm(lat, lng, aLat, aLon, bLat, bLon);
    if (seg.distanceKm < minDistance) {
      minDistance = seg.distanceKm;
      closestPoint = [seg.nearestLat, seg.nearestLon];
    }
  }

  return {
    distanceKm: Number(minDistance.toFixed(2)),
    closestPoint
  };
}

/**
 * Ước tính bán kính ảnh hưởng môi trường (mét) của dự án theo Nhóm dự án & quy mô phát thải
 */
function calculateImpactRadius(nhom = 'Nhóm III', nt = 0, kt = 0) {
  let baseRadius = 500;
  if (nhom === 'Nhóm I') baseRadius = 2000;
  else if (nhom === 'Nhóm II') baseRadius = 1000;
  else if (nhom === 'Nhóm III') baseRadius = 500;
  else if (nhom === 'Nhóm IV') baseRadius = 200;

  const numNt = parseFloat(nt) || 0;
  const numKt = parseFloat(kt) || 0;

  let extra = 0;
  if (numNt >= 2000) extra += 500;
  else if (numNt >= 500) extra += 250;

  if (numKt >= 100000) extra += 600;
  else if (numKt >= 20000) extra += 300;

  return baseRadius + extra;
}

/**
 * Phân tích bối cảnh không gian GIS cho một tọa độ (lat, lng)
 */
function analyzeSpatialContext(lat, lng) {
  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    return null;
  }

  // 1. Khoảng cách tới đường biên giới đất liền
  const borderCheck = minDistanceToPolyline(numLat, numLng, VIETNAM_LAND_BORDER_POLYLINE);
  const isNearBorder = borderCheck.distanceKm <= 50;

  // 2. Khoảng cách tới đường bờ biển
  const coastCheck = minDistanceToPolyline(numLat, numLng, VIETNAM_COASTLINE_POLYLINE);
  const isNearCoast = coastCheck.distanceKm <= 5;

  // 3. Kiểm tra giao cắt / lân cận với các Vùng nhạy cảm môi trường (VQG, Di sản, Đất ngập nước, Nguồn nước cấp)
  const detectedSensitiveZones = [];
  const autoFlags = {
    bg: isNearBorder,
    ven_bien: isNearCoast,
    bao_ton: false,
    di_san: false,
    dat_ngap: false,
    nguon_nc: false,
    kcn: false
  };

  for (const zone of VIETNAM_SENSITIVE_ZONES) {
    const dist = haversineDistanceKm(numLat, numLng, zone.lat, zone.lng);
    const bufferThreshold = zone.radiusKm + 5; // Bao gồm vùng lõi + vùng đệm 5km
    if (dist <= bufferThreshold) {
      const inCore = dist <= zone.radiusKm;
      detectedSensitiveZones.push({
        ...zone,
        distanceKm: Number(dist.toFixed(2)),
        inCore,
        statusLabel: inCore ? 'Nằm trong phạm vi vùng bảo vệ' : 'Nằm sát hành lang / vùng đệm'
      });
      autoFlags[zone.flagKey] = true;
    }
  }

  detectedSensitiveZones.sort((a, b) => a.distanceKm - b.distanceKm);

  // 4. Kiểm tra nằm trong hoặc sát Khu công nghiệp (KCN)
  let nearestKcn = null;
  let minKcnDist = Infinity;
  for (const kcn of VIETNAM_INDUSTRIAL_PARKS) {
    const dist = haversineDistanceKm(numLat, numLng, kcn.lat, kcn.lng);
    if (dist < minKcnDist) {
      minKcnDist = dist;
      nearestKcn = {
        ...kcn,
        distanceKm: Number(dist.toFixed(2)),
        insideKcn: dist <= kcn.radiusKm
      };
    }
  }

  if (nearestKcn && nearestKcn.insideKcn) {
    autoFlags.kcn = true;
  }

  // 5. Tổng hợp danh sách cảnh báo không gian tự động
  const spatialAlerts = [];

  if (isNearBorder) {
    spatialAlerts.push({
      key: 'bg',
      level: 'warn',
      title: `Khu vực gần biên giới đất liền (cách ~${borderCheck.distanceKm} km)`,
      detail: 'Khoảng cách ước tính đến biên giới ≤ 50 km chỉ mang tính tham khảo không gian; không tự động nâng dự án lên Nhóm I nếu chưa xác minh ranh giới hành chính xã biên giới và điều kiện pháp lý cụ thể (NEEDS_LEGAL_VERIFICATION).',
      autoFlag: 'bg'
    });
  }

  if (isNearCoast) {
    spatialAlerts.push({
      key: 'ven_bien',
      level: 'warn',
      title: `Khu vực ven biển (cách đường bờ biển ~${coastCheck.distanceKm} km)`,
      detail: 'Tọa độ nằm gần bờ biển (≤ 5 km) → Cần đối chiếu ranh giới hành lang bảo vệ bờ biển do UBND cấp tỉnh công bố theo Điều 25 Luật BVMT 2020 và Điều 25 Nghị định 08/2022/NĐ-CP.',
      autoFlag: 'ven_bien'
    });
  }

  for (const z of detectedSensitiveZones) {
    spatialAlerts.push({
      key: z.flagKey,
      level: z.inCore ? 'danger' : 'warn',
      title: `${z.name} (cách tâm ~${z.distanceKm} km)`,
      detail: `${z.statusLabel} (bán kính ước tính ${z.radiusKm} km) → Cần xác minh ranh giới pháp lý trong quyết định thành lập/công nhận và diện tích giao cắt thực tế (${z.ref}).`,
      autoFlag: z.flagKey
    });
  }

  if (nearestKcn && nearestKcn.insideKcn) {
    spatialAlerts.push({
      key: 'kcn',
      level: 'info',
      title: `Nằm trong phạm vi ${nearestKcn.name} (cách tâm ${nearestKcn.distanceKm} km)`,
      detail: 'Dự án nằm trong KCN không tự động được miễn ĐTM. Cần kiểm tra quyết định phê duyệt ĐTM hạ tầng KCN, phân khu ngành nghề, công suất hệ thống XLNT tập trung và điều kiện đấu nối (NEEDS_LEGAL_VERIFICATION).',
      autoFlag: 'kcn'
    });
  }

  return {
    coordinates: { latitude: numLat, longitude: numLng },
    borderDistanceKm: borderCheck.distanceKm,
    borderClosestPoint: borderCheck.closestPoint,
    coastDistanceKm: coastCheck.distanceKm,
    coastClosestPoint: coastCheck.closestPoint,
    detectedSensitiveZones,
    nearestKcn: (nearestKcn && nearestKcn.distanceKm <= 15) ? nearestKcn : null,
    autoFlags,
    spatialAlerts
  };
}

function getAllGisLayers() {
  return {
    sensitiveZones: VIETNAM_SENSITIVE_ZONES,
    industrialParks: VIETNAM_INDUSTRIAL_PARKS,
    landBorderPolyline: VIETNAM_LAND_BORDER_POLYLINE
  };
}

module.exports = {
  haversineDistanceKm,
  calculateImpactRadius,
  analyzeSpatialContext,
  getAllGisLayers,
  VIETNAM_SENSITIVE_ZONES,
  VIETNAM_INDUSTRIAL_PARKS
};
