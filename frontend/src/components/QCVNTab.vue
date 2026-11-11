<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { SUB_TYPES, QCVN_DATA, selectApplicableQcvn, evaluateQcvnSample } from '../data/qcvn-db.js'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { removeAccents } from '../utils/string-helpers.js'

const props = defineProps({
  loadSampleId: { type: Number, default: null }
})
const emit = defineEmits(['sample-loaded'])

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
  'crom': 'Cr_tong',
  'cr': 'Cr_tong',
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
  'sunfua': 'Sulfide',
  'sulfide': 'Sulfide',
  's': 'Sulfide',
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
const selectedSubType = ref('qcvn08_a')
const runtimeQcvnData = ref({})
const qcvnRuleSource = ref('LOADING')
const qcvnCatalogError = ref('')
const sampleName = ref('')
const pasteArea = ref('')
const sampleId = ref(null)
const measuredValues = ref({})
const receivingWaterConfirmed = ref(false)
const flowRate = ref(null)
const receivingWaterClass = ref('')
const isExistingFacility = ref(false)
const isUrbanArea = ref(false)
const evaluationDate = ref(new Date().toISOString().slice(0, 10))
const samplingPeriods = ref({ _default: '' })

const serverSelection = ref(null)
const serverEvaluation = ref(null)
const isSelectingQcvn = ref(false)
const isEvaluatingServer = ref(false)
const selectionMismatchWarning = ref('')
let evaluateServerTimer = null

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

const resolveParamKeyForActiveQcvn = (candidateKey) => {
  const params = currentQcvn.value?.tham_so || []
  const keySet = new Set(params.filter(p => !p.nhom && p.key).map(p => p.key))
  if (keySet.size === 0) return candidateKey
  if (keySet.has(candidateKey)) return candidateKey
  if (candidateKey === 'NO2N' && keySet.has('NO2')) return 'NO2'
  if (candidateKey === 'Cr_tong' && keySet.has('Cr')) return 'Cr'
  if (candidateKey === 'Sulfide' && keySet.has('S')) return 'S'
  return candidateKey
}

const matchKey = (nameStr) => {
  const norm = removeAccents(nameStr.toLowerCase().trim())
  if (MAP_KEYWORDS[norm]) return resolveParamKeyForActiveQcvn(MAP_KEYWORDS[norm])
  for (const [kw, key] of Object.entries(MAP_KEYWORDS)) {
    if (norm.includes(kw)) return resolveParamKeyForActiveQcvn(key)
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

const fetchQcvnCatalog = async () => {
  try {
    const res = await fetch(API.QCVNS || '/api/qcvns')
    const headerSource = res.headers.get('X-Rule-Source')
    if (res.ok) {
      const dbData = await res.json()
      if (dbData && typeof dbData === 'object' && Object.keys(dbData).length > 0) {
        runtimeQcvnData.value = dbData
        qcvnRuleSource.value = headerSource || 'DATABASE'
        qcvnCatalogError.value = ''
        return
      }
    }
    const errPayload = await res.json().catch(() => ({}))
    runtimeQcvnData.value = QCVN_DATA
    qcvnRuleSource.value = 'FALLBACK_UNVERIFIED'
    qcvnCatalogError.value = errPayload.error || `HTTP_${res.status}`
  } catch (err) {
    logger.error('Lỗi đồng bộ danh mục QCVN từ API:', err)
    runtimeQcvnData.value = QCVN_DATA
    qcvnRuleSource.value = 'FALLBACK_UNVERIFIED'
    qcvnCatalogError.value = err.message || 'NETWORK_ERROR'
  }
}

const currentQcvn = computed(() => {
  return runtimeQcvnData.value[selectedSubType.value] || null
})

const needsReceivingConfirmation = computed(() => {
  return ['nuoc_mat', 'nuoc_thai_cn', 'nuoc_thai_sh'].includes(selectedType.value)
})

const activeSamplingPeriods = computed(() => {
  const p = samplingPeriods.value || {}
  return p._default ? { _default: p._default } : {}
})

const buildQcvnSelectionPayload = (projectOverride = null) => {
  const proj = projectOverride || linkedProject.value
  const parsedFlow = (flowRate.value === '' || flowRate.value === null || flowRate.value === undefined)
    ? null
    : Number(flowRate.value)
  return {
    project_id: proj?.id || null,
    nganh: proj?.nganh || proj?.form_data?.nganh || null,
    sourceType: selectedType.value || null,
    receivingWaterClass: receivingWaterClass.value || null,
    receivingWaterConfirmed: Boolean(receivingWaterConfirmed.value && (!needsReceivingConfirmation.value || receivingWaterClass.value || selectedType.value === 'nuoc_mat')),
    flowRate: parsedFlow !== null && !Number.isNaN(parsedFlow) ? parsedFlow : null,
    isUrbanArea: Boolean(isUrbanArea.value),
    isExistingFacility: Boolean(isExistingFacility.value),
    evaluationDate: evaluationDate.value || new Date().toISOString().slice(0, 10),
  }
}

const formatSelectionNotice = (sel) => {
  if (!sel) return ''
  if (sel.status === 'OK' && sel.qcvnId) {
    const stdName = sel.applicableStandard || sel.qcvnId
    const verInfo = sel.ruleVersion ? ` | v${sel.ruleVersion}` : ''
    return `Server chọn QCVN: ${stdName} (${sel.ruleSource || 'DATABASE'}${verInfo})`
  }
  return `⚠ Cần rà soát (${sel.reason || sel.status || 'NEEDS_REVIEW'}): ${sel.message || 'Chưa đủ điều kiện chọn QCVN tự động.'}`
}

const requestServerQcvnSelection = async ({ projectOverride = null, clearSourceType = false } = {}) => {
  isSelectingQcvn.value = true
  try {
    const payload = buildQcvnSelectionPayload(projectOverride)
    if (clearSourceType) {
      payload.sourceType = null
    }
    const res = await fetch(API.QCVN_SELECT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (res.ok) {
      const data = await res.json()
      serverSelection.value = data
      selectionMismatchWarning.value = ''
      if (data.status === 'OK' && data.qcvnId) {
        isAutoMatching.value = true
        if (data.sourceType) selectedType.value = data.sourceType
        selectedSubType.value = data.qcvnId
        await nextTick()
        isAutoMatching.value = false
      } else if (data.sourceType && clearSourceType) {
        isAutoMatching.value = true
        selectedType.value = data.sourceType
        await nextTick()
        isAutoMatching.value = false
      }
      autoMatchMessage.value = formatSelectionNotice(data)
      return data
    }
    const errPayload = await res.json().catch(() => ({}))
    serverSelection.value = {
      status: 'NEEDS_REVIEW',
      reason: errPayload.reason || `HTTP_${res.status}`,
      message: errPayload.error || 'Không thể chọn QCVN từ máy chủ.',
      isOfficialConclusion: false,
      ruleSource: 'FALLBACK_UNVERIFIED',
    }
    autoMatchMessage.value = formatSelectionNotice(serverSelection.value)
    return serverSelection.value
  } catch (err) {
    logger.error('Lỗi gọi POST /api/qcvns/select:', err)
    serverSelection.value = {
      status: 'NEEDS_REVIEW',
      reason: 'SERVER_UNREACHABLE',
      message: 'Không kết nối được API chọn QCVN phía máy chủ — kết luận hạ xuống Cần rà soát.',
      isOfficialConclusion: false,
      ruleSource: 'FALLBACK_UNVERIFIED',
    }
    autoMatchMessage.value = formatSelectionNotice(serverSelection.value)
    return serverSelection.value
  } finally {
    isSelectingQcvn.value = false
  }
}

const requestServerQcvnEvaluation = async () => {
  if (!currentQcvn.value) {
    serverEvaluation.value = null
    return null
  }
  isEvaluatingServer.value = true
  try {
    const finalValues = {}
    currentQcvn.value.tham_so.forEach(p => {
      if (p.nhom) return
      const val = measuredValues.value[p.key]
      if (val !== undefined && val !== '' && !isNaN(parseFloat(val))) {
        finalValues[p.key] = parseFloat(val)
      }
    })
    const selCtx = buildQcvnSelectionPayload()
    const res = await fetch(API.QCVN_EVALUATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sub_type: selectedSubType.value,
        values: finalValues,
        samplingPeriods: activeSamplingPeriods.value,
        permitLimits: linkedProject.value?.form_data?.permitLimits || null,
        ...selCtx,
      })
    })
    if (res.ok) {
      const data = await res.json()
      serverEvaluation.value = data.evaluation || null
      if (data.serverSelection) {
        serverSelection.value = data.serverSelection
      }
      if (data.evaluation?.reason === 'QCVN_SELECTION_MISMATCH') {
        selectionMismatchWarning.value = data.evaluation.unverifiedReasons?.[0] || 'QCVN đã chọn lệch với kết quả server select.'
      } else {
        selectionMismatchWarning.value = ''
      }
      return data.evaluation
    }
    serverEvaluation.value = null
    return null
  } catch (err) {
    logger.warn('Không thể đồng bộ đánh giá QCVN từ server:', err)
    serverEvaluation.value = null
    return null
  } finally {
    isEvaluatingServer.value = false
  }
}

