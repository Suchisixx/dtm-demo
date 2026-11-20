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
  getAuditSourceLabel,
  formatAuditDetailsForUser,
} from '../utils/legalLabels.js'
import ModerationWorkspace from './moderation/ModerationWorkspace.vue'

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

// Trạng thái Truy vết dữ liệu (nhat_ky_kiem_toan + lich_su_cap_nhat_van_ban)
const auditLogs = ref([])
const auditLoading = ref(false)
const auditScope = ref('all')
const auditSearch = ref('')
const expandedAuditUid = ref(null)

const fetchAuditLogs = async () => {
  auditLoading.value = true
  try {
    const params = new URLSearchParams({
      scope: auditScope.value || 'all',
      limit: '150',
    })
    if (auditSearch.value.trim()) {
      params.set('search', auditSearch.value.trim())
    }
    const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
      credentials: 'include',
    })
    if (res.ok) {
      const data = await res.json()
      auditLogs.value = Array.isArray(data.logs) ? data.logs : []
    }
  } catch (err) {
    logger.error('Lỗi tải nhật ký truy vết dữ liệu:', err)
  } finally {
    auditLoading.value = false
  }
}

const toggleAuditDetail = (uid) => {
  expandedAuditUid.value = expandedAuditUid.value === uid ? null : uid
}

const getAuditCategoryBadgeClass = (category) => {
  if (category === 'legal') return 'chip-blue'
  if (category === 'projects') return 'chip-green'
  return 'chip-gray'
}

const formatAuditDateTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

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
  status: 'con_hieu_luc',
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

// === Kiểm duyệt dữ liệu pháp lý (Văn bản, Quy tắc phân loại, Danh mục QCVN) ===
const lawImpacts = ref([])
const impactStatusFilter = ref('dang_mo')
const ruleCandidates = ref([])
const candidateStatusFilter = ref('cho_duyet')
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
const SHOW_DEV_RULES_PANEL = ref(true)
const SHOW_ADVANCED_RULE_TOOLS = ref(true)

// Thống kê tổng quan 6 thẻ KPI & bộ lọc thống nhất cho Trung tâm Kiểm duyệt Dữ liệu Pháp lý
const moderationOverview = ref({
  stats: {
    totalPendingCount: 0,
    pendingLawsCount: 0,
    unverifiedRulesCount: 0,
    unverifiedQcvnsCount: 0,
    approvedTotalCount: 0,
    rejectedTotalCount: 0,
    openImpactsCount: 0,
  },
  recentActionRequired: [],
})

const activeModerationGroup = ref('quy_tac') // 'van_ban' | 'quy_tac' | 'qcvn'
const moderationStatusFilter = ref('tat_ca') // 'tat_ca' | 'cho_duyet' | 'can_xac_minh_phap_ly' | 'da_xac_minh' | 'tu_choi' | 'can_bo_sung' | 'het_hieu_luc'
const moderationSourceFilter = ref('tat_ca') // 'tat_ca' | 'crawler' | 'thu_cong' | 'he_thong'
const moderationDateFrom = ref('')
const moderationDateTo = ref('')
const moderationKeyword = ref('')

// Dữ liệu Nhóm 3.1: Kiểm duyệt văn bản pháp luật
const moderationLaws = ref([])
const selectedLawDetail = ref(null)
const isLawDetailModalOpen = ref(false)
const lawReviewDecision = ref('da_xac_minh')
const lawReviewNote = ref('')
const lawMetadataForm = ref({
  ten: '',
  so: '',
  type: 'luat',
  issuing_agency: '',
  issued_date: '',
  effective_date: '',
  status: 'con_hieu_luc',
  link: '',
  mo_ta: '',
  note: '',
})

// Dữ liệu Nhóm 3.2: Chi tiết & kiểm duyệt quy tắc phân loại + tạo đề xuất
const selectedThresholdDetail = ref(null)
const isThresholdDetailModalOpen = ref(false)
const thresholdReviewDecision = ref('da_xac_minh')
const thresholdReviewLegalRef = ref('')
const thresholdReviewEffectiveFrom = ref('')
const thresholdReviewEffectiveTo = ref('')
const thresholdReviewNote = ref('')
const isRuleProposalModalOpen = ref(false)
const ruleProposalForm = ref({
  targetId: null,
  targetCode: '',
  industry_name: '',
  process_stage: '',
  operator: '>=',
  min_value: 0,
  max_value: null,
  unit: '',
  project_group: 'Nhóm III',
  legal_doc_required: 'GPMT',
  tq: 'cap_so',
  phu_luc: '',
  legal_ref: '',
  effective_from: '',
  effective_to: '',
  reason: '',
})

// Dữ liệu Nhóm 3.3: Chi tiết & kiểm duyệt QCVN + bảng thông số môi trường
const selectedQcvnDetail = ref(null)
const isQcvnDetailModalOpen = ref(false)
const qcvnReviewDecision = ref('da_xac_minh')
const qcvnReviewSourceDoc = ref('')
const qcvnReviewEffectiveFrom = ref('')
const qcvnReviewEffectiveTo = ref('')
const qcvnReviewNote = ref('')
const qcvnEditMode = ref(false)
const qcvnEditParams = ref([])

const thresholdRules = ref([])
const thresholdLoading = ref(false)
const thresholdStatusFilter = ref('tat_ca')
const thresholdSearch = ref('')
const isEditingThresholdModalOpen = ref(false)
const editingThreshold = ref({})
const isVerifyingThresholdModalOpen = ref(false)
const verifyingThreshold = ref({})
const thresholdFeedback = ref('')
const thresholdFeedbackError = ref('')

// Ánh xạ mã trạng thái sang mã tiếng Việt chuẩn và nhãn tiếng Việt hiển thị
const toViStatus = (raw) => {
  const s = String(raw || '').trim().toLowerCase()
  if (['cho_duyet', 'pending_review', 'extracted', 'da_trich_xuat', 'pending_verification', 'cho_xac_minh'].includes(s)) return 'cho_duyet'
  if (['can_xac_minh_phap_ly', 'needs_legal_verification', 'needs_review', 'can_ra_soat'].includes(s)) return 'can_xac_minh_phap_ly'
  if (['da_xac_minh', 'verified', 'da_duyet', 'approved', 'da_ap_dung', 'applied'].includes(s)) return 'da_xac_minh'
  if (['tu_choi', 'rejected'].includes(s)) return 'tu_choi'
  if (['can_bo_sung', 'need_more_info'].includes(s)) return 'can_bo_sung'
  if (['het_hieu_luc', 'expired', 'lich_su', 'historical', 'superseded'].includes(s)) return 'het_hieu_luc'
  if (['ban_nhap', 'draft'].includes(s)) return 'ban_nhap'
  return s || 'can_xac_minh_phap_ly'
}

const getViStatusLabel = (raw) => {
  const code = toViStatus(raw)
  const map = {
    cho_duyet: 'Chờ kiểm duyệt',
    can_xac_minh_phap_ly: 'Cần xác minh pháp lý',
    da_xac_minh: 'Đã phê duyệt',
    tu_choi: 'Từ chối',
    can_bo_sung: 'Cần bổ sung thông tin',
    het_hieu_luc: 'Ngừng áp dụng / Hết hiệu lực',
    ban_nhap: 'Bản nháp',
  }
  return map[code] || 'Chờ kiểm duyệt'
}

const getViStatusChipClass = (raw) => {
  const code = toViStatus(raw)
  if (code === 'da_xac_minh') return 'chip-success'
  if (code === 'tu_choi' || code === 'het_hieu_luc') return 'chip-danger'
  if (code === 'cho_duyet' || code === 'can_xac_minh_phap_ly' || code === 'can_bo_sung') return 'chip-warning'
  return 'chip-neutral'
}

const getAuthorityViLabel = (tq) => {
  const map = {
    cap_bo: 'Bộ NN&MT / Bộ TN&MT',
    btnmt: 'Bộ NN&MT / Bộ TN&MT',
    cap_so: 'UBND cấp Tỉnh / Sở NN&MT',
    ubnd_tinh: 'UBND cấp Tỉnh / Sở NN&MT',
    cap_xa: 'UBND cấp Xã',
    bql_kcn: 'Ban Quản lý KCN',
    bo_khac: 'Bộ chuyên ngành khác',
  }
  return map[tq] || tq || 'Chưa xác định'
}

