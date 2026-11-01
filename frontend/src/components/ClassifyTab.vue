<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { getCapacityLabel } from '../services/classification-rules.js'
import divisions from '../data/vietnam-divisions.json'
import SearchableSelect from './SearchableSelect.vue'
import { DEFAULT_LAT, DEFAULT_LNG, ESRI_TILE_URL, ESRI_ATTRIBUTION, NOMINATIM_URL, API, PROVINCE_COORDINATES } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'
import { projectQcvnSamples } from '../utils/constants.js'

const props = defineProps({
  loadProjectId: { type: Number, default: null }
})
const emit = defineEmits(['project-loaded', 'view-qcvn-sample'])

// Form State
const projectId = ref(null)
const name = ref('')
const nganh = ref('')
const capacity = ref(0)
const nt = ref(0)
const kt = ref(0)
const tinh = ref('')
const latitude = ref(DEFAULT_LAT) // Default coordinates: TP. Hồ Chí Minh
const longitude = ref(DEFAULT_LNG)

// GIS State
const diaChiHienThi = ref('')
const quanHuyen = ref('')
const phuongXa = ref('')
const addressSearch = ref('')
const addressResults = ref([])
const locationConfirmed = ref(false)
const classificationSnapshot = ref(null)
let searchTimeout = null

// Cascading dropdown state sau sáp nhập (Tỉnh/TP -> Phường/Xã trực tiếp, không dùng cấp Quận)
const selectedProvince = ref(null)
const selectedWard = ref(null)

