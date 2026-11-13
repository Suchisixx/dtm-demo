<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { useAdminPagination } from '../composables/useAdminPagination.js'
import {
  getAdminSeverityMeta,
  getAdminEventActionLabel,
  getAdminStatusLabel,
  getAdminTargetTypeLabel,
} from '../utils/legalLabels.js'

const props = defineProps({
  currentUser: Object
})

// Trạng thái trang con
const currentSubpage = ref('users')

// Metadata ngành nghề runtime lấy từ PostgreSQL, thay cho danh mục tĩnh
const industriesMeta = ref({})
const fetchAdminIndustriesMeta = async () => {
  try {
    const res = await fetch(API.CLASSIFY_METADATA)
    if (res.ok) {
      const data = await res.json()
      industriesMeta.value = data.industries || {}
    }
  } catch (err) {
    logger.warn('Không tải được catalog ngành nghề cho AdminTab:', err)
  }
}

// Trạng thái dữ liệu
const users = ref([])
const projects = ref([])
const laws = ref([])

// Tìm kiếm và lọc văn bản ở trang con
const lawSearchQuery = ref('')
const lawFilterType = ref('all')

// Trạng thái hộp thoại người dùng
const showUserModal = ref(false)
const userForm = ref({
  id: '',
  username: '',
  fullName: '',
  password: '',
  role: 'staff'
})
const userModalError = ref('')
const isUserEdit = ref(false)

// Trạng thái hộp thoại văn bản
const showLawModal = ref(false)
const lawForm = ref({
  id: '',
  type: 'luat',
  year: new Date().getFullYear(),
  sortDate: '',
  so: '',
  status: 'valid',
  ten: '',
  hieuluc: '',
  mo_ta: '',
  dieu_khoang_text: '',
  note: '',
  link: ''
})
const lawModalError = ref('')
const isLawEdit = ref(false)

// Tải dữ liệu từ API
const fetchUsers = async () => {
  try {
    const res = await fetch(API.ADMIN_USERS)
    if (res.ok) {
      users.value = await res.json()
    }
  } catch (err) {
    logger.error('Lỗi fetch users:', err)
  }
}

const fetchAllProjects = async () => {
  try {
    const res = await fetch(API.ADMIN_PROJECTS)
    if (res.ok) {
      projects.value = await res.json()
    }
  } catch (err) {
    logger.error('Lỗi fetch projects:', err)
  }
}

const fetchLaws = async () => {
  try {
    const res = await fetch(API.LAWS)
    if (res.ok) {
      laws.value = await res.json()
    }
  } catch (err) {
    logger.error('Lỗi fetch laws:', err)
  }
}

// Cấu hình và thao tác crawler
const autoCrawlEnabled = ref(false)
const crawlHistory = ref([])
const isCrawling = ref(false)
const crawlerMessage = ref('')
const crawlerStatusType = ref('info')
const lastCrawlStats = ref(null)

// === Kiểm duyệt quy tắc, tác động văn bản và QCVN chuyển tiếp ===
const lawImpacts = ref([])
const impactStatusFilter = ref('OPEN')
const ruleCandidates = ref([])
const candidateStatusFilter = ref('PENDING_REVIEW')
const rulesCatalog = ref({ industries: [], qcvns: [], summary: { industriesTotal: 0, industriesVerified: 0, qcvnsTotal: 0, qcvnsVerified: 0 } })
const rulesLoading = ref(false)
const rulesFeedback = ref('')
const rulesFeedbackError = ref('')
const impactNotes = ref({})
const candidateSourceDocs = ref({})
const candidateNotes = ref({})
const qcvnSourceDocs = ref({})
const industrySourceDocs = ref({})
const transitionalForm = ref({
  id: 'qcvn40_2011_b',
  ten: '',
  apDung: '',
  columnCode: 'B',
  flowRange: '',
  effectiveFrom: '2011-12-15',
  effectiveTo: '2025-08-31',
  sourceDocument: '',
  thamSoText: ''
})

const SHOW_CRAWLER = ref(true)
const SHOW_DEV_RULES_PANEL = ref(false)
const SHOW_ADVANCED_RULE_TOOLS = ref(false)

const thresholdRules = ref([])
const thresholdLoading = ref(false)
const thresholdStatusFilter = ref('ALL')
const thresholdSearch = ref('')
const isEditingThresholdModalOpen = ref(false)
const editingThreshold = ref({})
const isVerifyingThresholdModalOpen = ref(false)
const verifyingThreshold = ref({})
const thresholdFeedback = ref('')
const thresholdFeedbackError = ref('')

const fetchThresholdRules = async () => {
  thresholdLoading.value = true
  thresholdFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}?status=${encodeURIComponent(thresholdStatusFilter.value || 'ALL')}`)
    if (res.ok) {
      const data = await res.json()
      thresholdRules.value = data.thresholds || []
    }
  } catch (err) {
    logger.error('Lỗi tải danh sách ngưỡng:', err)
  } finally {
    thresholdLoading.value = false
  }
}

const filteredThresholdRules = computed(() => {
  let list = thresholdRules.value || []
  if (thresholdSearch.value.trim()) {
    const q = thresholdSearch.value.trim().toLowerCase()
    list = list.filter(r => 
      (r.industry_name && r.industry_name.toLowerCase().includes(q)) ||
      (r.industry_code && r.industry_code.toLowerCase().includes(q)) ||
      (r.process_stage && r.process_stage.toLowerCase().includes(q)) ||
      (r.legal_ref && r.legal_ref.toLowerCase().includes(q))
    )
  }
  return list
})

const openEditThresholdModal = (rule) => {
  editingThreshold.value = { ...rule }
  isEditingThresholdModalOpen.value = true
}

const saveThresholdEdit = async (asDraft = false) => {
  thresholdLoading.value = true
  thresholdFeedback.value = ''
  thresholdFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}/${editingThreshold.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editingThreshold.value,
        asDraft,
      })
    })
    const data = await res.json()
    if (res.ok) {
      thresholdFeedback.value = data.message || 'Đã cập nhật quy tắc thành công!'
      isEditingThresholdModalOpen.value = false
      await fetchThresholdRules()
      await fetchRuleVerificationCenter()
    } else {
      thresholdFeedbackError.value = data.error || 'Không thể cập nhật quy tắc!'
    }
  } catch (err) {
    thresholdFeedbackError.value = err.message || 'Lỗi mạng khi cập nhật quy tắc!'
  } finally {
    thresholdLoading.value = false
  }
}

const openVerifyThresholdModal = (rule) => {
  verifyingThreshold.value = {
    id: rule.id,
    industry_name: rule.industry_name,
    legalRef: rule.legal_ref || '',
    effectiveFrom: rule.effective_from || new Date().toISOString().slice(0, 10),
  }
  isVerifyingThresholdModalOpen.value = true
}

const confirmVerifyThreshold = async () => {
  if (!verifyingThreshold.value.legalRef?.trim()) {
    thresholdFeedbackError.value = 'Vui lòng nhập căn cứ pháp lý trước khi phê duyệt!'
    return
  }
  if (!verifyingThreshold.value.effectiveFrom) {
    thresholdFeedbackError.value = 'Vui lòng chọn ngày bắt đầu hiệu lực trước khi phê duyệt!'
    return
  }
  thresholdLoading.value = true
  thresholdFeedback.value = ''
  thresholdFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}/${verifyingThreshold.value.id}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        legalRef: verifyingThreshold.value.legalRef.trim(),
        effectiveFrom: verifyingThreshold.value.effectiveFrom,
      })
    })
    const data = await res.json()
    if (res.ok) {
      thresholdFeedback.value = data.message || 'Đã phê duyệt quy tắc thành công!'
      isVerifyingThresholdModalOpen.value = false
      await fetchThresholdRules()
      await fetchRuleVerificationCenter()
    } else {
      thresholdFeedbackError.value = data.error || 'Không thể phê duyệt quy tắc!'
    }
  } catch (err) {
    thresholdFeedbackError.value = err.message || 'Lỗi mạng khi phê duyệt quy tắc!'
  } finally {
    thresholdLoading.value = false
  }
}

const pendingImpactsCount = computed(() => lawImpacts.value.filter(i => i.status === 'OPEN').length)
const pendingCandidatesCount = computed(() => ruleCandidates.value.filter(c => ['PENDING_REVIEW', 'EXTRACTED'].includes(c.status)).length)

const fetchRuleVerificationCenter = async () => {
  rulesLoading.value = true
  rulesFeedbackError.value = ''
  try {
    const [impRes, candRes, catRes] = await Promise.all([
      fetch(`${API.ADMIN_RULES_IMPACTS}?status=${encodeURIComponent(impactStatusFilter.value || 'ALL')}`),
      fetch(`${API.ADMIN_RULES_CANDIDATES}?status=${encodeURIComponent(candidateStatusFilter.value || 'ALL')}`),
      fetch(API.ADMIN_RULES_CATALOG),
    ])
    if (impRes.ok) {
      const impData = await impRes.json()
      lawImpacts.value = impData.impacts || []
    }
    if (candRes.ok) {
      const candData = await candRes.json()
      ruleCandidates.value = candData.candidates || []
      for (const c of ruleCandidates.value) {
        if (!candidateSourceDocs.value[c.id]) {
          candidateSourceDocs.value[c.id] = c.proposed_data?.sourceDocument || ''
        }
      }
    }
    if (catRes.ok) {
      const catData = await catRes.json()
      rulesCatalog.value = catData
      for (const q of (catData.qcvns || [])) {
        if (!qcvnSourceDocs.value[q.id] && q.source_document) {
          qcvnSourceDocs.value[q.id] = q.source_document
        }
      }
      for (const ind of (catData.industries || [])) {
        if (!industrySourceDocs.value[ind.code] && ind.source_document) {
          industrySourceDocs.value[ind.code] = ind.source_document
        }
      }
    }
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Không thể tải dữ liệu kiểm duyệt rule.'
  } finally {
    rulesLoading.value = false
  }
}

const resolveImpactAction = async (impactId, status) => {
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_IMPACTS}/${impactId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        resolutionNote: impactNotes.value[impactId] || null
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể cập nhật tác động văn bản.'
      return
    }
    rulesFeedback.value = data.message || 'Đã cập nhật tác động văn bản.'
    await fetchRuleVerificationCenter()
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
  }
}

const editingQcvnCand = ref(null)
const editingQcvnParams = ref([])
const candidateParamsModalError = ref('')

const openCandidateParamsModal = (cand) => {
  candidateParamsModalError.value = ''
  editingQcvnCand.value = cand
  const existing = Array.isArray(cand?.proposed_data?.tham_so) ? cand.proposed_data.tham_so : []
  editingQcvnParams.value = existing.length > 0
    ? existing.map(p => ({
        ma: p.ma || p.key || '',
        ten: p.ten || p.name || '',
        don_vi: p.don_vi || p.unit || 'mg/L',
        limit: p.limit ?? p.gioi_han ?? p.max ?? '',
        min: p.min ?? '',
        max: p.max ?? '',
        loai: p.loai || 'max'
      }))
    : [{ ma: 'COD', ten: 'Nhu cầu oxy hóa học (COD)', don_vi: 'mg/L', limit: 150, min: '', max: '', loai: 'max' }]
}

const addCandidateParamRow = () => {
  editingQcvnParams.value.push({ ma: '', ten: '', don_vi: 'mg/L', limit: '', min: '', max: '', loai: 'max' })
}

const removeCandidateParamRow = (idx) => {
  editingQcvnParams.value.splice(idx, 1)
}

const applyCommonWastewaterPreset = () => {
  editingQcvnParams.value = [
    { ma: 'pH', ten: 'pH', don_vi: '—', limit: '', min: 5.5, max: 9, loai: 'range' },
    { ma: 'TSS', ten: 'Tổng chất rắn lơ lửng (TSS)', don_vi: 'mg/L', limit: 100, min: '', max: '', loai: 'max' },
    { ma: 'COD', ten: 'Nhu cầu oxy hóa học (COD)', don_vi: 'mg/L', limit: 150, min: '', max: '', loai: 'max' },
    { ma: 'BOD5', ten: 'Nhu cầu oxy sinh hóa (BOD5)', don_vi: 'mg/L', limit: 50, min: '', max: '', loai: 'max' }
  ]
}

const approveCandidateAction = async (cand, overrideProposedData = null) => {
  const sourceDoc = (candidateSourceDocs.value[cand.id] || '').trim()
  if (!sourceDoc) {
    rulesFeedbackError.value = 'Bắt buộc nhập số hiệu văn bản / căn cứ pháp lý trước khi phê duyệt đề xuất!'
    return
  }
  if (
    !overrideProposedData &&
    cand.target_type === 'QCVN' &&
    (!Array.isArray(cand.proposed_data?.tham_so) || cand.proposed_data.tham_so.length === 0)
  ) {
    openCandidateParamsModal(cand)
    return
  }
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_CANDIDATES}/${cand.id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceDocument: sourceDoc,
        reviewNote: candidateNotes.value[cand.id] || null,
        ...(overrideProposedData ? { proposedData: overrideProposedData } : {})
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể duyệt đề xuất quy tắc.'
      return false
    }
    rulesFeedback.value = data.message || `Đã phê duyệt và công bố đề xuất #${cand.id}.`
    await fetchRuleVerificationCenter()
    return true
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
    return false
  }
}

