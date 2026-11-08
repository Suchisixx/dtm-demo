// frontend/src/utils/constants.js
// Hằng số dùng chung cho toàn bộ frontend

// Tọa độ mặc định TP.HCM
export const DEFAULT_LAT = 10.776889
export const DEFAULT_LNG = 106.700806
export const DEFAULT_ZOOM = 8

// API endpoints
export const API = {
  AUTH_ME: '/api/auth/me',
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  PROJECTS: '/api/projects',
  PROJECTS_GEO: '/api/projects/geo',
  LAWS: '/api/laws',
  QCVN_SAMPLES: '/api/qcvns/samples',
  CLASSIFY: '/api/classification/evaluate',
  CLASSIFY_METADATA: '/api/classification/metadata',
  CLASSIFY_SPATIAL_CHECK: '/api/classification/spatial-check',
  CLASSIFY_GIS_LAYERS: '/api/classification/gis-layers',
  ADMIN_USERS: '/api/admin/users',
  ADMIN_PROJECTS: '/api/admin/projects',
  CRAWLER_SETTINGS: '/api/crawler/settings',
  CRAWLER_RUN: '/api/crawler/run',
  CRAWLER_HISTORY: '/api/crawler/history',
  PROJECTS_SEARCH: '/api/projects/search',
  QCVN_SAMPLE_BY_ID: '/api/qcvns/samples',  // append /:id when calling
  DASHBOARD_STATS: '/api/dashboard/stats',
}

// Helper function cho endpoints có param
export const projectQcvnSamples = (id) => `/api/projects/${id}/qcvn-samples`

