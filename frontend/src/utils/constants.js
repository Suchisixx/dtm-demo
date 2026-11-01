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

// Esri tile layer config
export const ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
export const ESRI_ATTRIBUTION = 'Tiles &copy; Esri'

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

