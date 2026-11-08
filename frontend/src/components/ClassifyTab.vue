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
const emit = defineEmits(['project-loaded', 'view-qcvn-sample', 'view-law'])

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

const showProjectsDrawer = ref(false)

onMounted(() => {
  fetchProjects()
  initMap()
})
</script>

<template>
  <div id="classify" class="page container fade-up">
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div>
        <h2 class="section-head">Phân loại Dự án &amp; Xác định Hồ sơ Môi trường</h2>
        <p class="section-desc">
          Nhập thông số kỹ thuật và định vị tọa độ GIS để tự động xác định nhóm dự án, loại hồ sơ (ĐTM / GPMT / ĐKMT), cơ quan thẩm quyền và danh mục tài liệu.
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
            <option value="">Chọn ngành nghề dự án...</option>
            <optgroup label="Công nghiệp chế biến & Chế tạo">
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
            <optgroup label="Hạ tầng kỹ thuật & Đô thị">
              <option value="kcn">Khu công nghiệp / KCX / Khu kinh tế</option>
              <option value="do_thi">Khu đô thị, nhà ở, chung cư</option>
              <option value="trung_tam_tm">Trung tâm thương mại, văn phòng</option>
              <option value="cao_toc">Đường cao tốc, quốc lộ</option>
              <option value="cang_bien">Cảng biển, bến cảng</option>
              <option value="thuy_dien">Thủy điện, điện mặt trời, điện gió</option>
            </optgroup>
            <optgroup label="Y tế, Du lịch & Dịch vụ">
              <option value="benh_vien">Bệnh viện, phòng khám, cơ sở y tế</option>
              <option value="khach_san">Khách sạn, resort, khu du lịch</option>
            </optgroup>
            <optgroup label="Nông — Lâm — Thủy sản">
              <option value="nuoi_thuy_san">Nuôi trồng thủy sản (ao, lồng bè)</option>
              <option value="chan_nuoi">Chăn nuôi gia súc, gia cầm</option>
              <option value="nao_vet">Nạo vét luồng hàng hải, kênh rạch</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">{{ capacityLabel }}</label>
          <input type="number" v-model="capacity" min="0" step="1" placeholder="Nhập quy mô công suất..." />
        </div>

        <div class="form-block-title" style="margin-top:20px">
          <i class="ti ti-droplet-half-2"></i>
          <span>2. Quy mô phát thải</span>
        </div>

        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Nước thải (m³/ngày)</label>
            <input type="number" v-model="nt" min="0" step="10" placeholder="0 nếu chưa xác định" />
          </div>
          <div class="form-group">
            <label class="form-label">Khí thải (m³/giờ)</label>
            <input type="number" v-model="kt" min="0" step="100" placeholder="0 nếu chưa xác định" />
          </div>
        </div>

        <div class="form-block-title" style="margin-top:20px">
          <i class="ti ti-map-pin"></i>
          <span>3. Vị trí địa lý (GIS) &amp; Yếu tố nhạy cảm</span>
        </div>

        <!-- Vị trí dự án (GIS) — 3 bước -->
        <div class="form-group" style="border:1px solid var(--border);border-radius:var(--radius);padding:14px;background:var(--bg)">
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px">
              Bước 1 — Chọn đơn vị hành chính (sau sáp nhập)
            </div>

            <div class="form-grid-2" style="gap:10px;margin-bottom:10px">
              <div>
                <label style="font-size:11.5px;color:var(--text2);margin-bottom:4px;display:block;font-weight:500">Tỉnh / Thành phố</label>
                <SearchableSelect
                  v-model="selectedProvince"
                  :options="divisions"
                  placeholder="Chọn Tỉnh/TP..."
                  search-placeholder="Gõ tìm Tỉnh/TP..."
                  @change="onProvinceSelect"
                />
              </div>
              <div>
                <label style="font-size:11.5px;color:var(--text2);margin-bottom:4px;display:block;font-weight:500">Phường / Xã</label>
                <SearchableSelect
                  v-model="selectedWard"
                  :options="wardList"
                  :disabled="!selectedProvince"
                  placeholder="Chọn Phường/Xã..."
                  search-placeholder="Gõ tìm Phường/Xã..."
                  @change="onWardSelect"
                />
              </div>
            </div>

            <div style="position:relative">
              <label style="font-size:11.5px;color:var(--text2);margin-bottom:4px;display:block;font-weight:500">Hoặc tìm kiếm tọa độ địa chỉ</label>
              <input type="text" v-model="addressSearch" @input="searchAddress" placeholder="Nhập số nhà, tên đường, KCN..." />
              <div v-if="addressResults.length" style="position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);z-index:1000;max-height:200px;overflow:auto;box-shadow:var(--shadow-md)">
                <div v-for="(item, i) in addressResults" :key="i" @click="selectAddressResult(item)"
                     style="padding:8px 12px;font-size:12.5px;cursor:pointer;border-bottom:1px solid var(--border)">
                  {{ item.display_name }}
                </div>
              </div>
            </div>
          </div>

          <!-- BƯỚC 2: Xác nhận vị trí trên bản đồ -->
          <div style="margin-bottom:12px">
            <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">
              Bước 2 — Chấm hoặc kéo ghim trên bản đồ
            </div>
            <div id="mini-map" style="height:210px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2)"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px">
              <div style="display:flex;gap:12px;font-size:11.5px;color:var(--text3)">
                <span>Vĩ độ: <strong style="color:var(--text)">{{ latitude.toFixed(6) }}</strong></span>
                <span>Kinh độ: <strong style="color:var(--text)">{{ longitude.toFixed(6) }}</strong></span>
              </div>
              <span v-if="locationConfirmed" style="font-size:11.5px;color:var(--success);font-weight:600;display:inline-flex;align-items:center;gap:4px">
                <i class="ti ti-circle-check"></i> Đã xác nhận tọa độ
              </span>
              <span v-else style="font-size:11.5px;color:var(--warn);display:inline-flex;align-items:center;gap:4px">
                <i class="ti ti-alert-circle"></i> Chưa ghim vị trí
              </span>
            </div>
          </div>

          <!-- BƯỚC 3: Địa chỉ hiển thị -->
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px">
              Bước 3 — Địa chỉ ghi nhận trong hồ sơ
            </div>
            <input type="text" v-model="diaChiHienThi" placeholder="Địa chỉ tự động điền hoặc nhập thủ công..." />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Điều kiện môi trường đặc thù</label>
          <div class="check-grid">
            <label class="check-item"><input type="checkbox" v-model="rung"> Đất rừng PH / Đặc dụng</label>
            <label class="check-item"><input type="checkbox" v-model="lua"> Chuyển đất lúa &gt;10 ha</label>
            <label class="check-item"><input type="checkbox" v-model="bg"> Vùng biên giới / Di sản</label>
            <label class="check-item"><input type="checkbox" v-model="kcn"> Trong KCN đã có ĐTM</label>
            <label class="check-item"><input type="checkbox" v-model="phanky"> Đầu tư phân kỳ</label>
            <label class="check-item"><input type="checkbox" v-model="morongdt"> Mở rộng dự án hiện hữu</label>
            <label class="check-item"><input type="checkbox" v-model="ctnh"> Có phát sinh CTNH</label>
            <label class="check-item"><input type="checkbox" v-model="dtcong"> Dự án đầu tư công</label>
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
            Điền thông số dự án ở biểu mẫu bên trái và nhấn <strong>Phân loại &amp; Xác định hồ sơ</strong> để hệ thống phân tích kết quả.
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
                <div class="result-sub">{{ result.nhom }} — Căn cứ Nghị định 08/2022/NĐ-CP (hợp nhất NĐ 48/2026)</div>
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
          </div>

          <!-- Warnings adjusted Group -->
          <div v-if="result.nangNhom.length" class="upgrade-box">
            <div class="upgrade-title">
              <i class="ti ti-alert-triangle"></i>
              <span>Điều chỉnh nâng nhóm tự động</span>
            </div>
            <div v-for="n in result.nangNhom" :key="n.text" class="upgrade-item">
              • {{ n.text }} <span style="font-size:11.5px;color:var(--text3)">({{ n.ref }})</span>
            </div>
          </div>

          <!-- Sensitive Areas warnings -->
          <div v-for="c in result.cauNhom" :key="c.text" :class="c.type === 'warn' ? 'upgrade-box' : 'phanlky-box'">
            <div :class="c.type === 'warn' ? 'upgrade-title' : 'phanlky-title'">
              <i class="ti" :class="c.type === 'warn' ? 'ti-alert-circle' : 'ti-info-circle'"></i>
              <span>Lưu ý pháp lý quan trọng</span>
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