const confirmApproveCandidateWithParams = async () => {
  if (!editingQcvnCand.value) return
  candidateParamsModalError.value = ''
  const cleaned = editingQcvnParams.value
    .map(p => {
      const ma = String(p.ma || '').trim()
      const ten = String(p.ten || '').trim()
      if (!ma || !ten) return null
      const loai = p.loai === 'range' ? 'range' : 'max'
      if (loai === 'range') {
        const min = Number(p.min)
        const max = Number(p.max)
        if (Number.isNaN(min) || Number.isNaN(max) || min > max) return null
        return { ma, key: ma.toLowerCase(), ten, don_vi: p.don_vi || '—', loai: 'range', min, max }
      }
      const lim = Number(p.limit)
      if (Number.isNaN(lim) || lim < 0) return null
      return { ma, key: ma.toLowerCase(), ten, don_vi: p.don_vi || 'mg/L', loai: 'max', gioi_han: lim, limit: lim }
    })
    .filter(Boolean)

  if (cleaned.length === 0) {
    candidateParamsModalError.value = 'Vui lòng nhập ít nhất 1 thông số hợp lệ (mã, tên và ngưỡng số hợp lệ).'
    return
  }

  const cand = editingQcvnCand.value
  const nextProposed = { ...(cand.proposed_data || {}), tham_so: cleaned }
  const ok = await approveCandidateAction(cand, nextProposed)
  if (ok) {
    editingQcvnCand.value = null
  } else if (rulesFeedbackError.value) {
    candidateParamsModalError.value = rulesFeedbackError.value
  }
}

const rejectCandidateAction = async (cand) => {
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_CANDIDATES}/${cand.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: candidateNotes.value[cand.id] || null })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể từ chối đề xuất quy tắc.'
      return
    }
    rulesFeedback.value = data.message || `Đã từ chối đề xuất #${cand.id}.`
    await fetchRuleVerificationCenter()
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
  }
}

const verifyQcvnAction = async (qcvn) => {
  const sourceDoc = (qcvnSourceDocs.value[qcvn.id] || qcvn.source_document || '').trim()
  if (!sourceDoc) {
    rulesFeedbackError.value = `Vui lòng nhập số hiệu công báo / QĐ ban hành cho ${qcvn.id} trước khi xác nhận!`
    return
  }
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_QCVN_VERIFY}/${encodeURIComponent(qcvn.id)}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceDocument: sourceDoc })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || `Không thể xác minh ${qcvn.id}.`
      return
    }
    rulesFeedback.value = data.message || `Đã xác nhận pháp lý cho ${qcvn.id}.`
    await fetchRuleVerificationCenter()
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
  }
}

const verifyIndustryAction = async (ind) => {
  const sourceDoc = (industrySourceDocs.value[ind.code] || ind.source_document || '').trim()
  if (!sourceDoc) {
    rulesFeedbackError.value = `Vui lòng nhập căn cứ văn bản cho ngành ${ind.code} trước khi xác nhận!`
    return
  }
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_INDUSTRY_VERIFY}/${encodeURIComponent(ind.code)}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceDocument: sourceDoc })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || `Không thể xác minh ngành ${ind.code}.`
      return
    }
    rulesFeedback.value = data.message || `Đã xác nhận pháp lý cho ngành ${ind.code}.`
    await fetchRuleVerificationCenter()
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
  }
}

const submitTransitionalQcvn = async () => {
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  let parsedParams = null
  try {
    parsedParams = JSON.parse(transitionalForm.value.thamSoText || '[]')
    if (!Array.isArray(parsedParams) || parsedParams.length === 0) {
      throw new Error('Danh sách thông số JSON phải là mảng không rỗng.')
    }
  } catch (err) {
    rulesFeedbackError.value = `JSON bảng thông số không hợp lệ: ${err.message}`
    return
  }
  if (!transitionalForm.value.ten.trim() || !transitionalForm.value.sourceDocument.trim()) {
    rulesFeedbackError.value = 'Vui lòng nhập đầy đủ Tên QCVN chuyển tiếp và Chứng từ pháp lý ban hành.'
    return
  }
  try {
    const res = await fetch(API.ADMIN_RULES_QCVN_TRANSITIONAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: transitionalForm.value.id,
        ten: transitionalForm.value.ten.trim(),
        apDung: transitionalForm.value.apDung.trim() || null,
        columnCode: transitionalForm.value.columnCode || null,
        flowRange: transitionalForm.value.flowRange || null,
        effectiveFrom: transitionalForm.value.effectiveFrom || null,
        effectiveTo: transitionalForm.value.effectiveTo || null,
        sourceDocument: transitionalForm.value.sourceDocument.trim(),
        thamSo: parsedParams
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể lưu bảng QCVN chuyển tiếp.'
      return
    }
    rulesFeedback.value = data.message || `Đã lưu bảng chuyển tiếp ${transitionalForm.value.id}.`
    await fetchRuleVerificationCenter()
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
  }
}

const getHistoryActionLabel = (action) => {
  if (action === 'AUTO_CRAWL_CREATE' || action === 'create') return 'Thêm mới'
  if (action === 'AUTO_CRAWL_EXPIRE' || action === 'expire') return 'Hết hiệu lực'
  return 'Cập nhật'
}

const getHistoryActionClass = (action) => {
  if (action === 'AUTO_CRAWL_CREATE' || action === 'create') return 'valid'
  if (action === 'AUTO_CRAWL_EXPIRE' || action === 'expire') return 'expired'
  return 'amended'
}

const fetchCrawlerSettings = async () => {
  try {
    const res = await fetch(API.CRAWLER_SETTINGS)
    if (res.ok) {
      const data = await res.json()
      autoCrawlEnabled.value = data.autoCrawlEnabled
      if (data.isRunning) {
        isCrawling.value = true
      }
    }
  } catch (err) {
    logger.error('Lỗi lấy thiết lập crawler:', err)
  }
}