const wardList = computed(() => {
  if (!selectedProvince.value) return []
  const prov = divisions.find(p => p.code === selectedProvince.value)
  if (!prov) return []
  const list = []
  const seen = new Set()
  for (const dist of (prov.districts || [])) {
    for (const ward of (dist.wards || [])) {
      if (ward && ward.name && !seen.has(ward.name)) {
        seen.add(ward.name)
        list.push({
          code: ward.code || ward.name,
          name: ward.name
        })
      }
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
})

// Special flags
const rung = ref(false)
const lua = ref(false)
const bg = ref(false)
const kcn = ref(false)
const phanky = ref(false)
const morongdt = ref(false)
const ctnh = ref(false)
const dtcong = ref(false)

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

// Leaflet Map state
let mapInstance = null
let markerInstance = null

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

const initMap = () => {
  if (!window.L) return
  
  if (mapInstance) {
    mapInstance.remove()
  }

  nextTick(() => {
    // Khởi tạo mặc định tại TP. Hồ Chí Minh
    mapInstance = window.L.map('mini-map').setView([latitude.value, longitude.value], 11)
    
    window.L.tileLayer(ESRI_TILE_URL, {
      maxZoom: 19,
      attribution: ESRI_ATTRIBUTION
    }).addTo(mapInstance)

    markerInstance = window.L.marker([latitude.value, longitude.value], { draggable: true }).addTo(mapInstance)

    markerInstance.on('dragend', (e) => {
      const position = markerInstance.getLatLng()
      latitude.value = position.lat
      longitude.value = position.lng
      locationConfirmed.value = true
      updateFallbackAddress(position.lat, position.lng)
      reverseGeocode(position.lat, position.lng)
    })

    mapInstance.on('click', (e) => {
      const { lat, lng } = e.latlng
      latitude.value = lat
      longitude.value = lng
      locationConfirmed.value = true
      markerInstance.setLatLng([lat, lng])
      updateFallbackAddress(lat, lng)
      reverseGeocode(lat, lng)
    })
  })
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

const reverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`${NOMINATIM_URL}/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { 'User-Agent': 'ETC-LegalHub/1.0' }
    })
    if (res.ok) {
      const data = await res.json()
      const address = data.address || {}
      const state = address.state || address.city || address.province || ''
      const wardName = address.quarter || address.village || address.suburb || address.town || address.hamlet || address.neighbourhood || address.ward || ''
      const road = address.road || address.pedestrian || address.street || address.amenity || address.industrial || address.building || ''

      if (wardName && !phuongXa.value) {
        phuongXa.value = wardName
      }
      locationConfirmed.value = true
      
      // Tự động định dạng địa chỉ chuẩn sau sáp nhập (Khu vực/Đường, Phường/Xã, Tỉnh/TP)
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
      
      if (state && !tinh.value) {
        const matched = findMatchingProvince(state)
        if (matched) {
          tinh.value = matched
        }
      }
    } else {
      updateFallbackAddress(lat, lng)
    }
  } catch (err) {
    logger.error('Lỗi reverse geocoding:', err)
    updateFallbackAddress(lat, lng)
  }
}

const findMatchingProvince = (name) => {
  const cleanName = normalizeString(name)
    .replace('tinh ', '').replace('thanh pho ', '')
  
  for (const region in provinces) {
    for (const p of provinces[region]) {
      const cleanP = normalizeString(p.value)
        .replace('tp. ', '')
      
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
    if (!tinh.value && !selectedProvince.value) { alert('Vui lòng chọn Tỉnh / Thành phố thực hiện dự án!'); return }
    if (!phuongXa.value && !selectedWard.value) { alert('Vui lòng chọn Phường / Xã / Thị trấn (sau sáp nhập)!'); return }
  } else {
    if (!nganh.value) return
  }

  const formData = {
    nganh: nganh.value,
    capacity: parseFloat(capacity.value) || 0,
    nt: parseFloat(nt.value) || 0,
    kt: parseFloat(kt.value) || 0,
    tinh: tinh.value,
    rung: rung.value,
    lua: lua.value,
    bg: bg.value,
    kcn: kcn.value,
    phanky: phanky.value,
    morongdt: morongdt.value,
    ctnh: ctnh.value,
    dtcong: dtcong.value
  }

  try {
    // Gọi REST API Backend để phân loại và đối chiếu quy chuẩn pháp lý
    const res = await fetch(API.CLASSIFY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })

    if (res.ok) {
      const data = await res.json()
      if (data.result) {
        result.value = data.result
        classificationSnapshot.value = {
          hs: data.result.hs,
          nhom: data.result.nhom,
          coQuan: data.result.coQuan,
          thoiHan: data.result.thoiHan,
          tq: data.result.tq
        }
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
    // Thêm toạ độ vào form_data gửi đi
    const finalFormData = {
      ...formData,
      latitude: latitude.value,
      longitude: longitude.value
    }

    const res = await fetch(API.PROJECTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: projectId.value,
        name: name.value,
        form_data: finalFormData,
        checklist_state: checklistState.value,
        latitude: latitude.value,
        longitude: longitude.value,
        dia_chi_hien_thi: diaChiHienThi.value || null,
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
  kcn.value = !!fd.kcn
  phanky.value = !!fd.phanky
  morongdt.value = !!fd.morongdt
  ctnh.value = !!fd.ctnh
  dtcong.value = !!fd.dtcong

  latitude.value = project.latitude ? parseFloat(project.latitude) : (fd.latitude ? parseFloat(fd.latitude) : 10.776889)
  longitude.value = project.longitude ? parseFloat(project.longitude) : (fd.longitude ? parseFloat(fd.longitude) : 106.700806)
  diaChiHienThi.value = project.dia_chi_hien_thi || ''
  quanHuyen.value = project.quan_huyen || ''
  phuongXa.value = project.phuong_xa || ''
  classificationSnapshot.value = project.classification_result || null
  locationConfirmed.value = !!(project.latitude || fd.latitude)

  // Đồng bộ Tỉnh/TP và Phường/Xã lên SearchableSelect
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

  // Update map coordinates
  if (mapInstance && markerInstance) {
    const latLng = [latitude.value, longitude.value]
    mapInstance.setView(latLng, 14)
    markerInstance.setLatLng(latLng)
  }

  // Chạy tính toán để render kết quả (không lưu đè lại luôn)
  handleClassify(false)

  // Tải lịch sử quan trắc QCVN
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
  kcn.value = false
  phanky.value = false
  morongdt.value = false
  ctnh.value = false
  dtcong.value = false

  latitude.value = 10.776889
  longitude.value = 106.700806
  diaChiHienThi.value = ''
  quanHuyen.value = ''
  phuongXa.value = ''
  locationConfirmed.value = false
  classificationSnapshot.value = null
  selectedProvince.value = null
  selectedWard.value = null
  addressSearch.value = ''

  checklistState.value = {}
  result.value = null

  if (mapInstance && markerInstance) {
    const latLng = [latitude.value, longitude.value]
    mapInstance.setView(latLng, 11)
    markerInstance.setLatLng(latLng)
  }
  
  qcvnHistory.value = []
}

const handleDeleteProject = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa dự án này?')) return
  try {
    const res = await fetch(`${API.PROJECTS}/${id}`, {
      method: 'DELETE'
    })
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
  // Auto save checklist state
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
      kcn: kcn.value,
      phanky: phanky.value,
      morongdt: morongdt.value,
      ctnh: ctnh.value,
      dtcong: dtcong.value
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

// Tự động kiểm tra khoảng cách vùng biên giới khi có tọa độ mới
// watch([latitude, longitude], ([newLat, newLng]) => {
//   ...
// })

// Tìm kiếm địa chỉ qua Nominatim (Bước 1b)
const searchAddress = () => {
  clearTimeout(searchTimeout)
  addressResults.value = []
  if (!addressSearch.value || addressSearch.value.length < 3) return
  
  searchTimeout = setTimeout(async () => {
    try {
      const q = encodeURIComponent(addressSearch.value)
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&countrycodes=vn&limit=5&addressdetails=1`, {
        headers: { 'User-Agent': 'ETC-LegalHub/1.0' }
      })
      if (res.ok) {
        addressResults.value = await res.json()
      }
    } catch (err) {
      logger.error('Lỗi tìm kiếm địa chỉ:', err)
    }
  }, 1000) // Debounce 1 giây theo chính sách Nominatim
}

