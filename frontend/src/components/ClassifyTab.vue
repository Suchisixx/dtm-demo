<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getCapacityLabel } from '../services/classification-rules.js'
import divisions from '../data/vietnam-divisions.json'
import SearchableSelect from './SearchableSelect.vue'
import {
  DEFAULT_LAT,
  DEFAULT_LNG,
  CARTO_VOYAGER_URL,
  CARTO_ATTRIBUTION,
  OSM_LANDUSE_URL,
  OSM_ATTRIBUTION,
  ESRI_IMAGERY_URL,
  OVERPASS_URL,
  LANDUSE_STYLES,
  EMBEDDED_GIS_LAYERS,
  NOMINATIM_URL,
  API,
  PROVINCE_COORDINATES,
  NHOM_COLORS,
  projectQcvnSamples
} from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'

const props = defineProps({
  loadProjectId: { type: Number, default: null }
})
const emit = defineEmits(['project-loaded', 'view-qcvn-sample', 'view-law'])

// Form State
const projectId = ref(null)
const name = ref('')
const nganh = ref('')
const capacity = ref(0)
const nt = ref(0)
const kt = ref(0)
const tinh = ref('')
const latitude = ref(DEFAULT_LAT)
const longitude = ref(DEFAULT_LNG)

// GIS State
const diaChiHienThi = ref('')
const quanHuyen = ref('')
const phuongXa = ref('')
const addressSearch = ref('')
const addressResults = ref([])
const isSearchingAddress = ref(false)
const locationConfirmed = ref(false)
const classificationSnapshot = ref(null)
const activeBaseMap = ref('voyager') // 'voyager' | 'landuse' | 'satellite'
const showLanduseOverlay = ref(true)
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

// Cascading dropdown state sau sáp nhập (Tỉnh/TP -> Phường/Xã trực tiếp)
const selectedProvince = ref(null)
const selectedWard = ref(null)

const wardList = computed(() => {
  if (!selectedProvince.value) return []
  const prov = divisions.find(p => String(p.code) === String(selectedProvince.value))
  if (!prov) return []

  // Đếm số lần xuất hiện của tên phường/xã trong Tỉnh/TP để phát hiện trùng lặp
  const nameCounts = new Map()
  for (const dist of (prov.districts || [])) {
    for (const ward of (dist.wards || [])) {
      if (ward && ward.name) {
        nameCounts.set(ward.name, (nameCounts.get(ward.name) || 0) + 1)
      }
    }
  }

  const list = []
  const seenCodes = new Set()
  for (const dist of (prov.districts || [])) {
    for (const ward of (dist.wards || [])) {
      if (ward && ward.name) {
        const code = String(ward.code || `${ward.name}_${dist.code || dist.name}`)
        if (!seenCodes.has(code)) {
          seenCodes.add(code)
          const isDupe = (nameCounts.get(ward.name) || 0) > 1
          // Nếu trùng tên (như Phường 1, Phường 2... ở các quận khác nhau), hiển thị kèm tên Quận/Huyện để phân biệt rõ ràng
          const displayName = isDupe && dist.name ? `${ward.name} (${dist.name})` : ward.name
          list.push({
            code: code,
            name: displayName,
            wardName: ward.name,
            districtName: dist.name || '',
            subText: ward.subText || '',
            alias: ward.alias || '',
            lat: ward.lat,
            lng: ward.lng
          })
        }
      }
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
})

const activeScopeLabel = computed(() => {
  const parts = []
  if (phuongXa.value) parts.push(phuongXa.value)
  if (tinh.value) parts.push(tinh.value)
  return parts.length > 0 ? parts.join(', ') : 'Toàn quốc'
})

// Special flags (Đầy đủ 8 yếu tố nhạy cảm Điều 25 Luật BVMT 2020 + 6 cờ nghiệp vụ)
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

// Saved projects state
const projects = ref([])
const currentPage = ref(1)
const totalPages = ref(1)

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

// Result state
const result = ref(null)
const checklistState = ref({})

// Leaflet Map & Layer Groups
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
  try {
    const res = await fetch(`${API.PROJECTS}?page=${page}&limit=5`)
    if (res.status === 401) return
    const data = await res.json()
    projects.value = data.projects || []
    totalPages.value = data.pagination?.totalPages || 1
    currentPage.value = page
  } catch (err) {
    logger.error('Lỗi khi fetch projects:', err)
  }
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

  if (mode === 'voyager') {
    // Bản đồ Đường phố & Địa danh tiếng Việt hiện đại (Google Maps Road Vietnam - Free, No API Key)
    baseTileLayer = window.L.tileLayer(CARTO_VOYAGER_URL, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: CARTO_ATTRIBUTION
    }).addTo(mapInstance)
  } else if (mode === 'satellite') {
    // Ảnh Vệ tinh tích hợp sẵn nhãn đường phố & địa danh tiếng Việt (Google Hybrid - Free, No API Key)
    baseTileLayer = window.L.tileLayer(ESRI_IMAGERY_URL, {
      maxZoom: 20,
      subdomains: ['0', '1', '2', '3'],
      attribution: '&copy; Google Satellite Hybrid'
    }).addTo(mapInstance)
  } else {
    // 'landuse' — Bản đồ Phân vùng Quy hoạch & Sử dụng đất (HOT OSM Landuse - Khu công nghiệp, Khu dân cư, Nông lâm nghiệp)
    baseTileLayer = window.L.tileLayer(OSM_LANDUSE_URL, {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: OSM_ATTRIBUTION
    }).addTo(mapInstance)

    // Khi bật chế độ Phân vùng, tự động bật lớp đa giác Khu đất và tải dữ liệu phân vùng
    if (!showLanduseOverlay.value) {
      showLanduseOverlay.value = true
    }
    loadLanduseZonesInView()
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
    alert('Trình duyệt của bạn không hỗ trợ định vị GPS.')
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
      alert('Không thể truy cập vị trí hiện tại. Vui lòng kiểm tra quyền truy cập vị trí của trình duyệt.')
    }
  )
}