// Tile Layer configs (100% Free, No API Key Required — Modern, Landuse & Satellite Hybrid)
export const CARTO_VOYAGER_URL = 'https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}'
export const CARTO_ATTRIBUTION = '&copy; Google Maps Vietnam'
export const OSM_LANDUSE_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors, Tiles courtesy of HOT OSM'
export const ESRI_IMAGERY_URL = 'https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}'
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Danh mục Khu công nghiệp & Vùng nhạy cảm môi trường nhúng sẵn ở Frontend (hoạt động ngay cả khi chưa restart Backend)
export const EMBEDDED_GIS_LAYERS = {
  industrialParks: [
    { id: 'kcn_tra_noc', name: 'Khu công nghiệp Trà Nóc 1 & 2', lat: 10.095, lng: 105.712, radiusKm: 2.5, province: 'Cần Thơ' },
    { id: 'kcn_hung_phu', name: 'Khu công nghiệp Hưng Phú 1 & 2', lat: 10.012, lng: 105.805, radiusKm: 2.2, province: 'Cần Thơ' },
    { id: 'kcn_thot_not', name: 'Khu công nghiệp Thốt Nốt', lat: 10.258, lng: 105.552, radiusKm: 2.0, province: 'Cần Thơ' },
    { id: 'kcn_vinh_thanh', name: 'Khu công nghiệp Vĩnh Thạnh (VSIP Cần Thơ)', lat: 10.215, lng: 105.412, radiusKm: 3.0, province: 'Cần Thơ' },
    { id: 'kcn_vsip_1', name: 'Khu công nghiệp VSIP I Bình Dương', lat: 10.931, lng: 106.716, radiusKm: 2.8, province: 'Bình Dương' },
    { id: 'kcn_vsip_2', name: 'Khu công nghiệp VSIP II Bình Dương', lat: 11.085, lng: 106.682, radiusKm: 3.5, province: 'Bình Dương' },
    { id: 'kcn_my_phuoc', name: 'Khu công nghiệp Mỹ Phước 1-2-3', lat: 11.132, lng: 106.608, radiusKm: 4.5, province: 'Bình Dương' },
    { id: 'kcn_song_than', name: 'Khu công nghiệp Sóng Thần 1-2-3', lat: 10.892, lng: 106.748, radiusKm: 2.8, province: 'Bình Dương' },
    { id: 'kcn_amata', name: 'Khu công nghiệp Amata Biên Hòa', lat: 10.952, lng: 106.885, radiusKm: 3.0, province: 'Đồng Nai' },
    { id: 'kcn_bien_hoa_2', name: 'Khu công nghiệp Biên Hòa 2', lat: 10.922, lng: 106.854, radiusKm: 2.5, province: 'Đồng Nai' },
    { id: 'kcn_nhon_trach', name: 'Cụm Khu công nghiệp Nhơn Trạch 1-6', lat: 10.735, lng: 106.925, radiusKm: 5.0, province: 'Đồng Nai' },
    { id: 'kcn_long_thanh', name: 'Khu công nghiệp Long Thành', lat: 10.802, lng: 106.952, radiusKm: 2.8, province: 'Đồng Nai' },
    { id: 'kcn_phu_my', name: 'Khu công nghiệp Phú Mỹ 1-2-3', lat: 10.578, lng: 107.042, radiusKm: 4.5, province: 'Bà Rịa - Vũng Tàu' },
    { id: 'kcn_cai_mep', name: 'Khu công nghiệp Cái Mép', lat: 10.525, lng: 107.022, radiusKm: 3.2, province: 'Bà Rịa - Vũng Tàu' },
    { id: 'kcn_tan_binh', name: 'Khu công nghiệp Tân Bình', lat: 10.818, lng: 106.625, radiusKm: 1.8, province: 'TP. Hồ Chí Minh' },
    { id: 'kcn_hiep_phuoc', name: 'Khu công nghiệp Hiệp Phước', lat: 10.635, lng: 106.752, radiusKm: 3.5, province: 'TP. Hồ Chí Minh' },
    { id: 'kcn_tan_tao', name: 'Khu công nghiệp Tân Tạo', lat: 10.748, lng: 106.588, radiusKm: 2.2, province: 'TP. Hồ Chí Minh' },
    { id: 'kcn_tay_bac_cu_chi', name: 'Khu công nghiệp Tây Bắc Củ Chi', lat: 10.968, lng: 106.482, radiusKm: 2.5, province: 'TP. Hồ Chí Minh' },
    { id: 'kcn_kcnc_hcm', name: 'Khu Công nghệ cao TP.HCM (SHTP)', lat: 10.852, lng: 106.798, radiusKm: 2.8, province: 'TP. Hồ Chí Minh' },
    { id: 'kcn_long_hau', name: 'Khu công nghiệp Long Hậu', lat: 10.618, lng: 106.735, radiusKm: 2.2, province: 'Long An' },
    { id: 'kcn_duc_hoa', name: 'Khu công nghiệp Đức Hòa 1 - Hạnh Phúc', lat: 10.828, lng: 106.458, radiusKm: 3.0, province: 'Long An' },
    { id: 'kcn_phuoc_dong', name: 'Khu công nghiệp Phước Đông', lat: 11.125, lng: 106.285, radiusKm: 4.2, province: 'Tây Ninh' },
    { id: 'kcn_long_giang', name: 'Khu công nghiệp Long Giang', lat: 10.452, lng: 106.295, radiusKm: 2.5, province: 'Tiền Giang' },
    { id: 'kcn_hoa_phu', name: 'Khu công nghiệp Hòa Phú', lat: 10.165, lng: 105.948, radiusKm: 2.2, province: 'Vĩnh Long' },
    { id: 'kcn_an_nghiep', name: 'Khu công nghiệp An Nghiệp', lat: 9.635, lng: 105.952, radiusKm: 2.2, province: 'Sóc Trăng' },
    { id: 'kcn_khanh_an', name: 'Khu công nghiệp Khánh An', lat: 9.258, lng: 105.125, radiusKm: 2.5, province: 'Cà Mau' },
    { id: 'kcn_bac_thang_long', name: 'Khu công nghiệp Bắc Thăng Long', lat: 21.123, lng: 105.775, radiusKm: 2.5, province: 'Hà Nội' },
    { id: 'kcn_quang_minh', name: 'Khu công nghiệp Quang Minh', lat: 21.186, lng: 105.752, radiusKm: 2.5, province: 'Hà Nội' },
    { id: 'kcn_yen_phong', name: 'Khu công nghiệp Yên Phong I & II', lat: 21.202, lng: 105.984, radiusKm: 4.0, province: 'Bắc Ninh' },
    { id: 'kcn_que_vo', name: 'Khu công nghiệp Quế Võ I, II, III', lat: 21.158, lng: 106.152, radiusKm: 3.8, province: 'Bắc Ninh' },
    { id: 'kcn_dinh_vu', name: 'Khu kinh tế - KCN Đình Vũ - Cát Hải', lat: 20.825, lng: 106.768, radiusKm: 4.5, province: 'Hải Phòng' },
    { id: 'kcn_vsip_hai_phong', name: 'Khu công nghiệp VSIP Hải Phòng', lat: 20.912, lng: 106.665, radiusKm: 3.2, province: 'Hải Phòng' },
    { id: 'kcn_vung_ang', name: 'Khu kinh tế Vũng Áng (Formosa)', lat: 18.062, lng: 106.418, radiusKm: 5.5, province: 'Hà Tĩnh' },
    { id: 'kcn_hoa_khanh', name: 'Khu công nghiệp Hòa Khánh', lat: 16.082, lng: 108.145, radiusKm: 2.8, province: 'Đà Nẵng' },
    { id: 'kcn_dung_quat', name: 'Khu kinh tế Dung Quất', lat: 15.382, lng: 108.765, radiusKm: 5.5, province: 'Quảng Ngãi' }
  ],
  sensitiveZones: [
    { id: 'dt_can_gio', name: 'Khu dự trữ sinh quyển Rừng ngập mặn Cần Giờ', lat: 10.515, lng: 106.885, radiusKm: 18, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_tram_chim', name: 'Vườn Quốc gia Tràm Chim (Khu Ramsar)', lat: 10.715, lng: 105.505, radiusKm: 12, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_u_minh_thuong', name: 'Vườn Quốc gia U Minh Thượng', lat: 9.592, lng: 105.088, radiusKm: 12, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_mui_ca_mau', name: 'Vườn Quốc gia Mũi Cà Mau', lat: 8.625, lng: 104.765, radiusKm: 15, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_cat_tien', name: 'Vườn Quốc gia Cát Tiên', lat: 11.423, lng: 107.428, radiusKm: 18, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'ho_tri_an', name: 'Hồ chứa nước Trị An (Nguồn nước cấp sinh hoạt)', lat: 11.152, lng: 107.065, radiusKm: 15, ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'ho_dau_tieng', name: 'Hồ chứa nước Dầu Tiếng (Nguồn nước cấp sinh hoạt)', lat: 11.385, lng: 106.265, radiusKm: 16, ref: 'Điểm a, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'ds_ha_long', name: 'Di sản Thiên nhiên Thế giới Vịnh Hạ Long - Cát Bà', lat: 20.858, lng: 107.092, radiusKm: 20, ref: 'Điểm đ, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_cuc_phuong', name: 'Vườn Quốc gia Cúc Phương', lat: 20.316, lng: 105.608, radiusKm: 15, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_ba_vi', name: 'Vườn Quốc gia Ba Vì', lat: 21.081, lng: 105.367, radiusKm: 10, ref: 'Điểm c, Khoản 1, Điều 25 Luật BVMT 2020' },
    { id: 'vqg_phong_nha', name: 'Vườn Quốc gia Phong Nha - Kẻ Bàng (Di sản UNESCO)', lat: 17.535, lng: 106.152, radiusKm: 22, ref: 'Điểm đ, Khoản 1, Điều 25 Luật BVMT 2020' }
  ]
}