const selectAddressResult = (item) => {
  const lat = parseFloat(item.lat)
  const lng = parseFloat(item.lon)
  latitude.value = lat
  longitude.value = lng
  locationConfirmed.value = true
  addressResults.value = []
  addressSearch.value = item.display_name
  diaChiHienThi.value = item.display_name
  
  if (mapInstance && markerInstance) {
    mapInstance.flyTo([lat, lng], 15, { duration: 1.0 })
    markerInstance.setLatLng([lat, lng])
  }
}

// Khi chọn Tỉnh/Thành từ dropdown → tự động zoom bản đồ vào tỉnh & điền Bước 3
const onProvinceSelect = (opt) => {
  selectedWard.value = null
  phuongXa.value = ''
  quanHuyen.value = ''
  
  if (!selectedProvince.value) return
  
  const prov = divisions.find(p => String(p.code) === String(selectedProvince.value) || p.name === selectedProvince.value)
  if (prov) {
    // Tự động match tỉnh vào form tinh
    const matched = findMatchingProvince(prov.name)
    tinh.value = matched || prov.name
    
    // Tự động điền Bước 3 — Địa chỉ hiển thị ngay lập tức
    diaChiHienThi.value = prov.name
    
    // Lấy toạ độ chuẩn của tỉnh từ PROVINCE_COORDINATES
    const paddedCode = String(prov.code).padStart(2, '0')
    const coords = PROVINCE_COORDINATES[paddedCode] || PROVINCE_COORDINATES[String(prov.code)]
    
    if (coords) {
      const [lat, lng] = coords
      latitude.value = lat
      longitude.value = lng
      locationConfirmed.value = true
      
      if (mapInstance) {
        mapInstance.flyTo([lat, lng], 11, { duration: 1.0 })
        if (markerInstance) {
          markerInstance.setLatLng([lat, lng])
        }
      }
    } else {
      searchAndFlyTo(prov.name, 11, true)
    }
  }
}

// Khi chọn Phường/Xã từ dropdown → tự động zoom sát phường (zoom 14-15) & cập nhật Bước 3
const onWardSelect = (opt) => {
  if (!selectedWard.value) return
  const ward = wardList.value.find(w => String(w.code) === String(selectedWard.value) || w.name === selectedWard.value)
  if (ward) {
    phuongXa.value = ward.name
    quanHuyen.value = ''
    const prov = divisions.find(p => String(p.code) === String(selectedProvince.value))
    const provName = prov ? prov.name : tinh.value
    
    // Tự động điền Bước 3 — Địa chỉ hiển thị ngay lập tức (Phường/Xã, Tỉnh/TP)
    diaChiHienThi.value = `${ward.name}, ${provName}`
    locationConfirmed.value = true
    
    // Geocode phường xã để zoom vào khu vực phường và đặt marker chính xác (zoom 14-15)
    searchAndFlyTo(ward.name + ', ' + provName, 14, true)
  }
}