const getQcvnDomainViLabel = (sourceType) => {
  const map = {
    nuoc_thai_cn: 'Nước thải công nghiệp',
    nuoc_thai_sh: 'Nước thải sinh hoạt',
    nuoc_mat: 'Chất lượng nước mặt',
    nuoc_ngam: 'Chất lượng nước dưới đất',
    khong_khi: 'Chất lượng không khí xung quanh',
    khi_thai: 'Khí thải công nghiệp',
    dat: 'Chất lượng đất',
  }
  return map[sourceType] || sourceType || 'Quy chuẩn môi trường'
}

const fetchModerationOverview = async () => {
  try {
    const res = await fetch(API.ADMIN_MODERATION_OVERVIEW)
    if (res.ok) {
      moderationOverview.value = await res.json()
    }
  } catch (err) {
    logger.warn('Không tải được tổng quan kiểm duyệt:', err)
  }
}

const fetchModerationLaws = async () => {
  try {
    const res = await fetch(API.ADMIN_MODERATION_LAWS)
    if (res.ok) {
      const data = await res.json()
      moderationLaws.value = data.laws || []
    }
  } catch (err) {
    logger.warn('Không tải được danh sách văn bản kiểm duyệt:', err)
  }
}

const fetchThresholdRules = async () => {
  thresholdLoading.value = true
  thresholdFeedbackError.value = ''
  try {
    const statusParam = thresholdStatusFilter.value && thresholdStatusFilter.value !== 'tat_ca' && thresholdStatusFilter.value !== 'ALL'
      ? thresholdStatusFilter.value
      : 'tat_ca'
    const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}?status=${encodeURIComponent(statusParam)}`)
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

const filteredModerationLaws = computed(() => {
  let list = moderationLaws.value || []
  const st = moderationStatusFilter.value
  if (st && st !== 'tat_ca') {
    list = list.filter(l => toViStatus(l.verification_status) === st)
  }
  const src = moderationSourceFilter.value
  if (src && src !== 'tat_ca') {
    list = list.filter(l => l.detection_source === src)
  }
  if (moderationDateFrom.value) {
    list = list.filter(l => !l.issued_date || String(l.issued_date).slice(0, 10) >= moderationDateFrom.value)
  }
  if (moderationDateTo.value) {
    list = list.filter(l => !l.issued_date || String(l.issued_date).slice(0, 10) <= moderationDateTo.value)
  }
  const kw = moderationKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(l =>
      (l.ten && l.ten.toLowerCase().includes(kw)) ||
      (l.so && l.so.toLowerCase().includes(kw)) ||
      (l.id && l.id.toLowerCase().includes(kw)) ||
      (l.issuing_agency && l.issuing_agency.toLowerCase().includes(kw))
    )
  }
  return list
})

const filteredThresholdRules = computed(() => {
  let list = thresholdRules.value || []
  const st = moderationStatusFilter.value !== 'tat_ca' ? moderationStatusFilter.value : thresholdStatusFilter.value
  if (st && st !== 'tat_ca' && st !== 'ALL') {
    list = list.filter(r => toViStatus(r.verification_status_vi || r.verification_status) === toViStatus(st))
  }
  if (moderationDateFrom.value) {
    list = list.filter(r => !r.effective_from || String(r.effective_from).slice(0, 10) >= moderationDateFrom.value)
  }
  if (moderationDateTo.value) {
    list = list.filter(r => !r.effective_from || String(r.effective_from).slice(0, 10) <= moderationDateTo.value)
  }
  const q = (moderationKeyword.value.trim() || thresholdSearch.value.trim()).toLowerCase()
  if (q) {
    list = list.filter(r => 
      (r.industry_name && r.industry_name.toLowerCase().includes(q)) ||
      (r.industry_code && r.industry_code.toLowerCase().includes(q)) ||
      (r.process_stage && r.process_stage.toLowerCase().includes(q)) ||
      (r.legal_ref && r.legal_ref.toLowerCase().includes(q)) ||
      String(r.id).includes(q)
    )
  }
  return list
})

const filteredModerationQcvns = computed(() => {
  let list = rulesCatalog.value?.qcvns || []
  const st = moderationStatusFilter.value
  if (st && st !== 'tat_ca') {
    list = list.filter(q => toViStatus(q.verification_status_vi || q.verification_status) === st)
  }
  if (moderationDateFrom.value) {
    list = list.filter(q => !q.effective_from || String(q.effective_from).slice(0, 10) >= moderationDateFrom.value)
  }
  if (moderationDateTo.value) {
    list = list.filter(q => !q.effective_from || String(q.effective_from).slice(0, 10) <= moderationDateTo.value)
  }
  const kw = moderationKeyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(q =>
      (q.id && q.id.toLowerCase().includes(kw)) ||
      (q.ten && q.ten.toLowerCase().includes(kw)) ||
      (q.standard_code && q.standard_code.toLowerCase().includes(kw)) ||
      (q.source_document && q.source_document.toLowerCase().includes(kw))
    )
  }
  return list
})

const resetModerationFilters = () => {
  moderationStatusFilter.value = 'tat_ca'
  moderationSourceFilter.value = 'tat_ca'
  moderationDateFrom.value = ''
  moderationDateTo.value = ''
  moderationKeyword.value = ''
  thresholdStatusFilter.value = 'tat_ca'
  thresholdSearch.value = ''
}

// === Thao tác Nhóm 3.1: Chi tiết & Kiểm duyệt Văn bản pháp luật ===
const openLawModerationModal = async (lawItem) => {
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_MODERATION_LAWS}/${encodeURIComponent(lawItem.id)}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      rulesFeedbackError.value = err.error || 'Không thể tải chi tiết văn bản!'
      return
    }
    const detail = await res.json()
    selectedLawDetail.value = detail
    const l = detail.law || lawItem
    lawReviewDecision.value = l.verification_status === 'tu_choi' ? 'tu_choi' : (l.verification_status === 'can_bo_sung' ? 'can_bo_sung' : 'da_xac_minh')
    lawReviewNote.value = l.review_note || ''
    lawMetadataForm.value = {
      ten: l.ten || '',
      so: l.so || '',
      type: l.type || 'luat',
      issuing_agency: l.issuing_agency || '',
      issued_date: l.issued_date || '',
      effective_date: l.effective_date || '',
      status: l.status || 'con_hieu_luc',
      link: l.link || '',
      mo_ta: l.mo_ta || '',
      note: l.note || '',
    }
    isLawDetailModalOpen.value = true
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối khi tải chi tiết văn bản.'
  }
}

const submitLawReviewAction = async (decisionOverride = null) => {
  if (!selectedLawDetail.value?.law) return
  const decision = decisionOverride || lawReviewDecision.value
  const note = (lawReviewNote.value || '').trim()
  if ((decision === 'tu_choi' || decision === 'can_bo_sung') && !note) {
    alert('Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin văn bản!')
    return
  }
  const decisionLabel = getViStatusLabel(decision)
  if (!confirm(`Xác nhận thực hiện quyết định "${decisionLabel}" đối với văn bản "${selectedLawDetail.value.law.so}"?`)) {
    return
  }
  rulesLoading.value = true
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_MODERATION_LAWS}/${encodeURIComponent(selectedLawDetail.value.law.id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        reviewNote: note || null,
        metadataPatch: lawMetadataForm.value,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể lưu kết quả kiểm duyệt văn bản!'
      return
    }
    rulesFeedback.value = data.message || 'Đã lưu kết quả kiểm duyệt văn bản!'
    isLawDetailModalOpen.value = false
    await Promise.all([fetchModerationLaws(), fetchModerationOverview(), fetchLaws()])
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi mạng khi kiểm duyệt văn bản.'
  } finally {
    rulesLoading.value = false
  }
}

// === Thao tác Nhóm 3.2: Chi tiết, Kiểm duyệt & Tạo đề xuất Quy tắc phân loại ===
const openThresholdDetailModal = async (ruleItem) => {
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}/${ruleItem.id}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      rulesFeedbackError.value = err.error || 'Không thể tải chi tiết quy tắc!'
      return
    }
    const detail = await res.json()
    selectedThresholdDetail.value = detail
    const r = detail.rule || ruleItem
    thresholdReviewDecision.value = 'da_xac_minh'
    thresholdReviewLegalRef.value = r.legal_ref || ''
    thresholdReviewEffectiveFrom.value = r.effective_from || new Date().toISOString().slice(0, 10)
    thresholdReviewEffectiveTo.value = r.effective_to || ''
    thresholdReviewNote.value = ''
    isThresholdDetailModalOpen.value = true
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối khi tải chi tiết quy tắc.'
  }
}

const submitThresholdReviewAction = async (decisionOverride = null) => {
  if (!selectedThresholdDetail.value?.rule) return
  const decision = decisionOverride || thresholdReviewDecision.value
  const note = (thresholdReviewNote.value || '').trim()
  const legalRef = (thresholdReviewLegalRef.value || '').trim()
  const effFrom = thresholdReviewEffectiveFrom.value

  if ((decision === 'tu_choi' || decision === 'can_bo_sung') && !note) {
    alert('Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin cho quy tắc phân loại!')
    return
  }
  if (decision === 'da_xac_minh' && (!legalRef || !effFrom)) {
    alert('Bắt buộc nhập đầy đủ Căn cứ pháp lý và Ngày bắt đầu hiệu lực trước khi phê duyệt quy tắc!')
    return
  }
  const decisionLabel = getViStatusLabel(decision)
  if (!confirm(`Xác nhận thực hiện quyết định "${decisionLabel}" đối với Quy tắc #${selectedThresholdDetail.value.rule.id} (${selectedThresholdDetail.value.rule.industry_name})?`)) {
    return
  }

  rulesLoading.value = true
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}/${selectedThresholdDetail.value.rule.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        legalRef,
        effectiveFrom: effFrom || null,
        effectiveTo: thresholdReviewEffectiveTo.value || null,
        reviewNote: note || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể lưu kết quả kiểm duyệt quy tắc!'
      return
    }
    rulesFeedback.value = data.message || 'Đã lưu kết quả kiểm duyệt quy tắc!'
    isThresholdDetailModalOpen.value = false
    await Promise.all([fetchThresholdRules(), fetchRuleVerificationCenter(), fetchModerationOverview()])
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối.'
  } finally {
    rulesLoading.value = false
  }
}