// Màu sắc phân vùng quy hoạch sử dụng đất (Landuse Zoning)
export const LANDUSE_STYLES = {
  industrial: {
    label: 'Khu công nghiệp / Nhà máy',
    color: '#7C3AED',
    fillColor: '#8B5CF6',
    fillOpacity: 0.28
  },
  residential: {
    label: 'Khu dân cư / Đô thị',
    color: '#2563EB',
    fillColor: '#60A5FA',
    fillOpacity: 0.20
  },
  commercial: {
    label: 'Khu thương mại / Dịch vụ',
    color: '#D97706',
    fillColor: '#F59E0B',
    fillOpacity: 0.24
  },
  retail: {
    label: 'Khu thương mại / Dịch vụ',
    color: '#D97706',
    fillColor: '#F59E0B',
    fillOpacity: 0.24
  },
  forest: {
    label: 'Rừng / Cây xanh sinh thái',
    color: '#286B4F',
    fillColor: '#34D399',
    fillOpacity: 0.22
  },
  farmland: {
    label: 'Đất nông nghiệp / Canh tác',
    color: '#65A30D',
    fillColor: '#A3E635',
    fillOpacity: 0.18
  }
}

// Pages / Routes
export const PAGES = ['laws', 'dashboard', 'classify', 'qcvn', 'map', 'admin']
export const PRIVATE_PAGES = ['dashboard', 'classify', 'qcvn', 'map']
export const DEFAULT_PAGE = 'laws'