const searchAndFlyTo = async (query, targetZoom = 13, updateMarkerPos = false) => {
  try {
    const q = encodeURIComponent(query + ', Việt Nam')
    const res = await fetch(`${NOMINATIM_URL}/search?q=${q}&format=json&countrycodes=vn&limit=1`, {
      headers: { 'User-Agent': 'ETC-LegalHub/1.0' }
    })
    if (res.ok) {
      const results = await res.json()
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat)
        const lng = parseFloat(results[0].lon)
        
        if (updateMarkerPos) {
          latitude.value = lat
          longitude.value = lng
          locationConfirmed.value = true
        }

        if (mapInstance) {
          mapInstance.flyTo([lat, lng], targetZoom, { duration: 1.0 })
          if (markerInstance && updateMarkerPos) {
            markerInstance.setLatLng([lat, lng])
          }
        }
        return
      }
    }
  } catch (err) {
    logger.error('Lỗi geocoding:', err)
  }
  
  // Fallback: nếu geocoding phường/xã không ra kết quả, zoom vào toạ độ hiện tại với targetZoom
  if (mapInstance && latitude.value && longitude.value) {
    mapInstance.flyTo([latitude.value, longitude.value], targetZoom, { duration: 1.0 })
  }
}

// Watch loadProjectId prop from MapTab cross-navigation
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

onMounted(() => {
  fetchProjects()
  initMap()
})
</script>