const sampleEvaluation = computed(() => {
  if (!currentQcvn.value) {
    return {
      overallStatus: 'NEEDS_REVIEW',
      conclusionStatus: 'NEEDS_REVIEW',
      preliminaryStatus: null,
      trang_thai_tong_quat: 'can_ra_soat',
      reason: 'UNKNOWN_QCVN',
      isOfficialConclusion: false,
      canExportOfficialReport: false,
      verificationStatus: 'NEEDS_LEGAL_VERIFICATION',
      ruleSource: qcvnRuleSource.value,
      unverifiedReasons: ['Chưa tải được dữ liệu quy chuẩn cho mã đã chọn.'],
      evaluatedParams: [],
      summary: { total: 0, pass: 0, near: 0, fail: 0, missingRequired: 0, periodMismatch: 0, invalidPermitLimits: 0 },
    }
  }

  if (serverEvaluation.value && serverEvaluation.value.qcvnId === selectedSubType.value) {
    return serverEvaluation.value
  }

  return evaluateQcvnSample({
    qcvnId: selectedSubType.value,
    measuredValues: measuredValues.value,
    samplingPeriods: activeSamplingPeriods.value,
    permitLimits: linkedProject.value?.form_data?.permitLimits || null,
    receivingWaterConfirmed: needsReceivingConfirmation.value ? receivingWaterConfirmed.value : true,
    qcvnDatabase: runtimeQcvnData.value,
    ruleSource: qcvnRuleSource.value === 'LOADING' ? 'DATABASE' : qcvnRuleSource.value,
  })
})

const evaluatedParams = computed(() => {
  if (!currentQcvn.value || !Array.isArray(currentQcvn.value.tham_so)) return []

  // Dùng kết quả từ 1 evaluator chuẩn (nếu bị gate nguồn tiếp nhận trả mảng rỗng -> vẫn render cấu trúc bảng thông số để người dùng nhập)
  const rawEvaluated = sampleEvaluation.value.evaluatedParams
  const evalMap = new Map()
  if (Array.isArray(rawEvaluated) && rawEvaluated.length > 0) {
    rawEvaluated.forEach(item => {
      if (!item.nhom && item.key) evalMap.set(item.key, item)
    })
  }

  return currentQcvn.value.tham_so.map(p => {
    if (p.nhom) return p

    const evalItem = evalMap.get(p.key)
    const rawVal = measuredValues.value
      ? (measuredValues.value[p.key] !== undefined ? measuredValues.value[p.key] : (p.key === 'Cr_tong' ? measuredValues.value.Cr3 : undefined))
      : undefined
    const val = (rawVal !== undefined && rawVal !== null && rawVal !== '') ? parseFloat(rawVal) : NaN

    let status = 'empty'
    let label = '—'
    let ratio = null
    let fillWidth = 0
    let fillColor = '#2E7D50'

    if (evalItem && evalItem.value !== undefined) {
      status = evalItem.status || 'empty'
      if (p.loai === 'min' && p.gioi_han > 0) {
        ratio = evalItem.value / p.gioi_han
      } else if (p.loai !== 'range' && p.gioi_han > 0) {
        ratio = evalItem.value / p.gioi_han
      } else if (p.loai !== 'range' && p.gioi_han === 0) {
        ratio = evalItem.value > 0 ? Infinity : 0
      }

      if (status === 'period_mismatch') {
        label = '⚠ Sai chu kỳ đo'
        fillColor = '#D4860A'
      } else if (status === 'can_ra_soat') {
        label = '⚠ Cần rà soát GPMT'
        fillColor = '#D4860A'
      } else if (status === 'fail') {
        if (evalItem.permitCompliant === false) {
          label = `✗ Vượt GPMT (${evalItem.permitLimit})`
        } else if (p.note === 'Không phát hiện' || p.gioi_han === 0) {
          label = '✗ Phát hiện'
        } else if (p.loai === 'min') {
          label = '✗ Thấp hơn ngưỡng'
        } else {
          label = ratio && Number.isFinite(ratio) ? `✗ Vượt ${ratio.toFixed(2)}x` : '✗ Vượt ngưỡng'
        }
        fillColor = '#C0392B'
      } else if (status === 'near') {
        label = ratio ? `⚠ ${Math.round(ratio * 100)}% ngưỡng` : '⚠ Gần giới hạn'
        fillColor = '#D4860A'
      } else if (status === 'pass') {
        if (p.note === 'Không phát hiện' || p.gioi_han === 0) {
          label = '✓ KPH (Không phát hiện)'
        } else {
          label = ratio !== null ? `✓ Đạt (${Math.round(ratio * 100)}%)` : '✓ Đạt'
        }
        fillColor = '#2E7D50'
      }

      if (ratio !== null && typeof ratio === 'number' && !Number.isNaN(ratio)) {
        fillWidth = p.loai === 'min'
          ? Math.min(Math.max(ratio * 50, 0), 100)
          : Math.min(Math.max(ratio * 100, 0), 100)
      } else if (p.loai === 'range' && p.max > p.min) {
        const pct = ((evalItem.value - p.min) / (p.max - p.min)) * 100
        fillWidth = Math.min(Math.max(pct, 0), 100)
      }
    }

    return {
      ...p,
      value: Number.isNaN(val) ? undefined : val,
      status,
      label,
      ratio,
      fillWidth,
      fillColor,
      permitLimit: evalItem?.permitLimit ?? null,
      permitCompliant: evalItem?.permitCompliant ?? null,
      qcvnCompliant: evalItem?.qcvnCompliant ?? null,
      permitNote: evalItem?.permitNote || null,
      periodMismatchNote: evalItem?.periodMismatchNote || null,
    }
  })
})

