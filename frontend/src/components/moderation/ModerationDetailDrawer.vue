<script setup>
import { ref, computed, watch } from 'vue'
import { API } from '../../utils/constants.js'
import {
  toModerationStatusCode as toViStatus,
  getModerationStatusMeta as getStatusMeta,
  getAuthorityLabel,
  getQcvnDomainLabel as getDomainLabel,
  getProcedureShortLabel,
  formatLegalTextLines,
} from '../../utils/legalLabels.js'
import LegalDetailModal from '../LegalDetailModal.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  recordType: { type: String, default: '' }, // 'law' | 'threshold' | 'qcvn' | 'candidate'
  detail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'processed', 'open-proposal'])

// Định nghĩa Checklist 5 mục theo từng loại dữ liệu (Mục 9)
const CHECKLIST_DEFINITIONS = {
  law: [
    { key: 'nguon_chinh_thuc', label: 'Đã kiểm tra nguồn chính thức của văn bản' },
    { key: 'so_hieu_ten', label: 'Đã đối chiếu số hiệu và tên văn bản' },
    { key: 'co_quan_ban_hanh', label: 'Đã kiểm tra cơ quan ban hành' },
    { key: 'ngay_hieu_luc', label: 'Đã kiểm tra ngày ban hành và ngày hiệu lực' },
    { key: 'van_ban_lien_quan', label: 'Đã xem xét văn bản sửa đổi, bổ sung hoặc thay thế' },
  ],
  rule: [
    { key: 'van_ban_vien_dan', label: 'Đã kiểm tra văn bản viện dẫn' },
    { key: 'dieu_khoan_phu_luc', label: 'Đã kiểm tra điều khoản hoặc phụ lục' },
    { key: 'dieu_kien_nguong', label: 'Đã đối chiếu điều kiện và ngưỡng công suất' },
    { key: 'thoi_gian_hieu_luc', label: 'Đã kiểm tra thời gian hiệu lực áp dụng' },
    { key: 'anh_huong_phan_loai', label: 'Đã kiểm tra ảnh hưởng đến kết quả phân loại dự án' },
  ],
  qcvn: [
    { key: 'ma_ten_qcvn', label: 'Đã kiểm tra mã và tên quy chuẩn' },
    { key: 'doi_chieu_thong_so', label: 'Đã đối chiếu danh sách thông số môi trường' },
    { key: 'gia_tri_don_vi', label: 'Đã đối chiếu giá trị giới hạn và đơn vị tính' },
    { key: 'can_cu_phap_ly', label: 'Đã kiểm tra căn cứ pháp lý ban hành' },
    { key: 'ngay_hieu_luc', label: 'Đã kiểm tra ngày bắt đầu và kết thúc hiệu lực' },
  ],
}

const checklistState = ref({})
const checklistSaveState = ref('') // '' | 'saving' | 'saved' | 'error'
const reviewNote = ref('')
const legalBasisInput = ref('')
const effectiveFromInput = ref('')
const effectiveToInput = ref('')
const submitting = ref(false)
const actionError = ref('')
const showApproveConfirm = ref(false)
const showLawEditForm = ref(false)
const lawMetadataPatch = ref({})