<template>
  <div id="classify" class="page container">
    <div class="section-head">Phân loại dự án & Xác định hồ sơ</div>
    <div class="section-desc">Nhập thông tin hoặc chọn địa điểm trên bản đồ để tự động xác định loại hồ sơ, thẩm quyền, phụ lục áp dụng và danh mục tài liệu nộp</div>

    <div class="classify-grid has-sidebar">
      <!-- COLUMN 1: SAVED PROJECTS LIST -->
      <div class="projects-sidebar" id="projects-sidebar-container" style="display: block;">
        <button class="btn-new-project" @click="createNewProject"
          style="width:100%;padding:10px;background:var(--accent2);color:var(--accent);border:1px dashed var(--accent);border-radius:var(--radius);font-weight:600;font-size:13px;cursor:pointer;margin-bottom:16px;transition:all 0.15s">
          ➕ Tạo dự án mới
        </button>
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
          Dự án đã lưu
        </div>
        <div id="saved-projects-list" style="display:flex;flex-direction:column;gap:8px">
          <div v-if="projects.length === 0" style="font-size:12px;color:var(--text3);text-align:center;padding:20px 0">
            Chưa có dự án nào
          </div>
          <div v-for="p in projects" :key="p.id" class="project-item">
            <button class="project-btn" :class="{ active: projectId === p.id }" @click="selectProject(p)">
              {{ p.name }}
            </button>
            <button class="btn-delete-project" @click="handleDeleteProject(p.id)" title="Xóa dự án">🗑️</button>
          </div>
        </div>
        <!-- Phân trang -->
        <div v-if="totalPages > 1" id="projects-pagination" class="pagination-container" style="display:flex;justify-content:center;gap:6px;margin-top:16px">
          <button class="pagination-btn" :disabled="currentPage === 1" @click="fetchProjects(currentPage - 1)">&lt;</button>
          <button v-for="page in totalPages" :key="page" class="pagination-btn" :class="{ active: page === currentPage }" @click="fetchProjects(page)">
            {{ page }}
          </button>
          <button class="pagination-btn" :disabled="currentPage === totalPages" @click="fetchProjects(currentPage + 1)">&gt;</button>
        </div>
      </div>

      <!-- FORM -->
      <div class="form-section">
        <div class="form-group">
          <label class="form-label">Tên dự án *</label>
          <input type="text" v-model="name" placeholder="Nhập tên dự án..." required />
        </div>
        
        <div class="form-group">
          <label class="form-label">Loại hình dự án *</label>
          <select v-model="nganh">
            <option value="">Chọn ngành nghề</option>
            <optgroup label="🏭 Công nghiệp chế biến">
              <option value="che_bien_go">Chế biến gỗ / Sản xuất MDF, ván sàn</option>
              <option value="xi_mang">Xi măng, clinker, vật liệu xây dựng</option>
              <option value="thep">Luyện kim, sản xuất thép, phôi thép</option>
              <option value="hoa_chat">Hóa chất, phân bón NPK, thuốc BVTV</option>
              <option value="giay_bot">Giấy, bột giấy, carton</option>
              <option value="det_nhuom">Dệt, nhuộm, hoàn tất vải sợi</option>
              <option value="thuc_pham">Chế biến thực phẩm, đồ uống</option>
              <option value="nhua_cao_su">Nhựa, cao su tổng hợp</option>
              <option value="cao_su_cb">Cao su chế biến (mủ khô)</option>
              <option value="duoc_pham">Dược phẩm, mỹ phẩm</option>
            </optgroup>
            <optgroup label="🏗️ Hạ tầng & Đô thị">
              <option value="kcn">Khu công nghiệp / KCX / Khu kinh tế</option>
              <option value="do_thi">Khu đô thị, nhà ở, chung cư</option>
              <option value="trung_tam_tm">Trung tâm thương mại, văn phòng</option>
              <option value="cao_toc">Đường cao tốc, quốc lộ</option>
              <option value="cang_bien">Cảng biển, bến cảng</option>
              <option value="thuy_dien">Thủy điện, điện mặt trời, điện gió</option>
            </optgroup>
            <optgroup label="🏥 Y tế & Dịch vụ">
              <option value="benh_vien">Bệnh viện, phòng khám, cơ sở y tế</option>
              <option value="khach_san">Khách sạn, resort, khu du lịch</option>
            </optgroup>
            <optgroup label="🌾 Nông — Lâm — Ngư">
              <option value="nuoi_thuy_san">Nuôi trồng thủy sản (ao, lồng bè)</option>
              <option value="chan_nuoi">Chăn nuôi gia súc, gia cầm</option>
              <option value="nao_vet">Nạo vét luồng hàng hải, kênh rạch</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ capacityLabel }}</label>
          <input type="number" v-model="capacity" min="0" step="1" placeholder="Nhập con số..." />
        </div>

        <div class="form-group">
          <label class="form-label">Lưu lượng nước thải phát sinh (m³/ngày)</label>
          <input type="number" v-model="nt" min="0" step="10" placeholder="0 nếu chưa xác định" />
        </div>

        <div class="form-group">
          <label class="form-label">Lưu lượng khí thải (m³/giờ)</label>
          <input type="number" v-model="kt" min="0" step="100" placeholder="0 nếu chưa xác định" />
        </div>

        <!-- Vị trí dự án (GIS) — 3 bước -->
        <div class="form-group" style="border:1px solid var(--border);border-radius:8px;padding:16px;background:var(--surface)">
          <label class="form-label" style="font-size:14px;margin-bottom:12px">📍 Vị trí & Địa bàn dự án</label>

          <!-- BƯỚC 1: Thu hẹp khu vực -->
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Bước 1 — Chọn địa bàn hành chính (sau sáp nhập)</div>
            
            <!-- 1a: Cascading Searchable Selects sau sáp nhập (Tỉnh/TP -> Phường/Xã) -->
            <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
              <div>
                <label style="font-size:11px;color:var(--text2);margin-bottom:3px;display:block;font-weight:500">Tỉnh / Thành phố:</label>
                <SearchableSelect
                  v-model="selectedProvince"
                  :options="divisions"
                  placeholder="Chọn Tỉnh / Thành phố..."
                  search-placeholder="🔍 Gõ tìm Tỉnh/TP..."
                  @change="onProvinceSelect"
                />
              </div>
              <div>
                <label style="font-size:11px;color:var(--text2);margin-bottom:3px;display:block;font-weight:500">Phường / Xã (sau sáp nhập):</label>
                <SearchableSelect
                  v-model="selectedWard"
                  :options="wardList"
                  :disabled="!selectedProvince"
                  placeholder="Chọn Phường / Xã..."
                  search-placeholder="🔍 Gõ tìm Phường/Xã..."
                  @change="onWardSelect"
                />
              </div>
            </div>
            
            <!-- 1b: Tìm kiếm tự do -->
            <div style="position:relative">
              <label style="font-size:11px;color:var(--text2);margin-bottom:3px;display:block;font-weight:500">Hoặc tìm địa chỉ tự do:</label>
              <input type="text" v-model="addressSearch" @input="searchAddress" placeholder="Nhập số nhà, tên đường, khu vực..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:12.5px;box-sizing:border-box" />
              <div v-if="addressResults.length" style="position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--border);border-radius:0 0 6px 6px;z-index:1000;max-height:200px;overflow:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
                <div v-for="(item, i) in addressResults" :key="i" @click="selectAddressResult(item)" style="padding:8px 10px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.1s" @mouseenter="$event.target.style.background='var(--surface2)'" @mouseleave="$event.target.style.background='white'">
                  {{ item.display_name }}
                </div>
              </div>
            </div>
          </div>

          <!-- BƯỚC 2: Xác nhận vị trí trên bản đồ -->
          <div style="margin-bottom:10px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Bước 2 — Click hoặc kéo marker để xác nhận vị trí</div>
            <div id="mini-map" style="height:220px;border-radius:6px;border:1px solid var(--border);background:var(--surface2)"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <div style="display:flex;gap:12px;font-size:11px;color:var(--text3)">
                <span>Lat: <strong style="color:var(--text)">{{ latitude.toFixed(6) }}</strong></span>
                <span>Lng: <strong style="color:var(--text)">{{ longitude.toFixed(6) }}</strong></span>
              </div>
              <span v-if="locationConfirmed" style="font-size:11px;color:#27ae60;font-weight:600">✅ Đã xác nhận vị trí</span>
              <span v-else style="font-size:11px;color:var(--warn)">⚠️ Chưa xác nhận</span>
            </div>
          </div>

          <!-- BƯỚC 3: Địa chỉ hiển thị (tự động điền, cho phép sửa) -->
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;margin-bottom:6px">Bước 3 — Địa chỉ hiển thị</div>
            <input type="text" v-model="diaChiHienThi" placeholder="Địa chỉ sẽ tự động điền khi xác nhận vị trí..." style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;box-sizing:border-box" />
            <span style="font-size:11px;color:var(--text3);display:block;margin-top:4px;line-height:1.4">💡 Bạn có thể sửa tay nếu kết quả tự động không chính xác</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Điều kiện đặc biệt</label>
          <div class="check-grid">
            <label class="check-item"><input type="checkbox" v-model="rung"> Đất rừng PH/ĐD</label>
            <label class="check-item"><input type="checkbox" v-model="lua"> Đất lúa &gt;10 ha</label>
            <label class="check-item"><input type="checkbox" v-model="bg"> Vùng biên giới 50km</label>
            <label class="check-item"><input type="checkbox" v-model="kcn"> Trong KCN có ĐTM</label>
            <label class="check-item"><input type="checkbox" v-model="phanky"> Dự án phân kỳ</label>
            <label class="check-item"><input type="checkbox" v-model="morongdt"> Mở rộng dự án cũ</label>
            <label class="check-item"><input type="checkbox" v-model="ctnh"> Phát sinh CTNH</label>
            <label class="check-item"><input type="checkbox" v-model="dtcong"> Đầu tư công</label>
          </div>
        </div>

        <button class="btn-classify" @click="handleClassify(true)">Phân loại hồ sơ →</button>
      </div>

      <!-- RESULT -->
      <div class="result-area" id="result-area">
        <div v-if="!result" class="result-empty">
          <div style="font-size:40px;margin-bottom:12px">📋</div>
          <div style="font-weight:500;color:var(--text2);margin-bottom:6px">Nhập thông tin dự án</div>
          <div style="font-size:13px">Điền form bên trái và nhấn <strong>Phân loại</strong><br>để xem kết quả chi tiết</div>
        </div>

        <div v-else class="fade-up">
          <div class="result-hero">
            <div class="result-main">
              <div class="result-icon" :style="{ background: result.hi.bg }">{{ result.hi.icon }}</div>
              <div>
                <div class="result-label">{{ result.hi.label }}</div>
                <div class="result-sub">{{ result.nhom }} theo NĐ 08/2022 (cập nhật NĐ 48/2026)</div>
              </div>
            </div>
            
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
              <span class="chip" :class="result.hi.class">{{ result.hs }}</span>
              <span class="chip" :class="{ 'chip-bo': result.tq === 'cap_bo', 'chip-so': result.tq === 'cap_so', 'chip-huyen': result.tq === 'cap_huyen' }">
                {{ result.coQuan }}
              </span>
              <span class="chip chip-gray">⏱ {{ result.thoiHan }}</span>
              <span v-if="result.phuluc && result.phuluc !== '—'" class="chip chip-info">{{ result.phuluc }}</span>
            </div>
            
            <div style="font-size:12px;color:var(--text3);padding:8px 12px;background:var(--surface2);border-radius:6px">
              <strong style="color:var(--text2)">Căn cứ áp dụng:</strong> {{ result.ref }}
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
                  {{ result.tq === 'cap_bo' ? 'Bộ NNMT' : result.tq === 'cap_so' ? 'Sở TNMT' : 'UBND Huyện/Xã' }}
                </div>
              </div>
              <div class="info-box">
                <div class="info-box-label">Thời hạn thẩm định</div>
                <div class="info-box-val">{{ result.thoiHan }}</div>
              </div>
            </div>
          </div>

          <!-- Warnings adjusted Group -->
          <div v-if="result.nangNhom.length" class="upgrade-box">
            <div class="upgrade-title">⚡ Điều chỉnh nhóm tự động</div>
            <div v-for="n in result.nangNhom" :key="n.text" class="upgrade-item">
              {{ n.icon }} {{ n.text }} <span style="font-size:10px;font-style:italic">({{ n.ref }})</span>
            </div>
          </div>

          <!-- Sensitive Areas warnings -->
          <div v-for="c in result.cauNhom" :key="c.text" :class="c.type === 'warn' ? 'upgrade-box' : 'phanlky-box'" style="margin-top:10px">
            <div :class="c.type === 'warn' ? 'upgrade-title' : 'phanlky-title'">{{ c.icon }} Lưu ý quan trọng</div>
            <div :class="c.type === 'warn' ? 'upgrade-item' : 'phanlky-text'">
              {{ c.text }} <span style="font-size:10px;font-style:italic">({{ c.ref }})</span>
            </div>
          </div>

          <!-- Info Extra -->
          <div v-for="i in result.infoExtra" :key="i.text" class="phanlky-box" style="margin-top:10px">
            <div class="phanlky-title">{{ i.icon }} Gợi ý nghiệp vụ</div>
            <div class="phanlky-text">
              {{ i.text }} <span style="font-size:10px;font-style:italic">({{ i.ref }})</span>
            </div>
          </div>

          <!-- Law Applied List -->
          <div class="law-ref-block" style="margin-top:14px">
            <div class="law-ref-title">📖 Văn bản pháp lý áp dụng</div>
            <div v-for="r in result.lr" :key="r.num" class="law-ref-item">
              <div class="law-ref-num">{{ r.num }}</div>
              <div class="law-ref-desc">{{ r.desc }}</div>
            </div>
          </div>

          <!-- Document checklist -->
          <div class="checklist-block" v-if="result.cl">
            <div class="checklist-title">
              📋 Danh mục tài liệu cần chuẩn bị
              <span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:auto">
                {{ totalDocsCount }} tài liệu
              </span>
            </div>
            
            <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin:4px 0 8px">
              Tài liệu bắt buộc
            </div>
            <div v-for="(item, i) in result.cl.bat_buoc" :key="'req-'+i" class="cl-item" @click="toggleChecklistItem(i)">
              <div class="cl-box" :class="{ done: checklistState[i] }"></div>
              <div>
                <div class="cl-text" :class="{ done: checklistState[i] }">{{ item }}</div>
                <div class="cl-required">BẮT BUỘC</div>
              </div>
            </div>

            <template v-if="result.cl.bo_sung && result.cl.bo_sung.length">
              <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin:14px 0 8px">
                Tài liệu bổ sung (tuỳ trường hợp)
              </div>
              <div v-for="(item, i) in result.cl.bo_sung" :key="'opt-'+i" class="cl-item" @click="toggleChecklistItem(result.cl.bat_buoc.length + i)">
                <div class="cl-box" :class="{ done: checklistState[result.cl.bat_buoc.length + i] }"></div>
                <div>
                  <div class="cl-text" :class="{ done: checklistState[result.cl.bat_buoc.length + i] }">{{ item }}</div>
                </div>
              </div>
            </template>

            <!-- Progress bar -->
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
            </div>
            <div class="progress-label">{{ checkedTotalCount }}/{{ totalDocsCount }} tài liệu đã chuẩn bị</div>
          </div>

          <!-- Lịch sử quan trắc QCVN -->
          <div v-if="projectId" class="card" style="margin-top:16px;padding:16px 20px">
            <div style="font-size:13px;font-weight:700;color:var(--text2);margin-bottom:12px">
              🔬 Lịch sử quan trắc
            </div>
            <div v-if="qcvnHistory.length === 0" style="font-size:12px;color:var(--text3);text-align:center;padding:16px 0">
              Chưa có dữ liệu quan trắc cho dự án này
            </div>
            <div v-else style="display:flex;flex-direction:column;gap:8px">
              <div v-for="h in qcvnHistory" :key="h.id"
                   @click="handleViewQcvnSample(h.id)"
                   style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2);border-radius:var(--radius);cursor:pointer;transition:background 0.15s"
                   @mouseenter="$event.target.style.background='var(--border)'"
                   @mouseleave="$event.target.style.background='var(--surface2)'">
                <div style="flex:1;min-width:0;padding-right:12px">
                  <div style="font-weight:600;font-size:13px;word-break:break-word;line-height:1.4">{{ h.name }}</div>
                  <div style="font-size:11px;color:var(--text3);margin-top:2px">
                    {{ new Date(h.created_at).toLocaleDateString('vi-VN') }}
                  </div>
                </div>
                <span :style="{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: h.trang_thai_tong_quat === 'vuot_nguong' ? '#FDECEA' : h.trang_thai_tong_quat === 'canh_bao' ? '#FFF8EC' : '#E6F7EF',
                  color: h.trang_thai_tong_quat === 'vuot_nguong' ? '#A82020' : h.trang_thai_tong_quat === 'canh_bao' ? '#8B6010' : '#1A6B3A'
                }">
                  {{ h.trang_thai_tong_quat === 'vuot_nguong' ? '✗ Vượt ngưỡng' : h.trang_thai_tong_quat === 'canh_bao' ? '⚠ Cảnh báo' : '✓ Đạt' }}
                </span>
              </div>
              <div v-if="qcvnHistoryTotalPages > 1" style="display:flex;justify-content:center;gap:6px;margin-top:8px">
                <button class="pagination-btn" :disabled="qcvnHistoryPage === 1" @click="fetchQcvnHistory(projectId, qcvnHistoryPage - 1)">&lt;</button>
                <button v-for="pg in qcvnHistoryTotalPages" :key="pg" class="pagination-btn" :class="{ active: pg === qcvnHistoryPage }" @click="fetchQcvnHistory(projectId, pg)">{{ pg }}</button>
                <button class="pagination-btn" :disabled="qcvnHistoryPage === qcvnHistoryTotalPages" @click="fetchQcvnHistory(projectId, qcvnHistoryPage + 1)">&gt;</button>
              </div>
            </div>
          </div>

          <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:12px;padding:8px;background:var(--surface2);border-radius:6px">
            Kết quả mang tính tham khảo. Căn cứ: Luật BVMT 2020 • NĐ 08/2022 • NĐ 05/2025 • NĐ 48/2026 • TT 02/2022.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