const summary = computed(() => {
  return sampleEvaluation.value.summary || { total: 0, pass: 0, near: 0, fail: 0, missingRequired: 0, periodMismatch: 0, invalidPermitLimits: 0 }
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
  receivingWaterConfirmed.value = false
  flowRate.value = null
  receivingWaterClass.value = ''
  isExistingFacility.value = false
  isUrbanArea.value = false
  evaluationDate.value = new Date().toISOString().slice(0, 10)
  samplingPeriods.value = { _default: '' }
  serverSelection.value = null
  serverEvaluation.value = null
  selectionMismatchWarning.value = ''
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
  const nganhCode = project.nganh || project.form_data?.nganh || ''
  const ntVal = Number(project.nt || project.form_data?.nt || 0)
  const receivingCol = project.form_data?.receivingWaterClass || ''
  const confirmedReceiving = Boolean(project.form_data?.receivingWaterConfirmed && receivingCol)
  const isExisting = Boolean(project.form_data?.isExistingFacility || project.form_data?.morongdt)

  isAutoMatching.value = true
  flowRate.value = ntVal > 0 ? ntVal : null
  receivingWaterClass.value = receivingCol
  receivingWaterConfirmed.value = confirmedReceiving
  isExistingFacility.value = isExisting
  isUrbanArea.value = nganhCode === 'do_thi'
  await nextTick()
  isAutoMatching.value = false

  await requestServerQcvnSelection({ projectOverride: project, clearSourceType: true })
  await requestServerQcvnEvaluation()
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
  serverSelection.value = null
  serverEvaluation.value = null
  selectionMismatchWarning.value = ''
  unsavedChanges.value = true
}

const computeOverallStatus = () => {
  return sampleEvaluation.value.trang_thai_tong_quat || 'can_ra_soat'
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

  const selCtx = buildQcvnSelectionPayload()
  const payload = {
    id: sampleId.value,
    name: sampleName.value,
    type: selectedType.value,
    sub_type: selectedSubType.value,
    values: finalValues,
    project_id: linkedProject.value?.id || null,
    samplingPeriods: activeSamplingPeriods.value,
    permitLimits: linkedProject.value?.form_data?.permitLimits || null,
    receivingWaterConfirmed: selCtx.receivingWaterConfirmed,
    flowRate: selCtx.flowRate,
    receivingWaterClass: selCtx.receivingWaterClass,
    isExistingFacility: selCtx.isExistingFacility,
    isUrbanArea: selCtx.isUrbanArea,
    evaluationDate: selCtx.evaluationDate,
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
      const srvEval = data.evaluation
      if (srvEval) serverEvaluation.value = srvEval
      if (data.serverSelection) serverSelection.value = data.serverSelection
      if (srvEval?.reason === 'QCVN_SELECTION_MISMATCH') {
        selectionMismatchWarning.value = srvEval.unverifiedReasons?.[0] || 'Cảnh báo lệch QCVN so với thông số chọn phía server (QCVN_SELECTION_MISMATCH).'
      } else {
        selectionMismatchWarning.value = ''
      }
      const statusSuffix = srvEval && !srvEval.isOfficialConclusion
        ? ` (Trạng thái Server: ${srvEval.overallStatus} — ${srvEval.trang_thai_tong_quat})`
        : ''
      alert((data.message || 'Lưu mẫu kết quả quan trắc thành công!') + statusSuffix)
      unsavedChanges.value = false
      sampleId.value = data.sample.id
      fetchSamples(currentPage.value)
    } else {
      const errData = await res.json().catch(() => ({}))
      alert(errData.error || 'Đã xảy ra lỗi khi lưu mẫu kết quả quan trắc!')
    }
  } catch (err) {
    logger.error('Lỗi lưu mẫu:', err)
  }
}

