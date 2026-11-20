<script setup>
import { ref, computed, onMounted } from 'vue'
import { API } from '../../utils/constants.js'
import { useAdminPagination } from '../../composables/useAdminPagination.js'
import ModerationDetailDrawer from './ModerationDetailDrawer.vue'

const emit = defineEmits(['stats-updated'])

// Trạng thái điều hướng chính: Tab 1 (can_xu_ly) | Tab 2 (lich_su)
const activeMode = ref('can_xu_ly')
// Nhóm dữ liệu trong Hàng đợi: tat_ca | van_ban | quy_tac | qcvn
const activeQueueGroup = ref('tat_ca')
// Chế độ phụ trong Lịch sử: ban_ghi (đã duyệt / từ chối) | phien_ban (lịch sử phiên bản quy tắc)
const historySubView = ref('ban_ghi')

// Dữ liệu thực từ PostgreSQL
const overview = ref({
  lastUpdatedAt: null,
  stats: {
    totalPendingCount: 0,
    pending: { total: 0, van_ban: 0, quy_tac: 0, qcvn: 0 },
    approved: { total: 0, van_ban: 0, quy_tac: 0, qcvn: 0 },
    rejected: { total: 0, van_ban: 0, quy_tac: 0, qcvn: 0 },
  },
  queueItems: [],
})
const lawsList = ref([])
const thresholdsList = ref([])
const candidatesList = ref([])
const qcvnsList = ref([])
const historyItems = ref([])
const versionHistory = ref([])

const loading = ref(false)
const loadError = ref('')
const feedbackSuccess = ref('')
const feedbackError = ref('')

// Bộ lọc 1 hàng gọn + Bộ lọc nâng cao (Mục 6)
const keyword = ref('')
const statusFilter = ref('tat_ca')
const sourceFilter = ref('tat_ca')
const showAdvancedFilters = ref(false)
const advDateFrom = ref('')
const advDateTo = ref('')
const advIssuedDate = ref('')
const advEffectiveDate = ref('')
const advProposer = ref('')
const advReviewer = ref('')

// Sắp xếp cột bảng
const sortKey = ref('thoi_gian')
const sortDir = ref('desc')

// Drawer chi tiết kiểm duyệt 2 cột
const drawerOpen = ref(false)
const drawerRecordType = ref('') // 'law' | 'threshold' | 'qcvn' | 'candidate'
const drawerDetail = ref(null)
const drawerLoading = ref(false)

// Modal tạo đề xuất điều chỉnh quy tắc phân loại
const proposalModalOpen = ref(false)
const proposalForm = ref({
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
  legal_ref: '',
  effective_from: '',
  effective_to: '',
  reason: '',
})
const proposalSubmitting = ref(false)

const toViStatus = (raw) => {
  const s = String(raw || '').trim().toLowerCase()
  if (['cho_duyet', 'pending_review', 'extracted', 'da_trich_xuat', 'pending_verification', 'cho_xac_minh'].includes(s)) return 'cho_duyet'
  if (['can_xac_minh_phap_ly', 'needs_legal_verification', 'needs_review', 'can_ra_soat'].includes(s)) return 'can_xac_minh_phap_ly'
  if (['da_xac_minh', 'verified', 'da_duyet', 'approved', 'da_ap_dung', 'applied'].includes(s)) return 'da_xac_minh'
  if (['tu_choi', 'rejected'].includes(s)) return 'tu_choi'
  if (['can_bo_sung', 'need_more_info'].includes(s)) return 'can_bo_sung'
  if (['het_hieu_luc', 'expired', 'lich_su', 'historical', 'superseded'].includes(s)) return 'het_hieu_luc'
  return s || 'can_xac_minh_phap_ly'
}

const getStatusMeta = (raw) => {
  const code = toViStatus(raw)
  const map = {
    cho_duyet: { label: 'Chờ kiểm duyệt', cls: 'st-pending' },
    can_xac_minh_phap_ly: { label: 'Cần xác minh', cls: 'st-pending' },
    can_bo_sung: { label: 'Cần bổ sung', cls: 'st-info' },
    da_xac_minh: { label: 'Đã phê duyệt', cls: 'st-approved' },
    tu_choi: { label: 'Đã từ chối', cls: 'st-rejected' },
    het_hieu_luc: { label: 'Hết hiệu lực', cls: 'st-muted' },
  }
  return map[code] || { label: 'Chờ kiểm duyệt', cls: 'st-pending' }
}

const getLawTypeLabel = (t) => ({ luat: 'Luật', nd: 'Nghị định', vbhn: 'Văn bản hợp nhất', tt: 'Thông tư', qcvn: 'QCVN', qd: 'Quyết định' }[t] || 'Văn bản')

const getDomainLabel = (sourceType) => ({
  nuoc_thai_cn: 'Nước thải công nghiệp',
  nuoc_thai_sh: 'Nước thải sinh hoạt',
  nuoc_mat: 'Chất lượng nước mặt',
  nuoc_ngam: 'Chất lượng nước dưới đất',
  khong_khi: 'Không khí xung quanh',
  khi_thai: 'Khí thải công nghiệp',
  dat: 'Chất lượng đất',
}[sourceType] || 'Quy chuẩn môi trường')

const getAuthorityLabel = (tq) => ({
  cap_bo: 'Bộ NN&MT',
  btnmt: 'Bộ NN&MT',
  cap_so: 'UBND Tỉnh / Sở',
  ubnd_tinh: 'UBND Tỉnh / Sở',
  cap_xa: 'UBND cấp Xã',
  bql_kcn: 'BQL KCN',
}[tq] || tq || '—')

const formatDateTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const activeAdvancedCount = computed(() => {
  return [advDateFrom.value, advDateTo.value, advIssuedDate.value, advEffectiveDate.value, advProposer.value, advReviewer.value]
    .filter(v => String(v || '').trim() !== '').length
})

const parseJsonSafeResponse = async (res) => {
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (!ct.includes('application/json')) {
    return { __notJson: true, status: res.status }
  }
  try {
    return await res.json()
  } catch {
    return { __notJson: true, status: res.status }
  }
}

