<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAdministrativeDivisions, loadDivisions } from '../composables/useAdministrativeDivisions.js'
import { useClassificationCatalog } from '../composables/useClassificationCatalog.js'
import SearchableSelect from './SearchableSelect.vue'
import SavedProjectsDrawer from './classify/SavedProjectsDrawer.vue'
import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  OVERPASS_URL,
  LANDUSE_STYLES,
  EMBEDDED_GIS_LAYERS,
  NOMINATIM_URL,
  NHOM_COLORS,
  API,
  REMINDER_ALERT_META,
  REMINDER_RECURRENCE_OPTIONS,
  projectQcvnSamples,
  projectSensitiveVerification,
  projectRemindersSync,
  reminderComplete,
  reminderById
} from '../utils/constants.js'
import {
  createBaseTileLayer,
  createAdminBoundaryWmsLayer,
  fetchAndRenderAdminBoundary
} from '../utils/map-layers.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'
import {
  getRuleSourceLabel,
  getGisSourceLabel,
  getConclusionStatusMeta,
  getSensitiveStatusLabel,
  getProcedureLabel,
  formatReasonForEndUser
} from '../utils/legalLabels.js'

const props = defineProps({
  loadProjectId: { type: Number, default: null },
  currentUser: { type: Object, default: null }
})
const emit = defineEmits(['project-loaded', 'view-qcvn-sample', 'view-law'])

// Trạng thái biểu mẫu
const projectId = ref(null)
const name = ref('')
const nganh = ref('')
const processStage = ref('')
const capacity = ref(0)
const nt = ref(0)
const kt = ref(0)
const tinh = ref('')
const evaluationDate = ref(new Date().toISOString().slice(0, 10))
const latitude = ref(DEFAULT_LAT)
const longitude = ref(DEFAULT_LNG)

// Metadata danh mục runtime lấy từ API/PostgreSQL
const isLoadingSavedProject = ref(false)

// Trạng thái bản đồ GIS
const diaChiHienThi = ref('')
const quanHuyen = ref('')
const phuongXa = ref('')
const addressSearch = ref('')
const addressResults = ref([])
const isSearchingAddress = ref(false)
const locationConfirmed = ref(false)
const classificationSnapshot = ref(null)
const activeBaseMap = ref('voyager') // 'voyager' | 'landuse' | 'satellite'
const showAdminBoundary = ref(true)
const showLanduseOverlay = ref(true)
let adminBoundaryWmsLayer = null
const showImpactBuffer = ref(true)
const isLoadingLanduse = ref(false)
const landuseZonesCount = ref(0)
const selectedZoneInfo = ref(null)
const currentViewbox = ref(null) // [westLon, northLat, eastLon, southLat]
const spatialData = ref(null)
const autoDetectedFlags = ref([])

let searchTimeout = null
let spatialTimeout = null
let overpassTimeout = null

// Trạng thái danh sách chọn nối tiếp sau sáp nhập (Tỉnh/TP → Phường/Xã)
const { divisions, isLoaded: divisionsLoaded } = useAdministrativeDivisions()
const selectedProvince = ref(null)
const selectedWard = ref(null)

// Vị trí gốc do người dùng xác định để phát hiện ghim bản đồ vượt ranh giới
const initialLocation = ref({
  province: '',
  provinceCode: null,
  ward: '',
  wardCode: null,
  district: '',
  lat: null,
  lng: null
})
const locationMismatchWarning = ref(null)
const administrativeLookupMessage = ref('')
let boundaryRequestSequence = 0
let locationRequestSequence = 0
let reverseGeocodeSequence = 0

const wardList = computed(() => {
  if (!selectedProvince.value || !divisions.value.length) return []
  const prov = divisions.value.find(p => String(p.code) === String(selectedProvince.value))
  if (!prov) return []

  return (prov.wards || []).map(unit => ({
    ...unit,
    wardName: unit.name,
    districtName: '',
    subText: '',
  })).sort((a, b) => a.name.localeCompare(b.name, 'vi'))
})

const activeScopeLabel = computed(() => {
  const parts = []
  if (phuongXa.value) parts.push(phuongXa.value)
  if (tinh.value) parts.push(tinh.value)
  return parts.length > 0 ? parts.join(', ') : 'Toàn quốc'
})

// Các cờ khai báo: tám yếu tố nhạy cảm theo Điều 25 Luật BVMT 2020 và sáu cờ nghiệp vụ
const rung = ref(false)
const lua = ref(false)
const bg = ref(false)
const bao_ton = ref(false)
const di_san = ref(false)
const ven_bien = ref(false)
const nguon_nc = ref(false)
const dat_ngap = ref(false)

const kcn = ref(false)
const phanky = ref(false)
const morongdt = ref(false)
const ctnh = ref(false)
const dtcong = ref(false)
const epr = ref(false)

// Khai báo định lượng vùng nhạy cảm (cần Admin xác minh phía server mới được phép nâng nhóm chính thức)
const insideCoreProtectedZone = ref(false)
const paddyConversionAreaHa = ref(0)
const forestConversionAreaHa = ref(0)
const sensitiveEvidenceRef = ref('')
const serverSensitiveVerification = ref(null)
const adminSensitiveNote = ref('')
const adminSensitiveEvidence = ref('')
const isUpdatingSensitiveVerification = ref(false)
const sensitiveVerificationMessage = ref('')
const showAdminSensitivePanel = ref(false)

// Thu gọn chi tiết kỹ thuật / nâng cao để giao diện đơn giản, dễ hiểu
const showSensitiveDetails = ref(false)
const showTechnicalMeta = ref(false)
const showOfflinePreliminary = ref(false)
const showUnverifiedNotice = ref(false)
const showNangNhomNotice = ref(false)
const showClassificationRationale = ref(false)

const displayRationale = computed(() => {
  if (!result.value) return null
  if (result.value.classificationRationale) return result.value.classificationRationale
  const indName = selectedIndustryObj.value?.name || nganh.value || 'Chưa xác định'
  const unit = selectedIndustryObj.value?.unit || ''
  const capNum = Number(capacity.value || 0)
  const capText = `${capNum.toLocaleString('vi-VN')}${unit ? ` ${unit}` : ''}`
  const procText = result.value.hi?.label || result.value.hs || 'Chưa xác định'
  return {
    industryName: indName,
    processStageLabel: processStage.value || null,
    inputCapacity: capNum,
    unit,
    thresholdText: result.value.phuluc && result.value.phuluc !== '—' ? result.value.phuluc : 'Đối chiếu theo quy mô đầu vào',
    capacityScale: null,
    projectGroup: result.value.nhom,
    procedureLabel: procText,
    authorityLabel: result.value.coQuan,
    adjustments: (result.value.nangNhom || []).map(n => `${n.text}${n.ref ? ` (${n.ref})` : ''}`),
    legalRefs: [result.value.phuluc, result.value.ref].filter(r => r && r !== '—'),
    summaryText: `Ngành "${indName}" · Quy mô ${capText} → ${result.value.nhom || 'Chưa xác định'} · ${procText}`
  }
})

const expandedSensitiveNotices = ref(new Set())
const toggleSensitiveNotice = (idx) => {
  if (expandedSensitiveNotices.value.has(idx)) {
    expandedSensitiveNotices.value.delete(idx)
  } else {
    expandedSensitiveNotices.value.add(idx)
  }
}
const isSensitiveNoticeExpanded = (idx) => expandedSensitiveNotices.value.has(idx)

const expandedInfoNotices = ref(new Set())
const toggleInfoNotice = (idx) => {
  if (expandedInfoNotices.value.has(idx)) {
    expandedInfoNotices.value.delete(idx)
  } else {
    expandedInfoNotices.value.add(idx)
  }
}
const isInfoNoticeExpanded = (idx) => expandedInfoNotices.value.has(idx)

const hasAnySensitiveDeclaration = computed(() => Boolean(
  rung.value || lua.value || bg.value || bao_ton.value || di_san.value || ven_bien.value || nguon_nc.value || dat_ngap.value
  || insideCoreProtectedZone.value
  || Number(paddyConversionAreaHa.value) > 0
  || Number(forestConversionAreaHa.value) > 0
  || Boolean(sensitiveEvidenceRef.value && sensitiveEvidenceRef.value.trim())
  || (autoDetectedFlags.value && autoDetectedFlags.value.length > 0)
))

const effectiveSensitiveStatus = computed(() =>
  serverSensitiveVerification.value?.verification_status
  || result.value?.sensitiveVerificationStatus
  || 'NOT_REQUIRED'
)

const shouldShowAdminSensitivePanel = computed(() => Boolean(
  props.currentUser?.role === 'admin'
  && projectId.value
  && (effectiveSensitiveStatus.value !== 'NOT_REQUIRED' || hasAnySensitiveDeclaration.value)
))

const isFallbackOrIncompleteResult = computed(() => Boolean(
  result.value && (result.value.ruleSource !== 'DATABASE' || result.value.errorCode || !result.value.hs)
))

const formattedUnverifiedReasons = computed(() =>
  (result.value?.unverifiedReasons || []).map(r => formatReasonForEndUser(r)).filter(Boolean)
)

const flagRefsMap = {
  rung,
  lua,
  bg,
  bao_ton,
  di_san,
  ven_bien,
  nguon_nc,
  dat_ngap,
  kcn
}

// Trạng thái dự án đã lưu
const projects = ref([])
const currentPage = ref(1)
const totalPages = ref(1)
const isLoadingProjects = ref(false)
const projectsLoadError = ref('')

// Lịch sử quan trắc QCVN
const qcvnHistory = ref([])
const qcvnHistoryPage = ref(1)
const qcvnHistoryTotalPages = ref(1)

const fetchQcvnHistory = async (projId, page = 1) => {
  if (!projId) { qcvnHistory.value = []; return }
  try {
    const res = await fetch(`${projectQcvnSamples(projId)}?page=${page}&limit=5`)
    if (res.ok) {
      const data = await res.json()
      qcvnHistory.value = data.samples || []
      qcvnHistoryTotalPages.value = data.pagination?.totalPages || 1
      qcvnHistoryPage.value = page
    }
  } catch (err) {
    logger.error('Lỗi tải lịch sử quan trắc:', err)
  }
}

const handleViewQcvnSample = (sampleId) => {
  emit('view-qcvn-sample', sampleId)
}

// Trạng thái kết quả
const result = ref(null)
const checklistState = ref({})

// Bản đồ Leaflet và các nhóm lớp bản đồ
let mapInstance = null
let markerInstance = null
let baseTileLayer = null
let satelliteLabelsLayer = null
let boundaryLayerGroup = null
let landuseLayerGroup = null
let candidateLayerGroup = null
let impactCircleInstance = null
let gisStaticLayers = EMBEDDED_GIS_LAYERS

const provinces = {
  'Miền Bắc': [
    { value: 'Hà Nội', label: 'Hà Nội (Thành phố)' },
    { value: 'Hải Phòng', label: 'Hải Phòng (Thành phố)' },
    { value: 'Hà Giang', label: 'Hà Giang' },
    { value: 'Cao Bằng', label: 'Cao Bằng' },
    { value: 'Bắc Kạn', label: 'Bắc Kạn' },
    { value: 'Tuyên Quang', label: 'Tuyên Quang' },
    { value: 'Lào Cai', label: 'Lào Cai' },
    { value: 'Điện Biên', label: 'Điện Biên' },
    { value: 'Lai Châu', label: 'Lai Châu' },
    { value: 'Sơn La', label: 'Sơn La' },
    { value: 'Yên Bái', label: 'Yên Bái' },
    { value: 'Hòa Bình', label: 'Hòa Bình' },
    { value: 'Thái Nguyên', label: 'Thái Nguyên' },
    { value: 'Lạng Sơn', label: 'Lạng Sơn' },
    { value: 'Quảng Ninh', label: 'Quảng Ninh' },
    { value: 'Bắc Giang', label: 'Bắc Giang' },
    { value: 'Phú Thọ', label: 'Phú Thọ' },
    { value: 'Vĩnh Phúc', label: 'Vĩnh Phúc' },
    { value: 'Bắc Ninh', label: 'Bắc Ninh' },
    { value: 'Hải Dương', label: 'Hải Dương' },
    { value: 'Hưng Yên', label: 'Hưng Yên' },
    { value: 'Thái Bình', label: 'Thái Bình' },
    { value: 'Hà Nam', label: 'Hà Nam' },
    { value: 'Nam Định', label: 'Nam Định' },
    { value: 'Ninh Bình', label: 'Ninh Bình' }
  ],
  'Miền Trung': [
    { value: 'Đà Nẵng', label: 'Đà Nẵng (Thành phố)' },
    { value: 'Huế', label: 'Huế (Thành phố)' },
    { value: 'Thanh Hóa', label: 'Thanh Hóa' },
    { value: 'Nghệ An', label: 'Nghệ An' },
    { value: 'Hà Tĩnh', label: 'Hà Tĩnh' },
    { value: 'Quảng Bình', label: 'Quảng Bình' },
    { value: 'Quảng Trị', label: 'Quảng Trị' },
    { value: 'Quảng Nam', label: 'Quảng Nam' },
    { value: 'Quảng Ngãi', label: 'Quảng Ngãi' },
    { value: 'Bình Định', label: 'Bình Định' },
    { value: 'Phú Yên', label: 'Phú Yên' },
    { value: 'Khánh Hòa', label: 'Khánh Hòa' },
    { value: 'Ninh Thuận', label: 'Ninh Thuận' },
    { value: 'Bình Thuận', label: 'Bình Thuận' },
    { value: 'Kon Tum', label: 'Kon Tum' },
    { value: 'Gia Lai', label: 'Gia Lai' },
    { value: 'Đăk Lăk', label: 'Đắk Lắk' },
    { value: 'Đăk Nông', label: 'Đắk Nông' },
    { value: 'Lâm Đồng', label: 'Lâm Đồng' }
  ],
  'Miền Nam': [
    { value: 'TP. Hồ Chí Minh', label: 'TP. Hồ Chí Minh (Thành phố)' },
    { value: 'Cần Thơ', label: 'Cần Thơ (Thành phố)' },
    { value: 'Bình Phước', label: 'Bình Phước' },
    { value: 'Tây Ninh', label: 'Tây Ninh' },
    { value: 'Bình Dương', label: 'Bình Dương' },
    { value: 'Đồng Nai', label: 'Đồng Nai' },
    { value: 'Bà Rịa - Vũng Tàu', label: 'Bà Rịa - Vũng Tàu' },
    { value: 'Long An', label: 'Long An' },
    { value: 'Tiền Giang', label: 'Tiền Giang' },
    { value: 'Bến Tre', label: 'Bến Tre' },
    { value: 'Trà Vinh', label: 'Trà Vinh' },
    { value: 'Vĩnh Long', label: 'Vĩnh Long' },
    { value: 'Đồng Tháp', label: 'Đồng Tháp' },
    { value: 'An Giang', label: 'An Giang' },
    { value: 'Kiên Giang', label: 'Kiên Giang' },
    { value: 'Sóc Trăng', label: 'Sóc Trăng' },
    { value: 'Bạc Liêu', label: 'Bạc Liêu' },
    { value: 'Cà Mau', label: 'Cà Mau' },
    { value: 'Hậu Giang', label: 'Hậu Giang' }
  ]
}

const estimatedImpactRadius = computed(() => {
  if (result.value?.impactRadiusMeters) return result.value.impactRadiusMeters
  let base = 500
  const nhom = result.value?.nhom || 'Nhóm III'
  if (nhom === 'Nhóm I') base = 2000
  else if (nhom === 'Nhóm II') base = 1000
  else if (nhom === 'Nhóm IV') base = 200

  const numNt = parseFloat(nt.value) || 0
  const numKt = parseFloat(kt.value) || 0
  if (numNt >= 2000) base += 500
  else if (numNt >= 500) base += 250
  if (numKt >= 100000) base += 600
  else if (numKt >= 20000) base += 300
  return base
})