const formatDateTime = (ts) => {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Xác định loại dữ liệu ngữ nghĩa cho Checklist và hiển thị
const semanticType = computed(() => {
  if (props.recordType === 'law') return 'law'
  if (props.recordType === 'qcvn') return 'qcvn'
  if (props.recordType === 'candidate') {
    const t = String(props.detail?.candidate?.target_type || '').toUpperCase()
    return t === 'QCVN' ? 'qcvn' : 'rule'
  }
  return 'rule'
})

const checklistItems = computed(() => CHECKLIST_DEFINITIONS[semanticType.value] || CHECKLIST_DEFINITIONS.rule)
const checkedCount = computed(() => checklistItems.value.filter(i => Boolean(checklistState.value[i.key])).length)

const currentStatusCode = computed(() => {
  if (!props.detail) return 'cho_duyet'
  if (props.recordType === 'law') return toViStatus(props.detail.law?.verification_status)
  if (props.recordType === 'threshold') return toViStatus(props.detail.rule?.verification_status)
  if (props.recordType === 'qcvn') return toViStatus(props.detail.qcvn?.verification_status)
  if (props.recordType === 'candidate') return toViStatus(props.detail.candidate?.status_vi || props.detail.candidate?.status)
  return 'cho_duyet'
})

const isActionable = computed(() => ['cho_duyet', 'can_xac_minh_phap_ly', 'can_bo_sung'].includes(currentStatusCode.value))

const recordHeaderTitle = computed(() => {
  if (!props.detail) return 'Chi tiết kiểm duyệt'
  if (props.recordType === 'law') return `${props.detail.law?.so || ''} — ${props.detail.law?.ten || ''}`
  if (props.recordType === 'threshold') return `Quy tắc #${props.detail.rule?.id} — ${props.detail.rule?.industry_name || props.detail.rule?.industry_code || ''}`
  if (props.recordType === 'qcvn') return `${props.detail.qcvn?.standard_code || props.detail.qcvn?.id} — ${props.detail.qcvn?.ten || ''}`
  if (props.recordType === 'candidate') return `Đề xuất #${props.detail.candidate?.id} — ${props.detail.candidate?.title || props.detail.candidate?.target_code}`
  return 'Chi tiết kiểm duyệt'
})

const recordTypeBadge = computed(() => {
  if (props.recordType === 'law') return 'Văn bản pháp luật'
  if (props.recordType === 'threshold') return 'Quy tắc phân loại'
  if (props.recordType === 'qcvn') return 'Quy chuẩn QCVN'
  if (props.recordType === 'candidate') {
    return semanticType.value === 'qcvn' ? 'Đề xuất cập nhật QCVN' : 'Đề xuất thay đổi quy tắc'
  }
  return 'Dữ liệu pháp lý'
})

const proposerName = computed(() => {
  if (!props.detail) return '—'
  if (props.recordType === 'law') {
    return props.detail.law?.detection_source === 'crawler' ? 'Trình thu thập dữ liệu tự động' : 'Quản trị viên hệ thống'
  }
  if (props.recordType === 'candidate') {
    return props.detail.candidate?.proposed_data?.nguoi_de_xuat || 'Hệ thống / Quản trị viên'
  }
  return 'Danh mục hệ thống'
})

const reviewerName = computed(() => {
  if (!props.detail) return 'Chưa có'
  if (props.recordType === 'law') return props.detail.law?.reviewed_by || 'Chưa có'
  if (props.recordType === 'threshold') return props.detail.rule?.approved_by || 'Chưa có'
  if (props.recordType === 'qcvn') return props.detail.qcvn?.verified_by || 'Chưa có'
  if (props.recordType === 'candidate') return props.detail.candidate?.reviewed_by ? `Quản trị viên #${props.detail.candidate.reviewed_by}` : 'Chưa có'
  return 'Chưa có'
})

// Mục 8.1: Bảng so sánh Trước & Sau cho Quy tắc phân loại / Đề xuất quy tắc
const ruleDiffRows = computed(() => {
  if (semanticType.value !== 'rule' || !props.detail) return []
  let before = {}
  let after = {}
  if (props.recordType === 'candidate') {
    before = props.detail.candidate?.diff_summary?.truoc_thay_doi || {}
    after = props.detail.candidate?.proposed_data || {}
  } else if (props.recordType === 'threshold') {
    before = props.detail.rule || {}
    after = {
      ...before,
      legal_ref: legalBasisInput.value || before.legal_ref,
      effective_from: effectiveFromInput.value || before.effective_from,
      effective_to: effectiveToInput.value || before.effective_to,
    }
  }

  const fmtCap = (obj) => {
    const minVal = obj.min_value ?? obj.min
    const maxVal = obj.max_value ?? obj.max
    const op = obj.operator || '>='
    const unit = obj.unit || ''
    if (minVal === undefined || minVal === null) return '—'
    const range = maxVal !== null && maxVal !== undefined && maxVal !== '' ? `${op} ${minVal} đến ${maxVal}` : `${op} ${minVal}`
    return `${range}${unit ? ` (${unit})` : ''}`
  }

  const rows = [
    {
      label: 'Công đoạn / Quy trình',
      oldVal: before.process_stage || 'Áp dụng chung',
      newVal: (after.process_stage ?? after.processStage ?? before.process_stage) || 'Áp dụng chung',
    },
    {
      label: 'Ngưỡng công suất & Đơn vị',
      oldVal: fmtCap(before),
      newVal: fmtCap({ ...before, ...after }),
    },
    {
      label: 'Nhóm dự án',
      oldVal: before.project_group || '—',
      newVal: after.project_group || after.projectGroup || before.project_group || '—',
    },
    {
      label: 'Loại hồ sơ môi trường',
      oldVal: getProcedureShortLabel(before.legal_doc_required),
      newVal: getProcedureShortLabel(after.legal_doc_required || after.hs || before.legal_doc_required),
    },
    {
      label: 'Thẩm quyền giải quyết',
      oldVal: getAuthorityLabel(before.tq),
      newVal: getAuthorityLabel(after.tq || before.tq),
    },
    {
      label: 'Căn cứ pháp lý',
      oldVal: before.legal_ref || 'Chưa gắn căn cứ',
      newVal: after.legal_ref || after.legalRef || after.sourceDocument || before.legal_ref || 'Chưa gắn căn cứ',
    },
    {
      label: 'Ngày bắt đầu hiệu lực',
      oldVal: before.effective_from || '—',
      newVal: after.effective_from || after.effectiveFrom || before.effective_from || '—',
    },
    {
      label: 'Ngày kết thúc hiệu lực',
      oldVal: before.effective_to || 'Hiện hành',
      newVal: after.effective_to || after.effectiveTo || before.effective_to || 'Hiện hành',
    },
  ]

  return rows.map(r => ({
    ...r,
    changed: String(r.oldVal).trim() !== String(r.newVal).trim(),
  }))
})

// Mục 8.2: Danh sách thông số môi trường cho QCVN (có hỗ trợ so sánh cũ / đề xuất nếu là bản cập nhật)
const qcvnParamRows = computed(() => {
  if (semanticType.value !== 'qcvn' || !props.detail) return []
  const formatLimit = (p) => {
    if (!p) return '—'
    if (p.loai === 'range' || (p.min !== undefined && p.min !== null && p.max !== undefined && p.max !== null)) {
      return `${p.min} – ${p.max}`
    }
    const lim = p.gioi_han ?? p.limit ?? p.max
    return lim !== undefined && lim !== null ? `≤ ${lim}` : '—'
  }

  if (props.recordType === 'candidate') {
    const oldList = Array.isArray(props.detail.candidate?.diff_summary?.truoc_thay_doi?.tham_so)
      ? props.detail.candidate.diff_summary.truoc_thay_doi.tham_so
      : []
    const newList = Array.isArray(props.detail.candidate?.proposed_data?.tham_so)
      ? props.detail.candidate.proposed_data.tham_so
      : []
    const oldMap = new Map(oldList.map(p => [String(p.key || p.ma || p.ten).toLowerCase(), p]))
    return newList.filter(p => p && (p.ten || p.key || p.ma)).map((p, idx) => {
      const oldP = oldMap.get(String(p.key || p.ma || p.ten).toLowerCase())
      const oldLimit = oldP ? formatLimit(oldP) : 'Mới thêm'
      const newLimit = formatLimit(p)
      return {
        idx: idx + 1,
        key: p.key || p.ma || `ts_${idx + 1}`,
        ten: p.ten || p.chi_tieu || p.key,
        oldLimit,
        newLimit,
        unit: p.don_vi || p.unit || 'mg/L',
        period: p.averagingPeriod || (p.required ? 'Bắt buộc' : 'Theo quy chuẩn'),
        changed: oldLimit !== newLimit,
      }
    })
  }

  const list = Array.isArray(props.detail.qcvn?.tham_so) ? props.detail.qcvn.tham_so : []
  return list.filter(p => p && (p.ten || p.key || p.chi_tieu)).map((p, idx) => ({
    idx: idx + 1,
    key: p.key || p.ma || `ts_${idx + 1}`,
    ten: p.ten || p.chi_tieu || p.key,
    oldLimit: formatLimit(p),
    newLimit: null,
    unit: p.don_vi || p.unit || 'mg/L',
    period: p.averagingPeriod || (p.required ? 'Bắt buộc' : 'Theo quy chuẩn'),
    changed: false,
  }))
})

// Lịch sử xử lý hiển thị ở cột phải
const timelineItems = computed(() => {
  if (!props.detail) return []
  if (props.recordType === 'law') {
    return (props.detail.history || []).map(h => ({
      time: h.updated_at,
      actor: h.actor_name || h.actor_username || 'Hệ thống',
      text: h.description || h.action,
    }))
  }
  if (props.recordType === 'threshold' || props.recordType === 'qcvn') {
    return (props.detail.versions || []).map(v => ({
      time: v.changed_at,
      actor: v.actor_name || v.expression?.nguoi_thuc_hien || 'Quản trị viên',
      text: `${v.version ? `[${v.version}] ` : ''}${v.change_reason || 'Cập nhật phiên bản'}`,
    }))
  }
  if (props.recordType === 'candidate' && props.detail.candidate) {
    const c = props.detail.candidate
    const list = [{ time: c.created_at, actor: proposerName.value, text: `Khởi tạo đề xuất #${c.id}` }]
    if (c.reviewed_at) {
      list.unshift({ time: c.reviewed_at, actor: reviewerName.value, text: `${getStatusMeta(c.status_vi || c.status).label}${c.review_note ? ` — ${c.review_note}` : ''}` })
    }
    return list
  }
  return []
})

// Đồng bộ trạng thái form khi mở bản ghi mới
watch(() => [props.open, props.detail, props.recordType], () => {
  if (!props.open || !props.detail) return
  actionError.value = ''
  checklistSaveState.value = ''
  showApproveConfirm.value = false
  showLawEditForm.value = false

  if (props.recordType === 'law' && props.detail.law) {
    const l = props.detail.law
    checklistState.value = { ...(l.review_checklist?.items || {}) }
    reviewNote.value = l.review_note || ''
    legalBasisInput.value = l.so || ''
    effectiveFromInput.value = l.effective_date || ''
    lawMetadataPatch.value = {
      so: l.so || '',
      ten: l.ten || '',
      issuing_agency: l.issuing_agency || '',
      issued_date: l.issued_date || '',
      effective_date: l.effective_date || '',
      link: l.link || '',
      mo_ta: l.mo_ta || '',
    }
  } else if (props.recordType === 'threshold' && props.detail.rule) {
    const r = props.detail.rule
    checklistState.value = { ...(r.review_checklist?.items || {}) }
    reviewNote.value = ''
    legalBasisInput.value = r.legal_ref || ''
    effectiveFromInput.value = r.effective_from || ''
    effectiveToInput.value = r.effective_to || ''
  } else if (props.recordType === 'qcvn' && props.detail.qcvn) {
    const q = props.detail.qcvn
    checklistState.value = { ...(q.review_checklist?.items || {}) }
    reviewNote.value = ''
    legalBasisInput.value = q.source_document || q.ap_dung || ''
    effectiveFromInput.value = q.effective_from || ''
    effectiveToInput.value = q.effective_to || ''
  } else if (props.recordType === 'candidate' && props.detail.candidate) {
    const c = props.detail.candidate
    checklistState.value = { ...(c.review_checklist?.items || {}) }
    reviewNote.value = c.review_note || ''
    legalBasisInput.value = c.proposed_data?.sourceDocument || c.proposed_data?.legal_ref || c.source_excerpt || ''
    effectiveFromInput.value = c.proposed_data?.effective_from || c.proposed_data?.effectiveFrom || ''
  }
}, { immediate: true })

// Lưu checklist trực tiếp vào PostgreSQL qua PUT /api/admin/rules/checklist
const onToggleChecklist = async (key, checked) => {
  checklistState.value = { ...checklistState.value, [key]: checked }
  let targetId = ''
  if (props.recordType === 'law') targetId = props.detail?.law?.id
  else if (props.recordType === 'threshold') targetId = String(props.detail?.rule?.id || '')
  else if (props.recordType === 'qcvn') targetId = props.detail?.qcvn?.id
  else if (props.recordType === 'candidate') targetId = String(props.detail?.candidate?.id || '')
  if (!targetId) return

  checklistSaveState.value = 'saving'
  try {
    const res = await fetch(API.ADMIN_MODERATION_CHECKLIST, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetType: props.recordType,
        targetId,
        checklist: checklistState.value,
      }),
    })
    checklistSaveState.value = res.ok ? 'saved' : 'error'
  } catch {
    checklistSaveState.value = 'error'
  }
}