// Nhóm dự án → màu
export const NHOM_COLORS = {
  'Nhóm I': '#e74c3c',
  'Nhóm II': '#e67e22',
  'Nhóm III': '#f1c40f',
  'Nhóm IV': '#27ae60',
  default: '#95a5a6'
}

// Nominatim
export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org'

// Luật Môi Trường base URL
export const LAW_BASE_URL = 'https://www.luatmoitruong.vn/'

// Tọa độ trung tâm 63 Tỉnh/Thành phố Việt Nam
export const PROVINCE_COORDINATES = {
  '01': [21.0285, 105.8542], // Hà Nội
  '02': [22.8233, 104.9839], // Hà Giang
  '04': [22.6667, 106.2667], // Cao Bằng
  '06': [22.1469, 105.8344], // Bắc Kạn
  '08': [21.7167, 104.8833], // Tuyên Quang
  '10': [22.4856, 103.9707], // Lào Cai
  '11': [21.3869, 103.0232], // Điện Biên
  '12': [22.3964, 103.4684], // Lai Châu
  '14': [21.3276, 103.9188], // Sơn La
  '15': [21.7167, 104.8999], // Yên Bái
  '17': [20.8167, 105.3383], // Hoà Bình
  '19': [21.5928, 105.8442], // Thái Nguyên
  '20': [21.8533, 106.7615], // Lạng Sơn
  '22': [21.0069, 107.2925], // Quảng Ninh
  '24': [21.2731, 106.1946], // Bắc Giang
  '25': [21.3228, 105.2155], // Phú Thọ
  '26': [21.3089, 105.6049], // Vĩnh Phúc
  '27': [21.1861, 106.0763], // Bắc Ninh
  '30': [20.9373, 106.3146], // Hải Dương
  '31': [20.8651, 106.6838], // Hải Phòng
  '33': [20.6464, 106.0511], // Hưng Yên
  '34': [20.4463, 106.3366], // Thái Bình
  '35': [20.5453, 105.9122], // Hà Nam
  '36': [20.4344, 106.1773], // Nam Định
  '37': [20.2506, 105.9745], // Ninh Bình
  '38': [19.8067, 105.7852], // Thanh Hóa
  '40': [18.6734, 105.6813], // Nghệ An
  '42': [18.3429, 105.9059], // Hà Tĩnh
  '44': [17.4690, 106.6225], // Quảng Bình
  '45': [16.8167, 107.1000], // Quảng Trị
  '46': [16.4637, 107.5909], // Huế
  '48': [16.0544, 108.2022], // Đà Nẵng
  '49': [15.5667, 108.4833], // Quảng Nam
  '51': [15.1214, 108.7923], // Quảng Ngãi
  '52': [13.7830, 109.2197], // Bình Định
  '54': [13.0882, 109.3136], // Phú Yên
  '56': [12.2471, 109.1967], // Khánh Hòa
  '58': [11.5654, 108.9882], // Ninh Thuận
  '60': [10.9333, 108.1000], // Bình Thuận
  '62': [14.3497, 108.0005], // Kon Tum
  '64': [13.9833, 108.0000], // Gia Lai
  '66': [12.6667, 108.0383], // Đắk Lắk
  '67': [12.0033, 107.6876], // Đắk Nông
  '68': [11.9404, 108.4583], // Lâm Đồng
  '70': [11.7512, 106.9080], // Bình Phước
  '72': [11.3100, 106.0983], // Tây Ninh
  '74': [11.1667, 106.6667], // Bình Dương
  '75': [10.9460, 106.8243], // Đồng Nai
  '77': [10.4114, 107.1362], // Bà Rịa - Vũng Tàu
  '79': [10.7769, 106.7008], // TP. Hồ Chí Minh
  '80': [10.5360, 106.4114], // Long An
  '82': [10.3600, 106.3600], // Tiền Giang
  '83': [10.2415, 106.3759], // Bến Tre
  '84': [9.9347, 106.3453],  // Trà Vinh
  '86': [10.2537, 105.9722], // Vĩnh Long
  '87': [10.4577, 105.6326], // Đồng Tháp
  '89': [10.3888, 105.4359], // An Giang
  '91': [10.0125, 105.0809], // Kiên Giang
  '92': [10.0452, 105.7469], // Cần Thơ
  '93': [9.7845, 105.4701],  // Hậu Giang
  '94': [9.6033, 105.9800],  // Sóc Trăng
  '95': [9.2941, 105.7278],  // Bạc Liêu
  '96': [9.1769, 105.1500]   // Cà Mau
}