const openCreateRuleProposalModal = (rule) => {
  ruleProposalForm.value = {
    targetId: rule.id,
    targetCode: rule.industry_code,
    industry_name: rule.industry_name,
    process_stage: rule.process_stage || '',
    operator: rule.operator || '>=',
    min_value: rule.min_value ?? 0,
    max_value: rule.max_value ?? null,
    unit: rule.unit || '',
    project_group: rule.project_group || 'Nhóm III',
    legal_doc_required: rule.legal_doc_required || 'GPMT',
    tq: rule.tq || 'cap_so',
    phu_luc: rule.phu_luc || '',
    legal_ref: rule.legal_ref || '',
    effective_from: rule.effective_from || new Date().toISOString().slice(0, 10),
    effective_to: rule.effective_to || '',
    reason: '',
  }
  isRuleProposalModalOpen.value = true
}

const submitRuleProposalAction = async () => {
  if (!ruleProposalForm.value.reason?.trim()) {
    alert('Vui lòng nhập lý do và căn cứ tạo đề xuất thay đổi quy tắc!')
    return
  }
  rulesLoading.value = true
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const f = ruleProposalForm.value
    const res = await fetch(API.ADMIN_MODERATION_PROPOSALS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'nguong_phan_loai',
        targetId: f.targetId,
        targetCode: f.targetCode,
        title: `Đề xuất thay đổi Quy tắc #${f.targetId} — ${f.industry_name}`,
        reason: f.reason.trim(),
        sourceExcerpt: f.legal_ref,
        proposedData: {
          thresholdId: f.targetId,
          industry_code: f.targetCode,
          process_stage: f.process_stage,
          operator: f.operator,
          min_value: Number(f.min_value),
          max_value: f.max_value === '' || f.max_value === null ? null : Number(f.max_value),
          unit: f.unit,
          project_group: f.project_group,
          legal_doc_required: f.legal_doc_required,
          tq: f.tq,
          phu_luc: f.phu_luc,
          legal_ref: f.legal_ref,
          sourceDocument: f.legal_ref,
          effective_from: f.effective_from || null,
          effective_to: f.effective_to || null,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể tạo đề xuất thay đổi quy tắc!'
      return
    }
    rulesFeedback.value = data.message || 'Đã tạo đề xuất thay đổi quy tắc thành công!'
    isRuleProposalModalOpen.value = false
    await Promise.all([fetchRuleVerificationCenter(), fetchModerationOverview()])
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi mạng khi tạo đề xuất.'
  } finally {
    rulesLoading.value = false
  }
}

// === Thao tác Nhóm 3.3: Chi tiết, Bảng thông số & Kiểm duyệt QCVN ===
const openQcvnDetailModal = async (qcvnItem) => {
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_QCVN_VERIFY}/${encodeURIComponent(qcvnItem.id)}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      rulesFeedbackError.value = err.error || 'Không thể tải chi tiết QCVN!'
      return
    }
    const detail = await res.json()
    selectedQcvnDetail.value = detail
    const q = detail.qcvn || qcvnItem
    qcvnReviewDecision.value = 'da_xac_minh'
    qcvnReviewSourceDoc.value = q.source_document || qcvnSourceDocs.value[q.id] || q.ap_dung || ''
    qcvnReviewEffectiveFrom.value = q.effective_from || ''
    qcvnReviewEffectiveTo.value = q.effective_to || ''
    qcvnReviewNote.value = ''
    qcvnEditMode.value = false
    qcvnEditParams.value = (Array.isArray(q.tham_so) ? q.tham_so : []).map(p => ({ ...p }))
    isQcvnDetailModalOpen.value = true
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi kết nối khi tải chi tiết QCVN.'
  }
}

const addQcvnEditParamRow = () => {
  qcvnEditParams.value.push({
    key: '',
    ten: '',
    don_vi: 'mg/L',
    loai: 'max',
    gioi_han: 50,
    min: null,
    max: null,
    averagingPeriod: '24_gio',
  })
}

const removeQcvnEditParamRow = (idx) => {
  qcvnEditParams.value.splice(idx, 1)
}

const submitQcvnReviewAction = async (decisionOverride = null) => {
  if (!selectedQcvnDetail.value?.qcvn) return
  const q = selectedQcvnDetail.value.qcvn
  const decision = decisionOverride || qcvnReviewDecision.value
  const note = (qcvnReviewNote.value || '').trim()
  const sourceDoc = (qcvnReviewSourceDoc.value || '').trim()

  if ((decision === 'tu_choi' || decision === 'can_bo_sung') && !note) {
    alert('Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin cho QCVN!')
    return
  }
  if (decision === 'da_xac_minh' && !sourceDoc) {
    alert('Bắt buộc nhập Căn cứ pháp lý ban hành (Thông tư / Quyết định) trước khi phê duyệt QCVN!')
    return
  }
  const decisionLabel = getViStatusLabel(decision)
  if (!confirm(`Xác nhận thực hiện quyết định "${decisionLabel}" đối với quy chuẩn "${q.id} — ${q.ten}"?`)) {
    return
  }

  rulesLoading.value = true
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_QCVN_VERIFY}/${encodeURIComponent(q.id)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision,
        sourceDocument: sourceDoc || null,
        effectiveFrom: qcvnReviewEffectiveFrom.value || null,
        effectiveTo: qcvnReviewEffectiveTo.value || null,
        reviewNote: note || null,
        ...(qcvnEditMode.value ? { patch: { tham_so: qcvnEditParams.value } } : {}),
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể lưu kết quả kiểm duyệt QCVN!'
      return
    }
    rulesFeedback.value = data.message || `Đã cập nhật kiểm duyệt ${q.id}!`
    isQcvnDetailModalOpen.value = false
    await Promise.all([fetchRuleVerificationCenter(), fetchModerationOverview()])
  } catch (err) {
    rulesFeedbackError.value = err.message || 'Lỗi mạng khi kiểm duyệt QCVN.'
  } finally {
    rulesLoading.value = false
  }
}