// Mở hộp thoại xác nhận Phê duyệt (không cho phép phê duyệt bằng 1 cú nhấn)
const requestApprove = () => {
  actionError.value = ''
  if ((props.recordType === 'threshold' || props.recordType === 'qcvn' || props.recordType === 'candidate') && !legalBasisInput.value.trim()) {
    actionError.value = 'Vui lòng nhập đầy đủ Căn cứ pháp lý trước khi phê duyệt.'
    return
  }
  if (props.recordType === 'threshold' && !effectiveFromInput.value) {
    actionError.value = 'Vui lòng chọn Ngày bắt đầu hiệu lực trước khi phê duyệt quy tắc phân loại.'
    return
  }
  showApproveConfirm.value = true
}

const executeDecision = async (decision) => {
  actionError.value = ''
  const cleanNote = reviewNote.value.trim()
  if ((decision === 'tu_choi' || decision === 'can_bo_sung') && !cleanNote) {
    actionError.value = decision === 'tu_choi'
      ? 'Bắt buộc nhập lý do khi Từ chối dữ liệu kiểm duyệt.'
      : 'Bắt buộc nhập nội dung cần bổ sung khi chọn Yêu cầu bổ sung.'
    return
  }

  submitting.value = true
  try {
    let url = ''
    let body = {}

    if (props.recordType === 'law') {
      url = `${API.ADMIN_MODERATION_LAWS}/${encodeURIComponent(props.detail.law.id)}/review`
      body = {
        decision,
        reviewNote: cleanNote || null,
        ...(showLawEditForm.value ? { metadataPatch: lawMetadataPatch.value } : {}),
      }
    } else if (props.recordType === 'threshold') {
      url = `${API.ADMIN_RULES_THRESHOLDS}/${props.detail.rule.id}/review`
      body = {
        decision,
        legalRef: legalBasisInput.value.trim() || null,
        effectiveFrom: effectiveFromInput.value || null,
        effectiveTo: effectiveToInput.value || null,
        reviewNote: cleanNote || null,
      }
    } else if (props.recordType === 'qcvn') {
      url = `${API.ADMIN_RULES_QCVN_VERIFY}/${encodeURIComponent(props.detail.qcvn.id)}/review`
      body = {
        decision,
        sourceDocument: legalBasisInput.value.trim() || null,
        effectiveFrom: effectiveFromInput.value || null,
        effectiveTo: effectiveToInput.value || null,
        reviewNote: cleanNote || null,
      }
    } else if (props.recordType === 'candidate') {
      const candId = props.detail.candidate.id
      if (decision === 'da_xac_minh') {
        url = `${API.ADMIN_RULES_CANDIDATES}/${candId}/approve`
        body = {
          sourceDocument: legalBasisInput.value.trim(),
          reviewNote: cleanNote || null,
        }
      } else {
        url = `${API.ADMIN_RULES_CANDIDATES}/${candId}/reject`
        body = {
          status: decision,
          reviewNote: cleanNote,
          requireReason: true,
        }
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      actionError.value = data.error || 'Không thể lưu quyết định kiểm duyệt.'
      showApproveConfirm.value = false
      return
    }
    showApproveConfirm.value = false
    emit('processed', {
      decision,
      message: data.message || 'Đã lưu kết quả kiểm duyệt thành công.',
    })
  } catch (err) {
    actionError.value = err.message || 'Lỗi kết nối máy chủ.'
  } finally {
    submitting.value = false
  }
}
const hasUnsavedModerationChanges = computed(() => {
  return Boolean(showLawEditForm.value || showApproveConfirm.value || (isActionable.value && String(reviewNote.value || '').trim().length > 0))
})

// Phân biệt "Đề xuất cảnh báo rà soát văn bản" (crawler không tự đoán ngưỡng) với "Đề xuất sửa đổi ngưỡng quy tắc"
const isReviewAlertCandidate = computed(() => {
  if (props.recordType !== 'candidate' || semanticType.value !== 'rule') return false
  const p = props.detail?.candidate?.proposed_data || {}
  const diff = props.detail?.candidate?.diff_summary || {}
  const hasQuant = p.min_value !== undefined || p.min !== undefined || p.project_group || p.projectGroup || p.legal_doc_required || p.hs
  return !hasQuant && Boolean(diff.requiresAdminThresholdVerification || Array.isArray(p.matchedClauses) || p.note)
})
</script>

<template>
  <LegalDetailModal
    :open="open"
    mode="custom"
    :title="recordHeaderTitle"
    :typeBadge="recordTypeBadge"
    :statusLabel="getStatusMeta(currentStatusCode).label"
    :statusClass="getStatusMeta(currentStatusCode).cls"
    :loading="loading"
    :hasUnsavedChanges="hasUnsavedModerationChanges"
    maxWidth="1200px"
    @close="emit('close')"
  >
    <!-- Nội dung 2 cột trên desktop nằm chính giữa màn hình -->
    <div v-if="detail" class="mod-drawer-body" style="padding:0">
        <!-- ================================================================ -->
        <!-- CỘT TRÁI: NỘI DUNG DỮ LIỆU                                       -->
        <!-- ================================================================ -->
        <div>
          <!-- 8.3. CHI TIẾT VĂN BẢN PHÁP LUẬT -->
          <template v-if="recordType === 'law' && detail.law">
            <div class="mod-col-card">
              <div class="mod-col-title">
                <span>Thông tin văn bản pháp luật</span>
                <div style="display:flex;gap:8px">
                  <button v-if="isActionable" type="button" class="btn-secondary btn-sm" @click="showLawEditForm = !showLawEditForm">
                    <i class="ti ti-edit"></i>
                    <span>{{ showLawEditForm ? 'Đóng chỉnh sửa' : 'Chỉnh sửa thông tin' }}</span>
                  </button>
                  <a v-if="detail.law.link" :href="detail.law.link" target="_blank" rel="noopener noreferrer" class="btn-secondary btn-sm" style="text-decoration:none">
                    <i class="ti ti-external-link"></i>
                    <span>Mở nguồn gốc</span>
                  </a>
                </div>
              </div>

              <div v-if="!showLawEditForm" class="mod-kv-grid">
                <div>
                  <div class="mod-kv-label">Số hiệu văn bản</div>
                  <div class="mod-kv-value" style="color:var(--accent);font-weight:700">{{ detail.law.so || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Cơ quan ban hành</div>
                  <div class="mod-kv-value">{{ detail.law.issuing_agency || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Ngày ban hành</div>
                  <div class="mod-kv-value">{{ detail.law.issued_date || detail.law.year || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Ngày bắt đầu có hiệu lực</div>
                  <div class="mod-kv-value">{{ detail.law.effective_date || detail.law.hieuluc || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Nguồn phát hiện</div>
                  <div class="mod-kv-value">{{ detail.law.detection_source_label || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Đường dẫn văn bản gốc</div>
                  <div class="mod-kv-value">
                    <a v-if="detail.law.link" :href="detail.law.link" target="_blank" rel="noopener noreferrer" style="color:var(--accent);text-decoration:underline;font-size:12.5px">
                      {{ detail.law.link }}
                    </a>
                    <span v-else style="color:var(--text3)">Chưa có đường dẫn</span>
                  </div>
                </div>
              </div>

              <!-- Form chỉnh sửa metadata văn bản (nếu quản trị viên mở) -->
              <div v-else class="form-grid-2" style="gap:10px">
                <div class="form-group">
                  <label class="form-label">Số hiệu văn bản</label>
                  <input type="text" v-model="lawMetadataPatch.so" />
                </div>
                <div class="form-group">
                  <label class="form-label">Cơ quan ban hành</label>
                  <input type="text" v-model="lawMetadataPatch.issuing_agency" />
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày ban hành</label>
                  <input type="date" v-model="lawMetadataPatch.issued_date" />
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày hiệu lực</label>
                  <input type="date" v-model="lawMetadataPatch.effective_date" />
                </div>
                <div class="form-group" style="grid-column:1 / -1">
                  <label class="form-label">Tên văn bản</label>
                  <input type="text" v-model="lawMetadataPatch.ten" />
                </div>
                <div class="form-group" style="grid-column:1 / -1">
                  <label class="form-label">Đường dẫn nguồn gốc</label>
                  <input type="text" v-model="lawMetadataPatch.link" />
                </div>
              </div>

              <div v-if="detail.law.mo_ta" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
                <div class="mod-kv-label">Tóm tắt nội dung</div>
                <div style="font-size:13px;color:var(--text2);line-height:1.55">{{ detail.law.mo_ta }}</div>
              </div>
            </div>

            <!-- Điều khoản đã thu thập -->
            <div class="mod-col-card">
              <div class="mod-col-title">
                <span>Nội dung điều khoản đã thu thập ({{ (detail.law.dieu_khoang || []).length }})</span>
              </div>
              <div v-if="!(detail.law.dieu_khoang || []).length" style="font-size:13px;color:var(--text3)">
                Chưa có nội dung điều khoản chi tiết trong cơ sở dữ liệu.
              </div>
              <div v-else style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:8px">
                <div v-for="(cl, idx) in detail.law.dieu_khoang.slice(0, 30)" :key="idx" style="padding:10px 12px;background:var(--bg);border-radius:var(--radius);border:1px solid var(--border)">
                  <div style="font-size:12.5px;font-weight:700;color:var(--accent)">{{ cl.tieu_de || `Điều khoản #${idx + 1}` }}</div>
                  <div style="font-size:12.5px;color:var(--text2);margin-top:3px;line-height:1.5">{{ cl.noi_dung || cl }}</div>
                </div>
              </div>
            </div>

            <!-- Quy tắc liên quan -->
            <div class="mod-col-card">
              <div class="mod-col-title">
                <span>Quy tắc phân loại &amp; Tác động liên quan ({{ (detail.relatedThresholds || []).length }})</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
                Lưu ý nghiệp vụ: Phê duyệt văn bản pháp luật không tự động thay đổi các quy tắc phân loại hiện hành.
              </div>
              <div v-if="!(detail.relatedThresholds || []).length" style="font-size:13px;color:var(--text3)">
                Chưa ghi nhận quy tắc phân loại nào liên kết trực tiếp với văn bản này.
              </div>
              <div v-else style="max-height:170px;overflow-y:auto;display:flex;flex-direction:column;gap:6px">
                <div v-for="rt in detail.relatedThresholds.slice(0, 15)" :key="rt.id" style="font-size:12.5px;padding:6px 10px;background:var(--bg);border-radius:6px;display:flex;justify-content:space-between;gap:8px">
                  <span><strong>#{{ rt.id }}</strong> · {{ rt.industry_name }} ({{ rt.project_group }} – {{ rt.legal_doc_required }})</span>
                  <span class="mod-status-badge" :class="getStatusMeta(rt.verification_status).cls" style="font-size:11px;padding:1px 8px">
                    {{ getStatusMeta(rt.verification_status).label }}
                  </span>
                </div>
              </div>
            </div>
          </template>

          <!-- 8.1. CHI TIẾT QUY TẮC PHÂN LOẠI & BẢNG SO SÁNH TRƯỚC / SAU -->
          <template v-else-if="semanticType === 'rule'">
            <!-- Trường hợp 1: Cảnh báo rà soát từ trình thu thập tự động (chưa có ngưỡng định lượng) -->
            <div v-if="isReviewAlertCandidate" class="mod-col-card">
              <div class="mod-col-title">
                <span>Thông tin rà soát tiêu chí phân loại từ văn bản</span>
                <span class="chip chip-warning" style="font-size:11px">Cần đối chiếu thủ công</span>
              </div>

              <div style="padding:10px 12px;border-radius:var(--radius);background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12.5px;line-height:1.5;margin-bottom:14px">
                <strong>Vì sao chưa có ngưỡng công suất / nhóm dự án?</strong> Hệ thống thu thập tự động chỉ phát hiện từ khóa liên quan đến phân loại &amp; thủ tục môi trường trong văn bản, tuyệt đối không tự suy đoán số liệu ngưỡng để bảo đảm an toàn pháp lý.
              </div>

              <div class="mod-kv-grid" style="margin-bottom:12px">
                <div>
                  <div class="mod-kv-label">Căn cứ văn bản phát hiện</div>
                  <div class="mod-kv-value" style="color:var(--accent);font-weight:700">
                    {{ detail.candidate?.proposed_data?.sourceDocument || detail.candidate?.law_title || detail.candidate?.law_id || '—' }}
                  </div>
                </div>
                <div>
                  <div class="mod-kv-label">Số điều khoản liên quan</div>
                  <div class="mod-kv-value">
                    {{ detail.candidate?.diff_summary?.matchedClauseCount ?? (detail.candidate?.proposed_data?.matchedClauses?.length || 0) }} điều khoản
                  </div>
                </div>
              </div>

              <div v-if="detail.candidate?.proposed_data?.matchedClauses?.length" style="margin-bottom:12px">
                <div class="mod-kv-label" style="margin-bottom:6px">Các điều khoản / phụ lục được phát hiện</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px">
                  <span v-for="(cl, idx) in detail.candidate.proposed_data.matchedClauses" :key="idx" class="chip chip-gray" style="font-size:12px">
                    {{ cl }}
                  </span>
                </div>
              </div>

              <div v-if="detail.candidate?.proposed_data?.note" style="margin-bottom:12px;font-size:13px;color:var(--text2)">
                <strong>Ghi chú hệ thống:</strong> {{ detail.candidate.proposed_data.note }}
              </div>

              <div v-if="detail.candidate?.source_excerpt" style="padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
                <div class="mod-kv-label" style="margin-bottom:6px">Trích đoạn nội dung phát hiện</div>
                <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--text2);line-height:1.55">
                  <div v-for="(line, lIdx) in formatLegalTextLines(detail.candidate.source_excerpt)" :key="lIdx">
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Trường hợp 2: Quy tắc cụ thể hoặc Đề xuất sửa đổi ngưỡng có số liệu -->
            <div v-else class="mod-col-card">
              <div class="mod-col-title">
                <span>So sánh Giá trị hiện tại &amp; Giá trị đề xuất</span>
                <button
                  v-if="recordType === 'threshold' && detail.rule"
                  type="button"
                  class="btn-secondary btn-sm"
                  @click="emit('open-proposal', detail.rule)"
                >
                  <i class="ti ti-git-pull-request"></i>
                  <span>Tạo đề xuất điều chỉnh mới</span>
                </button>
              </div>

              <div v-if="recordType === 'threshold' && detail.rule" style="font-size:12.5px;color:var(--text2);margin-bottom:12px">
                Ngành nghề: <strong>{{ detail.rule.industry_name || detail.rule.industry_code }}</strong> · Phụ lục: <strong>{{ detail.rule.phu_luc || '—' }}</strong> · Văn bản liên quan: <code>{{ detail.rule.law_id || 'vbhn_49_2026' }}</code>
              </div>

              <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius)">
                <table class="mod-diff-table">
                  <thead>
                    <tr>
                      <th style="width:28%">Tiêu chí quy tắc</th>
                      <th style="width:36%">Giá trị hiện tại</th>
                      <th style="width:36%">Giá trị đề xuất / Áp dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in ruleDiffRows" :key="row.label" :class="{ 'is-changed': row.changed }">
                      <td style="font-weight:600;color:var(--text2)">
                        {{ row.label }}
                        <span v-if="row.changed" style="display:inline-block;margin-left:4px;font-size:10.5px;color:#9A6700;font-weight:700">● Thay đổi</span>
                      </td>
                      <td>{{ row.oldVal }}</td>
                      <td class="mod-diff-new">{{ row.newVal }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-if="recordType === 'candidate' && detail.candidate?.source_excerpt" style="margin-top:12px;padding:10px 12px;background:var(--bg);border-radius:var(--radius);font-size:12.5px;color:var(--text2)">
                <strong>Trích dẫn nguồn / Lý do đề xuất:</strong>
                <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;line-height:1.5">
                  <div v-for="(line, lIdx) in formatLegalTextLines(detail.candidate.source_excerpt)" :key="lIdx">
                    {{ line }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="detail.relatedLaw" class="mod-col-card">
              <div class="mod-col-title"><span>Văn bản pháp luật tham chiếu</span></div>
              <div class="mod-kv-grid">
                <div>
                  <div class="mod-kv-label">Số hiệu</div>
                  <div class="mod-kv-value" style="color:var(--accent);font-weight:700">{{ detail.relatedLaw.so }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Hiệu lực</div>
                  <div class="mod-kv-value">{{ detail.relatedLaw.hieuluc || 'Đang có hiệu lực' }}</div>
                </div>
                <div style="grid-column:1 / -1">
                  <div class="mod-kv-label">Tên văn bản</div>
                  <div class="mod-kv-value">{{ detail.relatedLaw.ten }}</div>
                </div>
              </div>
            </div>
          </template>

          <!-- 8.2. CHI TIẾT QCVN & BẢNG CON DANH SÁCH THÔNG SỐ MÔI TRƯỜNG -->
          <template v-else-if="semanticType === 'qcvn'">
            <div class="mod-col-card">
              <div class="mod-col-title"><span>Thông tin quy chuẩn kỹ thuật (QCVN)</span></div>
              <div class="mod-kv-grid">
                <div>
                  <div class="mod-kv-label">Mã quy chuẩn</div>
                  <div class="mod-kv-value"><code>{{ detail.qcvn?.id || detail.candidate?.target_code }}</code></div>
                </div>
                <div>
                  <div class="mod-kv-label">Nhóm lĩnh vực</div>
                  <div class="mod-kv-value">
                    {{ getDomainLabel(detail.qcvn?.source_type || detail.candidate?.proposed_data?.source_type) }}
                    <span v-if="detail.qcvn?.column_code"> · Cột {{ detail.qcvn.column_code }}</span>
                  </div>
                </div>
                <div style="grid-column:1 / -1">
                  <div class="mod-kv-label">Căn cứ pháp lý ban hành</div>
                  <div class="mod-kv-value" style="display:flex;flex-direction:column;gap:5px;line-height:1.55;margin-top:4px">
                    <div v-for="(line, lIdx) in formatLegalTextLines(detail.qcvn?.source_document || detail.candidate?.source_excerpt || 'Chưa cập nhật')" :key="lIdx">
                      {{ line }}
                    </div>
                  </div>
                </div>
                <div>
                  <div class="mod-kv-label">Thời gian hiệu lực</div>
                  <div class="mod-kv-value">
                    {{ detail.qcvn?.effective_from || '—' }} → {{ detail.qcvn?.effective_to || 'Hiện hành' }}
                  </div>
                </div>
              </div>
            </div>

            <div class="mod-col-card">
              <div class="mod-col-title">
                <span>Danh sách thông số môi trường áp dụng ({{ qcvnParamRows.length }} thông số)</span>
              </div>
              <div v-if="qcvnParamRows.length === 0" style="font-size:13px;color:var(--text3)">
                Chưa có danh sách thông số chi tiết trong bản ghi này.
              </div>
              <div v-else style="max-height:360px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius)">
                <table class="mod-diff-table">
                  <thead>
                    <tr>
                      <th style="width:46px">STT</th>
                      <th>Thông số</th>
                      <th style="width:130px">{{ recordType === 'candidate' ? 'Giá trị cũ' : 'Giá trị giới hạn' }}</th>
                      <th v-if="recordType === 'candidate'" style="width:130px">Giá trị đề xuất</th>
                      <th style="width:85px">Đơn vị</th>
                      <th style="width:115px">Điều kiện</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in qcvnParamRows" :key="p.idx" :class="{ 'is-changed': p.changed }">
                      <td>{{ p.idx }}</td>
                      <td>
                        <div style="font-weight:600;color:var(--text)">{{ p.ten }}</div>
                        <div style="font-size:11px;color:var(--text3)">Mã: <code>{{ p.key }}</code></div>
                      </td>
                      <td style="font-weight:600;color:var(--accent)">{{ p.oldLimit }}</td>
                      <td v-if="recordType === 'candidate'" class="mod-diff-new">{{ p.newLimit }}</td>
                      <td>{{ p.unit }}</td>
                      <td style="font-size:12px;color:var(--text2)">{{ p.period }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <!-- ================================================================ -->
        <!-- CỘT PHẢI: KIỂM DUYỆT, CHECKLIST LƯU DB THẬT & THAO TÁC           -->
        <!-- ================================================================ -->
        <div>
          <!-- Thông tin trạng thái & người thực hiện -->
          <div class="mod-col-card">
            <div class="mod-col-title"><span>Thông tin kiểm duyệt</span></div>
            <div class="mod-kv-grid">
              <div>
                <div class="mod-kv-label">Trạng thái hiện tại</div>
                <div style="margin-top:2px">
                  <span class="mod-status-badge" :class="getStatusMeta(currentStatusCode).cls">
                    {{ getStatusMeta(currentStatusCode).label }}
                  </span>
                </div>
              </div>
              <div>
                <div class="mod-kv-label">Người đề xuất / Nguồn</div>
                <div class="mod-kv-value">{{ proposerName }}</div>
              </div>
              <div style="grid-column:1 / -1">
                <div class="mod-kv-label">Người kiểm duyệt gần nhất</div>
                <div class="mod-kv-value">{{ reviewerName }}</div>
              </div>
            </div>
          </div>

          <!-- Mục 9: Danh mục kiểm tra hỗ trợ người kiểm duyệt (Lưu thật vào PostgreSQL) -->
          <div class="mod-col-card">
            <div class="mod-col-title">
              <span>Danh mục kiểm tra xác minh ({{ checkedCount }}/{{ checklistItems.length }})</span>
              <span v-if="checklistSaveState === 'saving'" style="font-size:11.5px;color:var(--text3)">Đang lưu...</span>
              <span v-else-if="checklistSaveState === 'saved'" style="font-size:11.5px;color:var(--accent)">
                <i class="ti ti-check"></i> Đã lưu
              </span>
            </div>
            <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
              Danh mục kiểm tra chỉ hỗ trợ đối chiếu nghiệp vụ, không tự động xác nhận tính đúng đắn pháp lý.
            </div>
            <div style="display:flex;flex-direction:column;gap:2px">
              <label
                v-for="item in checklistItems"
                :key="item.key"
                class="mod-checklist-item"
                :class="{ 'is-checked': Boolean(checklistState[item.key]) }"
              >
                <input
                  type="checkbox"
                  :checked="Boolean(checklistState[item.key])"
                  @change="onToggleChecklist(item.key, $event.target.checked)"
                />
                <span>{{ item.label }}</span>
              </label>
            </div>
          </div>

          <!-- Mục 10: Nhận xét & 3 Hành động kiểm duyệt -->
          <div class="mod-col-card">
            <div class="mod-col-title"><span>Quyết định kiểm duyệt</span></div>

            <template v-if="isActionable">
              <div v-if="recordType !== 'law'" class="form-group" style="margin-bottom:10px">
                <label class="form-label">Căn cứ pháp lý (Điều, khoản, thông tư) *</label>
                <input
                  type="text"
                  v-model="legalBasisInput"
                  placeholder="VD: Phụ lục III NĐ 08/2022/NĐ-CP (49/VBHN-BNNMT)..."
                />
              </div>

              <div v-if="recordType === 'threshold' || recordType === 'qcvn'" class="form-grid-2" style="gap:10px;margin-bottom:10px">
                <div class="form-group">
                  <label class="form-label">Hiệu lực từ <span v-if="recordType === 'threshold'">*</span></label>
                  <input type="date" v-model="effectiveFromInput" />
                </div>
                <div class="form-group">
                  <label class="form-label">Hiệu lực đến</label>
                  <input type="date" v-model="effectiveToInput" />
                </div>
              </div>

              <div class="form-group" style="margin-bottom:8px">
                <label class="form-label">Nhận xét / Lý do kiểm duyệt (Bắt buộc khi Từ chối hoặc Yêu cầu bổ sung)</label>
                <textarea
                  v-model="reviewNote"
                  rows="3"
                  placeholder="Nhập ghi chú đối chiếu pháp lý, lý do từ chối hoặc nội dung yêu cầu bổ sung..."
                ></textarea>
              </div>

              <div v-if="actionError" style="margin-bottom:10px;padding:8px 12px;border-radius:var(--radius);background:var(--red-bg);border:1px solid var(--danger-border);color:var(--red);font-size:12.5px">
                {{ actionError }}
              </div>

              <div class="mod-drawer-actions">
                <button type="button" class="btn-primary" style="width:100%;justify-content:center;height:40px" :disabled="submitting" @click="requestApprove">
                  <i class="ti ti-circle-check"></i>
                  <span>Phê duyệt</span>
                </button>
                <div class="mod-action-row">
                  <button type="button" class="btn-action-delete" style="justify-content:center;height:36px" :disabled="submitting" @click="executeDecision('tu_choi')">
                    <i class="ti ti-circle-x"></i>
                    <span>Từ chối</span>
                  </button>
                  <button type="button" class="btn-secondary" style="justify-content:center;height:36px" :disabled="submitting" @click="executeDecision('can_bo_sung')">
                    <i class="ti ti-message-plus"></i>
                    <span>Yêu cầu bổ sung</span>
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <div style="padding:12px;border-radius:var(--radius);background:var(--bg);border:1px solid var(--border);font-size:13px;color:var(--text2)">
                Bản ghi này đang ở trạng thái <strong>{{ getStatusMeta(currentStatusCode).label }}</strong>.
                <div v-if="reviewNote" style="margin-top:6px">
                  <strong>Ghi chú kiểm duyệt:</strong> {{ reviewNote }}
                </div>
              </div>
            </template>
          </div>

          <!-- Lịch sử xử lý -->
          <div class="mod-col-card">
            <div class="mod-col-title"><span>Lịch sử xử lý ({{ timelineItems.length }})</span></div>
            <div v-if="timelineItems.length === 0" style="font-size:12.5px;color:var(--text3)">
              Chưa ghi nhận lịch sử xử lý trước đó.
            </div>
            <div v-else class="mod-timeline">
              <div v-for="(ev, i) in timelineItems" :key="i" class="mod-timeline-item">
                <div><strong>{{ ev.actor }}</strong> · <span style="color:var(--text3)">{{ formatDateTime(ev.time) }}</span></div>
                <div style="color:var(--text2);margin-top:2px">{{ ev.text }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    <!-- HỘP THOẠI XÁC NHẬN PHÊ DUYỆT (Mục 10: Không phê duyệt chỉ bằng 1 cú nhấn) -->
    <div v-if="showApproveConfirm" class="modal-overlay" style="z-index:1300" @click.self="showApproveConfirm = false">
      <div class="modal-card fade-up" style="width:520px;max-width:94vw">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;display:flex;align-items:center;gap:8px">
            <i class="ti ti-shield-check" style="color:var(--accent)"></i>
            <span>Xác nhận phê duyệt dữ liệu pháp lý</span>
          </h3>
          <button type="button" class="drawer-close-btn" @click="showApproveConfirm = false">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <div style="padding:12px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:14px;font-size:13px;display:flex;flex-direction:column;gap:6px">
          <div><strong>Đối tượng:</strong> {{ recordHeaderTitle }}</div>
          <div><strong>Loại dữ liệu:</strong> {{ recordTypeBadge }}</div>
          <div v-if="legalBasisInput"><strong>Căn cứ pháp lý:</strong> {{ legalBasisInput }}</div>
          <div v-if="effectiveFromInput"><strong>Ngày hiệu lực:</strong> {{ effectiveFromInput }}</div>
          <div><strong>Tiến độ kiểm tra đối chiếu:</strong> {{ checkedCount }}/{{ checklistItems.length }} mục đã đánh dấu</div>
        </div>

        <div style="padding:10px 12px;background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--radius);font-size:12.5px;color:#8A5A00;margin-bottom:16px;line-height:1.5">
          <strong>Lưu ý trước khi phê duyệt:</strong> Vui lòng kiểm tra lại chính xác số hiệu văn bản, căn cứ pháp lý và ngày hiệu lực.
          <span v-if="recordType === 'law'"> Phê duyệt văn bản sẽ không tự động thay đổi các quy tắc phân loại hiện hành.</span>
          <span v-else> Sau khi phê duyệt, dữ liệu này sẽ được áp dụng chính thức trong hệ thống và ghi vào nhật ký kiểm toán.</span>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button type="button" class="btn-secondary" :disabled="submitting" @click="showApproveConfirm = false">Quay lại kiểm tra</button>
          <button type="button" class="btn-primary" :disabled="submitting" @click="executeDecision('da_xac_minh')">
            <i class="ti ti-check"></i>
            <span>{{ submitting ? 'Đang xử lý...' : 'Xác nhận phê duyệt chính thức' }}</span>
          </button>
        </div>
      </div>
    </div>
  </LegalDetailModal>
</template>