const fetchProjects = async (page = 1) => {
  isLoadingProjects.value = true
  projectsLoadError.value = ''
  try {
    const res = await fetch(`${API.PROJECTS}?page=${page}&limit=5`)
    if (res.status === 401) {
      projectsLoadError.value = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xem hồ sơ đã lưu.'
      return
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Máy chủ trả về mã HTTP ${res.status}.`)
    projects.value = Array.isArray(data.projects) ? data.projects : []
    totalPages.value = data.pagination?.totalPages || 1
    currentPage.value = page
  } catch (err) {
    projectsLoadError.value = err instanceof TypeError
      ? 'Không kết nối được máy chủ API. Hãy kiểm tra backend đang chạy tại cổng 3000.'
      : `Không tải được hồ sơ đã lưu: ${err.message || 'Lỗi máy chủ'}`
    logger.error('Lỗi khi fetch projects:', err)
  } finally {
    isLoadingProjects.value = false
  }
}

const openProjectsDrawer = () => {
  showProjectsDrawer.value = true
  fetchProjects(1)
}

const fetchStaticGisLayers = async () => {
  try {
    const res = await fetch(API.CLASSIFY_GIS_LAYERS)
    if (res.ok) {
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await res.json()
        if (data && data.industrialParks) {
          gisStaticLayers = data
        }
      }
    }
  } catch (err) {
    logger.warn('Sử dụng lớp GIS nhúng sẵn:', err)
  }
}

const applyBaseMapLayer = (mode) => {
  activeBaseMap.value = mode
  if (!mapInstance || !window.L) return

  if (baseTileLayer) {
    mapInstance.removeLayer(baseTileLayer)
    baseTileLayer = null
  }
  if (satelliteLabelsLayer) {
    mapInstance.removeLayer(satelliteLabelsLayer)
    satelliteLabelsLayer = null
  }

  baseTileLayer = createBaseTileLayer(window.L, mode, mapInstance, (fallbackLayer) => {
    baseTileLayer = fallbackLayer
  })

  if (mode === 'landuse') {
    // Khi bật chế độ Phân vùng, tự động bật lớp đa giác Khu đất và tải dữ liệu phân vùng
    if (!showLanduseOverlay.value) {
      showLanduseOverlay.value = true
    }
    loadLanduseZonesInView()
  }
}

const syncAdminWmsLayer = () => {
  if (!mapInstance || !window.L) return
  if (showAdminBoundary.value) {
    if (!adminBoundaryWmsLayer) {
      adminBoundaryWmsLayer = createAdminBoundaryWmsLayer(window.L)
    }
    if (adminBoundaryWmsLayer && !mapInstance.hasLayer(adminBoundaryWmsLayer)) {
      adminBoundaryWmsLayer.addTo(mapInstance)
    }
  } else {
    if (adminBoundaryWmsLayer && mapInstance.hasLayer(adminBoundaryWmsLayer)) {
      mapInstance.removeLayer(adminBoundaryWmsLayer)
    }
    if (boundaryLayerGroup) boundaryLayerGroup.clearLayers()
  }
}

const toggleAdminBoundary = () => {
  showAdminBoundary.value = !showAdminBoundary.value
  syncAdminWmsLayer()
  if (showAdminBoundary.value) {
    const code = selectedWard.value || selectedProvince.value
    if (code) showAdministrativeBoundary(code, selectedWard.value ? 14 : 10)
  }
}

const updateImpactCircle = () => {
  if (!mapInstance || !window.L) return
  if (impactCircleInstance) {
    mapInstance.removeLayer(impactCircleInstance)
    impactCircleInstance = null
  }
  if (!showImpactBuffer.value) return

  const nhom = result.value?.nhom || 'Nhóm III'
  const color = NHOM_COLORS[nhom] || '#286B4F'
  const radius = estimatedImpactRadius.value

  impactCircleInstance = window.L.circle([latitude.value, longitude.value], {
    radius,
    color,
    weight: 1.5,
    dashArray: '5, 4',
    fillColor: color,
    fillOpacity: 0.10,
    interactive: false
  }).addTo(mapInstance)
}

const createProjectPinIcon = () => {
  const nhom = result.value?.nhom || 'Nhóm II'
  const color = NHOM_COLORS[nhom] || '#286B4F'
  return window.L.divIcon({
    className: 'custom-gis-pin-icon',
    html: `
      <div class="gis-pin">
        <svg viewBox="0 0 24 36" width="30" height="40">
          <path fill="${color}" stroke="#ffffff" stroke-width="2" d="M12 0C5.38 0 0 5.38 0 12c0 9 12 24 12 24s12-15 12-24c0-6.62-5.38-12-12-12z" filter="drop-shadow(0 3px 6px rgba(0,0,0,0.35))"/>
          <circle cx="12" cy="12" r="4.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38]
  })
}

const initMap = () => {
  if (!window.L) return
  if (mapInstance) {
    mapInstance.remove()
  }

  nextTick(() => {
    mapInstance = window.L.map('mini-map', {
      zoomControl: false
    }).setView([latitude.value, longitude.value], 12)

    window.L.control.zoom({ position: 'bottomright' }).addTo(mapInstance)

    applyBaseMapLayer(activeBaseMap.value)

    boundaryLayerGroup = window.L.layerGroup().addTo(mapInstance)
    syncAdminWmsLayer()
    landuseLayerGroup = window.L.layerGroup().addTo(mapInstance)
    candidateLayerGroup = window.L.layerGroup().addTo(mapInstance)

    markerInstance = window.L.marker([latitude.value, longitude.value], {
      draggable: true,
      icon: createProjectPinIcon()
    }).addTo(mapInstance)

    updateImpactCircle()

    markerInstance.on('dragend', () => {
      const position = markerInstance.getLatLng()
      setCoordinatesAndAnalyze(position.lat, position.lng, true)
    })

    mapInstance.on('click', (e) => {
      const { lat, lng } = e.latlng
      setCoordinatesAndAnalyze(lat, lng, true)
    })

    mapInstance.on('moveend', () => {
      if (showLanduseOverlay.value && mapInstance.getZoom() >= 11) {
        clearTimeout(overpassTimeout)
        overpassTimeout = setTimeout(() => {
          loadLanduseZonesInView()
        }, 650)
      }
    })

    setTimeout(() => {
      if (mapInstance) {
        mapInstance.invalidateSize()
        loadLanduseZonesInView()
      }
    }, 300)

    runSpatialCheck(latitude.value, longitude.value)
  })
}

const setCoordinatesAndAnalyze = (lat, lng, shouldReverseGeocode = false) => {
  const numLat = parseFloat(lat)
  const numLng = parseFloat(lng)
  if (isNaN(numLat) || isNaN(numLng)) return

  latitude.value = Number(numLat.toFixed(6))
  longitude.value = Number(numLng.toFixed(6))
  locationConfirmed.value = true

  if (markerInstance) {
    markerInstance.setLatLng([latitude.value, longitude.value])
  }
  updateImpactCircle()

  if (shouldReverseGeocode) {
    updateFallbackAddress(latitude.value, longitude.value)
    reverseGeocode(latitude.value, longitude.value)
  }

  clearTimeout(spatialTimeout)
  spatialTimeout = setTimeout(() => {
    runSpatialCheck(latitude.value, longitude.value)
  }, 300)
}

const onManualCoordChange = () => {
  const numLat = parseFloat(latitude.value)
  const numLng = parseFloat(longitude.value)
  if (isNaN(numLat) || isNaN(numLng)) return
  if (numLat < 8 || numLat > 24 || numLng < 102 || numLng > 110) return

  locationConfirmed.value = true
  if (mapInstance && markerInstance) {
    markerInstance.setLatLng([numLat, numLng])
    mapInstance.panTo([numLat, numLng])
  }
  updateImpactCircle()
  reverseGeocode(numLat, numLng)
  runSpatialCheck(numLat, numLng)
}

const locateUserGps = () => {
  if (!navigator.geolocation) {
    showFormNotice('Trình duyệt của bạn không hỗ trợ định vị GPS.', 'warning')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      setCoordinatesAndAnalyze(lat, lng, true)
      if (mapInstance) {
        mapInstance.flyTo([lat, lng], 15, { duration: 1.0 })
      }
    },
    () => {
      showFormNotice('Không thể truy cập vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí của trình duyệt.', 'warning')
    }
  )
}

/**
 * Gọi API máy chủ để kiểm tra khoảng cách tới biên giới, bờ biển, khu bảo tồn, nguồn nước, KCN...
 */
const runSpatialCheck = async (lat, lng) => {
  try {
    const res = await fetch(API.CLASSIFY_SPATIAL_CHECK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        excludeProjectId: projectId.value
      })
    })
    if (res.ok) {
      const data = await res.json()
      if (data.spatial) {
        spatialData.value = data.spatial
        const detected = []
        const flags = data.spatial.autoFlags || {}
        for (const [k, isTrue] of Object.entries(flags)) {
          if (isTrue && flagRefsMap[k]) {
            flagRefsMap[k].value = true
            detected.push(k)
          }
        }
        autoDetectedFlags.value = detected
      }
    }
  } catch (err) {
    logger.warn('Lỗi kiểm tra không gian GIS:', err)
  }
}

/**
 * Tải và vẽ các vùng phân khu đất (Khu công nghiệp, Khu dân cư, Khu thương mại, Rừng/Cây xanh) trong khung nhìn bản đồ
 */
const loadLanduseZonesInView = async () => {
  if (!mapInstance || !landuseLayerGroup || !window.L) return
  if (!showLanduseOverlay.value) {
    landuseLayerGroup.clearLayers()
    landuseZonesCount.value = 0
    return
  }

  const zoom = mapInstance.getZoom()
  const bounds = mapInstance.getBounds()
  const south = bounds.getSouth()
  const west = bounds.getWest()
  const north = bounds.getNorth()
  const east = bounds.getEast()

  // Luôn vẽ các vòng tròn KCN & Vùng nhạy cảm từ CSDL tĩnh trong phạm vi khung nhìn
  landuseLayerGroup.clearLayers()
  let count = 0

  if (gisStaticLayers) {
    for (const kcnItem of (gisStaticLayers.industrialParks || [])) {
      if (kcnItem.lat >= south - 0.15 && kcnItem.lat <= north + 0.15 && kcnItem.lng >= west - 0.15 && kcnItem.lng <= east + 0.15) {
        const circle = window.L.circle([kcnItem.lat, kcnItem.lng], {
          radius: kcnItem.radiusKm * 1000,
          color: '#7C3AED',
          weight: 1.8,
          dashArray: '4, 4',
          fillColor: '#8B5CF6',
          fillOpacity: 0.18
        })
        circle.bindTooltip(`<strong>${kcnItem.name}</strong><br/><span>Click để chọn KCN này</span>`, { sticky: true })
        circle.on('click', (ev) => {
          window.L.DomEvent.stopPropagation(ev)
          selectLanduseZone({
            name: kcnItem.name,
            type: 'industrial',
            typeLabel: 'Khu công nghiệp (Đã có ĐTM)',
            lat: ev.latlng.lat,
            lng: ev.latlng.lng
          })
        })
        landuseLayerGroup.addLayer(circle)
        count++
      }
    }

    for (const sz of (gisStaticLayers.sensitiveZones || [])) {
      if (sz.lat >= south - 0.25 && sz.lat <= north + 0.25 && sz.lng >= west - 0.25 && sz.lng <= east + 0.25) {
        const circle = window.L.circle([sz.lat, sz.lng], {
          radius: sz.radiusKm * 1000,
          color: '#D65B5B',
          weight: 1.5,
          dashArray: '6, 4',
          fillColor: '#D65B5B',
          fillOpacity: 0.12
        })
        circle.bindTooltip(`<strong>Vùng nhạy cảm: ${sz.name}</strong><br/><span>Bán kính bảo vệ: ${sz.radiusKm} km (${sz.ref})</span>`, { sticky: true })
        landuseLayerGroup.addLayer(circle)
      }
    }
  }

  // Nếu zoom >= 11, truy vấn thêm đa giác phân vùng thực tế từ Overpass API (KCN, Khu dân cư, Khu thương mại, Rừng, Nông nghiệp)
  if (zoom < 12) {
    landuseZonesCount.value = count
    return
  }

  // Giới hạn kích thước vùng truy vấn Overpass tối đa ±0.08 độ (~8km quanh tâm màn hình) để luôn trả về đa giác nhanh dưới 1 giây
  const center = mapInstance.getCenter()
  const qSouth = Math.max(south, center.lat - 0.08)
  const qNorth = Math.min(north, center.lat + 0.08)
  const qWest = Math.max(west, center.lng - 0.08)
  const qEast = Math.min(east, center.lng + 0.08)

  isLoadingLanduse.value = true
  try {
    const bboxStr = `${qSouth.toFixed(4)},${qWest.toFixed(4)},${qNorth.toFixed(4)},${qEast.toFixed(4)}`
    const query = `[out:json][timeout:8];(way["landuse"~"^(industrial|residential|commercial|retail|forest|farmland)$"](${bboxStr}););out geom qt 70;`
    const res = await fetch(`${OVERPASS_URL}?data=${encodeURIComponent(query)}`)
    if (res.ok) {
      const data = await res.json()
      const elements = data.elements || []
      for (const el of elements) {
        if (!el.geometry || el.geometry.length < 3) continue
        const luType = el.tags?.landuse || 'residential'
        const styleCfg = LANDUSE_STYLES[luType] || LANDUSE_STYLES.residential
        const zoneName = el.tags?.name || el.tags?.['name:vi'] || styleCfg.label
        const coords = el.geometry.map(pt => [pt.lat, pt.lon])

        const poly = window.L.polygon(coords, {
          color: styleCfg.color,
          weight: 1.6,
          fillColor: styleCfg.fillColor,
          fillOpacity: styleCfg.fillOpacity
        })

        poly.bindTooltip(
          `<div style="font-family:'Be Vietnam Pro',sans-serif;font-size:12px">
            <strong style="color:${styleCfg.color}">${zoneName}</strong><br/>
            <span style="color:#526158">Phân vùng: ${styleCfg.label} — Click để đặt dự án tại đây</span>
          </div>`,
          { sticky: true }
        )

        poly.on('click', (ev) => {
          window.L.DomEvent.stopPropagation(ev)
          selectLanduseZone({
            name: zoneName,
            type: luType,
            typeLabel: styleCfg.label,
            lat: ev.latlng.lat,
            lng: ev.latlng.lng
          })
        })

        landuseLayerGroup.addLayer(poly)
        count++
      }
    }
  } catch (err) {
    logger.warn('Overpass landuse query bỏ qua:', err.message)
  } finally {
    isLoadingLanduse.value = false
    landuseZonesCount.value = count
  }
}

const selectLanduseZone = (zone) => {
  selectedZoneInfo.value = zone
  setCoordinatesAndAnalyze(zone.lat, zone.lng, false)

  // Tự động cập nhật địa chỉ hiển thị kèm tên phân khu/KCN
  const suffix = [phuongXa.value, tinh.value].filter(Boolean).join(', ')
  if (zone.name && !zone.name.startsWith('Khu dân cư /') && !zone.name.startsWith('Khu công nghiệp /')) {
    diaChiHienThi.value = suffix ? `${zone.name}, ${suffix}` : zone.name
  } else {
    reverseGeocode(zone.lat, zone.lng)
  }

  // Nếu chọn vùng Khu công nghiệp -> tự động tích cờ KCN
  if (zone.type === 'industrial') {
    kcn.value = true
    if (!autoDetectedFlags.value.includes('kcn')) {
      autoDetectedFlags.value.push('kcn')
    }
  } else if (zone.type === 'forest') {
    rung.value = true
    if (!autoDetectedFlags.value.includes('rung')) {
      autoDetectedFlags.value.push('rung')
    }
  }
}

const toggleLanduseOverlay = () => {
  showLanduseOverlay.value = !showLanduseOverlay.value
  if (showLanduseOverlay.value) {
    loadLanduseZonesInView()
  } else if (landuseLayerGroup) {
    landuseLayerGroup.clearLayers()
    landuseZonesCount.value = 0
  }
}

const toggleImpactBuffer = () => {
  showImpactBuffer.value = !showImpactBuffer.value
  updateImpactCircle()
}

