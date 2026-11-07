<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { QCVN_DATA } from '../data/qcvn-db.js'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { removeAccents } from '../utils/string-helpers.js'
import { projectQcvnSamples } from '../utils/constants.js'

const props = defineProps({
  loadSampleId: { type: Number, default: null }
})
const emit = defineEmits(['sample-loaded'])

// Sub-types for each environmental category
const SUB_TYPES = {
  nuoc_mat: [
    { value: 'qcvn08_a1', text: 'Cột A1 - Cấp nước sinh hoạt' },
    { value: 'qcvn08_a2', text: 'Cột A2 - Sinh hoạt (có xử lý), Thủy sản' },
    { value: 'qcvn08_b1', text: 'Cột B1 - Tưới tiêu, giao thông thủy' },
    { value: 'qcvn08_b2', text: 'Cột B2 - Các mục đích khác' }
  ],
  nuoc_thai_cn: [
    { value: 'qcvn40_a_low', text: 'Cột A - Lưu lượng xả ≤ 2000 m³/ngày' },
    { value: 'qcvn40_a_high', text: 'Cột A - Lưu lượng xả > 2000 m³/ngày' },
    { value: 'qcvn40_b_low', text: 'Cột B - Lưu lượng xả ≤ 2000 m³/ngày' },
    { value: 'qcvn40_b_high', text: 'Cột B - Lưu lượng xả > 2000 m³/ngày' }
  ],
  nuoc_thai_sh: [
    { value: 'qcvn14_a', text: 'Cột A - Khu vực nhạy cảm' },
    { value: 'qcvn14_b', text: 'Cột B - Các khu vực còn lại' }
  ],
  nuoc_duoi_dat: [
    { value: 'qcvn09', text: 'Quy chuẩn chung' }
  ],
  khong_khi: [
    { value: 'qcvn05_1h', text: 'Trung bình 1 giờ' },
    { value: 'qcvn05_24h', text: 'Trung bình 24 giờ' },
    { value: 'qcvn05_nam', text: 'Trung bình năm' }
  ],
  dat: [
    { value: 'qcvn03_type1', text: 'Loại 1 - Đất nông nghiệp, đất ở, công cộng' },
    { value: 'qcvn03_type2', text: 'Loại 2 - Đất rừng, phi nông nghiệp khác' },
    { value: 'qcvn03_type3', text: 'Loại 3 - Đất công nghiệp, khoáng sản, bãi thải' }
  ]
}

// Keywords mapping for parsing pasted text
const MAP_KEYWORDS = {
  'ph': 'pH',
  'do': 'DO',
  'bod': 'BOD5',
  'cod': 'COD',
  'tss': 'TSS',
  'ran lo lung': 'TSS',
  'amoni': 'NH4N',
  'nh4': 'NH4N',
  'nitrit': 'NO2N',
  'no2': 'NO2N',
  'nitrat': 'NO3N',
  'no3': 'NO3N',
  'phosphat': 'PO4P',
  'po4': 'PO4P',
  'phospho': 'TotalP',
  'total p': 'TotalP',
  'nito': 'TotalN',
  'total n': 'TotalN',
  'xyanua': 'CN',
  'cyanide': 'CN',
  'cn': 'CN',
  'asen': 'As',
  'arsenic': 'As',
  'as': 'As',
  'cadimi': 'Cd',
  'cadmium': 'Cd',
  'cd': 'Cd',
  'chi': 'Pb',
  'lead': 'Pb',
  'pb': 'Pb',
  'crom vi': 'Cr6',
  'crom 6': 'Cr6',
  'cr6': 'Cr6',
  'crom iii': 'Cr3',
  'crom 3': 'Cr3',
  'cr3': 'Cr3',
  'crom': 'Cr',
  'cr': 'Cr',
  'thuy ngan': 'Hg',
  'mercury': 'Hg',
  'hg': 'Hg',
  'dong': 'Cu',
  'copper': 'Cu',
  'cu': 'Cu',
  'kem': 'Zn',
  'zinc': 'Zn',
  'zn': 'Zn',
  'sat': 'Fe',
  'iron': 'Fe',
  'fe': 'Fe',
  'mangan': 'Mn',
  'manganese': 'Mn',
  'mn': 'Mn',
  'niken': 'Ni',
  'nickel': 'Ni',
  'ni': 'Ni',
  'florua': 'F',
  'fluoride': 'F',
  'f': 'F',
  'clo': 'Cl2',
  'chlorine': 'Cl2',
  'cl2': 'Cl2',
  'sunfua': 'S',
  'sulfide': 'S',
  's': 'S',
  'dau mo': 'Oil',
  'oil': 'Oil',
  'coliform': 'Coliform',
  'ecoli': 'Ecoli',
  'so2': 'SO2',
  'co': 'CO',
  'o3': 'O3',
  'ozon': 'O3',
  'tsp': 'TSP',
  'pm10': 'PM10',
  'pm25': 'PM25',
  'pm2.5': 'PM25',
  'tds': 'TDS',
  'do cung': 'Hardness',
  'hardness': 'Hardness',
  'clorua': 'Cl',
  'chloride': 'Cl',
  'cl': 'Cl',
  'sunfat': 'SO4',
  'sulfate': 'SO4',
  'so4': 'SO4'
}

// State
const selectedType = ref('nuoc_mat')
const selectedSubType = ref('qcvn08_a1')
const sampleName = ref('')
const pasteArea = ref('')
const sampleId = ref(null)
const measuredValues = ref({})

const loadedSamples = ref([])
const currentPage = ref(1)
const totalPages = ref(1)
const unsavedChanges = ref(false)