const fetchAllModerationData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [ovRes, lawRes, thrRes, catRes, candRes, histRes] = await Promise.all([
      fetch(API.ADMIN_MODERATION_OVERVIEW, { credentials: 'include' }),
      fetch(API.ADMIN_MODERATION_LAWS, { credentials: 'include' }),
      fetch(`${API.ADMIN_RULES_THRESHOLDS}?status=tat_ca`, { credentials: 'include' }),
      fetch(API.ADMIN_RULES_CATALOG, { credentials: 'include' }),
      fetch(`${API.ADMIN_RULES_CANDIDATES}?status=tat_ca`, { credentials: 'include' }),
      fetch(API.ADMIN_MODERATION_HISTORY, { credentials: 'include' }),
    ])

    const ovData = await parseJsonSafeResponse(ovRes)
    if (ovData.__notJson) {
      throw new Error('Máy chủ backend đang chạy phiên bản cũ nên chưa có API kiểm duyệt mới. Vui lòng khởi động lại máy chủ backend (Ctrl+C rồi chạy lại npm start) và bấm "Thử lại".')
    }
    if (!ovRes.ok) {
      throw new Error(ovData.error || 'Không thể tải thống kê kiểm duyệt từ máy chủ.')
    }
    overview.value = ovData
    emit('stats-updated', ovData.stats?.totalPendingCount || 0)

    if (lawRes.ok) {
      const d = await parseJsonSafeResponse(lawRes)
      if (!d.__notJson) lawsList.value = d.laws || []
    }
    if (thrRes.ok) {
      const d = await parseJsonSafeResponse(thrRes)
      if (!d.__notJson) thresholdsList.value = d.thresholds || []
    }
    if (catRes.ok) {
      const d = await parseJsonSafeResponse(catRes)
      if (!d.__notJson) qcvnsList.value = d.qcvns || []
    }
    if (candRes.ok) {
      const d = await parseJsonSafeResponse(candRes)
      if (!d.__notJson) candidatesList.value = d.candidates || []
    }
    if (histRes.ok) {
      const d = await parseJsonSafeResponse(histRes)
      if (!d.__notJson) {
        historyItems.value = d.items || []
        versionHistory.value = d.versions || []
      }
    }
  } catch (err) {
    loadError.value = err.message || 'Không thể kết nối máy chủ kiểm duyệt.'
  } finally {
    loading.value = false
  }
}

// Click 3 thẻ KPI để lọc nhanh (Mục 3.2)
const selectKpiCard = (cardType) => {
  resetFilters(false)
  if (cardType === 'pending') {
    activeMode.value = 'can_xu_ly'
    activeQueueGroup.value = 'tat_ca'
    statusFilter.value = 'tat_ca'
  } else if (cardType === 'approved') {
    activeMode.value = 'lich_su'
    historySubView.value = 'ban_ghi'
    statusFilter.value = 'da_xac_minh'
  } else if (cardType === 'rejected') {
    activeMode.value = 'lich_su'
    historySubView.value = 'ban_ghi'
    statusFilter.value = 'tu_choi'
  }
}

const switchMode = (mode) => {
  activeMode.value = mode
  statusFilter.value = 'tat_ca'
}

const resetFilters = (resetGroup = true) => {
  keyword.value = ''
  statusFilter.value = 'tat_ca'
  sourceFilter.value = 'tat_ca'
  advDateFrom.value = ''
  advDateTo.value = ''
  advIssuedDate.value = ''
  advEffectiveDate.value = ''
  advProposer.value = ''
  advReviewer.value = ''
  if (resetGroup && activeMode.value === 'can_xu_ly') {
    activeQueueGroup.value = 'tat_ca'
  }
}

const toggleSort = (key) => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const applyCommonFilter = (list, getMeta) => {
  const kw = keyword.value.trim().toLowerCase()
  const st = statusFilter.value
  const src = sourceFilter.value
  const df = advDateFrom.value
  const dt = advDateTo.value
  const issued = advIssuedDate.value
  const eff = advEffectiveDate.value
  const prop = advProposer.value.trim().toLowerCase()
  const rev = advReviewer.value.trim().toLowerCase()

  const filtered = list.filter(item => {
    const m = getMeta(item)
    if (st !== 'tat_ca' && toViStatus(m.status) !== st) return false
    if (src !== 'tat_ca' && m.source && m.source !== src) return false
    if (df && m.date && String(m.date).slice(0, 10) < df) return false
    if (dt && m.date && String(m.date).slice(0, 10) > dt) return false
    if (issued && m.issuedDate && String(m.issuedDate).slice(0, 10) !== issued) return false
    if (eff && m.effectiveDate && String(m.effectiveDate).slice(0, 10) !== eff) return false
    if (prop && !String(m.proposer || '').toLowerCase().includes(prop)) return false
    if (rev && !String(m.reviewer || '').toLowerCase().includes(rev)) return false
    if (kw && !String(m.searchText || '').toLowerCase().includes(kw)) return false
    return true
  })

  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const va = getMeta(a).sortValues?.[sortKey.value] ?? ''
    const vb = getMeta(b).sortValues?.[sortKey.value] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'vi', { numeric: true }) * dir
  })
}

const PENDING_SET = new Set(['cho_duyet', 'can_xac_minh_phap_ly', 'can_bo_sung'])

// 1. Hàng đợi tổng hợp (Tất cả cần xử lý — KHÔNG trộn bản ghi đã phê duyệt)
const filteredQueueAll = computed(() => {
  const base = (overview.value.queueItems || []).filter(i => PENDING_SET.has(toViStatus(i.trang_thai)))
  return applyCommonFilter(base, i => ({
    status: i.trang_thai,
    source: i.nguon,
    date: i.thoi_gian,
    issuedDate: i.ngay_ban_hanh,
    effectiveDate: i.ngay_hieu_luc,
    proposer: i.nguoi_de_xuat,
    reviewer: '',
    searchText: `${i.tieu_de} ${i.so_hieu} ${i.loai_du_lieu_label} ${i.nguon_label} ${i.nguoi_de_xuat}`,
    sortValues: { tieu_de: i.tieu_de, loai: i.loai_du_lieu_label, thoi_gian: i.thoi_gian || '', trang_thai: i.trang_thai },
  }))
})

// 2. Bảng Văn bản pháp luật (7 cột — chỉ cần xử lý khi ở Tab 1)
const filteredQueueLaws = computed(() => {
  const base = lawsList.value.filter(l => PENDING_SET.has(toViStatus(l.verification_status)))
  return applyCommonFilter(base, l => ({
    status: l.verification_status,
    source: l.detection_source,
    date: l.detected_at || l.issued_date,
    issuedDate: l.issued_date,
    effectiveDate: l.effective_date,
    proposer: l.detection_source === 'crawler' ? 'Crawler' : 'Quản trị viên',
    reviewer: l.reviewed_by,
    searchText: `${l.ten} ${l.so} ${l.issuing_agency} ${l.id}`,
    sortValues: { ten: l.ten, so: l.so, hieu_luc: l.effective_date || '', thoi_gian: l.detected_at || '' },
  }))
})