const selectSample = async (sample) => {
  if (unsavedChanges.value && !confirm('Bạn có thay đổi chưa lưu. Có chắc chắn muốn mở mẫu này và ghi đè dữ liệu hiện tại?')) {
    return
  }

  isAutoMatching.value = true
  sampleId.value = sample.id
  sampleName.value = sample.name
  selectedType.value = sample.type
  selectedSubType.value = sample.sub_type
  measuredValues.value = sample.values || {}
  const details = sample.evaluation_details || {}
  receivingWaterConfirmed.value = Boolean(details.receivingWaterConfirmed)
  flowRate.value = details.serverSelectionContext?.flowRate ?? null
  receivingWaterClass.value = details.serverSelectionContext?.receivingWaterClass || ''
  isExistingFacility.value = Boolean(details.serverSelectionContext?.isExistingFacility)
  isUrbanArea.value = Boolean(details.serverSelectionContext?.isUrbanArea)
  evaluationDate.value = details.evaluationDate || new Date().toISOString().slice(0, 10)
  serverSelection.value = details.serverSelection || null
  serverEvaluation.value = details.overallStatus ? { ...details, qcvnId: sample.sub_type, trang_thai_tong_quat: sample.trang_thai_tong_quat } : null
  selectionMismatchWarning.value = details.reason === 'QCVN_SELECTION_MISMATCH'
    ? (details.unverifiedReasons?.[0] || 'Mẫu từng lưu có cảnh báo lệch QCVN so với server select.')
    : ''
  samplingPeriods.value = details.samplingPeriods && details.samplingPeriods._default
    ? { _default: details.samplingPeriods._default }
    : { _default: '' }
  await nextTick()
  isAutoMatching.value = false
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
  if (!sampleEvaluation.value.canExportOfficialReport) {
    alert(`Không thể xuất báo cáo kết luận chính thức ở trạng thái ${sampleEvaluation.value.overallStatus}. Vui lòng bổ sung đầy đủ chỉ tiêu/nguồn tiếp nhận hoặc hoàn tất xác minh pháp lý trước.`)
    return
  }
  const now = new Date().toLocaleString('vi-VN')
  let lines = [
    '═══════════════════════════════════════════════════════',
    `KẾT QUẢ SO SÁNH QCVN (${sampleEvaluation.value.overallStatus})`,
    `Ngày: ${now}`,
    `Tên mẫu / Vị trí: ${sampleName.value || 'Mẫu không rõ tên'}`,
    `QCVN áp dụng: ${currentQcvn.value.ten}`,
    `Mục đích: ${currentQcvn.value.ap_dung}`,
    `Nguồn rule: ${sampleEvaluation.value.ruleSource} | Version: ${sampleEvaluation.value.ruleVersion || '—'}`,
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
    const resultText = p.status === 'fail' ? 'VƯỢT NGƯỠNG' : p.status === 'near' ? 'CẢNH BÁO' : p.status === 'pass' ? 'ĐẠT' : p.status === 'period_mismatch' ? 'SAI CHU KỲ ĐO' : p.status === 'can_ra_soat' ? 'CẦN RÀ SOÁT' : '—'
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
  if (!sampleEvaluation.value.canExportOfficialReport) {
    alert(`Đã khóa xuất PDF kết luận chính thức ở trạng thái ${sampleEvaluation.value.overallStatus}. Vui lòng bổ sung đầy đủ dữ liệu và sử dụng bộ QCVN đã xác minh pháp lý.`)
    return
  }
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
  receivingWaterConfirmed.value = false
  receivingWaterClass.value = ''
  serverSelection.value = null
  serverEvaluation.value = null
  selectionMismatchWarning.value = ''
  unsavedChanges.value = false
})

watch(
  [flowRate, receivingWaterClass, receivingWaterConfirmed, isExistingFacility, isUrbanArea, evaluationDate],
  () => {
    if (isAutoMatching.value || isSelectingQcvn.value) return
    clearTimeout(evaluateServerTimer)
    evaluateServerTimer = setTimeout(async () => {
      if (['nuoc_thai_cn', 'nuoc_thai_sh', 'nuoc_mat'].includes(selectedType.value) && (receivingWaterClass.value || flowRate.value !== null || isExistingFacility.value || receivingWaterConfirmed.value)) {
        await requestServerQcvnSelection({ clearSourceType: false })
      }
      await requestServerQcvnEvaluation()
    }, 350)
  }
)

watch(
  [selectedSubType, measuredValues, samplingPeriods],
  () => {
    unsavedChanges.value = true
    if (isAutoMatching.value || isSelectingQcvn.value) return
    clearTimeout(evaluateServerTimer)
    evaluateServerTimer = setTimeout(() => {
      requestServerQcvnEvaluation()
    }, 350)
  },
  { deep: true }
)

watch(measuredValues, () => {
  unsavedChanges.value = true
}, { deep: true })

const handleClickOutside = (e) => {
  if (projectSearchRef.value && !projectSearchRef.value.contains(e.target)) {
    showProjectDropdown.value = false
  }
}