// Liên kết dự án
const linkedProject = ref(null)
const projectSearchQuery = ref('')
const projectSearchResults = ref([])
const projectSearchTimeout = ref(null)
const showProjectDropdown = ref(false)
const projectSearchRef = ref(null)
const autoMatchMessage = ref('')
const isAutoMatching = ref(false)

const matchKey = (nameStr) => {
  const norm = removeAccents(nameStr.toLowerCase().trim())
  if (MAP_KEYWORDS[norm]) return MAP_KEYWORDS[norm]
  for (const [kw, key] of Object.entries(MAP_KEYWORDS)) {
    if (norm.includes(kw)) return key
  }
  return null
}

const parsePastedText = (text) => {
  const lines = text.split('\n')
  const results = {}
  lines.forEach(line => {
    const parts = line.split(/\s*[:=,\t]\s*|\s{2,}/)
    if (parts.length >= 2) {
      let nameStr = parts[0].trim()
      let valStr = parts[1].trim()
      nameStr = nameStr.replace(/^\d+[\.\/\)\-]\s*/, '') // Strip numbers

      let val = parseFloat(valStr.replace(',', '.'))
      if (isNaN(val)) {
        for (let i = 1; i < parts.length; i++) {
          const testVal = parseFloat(parts[i].trim().replace(',', '.'))
          if (!isNaN(testVal)) {
            val = testVal
            break
          }
        }
      }
      if (!isNaN(val)) {
        const matchedKey = matchKey(nameStr)
        if (matchedKey) results[matchedKey] = val
      }
    } else {
      const match = line.match(/([a-zA-Z0-9\s_đĐàÀảẢãÃáÁạẠằẰằẲẳẴẵắẮặẶèÈẻẺẽẼéÉẹẸềỀểỂễỄếẾệỆìÌỉỈĩĨíÍịỊòÒỏỎõÕóÓọỌồỒổỔỗỖốỐộỘờỜởỞỡỠớỚợỢùÙủỦũŨúÚụỤừỪửỬữỮứỨựỰỳỲỷỶỹỸýÝỵỴ\-\+₅₄]+?)\s+([\d\.,]+)(?:\s|$)/)
      if (match) {
        let nameStr = match[1].trim()
        nameStr = nameStr.replace(/^\d+[\.\/\)\-]\s*/, '')
        const val = parseFloat(match[2].replace(',', '.'))
        if (!isNaN(val)) {
          const matchedKey = matchKey(nameStr)
          if (matchedKey) results[matchedKey] = val
        }
      }
    }
  })
  return results
}

const sampleLimit = ref(10)
const fetchSamples = async (page = 1) => {
  try {
    const res = await fetch(`${API.QCVN_SAMPLES}?page=${page}&limit=${sampleLimit.value}`)
    if (res.status === 401) return
    const data = await res.json()
    loadedSamples.value = data.samples || []
    totalPages.value = data.pagination?.totalPages || 1
    currentPage.value = page
  } catch (err) {
    logger.error('Lỗi khi fetch samples:', err)
  }
}

// Phân trang bảng thông số quy chuẩn
const paramPageSize = ref(20) // Options: 10, 20, 50, hoặc 999 (Tất cả)
const paramCurrentPage = ref(1)

const totalParamPages = computed(() => {
  if (paramPageSize.value >= 999) return 1
  return Math.max(1, Math.ceil(evaluatedParams.value.length / paramPageSize.value))
})

const paginatedParams = computed(() => {
  if (paramPageSize.value >= 999) return evaluatedParams.value
  const start = (paramCurrentPage.value - 1) * paramPageSize.value
  return evaluatedParams.value.slice(start, start + paramPageSize.value)
})

watch([selectedType, selectedSubType, paramPageSize], () => {
  paramCurrentPage.value = 1
})

const currentQcvn = computed(() => {
  return QCVN_DATA[selectedSubType.value] || null
})

const getEvaluation = (p, val) => {
  if (val === undefined || val === null || isNaN(val) || val === '') {
    return { status: 'empty', label: '—', ratio: null }
  }
  
  if (p.loai === 'range') {
    if (p.min === undefined || p.max === undefined) {
      return { status: 'empty', label: '—', ratio: null }
    }
    if (val < p.min || val > p.max) {
      return { status: 'fail', label: '✗ Vượt ngưỡng', ratio: null }
    } else {
      const range = p.max - p.min
      const distMin = range > 0 ? (val - p.min) / range : 0.5
      const distMax = range > 0 ? (p.max - val) / range : 0.5
      const status = (distMin < 0.1 || distMax < 0.1) ? 'near' : 'pass'
      return {
        status,
        label: status === 'near' ? '⚠ Gần giới hạn' : '✓ Đạt',
        ratio: null
      }
    }
  } else if (p.loai === 'min') {
    const ratio = (p.gioi_han && p.gioi_han > 0) ? (val / p.gioi_han) : 1
    if (val < p.gioi_han) {
      return { status: 'fail', label: '✗ Thấp hơn ngưỡng', ratio }
    } else {
      const status = ratio < 1.1 ? 'near' : 'pass'
      return {
        status,
        label: status === 'near' ? '⚠ Gần giới hạn' : '✓ Đạt',
        ratio
      }
    }
  } else {
    if (p.note === 'Không phát hiện' || p.gioi_han === 0) {
      const status = val > 0 ? 'fail' : 'pass'
      return {
        status,
        label: status === 'fail' ? '✗ Phát hiện' : '✓ KPH (Không phát hiện)',
        ratio: null
      }
    } else {
      const ratio = (p.gioi_han && p.gioi_han > 0) ? (val / p.gioi_han) : (val > 0 ? Infinity : 0)
      if (ratio > 1) {
        return { status: 'fail', label: `✗ Vượt ${Number.isFinite(ratio) ? ratio.toFixed(2) + 'x' : 'ngưỡng'}`, ratio }
      } else if (ratio >= 0.8) {
        return { status: 'near', label: `⚠ ${Math.round(ratio * 100)}% ngưỡng`, ratio }
      } else {
        return { status: 'pass', label: `✓ Đạt (${Math.round(ratio * 100)}%)`, ratio }
      }
    }
  }
}