// 3. Bảng Quy tắc phân loại (7 cột — kết hợp đề xuất chờ duyệt + ngưỡng cần xác minh)
const filteredQueueRules = computed(() => {
  const cands = candidatesList.value
    .filter(c => c.target_type !== 'QCVN' && PENDING_SET.has(toViStatus(c.status_vi || c.status)))
    .map(c => ({
      uid: `cand-${c.id}`,
      sub_type: 'candidate',
      id: c.id,
      codeLabel: `ĐX-#${c.id}`,
      industryLabel: c.title || c.target_code,
      groupLabel: c.proposed_data?.project_group || c.proposed_data?.projectGroup || 'Đề xuất mới',
      changeSummary: c.proposed_data?.min_value !== undefined
        ? `${c.proposed_data.operator || '>='} ${c.proposed_data.min_value} ${c.proposed_data.unit || ''} → ${c.proposed_data.legal_doc_required || c.proposed_data.hs || ''}`
        : (c.review_note || 'Đề xuất điều chỉnh quy tắc'),
      legalRef: c.proposed_data?.legal_ref || c.source_excerpt || c.law_title || 'Chưa gắn căn cứ',
      effectiveFrom: c.proposed_data?.effective_from || c.proposed_data?.effectiveFrom || '—',
      status: toViStatus(c.status_vi || c.status),
      source: c.law_id && c.law_id !== 'cap_nhat_thu_cong' ? 'crawler' : 'thu_cong',
      proposer: c.proposed_data?.nguoi_de_xuat || 'Hệ thống / Quản trị viên',
      reviewer: '',
      updatedAt: c.created_at || c.updated_at,
      raw: c,
    }))

  const thrs = thresholdsList.value
    .filter(t => PENDING_SET.has(toViStatus(t.verification_status_vi || t.verification_status)))
    .map(t => ({
      uid: `thr-${t.id}`,
      sub_type: 'threshold',
      id: t.id,
      codeLabel: `#${t.id}`,
      industryLabel: t.industry_name || t.industry_code,
      groupLabel: `${t.project_group}${t.process_stage ? ` · ${t.process_stage}` : ''}`,
      changeSummary: `${t.operator || '>='} ${t.min_value}${t.max_value !== null && t.max_value !== undefined ? `–${t.max_value}` : ''} ${t.unit || ''} · ${t.legal_doc_required} (${getAuthorityLabel(t.tq)})`,
      legalRef: t.legal_ref || 'Chưa gắn căn cứ',
      effectiveFrom: t.effective_from || '—',
      status: toViStatus(t.verification_status_vi || t.verification_status),
      source: 'he_thong',
      proposer: 'Danh mục quy tắc',
      reviewer: t.approved_by || '',
      updatedAt: t.updated_at,
      raw: t,
    }))

  return applyCommonFilter([...cands, ...thrs], r => ({
    status: r.status,
    source: r.source,
    date: r.updatedAt,
    effectiveDate: r.effectiveFrom,
    proposer: r.proposer,
    reviewer: r.reviewer,
    searchText: `${r.codeLabel} ${r.industryLabel} ${r.groupLabel} ${r.changeSummary} ${r.legalRef}`,
    sortValues: { ma: r.id, nganh: r.industryLabel, hieu_luc: r.effectiveFrom, thoi_gian: r.updatedAt || '' },
  }))
})

// 4. Bảng QCVN (7 cột — chỉ cần xử lý khi ở Tab 1)
const filteredQueueQcvns = computed(() => {
  const base = qcvnsList.value.filter(q => PENDING_SET.has(toViStatus(q.verification_status_vi || q.verification_status)))
  return applyCommonFilter(base, q => ({
    status: q.verification_status_vi || q.verification_status,
    source: 'he_thong',
    date: q.updated_at,
    effectiveDate: q.effective_from,
    proposer: 'Danh mục QCVN',
    reviewer: q.verified_by || '',
    searchText: `${q.id} ${q.ten} ${q.standard_code || ''} ${q.source_document || ''} ${getDomainLabel(q.source_type)}`,
    sortValues: { ma: q.id, ten: q.ten, hieu_luc: q.effective_from || '', thoi_gian: q.updated_at || '' },
  }))
})

// 5. Tab 2: Lịch sử kiểm duyệt (Đã phê duyệt, Đã từ chối, Yêu cầu bổ sung, Hết hiệu lực)
const filteredHistoryItems = computed(() => {
  let base = historyItems.value || []
  if (activeQueueGroup.value !== 'tat_ca') {
    base = base.filter(h => h.loai_du_lieu === activeQueueGroup.value)
  }
  return applyCommonFilter(base, h => ({
    status: h.trang_thai,
    source: null,
    date: h.thoi_gian,
    effectiveDate: h.hieu_luc,
    proposer: '',
    reviewer: h.nguoi_thuc_hien,
    searchText: `${h.tieu_de} ${h.so_hieu} ${h.can_cu} ${h.nguoi_thuc_hien} ${h.ghi_chu}`,
    sortValues: { tieu_de: h.tieu_de, trang_thai: h.trang_thai, thoi_gian: h.thoi_gian || '', nguoi: h.nguoi_thuc_hien || '' },
  }))
})

// Tập dữ liệu hiện hành cho phân trang thống nhất
const activeDataset = computed(() => {
  if (activeMode.value === 'lich_su') {
    return historySubView.value === 'phien_ban' ? versionHistory.value : filteredHistoryItems.value
  }
  if (activeQueueGroup.value === 'van_ban') return filteredQueueLaws.value
  if (activeQueueGroup.value === 'quy_tac') return filteredQueueRules.value
  if (activeQueueGroup.value === 'qcvn') return filteredQueueQcvns.value
  return filteredQueueAll.value
})

const {
  currentPage,
  pageSize,
  totalPages,
  paginatedItems,
} = useAdminPagination(activeDataset, {
  pageSize: 10,
  resetOn: [activeMode, activeQueueGroup, historySubView, keyword, statusFilter, sourceFilter, advDateFrom, advDateTo, advIssuedDate, advEffectiveDate, advProposer, advReviewer],
})