const updateFallbackAddress = (lat, lng) => {
  if (phuongXa.value && tinh.value) {
    diaChiHienThi.value = `${phuongXa.value}, ${tinh.value}`
  } else if (tinh.value) {
    diaChiHienThi.value = tinh.value
  } else if (phuongXa.value) {
    diaChiHienThi.value = phuongXa.value
  } else if (!diaChiHienThi.value && lat && lng) {
    diaChiHienThi.value = `Tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
}

/**
 * Tính khoảng cách địa lý theo công thức Haversine, đơn vị km
 */
const haversineDistKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Chuẩn hóa tên đơn vị hành chính để so sánh không dấu và bỏ tiền tố
 */
const normalizeAdminName = (str) => {
  if (!str) return ''
  return normalizeString(str)
    .replace(/^(thanh pho|tinh|tp\.|tp)\s+/i, '')
    .replace(/^(quan|huyen|thi xa|thanh pho)\s+/i, '')
    .replace(/^(phuong|xa|thi tran)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const checkMarkerBoundaryDiscrepancy = async (lat, lng) => {
  const requestId = ++locationRequestSequence
  try {
    const response = await fetch(`${API.CLASSIFY_ADMIN_LOCATE}?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`)
    if (!response.ok) throw new Error(`HTTP_${response.status}`)
    const { result } = await response.json()
    if (requestId !== locationRequestSequence) return null
    if (!result) {
      administrativeLookupMessage.value = 'Chưa xác định được phường/xã tại vị trí ghim.'
      return null
    }
    administrativeLookupMessage.value = ''
    const detected = {
      province: result.province.name,
      provinceCode: result.province.code,
      ward: result.unit.name,
      wardCode: result.unit.code,
      district: '', lat, lng,
    }
    if (!initialLocation.value || (!initialLocation.value.provinceCode && !initialLocation.value.wardCode)) {
      if (detected.wardCode && showAdminBoundary.value) {
        showAdministrativeBoundary(detected.wardCode, 14)
      }
      return detected
    }
    const mismatch = (initialLocation.value.provinceCode && String(initialLocation.value.provinceCode) !== String(detected.provinceCode)) ||
      (initialLocation.value.wardCode && String(initialLocation.value.wardCode) !== String(detected.wardCode))
    if (mismatch) {
      locationMismatchWarning.value = {
        title: 'Vị trí ghim đang nằm ngoài đơn vị hành chính đã chọn',
        initial: { ...initialLocation.value, province: initialLocation.value.province || 'Chưa xác định', ward: initialLocation.value.ward || '(Chưa chọn phường/xã)' },
        newLocation: detected,
      }
    } else locationMismatchWarning.value = null
    return detected
  } catch (error) {
    if (requestId === locationRequestSequence) administrativeLookupMessage.value = 'Không thể xác minh phường/xã từ dịch vụ bản đồ; hệ thống giữ nguyên tọa độ ghim.'
    logger.warn('Không thể tra cứu đơn vị hành chính từ tọa độ:', error)
    return null
  }
}

/**
 * Cập nhật vị trí hồ sơ và các dropdowns theo vị trí mới của marker
 */
const applyNewMarkerLocation = () => {
  if (!locationMismatchWarning.value) return
  const { newLocation } = locationMismatchWarning.value

  if (newLocation.province) {
    tinh.value = newLocation.province
    if (newLocation.provinceCode) {
      selectedProvince.value = newLocation.provinceCode
    } else {
      const cleanP = normalizeAdminName(newLocation.province)
      const p = (divisions.value || []).find(d => normalizeAdminName(d.name) === cleanP)
      if (p) selectedProvince.value = p.code
    }
  }

  nextTick(() => {
    if (newLocation.ward) {
      phuongXa.value = newLocation.ward
      if (newLocation.district) {
        quanHuyen.value = newLocation.district
      }
      if (newLocation.wardCode) {
        selectedWard.value = newLocation.wardCode
      } else {
        const cleanW = normalizeAdminName(newLocation.ward)
        const matched = wardList.value.find(w => normalizeAdminName(w.wardName || w.name) === cleanW)
        if (matched) {
          selectedWard.value = matched.code
          phuongXa.value = matched.wardName || matched.name
          if (matched.districtName) quanHuyen.value = matched.districtName
        } else {
          selectedWard.value = newLocation.ward
        }
      }
    }

    initialLocation.value = {
      province: tinh.value || newLocation.province,
      provinceCode: selectedProvince.value,
      ward: phuongXa.value || newLocation.ward,
      wardCode: selectedWard.value,
      district: quanHuyen.value || newLocation.district,
      lat: newLocation.lat,
      lng: newLocation.lng
    }

    diaChiHienThi.value = quanHuyen.value
      ? `${phuongXa.value}, ${quanHuyen.value}, ${tinh.value}`
      : `${phuongXa.value}, ${tinh.value}`

    locationMismatchWarning.value = null
    if (selectedWard.value && showAdminBoundary.value) {
      showAdministrativeBoundary(selectedWard.value, 14)
    } else if (selectedProvince.value && showAdminBoundary.value) {
      showAdministrativeBoundary(selectedProvince.value, 10)
    }
  })
}

/**
 * Đưa marker và bản đồ quay lại vị trí ban đầu
 */
const revertToInitialLocation = () => {
  if (!initialLocation.value || initialLocation.value.lat == null) {
    locationMismatchWarning.value = null
    return
  }
  const origLat = initialLocation.value.lat
  const origLng = initialLocation.value.lng

  latitude.value = origLat
  longitude.value = origLng

  if (markerInstance) {
    markerInstance.setLatLng([origLat, origLng])
  }
  if (mapInstance) {
    mapInstance.panTo([origLat, origLng])
  }
  updateImpactCircle()
  runSpatialCheck(origLat, origLng)

  locationMismatchWarning.value = null
}

const reverseGeocode = async (lat, lng) => {
  const requestId = ++reverseGeocodeSequence
  try {
    const located = await checkMarkerBoundaryDiscrepancy(lat, lng)
    if (requestId !== reverseGeocodeSequence) return
    if (located && !initialLocation.value?.provinceCode && !initialLocation.value?.wardCode) {
      selectedProvince.value = located.provinceCode
      selectedWard.value = located.wardCode
      tinh.value = located.province
      phuongXa.value = located.ward
      quanHuyen.value = ''
      initialLocation.value = {
        province: located.province, provinceCode: located.provinceCode,
        ward: located.ward, wardCode: located.wardCode, district: '', lat, lng,
      }
    }
    const res = await fetch(`${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`)
    if (res.ok) {
      const data = await res.json()
      if (requestId !== reverseGeocodeSequence) return
      const address = data.address || {}
      const road = address.industrial || address.commercial || address.amenity || address.building || address.road || address.pedestrian || address.street || ''

      // Tự động nhận diện nếu reverse geocode trúng Khu công nghiệp
      if (address.industrial || (data.display_name && normalizeString(data.display_name).includes('khu cong nghiep'))) {
        kcn.value = true
        if (!autoDetectedFlags.value.includes('kcn')) {
          autoDetectedFlags.value.push('kcn')
        }
      }

      const parts = []
      if (road) parts.push(road)
      if (located?.ward || phuongXa.value) parts.push(located?.ward || phuongXa.value)
      if (located?.province || tinh.value) parts.push(located?.province || tinh.value)

      if (parts.length > 0) {
        diaChiHienThi.value = parts.join(', ')
      } else {
        diaChiHienThi.value = `Tọa độ: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
      }
    } else {
      diaChiHienThi.value = located
        ? `${located.ward}, ${located.province}`
        : `Tọa độ: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
    }
  } catch (err) {
    if (requestId !== reverseGeocodeSequence) return
    logger.error('Lỗi reverse geocoding:', err)
    diaChiHienThi.value = `Tọa độ: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
  }
}

const findMatchingProvince = (provName) => {
  const cleanName = normalizeString(provName)
    .replace('tinh ', '').replace('thanh pho ', '').replace('tp. ', '')

  for (const region in provinces) {
    for (const p of provinces[region]) {
      const cleanP = normalizeString(p.value).replace('tp. ', '')
      if (cleanName.includes(cleanP) || cleanP.includes(cleanName)) {
        return p.value
      }
    }
  }
  return null
}

const {
  industriesCatalog,
  metadataRuleSource,
  metadataFallbackReason,
  capacityLabel,
  availableProcessStages,
  groupedIndustryOptions,
  industrySelectOptions,
  fetchClassificationMetadata
} = useClassificationCatalog({ industry: nganh, processStage, isLoadingSavedProject })

const buildClassifyFormData = () => {
  const parsedCap = (capacity.value === '' || capacity.value === null || capacity.value === undefined)
    ? null
    : Number(capacity.value)
  return {
    projectId: projectId.value || null,
    nganh: nganh.value,
    processStage: processStage.value || null,
    evaluationDate: evaluationDate.value || new Date().toISOString().slice(0, 10),
    capacity: (parsedCap !== null && !Number.isNaN(parsedCap)) ? parsedCap : null,
    nt: parseFloat(nt.value) || 0,
    kt: parseFloat(kt.value) || 0,
    tinh: tinh.value,
    latitude: latitude.value,
    longitude: longitude.value,
    rung: rung.value,
    lua: lua.value,
    bg: bg.value,
    bao_ton: bao_ton.value,
    di_san: di_san.value,
    ven_bien: ven_bien.value,
    nguon_nc: nguon_nc.value,
    dat_ngap: dat_ngap.value,
    kcn: kcn.value,
    phanky: phanky.value,
    morongdt: morongdt.value,
    ctnh: ctnh.value,
    dtcong: dtcong.value,
    epr: epr.value,
    insideCoreProtectedZone: insideCoreProtectedZone.value,
    paddyConversionAreaHa: parseFloat(paddyConversionAreaHa.value) || 0,
    forestConversionAreaHa: parseFloat(forestConversionAreaHa.value) || 0,
    sensitiveEvidenceRef: sensitiveEvidenceRef.value || '',
    sensitiveDetails: {
      insideCoreProtectedZone: insideCoreProtectedZone.value,
      paddyConversionAreaHa: parseFloat(paddyConversionAreaHa.value) || 0,
      forestConversionAreaHa: parseFloat(forestConversionAreaHa.value) || 0,
      evidenceRef: sensitiveEvidenceRef.value || ''
    }
  }
}

const handleClassify = async (shouldSave = true) => {
  if (shouldSave) {
    formNotice.value = null
    if (!name.value || !name.value.trim()) { showFormNotice('Vui lòng nhập tên dự án!'); return }
    if (!nganh.value) { showFormNotice('Vui lòng chọn loại hình dự án!'); return }
    if (availableProcessStages.value.length > 0 && !processStage.value) {
      showFormNotice('Ngành nghề này bắt buộc phải chọn công đoạn sản xuất hoặc loại nhiên liệu áp dụng!')
      return
    }
    const parsedCap = (capacity.value === '' || capacity.value === null || capacity.value === undefined)
      ? NaN
      : Number(capacity.value)
    if (Number.isNaN(parsedCap) || parsedCap < 0) { showFormNotice('Vui lòng nhập quy mô / công suất hợp lệ (>= 0)!'); return }
    if (!tinh.value && !selectedProvince.value) { showFormNotice('Vui lòng chọn Tỉnh / Thành phố hoặc chấm vị trí trên bản đồ!'); return }
  } else {
    if (!nganh.value) return
  }

  const formData = buildClassifyFormData()

  try {
    const res = await fetch(API.CLASSIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })

    if (res.ok) {
      const data = await res.json()
      if (data.result) {
        result.value = data.result
        if (data.result.spatialAnalysis) {
          spatialData.value = {
            ...spatialData.value,
            ...data.result.spatialAnalysis
          }
        }
        classificationSnapshot.value = data.result
        if (markerInstance && window.L) {
          markerInstance.setIcon(createProjectPinIcon())
        }
        updateImpactCircle()
      }
    }
  } catch (err) {
    logger.error('Lỗi khi gọi API phân loại từ backend:', err)
  }

  if (shouldSave) {
    saveProjectToServer(formData)
  }
}

const saveProjectToServer = async (formData) => {
  try {
    const finalFormData = {
      ...formData,
      latitude: latitude.value,
      longitude: longitude.value
    }

    const res = await fetch(API.PROJECTS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: projectId.value,
        name: name.value,
        form_data: finalFormData,
        checklist_state: checklistState.value,
        latitude: latitude.value,
        longitude: longitude.value,
        dia_chi_hien_thi: diaChiHienThi.value || `${phuongXa.value ? phuongXa.value + ', ' : ''}${tinh.value}`,
        quan_huyen: quanHuyen.value || null,
        phuong_xa: phuongXa.value || null
      })
    })

    if (res.ok) {
      const data = await res.json()
      projectId.value = data.project.id
      if (data.sensitiveVerification !== undefined) {
        serverSensitiveVerification.value = data.sensitiveVerification
        adminSensitiveEvidence.value = data.sensitiveVerification?.evidence_ref || sensitiveEvidenceRef.value || ''
        adminSensitiveNote.value = data.sensitiveVerification?.verification_note || ''
      }
      if (data.project.classification_result) {
        result.value = data.project.classification_result
        classificationSnapshot.value = data.project.classification_result
      }
      fetchProjects(currentPage.value)
      fetchProjectReminders(data.project.id)
      showFormNotice(`Đã lưu dự án "${data.project.name || name.value}" thành công.`, 'success')
    } else {
      const errData = await res.json().catch(() => ({}))
      showFormNotice(errData.error || 'Không thể lưu dự án vào cơ sở dữ liệu.', 'error')
    }
  } catch (err) {
    logger.error('Lỗi lưu dự án:', err)
    showFormNotice('Lỗi kết nối khi lưu dự án.', 'error')
  }
}

const fetchProjectSensitiveVerification = async (projId) => {
  if (!projId) return
  try {
    const res = await fetch(`${API.PROJECTS}/${projId}`)
    if (res.ok) {
      const data = await res.json()
      if (data.sensitiveVerification !== undefined) {
        serverSensitiveVerification.value = data.sensitiveVerification
        adminSensitiveEvidence.value = data.sensitiveVerification?.evidence_ref || sensitiveEvidenceRef.value || ''
        adminSensitiveNote.value = data.sensitiveVerification?.verification_note || ''
      }
    }
  } catch (err) {
    logger.error('Lỗi tải trạng thái xác minh vùng nhạy cảm:', err)
  }
}

const submitAdminSensitiveVerification = async (verificationStatus) => {
  if (!projectId.value) {
    showFormNotice('Vui lòng lưu dự án trước khi xác minh yếu tố nhạy cảm.', 'warning')
    return
  }
  isUpdatingSensitiveVerification.value = true
  sensitiveVerificationMessage.value = ''
  try {
    const res = await fetch(projectSensitiveVerification(projectId.value), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verification_status: verificationStatus,
        evidence_ref: adminSensitiveEvidence.value || sensitiveEvidenceRef.value || '',
        verification_note: adminSensitiveNote.value || ''
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      sensitiveVerificationMessage.value = data.error || 'Không thể cập nhật xác minh vùng nhạy cảm.'
      return
    }
    serverSensitiveVerification.value = data.sensitiveVerification || null
    if (data.classification) {
      result.value = data.classification
      classificationSnapshot.value = data.classification
    }
    sensitiveVerificationMessage.value = data.message || `Đã cập nhật trạng thái: ${getSensitiveStatusLabel(verificationStatus)}`
    fetchProjects(currentPage.value)
  } catch (err) {
    sensitiveVerificationMessage.value = err.message || 'Lỗi kết nối máy chủ.'
  } finally {
    isUpdatingSensitiveVerification.value = false
  }
}

const selectProject = (project, extraSensitiveVerification = null) => {
  if (!project) return
  isLoadingSavedProject.value = true
  projectId.value = project.id
  name.value = project.name || ''

  const fd = project.form_data || {}
  const rawNganh = fd.nganh || ''
  nganh.value = rawNganh === 'san_bay' ? 'cang_hang_khong' : rawNganh
  processStage.value = fd.processStage || ''
  evaluationDate.value = fd.evaluationDate || new Date().toISOString().slice(0, 10)
  capacity.value = (fd.capacity !== undefined && fd.capacity !== null) ? fd.capacity : (fd.cap || 0)
  nt.value = fd.nt || 0
  kt.value = fd.kt || 0
  tinh.value = fd.tinh || ''

  rung.value = !!fd.rung
  lua.value = !!fd.lua
  bg.value = !!fd.bg
  bao_ton.value = !!fd.bao_ton
  di_san.value = !!fd.di_san
  ven_bien.value = !!fd.ven_bien
  nguon_nc.value = !!fd.nguon_nc
  dat_ngap.value = !!fd.dat_ngap
  kcn.value = !!fd.kcn
  phanky.value = !!fd.phanky
  morongdt.value = !!fd.morongdt
  ctnh.value = !!fd.ctnh
  dtcong.value = !!fd.dtcong
  epr.value = !!fd.epr

  const sDetails = fd.sensitiveDetails || {}
  insideCoreProtectedZone.value = !!(fd.insideCoreProtectedZone || sDetails.insideCoreProtectedZone)
  paddyConversionAreaHa.value = Number(fd.paddyConversionAreaHa ?? sDetails.paddyConversionAreaHa ?? 0) || 0
  forestConversionAreaHa.value = Number(fd.forestConversionAreaHa ?? sDetails.forestConversionAreaHa ?? 0) || 0
  sensitiveEvidenceRef.value = fd.sensitiveEvidenceRef || sDetails.evidenceRef || ''
  serverSensitiveVerification.value = extraSensitiveVerification || project.sensitiveVerification || null
  adminSensitiveEvidence.value = serverSensitiveVerification.value?.evidence_ref || sensitiveEvidenceRef.value || ''
  adminSensitiveNote.value = serverSensitiveVerification.value?.verification_note || ''
  sensitiveVerificationMessage.value = ''

  if (!extraSensitiveVerification && project.id) {
    fetchProjectSensitiveVerification(project.id)
  }

  latitude.value = project.latitude ? parseFloat(project.latitude) : (fd.latitude ? parseFloat(fd.latitude) : DEFAULT_LAT)
  longitude.value = project.longitude ? parseFloat(project.longitude) : (fd.longitude ? parseFloat(fd.longitude) : DEFAULT_LNG)
  diaChiHienThi.value = project.dia_chi_hien_thi || ''
  quanHuyen.value = project.quan_huyen || ''
  phuongXa.value = project.phuong_xa || ''
  classificationSnapshot.value = project.classification_result || null
  locationConfirmed.value = !!(project.latitude || fd.latitude)

  const resolveProvince = () => {
    if (!tinh.value) return
    const oldName = normalizeAdminName(tinh.value)
    const prov = (divisions.value || []).find(p => normalizeAdminName(p.name) === oldName ||
      (p.alias || '').split(/[,;]|\s+và\s+/i).some(alias => normalizeAdminName(alias) === oldName))
    if (!prov) return

    selectedProvince.value = prov.code
    tinh.value = prov.name
    initialLocation.value.provinceCode = prov.code
    initialLocation.value.province = prov.name

    let matchedWard = null
    if (phuongXa.value) {
      const oldWard = normalizeAdminName(phuongXa.value)
      matchedWard = (prov.wards || []).find(unit => normalizeAdminName(unit.name) === oldWard ||
        (unit.alias || '').split(/[,;]+/).some(alias => normalizeAdminName(alias) === oldWard))
    }

    nextTick(() => {
      if (matchedWard) {
        selectedWard.value = matchedWard.code
        phuongXa.value = matchedWard.name
        initialLocation.value.wardCode = matchedWard.code
        initialLocation.value.ward = matchedWard.name
      }
      if (mapInstance && showAdminBoundary.value) {
        const boundaryCode = matchedWard?.code || prov.code
        if (boundaryCode) {
          showAdministrativeBoundary(boundaryCode, matchedWard ? 14 : 10).then((bounds) => {
            if (bounds && (!project.latitude && !fd.latitude)) {
              moveMarkerToBoundaryCenterIfOutside(bounds)
            }
          })
        }
      }
    })
  }

  checklistState.value = project.checklist_state || {}

  initialLocation.value = {
    province: tinh.value || '',
    provinceCode: selectedProvince.value || null,
    ward: phuongXa.value || '',
    wardCode: selectedWard.value || null,
    district: quanHuyen.value || '',
    lat: latitude.value,
    lng: longitude.value
  }
  locationMismatchWarning.value = null

  if (mapInstance && markerInstance) {
    const latLng = [latitude.value, longitude.value]
    mapInstance.setView(latLng, 14)
    markerInstance.setLatLng(latLng)
  }

  if (!divisions.value.length) {
    loadDivisions().then(resolveProvince)
  } else {
    resolveProvince()
  }

  handleClassify(false)
  runSpatialCheck(latitude.value, longitude.value)
  fetchQcvnHistory(project.id)
  fetchProjectReminders(project.id)
  nextTick(() => {
    isLoadingSavedProject.value = false
  })
}