onMounted(() => {
  fetchQcvnCatalog()
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
const showSamplesDrawer = ref(false)
const showQuickPaste = ref(false)
</script>

<template>
  <div id="qcvn" class="page container fade-up">
    <!-- Printable Header (Print Only) -->
    <div class="print-only-header" v-if="currentQcvn">
      <div style="text-align: center; margin-bottom: 24px; font-family: 'Be Vietnam Pro', sans-serif;">
        <h2 style="font-size: 22px; font-weight: 700; color: #286B4F; margin-bottom: 4px;">ETC LEGALHUB — BÁO CÁO QUAN TRẮC MÔI TRƯỜNG</h2>
        <h3 style="font-size: 15px; font-weight: 600; color: #192A21; margin-bottom: 16px; text-transform: uppercase;">BẢNG ĐỐI CHIẾU KẾT QUẢ QUAN TRẮC VỚI QUY CHUẨN KỸ THUẬT QUỐC GIA (QCVN)</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-bottom: 20px;">
          <tbody>
            <tr>
              <th style="width: 150px; padding: 4px 0; color: #526158;">Tên mẫu / Vị trí:</th>
              <td style="padding: 4px 0; font-weight: 600; color: #192A21;">{{ sampleName || 'Mẫu không rõ tên' }}</td>
            </tr>
            <tr>
              <th style="padding: 4px 0; color: #526158;">Quy chuẩn đối chiếu:</th>
              <td style="padding: 4px 0; font-weight: 600; color: #192A21;">{{ currentQcvn.ten }}</td>
            </tr>
            <tr>
              <th style="padding: 4px 0; color: #526158;">Áp dụng cho:</th>
              <td style="padding: 4px 0; color: #192A21;">{{ currentQcvn.ap_dung }}</td>
            </tr>
            <tr v-if="linkedProject">
              <th style="padding: 4px 0; color: #526158;">Dự án liên kết:</th>
              <td style="padding: 4px 0; font-weight: 600; color: #192A21;">{{ linkedProject.ten_du_an }}</td>
            </tr>
            <tr v-if="linkedProject && linkedProject.loai_ho_so">
              <th style="padding: 4px 0; color: #526158;">Loại hồ sơ / Nhóm:</th>
              <td style="padding: 4px 0; color: #192A21;">{{ linkedProject.loai_ho_so }} — {{ linkedProject.nhom_du_an || '' }}</td>
            </tr>
            <tr v-if="linkedProject && (linkedProject.tinh_thanh || linkedProject.dia_chi_hien_thi)">
              <th style="padding: 4px 0; color: #526158;">Địa chỉ dự án:</th>
              <td style="padding: 4px 0; color: #192A21;">{{ linkedProject.dia_chi_hien_thi || linkedProject.tinh_thanh }}</td>
            </tr>
            <tr>
              <th style="padding: 4px 0; color: #526158;">Thời gian xuất báo cáo:</th>
              <td style="padding: 4px 0; color: #192A21;">{{ new Date().toLocaleString('vi-VN') }}</td>
            </tr>
          </tbody>
        </table>
        <hr style="border: 0; border-top: 1px solid #E5EBE6; margin-bottom: 20px;"/>
      </div>
    </div>

    <!-- PAGE HEADER -->
    <div class="page-header no-print">
      <div>
        <h2 class="section-head">Đối chiếu Kết quả Quan trắc với QCVN</h2>
        <p class="section-desc">
          Nhập số liệu đo đạc hoặc dán nhanh bảng kết quả phân tích phòng thí nghiệm để tự động đánh giá mức độ tuân thủ quy chuẩn kỹ thuật quốc gia.
        </p>
      </div>
    </div>

    <!-- TRANSITION NOTICE -->
    <div class="notice-banner no-print">
      <i class="ti ti-info-circle"></i>
      <span>
        <strong>Lộ trình áp dụng quy chuẩn mới:</strong> Hệ thống áp dụng <strong>QCVN 40:2025/BTNMT</strong> (Nước thải công nghiệp), <strong>QCVN 14:2025/BTNMT</strong> (Nước thải sinh hoạt) và <strong>QCVN 05:2023/BTNMT</strong> (Không khí xung quanh). Trạng thái đánh giá: <strong style="color:var(--success)">Đạt chuẩn</strong>, <strong style="color:var(--warn)">Cảnh báo (&gt;80% ngưỡng)</strong>, <strong style="color:var(--red)">Vượt ngưỡng</strong>.
      </span>
    </div>

    <!-- TOP WORKSPACE SAMPLE BAR -->
    <div class="workspace-bar no-print">
      <div class="workspace-bar-left">
        <span style="font-size:12.5px;color:var(--text3);font-weight:500">Mẫu đang kiểm tra:</span>
        <div class="workspace-current-badge" :class="{ 'is-saved': !!sampleId }">
          <i class="ti" :class="sampleId ? 'ti-flask-2' : 'ti-plus'"></i>
          <span>{{ sampleId ? (sampleName || 'Mẫu đã lưu') : 'Mẫu mới (chưa lưu)' }}</span>
        </div>
        <span v-if="linkedProject" class="chip chip-info">
          <i class="ti ti-link"></i> {{ linkedProject.ten_du_an }}
        </span>
      </div>

      <div class="workspace-bar-actions">
        <button type="button" class="btn-secondary btn-sm" @click="showQuickPaste = !showQuickPaste">
          <i class="ti ti-clipboard-text"></i>
          <span>{{ showQuickPaste ? 'Ẩn khung dán nhanh' : 'Dán nhanh từ Excel / Lab' }}</span>
        </button>
        <button type="button" class="btn-secondary btn-sm" @click="clearValues">
          <i class="ti ti-plus"></i>
          <span>Tạo mẫu mới</span>
        </button>
        <button type="button" class="btn-primary btn-sm" @click="showSamplesDrawer = true">
          <i class="ti ti-folders"></i>
          <span>Mẫu đã lưu ({{ loadedSamples.length }})</span>
        </button>
      </div>
    </div>

    <!-- COLLAPSIBLE QUICK PASTE PANEL -->
    <div v-if="showQuickPaste" class="card no-print fade-up" style="background:var(--surface);border-color:var(--accent)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="card-title" style="font-size:13.5px">
          <i class="ti ti-clipboard-data"></i>
          <span>Dán nhanh bảng số liệu từ Phòng thí nghiệm (Excel / Word / PDF)</span>
        </div>
        <button type="button" class="drawer-close-btn" style="width:26px;height:26px" @click="showQuickPaste = false">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
        Sao chép các dòng thông số kèm kết quả (VD: <code>pH: 7.2</code>, <code>BOD5 18 mg/l</code>, <code>TSS: 24</code>) vào ô bên dưới để tự động điền bảng.
      </div>
      <textarea v-model="pasteArea" rows="3"
        placeholder="Ví dụ:&#13;pH: 7.2&#13;BOD5: 12 mg/l&#13;TSS: 15&#13;Asen: 0.008 mg/l"
        style="font-family:monospace;font-size:13px;background:var(--bg)"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
        <button type="button" class="btn-secondary btn-sm" @click="pasteArea = ''">Xóa ô dán</button>
        <button type="button" class="btn-primary btn-sm" @click="handleQuickPaste">
          <i class="ti ti-bolt"></i>
          <span>Tự động nhận diện &amp; điền bảng</span>
        </button>
      </div>
    </div>

    <!-- CONFIGURATION & PROJECT LINKING CARD -->
    <div class="card no-print" style="padding:18px 22px;margin-bottom:16px">
      <!-- Row 1: Project Link -->
      <div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
        <label class="form-label" style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <i class="ti ti-link" style="color:var(--accent)"></i>
          <span>Liên kết với hồ sơ dự án (tùy chọn)</span>
        </label>
        <div v-if="linkedProject"
             style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--accent2);border:1px solid var(--success-border);border-radius:var(--radius)">
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13.5px;color:var(--accent)">{{ linkedProject.ten_du_an }}</div>
            <div v-if="linkedProject.loai_ho_so" style="font-size:12px;color:var(--text2);margin-top:2px">
              {{ linkedProject.loai_ho_so }} · {{ linkedProject.nhom_du_an || '' }} · {{ linkedProject.tinh_thanh || linkedProject.dia_chi_hien_thi || '' }}
            </div>
            <div v-if="autoMatchMessage" style="font-size:11.5px;color:var(--accent);font-weight:500;margin-top:4px;display:flex;align-items:center;gap:4px">
              <i class="ti ti-sparkles"></i> {{ autoMatchMessage }}
            </div>
          </div>
          <button type="button" class="btn-secondary btn-sm" @click="unlinkProject" title="Gỡ liên kết dự án">
            <i class="ti ti-unlink"></i>
            <span>Gỡ liên kết</span>
          </button>
        </div>
        <div v-else ref="projectSearchRef" style="position:relative">
          <i class="ti ti-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
          <input type="text" v-model="projectSearchQuery"
                 @input="searchProjects(projectSearchQuery)"
                 @focus="projectSearchQuery.length >= 2 && searchProjects(projectSearchQuery)"
                 placeholder="Nhập tên dự án đã lưu để gắn mẫu quan trắc này vào hồ sơ..."
                 style="padding-left:34px" />
          <div v-if="showProjectDropdown"
               style="position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:0 0 var(--radius) var(--radius);box-shadow:var(--shadow-md);max-height:240px;overflow-y:auto;z-index:50">
            <div v-for="p in projectSearchResults" :key="p.id"
                 @click="selectLinkedProject(p)"
                 style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px">
              <div style="font-weight:600;color:var(--text)">{{ p.ten_du_an }}</div>
              <div style="font-size:11.5px;color:var(--text3);margin-top:2px">
                {{ p.loai_ho_so }} · {{ p.nhom_du_an }} · {{ p.tinh_thanh || p.dia_chi_hien_thi }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Row 2: QCVN Selection & Actions -->
      <div class="qcvn-toolbar">
        <div class="form-group" style="min-width:230px">
          <label class="form-label">Loại hình quy chuẩn (QCVN)</label>
          <select v-model="selectedType">
            <option value="nuoc_mat">Nước mặt (QCVN 08:2023)</option>
            <option value="nuoc_thai_cn">Nước thải công nghiệp (QCVN 40:2025)</option>
            <option value="nuoc_thai_sh">Nước thải sinh hoạt &amp; đô thị (QCVN 14:2025)</option>
            <option value="khi_thai_cn">Khí thải công nghiệp (QCVN 19:2024)</option>
            <option value="nuoc_duoi_dat">Nước dưới đất (QCVN 09:2023)</option>
            <option value="khong_khi">Không khí xung quanh (QCVN 05:2023)</option>
            <option value="dat">Chất lượng đất (QCVN 03:2023)</option>
          </select>
        </div>

        <div class="form-group" style="min-width:220px" v-show="SUB_TYPES[selectedType] && SUB_TYPES[selectedType].length > 1">
          <label class="form-label">Cột / Phân vùng tiếp nhận</label>
          <select v-model="selectedSubType">
            <option v-for="item in (SUB_TYPES[selectedType] || [])" :key="item.value" :value="item.value">{{ item.text }}</option>
          </select>
        </div>

        <div class="form-group" style="min-width:190px">
          <label class="form-label">Mã mẫu / Vị trí lấy mẫu</label>
          <input type="text" v-model="sampleName" placeholder="VD: NM-01, NT-01, KK-01..." />
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <button type="button" class="btn-secondary" @click="requestServerQcvnEvaluation" :disabled="isEvaluatingServer" title="Gửi số liệu lên API /api/qcvns/evaluate để đối chiếu theo DB">
            <i class="ti ti-server"></i>
            <span>{{ isEvaluatingServer ? 'Đang đối chiếu...' : 'Đối chiếu Server' }}</span>
          </button>
          <button type="button" class="btn-primary" @click="saveSample">
            <i class="ti ti-device-floppy"></i>
            <span>Lưu kết quả mẫu</span>
          </button>
          <button type="button" class="btn-secondary"
                  :disabled="!sampleEvaluation.canExportOfficialReport"
                  :style="!sampleEvaluation.canExportOfficialReport ? 'opacity:0.5;cursor:not-allowed' : ''"
                  :title="sampleEvaluation.canExportOfficialReport ? 'Xuất báo cáo chính thức' : 'Đã khóa: mẫu chưa đủ điều kiện kết luận chính thức'"
                  @click="exportPDF">
            <i class="ti ti-printer"></i>
            <span>Xuất PDF / In</span>
          </button>
          <button type="button" class="btn-secondary"
                  :disabled="!sampleEvaluation.canExportOfficialReport"
                  :style="!sampleEvaluation.canExportOfficialReport ? 'opacity:0.5;cursor:not-allowed' : ''"
                  :title="sampleEvaluation.canExportOfficialReport ? 'Tải file kết luận chính thức' : 'Đã khóa: mẫu chưa đủ điều kiện kết luận chính thức'"
                  @click="exportTxt">
            <i class="ti ti-download"></i>
            <span>Xuất Text</span>
          </button>
          <button type="button" class="btn-ghost" @click="clearValues" title="Xóa trắng số liệu đang nhập">
            <i class="ti ti-eraser"></i>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      <!-- Row 3: Completeness, Source Confirmation, Flow Rate & Sampling Period Gates -->
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <template v-if="needsReceivingConfirmation">
          <div style="display:flex;align-items:center;gap:6px;font-size:12.5px">
            <label class="form-label" style="margin:0;white-space:nowrap">Cột / Phân vùng:</label>
            <select v-model="receivingWaterClass" style="width:118px;height:34px;font-size:12.5px">
              <option value="">Chưa chọn</option>
              <option value="A">Cột A</option>
              <option value="B">Cột B</option>
              <option value="C" v-if="selectedType === 'nuoc_mat' || selectedType === 'nuoc_thai_cn'">Cột C</option>
            </select>
          </div>

          <div v-if="selectedType === 'nuoc_thai_cn' || selectedType === 'nuoc_thai_sh'" style="display:flex;align-items:center;gap:6px;font-size:12.5px">
            <label class="form-label" style="margin:0;white-space:nowrap">Lưu lượng F (m³/ngày):</label>
            <input type="number" v-model="flowRate" min="0" step="any" placeholder="VD: 120" style="width:105px;height:34px;font-size:12.5px" />
          </div>

          <label v-if="selectedType === 'nuoc_thai_sh'" style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer">
            <input type="checkbox" v-model="isUrbanArea" />
            <span>Khu đô thị</span>
          </label>

          <label style="display:flex;align-items:center;gap:6px;font-size:12.5px;cursor:pointer">
            <input type="checkbox" v-model="isExistingFacility" />
            <span>Cơ sở hiện hữu / chuyển tiếp</span>
          </label>

          <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:600;color:var(--text);cursor:pointer">
            <input type="checkbox" v-model="receivingWaterConfirmed" />
            <span>Đã xác nhận nguồn tiếp nhận &amp; Cột áp dụng</span>
          </label>
        </template>

        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px">
          <label class="form-label" style="margin:0;white-space:nowrap">Chu kỳ lấy mẫu / trung bình:</label>
          <select v-model="samplingPeriods._default" style="width:175px;height:34px;font-size:12.5px">
            <option value="">Theo quy định từng chỉ tiêu</option>
            <option value="1 giờ">Trung bình 1 giờ</option>
            <option value="8 giờ">Trung bình 8 giờ</option>
            <option value="24 giờ">Trung bình 24 giờ</option>
            <option value="Năm">Trung bình Năm</option>
          </select>
        </div>

        <button type="button" class="btn-secondary btn-sm" :disabled="isSelectingQcvn" @click="requestServerQcvnSelection({ clearSourceType: false })" title="Gọi POST /api/qcvns/select xác định QCVN từ Server">
          <i class="ti ti-sparkles"></i>
          <span>{{ isSelectingQcvn ? 'Đang chọn...' : 'Chọn QCVN từ Server' }}</span>
        </button>

        <span class="chip" :class="qcvnRuleSource === 'DATABASE' ? 'chip-info' : 'chip-gray'" style="margin-left:auto;font-size:11px">
          Catalog: {{ qcvnRuleSource }}
          <template v-if="currentQcvn?.status"> · {{ currentQcvn.status }}</template>
          <template v-if="serverSelection?.ruleVersion"> · v{{ serverSelection.ruleVersion }}</template>
        </span>
      </div>
    </div>

    <!-- QCVN_SELECTION_MISMATCH / SERVER SELECTION ALERT -->
    <div v-if="selectionMismatchWarning"
         class="no-print"
         style="margin-bottom:14px;padding:12px 16px;border-radius:var(--radius);border:1px solid var(--danger-border);background:var(--red-bg);color:var(--red);font-size:12.5px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
      <div>
        <strong><i class="ti ti-alert-octagon"></i> Lệch lựa chọn QCVN so với Server (QCVN_SELECTION_MISMATCH):</strong>
        {{ selectionMismatchWarning }}
      </div>
      <button v-if="serverSelection?.qcvnId" type="button" class="btn-secondary btn-sm" @click="requestServerQcvnSelection({ clearSourceType: false })">
        Đồng bộ theo Server ({{ serverSelection.qcvnId }})
      </button>
    </div>

    <!-- FALLBACK / VERIFICATION / INCOMPLETE BANNER (Q-02, Q-05, Q-10, Q-11) -->
    <div v-if="qcvnRuleSource === 'FALLBACK_UNVERIFIED' || !sampleEvaluation.isOfficialConclusion"
         class="no-print"
         style="margin-bottom:16px;padding:12px 16px;border-radius:var(--radius);border:1px solid #F59E0B;background:#FFFBEB;color:#92400E;font-size:12.5px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;font-weight:700">
        <span>
          <i class="ti ti-alert-triangle"></i>
          Trạng thái đánh giá: {{ sampleEvaluation.overallStatus }} (Lưu DB: {{ sampleEvaluation.trang_thai_tong_quat }})
          <template v-if="sampleEvaluation.preliminaryStatus && sampleEvaluation.preliminaryStatus !== sampleEvaluation.overallStatus">
            · Đánh giá kỹ thuật sơ bộ: {{ sampleEvaluation.preliminaryStatus }}
          </template>
        </span>
        <span style="font-size:11.5px;font-weight:600">
          {{ sampleEvaluation.canExportOfficialReport ? 'Đủ điều kiện xuất chính thức' : 'Đã khóa xuất kết luận chính thức' }}
        </span>
      </div>
      <div v-if="qcvnCatalogError" style="margin-top:4px;font-weight:600">
        Cảnh báo kết nối API QCVN ({{ qcvnCatalogError }}): Đang ở chế độ fallback cục bộ — mọi kết quả mang tính rà soát.
      </div>
      <ul v-if="sampleEvaluation.unverifiedReasons && sampleEvaluation.unverifiedReasons.length"
          style="margin:6px 0 0 18px;padding:0;line-height:1.5">
        <li v-for="(reason, idx) in sampleEvaluation.unverifiedReasons" :key="'qr-' + idx">{{ reason }}</li>
      </ul>
      <div v-if="summary.missingRequired > 0" style="margin-top:4px">
        • Còn thiếu <strong>{{ summary.missingRequired }}</strong> chỉ tiêu bắt buộc chưa nhập số liệu (INCOMPLETE — không thể kết luận Đạt).
      </div>
      <div v-if="summary.periodMismatch > 0" style="margin-top:4px">
        • Phát hiện <strong>{{ summary.periodMismatch }}</strong> chỉ tiêu lệch chu kỳ trung bình lấy mẫu (PERIOD_MISMATCH — cần rà soát).
      </div>
    </div>

    <!-- KPI SUMMARY STRIP -->
    <div class="kpi-grid" v-if="summary.total > 0">
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Thông số đã nhập</span>
          <div class="kpi-icon"><i class="ti ti-list-numbers"></i></div>
        </div>
        <div class="kpi-value">{{ summary.total }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Đạt quy chuẩn</span>
          <div class="kpi-icon"><i class="ti ti-circle-check"></i></div>
        </div>
        <div class="kpi-value" style="color:var(--success)">{{ summary.pass }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Cảnh báo (&gt;80% ngưỡng)</span>
          <div class="kpi-icon warn"><i class="ti ti-alert-triangle"></i></div>
        </div>
        <div class="kpi-value" style="color:var(--warn)">{{ summary.near }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Vượt ngưỡng QCVN</span>
          <div class="kpi-icon danger"><i class="ti ti-circle-x"></i></div>
        </div>
        <div class="kpi-value" style="color:var(--red)">{{ summary.fail }}</div>
      </div>
    </div>

    <!-- FULL-WIDTH PARAMETERS DATA TABLE -->
    <div class="card" style="padding:0;overflow:hidden" v-if="currentQcvn">
      <!-- Top Table Bar -->
      <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;background:var(--surface);border-bottom:1px solid var(--border);flex-wrap:wrap;gap:12px">
        <div style="font-size:13px;color:var(--text2);display:flex;align-items:center;gap:8px">
          <i class="ti ti-table" style="color:var(--accent);font-size:16px"></i>
          <span>Danh mục <strong>{{ evaluatedParams.filter(p => !p.nhom).length }}</strong> chỉ tiêu theo <strong>{{ currentQcvn.ten }}</strong></span>
          <span v-if="paramPageSize < 999 && totalParamPages > 1" style="color:var(--text3)">(Trang {{ paramCurrentPage }}/{{ totalParamPages }})</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
          <span>Hiển thị:</span>
          <select v-model.number="paramPageSize" style="width:140px;height:32px;font-size:12.5px">
            <option :value="10">10 thông số / trang</option>
            <option :value="20">20 thông số / trang</option>
            <option :value="50">50 thông số / trang</option>
            <option :value="999">Tất cả thông số</option>
          </select>
        </div>
      </div>

      <div id="qv-table-wrap" style="overflow-x:auto">
        <table class="qcvn-table" style="width:100%;min-width:780px">
          <thead>
            <tr>
              <th style="width:30%">Thông số ô nhiễm</th>
              <th style="width:12%">Đơn vị</th>
              <th style="width:16%">Giá trị giới hạn</th>
              <th style="width:14%">Kết quả đo</th>
              <th style="width:14%">Kết luận</th>
              <th style="width:14%">Tỉ lệ so với ngưỡng</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(p, i) in paginatedParams" :key="i">
              <tr v-if="p.nhom">
                <td class="param-group-head" colspan="6">{{ p.nhom }}</td>
              </tr>

              <tr v-else :class="{ 'row-pass': p.status === 'pass', 'row-fail': p.status === 'fail', 'row-near': p.status === 'near' }">
                <td style="font-weight:500;color:var(--text)">{{ p.ten }}</td>
                <td style="color:var(--text3);font-size:12.5px">{{ p.don_vi }}</td>
                <td>
                  <span class="limit-val">
                    {{ p.loai === 'range' ? `${p.min} – ${p.max}` : p.loai === 'min' ? `≥ ${p.gioi_han}` : (p.note || `≤ ${p.gioi_han}`) }}
                  </span>
                </td>
                <td>
                  <input type="number" step="any" min="0" v-model.number="measuredValues[p.key]" placeholder="—" class="no-print" />
                  <span class="print-only">{{ p.value !== undefined && p.value !== null && !isNaN(p.value) ? p.value : '—' }}</span>
                </td>
                <td>
                  <span v-if="p.status === 'empty'" class="result-empty">
                    {{ p.required !== false ? '— (Bắt buộc)' : '—' }}
                  </span>
                  <span v-else-if="p.status === 'pass'" class="result-pass">{{ p.label || '✓ Đạt' }}</span>
                  <span v-else-if="p.status === 'near'" class="result-near">{{ p.label || 'Cảnh báo' }}</span>
                  <span v-else-if="p.status === 'fail'" class="result-fail">{{ p.label || '✗ Vượt ngưỡng' }}</span>
                  <span v-else-if="p.status === 'period_mismatch'" class="result-near" :title="p.periodMismatchNote">{{ p.label || '⚠ Sai chu kỳ đo' }}</span>
                  <span v-else-if="p.status === 'can_ra_soat'" class="result-near" :title="p.permitNote">{{ p.label || '⚠ Cần rà soát' }}</span>
                </td>
                <td>
                  <div v-if="p.status !== 'empty' && typeof p.ratio === 'number' && !isNaN(p.ratio)" style="display:flex;align-items:center;gap:8px">
                    <span class="ratio-bar">
                      <span class="ratio-fill" :style="{ width: p.fillWidth + '%', background: p.fillColor }"></span>
                    </span>
                    <span style="font-size:11.5px;color:var(--text2);font-weight:500">{{ Number.isFinite(p.ratio) ? p.ratio.toFixed(2) + 'x' : '∞' }}</span>
                  </div>
                  <div v-else-if="p.status !== 'empty' && p.loai === 'range'" style="display:flex;align-items:center;gap:8px">
                    <span class="ratio-bar">
                      <span class="ratio-fill" :style="{ width: p.fillWidth + '%', background: p.fillColor }"></span>
                    </span>
                    <span style="font-size:11px;color:var(--text3)">[{{ p.min }}–{{ p.max }}]</span>
                  </div>
                  <span v-else style="color:var(--text3)">—</span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Bottom Table Pagination -->
      <div v-if="paramPageSize < 999 && totalParamPages > 1" class="no-print"
           style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid var(--border);background:var(--surface);flex-wrap:wrap;gap:10px">
        <div style="font-size:12.5px;color:var(--text2)">
          Hiển thị dòng <strong>{{ (paramCurrentPage - 1) * paramPageSize + 1 }}</strong> – <strong>{{ Math.min(paramCurrentPage * paramPageSize, evaluatedParams.length) }}</strong> / {{ evaluatedParams.length }}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" class="pagination-btn" :disabled="paramCurrentPage === 1" @click="paramCurrentPage--">‹ Trước</button>
          <button v-for="pg in totalParamPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === paramCurrentPage }" @click="paramCurrentPage = pg">{{ pg }}</button>
          <button type="button" class="pagination-btn" :disabled="paramCurrentPage === totalParamPages" @click="paramCurrentPage++">Sau ›</button>
        </div>
      </div>

      <!-- Footer note -->
      <div style="padding:12px 20px;border-top:1px solid var(--border);background:var(--bg);font-size:12px;color:var(--text3);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <span class="no-print">Nhập giá trị vào cột "Kết quả đo" — kết luận đối chiếu được tính toán theo thời gian thực.</span>
        <span>Áp dụng: {{ currentQcvn.ap_dung }}</span>
      </div>
    </div>

    <!-- SLIDE-OVER DRAWER: SAVED SAMPLES -->
    <div v-if="showSamplesDrawer" class="drawer-overlay no-print" @click.self="showSamplesDrawer = false">
      <div class="drawer-panel drawer-sm">
        <div class="drawer-header">
          <div class="drawer-title">
            <i class="ti ti-flask-2" style="color:var(--accent)"></i>
            <span>Danh sách Mẫu quan trắc đã lưu</span>
          </div>
          <button type="button" class="drawer-close-btn" @click="showSamplesDrawer = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div class="drawer-body">
          <button type="button" class="btn-primary" style="width:100%;margin-bottom:16px"
                  @click="clearValues(); showSamplesDrawer = false">
            <i class="ti ti-plus"></i>
            <span>Tạo mẫu quan trắc mới</span>
          </button>

          <div v-if="loadedSamples.length === 0" style="text-align:center;padding:36px 16px;color:var(--text3);font-size:13px">
            Chưa có mẫu quan trắc nào được lưu.
          </div>

          <div v-else style="display:flex;flex-direction:column;gap:8px">
            <div v-for="s in loadedSamples" :key="s.id" class="project-item">
              <button type="button" class="project-btn" :class="{ active: sampleId === s.id }"
                      @click="selectSample(s); showSamplesDrawer = false">
                <div>{{ s.name }}</div>
                <div v-if="s.project_name" style="font-size:11.5px;color:var(--text3);font-weight:400;margin-top:2px;display:flex;align-items:center;gap:4px">
                  <i class="ti ti-link"></i>
                  <span>{{ s.project_name }}</span>
                </div>
              </button>
              <button type="button" class="btn-delete-project" @click="handleDeleteSample(s.id)" title="Xóa mẫu">
                <i class="ti ti-trash"></i>
              </button>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;font-size:12px;color:var(--text2)">
            <span>Số lượng hiển thị:</span>
            <select v-model.number="sampleLimit" @change="fetchSamples(1)" style="width:100px;height:30px;font-size:12px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>

          <div v-if="totalPages > 1" class="pagination-container">
            <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="fetchSamples(currentPage - 1)">&lt;</button>
            <button v-for="page in totalPages" :key="page" type="button" class="pagination-btn" :class="{ active: page === currentPage }" @click="fetchSamples(page)">
              {{ page }}
            </button>
            <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="fetchSamples(currentPage + 1)">&gt;</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