// Mở Drawer chi tiết 2 cột
const openReviewDrawer = async (subType, id) => {
  drawerOpen.value = true
  drawerLoading.value = true
  drawerRecordType.value = subType
  drawerDetail.value = null
  feedbackError.value = ''

  try {
    if (subType === 'law') {
      const res = await fetch(`${API.ADMIN_MODERATION_LAWS}/${encodeURIComponent(id)}`, { credentials: 'include' })
      const data = await parseJsonSafeResponse(res)
      if (data.__notJson) throw new Error('Máy chủ backend chưa khởi động lại để nạp API chi tiết văn bản.')
      if (!res.ok) throw new Error(data.error || 'Không thể tải chi tiết văn bản pháp luật.')
      drawerDetail.value = data
    } else if (subType === 'threshold') {
      const res = await fetch(`${API.ADMIN_RULES_THRESHOLDS}/${id}`, { credentials: 'include' })
      const data = await parseJsonSafeResponse(res)
      if (data.__notJson) throw new Error('Máy chủ backend chưa khởi động lại để nạp API chi tiết quy tắc.')
      if (!res.ok) throw new Error(data.error || 'Không thể tải chi tiết quy tắc phân loại.')
      drawerDetail.value = data
    } else if (subType === 'qcvn') {
      const res = await fetch(`${API.ADMIN_RULES_QCVN_VERIFY}/${encodeURIComponent(id)}`, { credentials: 'include' })
      const data = await parseJsonSafeResponse(res)
      if (data.__notJson) throw new Error('Máy chủ backend chưa khởi động lại để nạp API chi tiết QCVN.')
      if (!res.ok) throw new Error(data.error || 'Không thể tải chi tiết quy chuẩn QCVN.')
      drawerDetail.value = data
    } else if (subType === 'candidate') {
      const found = candidatesList.value.find(c => String(c.id) === String(id))
      if (!found) throw new Error('Không tìm thấy thông tin đề xuất.')
      drawerDetail.value = { candidate: found }
    }
  } catch (err) {
    feedbackError.value = err.message || 'Lỗi tải chi tiết bản ghi.'
    drawerOpen.value = false
  } finally {
    drawerLoading.value = false
  }
}

const handleDrawerProcessed = async ({ message }) => {
  drawerOpen.value = false
  feedbackSuccess.value = message
  feedbackError.value = ''
  await fetchAllModerationData()
}

// Mở modal tạo đề xuất sửa đổi quy tắc từ Drawer
const openProposalFromRule = (rule) => {
  proposalForm.value = {
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
    legal_ref: rule.legal_ref || '',
    effective_from: rule.effective_from || new Date().toISOString().slice(0, 10),
    effective_to: rule.effective_to || '',
    reason: '',
  }
  drawerOpen.value = false
  proposalModalOpen.value = true
}

const submitRuleProposal = async () => {
  if (!proposalForm.value.reason.trim()) return
  proposalSubmitting.value = true
  feedbackError.value = ''
  try {
    const f = proposalForm.value
    const res = await fetch(API.ADMIN_MODERATION_PROPOSALS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: 'nguong_phan_loai',
        targetId: f.targetId,
        targetCode: f.targetCode,
        title: `Đề xuất điều chỉnh Quy tắc #${f.targetId} — ${f.industry_name}`,
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
          legal_ref: f.legal_ref,
          sourceDocument: f.legal_ref,
          effective_from: f.effective_from || null,
          effective_to: f.effective_to || null,
        },
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      feedbackError.value = data.error || 'Không thể tạo đề xuất thay đổi quy tắc.'
      return
    }
    proposalModalOpen.value = false
    feedbackSuccess.value = data.message || 'Đã tạo đề xuất thay đổi quy tắc thành công.'
    activeMode.value = 'can_xu_ly'
    activeQueueGroup.value = 'quy_tac'
    await fetchAllModerationData()
  } finally {
    proposalSubmitting.value = false
  }
}

onMounted(() => {
  fetchAllModerationData()
})

defineExpose({ refresh: fetchAllModerationData })
</script>