const createNewProject = () => {
  projectId.value = null
  projectReminders.value = []
  showAddReminderForm.value = false
  reminderMsg.value = ''
  name.value = ''
  nganh.value = ''
  processStage.value = ''
  evaluationDate.value = new Date().toISOString().slice(0, 10)
  capacity.value = 0
  nt.value = 0
  kt.value = 0
  tinh.value = ''

  rung.value = false
  lua.value = false
  bg.value = false
  bao_ton.value = false
  di_san.value = false
  ven_bien.value = false
  nguon_nc.value = false
  dat_ngap.value = false
  kcn.value = false
  phanky.value = false
  morongdt.value = false
  ctnh.value = false
  dtcong.value = false
  epr.value = false
  insideCoreProtectedZone.value = false
  paddyConversionAreaHa.value = 0
  forestConversionAreaHa.value = 0
  sensitiveEvidenceRef.value = ''
  serverSensitiveVerification.value = null

  initialLocation.value = {
    province: '',
    provinceCode: null,
    ward: '',
    wardCode: null,
    district: '',
    lat: null,
    lng: null
  }
  locationMismatchWarning.value = null
  adminSensitiveEvidence.value = ''
  adminSensitiveNote.value = ''
  sensitiveVerificationMessage.value = ''

  latitude.value = DEFAULT_LAT
  longitude.value = DEFAULT_LNG
  diaChiHienThi.value = ''
  quanHuyen.value = ''
  phuongXa.value = ''
  locationConfirmed.value = false
  classificationSnapshot.value = null
  selectedProvince.value = null
  selectedWard.value = null
  addressSearch.value = ''
  addressResults.value = []
  selectedZoneInfo.value = null
  autoDetectedFlags.value = []
  currentViewbox.value = null

  checklistState.value = {}
  result.value = null

  if (boundaryLayerGroup) boundaryLayerGroup.clearLayers()
  if (candidateLayerGroup) candidateLayerGroup.clearLayers()

  if (mapInstance && markerInstance) {
    const latLng = [latitude.value, longitude.value]
    mapInstance.setView(latLng, 11)
    markerInstance.setLatLng(latLng)
    updateImpactCircle()
  }

  qcvnHistory.value = []
}

const handleDeleteProject = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa dự án này?')) return
  try {
    const res = await fetch(`${API.PROJECTS}/${id}`, { method: 'DELETE' })
    if (res.ok) {
      if (projectId.value === id) {
        createNewProject()
      }
      fetchProjects(currentPage.value)
      fetchProjectReminders(data.project.id)
    }
  } catch (err) {
    logger.error('Lỗi khi xóa dự án:', err)
  }
}

const toggleChecklistItem = (itemIndex) => {
  checklistState.value[itemIndex] = !checklistState.value[itemIndex]
  if (projectId.value) {
    const formData = buildClassifyFormData()
    saveProjectToServer(formData)
  }
}

const exportOfficialReport = () => {
  if (!result.value || !result.value.canExportOfficialReport) {
    showFormNotice('Không thể xuất báo cáo kết luận chính thức khi quy định chưa hoàn tất xác minh pháp lý hoặc dữ liệu đầu vào chưa đầy đủ.', 'warning')
    return
  }
  window.print()
}

const progressPercent = computed(() => {
  if (!result.value || !result.value.cl) return 0
  const total = (result.value.cl.bat_buoc?.length || 0) + (result.value.cl.bo_sung?.length || 0)
  if (total === 0) return 0
  const checkedCount = Object.keys(checklistState.value).filter(key => {
    return checklistState.value[key] && parseInt(key) < total
  }).length
  return Math.round((checkedCount / total) * 100)
})

const checkedTotalCount = computed(() => {
  if (!result.value || !result.value.cl) return 0
  const total = (result.value.cl.bat_buoc?.length || 0) + (result.value.cl.bo_sung?.length || 0)
  return Object.keys(checklistState.value).filter(key => {
    return checklistState.value[key] && parseInt(key) < total
  }).length
})

const totalDocsCount = computed(() => {
  if (!result.value || !result.value.cl) return 0
  return (result.value.cl.bat_buoc?.length || 0) + (result.value.cl.bo_sung?.length || 0)
})

const projectReminders = ref([])
const loadingReminders = ref(false)
const showAddReminderForm = ref(false)
const reminderMsg = ref('')
const reminderSubmitting = ref(false)
const reminderForm = ref({
  tieu_de: '',
  han_nop: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  chu_ky: 'hang_nam',
  so_ngay_nhac_truoc: 30,
  can_cu_phap_ly: ''
})

const getReminderBadgeMeta = (level) => {
  return REMINDER_ALERT_META[level] || REMINDER_ALERT_META.trong_han
}

const fetchProjectReminders = async (pid) => {
  if (!pid) {
    projectReminders.value = []
    return
  }
  loadingReminders.value = true
  try {
    const res = await fetch(`${API.REMINDERS}?project_id=${encodeURIComponent(pid)}`)
    if (!res.ok) return
    const data = await res.json()
    projectReminders.value = data.items || []
  } catch (err) {
    logger.error('Lỗi tải lịch nhắc hạn dự án:', err)
  } finally {
    loadingReminders.value = false
  }
}