/**
 * Gọi API Backend kiểm tra khoảng cách không gian (Biên giới, Bờ biển, Khu bảo tồn, Nguồn nước, KCN...)
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
 * Đồng bộ ngược Tỉnh/TP và Phường/Xã về SearchableSelect khi chấm bản đồ hoặc chọn kết quả tìm kiếm
 */
const syncAdminSelectorsFromAddress = (address = {}) => {
  const rawState = address.state || address.city || address.province || ''
  const rawWard = address.suburb || address.quarter || address.village || address.town || address.Ward || address.ward || address.neighbourhood || address.hamlet || ''

  if (rawState) {
    const matchedProvValue = findMatchingProvince(rawState)
    if (matchedProvValue) {
      tinh.value = matchedProvValue
    }
    const cleanState = normalizeString(rawState).replace('tinh ', '').replace('thanh pho ', '').replace('tp. ', '')
    const foundDiv = divisions.find(p => {
      const cleanDiv = normalizeString(p.name).replace('tinh ', '').replace('thanh pho ', '').replace('tp. ', '')
      return cleanDiv.includes(cleanState) || cleanState.includes(cleanDiv)
    })
    if (foundDiv) {
      selectedProvince.value = foundDiv.code
      if (!tinh.value) {
        tinh.value = findMatchingProvince(foundDiv.name) || foundDiv.name
      }
    }
  }

  if (rawWard) {
    phuongXa.value = rawWard
    nextTick(() => {
      const cleanW = normalizeString(rawWard).replace(/^(phuong|xa|thi tran)\s+/, '')
      const matchedW = wardList.value.find(w => {
        const targetName = w.wardName || w.name
        const cw = normalizeString(targetName).replace(/^(phuong|xa|thi tran)\s+/, '')
        const aliasClean = normalizeString(w.alias || '')
        return cw === cleanW || cw.includes(cleanW) || cleanW.includes(cw) || (aliasClean && aliasClean.includes(cleanW))
      })
      if (matchedW) {
        selectedWard.value = matchedW.code
        phuongXa.value = matchedW.wardName || matchedW.name
        if (matchedW.districtName) {
          quanHuyen.value = matchedW.districtName
        }
      } else {
        selectedWard.value = rawWard
      }
    })
  }
}

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`)
    if (res.ok) {
      const data = await res.json()
      const address = data.address || {}
      const state = address.state || address.city || address.province || ''
      const wardName = address.quarter || address.village || address.suburb || address.town || address.hamlet || address.neighbourhood || address.ward || ''
      const road = address.industrial || address.commercial || address.amenity || address.building || address.road || address.pedestrian || address.street || ''

      syncAdminSelectorsFromAddress(address)
      locationConfirmed.value = true

      // Tự động nhận diện nếu reverse geocode trúng Khu công nghiệp
      if (address.industrial || (data.display_name && normalizeString(data.display_name).includes('khu cong nghiep'))) {
        kcn.value = true
        if (!autoDetectedFlags.value.includes('kcn')) {
          autoDetectedFlags.value.push('kcn')
        }
      }

      const parts = []
      if (road) parts.push(road)
      if (wardName || phuongXa.value) parts.push(wardName || phuongXa.value)
      if (state || tinh.value) parts.push(state || tinh.value)

      if (parts.length > 0) {
        diaChiHienThi.value = parts.join(', ')
      } else if (data.display_name) {
        diaChiHienThi.value = data.display_name
      } else {
        updateFallbackAddress(lat, lng)
      }
    } else {
      updateFallbackAddress(lat, lng)
    }
  } catch (err) {
    logger.error('Lỗi reverse geocoding:', err)
    updateFallbackAddress(lat, lng)
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

const capacityLabel = computed(() => {
  return getCapacityLabel(nganh.value)
})

const handleClassify = async (shouldSave = true) => {
  if (shouldSave) {
    if (!name.value || !name.value.trim()) { alert('Vui lòng nhập tên dự án!'); return }
    if (!nganh.value) { alert('Vui lòng chọn loại hình dự án!'); return }
    if (parseFloat(capacity.value) < 0) { alert('Vui lòng nhập quy mô / công suất hợp lệ!'); return }
    if (!tinh.value && !selectedProvince.value) { alert('Vui lòng chọn Tỉnh / Thành phố hoặc chấm vị trí trên bản đồ!'); return }
  } else {
    if (!nganh.value) return
  }

  const formData = {
    nganh: nganh.value,
    capacity: parseFloat(capacity.value) || 0,
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
    epr: epr.value
  }

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
        classificationSnapshot.value = {
          hs: data.result.hs,
          nhom: data.result.nhom,
          coQuan: data.result.coQuan,
          thoiHan: data.result.thoiHan,
          tq: data.result.tq,
          impactRadiusMeters: data.result.impactRadiusMeters
        }
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
        phuong_xa: phuongXa.value || null,
        classification_result: classificationSnapshot.value || null
      })
    })

    if (res.ok) {
      const data = await res.json()
      projectId.value = data.project.id
      fetchProjects(currentPage.value)
    }
  } catch (err) {
    logger.error('Lỗi lưu dự án:', err)
  }
}

const selectProject = (project) => {
  if (!project) return
  projectId.value = project.id
  name.value = project.name || ''

  const fd = project.form_data || {}
  nganh.value = fd.nganh || ''
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

  latitude.value = project.latitude ? parseFloat(project.latitude) : (fd.latitude ? parseFloat(fd.latitude) : DEFAULT_LAT)
  longitude.value = project.longitude ? parseFloat(project.longitude) : (fd.longitude ? parseFloat(fd.longitude) : DEFAULT_LNG)
  diaChiHienThi.value = project.dia_chi_hien_thi || ''
  quanHuyen.value = project.quan_huyen || ''
  phuongXa.value = project.phuong_xa || ''
  classificationSnapshot.value = project.classification_result || null
  locationConfirmed.value = !!(project.latitude || fd.latitude)

  if (tinh.value) {
    const prov = divisions.find(p => p.name.includes(tinh.value) || tinh.value.includes(p.name))
    if (prov) {
      selectedProvince.value = prov.code
    }
  }
  if (phuongXa.value) {
    selectedWard.value = phuongXa.value
  }

  checklistState.value = project.checklist_state || {}

  if (mapInstance && markerInstance) {
    const latLng = [latitude.value, longitude.value]
    mapInstance.setView(latLng, 14)
    markerInstance.setLatLng(latLng)
  }

  handleClassify(false)
  runSpatialCheck(latitude.value, longitude.value)
  fetchQcvnHistory(project.id)
}

const createNewProject = () => {
  projectId.value = null
  name.value = ''
  nganh.value = ''
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
    }
  } catch (err) {
    logger.error('Lỗi khi xóa dự án:', err)
  }
}

const toggleChecklistItem = (itemIndex) => {
  checklistState.value[itemIndex] = !checklistState.value[itemIndex]
  if (projectId.value) {
    const formData = {
      nganh: nganh.value,
      capacity: parseFloat(capacity.value) || 0,
      nt: parseFloat(nt.value) || 0,
      kt: parseFloat(kt.value) || 0,
      tinh: tinh.value,
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
      epr: epr.value
    }
    saveProjectToServer(formData)
  }
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
      const provObj = divisions.find(p => String(p.code) === String(selectedProvince.value))
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

      // Fallback nếu truy vấn ghép Phường/Xã quá chặt không ra kết quả -> tìm trong phạm vi Tỉnh/TP
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
  diaChiHienThi.value = item.display_name

  if (item.address) {
    syncAdminSelectorsFromAddress(item.address)
  }

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

  setCoordinatesAndAnalyze(lat, lng, false)

  if (mapInstance) {
    mapInstance.flyTo([lat, lng], 15, { duration: 0.9 })
  }
}

/**
 * Vẽ ranh giới hành chính (Polygon / BoundingBox) khi người dùng chọn Tỉnh/TP hoặc Phường/Xã
 */
const highlightAdministrativeBoundary = async (queryCandidates, targetZoom = 14) => {
  const candidates = Array.isArray(queryCandidates) ? queryCandidates : [queryCandidates]
  try {
    for (const queryText of candidates) {
      if (!queryText) continue
      const q = encodeURIComponent(`${queryText}, Việt Nam`)
      const res = await fetch(
        `${NOMINATIM_URL}/search?q=${q}&format=jsonv2&countrycodes=vn&polygon_geojson=1&polygon_threshold=0.0005&limit=5&accept-language=vi`
      )
      if (!res.ok) continue
      const list = await res.json()
      if (!list || list.length === 0) continue

      // Ưu tiên kết quả có Polygon/MultiPolygon thực sự, nếu không có thì lấy kết quả đầu tiên
      const best = list.find(it => it.geojson && (it.geojson.type === 'Polygon' || it.geojson.type === 'MultiPolygon')) || list[0]
      const lat = parseFloat(best.lat)
      const lng = parseFloat(best.lon)

      let bboxSouth = lat - 0.018
      let bboxNorth = lat + 0.018
      let bboxWest = lng - 0.018
      let bboxEast = lng + 0.018

      if (best.boundingbox && best.boundingbox.length === 4) {
        const [s, n, w, e] = best.boundingbox.map(parseFloat)
        // Tránh trường hợp boundingbox của một điểm node (south == north)
        if (Math.abs(n - s) > 0.002 && Math.abs(e - w) > 0.002) {
          bboxSouth = s
          bboxNorth = n
          bboxWest = w
          bboxEast = e
        }
      }
      currentViewbox.value = [bboxWest, bboxNorth, bboxEast, bboxSouth]

      setCoordinatesAndAnalyze(lat, lng, false)

      if (boundaryLayerGroup && window.L) {
        boundaryLayerGroup.clearLayers()
        if (best.geojson && (best.geojson.type === 'Polygon' || best.geojson.type === 'MultiPolygon')) {
          const layer = window.L.geoJSON(best.geojson, {
            style: {
              color: '#286B4F',
              weight: 2.4,
              dashArray: '6, 4',
              fillColor: '#286B4F',
              fillOpacity: 0.08
            }
          })
          boundaryLayerGroup.addLayer(layer)
          if (mapInstance) {
            mapInstance.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: targetZoom })
          }
          return
        } else {
          // Vẽ khung khoanh vùng Bounding Box nếu địa phương chưa có Polygon chi tiết trên OSM
          const boundsRect = window.L.rectangle([[bboxSouth, bboxWest], [bboxNorth, bboxEast]], {
            color: '#286B4F',
            weight: 2,
            dashArray: '6, 4',
            fillColor: '#286B4F',
            fillOpacity: 0.06,
            interactive: false
          })
          boundaryLayerGroup.addLayer(boundsRect)
        }
      }

      if (mapInstance) {
        mapInstance.flyTo([lat, lng], targetZoom, { duration: 0.9 })
      }
      return
    }
  } catch (err) {
    logger.warn('Lỗi tải ranh giới hành chính:', err)
  }

  if (mapInstance && latitude.value && longitude.value) {
    mapInstance.flyTo([latitude.value, longitude.value], targetZoom, { duration: 0.9 })
  }
}

const onProvinceSelect = () => {
  selectedWard.value = null
  phuongXa.value = ''
  quanHuyen.value = ''
  currentViewbox.value = null
  if (boundaryLayerGroup) boundaryLayerGroup.clearLayers()

  if (!selectedProvince.value) return

  const prov = divisions.find(p => String(p.code) === String(selectedProvince.value) || p.name === selectedProvince.value)
  if (prov) {
    const matched = findMatchingProvince(prov.name)
    tinh.value = matched || prov.name
    diaChiHienThi.value = prov.name

    const paddedCode = String(prov.code).padStart(2, '0')
    const coords = PROVINCE_COORDINATES[paddedCode] || PROVINCE_COORDINATES[String(prov.code)]

    if (coords) {
      const [lat, lng] = coords
      setCoordinatesAndAnalyze(lat, lng, false)
      if (mapInstance) {
        mapInstance.flyTo([lat, lng], 11, { duration: 0.9 })
      }
    }
    const cleanProv = prov.name.replace(/^(Thành phố|Tỉnh)\s+/i, '')
    highlightAdministrativeBoundary([prov.name, cleanProv], 11)
  }
}

const onWardSelect = (selectedOpt) => {
  if (!selectedWard.value && !selectedOpt) return
  const ward = (selectedOpt && selectedOpt.wardName) ? selectedOpt : wardList.value.find(w => String(w.code) === String(selectedWard.value) || w.name === selectedWard.value || (w.wardName && w.wardName === selectedWard.value))
  if (ward) {
    const rawWardName = ward.wardName || ward.name.replace(/\s*\([^)]*\)$/, '')
    phuongXa.value = rawWardName
    quanHuyen.value = ward.districtName || ''
    const prov = divisions.find(p => String(p.code) === String(selectedProvince.value))
    const provName = prov ? prov.name : tinh.value
    const cleanProv = provName.replace(/^(Thành phố|Tỉnh)\s+/i, '')
    const cleanWard = rawWardName.replace(/^(Phường|Xã|Thị trấn)\s+/i, '')
    const cleanDist = (ward.districtName || '').replace(/^(Quận|Huyện|Thị xã|Thành phố)\s+/i, '')

    diaChiHienThi.value = ward.districtName 
      ? `${rawWardName}, ${ward.districtName}, ${provName}`
      : `${rawWardName}, ${provName}`
    locationConfirmed.value = true

    if (ward.lat && ward.lng) {
      setCoordinatesAndAnalyze(ward.lat, ward.lng, false)
      if (mapInstance) {
        mapInstance.flyTo([ward.lat, ward.lng], 14, { duration: 0.8 })
      }
    }

    const searchQueries = []
    if (ward.districtName) {
      searchQueries.push(`${rawWardName}, ${ward.districtName}, ${provName}`)
      searchQueries.push(`${cleanWard}, ${cleanDist}, ${cleanProv}`)
    }
    searchQueries.push(`${rawWardName}, ${provName}`)
    searchQueries.push(`${cleanWard}, ${cleanProv}`)

    // Khoanh vùng ranh giới Phường/Xã và tự động tải các phân khu KCN / Dân cư bên trong Phường/Xã
    highlightAdministrativeBoundary(searchQueries, 14).then(() => {
      if (showLanduseOverlay.value) {
        setTimeout(() => loadLanduseZonesInView(), 650)
      }
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
          selectProject(data.project)
        }
      }
    } catch (err) {
      logger.error('Lỗi tải dự án:', err)
    }
    emit('project-loaded')
  }
}, { immediate: true })

const showProjectsDrawer = ref(false)

onMounted(async () => {
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
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div>
        <h2 class="section-head">Phân loại Dự án &amp; Xác định Hồ sơ Môi trường</h2>
        <p class="section-desc">
          Nhập thông số kỹ thuật và định vị phân vùng không gian GIS để tự động xác định nhóm dự án, loại hồ sơ (ĐTM / GPMT / ĐKMT), cơ quan thẩm quyền và danh mục tài liệu.
        </p>
      </div>
    </div>

    <!-- TOP WORKSPACE PROJECT BAR -->
    <div class="workspace-bar">
      <div class="workspace-bar-left">
        <span style="font-size:12.5px;color:var(--text3);font-weight:500">Hồ sơ đang làm việc:</span>
        <div class="workspace-current-badge" :class="{ 'is-saved': !!projectId }">
          <i class="ti" :class="projectId ? 'ti-folder-check' : 'ti-file-plus'"></i>
          <span>{{ projectId ? (name || 'Dự án đã lưu') : 'Dự án mới (chưa lưu)' }}</span>
        </div>
      </div>

      <div class="workspace-bar-actions">
        <button type="button" class="btn-secondary btn-sm" @click="createNewProject">
          <i class="ti ti-plus"></i>
          <span>Tạo dự án mới</span>
        </button>
        <button type="button" class="btn-primary btn-sm" @click="showProjectsDrawer = true">
          <i class="ti ti-folders"></i>
          <span>Dự án đã lưu ({{ projects.length }})</span>
        </button>
      </div>
    </div>

    <!-- 2-COLUMN CLASSIFY STUDIO -->
    <div class="classify-studio-grid">
      <!-- LEFT COLUMN: INPUT FORM -->
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
          <select v-model="nganh">
            <option value="">Chọn ngành nghề dự án (28 nhóm ngành theo NĐ 08/2022 &amp; VBHN 49/2026)...</option>
            <optgroup label="Công nghiệp chế biến &amp; Chế tạo">
              <option value="che_bien_go">Chế biến gỗ / Sản xuất MDF, ván sàn</option>
              <option value="giay_bot">Giấy, bột giấy, carton</option>
              <option value="det_nhuom">Dệt, nhuộm, hoàn tất vải sợi</option>
              <option value="thuc_pham">Chế biến thực phẩm, đồ uống, thủy sản</option>
              <option value="hoa_chat">Hóa chất, phân bón NPK, thuốc BVTV</option>
              <option value="nhua_cao_su">Nhựa, cao su tổng hợp</option>
              <option value="cao_su_cb">Cao su chế biến (mủ khô)</option>
              <option value="duoc_pham">Dược phẩm, sinh phẩm, mỹ phẩm</option>
              <option value="xi_mang">Xi măng, clinker</option>
              <option value="thep">Luyện kim, sản xuất thép, phôi thép</option>
              <option value="vat_lieu_xd">Vật liệu xây dựng (gạch, ngói, gốm sứ)</option>
              <option value="dien_tu">Điện tử, bán dẫn, linh kiện công nghệ</option>
            </optgroup>
            <optgroup label="Khai thác Khoáng sản &amp; Năng lượng">
              <option value="khai_thac_ks">Khai thác khoáng sản rắn (than, quặng, đá, cát)</option>
              <option value="khai_thac_dau_khi">Khai thác dầu khí</option>
              <option value="nhiet_dien">Nhiệt điện (than, khí, sinh khối)</option>
              <option value="thuy_dien">Thủy điện, năng lượng tái tạo</option>
              <option value="dien_hat_nhan">Nhà máy điện hạt nhân</option>
            </optgroup>
            <optgroup label="Hạ tầng Kỹ thuật, Giao thông &amp; Môi trường">
              <option value="kcn">Khu công nghiệp / KCX / Khu công nghệ cao</option>
              <option value="do_thi">Khu đô thị, nhà ở, chung cư</option>
              <option value="trung_tam_tm">Trung tâm thương mại, siêu thị, văn phòng</option>
              <option value="cao_toc">Đường cao tốc, quốc lộ, đường sắt</option>
              <option value="san_bay">Cảng hàng không, sân bay</option>
              <option value="cang_bien">Cảng biển, bến cảng nước sâu</option>
              <option value="cang_song">Cảng thủy nội địa, bến sông</option>
              <option value="bai_rac">Khu xử lý, chôn lấp chất thải rắn / Rác thải</option>
              <option value="xl_nuoc_thai">Hệ thống xử lý nước thải tập trung</option>
              <option value="nao_vet">Nạo vét luồng hàng hải, kênh rạch</option>
            </optgroup>
            <optgroup label="Y tế, Du lịch &amp; Nông — Lâm — Thủy sản">
              <option value="benh_vien">Bệnh viện, phòng khám, cơ sở y tế</option>
              <option value="khach_san">Khách sạn, resort, khu du lịch sinh thái</option>
              <option value="nuoi_thuy_san">Nuôi trồng thủy sản (ao, lồng bè)</option>
              <option value="chan_nuoi">Chăn nuôi gia súc, gia cầm tập trung</option>
            </optgroup>
          </select>
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

        <!-- COMPACT MODERN GIS STUDIO -->
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

          <!-- Hàng 3: Khung Bản đồ chuyên nghiệp & Thanh công cụ phẳng -->
          <div class="mini-map-wrapper">
            <!-- Toolbar phẳng phía trên bản đồ -->
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
            </div>
          </div>

          <!-- Thông báo khi người dùng click chọn một Phân khu đất trên bản đồ -->
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
              <label class="form-label" style="font-size:12px;color:var(--text2)">Vĩ độ (Latitude)</label>
              <input type="number" step="0.000001" v-model.number="latitude" @change="onManualCoordChange" />
            </div>
            <div>
              <label class="form-label" style="font-size:12px;color:var(--text2)">Kinh độ (Longitude)</label>
              <input type="number" step="0.000001" v-model.number="longitude" @change="onManualCoordChange" />
            </div>
          </div>

          <!-- Hàng 6: Hộp Phân tích Không gian Tự động (Spatial Intelligence) -->
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
              <i class="ti ti-sparkles"></i> Tự động nhận diện từ tọa độ GIS
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

        <button type="button" class="btn-classify" style="width:100%;margin-top:6px" @click="handleClassify(true)">
          <i class="ti ti-calculator"></i>
          <span>Phân loại &amp; Xác định hồ sơ</span>
        </button>
      </div>

      <!-- RIGHT COLUMN: CLASSIFICATION RESULT -->
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
          <!-- Executive Summary Card -->
          <div class="result-hero">
            <div class="result-main">
              <div class="result-icon">
                <i class="ti ti-shield-check"></i>
              </div>
              <div style="flex:1;min-width:0">
                <div class="result-label">{{ result.hi.label }}</div>
                <div class="result-sub">{{ result.nhom }} — Căn cứ Nghị định 08/2022/NĐ-CP (hợp nhất NĐ 48/2026 &amp; VBHN 49)</div>
              </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
              <span class="chip" :class="result.hi.class">{{ result.hs }}</span>
              <span class="chip" :class="{ 'chip-bo': result.tq === 'cap_bo', 'chip-so': result.tq === 'cap_so', 'chip-huyen': result.tq === 'cap_huyen' }">
                <i class="ti ti-building-bank"></i> {{ result.coQuan }}
              </span>
              <span class="chip chip-gray">
                <i class="ti ti-clock"></i> {{ result.thoiHan }}
              </span>
              <span v-if="result.phuluc && result.phuluc !== '—'" class="chip chip-info">{{ result.phuluc }}</span>
              <span class="chip chip-gray" title="Bán kính ảnh hưởng môi trường dự kiến trên GIS">
                <i class="ti ti-radar-2" style="color:var(--accent)"></i> Bán kính tác động: {{ (estimatedImpactRadius / 1000).toFixed(1) }} km
              </span>
            </div>

            <div style="font-size:12.5px;color:var(--text2);padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
              <div>
                <strong style="color:var(--text)">Căn cứ pháp lý trực tiếp:</strong> {{ result.ref }}
              </div>
              <button v-if="result.ref_law_id" type="button" class="btn-secondary btn-sm" @click="emit('view-law', result.ref_law_id)">
                <i class="ti ti-scale"></i>
                <span>Xem điều khoản</span>
              </button>
            </div>

            <div class="info-grid">
              <div class="info-box">
                <div class="info-box-label">Loại hồ sơ</div>
                <div class="info-box-val">{{ result.hs }}</div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Nhóm dự án</div>
                <div class="info-box-val">{{ result.nhom }}</div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Thẩm quyền</div>
                <div class="info-box-val" :class="{ 'warn': result.tq === 'cap_bo', 'green': result.tq === 'cap_so', 'info': result.tq === 'cap_huyen' }">
                  {{ result.tq === 'cap_bo' ? 'Bộ NN&MT' : result.tq === 'cap_so' ? 'Sở NN&MT / Tỉnh' : 'UBND Cấp Xã/Huyện' }}
                </div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Thời hạn thẩm định</div>
                <div class="info-box-val">{{ result.thoiHan }}</div>
              </div>
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

          <!-- Warnings adjusted Group -->
          <div v-if="result.nangNhom.length" class="upgrade-box">
            <div class="upgrade-title">
              <i class="ti ti-alert-triangle"></i>
              <span>Điều chỉnh nâng nhóm / chuyển đổi hồ sơ tự động</span>
            </div>
            <div v-for="n in result.nangNhom" :key="n.text" class="upgrade-item">
              • {{ n.text }} <span style="font-size:11.5px;color:var(--text3)">({{ n.ref }})</span>
            </div>
          </div>

          <!-- Sensitive Areas warnings -->
          <div v-for="c in result.cauNhom" :key="c.text" :class="c.type === 'warn' ? 'upgrade-box' : 'phanlky-box'">
            <div :class="c.type === 'warn' ? 'upgrade-title' : 'phanlky-title'">
              <i class="ti" :class="c.type === 'warn' ? 'ti-alert-circle' : 'ti-info-circle'"></i>
              <span>Lưu ý pháp lý &amp; Yếu tố nhạy cảm</span>
            </div>
            <div :class="c.type === 'warn' ? 'upgrade-item' : 'phanlky-text'">
              {{ c.text }} <span style="font-size:11.5px;color:var(--text3)">({{ c.ref }})</span>
            </div>
          </div>

          <!-- Info Extra -->
          <div v-for="i in result.infoExtra" :key="i.text" class="phanlky-box">
            <div class="phanlky-title">
              <i class="ti ti-bulb"></i>
              <span>Hướng dẫn nghiệp vụ</span>
            </div>
            <div class="phanlky-text">
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

          <!-- Law Applied List -->
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

          <!-- Document checklist -->
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
                <span class="chip-status" :class="h.trang_thai_tong_quat === 'vuot_nguong' ? 'expired' : h.trang_thai_tong_quat === 'canh_bao' ? 'amended' : 'valid'">
                  {{ h.trang_thai_tong_quat === 'vuot_nguong' ? 'Vượt ngưỡng' : h.trang_thai_tong_quat === 'canh_bao' ? 'Cảnh báo' : 'Đạt chuẩn' }}
                </span>
              </div>
              <div v-if="qcvnHistoryTotalPages > 1" class="pagination-container">
                <button type="button" class="pagination-btn" :disabled="qcvnHistoryPage === 1" @click="fetchQcvnHistory(projectId, qcvnHistoryPage - 1)">&lt;</button>
                <button v-for="pg in qcvnHistoryTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === qcvnHistoryPage }" @click="fetchQcvnHistory(projectId, pg)">{{ pg }}</button>
                <button type="button" class="pagination-btn" :disabled="qcvnHistoryPage === qcvnHistoryTotalPages" @click="fetchQcvnHistory(projectId, qcvnHistoryPage + 1)">&gt;</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SLIDE-OVER DRAWER: SAVED PROJECTS -->
    <div v-if="showProjectsDrawer" class="drawer-overlay" @click.self="showProjectsDrawer = false">
      <div class="drawer-panel drawer-sm">
        <div class="drawer-header">
          <div class="drawer-title">
            <i class="ti ti-folders" style="color:var(--accent)"></i>
            <span>Danh sách Dự án đã lưu ({{ projects.length }})</span>
          </div>
          <button type="button" class="drawer-close-btn" @click="showProjectsDrawer = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div class="drawer-body">
          <button type="button" class="btn-primary" style="width:100%;margin-bottom:16px"
                  @click="createNewProject(); showProjectsDrawer = false">
            <i class="ti ti-plus"></i>
            <span>Khởi tạo dự án mới</span>
          </button>

          <div v-if="projects.length === 0" style="text-align:center;padding:36px 16px;color:var(--text3);font-size:13px">
            Chưa có dự án nào được lưu trong tài khoản.
          </div>

          <div v-else style="display:flex;flex-direction:column;gap:8px">
            <div v-for="p in projects" :key="p.id" class="project-item">
              <button type="button" class="project-btn" :class="{ active: projectId === p.id }"
                      @click="selectProject(p); showProjectsDrawer = false">
                <div style="display:flex;align-items:center;gap:8px">
                  <i class="ti ti-folder" style="color:var(--accent)"></i>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ p.name }}</span>
                </div>
              </button>
              <button type="button" class="btn-delete-project" @click="handleDeleteProject(p.id)" title="Xóa dự án">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>

          <div v-if="totalPages > 1" class="pagination-container">
            <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="fetchProjects(currentPage - 1)">&lt;</button>
            <button v-for="page in totalPages" :key="page" type="button" class="pagination-btn" :class="{ active: page === currentPage }" @click="fetchProjects(page)">
              {{ page }}
            </button>
            <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="fetchProjects(currentPage + 1)">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
</style>