const toggleAutoCrawl = async () => {
  try {
    const res = await fetch(API.CRAWLER_SETTINGS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: autoCrawlEnabled.value })
    })
    const data = await res.json()
    if (res.ok) {
      crawlerMessage.value = data.message
      crawlerStatusType.value = 'success'
    } else {
      autoCrawlEnabled.value = !autoCrawlEnabled.value
      crawlerMessage.value = data.error || 'Có lỗi xảy ra khi lưu thiết lập.'
      crawlerStatusType.value = 'error'
    }
  } catch (err) {
    autoCrawlEnabled.value = !autoCrawlEnabled.value
    crawlerMessage.value = 'Không thể kết nối đến máy chủ.'
    crawlerStatusType.value = 'error'
  }
}

const fetchCrawlHistory = async () => {
  try {
    const res = await fetch(API.CRAWLER_HISTORY)
    if (res.ok) {
      const data = await res.json()
      crawlHistory.value = data.history
    }
  } catch (err) {
    logger.error('Lỗi lấy lịch sử crawler:', err)
  }
}

const triggerCrawlNow = async () => {
  if (isCrawling.value) return
  if (!confirm('Bạn có chắc chắn muốn kích hoạt quét tự động từ luatmoitruong.vn ngay bây giờ?\nQuá trình này có thể mất từ vài giây đến một phút.')) return
  
  isCrawling.value = true
  crawlerMessage.value = 'Hệ thống đang kết nối sitemap-pages.xml, đối chiếu lastmod cache và kiểm tra hiệu lực văn bản...'
  crawlerStatusType.value = 'info'
  
  try {
    const res = await fetch(API.CRAWLER_RUN, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      crawlerMessage.value = data.message
      crawlerStatusType.value = 'success'
      lastCrawlStats.value = data.stats || data
      await fetchCrawlHistory()
      await fetchLaws()
    } else {
      crawlerMessage.value = data.error || 'Quá trình quét cập nhật gặp lỗi.'
      crawlerStatusType.value = 'error'
    }
  } catch (err) {
    crawlerMessage.value = 'Không thể kết nối đến máy chủ.'
    crawlerStatusType.value = 'error'
  } finally {
    isCrawling.value = false
  }
}

const switchSubpage = (subpage) => {
  currentSubpage.value = subpage
  if (subpage === 'users') fetchUsers()
  else if (subpage === 'projects') {
    fetchAdminIndustriesMeta()
    fetchAllProjects()
  } else if (subpage === 'laws') fetchLaws()
  else if (subpage === 'rules') {
    fetchThresholdRules()
    fetchRuleVerificationCenter()
  }
  else if (subpage === 'crawler') {
    fetchCrawlerSettings()
    fetchCrawlHistory()
  }
}

// Thao tác người dùng
const openAddUserModal = () => {
  isUserEdit.value = false
  userForm.value = { id: '', username: '', fullName: '', password: '', role: 'staff' }
  userModalError.value = ''
  showUserModal.value = true
}

const openEditUserModal = (user) => {
  isUserEdit.value = true
  userForm.value = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    password: '',
    role: user.role
  }
  userModalError.value = ''
  showUserModal.value = true
}

const handleUserSubmit = async () => {
  userModalError.value = ''
  const isEdit = isUserEdit.value
  const url = isEdit ? `/api/admin/users/${userForm.value.id}` : API.ADMIN_USERS
  const method = isEdit ? 'PUT' : 'POST'

  const payload = {
    username: userForm.value.username,
    fullName: userForm.value.fullName,
    role: userForm.value.role
  }
  if (userForm.value.password && userForm.value.password.trim() !== '') {
    payload.password = userForm.value.password
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok) {
      showUserModal.value = false
      fetchUsers()
      alert(data.message)
    } else {
      userModalError.value = data.error || 'Có lỗi xảy ra khi lưu tài khoản.'
    }
  } catch (err) {
    logger.error('Lỗi gửi user form:', err)
    userModalError.value = 'Không thể kết nối đến máy chủ.'
  }
}

const handleDeleteUser = async (id, username) => {
  if (props.currentUser && props.currentUser.id === id) {
    alert('Bạn không thể tự xóa tài khoản của chính mình!')
    return
  }
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản nhân viên "${username}" không?\nHành động này không thể hoàn tác!`)) {
    return
  }

  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchUsers()
      alert(data.message)
    } else {
      alert(data.error || 'Không thể xóa tài khoản!')
    }
  } catch (err) {
    logger.error('Lỗi xóa user:', err)
  }
}

// Thao tác dự án
const handleDeleteProject = async (id, name) => {
  if (!confirm(`Bạn có chắc chắn muốn XÓA dự án "${name}" của nhân viên không?\nHành động này không thể hoàn tác!`)) {
    return
  }
  try {
    const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchAllProjects()
      alert(data.message)
    } else {
      alert(data.error || 'Lỗi khi xóa dự án!')
    }
  } catch (err) {
    logger.error('Lỗi xóa dự án admin:', err)
  }
}

// Thao tác văn bản
const openAddLawModal = () => {
  isLawEdit.value = false
  lawForm.value = {
    id: '',
    type: 'luat',
    year: new Date().getFullYear(),
    sortDate: '',
    so: '',
    status: 'valid',
    ten: '',
    hieuluc: '',
    mo_ta: '',
    dieu_khoang_text: '',
    note: '',
    link: ''
  }
  lawModalError.value = ''
  showLawModal.value = true
}

const openEditLawModal = (law) => {
  isLawEdit.value = true
  lawForm.value = {
    id: law.id,
    type: law.type,
    year: law.year,
    sortDate: law.sortDate || '',
    so: law.so,
    status: law.status || 'valid',
    ten: law.ten,
    hieuluc: law.hieuluc || '',
    mo_ta: law.mo_ta || '',
    dieu_khoang_text: Array.isArray(law.dieu_khoang) ? law.dieu_khoang.map(d => typeof d === 'object' && d.tieu_de ? d.tieu_de : String(d)).join('\n') : '',
    note: law.note || '',
    link: law.link || ''
  }
  lawModalError.value = ''
  showLawModal.value = true
}

const handleLawSubmit = async () => {
  lawModalError.value = ''
  const isEdit = isLawEdit.value
  const url = isEdit ? `/api/laws/${lawForm.value.id}` : API.LAWS
  const method = isEdit ? 'PUT' : 'POST'

  const dieu_khoang = lawForm.value.dieu_khoang_text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const payload = {
    id: lawForm.value.id,
    type: lawForm.value.type,
    year: parseInt(lawForm.value.year),
    sortDate: lawForm.value.sortDate || null,
    so: lawForm.value.so,
    ten: lawForm.value.ten,
    hieuluc: lawForm.value.hieuluc || null,
    status: lawForm.value.status,
    mo_ta: lawForm.value.mo_ta || null,
    dieu_khoang,
    note: lawForm.value.note || null,
    link: lawForm.value.link || null
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok) {
      showLawModal.value = false
      fetchLaws()
      alert(data.message)
    } else {
      lawModalError.value = data.error || 'Có lỗi xảy ra khi lưu văn bản.'
    }
  } catch (err) {
    logger.error('Lỗi lưu văn bản:', err)
    lawModalError.value = 'Không thể kết nối đến máy chủ.'
  }
}

const handleDeleteLaw = async (id, so) => {
  if (!confirm(`Bạn có chắc chắn muốn XÓA quy chuẩn/văn bản "${so}" không?\nHành động này sẽ xóa vĩnh viễn dữ liệu trong database!`)) {
    return
  }
  try {
    const res = await fetch(`/api/laws/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchLaws()
      alert(data.message)
    } else {
      alert(data.error || 'Lỗi khi xóa quy chuẩn!')
    }
  } catch (err) {
    logger.error('Lỗi xóa luật:', err)
  }
}

// Hàm hỗ trợ
const getLawTypeLabel = (type) => {
  return {
    luat: 'Luật',
    nd: 'Nghị định',
    vbhn: 'VBHN',
    tt: 'Thông tư',
    qcvn: 'QCVN'
  }[type] || type.toUpperCase()
}

// Lọc danh sách văn bản
const filteredLaws = computed(() => {
  const query = lawSearchQuery.value.toLowerCase().trim()
  return laws.value.filter(l => {
    if (lawFilterType.value !== 'all' && l.type !== lawFilterType.value) return false
    if (query) {
      return (l.so && l.so.toLowerCase().includes(query)) ||
             (l.ten && l.ten.toLowerCase().includes(query)) ||
             (l.id && l.id.toLowerCase().includes(query))
    }
    return true
  })
})

// Phân trang Quản lý Quy chuẩn & Văn bản pháp lý
const {
  currentPage: lawCurrentPage,
  pageSize: lawPageSize,
  totalPages: lawTotalPages,
  paginatedItems: paginatedLaws
} = useAdminPagination(filteredLaws, { resetOn: [lawSearchQuery, lawFilterType] })

// Phân trang Quản lý Dự án
const {
  currentPage: projectCurrentPage,
  pageSize: projectPageSize,
  totalPages: projectTotalPages,
  paginatedItems: paginatedProjects
} = useAdminPagination(projects)

// Phân trang Quản lý Nhân viên
const {
  currentPage: userCurrentPage,
  pageSize: userPageSize,
  totalPages: userTotalPages,
  paginatedItems: paginatedUsers
} = useAdminPagination(users)

onMounted(() => {
  fetchUsers()
  fetchAdminIndustriesMeta()
})
</script>