const createQcvnProposalFromModal = async () => {
  if (!selectedQcvnDetail.value?.qcvn) return
  const q = selectedQcvnDetail.value.qcvn
  const note = (qcvnReviewNote.value || '').trim()
  if (!note) {
    alert('Vui lòng nhập lý do tạo đề xuất thay đổi thông số QCVN!')
    return
  }
  rulesLoading.value = true
  try {
    const res = await fetch(API.ADMIN_MODERATION_PROPOSALS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'quy_chuan_qcvn',
        targetCode: q.id,
        title: `Đề xuất cập nhật bảng thông số ${q.id} — ${q.ten}`,
        reason: note,
        sourceExcerpt: qcvnReviewSourceDoc.value || q.source_document,
        proposedData: {
          id: q.id,
          ten: q.ten,
          ap_dung: q.ap_dung,
          sourceDocument: qcvnReviewSourceDoc.value || q.source_document,
          effective_from: qcvnReviewEffectiveFrom.value || q.effective_from,
          effective_to: qcvnReviewEffectiveTo.value || q.effective_to,
          tham_so: qcvnEditParams.value,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể tạo đề xuất QCVN!'
      return
    }
    rulesFeedback.value = data.message || 'Đã tạo đề xuất thay đổi QCVN!'
    isQcvnDetailModalOpen.value = false
    await Promise.all([fetchRuleVerificationCenter(), fetchModerationOverview()])
  } finally {
    rulesLoading.value = false
  }
}

const jumpToModerationItem = async (item) => {
  if (!item) return
  if (item.loai_du_lieu === 'van_ban') {
    activeModerationGroup.value = 'van_ban'
    await openLawModerationModal({ id: item.ma })
  } else if (item.loai_du_lieu === 'qcvn') {
    activeModerationGroup.value = 'qcvn'
    if (rulesCatalog.value.qcvns?.some(q => q.id === item.ma)) {
      await openQcvnDetailModal({ id: item.ma })
    }
  } else {
    activeModerationGroup.value = 'quy_tac'
    const numId = Number(item.ma)
    if (Number.isInteger(numId) && numId > 0 && thresholdRules.value.some(t => t.id === numId)) {
      await openThresholdDetailModal({ id: numId })
    }
  }
}

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

const pendingImpactsCount = computed(() => lawImpacts.value.filter(i => ['OPEN', 'dang_mo'].includes(i.status)).length)
const pendingCandidatesCount = computed(() => ruleCandidates.value.filter(c => ['PENDING_REVIEW', 'EXTRACTED', 'cho_duyet', 'da_trich_xuat', 'can_bo_sung'].includes(c.status)).length)

const fetchRuleVerificationCenter = async () => {
  rulesLoading.value = true
  rulesFeedbackError.value = ''
  try {
    const [impRes, candRes, catRes] = await Promise.all([
      fetch(`${API.ADMIN_RULES_IMPACTS}?status=${encodeURIComponent(impactStatusFilter.value || 'tat_ca')}`),
      fetch(`${API.ADMIN_RULES_CANDIDATES}?status=${encodeURIComponent(candidateStatusFilter.value || 'tat_ca')}`),
      fetch(API.ADMIN_RULES_CATALOG),
      fetchModerationOverview(),
      fetchModerationLaws(),
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

const rejectCandidateAction = async (cand, targetStatus = 'tu_choi') => {
  const note = (candidateNotes.value[cand.id] || '').trim()
  if (!note) {
    alert('Bắt buộc phải nhập lý do khi Từ chối hoặc Yêu cầu bổ sung thông tin cho đề xuất!')
    return
  }
  const actionLabel = targetStatus === 'can_bo_sung' ? 'Yêu cầu bổ sung thông tin' : 'Từ chối'
  if (!confirm(`Xác nhận "${actionLabel}" đối với đề xuất #${cand.id} (${cand.title})?`)) {
    return
  }
  rulesFeedback.value = ''
  rulesFeedbackError.value = ''
  try {
    const res = await fetch(`${API.ADMIN_RULES_CANDIDATES}/${cand.id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewNote: note,
        status: targetStatus,
        requireReason: true,
      })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      rulesFeedbackError.value = data.error || 'Không thể cập nhật đề xuất quy tắc.'
      return
    }
    rulesFeedback.value = data.message || `Đã cập nhật đề xuất #${cand.id}.`
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
  crawlerMessage.value = 'Hệ thống đang kết nối danh mục nguồn văn bản pháp lý, đối chiếu thời gian cập nhật và kiểm tra hiệu lực văn bản...'
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
    fetchModerationOverview()
    fetchModerationLaws()
    fetchThresholdRules()
    fetchRuleVerificationCenter()
  }
  else if (subpage === 'crawler') {
    fetchCrawlerSettings()
    fetchCrawlHistory()
  }
  else if (subpage === 'audit') {
    fetchAuditLogs()
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
    status: 'con_hieu_luc',
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
    status: law.status || 'con_hieu_luc',
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
  if (!confirm(`Bạn có chắc chắn muốn XÓA quy chuẩn/văn bản "${so}" không?\nHành động này sẽ xóa vĩnh viễn dữ liệu trong cơ sở dữ liệu!`)) {
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
  fetchModerationOverview()
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

    <!-- Các thẻ điều hướng ngang gọn, vừa khít không thanh kéo -->
    <div class="admin-tabs-bar">
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'users' }" @click="switchSubpage('users')">
        <i class="ti ti-users"></i>
        <span>Quản lý Nhân viên</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'projects' }" @click="switchSubpage('projects')">
        <i class="ti ti-folders"></i>
        <span>Dự án toàn hệ thống</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'laws' }" @click="switchSubpage('laws')">
        <i class="ti ti-scale"></i>
        <span>Văn bản &amp; Quy chuẩn</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'rules' }" @click="switchSubpage('rules')">
        <i class="ti ti-shield-check"></i>
        <span>Kiểm duyệt dữ liệu pháp lý</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'crawler' }" @click="switchSubpage('crawler')">
        <i class="ti ti-refresh"></i>
        <span>Đồng bộ dữ liệu pháp lý</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'audit' }" @click="switchSubpage('audit')">
        <i class="ti ti-history"></i>
        <span>Truy vết dữ liệu</span>
      </button>
    </div>

    <!-- Vùng nội dung -->
    <div class="admin-content">
      <!-- Trang con: người dùng -->
      <div v-if="currentSubpage === 'users'" id="admin-users" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title" style="display:flex;align-items:center;gap:8px">
            <span>Danh sách tài khoản nhân sự</span>
            <span class="chip chip-gray" style="font-size:12px">{{ users.length }}</span>
          </div>
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
          <div class="admin-section-title" style="display:flex;align-items:center;gap:8px">
            <span>Quản lý hồ sơ dự án toàn hệ thống</span>
            <span class="chip chip-gray" style="font-size:12px">{{ projects.length }}</span>
          </div>
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
          <div class="admin-section-title" style="display:flex;align-items:center;gap:8px">
            <span>Quản lý cơ sở dữ liệu Văn bản pháp lý &amp; Quy chuẩn</span>
            <span class="chip chip-gray" style="font-size:12px">{{ laws.length }}</span>
          </div>
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
                    {{ (l.status === 'con_hieu_luc' || l.status === 'valid') ? 'Hiệu lực' : ((l.status === 'da_sua_doi' || l.status === 'amended') ? 'Sửa đổi' : 'Hết HL') }}
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
          <div class="admin-section-title">Đồng bộ cơ sở dữ liệu văn bản pháp lý</div>
        </div>

        <div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:20px">
          <div style="font-size:14.5px;font-weight:600;color:var(--text);margin-bottom:6px;display:flex;align-items:center;gap:8px">
            <i class="ti ti-cloud-download" style="color:var(--accent);font-size:18px"></i>
            <span>Trình kiểm tra &amp; đồng bộ văn bản pháp lý (luatmoitruong.vn)</span>
          </div>
          <p style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">
            Hệ thống vận hành theo cơ chế <strong>Đồng bộ 2 tầng theo yêu cầu (Chủ động kích hoạt &amp; Quản trị viên kiểm duyệt)</strong>:
            Tầng 1 chạy khi Quản trị viên kích hoạt kiểm tra, quét danh mục văn bản từ nguồn pháp lý và đối chiếu thời gian cập nhật với bộ nhớ đệm PostgreSQL (bỏ qua nhanh văn bản không đổi), đồng thời bóc tách điều khoản và phát hiện văn bản hết hiệu lực.
            Tầng 2 ghi nhận nhật ký biến động, cảnh báo tác động và đề xuất quy tắc chờ duyệt để Quản trị viên rà soát — không tự động ghi đè ngưỡng phân loại hay QCVN đang hiệu lực.
          </p>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding-top:10px;border-top:1px solid var(--border)">
            <div style="display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
              <i class="ti ti-hand-click" style="color:var(--accent);font-size:16px"></i>
              <span><strong>Chế độ vận hành:</strong> Kích hoạt thủ công theo yêu cầu (không chạy lịch tự động ngầm)</span>
            </div>

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
              <span class="kpi-label">Tổng liên kết danh mục đã quét</span>
              <div class="kpi-icon"><i class="ti ti-sitemap"></i></div>
            </div>
            <div class="kpi-value">{{ lastCrawlStats.totalSitemapUrls || 0 }}</div>
            <div class="kpi-sub">{{ lastCrawlStats.totalMainDocs || 0 }} văn bản gốc · {{ lastCrawlStats.totalSubPages || 0 }} trang điều khoản</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Đã đồng bộ (Bỏ qua không đổi)</span>
              <div class="kpi-icon" style="color:var(--success);background:var(--success-bg)"><i class="ti ti-database-check"></i></div>
            </div>
            <div class="kpi-value" style="color:var(--success)">{{ lastCrawlStats.skippedExistingCount || 0 }}</div>
            <div class="kpi-sub">Khớp dấu thời gian cập nhật trong PostgreSQL</div>
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

      <!-- Trang con: Kiểm duyệt dữ liệu pháp lý (Redesign tối giản, phân cấp trực quan) -->
      <div v-if="currentSubpage === 'rules'" class="admin-subpage">
        <ModerationWorkspace
          @stats-updated="(n) => { if (moderationOverview.stats) moderationOverview.stats.totalPendingCount = n }"
        />

        <!-- Công cụ quản trị mở rộng thu gọn (mặc định đóng để giữ giao diện kiểm duyệt tối giản) -->
        <details style="margin-top:20px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:12px 18px">
          <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--text2);user-select:none">
            Công cụ chuyên sâu: Nhập bảng QCVN chuyển tiếp (40:2011 / 14:2008) &amp; Cảnh báo tác động văn bản
          </summary>
          <div style="margin-top:14px;display:flex;flex-direction:column;gap:16px">
            <div v-if="lawImpacts.length > 0">
              <div style="font-size:13px;font-weight:600;margin-bottom:8px">Cảnh báo tác động văn bản ({{ pendingImpactsCount }} chờ xử lý)</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div v-for="imp in lawImpacts" :key="imp.id" style="padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);font-size:12.5px">
                  <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">
                    <strong>{{ imp.law_id }} — {{ imp.law_title || imp.target_label }}</strong>
                    <span class="chip chip-gray" style="font-size:11px">{{ getAdminStatusLabel(imp.status) }}</span>
                  </div>
                  <div style="color:var(--text2);margin:4px 0">{{ imp.impact_reason }}</div>
                  <div v-if="['OPEN', 'dang_mo'].includes(imp.status)" style="display:flex;gap:8px;margin-top:6px">
                    <input type="text" v-model="impactNotes[imp.id]" placeholder="Ghi chú xử lý..." style="flex:1;height:32px;font-size:12px" />
                    <button type="button" class="btn-primary btn-sm" @click="resolveImpactAction(imp.id, 'da_xu_ly')">Đã xử lý</button>
                    <button type="button" class="btn-secondary btn-sm" @click="resolveImpactAction(imp.id, 'bo_qua')">Bỏ qua</button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div style="font-size:13px;font-weight:600;margin-bottom:8px">Nhập &amp; Xác nhận Bảng QCVN Chuyển tiếp từ văn bản gốc</div>
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
                  <label class="form-label">Phạm vi áp dụng</label>
                  <input type="text" v-model="transitionalForm.apDung" placeholder="VD: Cơ sở trước 01/09/2025 trong thời hạn chuyển tiếp" />
                </div>
                <div class="form-group">
                  <label class="form-label">Hiệu lực từ</label>
                  <input type="date" v-model="transitionalForm.effectiveFrom" />
                </div>
                <div class="form-group">
                  <label class="form-label">Hết hiệu lực / Kết thúc chuyển tiếp</label>
                  <input type="date" v-model="transitionalForm.effectiveTo" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Danh sách thông số &amp; giới hạn từ văn bản gốc (định dạng JSON) *</label>
                <textarea v-model="transitionalForm.thamSoText" rows="3" style="font-family:monospace;font-size:12px"
                          placeholder='[{"key":"pH","ten":"pH","don_vi":"-","loai":"range","min":5.5,"max":9,"required":true}]'></textarea>
              </div>
              <button type="button" class="btn-primary btn-sm" @click="submitTransitionalQcvn">
                <i class="ti ti-device-floppy"></i>
                <span>Lưu &amp; Xác nhận Bảng Chuyển tiếp</span>
              </button>
            </div>
          </div>
        </details>
      </div>

      <!-- Trang con: Truy vết dữ liệu (nhat_ky_kiem_toan & lich_su_cap_nhat_van_ban) -->
      <div v-if="currentSubpage === 'audit'" id="admin-audit" class="admin-subpage">
        <div class="admin-section-header">
          <div>
            <div class="admin-section-title">Truy vết thao tác &amp; Sửa đổi văn bản pháp lý</div>
            <div style="font-size:12.5px;color:var(--text3);margin-top:2px">
              Tổng hợp từ bảng <code>nhat_ky_kiem_toan</code> và <code>lich_su_cap_nhat_van_ban</code>: sửa luật gì, nội dung sửa đổi, thời gian và người thực hiện.
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <select v-model="auditScope" @change="fetchAuditLogs" style="width:auto;min-width:190px">
              <option value="all">Tất cả thao tác</option>
              <option value="legal">Văn bản pháp lý &amp; Quy tắc</option>
              <option value="projects">Hồ sơ dự án &amp; Quan trắc</option>
              <option value="system">Tài khoản &amp; Hệ thống</option>
            </select>
            <input
              type="text"
              v-model="auditSearch"
              @keyup.enter="fetchAuditLogs"
              placeholder="Tìm số hiệu luật, người sửa, nội dung..."
              style="width:240px"
            />
            <button type="button" class="btn-secondary btn-sm" @click="fetchAuditLogs" :disabled="auditLoading">
              <i class="ti ti-refresh"></i>
              <span>{{ auditLoading ? 'Đang tải...' : 'Làm mới' }}</span>
            </button>
          </div>
        </div>

        <div class="card" style="padding:0;overflow:hidden;margin-top:10px">
          <div class="table-wrap" style="border:none;border-radius:0;max-height:560px;overflow-y:auto">
            <table class="saas-table">
              <thead>
                <tr>
                  <th style="width:165px">Thời gian</th>
                  <th style="width:170px">Người thực hiện</th>
                  <th style="width:190px">Thao tác</th>
                  <th style="width:180px">Luật / Đối tượng</th>
                  <th>Thông tin sửa đổi / Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="auditLoading && auditLogs.length === 0">
                  <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Đang tải nhật ký truy vết...</td>
                </tr>
                <tr v-else-if="auditLogs.length === 0">
                  <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa có bản ghi truy vết nào khớp điều kiện lọc.</td>
                </tr>
                <template v-for="item in auditLogs" :key="item.uid">
                  <tr>
                    <td style="font-size:12px;color:var(--text2);white-space:nowrap">
                      {{ formatAuditDateTime(item.created_at) }}
                    </td>
                    <td>
                      <div style="font-weight:600;color:var(--text);font-size:13px">{{ item.actor_name }}</div>
                      <div v-if="item.actor_username" style="font-size:11.5px;color:var(--text3)">@{{ item.actor_username }}</div>
                    </td>
                    <td>
                      <span class="chip" :class="getAuditCategoryBadgeClass(item.category)">
                        {{ item.action_label }}
                      </span>
                    </td>
                    <td style="font-weight:500;color:var(--text)">
                      {{ item.target_label }}
                    </td>
                    <td>
                      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
                        <span style="font-size:12.5px;color:var(--text2);line-height:1.45">{{ item.summary }}</span>
                        <button
                          v-if="item.details && Object.keys(item.details).length > 0"
                          type="button"
                          class="btn-secondary btn-sm"
                          style="padding:2px 8px;font-size:11.5px;flex-shrink:0"
                          @click="toggleAuditDetail(item.uid)"
                        >
                          {{ expandedAuditUid === item.uid ? 'Ẩn' : 'Chi tiết' }}
                        </button>
                      </div>
                      <div
                        v-if="expandedAuditUid === item.uid"
                        style="margin-top:8px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px;font-size:12px;color:var(--text2);display:flex;flex-direction:column;gap:5px"
                      >
                        <div>
                          <strong>Nguồn ghi nhận:</strong> {{ getAuditSourceLabel(item.source) }}
                          <span v-if="item.ip_address"> · <strong>Địa chỉ IP:</strong> {{ item.ip_address }}</span>
                        </div>
                        <div
                          v-for="(row, rIdx) in formatAuditDetailsForUser(item.details)"
                          :key="rIdx"
                          style="line-height:1.45"
                        >
                          <strong>{{ row.label }}:</strong> {{ row.value }}
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
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
                <option value="con_hieu_luc">Còn hiệu lực</option>
                <option value="da_sua_doi">Đã sửa đổi</option>
                <option value="het_hieu_luc">Hết hiệu lực</option>
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

        <div v-if="toViStatus(editingThreshold.verification_status) === 'da_xac_minh'" style="margin-bottom:14px;padding:8px 12px;border-radius:var(--radius);background:var(--warn-bg, #FFF9EB);border:1px solid var(--warn-border, #FFE5B4);color:var(--warn, #B76E00);font-size:12px">
          <i class="ti ti-alert-triangle"></i> Lưu ý: Quy tắc này hiện đang ở trạng thái <strong>Đã phê duyệt (da_xac_minh)</strong>. Khi lưu chỉnh sửa trực tiếp, hệ thống sẽ <strong>tự động thu hồi phê duyệt</strong> và chuyển về trạng thái <strong>Cần xác minh pháp lý (can_xac_minh_phap_ly)</strong>. Nếu muốn giữ nguyên quy tắc đang chạy, hãy dùng nút <strong>Đề xuất sửa</strong>.
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

    <!-- ======================================================================= -->
    <!-- MODAL 1: CHI TIẾT & KIỂM DUYỆT VĂN BẢN PHÁP LUẬT (MỤC 3.1)              -->
    <!-- ======================================================================= -->
    <div v-if="isLawDetailModalOpen && selectedLawDetail?.law" class="modal-overlay" @click.self="isLawDetailModalOpen = false">
      <div class="modal-card fade-up" style="width:780px;max-width:95vw;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0">
              Kiểm duyệt Văn bản Pháp luật: {{ selectedLawDetail.law.so }}
            </h3>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">
              Mã định danh: <code>{{ selectedLawDetail.law.id }}</code> · Nguồn: {{ selectedLawDetail.law.detection_source_label }} · Trạng thái hiện tại:
              <span class="chip" :class="getViStatusChipClass(selectedLawDetail.law.verification_status)" style="font-size:11px">
                {{ getViStatusLabel(selectedLawDetail.law.verification_status) }} ({{ toViStatus(selectedLawDetail.law.verification_status) }})
              </span>
            </div>
          </div>
          <button type="button" class="drawer-close-btn" @click="isLawDetailModalOpen = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div style="font-size:12.5px;color:var(--text2)">
            <strong>Đường dẫn văn bản gốc:</strong>
            <a v-if="lawMetadataForm.link" :href="lawMetadataForm.link" target="_blank" rel="noopener noreferrer" style="color:var(--accent);margin-left:6px;text-decoration:underline">
              {{ lawMetadataForm.link }}
            </a>
            <span v-else style="color:var(--text3);margin-left:6px">Chưa cập nhật đường dẫn</span>
          </div>
          <a v-if="lawMetadataForm.link" :href="lawMetadataForm.link" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none">
            <i class="ti ti-external-link"></i>
            <span>Mở nguồn văn bản gốc</span>
          </a>
        </div>

        <!-- Thông tin metadata có thể chỉnh sửa trước khi duyệt -->
        <div class="form-grid-2" style="gap:10px;margin-bottom:12px">
          <div class="form-group">
            <label class="form-label">Số hiệu văn bản *</label>
            <input type="text" v-model="lawMetadataForm.so" />
          </div>
          <div class="form-group">
            <label class="form-label">Cơ quan ban hành *</label>
            <input type="text" v-model="lawMetadataForm.issuing_agency" placeholder="VD: Quốc hội, Chính phủ, Bộ NN&MT..." />
          </div>
          <div class="form-group">
            <label class="form-label">Ngày ban hành</label>
            <input type="date" v-model="lawMetadataForm.issued_date" />
          </div>
          <div class="form-group">
            <label class="form-label">Ngày bắt đầu có hiệu lực</label>
            <input type="date" v-model="lawMetadataForm.effective_date" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Tên đầy đủ của văn bản *</label>
          <input type="text" v-model="lawMetadataForm.ten" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label class="form-label">Tóm tắt nội dung / Phạm vi điều chỉnh</label>
          <textarea v-model="lawMetadataForm.mo_ta" rows="2"></textarea>
        </div>

        <!-- Nội dung điều khoản đã thu thập -->
        <details style="margin-bottom:12px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
          <summary style="cursor:pointer;font-weight:600;font-size:13px;color:var(--text)">
            Nội dung điều khoản đã thu thập ({{ (selectedLawDetail.law.dieu_khoang || []).length }} điều khoản) ▾
          </summary>
          <div style="max-height:200px;overflow-y:auto;margin-top:8px;font-size:12px;display:flex;flex-direction:column;gap:8px">
            <div v-if="(selectedLawDetail.law.dieu_khoang || []).length === 0" style="color:var(--text3)">
              Chưa có điều khoản chi tiết.
            </div>
            <div v-for="(clause, cIdx) in (selectedLawDetail.law.dieu_khoang || []).slice(0, 30)" :key="cIdx" style="padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px">
              <strong style="color:var(--accent)">{{ clause.tieu_de || `Điều khoản #${cIdx + 1}` }}</strong>
              <div style="color:var(--text2);margin-top:4px;line-height:1.45">{{ clause.noi_dung || clause }}</div>
            </div>
          </div>
        </details>

        <!-- Quy tắc liên quan & lịch sử kiểm duyệt -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
            <div style="font-size:12.5px;font-weight:600;margin-bottom:6px">Quy tắc &amp; Cảnh báo liên quan ({{ (selectedLawDetail.relatedThresholds || []).length }} quy tắc)</div>
            <div style="max-height:130px;overflow-y:auto;font-size:11.5px;color:var(--text2)">
              <div v-if="(selectedLawDetail.relatedThresholds || []).length === 0" style="color:var(--text3)">Không có quy tắc gắn trực tiếp.</div>
              <div v-for="rt in (selectedLawDetail.relatedThresholds || []).slice(0, 10)" :key="rt.id" style="padding:4px 0;border-bottom:1px dashed var(--border)">
                <strong>#{{ rt.id }}</strong> · {{ rt.industry_name }} ({{ rt.project_group }} - {{ rt.legal_doc_required }})
              </div>
            </div>
          </div>
          <div style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
            <div style="font-size:12.5px;font-weight:600;margin-bottom:6px">Lịch sử phát hiện &amp; Kiểm duyệt ({{ (selectedLawDetail.history || []).length }})</div>
            <div style="max-height:130px;overflow-y:auto;font-size:11.5px;color:var(--text2)">
              <div v-if="(selectedLawDetail.history || []).length === 0" style="color:var(--text3)">Chưa có lịch sử ghi nhận.</div>
              <div v-for="h in (selectedLawDetail.history || [])" :key="h.id" style="padding:4px 0;border-bottom:1px dashed var(--border)">
                <div><strong>{{ formatAuditDateTime(h.updated_at) }}</strong> · {{ h.actor_name || h.actor_username || 'Hệ thống' }}</div>
                <div style="color:var(--text3)">{{ h.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Khu vực ra quyết định kiểm duyệt -->
        <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Lý do kiểm duyệt / Ghi chú yêu cầu bổ sung (Bắt buộc khi Từ chối hoặc Cần bổ sung thông tin) *</label>
            <textarea v-model="lawReviewNote" rows="2" placeholder="Nhập căn cứ phê duyệt, lý do từ chối hoặc nội dung yêu cầu bổ sung thông tin..."></textarea>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <button type="button" class="btn-secondary" @click="isLawDetailModalOpen = false">Đóng</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn-secondary" @click="submitLawReviewAction('het_hieu_luc')">
                <span>Ngừng áp dụng (het_hieu_luc)</span>
              </button>
              <button type="button" class="btn-secondary" @click="submitLawReviewAction('can_bo_sung')">
                <span>Yêu cầu bổ sung (can_bo_sung)</span>
              </button>
              <button type="button" class="btn-action-delete" @click="submitLawReviewAction('tu_choi')">
                <span>Từ chối (tu_choi)</span>
              </button>
              <button type="button" class="btn-primary" @click="submitLawReviewAction('da_xac_minh')">
                <i class="ti ti-check"></i>
                <span>Phê duyệt văn bản (da_xac_minh)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- MODAL 2: CHI TIẾT, LỊCH SỬ PHIÊN BẢN & KIỂM DUYỆT QUY TẮC (MỤC 3.2)      -->
    <!-- ======================================================================= -->
    <div v-if="isThresholdDetailModalOpen && selectedThresholdDetail?.rule" class="modal-overlay" @click.self="isThresholdDetailModalOpen = false">
      <div class="modal-card fade-up" style="width:760px;max-width:95vw;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0">
              Chi tiết &amp; Kiểm duyệt Quy tắc Phân loại #{{ selectedThresholdDetail.rule.id }}
            </h3>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">
              Ngành nghề: <strong>{{ selectedThresholdDetail.rule.industry_name }}</strong> (<code>{{ selectedThresholdDetail.rule.industry_code }}</code>) · Trạng thái:
              <span class="chip" :class="getViStatusChipClass(selectedThresholdDetail.rule.verification_status)" style="font-size:11px">
                {{ getViStatusLabel(selectedThresholdDetail.rule.verification_status) }} ({{ toViStatus(selectedThresholdDetail.rule.verification_status) }})
              </span>
            </div>
          </div>
          <button type="button" class="drawer-close-btn" @click="isThresholdDetailModalOpen = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <!-- Bảng tóm tắt thông số quy tắc hiện tại -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px;font-size:12.5px">
          <div><strong>Nhóm dự án:</strong> {{ selectedThresholdDetail.rule.project_group }}</div>
          <div><strong>Hồ sơ yêu cầu:</strong> {{ selectedThresholdDetail.rule.legal_doc_required }}</div>
          <div><strong>Thẩm quyền:</strong> {{ getAuthorityViLabel(selectedThresholdDetail.rule.tq) }}</div>
          <div><strong>Công đoạn:</strong> {{ selectedThresholdDetail.rule.process_stage || 'Áp dụng chung' }}</div>
          <div><strong>Ngưỡng công suất:</strong> {{ selectedThresholdDetail.rule.operator || '>=' }} {{ selectedThresholdDetail.rule.min_value }} <span v-if="selectedThresholdDetail.rule.max_value !== null">đến {{ selectedThresholdDetail.rule.max_value }}</span> ({{ selectedThresholdDetail.rule.unit || '—' }})</div>
          <div><strong>Phụ lục pháp lý:</strong> {{ selectedThresholdDetail.rule.phu_luc || '—' }}</div>
          <div><strong>Văn bản liên quan:</strong> <code>{{ selectedThresholdDetail.rule.law_id || 'vbhn_49_2026' }}</code></div>
          <div><strong>Phiên bản quy tắc:</strong> <code>{{ selectedThresholdDetail.rule.rule_version || '2026.2' }}</code></div>
          <div><strong>Người duyệt gần nhất:</strong> {{ selectedThresholdDetail.rule.approved_by || 'Chưa có' }}</div>
        </div>

        <!-- Lịch sử phiên bản quy tắc (phien_ban_quy_tac) -->
        <div style="margin-bottom:14px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
          <div style="font-size:13px;font-weight:600;margin-bottom:6px">
            <i class="ti ti-history"></i> Lịch sử phiên bản &amp; Thay đổi quy tắc ({{ (selectedThresholdDetail.versions || []).length }} bản ghi trong <code>phien_ban_quy_tac</code>)
          </div>
          <div v-if="(selectedThresholdDetail.versions || []).length === 0" style="font-size:12px;color:var(--text3)">
            Quy tắc gốc từ danh mục khởi tạo, chưa có bản ghi thay đổi phiên bản.
          </div>
          <div v-else style="max-height:150px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;font-size:12px">
            <div v-for="ver in selectedThresholdDetail.versions" :key="ver.id" style="padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px">
              <div style="display:flex;justify-content:space-between">
                <strong>Phiên bản: <code>{{ ver.version }}</code></strong>
                <span style="color:var(--text3)">{{ formatAuditDateTime(ver.changed_at) }} · {{ ver.actor_name || ver.expression?.nguoi_thuc_hien || 'Quản trị viên' }}</span>
              </div>
              <div style="color:var(--text2);margin-top:2px">{{ ver.change_reason }}</div>
            </div>
          </div>
        </div>

        <!-- Form kiểm duyệt quy tắc phân loại -->
        <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
          <div class="form-grid-2" style="gap:10px;margin-bottom:10px">
            <div class="form-group">
              <label class="form-label">Căn cứ pháp lý (Điều, khoản, phụ lục) — Bắt buộc khi Phê duyệt *</label>
              <input type="text" v-model="thresholdReviewLegalRef" placeholder="VD: Phụ lục III Mục 2 Nghị định 08/2022/NĐ-CP (VBHN 49/2026)" />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày bắt đầu có hiệu lực — Bắt buộc khi Phê duyệt *</label>
              <input type="date" v-model="thresholdReviewEffectiveFrom" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Lý do kiểm duyệt / Yêu cầu bổ sung thông tin (Bắt buộc khi Từ chối hoặc Cần bổ sung) *</label>
            <textarea v-model="thresholdReviewNote" rows="2" placeholder="Nhập lý do từ chối, yêu cầu bổ sung căn cứ pháp lý hoặc ghi chú phê duyệt..."></textarea>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <button type="button" class="btn-secondary" @click="isThresholdDetailModalOpen = false">Đóng</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button type="button" class="btn-secondary" @click="submitThresholdReviewAction('can_bo_sung')">
                <span>Yêu cầu bổ sung (can_bo_sung)</span>
              </button>
              <button type="button" class="btn-action-delete" @click="submitThresholdReviewAction('tu_choi')">
                <span>Từ chối (tu_choi)</span>
              </button>
              <button type="button" class="btn-primary" @click="submitThresholdReviewAction('da_xac_minh')">
                <i class="ti ti-check"></i>
                <span>Phê duyệt quy tắc (da_xac_minh)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- MODAL 3: TẠO ĐỀ XUẤT THAY ĐỔI QUY TẮC PHÂN LOẠI (GIỮ NGUYÊN QUY TẮC CŨ)   -->
    <!-- ======================================================================= -->
    <div v-if="isRuleProposalModalOpen" class="modal-overlay" @click.self="isRuleProposalModalOpen = false">
      <div class="modal-card fade-up" style="width:620px;max-width:95vw;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0">
            Tạo Đề xuất Thay đổi Quy tắc #{{ ruleProposalForm.targetId }} — {{ ruleProposalForm.industry_name }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="isRuleProposalModalOpen = false">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <div style="margin-bottom:12px;padding:8px 12px;background:var(--info-bg, #eff6ff);border:1px solid var(--info-border, #bfdbfe);border-radius:var(--radius);font-size:12px;color:var(--text2)">
          Đề xuất này sẽ được lưu vào bảng <code>de_xuat_quy_tac</code> với trạng thái <code>cho_duyet</code> (Chờ kiểm duyệt). Quy tắc đang áp dụng sẽ <strong>không bị thay đổi</strong> cho đến khi đề xuất được phê duyệt chính thức.
        </div>
        <form @submit.prevent="submitRuleProposalAction">
          <div class="form-grid-2" style="gap:10px">
            <div class="form-group">
              <label class="form-label">Công đoạn</label>
              <input type="text" v-model="ruleProposalForm.process_stage" />
            </div>
            <div class="form-group">
              <label class="form-label">Toán tử so sánh</label>
              <select v-model="ruleProposalForm.operator">
                <option value=">=">&gt;= (Lớn hơn hoặc bằng)</option>
                <option value=">">&gt; (Lớn hơn)</option>
                <option value="<=">&lt;= (Nhỏ hơn hoặc bằng)</option>
                <option value="<">&lt; (Nhỏ hơn)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ngưỡng tối thiểu *</label>
              <input type="number" step="any" v-model="ruleProposalForm.min_value" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngưỡng tối đa</label>
              <input type="number" step="any" v-model="ruleProposalForm.max_value" />
            </div>
            <div class="form-group">
              <label class="form-label">Đơn vị tính</label>
              <input type="text" v-model="ruleProposalForm.unit" />
            </div>
            <div class="form-group">
              <label class="form-label">Nhóm dự án đề xuất *</label>
              <select v-model="ruleProposalForm.project_group">
                <option value="Nhóm I">Nhóm I</option>
                <option value="Nhóm II">Nhóm II</option>
                <option value="Nhóm III">Nhóm III</option>
                <option value="Nhóm IV">Nhóm IV</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Loại hồ sơ môi trường *</label>
              <select v-model="ruleProposalForm.legal_doc_required">
                <option value="DTM">ĐTM (Đánh giá tác động môi trường)</option>
                <option value="GPMT">GPMT (Giấy phép môi trường)</option>
                <option value="DKMT">ĐKMT (Đăng ký môi trường)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Thẩm quyền giải quyết *</label>
              <select v-model="ruleProposalForm.tq">
                <option value="cap_bo">Bộ NN&amp;MT / Bộ TN&amp;MT</option>
                <option value="cap_so">UBND cấp Tỉnh / Sở NN&amp;MT</option>
                <option value="cap_xa">UBND cấp Xã</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Căn cứ pháp lý đề xuất *</label>
              <input type="text" v-model="ruleProposalForm.legal_ref" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày bắt đầu hiệu lực *</label>
              <input type="date" v-model="ruleProposalForm.effective_from" required />
            </div>
          </div>
          <div class="form-group" style="margin-top:8px">
            <label class="form-label">Lý do đề xuất thay đổi quy tắc *</label>
            <textarea v-model="ruleProposalForm.reason" rows="2" placeholder="Nhập lý do và trích dẫn điều khoản thay đổi..." required></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
            <button type="button" class="btn-secondary" @click="isRuleProposalModalOpen = false">Hủy</button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-git-pull-request"></i>
              <span>Gửi đề xuất chờ kiểm duyệt (cho_duyet)</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ======================================================================= -->
    <!-- MODAL 4: CHI TIẾT QCVN, BẢNG THÔNG SỐ MÔI TRƯỜNG & KIỂM DUYỆT (MỤC 3.3)  -->
    <!-- ======================================================================= -->
    <div v-if="isQcvnDetailModalOpen && selectedQcvnDetail?.qcvn" class="modal-overlay" @click.self="isQcvnDetailModalOpen = false">
      <div class="modal-card fade-up" style="width:860px;max-width:96vw;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <div>
            <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0">
              Chi tiết Quy chuẩn &amp; Bảng Thông số Môi trường: {{ selectedQcvnDetail.qcvn.id }}
            </h3>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">
              {{ selectedQcvnDetail.qcvn.ten }} · Lĩnh vực: {{ getQcvnDomainViLabel(selectedQcvnDetail.qcvn.source_type) }} · Trạng thái:
              <span class="chip" :class="getViStatusChipClass(selectedQcvnDetail.qcvn.verification_status)" style="font-size:11px">
                {{ getViStatusLabel(selectedQcvnDetail.qcvn.verification_status) }} ({{ toViStatus(selectedQcvnDetail.qcvn.verification_status) }})
              </span>
            </div>
          </div>
          <button type="button" class="drawer-close-btn" @click="isQcvnDetailModalOpen = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <!-- Bảng danh sách đầy đủ thông số môi trường của QCVN -->
        <div style="margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <div style="font-size:13.5px;font-weight:700;color:var(--text)">
              <i class="ti ti-list-check"></i> Danh sách Thông số Môi trường áp dụng ({{ qcvnEditParams.length }} thông số)
            </div>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn-secondary btn-sm" @click="qcvnEditMode = !qcvnEditMode">
                <i class="ti ti-edit"></i>
                <span>{{ qcvnEditMode ? 'Chuyển sang chế độ Chỉ xem' : 'Bật chỉnh sửa bảng thông số' }}</span>
              </button>
              <button v-if="qcvnEditMode" type="button" class="btn-secondary btn-sm" @click="addQcvnEditParamRow">
                + Thêm thông số
              </button>
            </div>
          </div>

          <div style="max-height:310px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
            <table class="saas-table" style="width:100%">
              <thead>
                <tr>
                  <th style="width:50px">STT</th>
                  <th style="width:110px">Mã thông số</th>
                  <th>Tên thông số môi trường</th>
                  <th style="width:165px">Giá trị giới hạn cho phép</th>
                  <th style="width:95px">Đơn vị tính</th>
                  <th style="width:130px">Chu kỳ / Điều kiện</th>
                  <th v-if="qcvnEditMode" style="width:50px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="qcvnEditParams.length === 0">
                  <td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">Chưa có thông số môi trường nào trong bảng.</td>
                </tr>
                <tr v-for="(param, pIdx) in qcvnEditParams" :key="pIdx">
                  <td>{{ pIdx + 1 }}</td>
                  <td>
                    <input v-if="qcvnEditMode" type="text" v-model="param.key" style="width:95px;height:28px;font-size:12px" />
                    <code v-else>{{ param.key || param.ma || `ts_${pIdx + 1}` }}</code>
                  </td>
                  <td>
                    <input v-if="qcvnEditMode" type="text" v-model="param.ten" style="width:100%;height:28px;font-size:12px" />
                    <strong v-else>{{ param.ten || param.chi_tieu || param.nhom }}</strong>
                  </td>
                  <td>
                    <template v-if="qcvnEditMode">
                      <div v-if="param.loai === 'range' || (param.min !== undefined && param.max !== undefined)" style="display:flex;gap:4px;align-items:center">
                        <input type="number" step="any" v-model.number="param.min" style="width:65px;height:28px;font-size:12px" placeholder="Min" />
                        <span>–</span>
                        <input type="number" step="any" v-model.number="param.max" style="width:65px;height:28px;font-size:12px" placeholder="Max" />
                      </div>
                      <input v-else type="number" step="any" v-model.number="param.gioi_han" style="width:110px;height:28px;font-size:12px" />
                    </template>
                    <template v-else>
                      <strong style="color:var(--accent)">
                        <span v-if="param.loai === 'range' || (param.min !== undefined && param.min !== null && param.max !== undefined && param.max !== null)">
                          {{ param.min }} – {{ param.max }}
                        </span>
                        <span v-else-if="param.gioi_han !== undefined && param.gioi_han !== null">
                          ≤ {{ param.gioi_han }}
                        </span>
                        <span v-else-if="param.max !== undefined && param.max !== null">
                          ≤ {{ param.max }}
                        </span>
                        <span v-else>—</span>
                      </strong>
                    </template>
                  </td>
                  <td>
                    <input v-if="qcvnEditMode" type="text" v-model="param.don_vi" style="width:80px;height:28px;font-size:12px" />
                    <span v-else>{{ param.don_vi || 'mg/L' }}</span>
                  </td>
                  <td style="font-size:11.5px;color:var(--text2)">
                    {{ param.averagingPeriod || (param.required ? 'Thông số bắt buộc' : 'Theo quy chuẩn') }}
                  </td>
                  <td v-if="qcvnEditMode">
                    <button type="button" class="btn-secondary btn-sm" @click="removeQcvnEditParamRow(pIdx)">×</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Form kiểm duyệt QCVN -->
        <div style="padding:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
          <div class="form-grid-2" style="gap:10px;margin-bottom:10px">
            <div class="form-group">
              <label class="form-label">Căn cứ pháp lý ban hành (Thông tư / Công báo) — Bắt buộc khi Phê duyệt *</label>
              <input type="text" v-model="qcvnReviewSourceDoc" placeholder="VD: Thông tư 05/2025/TT-BTNMT ban hành QCVN 40:2025/BTNMT" />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày bắt đầu có hiệu lực</label>
              <input type="date" v-model="qcvnReviewEffectiveFrom" />
            </div>
          </div>
          <div class="form-group" style="margin-bottom:10px">
            <label class="form-label">Lý do kiểm duyệt / Ghi chú (Bắt buộc khi Từ chối, Cần bổ sung hoặc Tạo đề xuất) *</label>
            <textarea v-model="qcvnReviewNote" rows="2" placeholder="Nhập căn cứ phê duyệt, lý do từ chối hoặc nội dung đề xuất chỉnh sửa thông số..."></textarea>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <button type="button" class="btn-secondary" @click="isQcvnDetailModalOpen = false">Đóng</button>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button v-if="qcvnEditMode" type="button" class="btn-secondary" @click="createQcvnProposalFromModal">
                <i class="ti ti-git-pull-request"></i>
                <span>Tạo đề xuất thay đổi (cho_duyet)</span>
              </button>
              <button type="button" class="btn-secondary" @click="submitQcvnReviewAction('can_xac_minh_phap_ly')">
                <span>Đánh dấu cần xác minh (can_xac_minh_phap_ly)</span>
              </button>
              <button type="button" class="btn-secondary" @click="submitQcvnReviewAction('can_bo_sung')">
                <span>Yêu cầu bổ sung (can_bo_sung)</span>
              </button>
              <button type="button" class="btn-action-delete" @click="submitQcvnReviewAction('tu_choi')">
                <span>Từ chối (tu_choi)</span>
              </button>
              <button type="button" class="btn-primary" @click="submitQcvnReviewAction('da_xac_minh')">
                <i class="ti ti-check"></i>
                <span>Phê duyệt QCVN (da_xac_minh)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