const syncDefaultReminders = async () => {
  if (!projectId.value) return
  reminderSubmitting.value = true
  reminderMsg.value = ''
  try {
    const res = await fetch(projectRemindersSync(projectId.value), { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Không thể khởi tạo nghĩa vụ mặc định')
    reminderMsg.value = data.message || 'Đã cập nhật lịch nghĩa vụ.'
    await fetchProjectReminders(projectId.value)
  } catch (err) {
    reminderMsg.value = err.message || 'Lỗi khởi tạo nghĩa vụ mặc định.'
  } finally {
    reminderSubmitting.value = false
  }
}

const submitNewReminder = async () => {
  if (!projectId.value) return
  reminderSubmitting.value = true
  reminderMsg.value = ''
  try {
    const res = await fetch(API.REMINDERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId.value,
        ...reminderForm.value
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Không thể thêm mốc nhắc hạn')
    reminderMsg.value = data.message || 'Đã thêm mốc nhắc hạn mới.'
    showAddReminderForm.value = false
    reminderForm.value.tieu_de = ''
    reminderForm.value.can_cu_phap_ly = ''
    await fetchProjectReminders(projectId.value)
  } catch (err) {
    reminderMsg.value = err.message || 'Lỗi khi lưu mốc nhắc hạn.'
  } finally {
    reminderSubmitting.value = false
  }
}

const completeProjectReminder = async (item) => {
  if (!item?.id) return
  reminderSubmitting.value = true
  reminderMsg.value = ''
  try {
    const res = await fetch(reminderComplete(item.id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tao_ky_tiep_theo: true })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Không thể cập nhật nghĩa vụ')
    reminderMsg.value = data.message || 'Đã hoàn thành nghĩa vụ.'
    await fetchProjectReminders(projectId.value)
  } catch (err) {
    reminderMsg.value = err.message || 'Lỗi cập nhật trạng thái.'
  } finally {
    reminderSubmitting.value = false
  }
}

const deleteProjectReminder = async (item) => {
  if (!item?.id) return
  reminderSubmitting.value = true
  reminderMsg.value = ''
  try {
    const res = await fetch(reminderById(item.id), { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Không thể xóa mốc nhắc hạn')
    reminderMsg.value = data.message || 'Đã xóa mốc nhắc hạn.'
    await fetchProjectReminders(projectId.value)
  } catch (err) {
    reminderMsg.value = err.message || 'Lỗi khi xóa mốc nhắc hạn.'
  } finally {
    reminderSubmitting.value = false
  }
}

const getAddressCategoryLabel = (item) => {
  const cls = item.class || item.category || ''
  const type = item.type || ''
  if (cls === 'landuse' && type === 'industrial') return { text: 'Khu công nghiệp', color: '#7C3AED', bg: '#F3E8FF' }
  if (cls === 'landuse' && type === 'residential') return { text: 'Khu dân cư', color: '#2563EB', bg: '#EFF6FF' }
  if (cls === 'boundary' || type === 'administrative') return { text: 'Ranh giới vùng', color: '#286B4F', bg: '#EAF3ED' }
  if (cls === 'highway') return { text: 'Tuyến đường', color: '#D97706', bg: '#FCF6EC' }
  if (cls === 'building' || cls === 'Office' || cls === 'industrial') return { text: 'Cơ sở / Nhà máy', color: '#7C3AED', bg: '#F3E8FF' }
  return { text: 'Địa điểm', color: '#526158', bg: '#F0F4F1' }
}

/**
 * Tìm kiếm địa chỉ cụ thể có lọc theo Tỉnh/Phường đã chọn + Hiển thị các điểm/vùng ứng viên trên Bản đồ
 */
const searchAddress = () => {
  clearTimeout(searchTimeout)
  if (!addressSearch.value || addressSearch.value.trim().length < 2) {
    addressResults.value = []
    if (candidateLayerGroup) candidateLayerGroup.clearLayers()
    return
  }

  searchTimeout = setTimeout(async () => {
    isSearchingAddress.value = true
    try {
      const rawKeyword = addressSearch.value.trim()
      const provObj = (divisions.value || []).find(p => String(p.code) === String(selectedProvince.value))
      const provName = provObj ? provObj.name : tinh.value
      const wardName = phuongXa.value

      // 1. Lọc nhanh các KCN nội bộ khớp từ khóa và Tỉnh/TP
      const localMatches = []
      if (gisStaticLayers?.industrialParks) {
        const cleanQ = normalizeString(rawKeyword)
        for (const kcnItem of gisStaticLayers.industrialParks) {
          const matchText = normalizeString(kcnItem.name + ' ' + kcnItem.province).includes(cleanQ)
          const matchProv = !provName || normalizeString(kcnItem.province).includes(normalizeString(tinh.value || provName))
          if (matchText && matchProv) {
            localMatches.push({
              display_name: `${kcnItem.name}, ${kcnItem.province}`,
              lat: String(kcnItem.lat),
              lon: String(kcnItem.lng),
              class: 'landuse',
              type: 'industrial',
              isLocalKcn: true,
              radiusKm: kcnItem.radiusKm
            })
          }
        }
      }

      // 2. Truy vấn Nominatim ưu tiên trong phạm vi Phường/Xã + Tỉnh/TP đã chọn
      let scopedQuery = rawKeyword
      if (wardName && !normalizeString(rawKeyword).includes(normalizeString(wardName))) {
        scopedQuery += `, ${wardName}`
      }
      if (provName && !normalizeString(rawKeyword).includes(normalizeString(provName))) {
        scopedQuery += `, ${provName}`
      }

      let url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(scopedQuery)}&format=jsonv2&countrycodes=vn&limit=6&addressdetails=1&polygon_geojson=1&polygon_threshold=0.0005&accept-language=vi`
      if (currentViewbox.value && currentViewbox.value.length === 4) {
        const [west, north, east, south] = currentViewbox.value
        url += `&viewbox=${west},${north},${east},${south}`
      }

      const res = await fetch(url)

      let nominatimList = []
      if (res.ok) {
        nominatimList = await res.json()
      }

  // Nếu truy vấn ghép Phường/Xã quá chặt không có kết quả, tìm lại trong phạm vi Tỉnh/TP
      if (nominatimList.length === 0 && wardName && provName) {
        const cleanProv = provName.replace(/^(Thành phố|Tỉnh)\s+/i, '')
        const fallbackQuery = `${rawKeyword}, ${cleanProv}, Việt Nam`
        const res2 = await fetch(
          `${NOMINATIM_URL}/search?q=${encodeURIComponent(fallbackQuery)}&format=jsonv2&countrycodes=vn&limit=6&addressdetails=1&polygon_geojson=1&polygon_threshold=0.0005&accept-language=vi`
        )
        if (res2.ok) {
          nominatimList = await res2.json()
        }
      }

      const merged = [...localMatches, ...nominatimList].slice(0, 7)
      addressResults.value = merged

      // Vẽ các ứng viên tìm thấy (Marker đánh số 1..N + Vùng Polygon nếu có) trực tiếp lên bản đồ để người dùng chọn!
      renderAddressCandidatesOnMap(merged)
    } catch (err) {
      logger.error('Lỗi tìm kiếm địa chỉ:', err)
    } finally {
      isSearchingAddress.value = false
    }
  }, 550)
}

const renderAddressCandidatesOnMap = (candidates) => {
  if (!mapInstance || !candidateLayerGroup || !window.L) return
  candidateLayerGroup.clearLayers()
  if (!candidates || candidates.length === 0) return

  const boundsPoints = []

  candidates.forEach((item, idx) => {
    const lat = parseFloat(item.lat)
    const lng = parseFloat(item.lon)
    if (isNaN(lat) || isNaN(lng)) return
    boundsPoints.push([lat, lng])

    // Nếu ứng viên có Polygon ranh giới (khu đất, KCN, khu dân cư, đường) thì vẽ vùng nổi bật
    if (item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon')) {
      const geoLayer = window.L.geoJSON(item.geojson, {
        style: {
          color: '#2563EB',
          weight: 2,
          dashArray: '4, 3',
          fillColor: '#60A5FA',
          fillOpacity: 0.22
        }
      })
      geoLayer.on('click', (ev) => {
        window.L.DomEvent.stopPropagation(ev)
        selectAddressResult(item)
      })
      candidateLayerGroup.addLayer(geoLayer)
    } else if (item.isLocalKcn && item.radiusKm) {
      const kcnCircle = window.L.circle([lat, lng], {
        radius: item.radiusKm * 1000,
        color: '#7C3AED',
        weight: 2,
        fillColor: '#8B5CF6',
        fillOpacity: 0.25
      })
      kcnCircle.on('click', (ev) => {
        window.L.DomEvent.stopPropagation(ev)
        selectAddressResult(item)
      })
      candidateLayerGroup.addLayer(kcnCircle)
    }

    // Vẽ ghim ứng viên đánh số 1, 2, 3...
    const numIcon = window.L.divIcon({
      className: 'candidate-num-pin',
      html: `<div class="candidate-badge">${idx + 1}</div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    })
    const candMarker = window.L.marker([lat, lng], { icon: numIcon })
    candMarker.bindTooltip(`<strong>#${idx + 1}:</strong> ${item.display_name}<br/><span>Click để chọn vị trí này</span>`, {
      direction: 'top',
      offset: [0, -10]
    })
    candMarker.on('click', (ev) => {
      window.L.DomEvent.stopPropagation(ev)
      selectAddressResult(item)
    })
    candidateLayerGroup.addLayer(candMarker)
  })

  if (boundsPoints.length === 1) {
    mapInstance.flyTo(boundsPoints[0], 15, { duration: 0.8 })
  } else if (boundsPoints.length > 1) {
    const b = window.L.latLngBounds(boundsPoints)
    mapInstance.fitBounds(b, { padding: [36, 36], maxZoom: 15 })
  }
}

const selectAddressResult = (item) => {
  const lat = parseFloat(item.lat)
  const lng = parseFloat(item.lon)
  addressResults.value = []
  addressSearch.value = item.display_name
  diaChiHienThi.value = ''

  if (item.isLocalKcn || item.type === 'industrial' || normalizeString(item.display_name).includes('khu cong nghiep')) {
    kcn.value = true
    if (!autoDetectedFlags.value.includes('kcn')) {
      autoDetectedFlags.value.push('kcn')
    }
  }

  if (candidateLayerGroup) {
    candidateLayerGroup.clearLayers()
  }

  // Nếu địa chỉ được chọn có ranh giới Polygon (ví dụ KCN, Khu dân cư, Phường/Xã), giữ lại ranh giới đó trên bản đồ
  if (boundaryLayerGroup && item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon')) {
    boundaryLayerGroup.clearLayers()
    const polyLayer = window.L.geoJSON(item.geojson, {
      style: {
        color: '#286B4F',
        weight: 2.2,
        dashArray: '6, 4',
        fillColor: '#286B4F',
        fillOpacity: 0.08
      }
    })
    boundaryLayerGroup.addLayer(polyLayer)
  }

  setCoordinatesAndAnalyze(lat, lng, true)

  initialLocation.value = {
    province: tinh.value || '',
    provinceCode: selectedProvince.value || null,
    ward: phuongXa.value || '',
    wardCode: selectedWard.value || null,
    district: quanHuyen.value || '',
    lat,
    lng
  }
  locationMismatchWarning.value = null

  if (mapInstance) {
    mapInstance.flyTo([lat, lng], 15, { duration: 0.9 })
  }
}

const showAdministrativeBoundary = async (code, maxZoom = 14) => {
  const requestId = ++boundaryRequestSequence
  administrativeLookupMessage.value = ''
  try {
    const rendered = await fetchAndRenderAdminBoundary(window.L, mapInstance, boundaryLayerGroup, code, {
      fitBounds: true,
      maxZoom,
      color: '#15803d',
      fillColor: '#16a34a',
      weight: 3,
      fillOpacity: 0.12
    })
    if (requestId !== boundaryRequestSequence || !rendered) return null
    const bounds = rendered.bounds
    currentViewbox.value = [bounds.getWest(), bounds.getNorth(), bounds.getEast(), bounds.getSouth()]
    return bounds
  } catch (error) {
    if (requestId === boundaryRequestSequence) {
      boundaryLayerGroup?.clearLayers()
      administrativeLookupMessage.value = `Không tải được ranh giới đơn vị hành chính${error.message ? ` (${error.message})` : ''}. Tọa độ ghim được giữ nguyên.`
      logger.warn('Lỗi tải ranh giới hành chính:', error)
    }
    return null
  }
}

const moveMarkerToBoundaryCenterIfOutside = (bounds) => {
  if (!bounds || !bounds.isValid()) return
  const currentLatLng = window.L ? window.L.latLng(latitude.value, longitude.value) : null
  if (currentLatLng && bounds.contains(currentLatLng)) return
  const center = bounds.getCenter()
  const lat = Number(center.lat.toFixed(6))
  const lng = Number(center.lng.toFixed(6))
  latitude.value = lat
  longitude.value = lng
  if (markerInstance) {
    markerInstance.setLatLng([lat, lng])
  }
  updateImpactCircle()
  if (initialLocation.value) {
    initialLocation.value.lat = lat
    initialLocation.value.lng = lng
  }
  locationMismatchWarning.value = null
  runSpatialCheck(lat, lng)
}

const onProvinceSelect = () => {
  selectedWard.value = null
  phuongXa.value = ''
  quanHuyen.value = ''
  currentViewbox.value = null
  ++boundaryRequestSequence
  if (boundaryLayerGroup) boundaryLayerGroup.clearLayers()

  if (!selectedProvince.value) return

  const prov = (divisions.value || []).find(p => String(p.code) === String(selectedProvince.value) || p.name === selectedProvince.value)
  if (prov) {
    tinh.value = prov.name
    diaChiHienThi.value = prov.name

    initialLocation.value = {
      province: prov.name,
      provinceCode: prov.code,
      ward: '',
      wardCode: null,
      district: '',
      lat: latitude.value,
      lng: longitude.value
    }
    locationMismatchWarning.value = null
    showAdministrativeBoundary(prov.code, 10).then((bounds) => {
      if (bounds) moveMarkerToBoundaryCenterIfOutside(bounds)
    })
  }
}

const onWardSelect = (selectedOpt) => {
  if (!selectedWard.value && !selectedOpt) return
  const ward = (selectedOpt && selectedOpt.wardName) ? selectedOpt : wardList.value.find(w => String(w.code) === String(selectedWard.value) || w.name === selectedWard.value || (w.wardName && w.wardName === selectedWard.value))
  if (ward) {
    const rawWardName = ward.wardName || ward.name.replace(/\s*\([^)]*\)$/, '')
    phuongXa.value = rawWardName
    quanHuyen.value = ward.districtName || ''
    const prov = (divisions.value || []).find(p => String(p.code) === String(selectedProvince.value))
    const provName = prov ? prov.name : tinh.value
    diaChiHienThi.value = `${rawWardName}, ${provName}`

    initialLocation.value = {
      province: provName,
      provinceCode: selectedProvince.value,
      ward: rawWardName,
      wardCode: ward.code || null,
      district: ward.districtName || '',
      lat: latitude.value,
      lng: longitude.value
    }
    locationMismatchWarning.value = null

    showAdministrativeBoundary(ward.code, 14).then(async bounds => {
      if (bounds) {
        moveMarkerToBoundaryCenterIfOutside(bounds)
        if (showLanduseOverlay.value) {
          setTimeout(() => loadLanduseZonesInView(), 650)
        }
        return
      }
      // Dự phòng nếu dịch vụ ranh giới không phản hồi: tìm tọa độ trung tâm phường/xã qua Nominatim
      try {
        const q = encodeURIComponent(`${rawWardName}, ${provName}, Vietnam`)
        const res = await fetch(`${NOMINATIM_URL}?q=${q}&format=json&limit=1&countrycodes=vn`)
        const hits = await res.json()
        if (Array.isArray(hits) && hits[0]?.lat && hits[0]?.lon) {
          const lat = Number(parseFloat(hits[0].lat).toFixed(6))
          const lng = Number(parseFloat(hits[0].lon).toFixed(6))
          latitude.value = lat
          longitude.value = lng
          if (markerInstance) markerInstance.setLatLng([lat, lng])
          if (mapInstance) mapInstance.flyTo([lat, lng], 14, { duration: 0.9 })
          updateImpactCircle()
          if (initialLocation.value) {
            initialLocation.value.lat = lat
            initialLocation.value.lng = lng
          }
          runSpatialCheck(lat, lng)
        }
      } catch (_) {}
    })
  }
}

watch(() => props.loadProjectId, async (newId) => {
  if (newId) {
    try {
      const res = await fetch(`${API.PROJECTS}/${newId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.project) {
          selectProject(data.project, data.sensitiveVerification || null)
        }
      }
    } catch (err) {
      logger.error('Lỗi tải dự án:', err)
    }
    emit('project-loaded')
  }
}, { immediate: true })

const showProjectsDrawer = ref(false)
const formNotice = ref(null)
let formNoticeTimer = null
const showFormNotice = (message, type = 'error') => {
  formNotice.value = { type, message }
  if (formNoticeTimer) clearTimeout(formNoticeTimer)
  formNoticeTimer = setTimeout(() => {
    formNotice.value = null
  }, 6000)
}

onMounted(async () => {
  await fetchClassificationMetadata()
  await fetchStaticGisLayers()
  fetchProjects()
  initMap()
})

onUnmounted(() => {
  clearTimeout(searchTimeout)
  clearTimeout(spatialTimeout)
  clearTimeout(overpassTimeout)
  if (mapInstance) {
    mapInstance.remove()
    mapInstance = null
  }
})
</script>

<template>
  <div id="classify" class="page container fade-up">
    <!-- Tiêu đề trang -->
    <div class="page-header">
      <div>
        <h2 class="section-head">Phân loại Dự án &amp; Xác định Hồ sơ Môi trường</h2>
        <p class="section-desc">
          Nhập thông số kỹ thuật và định vị phân vùng không gian GIS để tự động xác định nhóm dự án, loại hồ sơ (ĐTM / GPMT / ĐKMT), cơ quan thẩm quyền và danh mục tài liệu.
        </p>
      </div>
    </div>

    <!-- Thanh chọn dự án ở đầu vùng làm việc -->
    <div class="workspace-bar">
      <div class="workspace-bar-left">
        <span style="font-size:12.5px;color:var(--text3);font-weight:500">Hồ sơ đang làm việc:</span>
        <div class="workspace-current-badge" :class="{ 'is-saved': !!projectId }">
          <i class="ti" :class="projectId ? 'ti-folder-check' : 'ti-file-plus'"></i>
          <span>{{ projectId ? (name || 'Dự án đã lưu') : 'Dự án mới (chưa lưu)' }}</span>
        </div>
      </div>

      <div class="workspace-bar-actions">
        <button type="button" class="btn-secondary btn-sm" @click="handleClassify(true)" title="Phân loại và lưu hồ sơ dự án hiện tại">
          <i class="ti ti-device-floppy"></i>
          <span>{{ projectId ? 'Cập nhật dự án' : 'Lưu dự án' }}</span>
        </button>
        <button type="button" class="btn-secondary btn-sm" @click="createNewProject">
          <i class="ti ti-plus"></i>
          <span>Tạo dự án mới</span>
        </button>
        <button type="button" class="btn-primary btn-sm" @click="openProjectsDrawer">
          <i class="ti ti-folders"></i>
          <span>Dự án đã lưu ({{ projects.length }})</span>
        </button>
      </div>
    </div>

    <!-- Khu vực phân loại chia hai cột -->
    <div class="classify-studio-grid">
      <!-- Cột trái: biểu mẫu đầu vào -->
      <div class="form-section">
        <div class="form-block-title">
          <i class="ti ti-building-factory-2"></i>
          <span>1. Thông tin định danh &amp; Ngành nghề</span>
        </div>

        <div class="form-group">
          <label class="form-label">Tên dự án đầu tư *</label>
          <input type="text" v-model="name" placeholder="Nhập tên dự án đầy đủ..." required />
        </div>

        <div class="form-group">
          <label class="form-label">Loại hình sản xuất / kinh doanh *</label>
          <SearchableSelect
            v-model="nganh"
            :options="industrySelectOptions"
            :groups="groupedIndustryOptions"
            placeholder="Tìm kiếm hoặc chọn loại hình sản xuất / kinh doanh..."
            searchPlaceholder="🔍 Gõ tên ngành (VD: chế biến gỗ, may mặc, bia...)"
          />
          <div v-if="nganh && !industriesCatalog[nganh]" style="font-size:12px;color:var(--warn);margin-top:4px">
            [Mã cũ không tồn tại trong danh mục hợp lệ: {{ nganh }}]
          </div>
          <div v-if="metadataRuleSource === 'FALLBACK_UNVERIFIED'" style="font-size:11.5px;color:var(--warn);margin-top:4px" :title="metadataFallbackReason || ''">
            <i class="ti ti-alert-triangle"></i> Đang dùng danh mục dự phòng do chưa kết nối được cơ sở dữ liệu quy chuẩn. Kết luận sẽ ở trạng thái Cần rà soát.
          </div>
        </div>

        <div class="form-group" v-if="availableProcessStages.length > 0">
          <label class="form-label">Công đoạn / Công nghệ / Nhiên liệu *</label>
          <select v-model="processStage">
            <option value="">Chọn công đoạn hoặc nhiên liệu áp dụng...</option>
            <option v-for="st in availableProcessStages" :key="st.key" :value="st.key">
              {{ st.label }}
            </option>
          </select>
          <div style="font-size:11.5px;color:var(--text3);margin-top:4px">
            Ngành này bắt buộc chọn đúng công đoạn/nhiên liệu theo Phụ lục II, III, IV.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">{{ capacityLabel }}</label>
          <input type="number" v-model="capacity" min="0" step="any" placeholder="Nhập quy mô công suất..." />
        </div>

        <div class="form-block-title" style="margin-top:18px">
          <i class="ti ti-droplet-half-2"></i>
          <span>2. Quy mô phát thải</span>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Nước thải (m³/ngày)</label>
            <input type="number" v-model="nt" min="0" step="10" placeholder="0 nếu chưa xác định" @change="updateImpactCircle" />
          </div>
          <div class="form-group">
            <label class="form-label">Khí thải (m³/giờ)</label>
            <input type="number" v-model="kt" min="0" step="100" placeholder="0 nếu chưa xác định" @change="updateImpactCircle" />
          </div>
        </div>

        <!-- Khu vực bản đồ GIS -->
        <div class="form-block-title" style="margin-top:20px;margin-bottom:6px;border-bottom:none;padding-bottom:0">
          <i class="ti ti-map-2"></i>
          <span>3. Định vị Không gian &amp; Phân vùng Đất (GIS)</span>
        </div>

        <div class="gis-status-bar" style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px">
          <span v-if="locationConfirmed" class="gis-status-pill confirmed">
            <i class="ti ti-circle-check"></i> Đã định vị tọa độ dự án
          </span>
          <span v-else class="gis-status-pill pending">
            <i class="ti ti-map-pin"></i> Tọa độ mặc định (chưa xác nhận)
          </span>
        </div>

        <div class="gis-studio-card">
          <!-- Hàng 1: Chọn Tỉnh / Thành phố (1 dòng riêng, 100% bề ngang) -->
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="font-size:12.5px">Tỉnh / Thành phố *</label>
            <SearchableSelect
              v-model="selectedProvince"
              :options="divisions"
              placeholder="Chọn Tỉnh / Thành phố..."
              search-placeholder="Gõ tìm Tỉnh / Thành phố..."
              @change="onProvinceSelect"
            />
            <div v-if="administrativeLookupMessage" class="admin-lookup-message" role="status">{{ administrativeLookupMessage }}</div>
          </div>

          <!-- Hàng 2: Chọn Phường / Xã (1 dòng riêng, 100% bề ngang, hiển thị trọn vẹn tên không bị khuất) -->
          <div class="form-group" style="margin-bottom:12px">
            <label class="form-label" style="font-size:12.5px">Phường / Xã (sau sáp nhập 2025) *</label>
            <SearchableSelect
              v-model="selectedWard"
              :options="wardList"
              :disabled="!selectedProvince"
              placeholder="Chọn Phường / Xã..."
              search-placeholder="Gõ tên Phường chữ, số cũ hoặc Quận/Huyện..."
              @change="onWardSelect"
            />
          </div>

          <!-- Hàng 2: Tìm kiếm Địa chỉ / KCN / Khu đất được lọc theo Phường/Tỉnh -->
          <div style="position:relative;margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
              <label class="form-label" style="margin-bottom:0;font-size:12px">Tìm nhanh địa điểm / KCN / phân khu</label>
              <span class="scope-chip">
                <i class="ti ti-filter"></i> {{ activeScopeLabel }}
              </span>
            </div>
            <div class="search-input-wrap">
              <i class="ti ti-search search-left-icon"></i>
              <input
                type="text"
                v-model="addressSearch"
                @input="searchAddress"
                placeholder="Gõ tên đường, cơ sở sản xuất hoặc KCN để tìm..."
                style="padding-left:34px;padding-right:34px"
              />
              <button
                v-if="addressSearch"
                type="button"
                class="search-clear-btn"
                @click="addressSearch = ''; addressResults = []; if (candidateLayerGroup) candidateLayerGroup.clearLayers()"
                title="Xóa tìm kiếm"
              >
                <i class="ti ti-x"></i>
              </button>
            </div>

            <!-- Danh sách kết quả lọc địa chỉ/vùng đồng bộ với ghim số 1..N trên bản đồ -->
            <div v-if="addressResults.length" class="gis-search-dropdown">
              <div class="dropdown-hint">
                <i class="ti ti-bulb"></i>
                <span>Chọn từ danh sách hoặc bấm trực tiếp vào số <strong>#1, #2...</strong> trên bản đồ</span>
              </div>
              <div
                v-for="(item, i) in addressResults"
                :key="i"
                class="gis-search-item"
                @click="selectAddressResult(item)"
              >
                <span class="cand-num">{{ i + 1 }}</span>
                <div style="flex:1;min-width:0">
                  <div class="cand-title">{{ item.display_name }}</div>
                </div>
                <span
                  class="cand-type-badge"
                  :style="{ color: getAddressCategoryLabel(item).color, backgroundColor: getAddressCategoryLabel(item).bg }"
                >
                  {{ getAddressCategoryLabel(item).text }}
                </span>
              </div>
            </div>
          </div>

          <!-- CẢNH BÁO LỆCH RANH GIỚI VỊ TRÍ HỒ SƠ VỚI ĐIỂM CẮM MỐC (GIS) -->
          <div v-if="locationMismatchWarning" class="location-mismatch-banner">
            <div class="mismatch-banner-header">
              <div class="mismatch-header-left">
                <i class="ti ti-alert-triangle mismatch-icon"></i>
                <div class="mismatch-title-wrap">
                  <strong class="mismatch-title">{{ locationMismatchWarning.title }}</strong>
                  <span class="mismatch-subtitle">Điểm cắm mốc trên bản đồ hiện đang nằm ngoài địa giới hành chính bạn đã chọn</span>
                </div>
              </div>
              <button type="button" class="mismatch-close-btn" @click="locationMismatchWarning = null" title="Đóng thông báo">
                <i class="ti ti-x"></i>
              </button>
            </div>

            <div class="mismatch-body-rows">
              <!-- Hàng 1: Vị trí cũ (Xác định ban đầu) -->
              <div class="mismatch-row-card initial-box">
                <div class="mismatch-row-header">
                  <span class="mismatch-box-tag">
                    <i class="ti ti-map-pin"></i> 1. Vị trí cũ (Xác định ban đầu):
                  </span>
                </div>
                <div class="mismatch-row-content">
                  <div class="mismatch-item">
                    <span class="m-label">Thành phố / Tỉnh:</span>
                    <strong class="m-val">{{ locationMismatchWarning.initial.province || 'Chưa chọn' }}</strong>
                  </div>
                  <div class="mismatch-item">
                    <span class="m-label">Phường / Xã:</span>
                    <strong class="m-val">{{ locationMismatchWarning.initial.ward || '(Chưa chọn)' }}</strong>
                  </div>
                  <div v-if="locationMismatchWarning.initial.district" class="mismatch-item">
                    <span class="m-label">Quận / Huyện:</span>
                    <span class="m-val-sub">{{ locationMismatchWarning.initial.district }}</span>
                  </div>
                </div>
              </div>

              <!-- Hàng 2: Vị trí mới (của điểm cắm mốc) -->
              <div class="mismatch-row-card new-box">
                <div class="mismatch-row-header">
                  <span class="mismatch-box-tag new-tag">
                    <i class="ti ti-current-location"></i> 2. Vị trí mới của điểm cắm mốc:
                  </span>
                </div>
                <div class="mismatch-row-content">
                  <div class="mismatch-item">
                    <span class="m-label">Thành phố / Tỉnh:</span>
                    <strong class="m-val text-accent">{{ locationMismatchWarning.newLocation.province || 'Đang xác định' }}</strong>
                  </div>
                  <div class="mismatch-item">
                    <span class="m-label">Phường / Xã:</span>
                    <strong class="m-val text-accent">{{ locationMismatchWarning.newLocation.ward || 'Khu vực lân cận' }}</strong>
                  </div>
                  <div v-if="locationMismatchWarning.newLocation.district" class="mismatch-item">
                    <span class="m-label">Quận / Huyện:</span>
                    <span class="m-val-sub">{{ locationMismatchWarning.newLocation.district }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Hành động lựa chọn -->
            <div class="mismatch-actions">
              <button
                type="button"
                class="btn-mismatch-apply"
                @click="applyNewMarkerLocation"
                title="Cập nhật lại Tỉnh/TP và Phường/Xã trên hồ sơ theo đúng vị trí mới của điểm cắm mốc"
              >
                <i class="ti ti-check"></i>
                <span>Cập nhật theo vị trí mới</span>
              </button>
              <button
                type="button"
                class="btn-mismatch-revert"
                @click="revertToInitialLocation"
                title="Đưa điểm cắm mốc trên bản đồ quay trở lại vị trí ban đầu"
              >
                <i class="ti ti-arrow-back-up"></i>
                <span>Quay lại vị trí ban đầu</span>
              </button>
            </div>
          </div>

          <!-- Hàng 3: Khung Bản đồ chuyên nghiệp & Thanh công cụ phẳng -->
          <div class="mini-map-wrapper">
            <!-- Thanh công cụ phẳng phía trên bản đồ -->
            <div class="mini-map-toolbar">
              <!-- Nhóm 1: Tab chế độ bản đồ -->
              <div class="map-mode-tabs">
                <button
                  type="button"
                  class="map-mode-tab"
                  :class="{ active: activeBaseMap === 'voyager' }"
                  @click="applyBaseMapLayer('voyager')"
                >
                  <i class="ti ti-map"></i>
                  <span>Tinh gọn</span>
                </button>
                <button
                  type="button"
                  class="map-mode-tab"
                  :class="{ active: activeBaseMap === 'landuse' }"
                  @click="applyBaseMapLayer('landuse')"
                >
                  <i class="ti ti-polygon"></i>
                  <span>Phân vùng đất</span>
                </button>
                <button
                  type="button"
                  class="map-mode-tab"
                  :class="{ active: activeBaseMap === 'satellite' }"
                  @click="applyBaseMapLayer('satellite')"
                >
                  <i class="ti ti-satellite"></i>
                  <span>Vệ tinh</span>
                </button>
              </div>

              <!-- Nhóm 2: Nút tiện ích bản đồ -->
              <div class="map-action-toggles">
                <button
                  type="button"
                  class="map-toggle-btn"
                  :class="{ active: showAdminBoundary }"
                  @click="toggleAdminBoundary"
                  title="Bật/tắt ranh giới hành chính Tỉnh và Phường/Xã"
                >
                  <i class="ti ti-border-outer"></i>
                  <span>Ranh giới P/X</span>
                </button>
                <button
                  type="button"
                  class="map-toggle-btn"
                  :class="{ active: showLanduseOverlay }"
                  @click="toggleLanduseOverlay"
                  title="Bật/tắt các đa giác KCN và phân vùng đất"
                >
                  <i class="ti ti-layers-linked"></i>
                  <span>Khu đất ({{ landuseZonesCount }})</span>
                </button>
                <button
                  type="button"
                  class="map-toggle-btn icon-btn"
                  @click="locateUserGps"
                  title="Định vị GPS vị trí của bạn"
                >
                  <i class="ti ti-current-location"></i>
                </button>
              </div>
            </div>

            <!-- Khung vẽ bản đồ rộng rãi -->
            <div id="mini-map" class="mini-map-canvas"></div>

            <!-- Chú giải phân vùng 1 dòng thanh lịch -->
            <div class="mini-map-legend">
              <span class="legend-chip"><i class="dot" style="background:#7C3AED"></i> KCN / Nhà máy</span>
              <span class="legend-chip"><i class="dot" style="background:#2563EB"></i> Dân cư</span>
              <span class="legend-chip"><i class="dot" style="background:#D97706"></i> Thương mại</span>
              <span class="legend-chip"><i class="dot" style="background:#286B4F"></i> Rừng/Nông nghiệp</span>
              <span class="legend-chip"><i class="dot" style="background:#D65B5B"></i> Vùng bảo tồn</span>
              <span class="legend-chip"><i class="dot" style="background:#15803d"></i> Ranh giới Phường/Xã</span>
            </div>
          </div>

          <!-- Thông báo khi người dùng bấm chọn một phân khu đất trên bản đồ -->
          <div v-if="selectedZoneInfo" class="selected-zone-banner">
            <i class="ti ti-map-pin-check" style="color:var(--accent);font-size:16px"></i>
            <div style="flex:1">
              Đã chọn: <strong>{{ selectedZoneInfo.name }}</strong>
              <span style="color:var(--text3);margin-left:6px">({{ selectedZoneInfo.typeLabel }})</span>
            </div>
            <button type="button" class="btn-ghost btn-sm" style="height:22px;padding:0 6px" @click="selectedZoneInfo = null">
              <i class="ti ti-x"></i>
            </button>
          </div>

          <!-- Hàng 4: Địa chỉ ghi nhận trong hồ sơ (100% width, không bị chèn ép) -->
          <div class="form-group" style="margin-top:12px;margin-bottom:12px">
            <label class="form-label" style="font-size:12px">
              <i class="ti ti-map-pin" style="color:var(--accent)"></i>
              Địa chỉ ghi nhận trong hồ sơ
            </label>
            <input
              type="text"
              v-model="diaChiHienThi"
              placeholder="Tự động ghi nhận khi chọn trên bản đồ hoặc gõ trực tiếp..."
            />
          </div>

          <!-- Hàng 5: Tọa độ trắc địa (2 cột cân đối) -->
          <div class="form-grid-2" style="gap:12px;margin-bottom:12px">
            <div>
              <label class="form-label" style="font-size:12px;color:var(--text2)">Vĩ độ</label>
              <input type="number" step="0.000001" v-model.number="latitude" @change="onManualCoordChange" />
            </div>
            <div>
              <label class="form-label" style="font-size:12px;color:var(--text2)">Kinh độ</label>
              <input type="number" step="0.000001" v-model.number="longitude" @change="onManualCoordChange" />
            </div>
          </div>

          <!-- Hàng 6: hộp phân tích không gian tự động -->
          <div v-if="spatialData" class="spatial-intel-box">
            <div class="spatial-intel-header">
              <div class="spatial-intel-title">
                <i class="ti ti-radar"></i>
                <span>Phân tích không gian tự động (Điều 25)</span>
              </div>
              <div class="spatial-metrics">
                <span class="metric-pill" :class="{ 'danger': spatialData.borderDistanceKm <= 50 }">
                  Biên giới: <strong>{{ spatialData.borderDistanceKm }} km</strong>
                </span>
                <span class="metric-pill" :class="{ 'warn': spatialData.coastDistanceKm <= 5 }">
                  Bờ biển: <strong>{{ spatialData.coastDistanceKm }} km</strong>
                </span>
              </div>
            </div>

            <div v-if="spatialData.spatialAlerts && spatialData.spatialAlerts.length > 0" class="spatial-alerts-list">
              <div
                v-for="(al, idx) in spatialData.spatialAlerts"
                :key="idx"
                class="spatial-alert-item"
                :class="al.level"
              >
                <i class="ti" :class="al.level === 'danger' ? 'ti-alert-triangle' : al.level === 'warn' ? 'ti-alert-circle' : 'ti-building-factory'"></i>
                <div style="flex:1">
                  <div style="font-weight:600">{{ al.title }}</div>
                  <div style="font-size:11.5px;opacity:0.9">{{ al.detail }}</div>
                </div>
                <span class="auto-check-badge">Đã tự động tích</span>
              </div>
            </div>
            <div v-else class="spatial-safe-note">
              <i class="ti ti-shield-check" style="color:var(--success)"></i>
              <span>Tọa độ không vi phạm vùng cấm/vùng bảo tồn trọng điểm trong bán kính kiểm tra tự động.</span>
            </div>
          </div>
        </div>

        <!-- MỤC 4: YẾU TỐ NHẠY CẢM (ĐỦ 8 TIÊU CHÍ ĐIỀU 25) & ĐIỀU KIỆN ĐẶC THÙ -->
        <div class="form-group" style="margin-top:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label class="form-label" style="margin-bottom:0">Yếu tố nhạy cảm môi trường (Điều 25 Luật BVMT 2020)</label>
            <span v-if="autoDetectedFlags.length" style="font-size:11px;color:var(--accent);font-weight:600">
              <i class="ti ti-crosshair"></i> Tự động nhận diện từ tọa độ GIS
            </span>
          </div>
          <div class="check-grid">
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('rung') }">
              <input type="checkbox" v-model="rung"> Đất rừng PH / Đặc dụng
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('lua') }">
              <input type="checkbox" v-model="lua"> Chuyển đất lúa 2 vụ &gt;10 ha
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('bg') }">
              <input type="checkbox" v-model="bg"> Vùng biên giới (≤50 km)
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('bao_ton') }">
              <input type="checkbox" v-model="bao_ton"> Khu bảo tồn / Vườn QG
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('di_san') }">
              <input type="checkbox" v-model="di_san"> Di sản thiên nhiên / UNESCO
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('ven_bien') }">
              <input type="checkbox" v-model="ven_bien"> Hành lang bảo vệ bờ biển
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('nguon_nc') }">
              <input type="checkbox" v-model="nguon_nc"> Nguồn nước cấp sinh hoạt
            </label>
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('dat_ngap') }">
              <input type="checkbox" v-model="dat_ngap"> Đất ngập nước (Ramsar)
            </label>
          </div>

          <!-- Khai báo định lượng & Hồ sơ chứng minh vùng nhạy cảm (thu gọn khi chưa có yếu tố nhạy cảm) -->
          <div style="margin-top:10px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
              <button type="button"
                      class="btn-ghost btn-sm"
                      style="padding:0;font-size:12px;font-weight:600;color:var(--text);text-align:left"
                      @click="showSensitiveDetails = !showSensitiveDetails">
                <i class="ti" :class="(showSensitiveDetails || hasAnySensitiveDeclaration) ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
                <span>Khai báo diện tích &amp; văn bản chứng minh vùng nhạy cảm (nếu có)</span>
              </button>
              <span v-if="effectiveSensitiveStatus !== 'NOT_REQUIRED'"
                    class="chip"
                    :style="{
                      fontSize: '11px',
                      background: effectiveSensitiveStatus === 'VERIFIED' ? '#EAF5EF' : '#FFFBEB',
                      color: effectiveSensitiveStatus === 'VERIFIED' ? '#25845B' : '#92400E',
                      border: '1px solid var(--border)'
                    }">
                {{ getSensitiveStatusLabel(effectiveSensitiveStatus) }}
              </span>
            </div>
            <div v-show="showSensitiveDetails || hasAnySensitiveDeclaration" style="margin-top:10px">
              <label class="check-item" style="margin-bottom:8px">
                <input type="checkbox" v-model="insideCoreProtectedZone"> Nằm trong phân khu bảo vệ nghiêm ngặt / vùng lõi khu bảo tồn
              </label>
              <div class="form-grid-2" style="gap:8px;margin-bottom:8px">
                <div>
                  <label class="form-label" style="font-size:11.5px;margin-bottom:4px">Diện tích chuyển đổi đất lúa 2 vụ (ha)</label>
                  <input type="number" v-model.number="paddyConversionAreaHa" min="0" step="0.01" placeholder="0" />
                </div>
                <div>
                  <label class="form-label" style="font-size:11.5px;margin-bottom:4px">Diện tích chuyển đổi đất rừng (ha)</label>
                  <input type="number" v-model.number="forestConversionAreaHa" min="0" step="0.01" placeholder="0" />
                </div>
              </div>
              <div>
                <label class="form-label" style="font-size:11.5px;margin-bottom:4px">Tài liệu / Số văn bản trích lục tọa độ (nếu có)</label>
                <input type="text" v-model="sensitiveEvidenceRef" placeholder="VD: VB xác nhận ranh giới BQL Rừng số .../QĐ..." />
              </div>
              <div style="font-size:11px;color:var(--text3);margin-top:6px;line-height:1.4">
                Lưu ý: Các thông số tự kê khai chỉ được dùng để nâng nhóm chính thức sau khi quản trị viên kiểm tra và xác nhận hợp lệ trong hệ thống.
              </div>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Điều kiện hạ tầng &amp; Pháp lý đặc thù</label>
          <div class="check-grid">
            <label class="check-item" :class="{ 'auto-flagged': autoDetectedFlags.includes('kcn') }">
              <input type="checkbox" v-model="kcn"> Trong KCN đã có ĐTM
            </label>
            <label class="check-item">
              <input type="checkbox" v-model="phanky"> Đầu tư phân kỳ giai đoạn
            </label>
            <label class="check-item">
              <input type="checkbox" v-model="morongdt"> Mở rộng dự án hiện hữu
            </label>
            <label class="check-item">
              <input type="checkbox" v-model="ctnh"> Có phát sinh CTNH
            </label>
            <label class="check-item">
              <input type="checkbox" v-model="dtcong"> Dự án đầu tư công
            </label>
            <label class="check-item">
              <input type="checkbox" v-model="epr"> Thuộc diện tái chế EPR (NĐ 110)
            </label>
          </div>
        </div>

        <div
          v-if="formNotice"
          role="alert"
          :style="{
            marginTop: '6px',
            marginBottom: '6px',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            background: formNotice.type === 'success' ? '#dcfce7' : formNotice.type === 'warning' ? '#fef3c7' : '#fee2e2',
            color: formNotice.type === 'success' ? '#166534' : formNotice.type === 'warning' ? '#92400e' : '#991b1b',
            border: formNotice.type === 'success' ? '1px solid #86efac' : formNotice.type === 'warning' ? '1px solid #fcd34d' : '1px solid #fca5a5'
          }"
        >
          <span><i class="ti" :class="formNotice.type === 'success' ? 'ti-circle-check' : 'ti-alert-circle'" style="margin-right:6px"></i>{{ formNotice.message }}</span>
          <button type="button" @click="formNotice = null" style="background:none;border:none;cursor:pointer;color:inherit;font-weight:700;padding:0 4px" aria-label="Đóng thông báo">×</button>
        </div>

        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <button type="button" class="btn-classify" style="flex:1;min-width:200px;margin-top:0" @click="handleClassify(true)">
            <i class="ti ti-calculator"></i>
            <span>Phân loại &amp; Lưu dự án</span>
          </button>
          <button type="button" class="btn-secondary" style="white-space:nowrap" @click="handleClassify(true)" title="Lưu hồ sơ dự án hiện tại vào danh sách">
            <i class="ti ti-device-floppy"></i>
            <span>{{ projectId ? 'Cập nhật dự án' : 'Lưu dự án' }}</span>
          </button>
        </div>
      </div>

      <!-- Cột phải: kết quả phân loại -->
      <div class="result-area" id="result-area">
        <div v-if="!result" class="result-empty-card">
          <div class="kpi-icon" style="width:48px;height:48px;font-size:24px;margin:0 auto 14px">
            <i class="ti ti-file-analytics"></i>
          </div>
          <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:6px">Chưa có dữ liệu phân loại</div>
          <div style="font-size:13px;color:var(--text3);max-width:340px;margin:0 auto">
            Điền thông số dự án và chọn vị trí trên bản đồ ở cột bên trái, sau đó nhấn <strong>Phân loại &amp; Xác định hồ sơ</strong>.
          </div>
        </div>

        <div v-else class="fade-up">
          <!-- Cảnh báo xác minh pháp lý và độ đầy đủ dữ liệu -->
          <div v-if="!result.isOfficialConclusion"
               style="margin-bottom:14px;padding:12px 14px;border-radius:var(--radius);border:1px solid #FCD34D;background:#FFFBEB;color:#92400E">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:8px;font-weight:650;font-size:13.5px">
                <i class="ti ti-shield-exclamation" style="font-size:16px"></i>
                <span>{{ getConclusionStatusMeta(result.conclusionStatus).title }}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                <span class="chip" style="background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;font-size:11px">
                  {{ getRuleSourceLabel(result.ruleSource) }}
                </span>
                <button type="button"
                        class="btn-ghost btn-sm"
                        style="padding:2px 8px;font-size:11.5px;color:#92400E;display:inline-flex;align-items:center;gap:4px;border:1px solid rgba(217,119,6,0.3);border-radius:4px"
                        @click="showUnverifiedNotice = !showUnverifiedNotice">
                  <span>{{ showUnverifiedNotice ? 'Thu gọn ▴' : 'Coi mục lưu ý ▾' }}</span>
                </button>
              </div>
            </div>

            <!-- Nội dung lưu ý mở rộng khi bấm -->
            <div v-show="showUnverifiedNotice" style="margin-top:10px;padding-top:10px;border-top:1px dashed #FCD34D">
              <ul v-if="formattedUnverifiedReasons.length" style="margin:0 0 8px 18px;padding:0;font-size:12px;line-height:1.55">
                <li v-for="(reason, idx) in formattedUnverifiedReasons" :key="'uv-' + idx">{{ reason }}</li>
              </ul>
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:11.5px">
                <span style="font-style:italic;color:#78350F">
                  * Chức năng xuất báo cáo kết luận chính thức đang tạm khóa cho tới khi đủ dữ liệu và hoàn tất xác minh quy định.
                </span>
              </div>
            </div>
          </div>

          <!-- Thẻ tóm tắt kết quả -->
          <div class="result-hero">
            <div class="result-main" style="justify-content:space-between;gap:12px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:14px;flex:1;min-width:0">
                <div class="result-icon">
                  <i class="ti" :class="result.isOfficialConclusion ? 'ti-shield-check' : 'ti-alert-circle'"></i>
                </div>
                <div style="flex:1;min-width:0">
                  <div class="result-label">
                    <template v-if="result.isOfficialConclusion">
                      {{ result.hi?.label || 'Kết luận hồ sơ môi trường' }}
                    </template>
                    <template v-else-if="isFallbackOrIncompleteResult">
                      {{ result.errorMessage || 'Chưa đủ điều kiện kết luận chính thức' }}
                    </template>
                    <template v-else>
                      Tham khảo sơ bộ: {{ result.hi?.label || 'Hồ sơ môi trường' }}
                    </template>
                  </div>
                  <div class="result-sub">
                    <template v-if="result.isOfficialConclusion">
                      {{ result.nhom }} — Căn cứ Nghị định 08/2022/NĐ-CP (hợp nhất NĐ 48/2026 &amp; VBHN 49)
                    </template>
                    <template v-else-if="isFallbackOrIncompleteResult">
                      {{ result.ruleSource !== 'DATABASE'
                        ? 'Chưa kết nối được danh mục quy chuẩn từ cơ sở dữ liệu — tạm khóa kết luận tự động'
                        : 'Vui lòng bổ sung hoặc rà soát lại thông số đầu vào trước khi kết luận' }}
                    </template>
                    <template v-else>
                      {{ result.nhom }} (Dự kiến sơ bộ — đang chờ hoàn tất xác minh quy định ngành)
                    </template>
                  </div>
                </div>
              </div>
              <button type="button"
                      class="btn-secondary btn-sm"
                      :disabled="!result.canExportOfficialReport"
                      :title="result.canExportOfficialReport ? 'Xuất / In kết luận chính thức' : 'Đã khóa: chỉ xuất được khi đủ căn cứ và đã xác minh quy định'"
                      :style="!result.canExportOfficialReport ? 'opacity:0.5;cursor:not-allowed' : ''"
                      @click="exportOfficialReport">
                <i class="ti ti-printer"></i>
                <span>{{ result.canExportOfficialReport ? 'In kết luận chính thức' : 'Đã khóa xuất chính thức' }}</span>
              </button>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <template v-if="!isFallbackOrIncompleteResult">
                <span class="chip" :class="result.hi?.class || 'chip-gray'">
                  {{ result.isPreliminary ? `${result.hs} (Sơ bộ)` : result.hs }}
                </span>
                <span v-if="result.coQuan" class="chip" :class="{ 'chip-bo': result.tq === 'cap_bo', 'chip-so': result.tq === 'cap_so', 'chip-huyen': result.tq === 'cap_huyen' || result.tq === 'cap_xa' }">
                  <i class="ti ti-building-bank"></i> {{ result.coQuan }}
                </span>
                <span v-if="result.thoiHan" class="chip chip-gray">
                  <i class="ti ti-clock"></i> {{ result.thoiHan }}
                </span>
                <span v-if="result.phuluc && result.phuluc !== '—'" class="chip chip-info">{{ result.phuluc }}</span>
                <span v-for="ob in (result.environmentalObligations || [])" :key="'ob-' + ob" class="chip chip-info">
                  Thủ tục: {{ getProcedureLabel(ob) }}
                </span>
              </template>
              <span v-else class="chip chip-gray">
                <i class="ti ti-lock"></i> Chưa đủ căn cứ chốt hồ sơ
              </span>
              <span v-if="result.impactRadiusMeters" class="chip chip-gray" title="Bán kính ảnh hưởng môi trường dự kiến trên bản đồ">
                <i class="ti ti-radar-2" style="color:var(--accent)"></i> Bán kính tác động: {{ (estimatedImpactRadius / 1000).toFixed(1) }} km
              </span>
            </div>

            <div v-if="!isFallbackOrIncompleteResult"
                 style="font-size:12.5px;color:var(--text2);padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div>
                <strong style="color:var(--text)">Căn cứ pháp lý trực tiếp:</strong> {{ result.ref || 'Chưa xác định' }}
              </div>
              <button v-if="result.ref_law_id" type="button" class="btn-secondary btn-sm" @click="emit('view-law', result.ref_law_id)">
                <i class="ti ti-scale"></i>
                <span>Xem điều khoản</span>
              </button>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <div class="info-box-label">Loại hồ sơ {{ (!isFallbackOrIncompleteResult && result.isPreliminary) ? '(Sơ bộ)' : '' }}</div>
                <div class="info-box-val">{{ (!isFallbackOrIncompleteResult && result.hs) ? result.hs : 'Chưa xác định' }}</div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Nhóm dự án {{ (!isFallbackOrIncompleteResult && result.isPreliminary) ? '(Sơ bộ)' : '' }}</div>
                <div class="info-box-val">{{ (!isFallbackOrIncompleteResult && result.nhom) ? result.nhom : 'Chưa xác định' }}</div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Thẩm quyền {{ (!isFallbackOrIncompleteResult && result.isPreliminary) ? '(Sơ bộ)' : '' }}</div>
                <div class="info-box-val" :class="!isFallbackOrIncompleteResult ? { 'warn': result.tq === 'cap_bo', 'green': result.tq === 'cap_so', 'info': result.tq === 'cap_huyen' || result.tq === 'cap_xa' } : {}">
                  {{ (isFallbackOrIncompleteResult || !result.tq) ? 'Chưa xác định' : result.tq === 'cap_bo' ? 'Bộ NN&amp;MT' : result.tq === 'cap_so' ? 'UBND Tỉnh (Sở NN&amp;MT)' : result.tq === 'cap_xa' ? 'UBND Cấp Xã' : 'UBND Cấp Huyện (Cũ)' }}
                </div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Tình trạng kết luận</div>
                <div class="info-box-val" :class="result.isOfficialConclusion ? 'green' : 'warn'">
                  {{ getConclusionStatusMeta(result.conclusionStatus || result.verificationStatus).short }}
                </div>
              </div>
            </div>

            <!-- Giải trình căn cứ xác định hồ sơ (Ngành, Quy mô & Luật áp dụng), thu gọn mặc định -->
            <div v-if="!isFallbackOrIncompleteResult && displayRationale"
                 style="margin-top:10px;padding:10px 14px;background:#F8FAFC;border:1px solid var(--border);border-radius:var(--radius)">
              <div
                style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer"
                @click="showClassificationRationale = !showClassificationRationale"
              >
                <div style="font-size:12.5px;color:var(--text);display:flex;align-items:center;gap:6px;flex:1;min-width:220px">
                  <i class="ti ti-scale-outline" style="color:var(--accent)"></i>
                  <span><strong>Căn cứ phân loại:</strong> {{ displayRationale.summaryText }}</span>
                </div>
                <button
                  type="button"
                  class="btn-secondary btn-sm"
                  style="padding:3px 10px;font-size:11.5px;white-space:nowrap"
                  @click.stop="showClassificationRationale = !showClassificationRationale"
                >
                  {{ showClassificationRationale ? 'Thu gọn ▴' : 'Xem căn cứ chi tiết ▾' }}
                </button>
              </div>

              <div v-if="showClassificationRationale" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);font-size:12.5px;color:var(--text2);display:flex;flex-direction:column;gap:8px">
                <div>
                  <strong style="color:var(--text)">1. Thông số đầu vào đã đối chiếu:</strong>
                  <ul style="margin:4px 0 0 18px;padding:0;line-height:1.55">
                    <li><strong>Loại hình ngành nghề:</strong> {{ displayRationale.industryName }}</li>
                    <li v-if="displayRationale.processStageLabel"><strong>Công đoạn / Nhiên liệu:</strong> {{ displayRationale.processStageLabel }}</li>
                    <li>
                      <strong>Quy mô / Công suất nhập:</strong>
                      {{ Number(displayRationale.inputCapacity || 0).toLocaleString('vi-VN') }} {{ displayRationale.unit }}
                      <span v-if="displayRationale.thresholdText" style="color:var(--text3)"> — Khớp khung quy định: {{ displayRationale.thresholdText }}</span>
                    </li>
                    <li v-if="displayRationale.capacityScale"><strong>Phân mức công suất:</strong> {{ displayRationale.capacityScale }}</li>
                  </ul>
                </div>

                <div>
                  <strong style="color:var(--text)">2. Kết quả xác định từ đầu vào:</strong>
                  <div style="margin-top:4px;line-height:1.55">
                    • Thuộc <strong>{{ displayRationale.projectGroup || 'Chưa xác định' }}</strong>
                    → Hồ sơ yêu cầu: <strong>{{ displayRationale.procedureLabel || 'Chưa xác định' }}</strong>
                    <span v-if="displayRationale.authorityLabel"> · Thẩm quyền giải quyết: <strong>{{ displayRationale.authorityLabel }}</strong></span>
                  </div>
                  <div v-for="(adj, aIdx) in (displayRationale.adjustments || [])" :key="'adj-' + aIdx" style="margin-top:3px;color:#b45309">
                    • Điều chỉnh nâng nhóm: {{ adj }}
                  </div>
                </div>

                <div v-if="displayRationale.legalRefs && displayRationale.legalRefs.length">
                  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
                    <strong style="color:var(--text)">3. Luật, Nghị định &amp; Quy định áp dụng:</strong>
                    <button v-if="result.ref_law_id" type="button" class="btn-secondary btn-sm" style="padding:2px 8px;font-size:11.5px" @click="emit('view-law', result.ref_law_id)">
                      <i class="ti ti-book-2"></i>
                      <span>Mở văn bản luật</span>
                    </button>
                  </div>
                  <ul style="margin:4px 0 0 18px;padding:0;line-height:1.55">
                    <li v-for="(lr, lIdx) in displayRationale.legalRefs" :key="'lr-' + lIdx">{{ lr }}</li>
                  </ul>
                </div>
              </div>
            </div>

            <!-- Tham khảo ngoại tuyến tách riêng khi mất kết nối DB để tránh mâu thuẫn với ô Chưa xác định -->
            <div v-if="result.ruleSource !== 'DATABASE' && !result.errorCode && result.preliminary"
                 style="margin-top:10px;padding:10px 14px;background:#F8FAFC;border:1px dashed var(--border);border-radius:var(--radius)">
              <button type="button"
                      class="btn-ghost btn-sm"
                      style="padding:0;font-size:12px;font-weight:600;color:var(--text2)"
                      @click="showOfflinePreliminary = !showOfflinePreliminary">
                <i class="ti" :class="showOfflinePreliminary ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
                <span>Xem ước tính tham khảo ngoại tuyến (không có giá trị pháp lý)</span>
              </button>
              <div v-if="showOfflinePreliminary" style="margin-top:8px;font-size:12px;color:var(--text2);display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px 14px">
                <div><strong>Nhóm dự kiến:</strong> {{ result.preliminary.nhom || '—' }}</div>
                <div><strong>Hồ sơ dự kiến:</strong> {{ result.preliminary.hs || '—' }}</div>
                <div><strong>Cơ quan dự kiến:</strong> {{ result.preliminary.coQuan || '—' }}</div>
                <div><strong>Căn cứ tham khảo:</strong> {{ result.preliminary.ref || result.ref || '—' }}</div>
              </div>
            </div>

            <!-- Thông số kỹ thuật được thu gọn để chuyên viên tập trung vào thủ tục -->
            <div style="margin-top:10px">
              <button type="button"
                      class="btn-ghost btn-sm"
                      style="padding:4px 0;font-size:12px;color:var(--text3)"
                      @click="showTechnicalMeta = !showTechnicalMeta">
                <i class="ti" :class="showTechnicalMeta ? 'ti-chevron-down' : 'ti-chevron-right'"></i>
                <span>Chi tiết kỹ thuật &amp; Nguồn dữ liệu quy chuẩn</span>
              </button>
              <div v-if="showTechnicalMeta"
                   style="margin-top:6px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text2);display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px 14px">
                <div><strong>Phiên bản quy tắc:</strong> {{ result.appliedRuleVersion || result.ruleVersion || '—' }}</div>
                <div>
                  <strong>Hiệu lực quy định:</strong>
                  {{ result.appliedEffectiveFrom || '—' }} → {{ result.appliedEffectiveTo || 'Hiện hành' }}
                </div>
                <div>
                  <strong>Ngày áp dụng đánh giá:</strong>
                  {{ result.evaluationDate || evaluationDate }}
                  <span v-if="result.isHistoricalEvaluation" style="color:var(--warn);font-weight:600">(Mốc lịch sử)</span>
                </div>
                <div><strong>Xác minh nhạy cảm:</strong> {{ getSensitiveStatusLabel(effectiveSensitiveStatus) }}</div>
                <div><strong>Nguồn dữ liệu bản đồ:</strong> {{ getGisSourceLabel(result.gisSource || spatialData?.gisSource) }}</div>
              </div>
            </div>

            <!-- Admin Panel Xác minh vùng nhạy cảm (thu gọn mặc định, bấm để mở rộng khi cần thẩm định) -->
            <div v-if="shouldShowAdminSensitivePanel"
                 class="no-print"
                 style="margin-top:12px;padding:10px 14px;background:#F8FAFC;border:1px solid var(--border);border-radius:var(--radius)">
              <div
                style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;cursor:pointer"
                @click="showAdminSensitivePanel = !showAdminSensitivePanel"
              >
                <strong style="font-size:12.5px;color:var(--text)">
                  <i class="ti ti-shield-check" style="color:var(--accent)"></i>
                  Kiểm duyệt vùng nhạy cảm (Quản trị viên)
                </strong>
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:11.5px;color:var(--text2)">
                    Trạng thái hiện tại: <strong>{{ getSensitiveStatusLabel(effectiveSensitiveStatus) }}</strong>
                  </span>
                  <button
                    type="button"
                    class="btn-secondary btn-sm"
                    style="padding:3px 10px;font-size:11.5px"
                    @click.stop="showAdminSensitivePanel = !showAdminSensitivePanel"
                  >
                    {{ showAdminSensitivePanel ? 'Thu gọn ▴' : 'Mở rộng ▾' }}
                  </button>
                </div>
              </div>

              <div v-if="showAdminSensitivePanel" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
                <div class="form-grid-2" style="gap:8px;margin-bottom:8px">
                  <input type="text" v-model="adminSensitiveEvidence" placeholder="Số văn bản / Chứng cứ ranh giới..." />
                  <input type="text" v-model="adminSensitiveNote" placeholder="Ghi chú thẩm định của quản trị viên..." />
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <button type="button" class="btn-primary btn-sm" :disabled="isUpdatingSensitiveVerification" @click="submitAdminSensitiveVerification('VERIFIED')">
                    <i class="ti ti-check"></i>
                    <span>Xác nhận hợp lệ</span>
                  </button>
                  <button type="button" class="btn-secondary btn-sm" :disabled="isUpdatingSensitiveVerification" @click="submitAdminSensitiveVerification('REJECTED')">
                    <i class="ti ti-x"></i>
                    <span>Từ chối xác nhận</span>
                  </button>
                  <span v-if="sensitiveVerificationMessage" style="font-size:12px;color:var(--accent);font-weight:500">
                    {{ sensitiveVerificationMessage }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Chi tiết Cơ quan & Đơn vị chuyên môn (Bước 3) -->
            <div v-if="!isFallbackOrIncompleteResult && result.competentAuthority && result.competentAuthority.competentAgency"
                 style="margin-top:12px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);font-size:12px;color:var(--text2);display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 14px">
              <div><strong>Người có thẩm quyền:</strong> {{ result.competentAuthority.competentPerson }}</div>
              <div><strong>Cơ quan có thẩm quyền:</strong> {{ result.competentAuthority.competentAgency }}</div>
              <div><strong>Cơ quan tiếp nhận:</strong> {{ result.competentAuthority.receivingAgency }}</div>
              <div><strong>Đơn vị thẩm định:</strong> {{ result.competentAuthority.processingUnit }}</div>
            </div>

            <!-- Tóm tắt Định vị Không gian trong Kết quả -->
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--text2)">
              <div style="display:flex;align-items:center;gap:6px">
                <i class="ti ti-map-pin" style="color:var(--accent)"></i>
                <span><strong>Vị trí:</strong> {{ diaChiHienThi || tinh || 'Chưa ghi nhận địa chỉ' }}</span>
              </div>
              <span style="font-family:monospace;color:var(--text3)">
                ({{ latitude.toFixed(5) }}, {{ longitude.toFixed(5) }})
              </span>
            </div>
          </div>

          <!-- Nhóm cảnh báo đã điều chỉnh, có thể thu gọn -->
          <div v-if="result.nangNhom.length" class="upgrade-box" style="padding:10px 14px;border-radius:var(--radius);margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px">
              <div class="upgrade-title" style="margin-bottom:0">
                <i class="ti ti-alert-triangle"></i>
                <span>Điều chỉnh nâng nhóm / chuyển đổi hồ sơ ({{ result.nangNhom.length }} mục)</span>
              </div>
              <button type="button"
                      class="btn-ghost btn-sm"
                      style="padding:2px 8px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px"
                      @click="showNangNhomNotice = !showNangNhomNotice">
                <span>{{ showNangNhomNotice ? 'Thu gọn ▴' : 'Coi mục lưu ý ▾' }}</span>
              </button>
            </div>
            <div v-show="showNangNhomNotice" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
              <div v-for="n in result.nangNhom" :key="n.text" class="upgrade-item">
                • {{ n.text }} <span style="font-size:11.5px;color:var(--text3)">({{ n.ref }})</span>
              </div>
            </div>
          </div>

          <!-- Cảnh báo vùng nhạy cảm, có thể thu gọn -->
          <div v-for="(c, cIdx) in result.cauNhom" :key="c.text" :class="c.type === 'warn' ? 'upgrade-box' : 'phanlky-box'" style="padding:10px 14px;border-radius:var(--radius);margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px">
              <div :class="c.type === 'warn' ? 'upgrade-title' : 'phanlky-title'" style="margin-bottom:0">
                <i class="ti" :class="c.type === 'warn' ? 'ti-alert-circle' : 'ti-info-circle'"></i>
                <span>Lưu ý pháp lý &amp; Yếu tố nhạy cảm</span>
              </div>
              <button type="button"
                      class="btn-ghost btn-sm"
                      style="padding:2px 8px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px"
                      @click="toggleSensitiveNotice(cIdx)">
                <span>{{ isSensitiveNoticeExpanded(cIdx) ? 'Thu gọn ▴' : 'Coi mục lưu ý ▾' }}</span>
              </button>
            </div>
            <div v-show="isSensitiveNoticeExpanded(cIdx)" :class="c.type === 'warn' ? 'upgrade-item' : 'phanlky-text'" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
              {{ c.text }} <span style="font-size:11.5px;color:var(--text3)">({{ c.ref }})</span>
            </div>
          </div>

          <!-- Thông tin bổ sung, có thể thu gọn -->
          <div v-for="(i, iIdx) in result.infoExtra" :key="i.text" class="phanlky-box" style="padding:10px 14px;border-radius:var(--radius);margin-bottom:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px">
              <div class="phanlky-title" style="margin-bottom:0">
                <i class="ti ti-bulb"></i>
                <span>Hướng dẫn nghiệp vụ</span>
              </div>
              <button type="button"
                      class="btn-ghost btn-sm"
                      style="padding:2px 8px;font-size:11.5px;display:inline-flex;align-items:center;gap:4px"
                      @click="toggleInfoNotice(iIdx)">
                <span>{{ isInfoNoticeExpanded(iIdx) ? 'Thu gọn ▴' : 'Coi mục lưu ý ▾' }}</span>
              </button>
            </div>
            <div v-show="isInfoNoticeExpanded(iIdx)" class="phanlky-text" style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
              {{ i.text }} <span style="font-size:11.5px;color:var(--text3)">({{ i.ref }})</span>
            </div>
          </div>

          <!-- Dự án lân cận trong bán kính 15km (Đánh giá tác động cộng hưởng) -->
          <div v-if="spatialData?.nearbyProjects?.length" class="law-ref-block" style="margin-bottom:16px">
            <div class="law-ref-title">
              <i class="ti ti-affiliate" style="color:var(--accent)"></i>
              <span>Dự án lân cận trong bán kính 15 km ({{ spatialData.nearbyProjects.length }} dự án)</span>
            </div>
            <div v-for="np in spatialData.nearbyProjects" :key="np.id" class="law-ref-item" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-direction:row">
              <div>
                <div style="font-weight:600;font-size:13px;color:var(--text)">{{ np.name }}</div>
                <div style="font-size:11.5px;color:var(--text3)">{{ np.dia_chi }} • Cách {{ np.distanceKm }} km</div>
              </div>
              <div style="display:flex;gap:6px;align-items:center">
                <span class="chip chip-gray" style="font-size:11px">{{ np.nhom }} ({{ np.hs }})</span>
              </div>
            </div>
          </div>

          <!-- Danh sách văn bản được áp dụng -->
          <div class="law-ref-block">
            <div class="law-ref-title">
              <i class="ti ti-book" style="color:var(--accent)"></i>
              <span>Hệ thống văn bản pháp lý áp dụng</span>
            </div>
            <div v-for="r in result.lr" :key="r.num" class="law-ref-item" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-direction:row">
              <div style="flex:1">
                <div class="law-ref-num">{{ r.num }}</div>
                <div class="law-ref-desc">{{ r.desc }}</div>
              </div>
              <button v-if="r.law_id" type="button" class="btn-secondary btn-sm" @click="emit('view-law', r.law_id)">
                <span>Tra cứu</span>
                <i class="ti ti-arrow-up-right"></i>
              </button>
            </div>
          </div>

          <!-- Danh sách hồ sơ cần chuẩn bị -->
          <div class="checklist-block" v-if="result.cl">
            <div class="checklist-title">
              <i class="ti ti-checklist" style="color:var(--accent)"></i>
              <span>Danh mục tài liệu cần chuẩn bị</span>
              <span class="chip chip-gray" style="margin-left:auto">
                {{ checkedTotalCount }}/{{ totalDocsCount }} hoàn tất ({{ progressPercent }}%)
              </span>
            </div>

            <div class="progress-bar" style="margin:0 0 14px">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>

            <div style="font-size:11.5px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin:4px 0 8px">
              Tài liệu bắt buộc
            </div>
            <div v-for="(item, i) in result.cl.bat_buoc" :key="'req-'+i" class="cl-item" @click="toggleChecklistItem(i)">
              <div class="cl-box" :class="{ done: checklistState[i] }"></div>
              <div>
                <div class="cl-text" :class="{ done: checklistState[i] }">{{ item }}</div>
                <div class="cl-required">Bắt buộc</div>
              </div>
            </div>

            <template v-if="result.cl.bo_sung && result.cl.bo_sung.length">
              <div style="font-size:11.5px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin:16px 0 8px">
                Tài liệu bổ sung (tùy trường hợp)
              </div>
              <div v-for="(item, i) in result.cl.bo_sung" :key="'opt-'+i" class="cl-item" @click="toggleChecklistItem(result.cl.bat_buoc.length + i)">
                <div class="cl-box" :class="{ done: checklistState[result.cl.bat_buoc.length + i] }"></div>
                <div>
                  <div class="cl-text" :class="{ done: checklistState[result.cl.bat_buoc.length + i] }">{{ item }}</div>
                </div>
              </div>
            </template>
          </div>

          <!-- Lịch sử quan trắc QCVN -->
          <div v-if="projectId" class="card" style="margin-bottom:0">
            <div class="card-title" style="margin-bottom:12px">
              <i class="ti ti-flask-2"></i>
              <span>Mẫu quan trắc QCVN liên kết với dự án</span>
            </div>
            <div v-if="qcvnHistory.length === 0" style="font-size:13px;color:var(--text3);text-align:center;padding:18px 0">
              Chưa có mẫu quan trắc nào được liên kết với dự án này.
            </div>
            <div v-else style="display:flex;flex-direction:column;gap:8px">
              <div v-for="h in qcvnHistory" :key="h.id"
                   @click="handleViewQcvnSample(h.id)"
                   style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);cursor:pointer">
                <div style="flex:1;min-width:0;padding-right:12px">
                  <div style="font-weight:600;font-size:13.5px;color:var(--text)">{{ h.name }}</div>
                  <div style="font-size:11.5px;color:var(--text3);margin-top:2px">
                    Ngày lưu: {{ new Date(h.created_at).toLocaleDateString('vi-VN') }}
                  </div>
                </div>
                <span class="chip-status" :class="h.trang_thai_tong_quat === 'vuot_nguong' ? 'expired' : (h.trang_thai_tong_quat === 'canh_bao' || h.trang_thai_tong_quat === 'chua_du_thong_so' || h.trang_thai_tong_quat === 'can_ra_soat') ? 'amended' : 'valid'">
                  {{ h.trang_thai_tong_quat === 'vuot_nguong' ? 'Vượt ngưỡng' : h.trang_thai_tong_quat === 'canh_bao' ? 'Cảnh báo' : h.trang_thai_tong_quat === 'chua_du_thong_so' ? 'Chưa đủ thông số' : h.trang_thai_tong_quat === 'can_ra_soat' ? 'Cần rà soát' : 'Đạt chuẩn' }}
                </span>
              </div>
              <div v-if="qcvnHistoryTotalPages > 1" class="pagination-container">
                <button type="button" class="pagination-btn" :disabled="qcvnHistoryPage === 1" @click="fetchQcvnHistory(projectId, qcvnHistoryPage - 1)">&lt;</button>
                <button v-for="pg in qcvnHistoryTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === qcvnHistoryPage }" @click="fetchQcvnHistory(projectId, pg)">{{ pg }}</button>
                <button type="button" class="pagination-btn" :disabled="qcvnHistoryPage === qcvnHistoryTotalPages" @click="fetchQcvnHistory(projectId, qcvnHistoryPage + 1)">&gt;</button>
              </div>
            </div>
          </div>

          <!-- Lịch nhắc hạn & Nghĩa vụ định kỳ -->
          <div v-if="projectId" class="card" style="margin-top:16px;margin-bottom:0">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              <div class="card-title" style="margin-bottom:0">
                <i class="ti ti-calendar-event"></i>
                <span>Lịch nhắc hạn &amp; Nghĩa vụ định kỳ</span>
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn-secondary btn-sm" :disabled="reminderSubmitting" @click="syncDefaultReminders">
                  <i class="ti ti-wand"></i>
                  <span>Tạo lịch theo hồ sơ</span>
                </button>
                <button type="button" class="btn-secondary btn-sm" @click="showAddReminderForm = !showAddReminderForm">
                  <i class="ti" :class="showAddReminderForm ? 'ti-x' : 'ti-plus'"></i>
                  <span>{{ showAddReminderForm ? 'Đóng' : 'Thêm mốc hạn' }}</span>
                </button>
              </div>
            </div>

            <div v-if="reminderMsg" style="margin-bottom:10px;padding:8px 12px;border-radius:var(--radius-sm);background:var(--bg);border:1px solid var(--border);font-size:12.5px;color:var(--text2)">
              {{ reminderMsg }}
            </div>

            <div v-if="showAddReminderForm" style="padding:12px;margin-bottom:12px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg)">
              <div class="form-grid-2" style="gap:10px">
                <div>
                  <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Tiêu đề nghĩa vụ</label>
                  <input v-model="reminderForm.tieu_de" type="text" placeholder="Ví dụ: Nộp báo cáo công tác BVMT năm 2026" />
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Ngày đến hạn</label>
                  <input v-model="reminderForm.han_nop" type="date" />
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Chu kỳ lặp</label>
                  <select v-model="reminderForm.chu_ky">
                    <option v-for="opt in REMINDER_RECURRENCE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
                <div>
                  <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Nhắc trước (ngày)</label>
                  <input v-model.number="reminderForm.so_ngay_nhac_truoc" type="number" min="0" max="365" />
                </div>
              </div>
              <div style="margin-top:10px">
                <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Căn cứ pháp lý (tùy chọn)</label>
                <input v-model="reminderForm.can_cu_phap_ly" type="text" placeholder="Ví dụ: Điều 66, Thông tư 02/2022/TT-BTNMT" />
              </div>
              <div style="margin-top:10px;display:flex;justify-content:flex-end">
                <button type="button" class="btn-primary btn-sm" :disabled="reminderSubmitting || !reminderForm.tieu_de" @click="submitNewReminder">
                  <i class="ti ti-device-floppy"></i>
                  <span>Lưu mốc nhắc hạn</span>
                </button>
              </div>
            </div>

            <div v-if="loadingReminders" style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">
              Đang tải lịch nhắc hạn...
            </div>
            <div v-else-if="projectReminders.length === 0" style="font-size:13px;color:var(--text3);text-align:center;padding:16px 0">
              Chưa có mốc nhắc hạn nào cho dự án này. Bấm "Tạo lịch theo hồ sơ" để tự động khởi tạo.
            </div>
            <div v-else style="display:flex;flex-direction:column;gap:8px">
              <div v-for="rem in projectReminders" :key="rem.id"
                   style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
                <div style="flex:1;min-width:200px">
                  <div style="font-weight:600;font-size:13.5px;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span>{{ rem.tieu_de }}</span>
                    <span class="chip chip-gray" style="height:20px;font-size:11px;padding:0 7px">{{ rem.nhan_chu_ky }}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text3);margin-top:3px">
                    Hạn nộp: <strong style="color:var(--text2)">{{ new Date(rem.han_nop).toLocaleDateString('vi-VN') }}</strong>
                    <span v-if="rem.can_cu_phap_ly"> · {{ rem.can_cu_phap_ly }}</span>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="chip" :style="{
                    background: getReminderBadgeMeta(rem.muc_canh_bao).badgeBg,
                    color: getReminderBadgeMeta(rem.muc_canh_bao).badgeColor,
                    border: '1px solid ' + getReminderBadgeMeta(rem.muc_canh_bao).badgeBorder,
                    fontWeight: 600
                  }">
                    {{ rem.nhan_trang_thai }}
                  </span>
                  <button v-if="rem.trang_thai === 'chua_hoan_thanh'" type="button" class="btn-secondary btn-sm"
                          :disabled="reminderSubmitting" @click="completeProjectReminder(rem)">
                    <i class="ti ti-check"></i>
                    <span>Hoàn thành</span>
                  </button>
                  <button type="button" class="btn-secondary btn-sm" :disabled="reminderSubmitting" @click="deleteProjectReminder(rem)" title="Xóa mốc nhắc hạn">
                    <i class="ti ti-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <SavedProjectsDrawer
      :visible="showProjectsDrawer"
      :projects="projects"
      :loading="isLoadingProjects"
      :error-message="projectsLoadError"
      :selected-project-id="projectId"
      :current-page="currentPage"
      :total-pages="totalPages"
      @close="showProjectsDrawer = false"
      @create="createNewProject(); showProjectsDrawer = false"
      @select="selectProject($event); showProjectsDrawer = false"
      @remove="handleDeleteProject"
      @change-page="fetchProjects"
    />
  </div>
</template>

<style scoped>
.location-mismatch-banner {
  background: #FFFBEB;
  border: 1px solid #FCD34D;
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(217, 119, 6, 0.08);
  animation: fadeInDown 0.25s ease-out;
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mismatch-banner-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 10px;
}

.mismatch-header-left {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.mismatch-icon {
  font-size: 20px;
  color: #D97706;
  flex-shrink: 0;
  margin-top: 1px;
}

.mismatch-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mismatch-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #92400E;
}

.mismatch-subtitle {
  font-size: 12px;
  color: #B45309;
}

.mismatch-close-btn {
  background: transparent;
  border: none;
  color: #B45309;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
  transition: background 0.15s;
}

.mismatch-close-btn:hover {
  background: rgba(217, 119, 6, 0.15);
}

.mismatch-body-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.mismatch-row-card {
  background: #FFFFFF;
  border: 1px solid #FDE68A;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mismatch-row-card.new-box {
  border-color: #93C5FD;
  background: #F0F9FF;
}

.mismatch-row-header {
  display: flex;
  align-items: center;
}

.mismatch-row-content {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 20px;
}

.mismatch-box-tag {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #78350F;
  display: flex;
  align-items: center;
  gap: 5px;
}

.mismatch-box-tag.new-tag {
  color: #1E40AF;
}

.mismatch-loc-detail {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mismatch-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 12.5px;
}

.m-label {
  color: #64748B;
  font-size: 11.5px;
  min-width: 100px;
  flex-shrink: 0;
}

.m-val {
  color: #0F172A;
  font-weight: 600;
}

.m-val.text-accent {
  color: #2563EB;
}

.m-val-sub {
  color: #475569;
  font-size: 12px;
}

.mismatch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-mismatch-apply {
  background: #2563EB;
  color: #FFFFFF;
  border: 1px solid #1D4ED8;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-mismatch-apply:hover {
  background: #1D4ED8;
}

.btn-mismatch-revert {
  background: #FFFFFF;
  color: #475569;
  border: 1px solid #CBD5E1;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-mismatch-revert:hover {
  background: #F8FAFC;
  color: #0F172A;
  border-color: #94A3B8;
}

.gis-studio-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-xs);
}

.gis-status-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.gis-status-pill.confirmed {
  background: var(--success-bg);
  color: var(--success);
  border: 1px solid var(--success-border);
}

.gis-status-pill.pending {
  background: var(--warn-bg);
  color: var(--warn);
  border: 1px solid var(--warn-border);
}

.scope-chip {
  font-size: 11px;
  color: var(--accent);
  background: var(--accent2);
  padding: 2px 8px;
  border-radius: 999px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-input-wrap {
  position: relative;
}

.search-left-icon {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text3);
  font-size: 15px;
}

.search-clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: var(--text3);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: var(--radius-sm);
  transition: background-color 0.15s ease, color 0.15s ease;
}

.search-clear-btn:hover {
  background: var(--surface2);
  color: var(--text);
}

.gis-search-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  z-index: 1200;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
}

.dropdown-hint {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text2);
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.gis-search-item {
  padding: 8px 12px;
  font-size: 12.5px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
  transition: background 0.12s ease;
}

.gis-search-item:last-child {
  border-bottom: none;
}

.gis-search-item:hover {
  background: var(--accent2);
}

.cand-num {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cand-title {
  color: var(--text);
  font-weight: 500;
  line-height: 1.35;
}

.cand-type-badge {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── BẢN ĐỒ GIS MINI-MAP ── */
.mini-map-wrapper {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface2);
  margin-top: 4px;
  margin-bottom: 14px;
  box-shadow: 0 1px 3px rgba(25, 42, 33, 0.04);
}

.mini-map-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.map-mode-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--surface2);
  padding: 2px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.map-mode-tab {
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text2);
  font-size: 11.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.map-mode-tab:hover {
  color: var(--text);
  background: var(--surface);
}

.map-mode-tab.active {
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 1px 2px rgba(40, 107, 79, 0.2);
}

.map-action-toggles {
  display: flex;
  align-items: center;
  gap: 6px;
}

.map-toggle-btn {
  height: 26px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text2);
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.map-toggle-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.map-toggle-btn.active {
  background: var(--accent2);
  border-color: var(--accent);
  color: var(--accent);
}

.map-toggle-btn.icon-btn {
  padding: 0 6px;
  font-size: 13px;
}

.mini-map-canvas {
  height: 330px;
  width: 100%;
  background: #eef2ef;
}

.mini-map-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 7px 10px;
  background: var(--bg);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text2);
}

.legend-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  font-size: 11px;
}

.legend-chip .dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}

.selected-zone-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  background: var(--accent2);
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  font-size: 12.5px;
  color: var(--text);
}

/* ── HỘP PHÂN TÍCH KHÔNG GIAN GIS ── */
.spatial-intel-box {
  margin-top: 14px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  font-size: 12px;
  box-shadow: 0 1px 2px rgba(25, 42, 33, 0.03);
}

.spatial-intel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.spatial-intel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  color: var(--text);
  font-size: 12px;
}

.spatial-intel-title i {
  color: var(--accent);
  font-size: 15px;
}

.spatial-metrics {
  display: flex;
  gap: 6px;
  font-size: 11px;
}

.metric-pill {
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--surface2);
  color: var(--text2);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.metric-pill.danger {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--danger-border);
}

.metric-pill.warn {
  background: var(--warn-bg);
  color: var(--warn);
  border-color: var(--warn-border);
}

.text-danger {
  color: var(--red);
}

.text-warn {
  color: var(--warn);
}

.spatial-alerts-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.spatial-alert-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
}

.spatial-alert-item.danger {
  background: var(--red-bg);
  color: var(--red);
  border: 1px solid rgba(214, 91, 91, 0.25);
}

.spatial-alert-item.warn {
  background: var(--warn-bg);
  color: #9A6715;
  border: 1px solid rgba(217, 154, 56, 0.25);
}

.spatial-alert-item.info {
  background: var(--info-bg);
  color: var(--info);
  border: 1px solid rgba(86, 129, 165, 0.25);
}

.auto-check-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
}

.spatial-safe-note {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text2);
  font-size: 12px;
}

.check-item.auto-flagged {
  border-color: var(--accent);
  background: var(--accent2);
  font-weight: 600;
}
</style>

<style>
#mini-map {
  z-index: 0;
}
#mini-map .leaflet-pane {
  z-index: 400;
}
#mini-map .leaflet-tile-pane {
  z-index: 200;
}
#mini-map .leaflet-tile,
#mini-map img.leaflet-tile {
  display: block !important;
  visibility: visible !important;
  opacity: 1 !important;
  max-width: none !important;
  max-height: none !important;
  width: 256px !important;
  height: 256px !important;
}
.candidate-num-pin {
  background: transparent !important;
  border: none !important;
}

.candidate-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #2563EB;
  color: #ffffff;
  font-weight: 700;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  cursor: pointer;
}
.admin-lookup-message {
  margin-top: 6px;
  color: #9a5b13;
  font-size: 12px;
  line-height: 1.4;
}
</style>