<template>
  <div id="admin" class="page container fade-up">
    <!-- Tiêu đề trang -->
    <div class="page-header">
      <div>
        <h2 class="section-head">Bảng Điều khiển Quản trị Hệ thống</h2>
        <p class="section-desc">
          Quản lý phân quyền tài khoản nhân sự, giám sát danh mục dự án toàn hệ thống, cập nhật cơ sở dữ liệu văn bản pháp lý và đồng bộ tự động.
        </p>
      </div>
    </div>

    <!-- Các thẻ điều hướng ngang -->
    <div class="admin-tabs-bar">
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'users' }" @click="switchSubpage('users')">
        <i class="ti ti-users"></i>
        <span>Quản lý Nhân viên ({{ users.length }})</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'projects' }" @click="switchSubpage('projects')">
        <i class="ti ti-folders"></i>
        <span>Dự án toàn hệ thống ({{ projects.length }})</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'laws' }" @click="switchSubpage('laws')">
        <i class="ti ti-scale"></i>
        <span>Văn bản &amp; Quy chuẩn ({{ laws.length }})</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'crawler' }" @click="switchSubpage('crawler')">
        <i class="ti ti-refresh"></i>
        <span>Đồng bộ dữ liệu tự động</span>
      </button>
    </div>

    <!-- Vùng nội dung -->
    <div class="admin-content">
      <!-- Trang con: người dùng -->
      <div v-if="currentSubpage === 'users'" id="admin-users" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Danh sách tài khoản nhân sự</div>
          <button type="button" class="btn-primary btn-sm" @click="openAddUserModal">
            <i class="ti ti-user-plus"></i>
            <span>Thêm nhân viên</span>
          </button>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ và tên</th>
                <th>Vai trò</th>
                <th>Ngày khởi tạo</th>
                <th style="width:150px;text-align:right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="users.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa có tài khoản nào được tạo.</td>
              </tr>
              <tr v-for="u in paginatedUsers" :key="u.id">
                <td><strong style="color:var(--text)">{{ u.username }}</strong></td>
                <td>{{ u.full_name }}</td>
                <td>
                  <span class="chip-status" :class="u.role === 'admin' ? 'valid' : 'amended'">
                    {{ u.role === 'admin' ? 'Quản trị viên' : 'Chuyên viên' }}
                  </span>
                </td>
                <td style="color:var(--text2)">{{ new Date(u.created_at).toLocaleDateString('vi-VN') }}</td>
                <td style="text-align:right">
                  <div style="display:flex;gap:6px;justify-content:flex-end">
                    <button type="button" class="btn-action-edit" @click="openEditUserModal(u)">
                      <i class="ti ti-edit"></i>
                      <span>Sửa</span>
                    </button>
                    <button type="button" class="btn-action-delete"
                            :disabled="currentUser && currentUser.id === u.id"
                            @click="handleDeleteUser(u.id, u.username)">
                      <i class="ti ti-trash"></i>
                      <span>Xóa</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang người dùng -->
        <div v-if="users.length > 0"
             style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (userCurrentPage - 1) * userPageSize + 1 }}</strong> – <strong>{{ Math.min(userCurrentPage * userPageSize, users.length) }}</strong> / {{ users.length }} nhân viên
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="userCurrentPage === 1" @click="userCurrentPage--">‹</button>
            <button v-for="pg in userTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === userCurrentPage }" @click="userCurrentPage = pg">{{ pg }}</button>
            <button type="button" class="pagination-btn" :disabled="userCurrentPage === userTotalPages" @click="userCurrentPage++">›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="userPageSize" style="width:100px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Trang con: dự án -->
      <div v-if="currentSubpage === 'projects'" id="admin-projects" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Quản lý hồ sơ dự án toàn hệ thống</div>
        </div>
        <div style="overflow-x:auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th>Tên dự án</th>
                <th>Chuyên viên phụ trách</th>
                <th>Ngành nghề</th>
                <th>Thời gian tạo</th>
                <th style="width:110px;text-align:right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="projects.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa có dự án nào trên hệ thống.</td>
              </tr>
              <tr v-for="p in paginatedProjects" :key="p.id">
                <td><strong style="color:var(--text)">{{ p.name }}</strong></td>
                <td style="color:var(--text2)">{{ p.owner_name }} ({{ p.owner_username }})</td>
                <td>
                  <span class="chip chip-gray">
                    {{ industriesMeta[p.form_data?.nganh]?.lbl || p.form_data?.nganh || 'Chưa xác định' }}
                  </span>
                </td>
                <td style="color:var(--text2)">{{ new Date(p.created_at).toLocaleString('vi-VN') }}</td>
                <td style="text-align:right">
                  <button type="button" class="btn-action-delete" @click="handleDeleteProject(p.id, p.name)">
                    <i class="ti ti-trash"></i>
                    <span>Xóa</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang dự án -->
        <div v-if="projects.length > 0"
             style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (projectCurrentPage - 1) * projectPageSize + 1 }}</strong> – <strong>{{ Math.min(projectCurrentPage * projectPageSize, projects.length) }}</strong> / {{ projects.length }} dự án
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="projectCurrentPage === 1" @click="projectCurrentPage--">‹</button>
            <button v-for="pg in projectTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === projectCurrentPage }" @click="projectCurrentPage = pg">{{ pg }}</button>
            <button type="button" class="pagination-btn" :disabled="projectCurrentPage === projectTotalPages" @click="projectCurrentPage++">›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="projectPageSize" style="width:100px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Trang con: văn bản -->
      <div v-if="currentSubpage === 'laws'" id="admin-laws" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Quản lý cơ sở dữ liệu Văn bản pháp lý &amp; Quy chuẩn</div>
          <button type="button" class="btn-primary btn-sm" @click="openAddLawModal">
            <i class="ti ti-plus"></i>
            <span>Thêm văn bản / quy chuẩn</span>
          </button>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:240px">
            <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
            <input type="text" v-model="lawSearchQuery" placeholder="Tìm theo mã, số hiệu hoặc tên văn bản..." style="padding-left:32px" />
          </div>
          <select v-model="lawFilterType" style="width:200px">
            <option value="all">Tất cả loại văn bản</option>
            <option value="luat">Luật</option>
            <option value="nd">Nghị định</option>
            <option value="vbhn">Văn bản hợp nhất</option>
            <option value="tt">Thông tư</option>
            <option value="qcvn">Quy chuẩn (QCVN)</option>
          </select>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th style="width:150px">Mã định danh</th>
                <th style="width:110px">Loại</th>
                <th>Số hiệu &amp; Tên văn bản</th>
                <th style="width:125px">Trạng thái</th>
                <th style="width:150px;text-align:right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredLaws.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Không tìm thấy văn bản phù hợp.</td>
              </tr>
              <tr v-for="l in paginatedLaws" :key="l.id">
                <td><code style="font-size:12px;color:var(--text2);background:var(--bg);padding:2px 6px;border-radius:4px">{{ l.id }}</code></td>
                <td><span class="chip chip-gray">{{ getLawTypeLabel(l.type) }}</span></td>
                <td>
                  <div style="font-weight:600;color:var(--accent)">{{ l.so }}</div>
                  <div style="font-size:13px;color:var(--text);margin-top:2px">{{ l.ten }}</div>
                  <div style="font-size:11.5px;color:var(--text3);margin-top:2px">Năm ban hành: {{ l.year }}</div>
                </td>
                <td>
                  <span class="chip-status" :class="l.status">
                    {{ l.status === 'valid' ? 'Hiệu lực' : (l.status === 'amended' ? 'Sửa đổi' : 'Hết HL') }}
                  </span>
                </td>
                <td style="text-align:right">
                  <div style="display:flex;gap:6px;justify-content:flex-end">
                    <button type="button" class="btn-action-edit" @click="openEditLawModal(l)">
                      <i class="ti ti-edit"></i>
                      <span>Sửa</span>
                    </button>
                    <button type="button" class="btn-action-delete" @click="handleDeleteLaw(l.id, l.so)">
                      <i class="ti ti-trash"></i>
                      <span>Xóa</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang văn bản -->
        <div v-if="filteredLaws.length > 0"
             style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (lawCurrentPage - 1) * lawPageSize + 1 }}</strong> – <strong>{{ Math.min(lawCurrentPage * lawPageSize, filteredLaws.length) }}</strong> / {{ filteredLaws.length }} văn bản
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="lawCurrentPage === 1" @click="lawCurrentPage--">‹</button>
            <button v-for="pg in lawTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === lawCurrentPage }" @click="lawCurrentPage = pg">{{ pg }}</button>
            <button type="button" class="pagination-btn" :disabled="lawCurrentPage === lawTotalPages" @click="lawCurrentPage++">›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="lawPageSize" style="width:100px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Trang con: crawler -->
      <div v-if="currentSubpage === 'crawler'" id="admin-crawler" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Cấu hình đồng bộ văn bản pháp lý tự động</div>
        </div>

        <div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:20px">
          <div style="font-size:14.5px;font-weight:600;color:var(--text);margin-bottom:6px;display:flex;align-items:center;gap:8px">
            <i class="ti ti-cloud-download" style="color:var(--accent);font-size:18px"></i>
            <span>Trình đồng bộ Sitemap &amp; Bóc tách Điều khoản tự động (luatmoitruong.vn)</span>
          </div>
          <p style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">
            Hệ thống vận hành theo kiến trúc <strong>Đồng bộ 2 tầng (Human-in-the-loop Regulatory Governance)</strong>:
            Tầng 1 tự động quét <code>sitemap-pages.xml</code> định kỳ (ngày 01 hàng tháng lúc 00:00), đối chiếu dấu thời gian <code>lastmod</code> với bộ nhớ đệm PostgreSQL, tự động bóc tách điều khoản theo thứ tự tự nhiên và phát hiện văn bản hết hiệu lực. Tầng 2 ghi nhận nhật ký biến động để Quản trị viên rà soát và cập nhật có kiểm soát các thông số định lượng QCVN hoặc ngưỡng phân loại dự án.
          </p>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding-top:10px;border-top:1px solid var(--border)">
            <label style="display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--text);cursor:pointer">
              <input type="checkbox" v-model="autoCrawlEnabled" @change="toggleAutoCrawl" style="width:16px;height:16px;accent-color:var(--accent)" />
              <span>Kích hoạt tự động quét định kỳ hàng tháng (Cron Scheduler: 00:00 ngày 01)</span>
            </label>

            <button type="button" class="btn-primary" :disabled="isCrawling" @click="triggerCrawlNow">
              <i class="ti" :class="isCrawling ? 'ti-loader' : 'ti-player-play'"></i>
              <span>{{ isCrawling ? 'Đang quét & đồng bộ dữ liệu...' : 'Chạy kiểm tra & cập nhật ngay' }}</span>
            </button>
          </div>

          <div v-if="crawlerMessage" style="margin-top:14px;padding:10px 14px;border-radius:var(--radius);font-size:13px;border:1px solid"
               :style="{
                 backgroundColor: crawlerStatusType === 'success' ? 'var(--success-bg)' : crawlerStatusType === 'error' ? 'var(--red-bg)' : 'var(--info-bg)',
                 color: crawlerStatusType === 'success' ? 'var(--success)' : crawlerStatusType === 'error' ? 'var(--red)' : 'var(--info)',
                 borderColor: crawlerStatusType === 'success' ? 'var(--success-border)' : crawlerStatusType === 'error' ? 'var(--danger-border)' : 'var(--info-border)'
               }">
            {{ crawlerMessage }}
          </div>
        </div>

        <!-- Bảng thống kê phiên thu thập dữ liệu -->
        <div v-if="lastCrawlStats" class="kpi-grid fade-up" style="margin-bottom:24px">
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Tổng URL Sitemap đã quét</span>
              <div class="kpi-icon"><i class="ti ti-sitemap"></i></div>
            </div>
            <div class="kpi-value">{{ lastCrawlStats.totalSitemapUrls || 0 }}</div>
            <div class="kpi-sub">{{ lastCrawlStats.totalMainDocs || 0 }} văn bản gốc · {{ lastCrawlStats.totalSubPages || 0 }} trang điều khoản</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Đã đồng bộ (Fast Cache Skip)</span>
              <div class="kpi-icon" style="color:var(--success);background:var(--success-bg)"><i class="ti ti-database-check"></i></div>
            </div>
            <div class="kpi-value" style="color:var(--success)">{{ lastCrawlStats.skippedExistingCount || 0 }}</div>
            <div class="kpi-sub">Khớp dấu thời gian lastmod trong PostgreSQL</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Biến động pháp lý ghi nhận</span>
              <div class="kpi-icon" style="color:var(--info);background:var(--info-bg)"><i class="ti ti-file-diff"></i></div>
            </div>
            <div class="kpi-value" style="color:var(--info)">
              {{ (lastCrawlStats.createdCount || 0) + (lastCrawlStats.updatedCount || 0) + (lastCrawlStats.expiredUpdatedCount || 0) }}
            </div>
            <div class="kpi-sub">
              +{{ lastCrawlStats.createdCount || 0 }} mới · {{ lastCrawlStats.updatedCount || 0 }} sửa đổi · {{ lastCrawlStats.expiredUpdatedCount || 0 }} hết HL
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Thời gian thực thi</span>
              <div class="kpi-icon"><i class="ti ti-clock-bolt"></i></div>
            </div>
            <div class="kpi-value">{{ ((lastCrawlStats.durationMs || 0) / 1000).toFixed(2) }}s</div>
            <div class="kpi-sub">Bỏ qua {{ lastCrawlStats.skippedExpiredCount || 0 }} văn bản ngoài hệ thống đã hết HL</div>
          </div>
        </div>

        <div class="admin-section-header" style="margin-top:8px">
          <div class="admin-section-title" style="font-size:15px">Nhật ký cập nhật cơ sở dữ liệu pháp lý</div>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table" style="min-width:650px">
            <thead>
              <tr>
                <th style="width:165px">Thời gian</th>
                <th style="width:140px">Mã văn bản</th>
                <th style="width:125px">Loại thao tác</th>
                <th style="width:150px">Thực hiện bởi</th>
                <th>Chi tiết thay đổi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="crawlHistory.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa ghi nhận lịch sử cập nhật nào.</td>
              </tr>
              <tr v-for="h in crawlHistory" :key="h.id">
                <td style="color:var(--text2);font-size:12.5px">{{ new Date(h.updated_at).toLocaleString('vi-VN') }}</td>
                <td><code style="font-size:12px">{{ h.law_id }}</code></td>
                <td>
                  <span class="chip-status" :class="getHistoryActionClass(h.action)">
                    {{ getHistoryActionLabel(h.action) }}
                  </span>
                </td>
                <td style="font-weight:500">{{ h.updated_by_name || 'Hệ thống tự động' }}</td>
                <td style="color:var(--text2)">{{ h.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Trang con: kiểm duyệt quy tắc và QCVN, ẩn khỏi người dùng thông thường -->
      <div v-if="SHOW_DEV_RULES_PANEL && currentSubpage === 'rules'" id="admin-rules" class="admin-subpage">
        <div class="admin-section-header">
          <div>
            <div class="admin-section-title">Trung tâm Kiểm duyệt Quy tắc, Tác động Luật &amp; QCVN Chuyển tiếp</div>
            <div style="font-size:12.5px;color:var(--text3);margin-top:2px">
              Mọi đề xuất bóc tách tự động đều ở trạng thái <code>Chờ kiểm duyệt</code> và các bảng quy chuẩn chưa có chữ ký chứng từ pháp lý đều được khóa để bảo đảm an toàn.
            </div>
          </div>
          <button type="button" class="btn-secondary btn-sm" :disabled="rulesLoading" @click="fetchRuleVerificationCenter">
            <i class="ti ti-refresh"></i>
            <span>{{ rulesLoading ? 'Đang tải...' : 'Làm mới' }}</span>
          </button>
        </div>

        <div v-if="rulesFeedback" style="margin-bottom:12px;padding:10px 14px;border-radius:var(--radius);background:var(--success-bg);border:1px solid var(--success-border);color:var(--success);font-size:13px">
          {{ rulesFeedback }}
        </div>
        <div v-if="rulesFeedbackError" style="margin-bottom:12px;padding:10px 14px;border-radius:var(--radius);background:var(--red-bg);border:1px solid var(--danger-border);color:var(--red);font-size:13px">
          {{ rulesFeedbackError }}
        </div>

        <!-- Chỉ số tổng hợp -->
        <div class="kpi-grid" style="margin-bottom:20px">
          <div class="kpi-card">
            <div class="kpi-card-top"><span class="kpi-label">Cảnh báo tác động văn bản (Chờ xử lý)</span></div>
            <div class="kpi-value" style="color:var(--warn)">{{ pendingImpactsCount }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-top"><span class="kpi-label">Đề xuất quy tắc chờ duyệt</span></div>
            <div class="kpi-value" style="color:var(--info)">{{ pendingCandidatesCount }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-top"><span class="kpi-label">Ngành nghề đã xác minh</span></div>
            <div class="kpi-value" style="color:var(--success)">
              {{ rulesCatalog.summary?.industriesVerified || 0 }}/{{ rulesCatalog.summary?.industriesTotal || 0 }}
            </div>
          </div>
          <div class="kpi-card">
            <div class="kpi-card-top"><span class="kpi-label">Quy chuẩn QCVN đã xác minh</span></div>
            <div class="kpi-value" style="color:var(--success)">
              {{ rulesCatalog.summary?.qcvnsVerified || 0 }}/{{ rulesCatalog.summary?.qcvnsTotal || 0 }}
            </div>
          </div>
        </div>

        <!-- Khu vực quản lý ngưỡng quy tắc -->
        <div class="card" style="margin-bottom:20px">
          <div class="card-header" style="flex-wrap:wrap;gap:12px">
            <div class="card-title">
              <i class="ti ti-adjustments"></i> Quản lý Ngưỡng Phân loại (Threshold Rules)
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <input
                type="text"
                v-model="thresholdSearch"
                placeholder="🔍 Tìm theo ngành, công đoạn, căn cứ..."
                style="height:32px;font-size:12.5px;min-width:220px;padding:4px 10px;border-radius:var(--radius);border:1px solid var(--border)"
              />
              <select v-model="thresholdStatusFilter" @change="fetchThresholdRules" style="height:32px;font-size:12.5px;width:150px">
                <option value="ALL">Tất cả trạng thái</option>
                <option value="VERIFIED">Đã xác minh</option>
                <option value="NEEDS_REVIEW">Cần rà soát</option>
                <option value="DRAFT">Bản nháp</option>
              </select>
              <button type="button" class="btn-secondary btn-sm" :disabled="thresholdLoading" @click="fetchThresholdRules">
                <i class="ti ti-refresh"></i>
                <span>{{ thresholdLoading ? '...' : 'Tải lại' }}</span>
              </button>
            </div>
          </div>

          <div v-if="thresholdFeedback" style="margin:12px 16px 0;padding:8px 12px;border-radius:var(--radius);background:var(--success-bg);border:1px solid var(--success-border);color:var(--success);font-size:12.5px">
            {{ thresholdFeedback }}
          </div>
          <div v-if="thresholdFeedbackError" style="margin:12px 16px 0;padding:8px 12px;border-radius:var(--radius);background:var(--red-bg);border:1px solid var(--danger-border);color:var(--red);font-size:12.5px">
            {{ thresholdFeedbackError }}
          </div>

          <div class="table-container" style="margin-top:12px;max-height:500px;overflow-y:auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width:60px">ID</th>
                  <th>Ngành nghề</th>
                  <th>Công đoạn</th>
                  <th>Ngưỡng công suất</th>
                  <th>Nhóm / Hồ sơ</th>
                  <th>Căn cứ pháp lý</th>
                  <th>Trạng thái</th>
                  <th style="text-align:right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredThresholdRules.length === 0">
                  <td colspan="8" style="text-align:center;padding:24px;color:var(--text3)">
                    Không tìm thấy quy tắc ngưỡng nào phù hợp.
                  </td>
                </tr>
                <tr v-for="rule in filteredThresholdRules" :key="rule.id">
                  <td>#{{ rule.id }}</td>
                  <td>
                    <strong>{{ rule.industry_name }}</strong>
                    <div style="font-size:11px;color:var(--text3)"><code>{{ rule.industry_code }}</code></div>
                  </td>
                  <td>{{ rule.process_stage || '—' }}</td>
                  <td>
                    <span style="font-weight:600">{{ rule.operator || '>=' }} {{ rule.min_value }}</span>
                    <span v-if="rule.max_value !== null"> đến {{ rule.max_value }}</span>
                    <span style="font-size:11.5px;color:var(--text3)"> ({{ rule.unit }})</span>
                  </td>
                  <td>
                    <span class="chip" :class="rule.project_group === 'I' ? 'chip-danger' : (rule.project_group === 'II' ? 'chip-warning' : (rule.project_group === 'III' ? 'chip-info' : 'chip-neutral'))" style="font-size:11px">
                      Nhóm {{ rule.project_group }}
                    </span>
                    <div style="font-size:11px;color:var(--text2);margin-top:2px">
                      HS: <strong>{{ rule.legal_doc_required }}</strong> | TQ: {{ rule.tq }}
                    </div>
                  </td>
                  <td style="max-width:220px">
                    <div style="font-size:12px;line-height:1.3">{{ rule.legal_ref || 'Chưa gắn căn cứ' }}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px">
                      {{ rule.phu_luc ? `PL: ${rule.phu_luc}` : '' }}
                      {{ rule.effective_from ? ` | HL: ${rule.effective_from}` : '' }}
                    </div>
                  </td>
                  <td>
                    <span class="chip" :class="rule.verification_status === 'VERIFIED' ? 'chip-success' : (rule.verification_status === 'DRAFT' ? 'chip-neutral' : 'chip-warning')" style="font-size:11px">
                      {{ rule.verification_status === 'VERIFIED' ? 'Đã xác minh' : (rule.verification_status === 'DRAFT' ? 'Bản nháp' : 'Cần rà soát') }}
                    </span>
                    <div v-if="rule.approved_by" style="font-size:10.5px;color:var(--text3);margin-top:2px">
                      {{ rule.approved_by }}
                    </div>
                  </td>
                  <td style="text-align:right">
                    <div style="display:flex;gap:6px;justify-content:flex-end">
                      <button type="button" class="btn-secondary btn-sm" @click="openEditThresholdModal(rule)" title="Chỉnh sửa quy tắc">
                        <i class="ti ti-edit"></i>
                        <span>Sửa</span>
                      </button>
                      <button
                        v-if="rule.verification_status !== 'VERIFIED'"
                        type="button"
                        class="btn-primary btn-sm"
                        @click="openVerifyThresholdModal(rule)"
                        title="Phê duyệt đưa vào áp dụng chính thức"
                      >
                        <i class="ti ti-check"></i>
                        <span>Phê duyệt</span>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Công cụ quy tắc nâng cao có thể bật/tắt -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:8px 12px;background:var(--bg2, #f5f5f5);border-radius:var(--radius)">
          <div style="font-size:12.5px;color:var(--text2)">
            <i class="ti ti-settings"></i> <strong>Công cụ mở rộng:</strong> Rà soát cảnh báo tác động văn bản, đề xuất từ crawler và bảng QCVN chuyển tiếp.
          </div>
          <button type="button" class="btn-secondary btn-sm" @click="SHOW_ADVANCED_RULE_TOOLS = !SHOW_ADVANCED_RULE_TOOLS">
            <i class="ti" :class="SHOW_ADVANCED_RULE_TOOLS ? 'ti-chevron-up' : 'ti-chevron-down'"></i>
            <span>{{ SHOW_ADVANCED_RULE_TOOLS ? 'Thu gọn công cụ mở rộng' : 'Mở rộng công cụ trích xuất luật & QCVN' }}</span>
          </button>
        </div>

        <div v-if="SHOW_ADVANCED_RULE_TOOLS">

        <!-- Khu vực 1: tác động của văn bản đến quy tắc -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-alert-triangle"></i> 1. Cảnh báo Quy tắc chịu tác động khi văn bản thay đổi</div>
            <select v-model="impactStatusFilter" @change="fetchRuleVerificationCenter" style="width:185px;height:32px;font-size:12.5px">
              <option value="OPEN">Đang chờ xử lý</option>
              <option value="RESOLVED">Đã xử lý</option>
              <option value="IGNORED">Bỏ qua</option>
              <option value="ALL">Tất cả</option>
            </select>
          </div>
          <div v-if="lawImpacts.length === 0" style="font-size:13px;color:var(--text3);padding:12px 0">
            Không có cảnh báo tác động nào ở bộ lọc hiện tại.
          </div>
          <div v-else style="display:flex;flex-direction:column;gap:10px">
            <div v-for="imp in lawImpacts" :key="imp.id" style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
                <strong style="font-size:13px">{{ imp.law_id }} — {{ imp.law_title || imp.target_label }}</strong>
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
                  <span class="chip" :style="{ fontSize: '11px', background: getAdminSeverityMeta(imp.severity).bg, color: getAdminSeverityMeta(imp.severity).color, border: '1px solid var(--border)' }">
                    {{ getAdminSeverityMeta(imp.severity).label }}
                  </span>
                  <span class="chip chip-gray" style="font-size:11px">{{ getAdminEventActionLabel(imp.event_action) }}</span>
                  <span class="chip chip-gray" style="font-size:11px">{{ getAdminStatusLabel(imp.status) }}</span>
                </div>
              </div>
              <div style="font-size:12.5px;color:var(--text2);margin-bottom:8px">
                Ảnh hưởng: <code>{{ getAdminTargetTypeLabel(imp.target_type) }}: {{ imp.target_id }}</code> — {{ imp.impact_reason }}
              </div>
              <div v-if="imp.status === 'OPEN'" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input type="text" v-model="impactNotes[imp.id]" placeholder="Ghi chú rà soát..." style="flex:1;min-width:220px" />
                <button type="button" class="btn-primary btn-sm" @click="resolveImpactAction(imp.id, 'RESOLVED')">Đánh dấu đã xử lý</button>
                <button type="button" class="btn-secondary btn-sm" @click="resolveImpactAction(imp.id, 'IGNORED')">Bỏ qua</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Khu vực 2: đề xuất quy tắc từ crawler -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-git-pull-request"></i> 2. Đề xuất Quy tắc từ bóc tách tự động</div>
            <select v-model="candidateStatusFilter" @change="fetchRuleVerificationCenter" style="width:170px;height:32px;font-size:12.5px">
              <option value="PENDING_REVIEW">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="REJECTED">Đã từ chối</option>
              <option value="ALL">Tất cả</option>
            </select>
          </div>
          <div v-if="ruleCandidates.length === 0" style="font-size:13px;color:var(--text3);padding:12px 0">
            Chưa có đề xuất quy tắc nào ở trạng thái đã chọn.
          </div>
          <div v-else style="display:flex;flex-direction:column;gap:10px">
            <div v-for="cand in ruleCandidates" :key="cand.id" style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
                <strong style="font-size:13px">#{{ cand.id }} · {{ cand.title }}</strong>
                <span class="chip chip-gray" style="font-size:11px">
                  {{ getAdminTargetTypeLabel(cand.target_type) }}: {{ cand.target_code }} · {{ getAdminStatusLabel(cand.status) }}
                </span>
              </div>
              <details style="margin:0 0 8px 0;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;font-size:12px">
                <summary style="cursor:pointer;font-weight:600;color:var(--text2)">
                  Xem dữ liệu bóc tách chi tiết ▾
                </summary>
                <pre style="margin-top:6px;padding:6px;background:var(--bg);border-radius:4px;font-size:11px;overflow-x:auto">{{ JSON.stringify(cand.proposed_data, null, 2) }}</pre>
              </details>
              <div v-if="cand.target_type === 'QCVN' && (!Array.isArray(cand.proposed_data?.tham_so) || cand.proposed_data.tham_so.length === 0)" style="font-size:12px;color:#b45309;background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;margin-bottom:8px">
                <i class="ti ti-alert-triangle"></i> Đề xuất QCVN chưa có bảng thông số đo đạc — vui lòng cấu hình thông số trước khi phê duyệt.
              </div>
              <div v-if="['PENDING_REVIEW', 'EXTRACTED'].includes(cand.status)" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                <input type="text" v-model="candidateSourceDocs[cand.id]" placeholder="Số hiệu văn bản gốc / căn cứ pháp lý *..." style="flex:1;min-width:220px" />
                <input type="text" v-model="candidateNotes[cand.id]" placeholder="Ghi chú duyệt..." style="flex:1;min-width:180px" />
                <button v-if="cand.target_type === 'QCVN'" type="button" class="btn-secondary btn-sm" @click="openCandidateParamsModal(cand)">Cấu hình thông số</button>
                <button type="button" class="btn-primary btn-sm" @click="approveCandidateAction(cand)">Phê duyệt &amp; Công bố</button>
                <button type="button" class="btn-secondary btn-sm" @click="rejectCandidateAction(cand)">Từ chối</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Khu vực 3: danh mục ngành nghề và QCVN cần xác minh -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-certificate"></i> 3. Xác nhận pháp lý cho QCVN &amp; Ngành nghề</div>
          </div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:10px">
            Chỉ sau khi Quản trị viên nhập số hiệu chứng từ công báo và bấm xác nhận, hệ thống mới nâng kết luận thành chính thức.
          </div>
          <div style="overflow-x:auto;margin-bottom:16px">
            <table class="saas-table">
              <thead>
                <tr>
                  <th>Mã QCVN</th>
                  <th>Tên quy chuẩn</th>
                  <th>Trạng thái</th>
                  <th>Hiệu lực</th>
                  <th>Căn cứ công báo / QĐ ban hành *</th>
                  <th style="text-align:right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="q in (rulesCatalog.qcvns || [])" :key="q.id">
                  <td><code>{{ q.id }}</code></td>
                  <td style="font-size:12.5px">{{ q.ten }}</td>
                  <td><span class="chip chip-gray">{{ getAdminStatusLabel(q.verification_status) }} / {{ getAdminStatusLabel(q.publication_status) }}</span></td>
                  <td style="font-size:12px">{{ q.effective_from || '—' }} → {{ q.effective_to || 'Hiện hành' }}</td>
                  <td><input type="text" v-model="qcvnSourceDocs[q.id]" placeholder="VD: TT .../2025/TT-BTNMT" /></td>
                  <td style="text-align:right">
                    <button type="button" class="btn-primary btn-sm" @click="verifyQcvnAction(q)">Xác nhận pháp lý</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="overflow-x:auto">
            <table class="saas-table">
              <thead>
                <tr>
                  <th>Mã ngành</th>
                  <th>Tên ngành</th>
                  <th>Trạng thái</th>
                  <th>Căn cứ pháp lý ban hành *</th>
                  <th style="text-align:right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ind in (rulesCatalog.industries || []).slice(0, 50)" :key="ind.code">
                  <td><code>{{ ind.code }}</code></td>
                  <td style="font-size:12.5px">{{ ind.display_name || ind.name }}</td>
                  <td><span class="chip chip-gray">{{ getAdminStatusLabel(ind.verification_status) }} / {{ getAdminStatusLabel(ind.publication_status) }}</span></td>
                  <td><input type="text" v-model="industrySourceDocs[ind.code]" placeholder="VD: Phụ lục III NĐ 08/2022 + NĐ 05/2025" /></td>
                  <td style="text-align:right">
                    <button type="button" class="btn-primary btn-sm" @click="verifyIndustryAction(ind)">Xác nhận pháp lý</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Khu vực 4: nhập bảng QCVN chuyển tiếp từ văn bản gốc -->
        <div class="card" style="margin-bottom:0">
          <div class="card-header">
            <div class="card-title"><i class="ti ti-file-import"></i> 4. Nhập &amp; Xác nhận Bảng QCVN Chuyển tiếp (40:2011 / 14:2008) từ văn bản gốc</div>
          </div>
          <div class="form-grid-2" style="gap:10px;margin-bottom:10px">
            <div class="form-group">
              <label class="form-label">Mã QCVN chuyển tiếp *</label>
              <select v-model="transitionalForm.id">
                <option value="qcvn40_2011_a">qcvn40_2011_a (QCVN 40:2011 Cột A)</option>
                <option value="qcvn40_2011_b">qcvn40_2011_b (QCVN 40:2011 Cột B)</option>
                <option value="qcvn14_2008_a">qcvn14_2008_a (QCVN 14:2008 Cột A)</option>
                <option value="qcvn14_2008_b">qcvn14_2008_b (QCVN 14:2008 Cột B)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Số hiệu chứng từ / Thông tư ban hành *</label>
              <input type="text" v-model="transitionalForm.sourceDocument" placeholder="VD: Thông tư 47/2011/TT-BTNMT" />
            </div>
            <div class="form-group">
              <label class="form-label">Tên quy chuẩn *</label>
              <input type="text" v-model="transitionalForm.ten" placeholder="VD: QCVN 40:2011/BTNMT — Nước thải công nghiệp (Cột B)" />
            </div>
            <div class="form-group">
              <label class="form-label">Cột nguồn tiếp nhận &amp; Phạm vi áp dụng</label>
              <input type="text" v-model="transitionalForm.apDung" placeholder="VD: Cơ sở trước 01/09/2025 trong thời hạn chuyển tiếp" />
            </div>
            <div class="form-group">
              <label class="form-label">Hiệu lực từ (YYYY-MM-DD)</label>
              <input type="date" v-model="transitionalForm.effectiveFrom" />
            </div>
            <div class="form-group">
              <label class="form-label">Hết hiệu lực / Kết thúc chuyển tiếp (YYYY-MM-DD)</label>
              <input type="date" v-model="transitionalForm.effectiveTo" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Danh sách thông số &amp; giới hạn từ văn bản gốc (JSON Array) *</label>
            <textarea v-model="transitionalForm.thamSoText" rows="5" style="font-family:monospace;font-size:12px"
                      placeholder='[{"key":"pH","ten":"pH","don_vi":"-","loai":"range","min":5.5,"max":9,"required":true},{"key":"COD","ten":"COD","don_vi":"mg/L","loai":"max","gioi_han":150,"required":true}]'></textarea>
          </div>
          <button type="button" class="btn-primary btn-sm" @click="submitTransitionalQcvn">
            <i class="ti ti-device-floppy"></i>
            <span>Lưu &amp; Xác nhận Bảng Chuyển tiếp</span>
          </button>
        </div>
        </div> <!-- Kết thúc khối chỉ hiện khi SHOW_ADVANCED_RULE_TOOLS bật -->
      </div>
    </div>

    <!-- Hộp thoại thêm/sửa nhân viên -->
    <div v-if="showUserModal" class="modal-overlay" @click.self="showUserModal = false">
      <div class="modal-card fade-up" style="width:440px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0">
            {{ isUserEdit ? `Chỉnh sửa nhân viên: ${userForm.username}` : 'Thêm tài khoản nhân viên mới' }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="showUserModal = false">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <form @submit.prevent="handleUserSubmit" id="user-form">
          <div class="form-group">
            <label class="form-label">Tên đăng nhập *</label>
            <input type="text" v-model="userForm.username" placeholder="Nhập tên đăng nhập..." :disabled="isUserEdit" required />
          </div>
          <div class="form-group">
            <label class="form-label">Họ và tên *</label>
            <input type="text" v-model="userForm.fullName" placeholder="Nhập họ và tên đầy đủ..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu <span v-if="!isUserEdit">*</span></label>
            <input type="password" v-model="userForm.password" :placeholder="isUserEdit ? 'Để trống nếu giữ nguyên mật khẩu cũ' : 'Nhập mật khẩu...'" :required="!isUserEdit" />
          </div>
          <div class="form-group">
            <label class="form-label">Vai trò hệ thống *</label>
            <select v-model="userForm.role">
              <option value="staff">Chuyên viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
          </div>
          <div v-if="userModalError" style="color:var(--red);background:var(--red-bg);padding:8px 12px;border-radius:var(--radius);font-size:12.5px;margin-bottom:12px">
            {{ userModalError }}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button type="button" class="btn-secondary" @click="showUserModal = false">Hủy</button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-device-floppy"></i>
              <span>Lưu thông tin</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Hộp thoại thêm/sửa quy chuẩn -->
    <div v-if="showLawModal" class="modal-overlay" @click.self="showLawModal = false">
      <div class="modal-card fade-up" style="width:580px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0">
            {{ isLawEdit ? `Cập nhật văn bản: ${lawForm.so}` : 'Thêm văn bản / quy chuẩn mới' }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="showLawModal = false">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <form @submit.prevent="handleLawSubmit" id="law-form">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Mã văn bản (ID duy nhất) *</label>
              <input type="text" v-model="lawForm.id" placeholder="VD: luat_bvmt_2020" :disabled="isLawEdit" required />
            </div>
            <div class="form-group">
              <label class="form-label">Loại văn bản *</label>
              <select v-model="lawForm.type">
                <option value="luat">Luật</option>
                <option value="nd">Nghị định</option>
                <option value="vbhn">Văn bản hợp nhất</option>
                <option value="tt">Thông tư</option>
                <option value="qcvn">Quy chuẩn (QCVN)</option>
              </select>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Năm ban hành *</label>
              <input type="number" v-model="lawForm.year" placeholder="VD: 2026" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày sắp xếp (YYYY-MM-DD)</label>
              <input type="text" v-model="lawForm.sortDate" placeholder="VD: 2026-04-17" />
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Số hiệu *</label>
              <input type="text" v-model="lawForm.so" placeholder="VD: 49/VBHN-BNNMT" required />
            </div>
            <div class="form-group">
              <label class="form-label">Trạng thái hiệu lực</label>
              <select v-model="lawForm.status">
                <option value="valid">Còn hiệu lực</option>
                <option value="amended">Đã sửa đổi</option>
                <option value="expired">Hết hiệu lực</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tên văn bản *</label>
            <input type="text" v-model="lawForm.ten" placeholder="Nhập tên đầy đủ của văn bản..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Ngày có hiệu lực (Hiển thị)</label>
            <input type="text" v-model="lawForm.hieuluc" placeholder="VD: 17/04/2026" />
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả tóm tắt</label>
            <textarea v-model="lawForm.mo_ta" rows="3" placeholder="Nhập mô tả tóm tắt nội dung..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Các điều khoản quan trọng (Mỗi dòng một điều khoản)</label>
            <textarea v-model="lawForm.dieu_khoang_text" rows="3" placeholder="Điều 1...&#13;Điều 2..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Ghi chú áp dụng</label>
            <input type="text" v-model="lawForm.note" placeholder="Nhập lưu ý áp dụng (nếu có)..." />
          </div>
          <div class="form-group">
            <label class="form-label">Đường dẫn tài liệu gốc</label>
            <input type="text" v-model="lawForm.link" placeholder="VD: https://luatmoitruong.vn/..." />
          </div>
          <div v-if="lawModalError" style="color:var(--red);background:var(--red-bg);padding:8px 12px;border-radius:var(--radius);font-size:12.5px;margin-bottom:12px">
            {{ lawModalError }}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button type="button" class="btn-secondary" @click="showLawModal = false">Hủy</button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-device-floppy"></i>
              <span>Lưu văn bản</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Hộp thoại chỉnh sửa ngưỡng phân loại -->
    <div v-if="isEditingThresholdModalOpen" class="modal-overlay" @click.self="isEditingThresholdModalOpen = false">
      <div class="modal-card fade-up" style="width:580px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0">
            Chỉnh sửa Quy tắc Ngưỡng #{{ editingThreshold.id }} — {{ editingThreshold.industry_name }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="isEditingThresholdModalOpen = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div v-if="editingThreshold.verification_status === 'VERIFIED'" style="margin-bottom:14px;padding:8px 12px;border-radius:var(--radius);background:var(--warn-bg, #FFF9EB);border:1px solid var(--warn-border, #FFE5B4);color:var(--warn, #B76E00);font-size:12px">
          <i class="ti ti-alert-triangle"></i> Lưu ý: Quy tắc này hiện đang ở trạng thái <strong>Đã xác minh</strong>. Khi lưu chỉnh sửa, hệ thống sẽ <strong>tự động thu hồi phê duyệt</strong> và chuyển về trạng thái <strong>Cần rà soát</strong> để bảo đảm tính pháp lý.
        </div>

        <form @submit.prevent="saveThresholdEdit(false)">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Công đoạn / Quy trình</label>
              <input type="text" v-model="editingThreshold.process_stage" placeholder="VD: Luyện kim, Cán kéo... (để trống nếu chung)" />
            </div>
            <div class="form-group">
              <label class="form-label">Toán tử so sánh</label>
              <select v-model="editingThreshold.operator">
                <option value=">=">&gt;= (Lớn hơn hoặc bằng)</option>
                <option value=">">&gt; (Lớn hơn)</option>
                <option value="<=">&lt;= (Nhỏ hơn hoặc bằng)</option>
                <option value="=">= (Bằng)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Công suất tối thiểu *</label>
              <input type="number" step="any" v-model="editingThreshold.min_value" required />
            </div>
            <div class="form-group">
              <label class="form-label">Công suất tối đa</label>
              <input type="number" step="any" v-model="editingThreshold.max_value" placeholder="Để trống nếu không giới hạn trên" />
            </div>
            <div class="form-group">
              <label class="form-label">Đơn vị tính</label>
              <input type="text" v-model="editingThreshold.unit" placeholder="VD: tấn sản phẩm/năm, MW, ha..." />
            </div>
            <div class="form-group">
              <label class="form-label">Nhóm dự án *</label>
              <select v-model="editingThreshold.project_group" required>
                <option value="I">Nhóm I (Nguy cơ tác động xấu cao)</option>
                <option value="II">Nhóm II (Nguy cơ tác động xấu)</option>
                <option value="III">Nhóm III (Ít nguy cơ tác động xấu)</option>
                <option value="IV">Nhóm IV (Không có nguy cơ)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Loại hồ sơ môi trường *</label>
              <select v-model="editingThreshold.legal_doc_required" required>
                <option value="ĐTM">ĐTM (Đánh giá tác động môi trường)</option>
                <option value="GPMT">GPMT (Giấy phép môi trường)</option>
                <option value="ĐKMT">ĐKMT (Đăng ký môi trường)</option>
                <option value="MIỄN_ĐKMT">Miễn đăng ký môi trường</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Thẩm quyền thẩm định / cấp phép</label>
              <select v-model="editingThreshold.tq">
                <option value="btnmt">Bộ TN&amp;MT</option>
                <option value="ubnd_tinh">UBND cấp Tỉnh / Sở TN&amp;MT</option>
                <option value="cap_xa">UBND cấp Xã (từ 01/07/2025)</option>
                <option value="bo_khac">Bộ quản lý chuyên ngành khác</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Phụ lục áp dụng</label>
              <input type="text" v-model="editingThreshold.phu_luc" placeholder="VD: Phụ lục III, Mục 1" />
            </div>
            <div class="form-group">
              <label class="form-label">Căn cứ pháp lý</label>
              <input type="text" v-model="editingThreshold.legal_ref" placeholder="VD: NĐ 08/2022/NĐ-CP, VBHN 49/2026..." />
            </div>
            <div class="form-group">
              <label class="form-label">Hiệu lực từ</label>
              <input type="date" v-model="editingThreshold.effective_from" />
            </div>
            <div class="form-group">
              <label class="form-label">Hiệu lực đến</label>
              <input type="date" v-model="editingThreshold.effective_to" />
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button type="button" class="btn-secondary" @click="isEditingThresholdModalOpen = false">Hủy</button>
            <button type="button" class="btn-secondary" @click="saveThresholdEdit(true)">
              <i class="ti ti-file-pencil"></i>
              <span>Lưu dạng Bản nháp</span>
            </button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-device-floppy"></i>
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Hộp thoại xác minh và phê duyệt ngưỡng phân loại -->
    <div v-if="isVerifyingThresholdModalOpen" class="modal-overlay" @click.self="isVerifyingThresholdModalOpen = false">
      <div class="modal-card fade-up" style="width:480px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0">
            Phê duyệt Quy tắc #{{ verifyingThreshold.id }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="isVerifyingThresholdModalOpen = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <p style="font-size:13px;color:var(--text2);margin-bottom:14px">
          Bạn đang thực hiện phê duyệt chính thức cho quy tắc thuộc ngành: <strong>{{ verifyingThreshold.industry_name }}</strong>. Vui lòng kiểm tra và cung cấp đầy đủ thông tin căn cứ pháp lý:
        </p>

        <form @submit.prevent="confirmVerifyThreshold">
          <div class="form-group">
            <label class="form-label">Căn cứ pháp lý / Số hiệu văn bản quy chuẩn *</label>
            <input
              type="text"
              v-model="verifyingThreshold.legalRef"
              placeholder="VD: Nghị định 08/2022/NĐ-CP Phụ lục III mục 2..."
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Ngày bắt đầu có hiệu lực thi hành *</label>
            <input
              type="date"
              v-model="verifyingThreshold.effectiveFrom"
              required
            />
          </div>

          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
            <button type="button" class="btn-secondary" @click="isVerifyingThresholdModalOpen = false">Hủy</button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-check"></i>
              <span>Xác nhận Phê duyệt</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal cấu hình thông số cho đề xuất QCVN từ crawler -->
    <div v-if="editingQcvnCand" class="drawer-overlay" @click.self="editingQcvnCand = null">
      <div class="drawer-panel" style="max-width:720px;margin:auto;border-radius:12px;height:auto;max-height:88vh;overflow-y:auto;padding:20px">
        <div class="drawer-header" style="padding:0 0 12px 0;margin-bottom:12px">
          <div class="drawer-title">
            <i class="ti ti-adjustments" style="color:var(--accent)"></i>
            <span>Cấu hình thông số QCVN #{{ editingQcvnCand.id }} ({{ editingQcvnCand.target_code }})</span>
          </div>
          <button type="button" class="drawer-close-btn" @click="editingQcvnCand = null" aria-label="Đóng">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          <span style="font-size:12.5px;color:var(--text2)">Nhập tối thiểu 1 chỉ tiêu quan trắc để hệ thống cho phép phê duyệt và công bố QCVN.</span>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn-secondary btn-sm" @click="applyCommonWastewaterPreset">Nạp mẫu nước thải (pH, TSS, COD, BOD5)</button>
            <button type="button" class="btn-secondary btn-sm" @click="addCandidateParamRow">+ Thêm chỉ tiêu</button>
          </div>
        </div>

        <div v-if="candidateParamsModalError" role="alert" style="margin-bottom:10px;padding:8px 12px;border-radius:6px;background:#fee2e2;color:#991b1b;font-size:12.5px">
          {{ candidateParamsModalError }}
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table" style="width:100%">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên thông số</th>
                <th>Đơn vị</th>
                <th>Loại</th>
                <th>Ngưỡng / Khoảng</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in editingQcvnParams" :key="idx">
                <td><input type="text" v-model="row.ma" placeholder="COD" style="width:76px" /></td>
                <td><input type="text" v-model="row.ten" placeholder="Tên chỉ tiêu" style="min-width:150px" /></td>
                <td><input type="text" v-model="row.don_vi" placeholder="mg/L" style="width:72px" /></td>
                <td>
                  <select v-model="row.loai" style="width:88px">
                    <option value="max">Tối đa (≤)</option>
                    <option value="range">Khoảng</option>
                  </select>
                </td>
                <td>
                  <input v-if="row.loai !== 'range'" type="number" step="any" min="0" v-model="row.limit" placeholder="150" style="width:88px" />
                  <div v-else style="display:flex;gap:4px;align-items:center">
                    <input type="number" step="any" v-model="row.min" placeholder="Min" style="width:62px" />
                    <span>–</span>
                    <input type="number" step="any" v-model="row.max" placeholder="Max" style="width:62px" />
                  </div>
                </td>
                <td>
                  <button type="button" class="btn-secondary btn-sm" @click="removeCandidateParamRow(idx)" aria-label="Xóa dòng">×</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
          <button type="button" class="btn-secondary" @click="editingQcvnCand = null">Hủy</button>
          <button type="button" class="btn-primary" @click="confirmApproveCandidateWithParams">
            <i class="ti ti-check"></i>
            <span>Lưu thông số &amp; Phê duyệt</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