<template>
  <div class="mod-shell" id="admin-rules">
    <!-- Mục 3.1: Phần tiêu đề gọn gàng -->
    <div class="mod-header">
      <div>
        <h3 class="mod-title">Kiểm duyệt dữ liệu pháp lý</h3>
        <p class="mod-subtitle">
          Xem xét, xác minh và quản lý các thay đổi đối với dữ liệu pháp lý của hệ thống.
        </p>
      </div>
      <div class="mod-header-meta">
        <span v-if="overview.lastUpdatedAt" class="mod-updated-at">
          <i class="ti ti-clock"></i>
          <span>Cập nhật lúc {{ formatDateTime(overview.lastUpdatedAt) }}</span>
        </span>
        <button type="button" class="btn-secondary btn-sm" :disabled="loading" @click="fetchAllModerationData">
          <i class="ti ti-refresh"></i>
          <span>{{ loading ? 'Đang tải...' : 'Làm mới' }}</span>
        </button>
      </div>
    </div>

    <!-- Thông báo kết quả thao tác -->
    <div v-if="feedbackSuccess" style="padding:10px 14px;border-radius:var(--radius);background:var(--success-bg);border:1px solid var(--success-border);color:var(--accent);font-size:13px;display:flex;justify-content:space-between;align-items:center">
      <span><i class="ti ti-circle-check"></i> {{ feedbackSuccess }}</span>
      <button type="button" style="background:none;border:none;cursor:pointer;color:inherit" @click="feedbackSuccess = ''"><i class="ti ti-x"></i></button>
    </div>
    <div v-if="feedbackError || loadError" style="padding:10px 14px;border-radius:var(--radius);background:var(--red-bg);border:1px solid var(--danger-border);color:var(--red);font-size:13px;display:flex;justify-content:space-between;align-items:center">
      <span><i class="ti ti-alert-circle"></i> {{ feedbackError || loadError }}</span>
      <button type="button" class="btn-secondary btn-sm" @click="fetchAllModerationData">Thử lại</button>
    </div>

    <!-- Mục 3.2: Chỉ giữ 3 thẻ thống kê chính (nhấn được để lọc danh sách tương ứng) -->
    <div class="mod-stats-grid">
      <button
        type="button"
        class="mod-stat-card is-pending"
        :class="{ 'is-active': activeMode === 'can_xu_ly' }"
        @click="selectKpiCard('pending')"
      >
        <div class="mod-stat-top">
          <span class="mod-stat-label">Chờ xử lý</span>
          <span class="mod-stat-icon"><i class="ti ti-hourglass-high"></i></span>
        </div>
        <div class="mod-stat-value">{{ overview.stats?.pending?.total ?? overview.stats?.totalPendingCount ?? 0 }}</div>
        <div class="mod-stat-breakdown">
          <span>Văn bản <strong>{{ overview.stats?.pending?.van_ban ?? 0 }}</strong></span>
          <span>·</span>
          <span>Quy tắc <strong>{{ overview.stats?.pending?.quy_tac ?? 0 }}</strong></span>
          <span>·</span>
          <span>QCVN <strong>{{ overview.stats?.pending?.qcvn ?? 0 }}</strong></span>
        </div>
      </button>

      <button
        type="button"
        class="mod-stat-card is-approved"
        :class="{ 'is-active': activeMode === 'lich_su' && statusFilter === 'da_xac_minh' }"
        @click="selectKpiCard('approved')"
      >
        <div class="mod-stat-top">
          <span class="mod-stat-label">Đã phê duyệt</span>
          <span class="mod-stat-icon"><i class="ti ti-circle-check"></i></span>
        </div>
        <div class="mod-stat-value">{{ overview.stats?.approved?.total ?? overview.stats?.approvedTotalCount ?? 0 }}</div>
        <div class="mod-stat-breakdown">
          <span>Văn bản <strong>{{ overview.stats?.approved?.van_ban ?? 0 }}</strong></span>
          <span>·</span>
          <span>Quy tắc <strong>{{ overview.stats?.approved?.quy_tac ?? 0 }}</strong></span>
          <span>·</span>
          <span>QCVN <strong>{{ overview.stats?.approved?.qcvn ?? 0 }}</strong></span>
        </div>
      </button>

      <button
        type="button"
        class="mod-stat-card is-rejected"
        :class="{ 'is-active': activeMode === 'lich_su' && statusFilter === 'tu_choi' }"
        @click="selectKpiCard('rejected')"
      >
        <div class="mod-stat-top">
          <span class="mod-stat-label">Đã từ chối</span>
          <span class="mod-stat-icon"><i class="ti ti-circle-x"></i></span>
        </div>
        <div class="mod-stat-value">{{ overview.stats?.rejected?.total ?? overview.stats?.rejectedTotalCount ?? 0 }}</div>
        <div class="mod-stat-breakdown">
          <span>Văn bản <strong>{{ overview.stats?.rejected?.van_ban ?? 0 }}</strong></span>
          <span>·</span>
          <span>Quy tắc <strong>{{ overview.stats?.rejected?.quy_tac ?? 0 }}</strong></span>
          <span>·</span>
          <span>QCVN <strong>{{ overview.stats?.rejected?.qcvn ?? 0 }}</strong></span>
        </div>
      </button>
    </div>

    <!-- Mục 4 & 5: Tách rõ 2 Tab — Cần xử lý (Hàng đợi) & Lịch sử kiểm duyệt -->
    <div class="mod-workspace-card">
      <div class="mod-mode-bar">
        <div class="mod-mode-tabs">
          <button
            type="button"
            class="mod-mode-tab"
            :class="{ active: activeMode === 'can_xu_ly' }"
            @click="switchMode('can_xu_ly')"
          >
            <span>Cần xử lý</span>
            <span class="mod-count-pill">{{ overview.stats?.pending?.total ?? 0 }}</span>
          </button>
          <button
            type="button"
            class="mod-mode-tab"
            :class="{ active: activeMode === 'lich_su' }"
            @click="switchMode('lich_su')"
          >
            <span>Lịch sử kiểm duyệt</span>
            <span class="mod-count-pill">{{ historyItems.length }}</span>
          </button>
        </div>

        <!-- Chuyển nhanh chế độ trong Tab Lịch sử -->
        <div v-if="activeMode === 'lich_su'" style="display:flex;gap:6px;padding:8px 0">
          <button
            type="button"
            class="btn-sm"
            :class="historySubView === 'ban_ghi' ? 'btn-primary' : 'btn-secondary'"
            @click="historySubView = 'ban_ghi'"
          >
            Bản ghi đã xử lý
          </button>
          <button
            type="button"
            class="btn-sm"
            :class="historySubView === 'phien_ban' ? 'btn-primary' : 'btn-secondary'"
            @click="historySubView = 'phien_ban'"
          >
            Lịch sử phiên bản ({{ versionHistory.length }})
          </button>
        </div>
      </div>

      <!-- Mục 4: Hàng chọn nhóm hàng đợi (Tất cả / Văn bản / Quy tắc / QCVN) -->
      <div v-if="activeMode === 'can_xu_ly'" class="mod-group-bar">
        <button type="button" class="mod-group-pill" :class="{ active: activeQueueGroup === 'tat_ca' }" @click="activeQueueGroup = 'tat_ca'">
          <span>Tất cả cần xử lý</span>
          <span class="mod-pill-num">{{ overview.stats?.pending?.total ?? 0 }}</span>
        </button>
        <button type="button" class="mod-group-pill" :class="{ active: activeQueueGroup === 'van_ban' }" @click="activeQueueGroup = 'van_ban'">
          <span>Văn bản pháp luật</span>
          <span class="mod-pill-num">{{ overview.stats?.pending?.van_ban ?? 0 }}</span>
        </button>
        <button type="button" class="mod-group-pill" :class="{ active: activeQueueGroup === 'quy_tac' }" @click="activeQueueGroup = 'quy_tac'">
          <span>Quy tắc phân loại</span>
          <span class="mod-pill-num">{{ overview.stats?.pending?.quy_tac ?? 0 }}</span>
        </button>
        <button type="button" class="mod-group-pill" :class="{ active: activeQueueGroup === 'qcvn' }" @click="activeQueueGroup = 'qcvn'">
          <span>QCVN</span>
          <span class="mod-pill-num">{{ overview.stats?.pending?.qcvn ?? 0 }}</span>
        </button>
      </div>

      <!-- Mục 6: Thanh bộ lọc 1 hàng gọn + Popover bộ lọc nâng cao -->
      <div v-if="!(activeMode === 'lich_su' && historySubView === 'phien_ban')" class="mod-filter-wrap">
        <div class="mod-filter-row">
          <div class="mod-search-box">
            <i class="ti ti-search"></i>
            <input type="text" v-model="keyword" placeholder="Tìm theo tên, số hiệu, mã quy tắc, căn cứ pháp lý..." />
          </div>

          <select v-model="activeQueueGroup" class="mod-filter-select" aria-label="Loại dữ liệu">
            <option value="tat_ca">Tất cả loại dữ liệu</option>
            <option value="van_ban">Văn bản pháp luật</option>
            <option value="quy_tac">Quy tắc phân loại</option>
            <option value="qcvn">Quy chuẩn QCVN</option>
          </select>

          <select v-model="statusFilter" class="mod-filter-select" aria-label="Trạng thái">
            <option value="tat_ca">Tất cả trạng thái</option>
            <template v-if="activeMode === 'can_xu_ly'">
              <option value="cho_duyet">Chờ kiểm duyệt</option>
              <option value="can_xac_minh_phap_ly">Cần xác minh</option>
              <option value="can_bo_sung">Cần bổ sung</option>
            </template>
            <template v-else>
              <option value="da_xac_minh">Đã phê duyệt</option>
              <option value="tu_choi">Đã từ chối</option>
              <option value="can_bo_sung">Đã yêu cầu bổ sung</option>
              <option value="het_hieu_luc">Hết hiệu lực</option>
            </template>
          </select>

          <select v-if="activeMode === 'can_xu_ly'" v-model="sourceFilter" class="mod-filter-select" aria-label="Nguồn dữ liệu">
            <option value="tat_ca">Tất cả nguồn</option>
            <option value="crawler">Thu thập tự động</option>
            <option value="thu_cong">Đề xuất thủ công</option>
            <option value="he_thong">Danh mục hệ thống</option>
          </select>

          <button type="button" class="btn-secondary btn-sm" style="height:36px" @click="showAdvancedFilters = !showAdvancedFilters">
            <i class="ti ti-adjustments-horizontal"></i>
            <span>Bộ lọc nâng cao</span>
            <span v-if="activeAdvancedCount > 0" class="mod-count-pill">{{ activeAdvancedCount }}</span>
          </button>

          <button type="button" class="btn-secondary btn-sm" style="height:36px" @click="resetFilters(false)">
            Đặt lại
          </button>
        </div>

        <!-- Popover Bộ lọc nâng cao -->
        <div v-if="showAdvancedFilters" class="mod-adv-popover">
          <div class="mod-adv-field">
            <label>Từ ngày</label>
            <input type="date" v-model="advDateFrom" />
          </div>
          <div class="mod-adv-field">
            <label>Đến ngày</label>
            <input type="date" v-model="advDateTo" />
          </div>
          <div class="mod-adv-field">
            <label>Ngày ban hành</label>
            <input type="date" v-model="advIssuedDate" />
          </div>
          <div class="mod-adv-field">
            <label>Ngày hiệu lực</label>
            <input type="date" v-model="advEffectiveDate" />
          </div>
          <div class="mod-adv-field">
            <label>Người đề xuất</label>
            <input type="text" v-model="advProposer" placeholder="Nhập tên hoặc nguồn..." />
          </div>
          <div class="mod-adv-field">
            <label>Người kiểm duyệt</label>
            <input type="text" v-model="advReviewer" placeholder="Nhập tên quản trị viên..." />
          </div>
        </div>
      </div>

      <!-- ================================================================== -->
      <!-- KHU VỰC BẢNG DỮ LIỆU (MỤC 7: TỐI ƯU 7 CỘT THEO TỪNG LOẠI DỮ LIỆU) -->
      <!-- ================================================================== -->
      <div v-if="loading && activeDataset.length === 0" class="mod-empty-state">
        <i class="ti ti-loader"></i>
        <strong>Đang tải dữ liệu kiểm duyệt từ PostgreSQL...</strong>
      </div>

      <div v-else-if="activeDataset.length === 0" class="mod-empty-state">
        <i class="ti ti-clipboard-check"></i>
        <strong>{{ activeMode === 'can_xu_ly' ? 'Không có dữ liệu nào đang chờ xử lý' : 'Chưa có dữ liệu lịch sử phù hợp' }}</strong>
        <span style="font-size:13px">Thử thay đổi bộ lọc hoặc chuyển sang nhóm dữ liệu khác.</span>
      </div>

      <div v-else class="mod-table-wrap">
        <!-- BẢNG A: HÀNG ĐỢI TỔNG HỢP (Tất cả cần xử lý) -->
        <table v-if="activeMode === 'can_xu_ly' && activeQueueGroup === 'tat_ca'" class="mod-table">
          <thead>
            <tr>
              <th class="is-sortable" @click="toggleSort('tieu_de')">Tên dữ liệu / Đề xuất</th>
              <th class="is-sortable" style="width:165px" @click="toggleSort('loai')">Loại dữ liệu</th>
              <th style="width:145px">Nguồn phát sinh</th>
              <th class="is-sortable" style="width:145px" @click="toggleSort('thoi_gian')">Thời gian gửi</th>
              <th style="width:150px">Người đề xuất</th>
              <th class="is-sortable" style="width:140px" @click="toggleSort('trang_thai')">Trạng thái</th>
              <th style="width:110px;text-align:right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in paginatedItems" :key="item.uid">
              <td>
                <div class="mod-cell-title" :title="item.tieu_de">{{ item.tieu_de }}</div>
                <div class="mod-cell-sub">Mã: {{ item.so_hieu || item.ma }}</div>
              </td>
              <td>{{ item.loai_du_lieu_label }}</td>
              <td style="color:var(--text2)">{{ item.nguon_label }}</td>
              <td style="color:var(--text2);font-size:12.5px;white-space:nowrap">{{ formatDateTime(item.thoi_gian) }}</td>
              <td style="color:var(--text2)">{{ item.nguoi_de_xuat || '—' }}</td>
              <td>
                <span class="mod-status-badge" :class="getStatusMeta(item.trang_thai).cls">
                  {{ getStatusMeta(item.trang_thai).label }}
                </span>
              </td>
              <td style="text-align:right">
                <button type="button" class="btn-primary btn-sm" @click="openReviewDrawer(item.sub_type, item.ma)">
                  Xem xét
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- BẢNG 7.1: VĂN BẢN PHÁP LUẬT (7 cột) -->
        <table v-else-if="activeMode === 'can_xu_ly' && activeQueueGroup === 'van_ban'" class="mod-table">
          <thead>
            <tr>
              <th class="is-sortable" @click="toggleSort('ten')">Tên văn bản</th>
              <th class="is-sortable" style="width:145px" @click="toggleSort('so')">Số hiệu</th>
              <th style="width:165px">Cơ quan ban hành</th>
              <th class="is-sortable" style="width:120px" @click="toggleSort('hieu_luc')">Ngày hiệu lực</th>
              <th style="width:135px">Nguồn</th>
              <th style="width:140px">Trạng thái</th>
              <th style="width:110px;text-align:right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="law in paginatedItems" :key="law.id">
              <td>
                <div class="mod-cell-title" :title="law.ten">{{ law.ten }}</div>
                <div class="mod-cell-sub">{{ getLawTypeLabel(law.type) }} · {{ law.provisions_count || 0 }} điều khoản</div>
              </td>
              <td style="font-weight:600;color:var(--accent)">{{ law.so }}</td>
              <td style="color:var(--text2)">{{ law.issuing_agency }}</td>
              <td style="color:var(--text2);white-space:nowrap">{{ law.effective_date || law.hieuluc || '—' }}</td>
              <td style="color:var(--text2)">{{ law.detection_source_label }}</td>
              <td>
                <span class="mod-status-badge" :class="getStatusMeta(law.verification_status).cls">
                  {{ getStatusMeta(law.verification_status).label }}
                </span>
              </td>
              <td style="text-align:right">
                <button type="button" class="btn-primary btn-sm" @click="openReviewDrawer('law', law.id)">
                  Xem xét
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- BẢNG 7.2: QUY TẮC PHÂN LOẠI (7 cột) -->
        <table v-else-if="activeMode === 'can_xu_ly' && activeQueueGroup === 'quy_tac'" class="mod-table">
          <thead>
            <tr>
              <th class="is-sortable" style="width:88px" @click="toggleSort('ma')">Mã quy tắc</th>
              <th class="is-sortable" @click="toggleSort('nganh')">Ngành nghề / Nhóm dự án</th>
              <th>Nội dung thay đổi / Ngưỡng</th>
              <th style="width:200px">Căn cứ pháp lý</th>
              <th class="is-sortable" style="width:110px" @click="toggleSort('hieu_luc')">Hiệu lực</th>
              <th style="width:140px">Trạng thái</th>
              <th style="width:110px;text-align:right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="rule in paginatedItems" :key="rule.uid">
              <td style="font-weight:700;color:var(--accent)">{{ rule.codeLabel }}</td>
              <td>
                <div class="mod-cell-title" :title="rule.industryLabel">{{ rule.industryLabel }}</div>
                <div class="mod-cell-sub">{{ rule.groupLabel }}</div>
              </td>
              <td style="color:var(--text2);font-size:13px">{{ rule.changeSummary }}</td>
              <td style="color:var(--text2);font-size:12.5px">
                <div class="mod-cell-title" style="font-weight:400;max-width:200px" :title="rule.legalRef">{{ rule.legalRef }}</div>
              </td>
              <td style="color:var(--text2);white-space:nowrap">{{ rule.effectiveFrom }}</td>
              <td>
                <span class="mod-status-badge" :class="getStatusMeta(rule.status).cls">
                  {{ getStatusMeta(rule.status).label }}
                </span>
              </td>
              <td style="text-align:right">
                <button type="button" class="btn-primary btn-sm" @click="openReviewDrawer(rule.sub_type, rule.id)">
                  Xem xét
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- BẢNG 7.3: QCVN (7 cột) -->
        <table v-else-if="activeMode === 'can_xu_ly' && activeQueueGroup === 'qcvn'" class="mod-table">
          <thead>
            <tr>
              <th class="is-sortable" style="width:150px" @click="toggleSort('ma')">Mã QCVN</th>
              <th class="is-sortable" @click="toggleSort('ten')">Tên quy chuẩn</th>
              <th style="width:175px">Nhóm lĩnh vực</th>
              <th style="width:115px">Thông số</th>
              <th class="is-sortable" style="width:115px" @click="toggleSort('hieu_luc')">Ngày hiệu lực</th>
              <th style="width:140px">Trạng thái</th>
              <th style="width:110px;text-align:right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="q in paginatedItems" :key="q.id">
              <td style="font-weight:600;color:var(--accent)">{{ q.standard_code || q.id }}</td>
              <td>
                <div class="mod-cell-title" :title="q.ten">{{ q.ten }}</div>
                <div class="mod-cell-sub">Mã hệ thống: {{ q.id }}</div>
              </td>
              <td>
                <div>{{ getDomainLabel(q.source_type) }}</div>
                <div v-if="q.column_code || q.flow_range" class="mod-cell-sub">
                  <span v-if="q.column_code">Cột {{ q.column_code }}</span>
                  <span v-if="q.flow_range"> · {{ q.flow_range }}</span>
                </div>
              </td>
              <td style="color:var(--text2)">{{ q.parameter_count || (q.tham_so ? q.tham_so.length : 0) }} thông số</td>
              <td style="color:var(--text2);white-space:nowrap">{{ q.effective_from || '—' }}</td>
              <td>
                <span class="mod-status-badge" :class="getStatusMeta(q.verification_status_vi || q.verification_status).cls">
                  {{ getStatusMeta(q.verification_status_vi || q.verification_status).label }}
                </span>
              </td>
              <td style="text-align:right">
                <button type="button" class="btn-primary btn-sm" @click="openReviewDrawer('qcvn', q.id)">
                  Xem xét
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- TAB 2: LỊCH SỬ KIỂM DUYỆT — BẢN GHI ĐÃ XỬ LÝ (Nút Xem chi tiết, không hiện Xem & Duyệt) -->
        <table v-else-if="activeMode === 'lich_su' && historySubView === 'ban_ghi'" class="mod-table">
          <thead>
            <tr>
              <th class="is-sortable" @click="toggleSort('tieu_de')">Tên dữ liệu</th>
              <th style="width:155px">Loại dữ liệu</th>
              <th style="width:190px">Căn cứ / Ghi chú</th>
              <th class="is-sortable" style="width:150px" @click="toggleSort('nguoi')">Người thực hiện</th>
              <th class="is-sortable" style="width:145px" @click="toggleSort('thoi_gian')">Thời gian</th>
              <th class="is-sortable" style="width:140px" @click="toggleSort('trang_thai')">Trạng thái</th>
              <th style="width:125px;text-align:right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in paginatedItems" :key="h.uid">
              <td>
                <div class="mod-cell-title" :title="h.tieu_de">{{ h.tieu_de }}</div>
                <div class="mod-cell-sub">Mã: {{ h.so_hieu || h.ma }}</div>
              </td>
              <td>{{ h.loai_du_lieu_label }}</td>
              <td style="color:var(--text2);font-size:12.5px">
                <div class="mod-cell-title" style="font-weight:400;max-width:200px" :title="h.ghi_chu || h.can_cu">
                  {{ h.ghi_chu || h.can_cu || '—' }}
                </div>
              </td>
              <td style="color:var(--text2)">{{ h.nguoi_thuc_hien }}</td>
              <td style="color:var(--text2);font-size:12.5px;white-space:nowrap">{{ formatDateTime(h.thoi_gian) }}</td>
              <td>
                <span class="mod-status-badge" :class="getStatusMeta(h.trang_thai).cls">
                  {{ getStatusMeta(h.trang_thai).label }}
                </span>
              </td>
              <td style="text-align:right">
                <button type="button" class="btn-secondary btn-sm" @click="openReviewDrawer(h.sub_type, h.ma)">
                  Xem chi tiết
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- TAB 2: LỊCH SỬ PHIÊN BẢN QUY TẮC -->
        <table v-else class="mod-table">
          <thead>
            <tr>
              <th style="width:140px">Phiên bản</th>
              <th style="width:160px">Đối tượng</th>
              <th>Nội dung / Lý do thay đổi</th>
              <th style="width:180px">Căn cứ pháp lý</th>
              <th style="width:150px">Người thực hiện</th>
              <th style="width:150px">Thời gian</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in paginatedItems" :key="v.id">
              <td><code>{{ v.version }}</code></td>
              <td style="font-weight:600">{{ v.target_code }}</td>
              <td style="color:var(--text2)">{{ v.change_reason || '—' }}</td>
              <td style="color:var(--text2);font-size:12.5px">{{ v.legal_basis || '—' }}</td>
              <td style="color:var(--text2)">{{ v.actor }}</td>
              <td style="color:var(--text2);font-size:12.5px;white-space:nowrap">{{ formatDateTime(v.changed_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Phân trang cho mọi bảng -->
      <div v-if="activeDataset.length > 0" class="mod-pagination">
        <div>
          Hiển thị <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> – <strong>{{ Math.min(currentPage * pageSize, activeDataset.length) }}</strong> / {{ activeDataset.length }} bản ghi
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="currentPage--">‹</button>
          <span style="padding:0 8px;font-size:12.5px">Trang {{ currentPage }} / {{ totalPages }}</span>
          <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="currentPage++">›</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span>Hiển thị:</span>
          <select v-model.number="pageSize" style="width:96px;height:30px;font-size:12.5px">
            <option :value="10">10 / trang</option>
            <option :value="20">20 / trang</option>
            <option :value="50">50 / trang</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Drawer chi tiết kiểm duyệt 2 cột -->
    <ModerationDetailDrawer
      :open="drawerOpen"
      :record-type="drawerRecordType"
      :detail="drawerDetail"
      :loading="drawerLoading"
      @close="drawerOpen = false"
      @processed="handleDrawerProcessed"
      @open-proposal="openProposalFromRule"
    />

    <!-- Modal Tạo đề xuất điều chỉnh quy tắc (giữ nguyên quy tắc đang hiệu lực) -->
    <div v-if="proposalModalOpen" class="modal-overlay" @click.self="proposalModalOpen = false">
      <div class="modal-card fade-up" style="width:600px;max-width:95vw;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:700;margin:0">
            Tạo đề xuất điều chỉnh Quy tắc #{{ proposalForm.targetId }} — {{ proposalForm.industry_name }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="proposalModalOpen = false"><i class="ti ti-x"></i></button>
        </div>
        <div style="margin-bottom:12px;padding:10px 12px;background:var(--info-bg);border:1px solid var(--info-border);border-radius:var(--radius);font-size:12.5px;color:var(--text2)">
          Đề xuất sẽ được đưa vào hàng đợi <strong>Cần xử lý</strong>. Quy tắc đang áp dụng vẫn giữ nguyên cho đến khi đề xuất được phê duyệt chính thức.
        </div>
        <form @submit.prevent="submitRuleProposal">
          <div class="form-grid-2" style="gap:10px">
            <div class="form-group">
              <label class="form-label">Công đoạn</label>
              <input type="text" v-model="proposalForm.process_stage" />
            </div>
            <div class="form-group">
              <label class="form-label">Toán tử</label>
              <select v-model="proposalForm.operator">
                <option value=">=">&gt;=</option>
                <option value=">">&gt;</option>
                <option value="<=">&lt;=</option>
                <option value="<">&lt;</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Ngưỡng tối thiểu *</label>
              <input type="number" step="any" v-model="proposalForm.min_value" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngưỡng tối đa</label>
              <input type="number" step="any" v-model="proposalForm.max_value" />
            </div>
            <div class="form-group">
              <label class="form-label">Nhóm dự án *</label>
              <select v-model="proposalForm.project_group">
                <option value="Nhóm I">Nhóm I</option>
                <option value="Nhóm II">Nhóm II</option>
                <option value="Nhóm III">Nhóm III</option>
                <option value="Nhóm IV">Nhóm IV</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Loại hồ sơ *</label>
              <select v-model="proposalForm.legal_doc_required">
                <option value="DTM">ĐTM</option>
                <option value="GPMT">GPMT</option>
                <option value="DKMT">ĐKMT</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Căn cứ pháp lý *</label>
              <input type="text" v-model="proposalForm.legal_ref" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày bắt đầu hiệu lực *</label>
              <input type="date" v-model="proposalForm.effective_from" required />
            </div>
          </div>
          <div class="form-group" style="margin-top:8px">
            <label class="form-label">Lý do đề xuất thay đổi *</label>
            <textarea v-model="proposalForm.reason" rows="2" required placeholder="Nhập lý do và điều khoản sửa đổi..."></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
            <button type="button" class="btn-secondary" @click="proposalModalOpen = false">Hủy</button>
            <button type="submit" class="btn-primary" :disabled="proposalSubmitting">
              <span>{{ proposalSubmitting ? 'Đang gửi...' : 'Gửi đề xuất vào hàng đợi' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