const evaluatedParams = computed(() => {
  if (!currentQcvn.value || !Array.isArray(currentQcvn.value.tham_so)) return []
  return currentQcvn.value.tham_so.map(p => {
    if (p.nhom) return p
    const rawVal = measuredValues.value ? measuredValues.value[p.key] : undefined
    const val = (rawVal !== undefined && rawVal !== null && rawVal !== '') ? parseFloat(rawVal) : NaN
    const evalResult = getEvaluation(p, val)
    
    // Calculate fill width & color for progress bar representation
    let fillWidth = 0
    let fillColor = '#2E7D50'
    if (evalResult.ratio !== null && evalResult.ratio !== undefined && typeof evalResult.ratio === 'number' && !isNaN(evalResult.ratio)) {
      if (p.loai === 'min') {
        fillWidth = Math.min(Math.max(evalResult.ratio * 50, 0), 100)
      } else {
        fillWidth = Math.min(Math.max(evalResult.ratio * 100, 0), 100)
      }
      fillColor = evalResult.status === 'fail' ? '#C0392B' : evalResult.status === 'near' ? '#D4860A' : '#2E7D50'
    } else if (p.loai === 'range' && evalResult.status !== 'empty' && !isNaN(val) && p.max > p.min) {
      const pct = ((val - p.min) / (p.max - p.min)) * 100
      fillWidth = Math.min(Math.max(pct, 0), 100)
      fillColor = evalResult.status === 'fail' ? '#C0392B' : evalResult.status === 'near' ? '#D4860A' : '#2E7D50'
    }

    return {
      ...p,
      value: isNaN(val) ? undefined : val,
      ...evalResult,
      fillWidth,
      fillColor
    }
  })
})

const summary = computed(() => {
  let total = 0, pass = 0, near = 0, fail = 0
  evaluatedParams.value.forEach(p => {
    if (p.nhom || p.value === undefined || p.value === null || isNaN(p.value)) return
    total++
    if (p.status === 'pass') pass++
    else if (p.status === 'near') near++
    else if (p.status === 'fail') fail++
  })
  return { total, pass, near, fail }
})

const handleQuickPaste = () => {
  if (!pasteArea.value.trim()) {
    alert('Vui lòng dán nội dung bảng số liệu vào ô văn bản trước!')
    return
  }

  const parsedValues = parsePastedText(pasteArea.value)
  let matchedCount = 0

  if (currentQcvn.value) {
    currentQcvn.value.tham_so.forEach(p => {
      if (p.nhom) return
      if (parsedValues[p.key] !== undefined) {
        measuredValues.value[p.key] = parsedValues[p.key]
        matchedCount++
      }
    })
  }

  if (matchedCount > 0) {
    unsavedChanges.value = true
    alert(`Đã nhận diện và điền tự động ${matchedCount} thông số thành công!`)
  } else {
    alert('Không nhận diện được thông số nào. Vui lòng kiểm tra lại định dạng bảng số liệu dán vào.')
  }
}

const clearValues = () => {
  measuredValues.value = {}
  pasteArea.value = ''
  sampleName.value = ''
  sampleId.value = null
  unsavedChanges.value = false
  linkedProject.value = null
  projectSearchQuery.value = ''
  autoMatchMessage.value = ''
}

// === Liên kết dự án ===
const searchProjects = (query) => {
  clearTimeout(projectSearchTimeout.value)
  if (!query || query.length < 2) {
    projectSearchResults.value = []
    showProjectDropdown.value = false
    return
  }
  projectSearchTimeout.value = setTimeout(async () => {
    try {
      const res = await fetch(`${API.PROJECTS_SEARCH}?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        projectSearchResults.value = await res.json()
        showProjectDropdown.value = projectSearchResults.value.length > 0
      }
    } catch (err) {
      logger.error('Lỗi tìm kiếm dự án:', err)
    }
  }, 300)
}

const autoMatchQcvnFromProject = async (project) => {
  if (!project) return
  const nganh = project.nganh || project.form_data?.nganh || ''
  const nt = Number(project.nt || project.form_data?.nt || 0)
  const isSensitive = !!(project.form_data?.bg || project.form_data?.rung || project.form_data?.lua)

  let matchedType = null
  let matchedSubType = null

  // 1. Nhóm ngành công nghiệp chế biến / sản xuất / KCN -> Nước thải công nghiệp (QCVN 40:2025)
  const industrialNganh = [
    'che_bien_go', 'xi_mang', 'thep', 'hoa_chat', 'giay_bot',
    'det_nhuom', 'thuc_pham', 'nhua_cao_su', 'cao_su_cb',
    'duoc_pham', 'kcn'
  ]

  // 2. Nhóm đô thị / dịch vụ / chăn nuôi / y tế -> Nước thải sinh hoạt (QCVN 14:2025)
  const domesticNganh = [
    'do_thi', 'trung_tam_tm', 'khach_san', 'chan_nuoi', 'benh_vien'
  ]

  // 3. Nhóm thủy sản / nạo vét / thủy điện -> Nước mặt (QCVN 08-MT:2015)
  const surfaceWaterNganh = [
    'nuoi_thuy_san', 'nao_vet', 'thuy_dien'
  ]

  // 4. Nhóm hạ tầng giao thông -> Không khí xung quanh (QCVN 05:2023)
  const airNganh = [
    'cao_toc', 'cang_bien'
  ]

  if (industrialNganh.includes(nganh)) {
    matchedType = 'nuoc_thai_cn'
    if (nt > 2000) {
      matchedSubType = isSensitive ? 'qcvn40_a_high' : 'qcvn40_a_high'
    } else {
      matchedSubType = 'qcvn40_a_low'
    }
  } else if (domesticNganh.includes(nganh)) {
    matchedType = 'nuoc_thai_sh'
    matchedSubType = isSensitive ? 'qcvn14_a' : 'qcvn14_b'
  } else if (surfaceWaterNganh.includes(nganh)) {
    matchedType = 'nuoc_mat'
    if (nganh === 'nuoi_thuy_san') {
      matchedSubType = 'qcvn08_a2'
    } else if (nganh === 'nao_vet') {
      matchedSubType = 'qcvn08_b1'
    } else {
      matchedSubType = 'qcvn08_a1'
    }
  } else if (airNganh.includes(nganh)) {
    matchedType = 'khong_khi'
    matchedSubType = 'qcvn05_24h'
  }

  if (matchedType && matchedSubType) {
    isAutoMatching.value = true
    selectedType.value = matchedType
    selectedSubType.value = matchedSubType
    await nextTick()
    isAutoMatching.value = false

    const typeLabels = {
      nuoc_mat: 'Nước mặt (QCVN 08)',
      nuoc_thai_cn: 'Nước thải công nghiệp (QCVN 40:2025)',
      nuoc_thai_sh: 'Nước thải sinh hoạt (QCVN 14:2025)',
      khong_khi: 'Không khí (QCVN 05:2023)',
      nuoc_duoi_dat: 'Nước dưới đất (QCVN 09)',
      dat: 'Chất lượng đất (QCVN 03)'
    }
    const subObj = (SUB_TYPES[matchedType] || []).find(s => s.value === matchedSubType)
    autoMatchMessage.value = `Tự động khớp quy chuẩn: ${typeLabels[matchedType] || matchedType} — ${subObj ? subObj.text : matchedSubType}`
  } else {
    autoMatchMessage.value = ''
  }
}

const selectLinkedProject = (project) => {
  linkedProject.value = project
  projectSearchQuery.value = ''
  projectSearchResults.value = []
  showProjectDropdown.value = false
  unsavedChanges.value = true
  autoMatchQcvnFromProject(project)
}

const unlinkProject = () => {
  linkedProject.value = null
  autoMatchMessage.value = ''
  unsavedChanges.value = true
}

const computeOverallStatus = () => {
  const s = summary.value
  if (s.fail > 0) return 'vuot_nguong'
  if (s.near > 0) return 'canh_bao'
  return 'dat'
}

const saveSample = async () => {
  if (!sampleName.value.trim()) {
    alert('Vui lòng nhập tên mẫu / vị trí để lưu kết quả mẫu!')
    return
  }

  const finalValues = {}
  if (currentQcvn.value) {
    currentQcvn.value.tham_so.forEach(p => {
      if (p.nhom) return
      const val = measuredValues.value[p.key]
      if (val !== undefined && val !== '' && !isNaN(parseFloat(val))) {
        finalValues[p.key] = parseFloat(val)
      }
    })
  }

  const payload = {
    id: sampleId.value,
    name: sampleName.value,
    type: selectedType.value,
    sub_type: selectedSubType.value,
    values: finalValues,
    project_id: linkedProject.value?.id || null,
    trang_thai_tong_quat: computeOverallStatus()
  }

  try {
    const res = await fetch(API.QCVN_SAMPLES, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    
    if (res.ok) {
      const data = await res.json()
      alert(data.message || 'Lưu mẫu kết quả quan trắc thành công!')
      unsavedChanges.value = false
      sampleId.value = data.sample.id
      fetchSamples(currentPage.value)
    } else {
      alert('Đã xảy ra lỗi khi lưu mẫu kết quả quan trắc!')
    }
  } catch (err) {
    logger.error('Lỗi lưu mẫu:', err)
  }
}

const selectSample = (sample) => {
  if (unsavedChanges.value && !confirm('Bạn có thay đổi chưa lưu. Có chắc chắn muốn mở mẫu này và ghi đè dữ liệu hiện tại?')) {
    return
  }

  sampleId.value = sample.id
  sampleName.value = sample.name
  selectedType.value = sample.type
  selectedSubType.value = sample.sub_type
  measuredValues.value = sample.values || {}
  unsavedChanges.value = false

  // Khôi phục liên kết dự án
  if (sample.project_id && sample.project_name) {
    const cr = sample.project_classification_result || {}
    const fd = sample.project_form_data || {}
    linkedProject.value = {
      id: sample.project_id,
      ten_du_an: sample.project_name,
      loai_ho_so: cr.hs || sample.loai_ho_so || '—',
      nhom_du_an: cr.nhom || sample.nhom_du_an || '—',
      tinh_thanh: fd.tinh || sample.tinh_thanh || '',
      dia_chi_hien_thi: sample.project_dia_chi || sample.dia_chi_hien_thi || fd.tinh || ''
    }
  } else {
    linkedProject.value = null
  }
}

const handleDeleteSample = async (id) => {
  if (!confirm('Bạn có chắc chắn muốn xóa kết quả mẫu này?')) return
  try {
    const res = await fetch(`${API.QCVN_SAMPLES}/${id}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      if (sampleId.value === id) {
        clearValues()
      }
      fetchSamples(currentPage.value)
    }
  } catch (err) {
    logger.error('Lỗi xóa mẫu:', err)
  }
}

const exportTxt = () => {
  if (!currentQcvn.value) return
  const now = new Date().toLocaleString('vi-VN')
  let lines = [
    '═══════════════════════════════════════════════════════',
    `KẾT QUẢ SO SÁNH QCVN`,
    `Ngày: ${now}`,
    `Tên mẫu / Vị trí: ${sampleName.value || 'Mẫu không rõ tên'}`,
    `QCVN áp dụng: ${currentQcvn.value.ten}`,
    `Mục đích: ${currentQcvn.value.ap_dung}`,
    ...(linkedProject.value ? [
      `Dự án liên kết: ${linkedProject.value.ten_du_an}`,
      ...(linkedProject.value.loai_ho_so ? [`Loại hồ sơ: ${linkedProject.value.loai_ho_so} — ${linkedProject.value.nhom_du_an || ''}`] : []),
      ...(linkedProject.value.dia_chi_hien_thi || linkedProject.value.tinh_thanh ? [`Địa chỉ: ${linkedProject.value.dia_chi_hien_thi || linkedProject.value.tinh_thanh}`] : [])
    ] : []),
    '═══════════════════════════════════════════════════════',
    ''
  ]

  evaluatedParams.value.forEach(p => {
    if (p.nhom) { lines.push(`\n── ${p.nhom} ──`); return }
    const val = p.value !== undefined && p.value !== null && !isNaN(p.value) ? p.value.toString() : '—'
    const limitStr = p.loai === 'range' ? `${p.min}–${p.max}` : p.loai === 'min' ? `≥${p.gioi_han}` : (p.note || `≤${p.gioi_han}`)
    const resultText = p.status === 'fail' ? 'VƯỢT NGƯỠNG' : p.status === 'near' ? 'CẢNH BÁO' : p.status === 'pass' ? 'ĐẠT' : '—'
    lines.push(`${p.ten.padEnd(30)} ${p.don_vi.padEnd(12)} Giới hạn: ${limitStr.padEnd(12)} Kết quả: ${val.padEnd(10)} → ${resultText}`)
  })
  lines.push('\n═══════════════════════════════════════════════════════')
  lines.push('Lưu ý: Kết quả mang tính tham khảo. Đối chiếu với văn bản QCVN gốc.')

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `so_sanh_qcvn_${selectedSubType.value}_${Date.now()}.txt`
  a.click()
}

const exportPDF = () => {
  window.print()
}

// Reset subtype when main type changes
watch(selectedType, (newType) => {
  if (isAutoMatching.value) return
  const list = SUB_TYPES[newType] || []
  if (list.length > 0) {
    selectedSubType.value = list[0].value
  }
  measuredValues.value = {}
  unsavedChanges.value = false
})

watch(measuredValues, () => {
  unsavedChanges.value = true
}, { deep: true })

const handleClickOutside = (e) => {
  if (projectSearchRef.value && !projectSearchRef.value.contains(e.target)) {
    showProjectDropdown.value = false
  }
}

onMounted(() => {
  fetchSamples()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

// Cross-tab: load mẫu cụ thể từ tab Phân loại
watch(() => props.loadSampleId, async (newId) => {
  if (newId) {
    try {
      const res = await fetch(`${API.QCVN_SAMPLE_BY_ID}/${newId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.sample) {
          selectSample(data.sample)
          // Nếu có project info từ JOIN, khôi phục đầy đủ
          if (data.sample.project_id && data.sample.project_name) {
            const cr = data.sample.project_classification_result || {}
            const fd = data.sample.project_form_data || {}
            linkedProject.value = {
              id: data.sample.project_id,
              ten_du_an: data.sample.project_name,
              loai_ho_so: cr.hs || '—',
              nhom_du_an: cr.nhom || '—',
              tinh_thanh: fd.tinh || '',
              dia_chi_hien_thi: data.sample.project_dia_chi || fd.tinh || ''
            }
          }
        }
      }
    } catch (err) {
      logger.error('Lỗi tải mẫu:', err)
    }
    emit('sample-loaded')
  }
}, { immediate: true })
</script>

<template>
  <div id="qcvn" class="page container">
    <!-- Printable Header (Print Only) -->
    <div class="print-only-header" v-if="currentQcvn">
      <div style="text-align: center; margin-bottom: 24px; font-family: 'Be Vietnam Pro', sans-serif;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; color: #1D5C3A; margin-bottom: 4px;">ETC — PHÒNG THÍ NGHIỆM</h2>
        <h3 style="font-size: 16px; font-weight: 600; color: #1A1917; margin-bottom: 16px; text-transform: uppercase;">BÁO CÁO ĐỐI CHIẾU KẾT QUẢ QUAN TRẮC VỚI QCVN</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-bottom: 20px;">
          <tbody>
            <tr>
              <th style="width: 150px; padding: 4px 0; color: #6B6760;">Tên mẫu / Vị trí:</th>
              <td style="padding: 4px 0; font-weight: 600; color: #1A1917;">{{ sampleName || 'Mẫu không rõ tên' }}</td>
            </tr>
            <tr>
              <th style="padding: 4px 0; color: #6B6760;">Quy chuẩn đối chiếu:</th>
              <td style="padding: 4px 0; font-weight: 600; color: #1A1917;">{{ currentQcvn.ten }}</td>
            </tr>
            <tr>
              <th style="padding: 4px 0; color: #6B6760;">Áp dụng cho:</th>
              <td style="padding: 4px 0; color: #1A1917;">{{ currentQcvn.ap_dung }}</td>
            </tr>
            <tr v-if="linkedProject">
              <th style="padding: 4px 0; color: #6B6760;">Dự án liên kết:</th>
              <td style="padding: 4px 0; font-weight: 600; color: #1A1917;">{{ linkedProject.ten_du_an }}</td>
            </tr>
            <tr v-if="linkedProject && linkedProject.loai_ho_so">
              <th style="padding: 4px 0; color: #6B6760;">Loại hồ sơ / Nhóm:</th>
              <td style="padding: 4px 0; color: #1A1917;">{{ linkedProject.loai_ho_so }} — {{ linkedProject.nhom_du_an || '' }}</td>
            </tr>
            <tr v-if="linkedProject && (linkedProject.tinh_thanh || linkedProject.dia_chi_hien_thi)">
              <th style="padding: 4px 0; color: #6B6760;">Địa chỉ dự án:</th>
              <td style="padding: 4px 0; color: #1A1917;">{{ linkedProject.dia_chi_hien_thi || linkedProject.tinh_thanh }}</td>
            </tr>
            <tr>
              <th style="padding: 4px 0; color: #6B6760;">Thời gian xuất báo cáo:</th>
              <td style="padding: 4px 0; color: #1A1917;">{{ new Date().toLocaleString('vi-VN') }}</td>
            </tr>
          </tbody>
        </table>
        <hr style="border: 0; border-top: 1px solid #E2DDD6; margin-bottom: 20px;"/>
      </div>
    </div>

    <div class="section-head no-print">So sánh kết quả quan trắc với QCVN</div>
    <div class="section-desc no-print">Nhập giá trị đo được hoặc dán bảng số liệu từ phòng thí nghiệm để tự động đối chiếu với ngưỡng quy chuẩn</div>

    <div class="note-box no-print">
      ⚠️ <strong>Lưu ý về lộ trình chuyển tiếp (áp dụng cho dự án nộp hồ sơ sau 01/09/2025):</strong> Hệ thống sử dụng QCVN 40:2025, QCVN 14:2025 và QCVN 05:2023 — là các phiên bản mới nhất có hiệu lực, thay thế các phiên bản 2011, 2008, 2013 tương ứng. Chỉ số NH4+ tính theo N. Màu <span style="color:#A82020;font-weight:700">ĐỎ</span> = vượt ngưỡng, <span style="color:#8B6010;font-weight:700">CAM</span> = &gt;80% ngưỡng (cảnh báo), <span style="color:#1A6B3A;font-weight:700">XANH</span> = đạt. Hãy luôn đối chiếu lại với văn bản gốc khi xuất hồ sơ chính thức.
    </div>

    <div class="qcvn-grid has-sidebar">
      <!-- COLUMN 1: SAVED SAMPLES SIDEBAR -->
      <div class="projects-sidebar no-print" id="qcvn-sidebar-container" style="display: block;">
        <button class="btn-new-project" @click="clearValues"
          style="width:100%;padding:10px;background:var(--accent2);color:var(--accent);border:1px dashed var(--accent);border-radius:var(--radius);font-weight:600;font-size:13px;cursor:pointer;margin-bottom:16px;transition:all 0.15s">
          ➕ Tạo mẫu mới
        </button>
        <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
          Mẫu đã lưu
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <div v-if="loadedSamples.length === 0" style="font-size:12px;color:var(--text3);text-align:center;padding:20px 0">
            Chưa có mẫu nào
          </div>
          <div v-for="s in loadedSamples" :key="s.id" class="project-item">
            <button class="project-btn" :class="{ active: sampleId === s.id }" @click="selectSample(s)" style="text-align:left">
              <span>{{ s.name }}</span>
              <span v-if="s.project_name" style="display:block;font-size:10px;color:var(--text3);font-weight:normal;margin-top:2px">
                🔗 {{ s.project_name }}
              </span>
            </button>
            <button class="btn-delete-project" @click="handleDeleteSample(s.id)" title="Xóa kết quả mẫu">🗑️</button>
          </div>
        </div>
        <!-- Phân trang mẫu đã lưu -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;font-size:11px;color:var(--text3)">
          <span>Hiển thị:</span>
          <select v-model.number="sampleLimit" @change="fetchSamples(1)"
            style="padding:2px 6px;border:1px solid var(--border);border-radius:var(--radius);font-size:11px;background:var(--surface)">
            <option :value="10">10 / trang</option>
            <option :value="20">20 / trang</option>
            <option :value="50">50 / trang</option>
          </select>
        </div>
        <div v-if="totalPages > 1" class="pagination-container" style="display:flex;justify-content:center;gap:6px;margin-top:10px">
          <button class="pagination-btn" :disabled="currentPage === 1" @click="fetchSamples(currentPage - 1)">&lt;</button>
          <button v-for="page in totalPages" :key="page" class="pagination-btn" :class="{ active: page === currentPage }" @click="fetchSamples(page)">
            {{ page }}
          </button>
          <button class="pagination-btn" :disabled="currentPage === totalPages" @click="fetchSamples(currentPage + 1)">&gt;</button>
        </div>
      </div>

      <!-- COLUMN 2: WORKSPACE -->
      <div class="qcvn-workspace-content" style="flex:1;min-width:0">
        <!-- Liên kết dự án (tùy chọn) -->
        <div class="card no-print" style="padding:16px 22px;margin-bottom:16px">
          <label class="form-label" style="display:block;margin-bottom:8px">
            🔗 Liên kết với dự án (không bắt buộc)
          </label>
          <div v-if="linkedProject" 
               style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--accent2);border:1px solid var(--accent);border-radius:var(--radius)">
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13.5px;color:var(--accent);word-break:break-word;line-height:1.4">{{ linkedProject.ten_du_an }}</div>
              <div v-if="linkedProject.loai_ho_so" style="font-size:11.5px;color:var(--text2);margin-top:3px;line-height:1.4">
                {{ linkedProject.loai_ho_so }} — {{ linkedProject.nhom_du_an || '' }} — {{ linkedProject.tinh_thanh || linkedProject.dia_chi_hien_thi || '' }}
              </div>
              <div v-if="autoMatchMessage" style="font-size:11px;color:var(--accent);font-weight:600;margin-top:5px;display:flex;align-items:center;gap:4px;line-height:1.4">
                ⚡ {{ autoMatchMessage }}
              </div>
            </div>
            <button @click="unlinkProject" 
                    style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--text3);padding:4px;flex-shrink:0"
                    title="Gỡ liên kết">✕</button>
          </div>
          <div v-else ref="projectSearchRef" style="position:relative">
            <input type="text" v-model="projectSearchQuery" 
                   @input="searchProjects(projectSearchQuery)"
                   @focus="projectSearchQuery.length >= 2 && searchProjects(projectSearchQuery)"
                   placeholder="Gõ tên dự án để tìm kiếm..."
                   style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;color:var(--text);background:var(--surface)" />
            <div v-if="showProjectDropdown" 
                 style="position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);box-shadow:var(--shadow);max-height:240px;overflow-y:auto;z-index:50">
              <div v-for="p in projectSearchResults" :key="p.id"
                   @click="selectLinkedProject(p)"
                   style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;transition:background 0.1s"
                   @mouseenter="$event.target.style.background='var(--surface2)'"
                   @mouseleave="$event.target.style.background='transparent'">
                <div style="font-weight:600">{{ p.ten_du_an }}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px">
                  {{ p.loai_ho_so }} — {{ p.nhom_du_an }} — {{ p.tinh_thanh || p.dia_chi_hien_thi }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Paste quick numbers -->
        <div class="card no-print" style="padding:18px 22px;margin-bottom:16px">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" style="display:block">
              <span style="display:block;margin-bottom:4px">📋 Dán nhanh bảng kết quả từ Lab (Excel / PDF / Word)</span>
              <span style="font-size:11px;text-transform:none;color:var(--text3);font-weight:normal;display:block">Hệ thống sẽ tự nhận diện thông số và điền vào bảng</span>
            </label>
            <textarea v-model="pasteArea" rows="3"
              placeholder="Ví dụ:&#13;pH: 7.2&#13;BOD5: 12 mg/l&#13;TSS: 15&#13;Asen: 0.008 mg/l"
              style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-family:monospace;font-size:13px;resize:vertical;background:var(--bg);margin-top:6px"></textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:8px">
              <button class="btn-classify" @click="handleQuickPaste"
                style="width:auto;margin:0;padding:6px 16px;font-size:12px">⚡ Tự động điền bảng</button>
            </div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="card no-print" style="padding:18px 22px;margin-bottom:16px">
          <div class="qcvn-toolbar">
            <div class="form-group" style="min-width:220px">
              <label class="form-label">Loại môi trường</label>
              <select v-model="selectedType">
                <option value="nuoc_mat">💧 Nước mặt (QCVN 08-MT:2015)</option>
                <option value="nuoc_thai_cn">🏭 Nước thải công nghiệp (QCVN 40:2025)</option>
                <option value="nuoc_thai_sh">🏠 Nước thải sinh hoạt (QCVN 14:2025)</option>
                <option value="nuoc_duoi_dat">🚰 Nước dưới đất (QCVN 09-MT:2015)</option>
                <option value="khong_khi">🌬️ Không khí xung quanh (QCVN 05:2023)</option>
                <option value="dat">🌱 Chất lượng đất (QCVN 03:2023)</option>
              </select>
            </div>

            <div class="form-group" style="min-width:220px" v-show="SUB_TYPES[selectedType] && SUB_TYPES[selectedType].length > 1">
              <label class="form-label">Cột / Phân loại</label>
              <select v-model="selectedSubType">
                <option v-for="item in (SUB_TYPES[selectedType] || [])" :key="item.value" :value="item.value">{{ item.text }}</option>
              </select>
            </div>
            
            <div class="form-group" style="min-width:180px">
              <label class="form-label">Tên mẫu / Vị trí</label>
              <input type="text" v-model="sampleName" placeholder="VD: NM-01, NT-01..." />
            </div>
            
            <div style="display:flex;gap:8px;padding-bottom:1px;flex-wrap:wrap;align-items:flex-end">
              <button class="btn-export" @click="exportPDF">📄 Xuất PDF / In</button>
              <button class="btn-export" @click="exportTxt">⬇ Xuất File Text</button>
              <button class="btn-clear" @click="clearValues">🗑 Xoá số liệu</button>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="summary-row" v-if="summary.total > 0">
          <div class="summary-box">
            <div class="summary-num" style="color:var(--text)">{{ summary.total }}</div>
            <div class="summary-label">Tổng thông số</div>
          </div>
          <div class="summary-box">
            <div class="summary-num" style="color:#1A6B3A">{{ summary.pass }}</div>
            <div class="summary-label">Đạt chuẩn</div>
          </div>
          <div class="summary-box">
            <div class="summary-num" style="color:#8B6010">{{ summary.near }}</div>
            <div class="summary-label">Cảnh báo (&gt;80%)</div>
          </div>
          <div class="summary-box">
            <div class="summary-num" style="color:#A82020">{{ summary.fail }}</div>
            <div class="summary-label">Vượt ngưỡng</div>
          </div>
        </div>

        <!-- Table -->
        <div class="card" style="padding:0;overflow:hidden" v-if="currentQcvn">
          <!-- Thanh điều khiển phân trang thông số trên -->
          <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:var(--surface2);border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px">
            <div style="font-size:12.5px;color:var(--text2)">
              📋 Danh sách <strong>{{ evaluatedParams.filter(p => !p.nhom).length }}</strong> thông số quy chuẩn
              <span v-if="paramPageSize < 999 && totalParamPages > 1"> (Trang {{ paramCurrentPage }}/{{ totalParamPages }})</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2)">
              <span>Hiển thị thông số:</span>
              <select v-model.number="paramPageSize"
                style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:12px;cursor:pointer">
                <option :value="10">10 / trang</option>
                <option :value="20">20 / trang</option>
                <option :value="50">50 / trang</option>
                <option :value="999">Tất cả thông số</option>
              </select>
            </div>
          </div>

          <div id="qv-table-wrap" style="overflow-x:auto">
            <table class="qcvn-table" style="table-layout:fixed;width:100%;min-width:750px">
              <thead>
                <tr>
                  <th style="width:28%">Thông số</th>
                  <th style="width:10%">Đơn vị</th>
                  <th style="width:16%">Giới hạn cho phép</th>
                  <th style="width:14%">Kết quả đo</th>
                  <th style="width:16%">Đánh giá</th>
                  <th style="width:16%">Tỉ lệ/ngưỡng</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(p, i) in paginatedParams" :key="i">
                  <tr v-if="p.nhom">
                    <td class="param-group-head" colspan="6">{{ p.nhom }}</td>
                  </tr>
                  
                  <tr v-else :class="{ 'row-pass': p.status === 'pass', 'row-fail': p.status === 'fail', 'row-near': p.status === 'near' }">
                    <td style="font-weight:500;line-height:1.45">{{ p.ten }}</td>
                    <td style="color:var(--text3)">{{ p.don_vi }}</td>
                    <td>
                      <span class="limit-val">
                        {{ p.loai === 'range' ? `${p.min} – ${p.max}` : p.loai === 'min' ? `≥ ${p.gioi_han}` : (p.note || `≤ ${p.gioi_han}`) }}
                      </span>
                    </td>
                    <td>
                      <input type="number" step="any" min="0" v-model.number="measuredValues[p.key]" placeholder="—" class="no-print" style="width:100%; padding: 6px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); font-size: 13px; font-weight: 500; text-align: center;" />
                      <span class="print-only">{{ p.value !== undefined && p.value !== null && !isNaN(p.value) ? p.value : '—' }}</span>
                    </td>
                    <td>
                      <span v-if="p.status === 'empty'" class="result-empty">—</span>
                      <span v-else-if="p.status === 'pass'" class="result-pass">{{ p.label || '✓ Đạt' }}</span>
                      <span v-else-if="p.status === 'near'" class="result-near">{{ p.label || '⚠ Gần giới hạn' }}</span>
                      <span v-else-if="p.status === 'fail'" class="result-fail">{{ p.label || '✗ Vượt' }}</span>
                    </td>
                    <td>
                      <div v-if="p.status !== 'empty' && typeof p.ratio === 'number' && !isNaN(p.ratio)" style="display:flex; flex-direction:column; gap:2px">
                        <span style="font-size:11px;color:var(--text3)">{{ Number.isFinite(p.ratio) ? p.ratio.toFixed(2) + 'x' : '∞' }}</span>
                        <span class="ratio-bar">
                          <span class="ratio-fill" :style="{ width: p.fillWidth + '%', background: p.fillColor }"></span>
                        </span>
                      </div>
                      <div v-else-if="p.status !== 'empty' && p.loai === 'range'" style="display:flex; flex-direction:column; gap:2px">
                        <span style="font-size:11px;color:var(--text3)">Khoảng chuẩn [{{ p.min }} - {{ p.max }}]</span>
                        <span class="ratio-bar">
                          <span class="ratio-fill" :style="{ width: p.fillWidth + '%', background: p.fillColor }"></span>
                        </span>
                      </div>
                      <span v-else>—</span>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          
          <!-- Thanh phân trang thông số dưới -->
          <div v-if="paramPageSize < 999 && totalParamPages > 1" class="no-print"
            style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-top:1px solid var(--border);background:var(--surface2);flex-wrap:wrap;gap:10px">
            <div style="font-size:12px;color:var(--text2)">
              Hiển thị thông số <strong>{{ (paramCurrentPage - 1) * paramPageSize + 1 }}</strong> – <strong>{{ Math.min(paramCurrentPage * paramPageSize, evaluatedParams.length) }}</strong> / {{ evaluatedParams.length }} dòng
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="pagination-btn" :disabled="paramCurrentPage === 1" @click="paramCurrentPage--">‹ Trước</button>
              <button v-for="pg in totalParamPages" :key="pg" class="pagination-btn" :class="{ active: pg === paramCurrentPage }" @click="paramCurrentPage = pg">{{ pg }}</button>
              <button class="pagination-btn" :disabled="paramCurrentPage === totalParamPages" @click="paramCurrentPage++">Sau ›</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text2)">
              <span>Hiển thị:</span>
              <select v-model.number="paramPageSize"
                style="padding:3px 6px;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:12px">
                <option :value="10">10 / trang</option>
                <option :value="20">20 / trang</option>
                <option :value="50">50 / trang</option>
                <option :value="999">Tất cả</option>
              </select>
            </div>
          </div>
          
          <div style="padding:12px 20px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <span class="no-print">💡 Nhập giá trị vào cột "Kết quả đo" — đánh giá cập nhật ngay khi nhập</span>
            <div class="no-print" style="display:flex;gap:8px;align-items:center">
              <button class="btn-classify" @click="saveSample"
                style="width:auto;margin:0;padding:6px 16px;font-size:12px">💾 Lưu kết quả mẫu</button>
            </div>
            <span style="font-style:italic">{{ currentQcvn.ap_dung }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
