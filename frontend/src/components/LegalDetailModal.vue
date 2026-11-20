<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { API, LAW_BASE_URL } from '../utils/constants.js'
import { normalizeString } from '../utils/string-helpers.js'
import {
  getLawTypeLabelVi,
  getQcvnDomainLabel,
  getModerationStatusMeta,
  getConclusionStatusMeta,
  getRuleSourceLabel,
  formatLegalTextLines,
} from '../utils/legalLabels.js'

const props = defineProps({
  open: { type: Boolean, default: false },
  mode: { type: String, default: 'custom' }, // 'law' | 'classification_basis' | 'qcvn' | 'custom'
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  typeBadge: { type: String, default: '' },
  statusLabel: { type: String, default: '' },
  statusClass: { type: String, default: '' },
  law: { type: Object, default: null },
  classificationResult: { type: Object, default: null },
  initialLawId: { type: String, default: '' },
  qcvn: { type: Object, default: null },
  history: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hasUnsavedChanges: { type: Boolean, default: false },
  maxWidth: { type: String, default: '1200px' },
})

const emit = defineEmits(['close'])

// Danh sách văn bản dùng chung (tải 1 lần từ /api/laws khi mở chế độ căn cứ phân loại)
const lawsCatalog = ref([])
const lawsCatalogLoading = ref(false)
const lawsCatalogLoaded = ref(false)
const selectedBasisKey = ref('')

// Thu gọn / mở rộng và tìm kiếm điều khoản
const expandedProvisions = ref(new Set())
const provisionSearchQuery = ref('')

const ensureLawsCatalog = async () => {
  if (lawsCatalogLoaded.value || lawsCatalogLoading.value) return
  lawsCatalogLoading.value = true
  try {
    const res = await fetch(API.LAWS)
    if (res.ok) {
      const data = await res.json()
      lawsCatalog.value = Array.isArray(data) ? data : []
      lawsCatalogLoaded.value = true
    }
  } catch {
    // Giữ trạng thái rỗng nếu không tải được
  } finally {
    lawsCatalogLoading.value = false
  }
}

const getDirectLawLink = (lawObj) => {
  if (!lawObj) return LAW_BASE_URL || '#'
  if (lawObj.link && String(lawObj.link).startsWith('http')) return lawObj.link
  if (LAW_BASE_URL) {
    return `${LAW_BASE_URL}?q=${encodeURIComponent(lawObj.so || lawObj.ten || '')}`
  }
  return '#'
}

const getLawStatusMeta = (status) => {
  const s = String(status || '').toLowerCase()
  if (s === 'het_hieu_luc' || s === 'expired') return { label: 'Hết hiệu lực', cls: 'het_hieu_luc' }
  if (s === 'sap_hieu_luc' || s === 'upcoming') return { label: 'Sắp có hiệu lực', cls: 'sap_hieu_luc' }
  if (s === 'sua_doi' || s === 'amended') return { label: 'Có sửa đổi, bổ sung', cls: 'sua_doi' }
  return { label: 'Đang có hiệu lực', cls: 'con_hieu_luc' }
}

const getProvisionTitle = (d) => {
  const raw = typeof d === 'string' ? d : (d && typeof d === 'object' && d.tieu_de ? d.tieu_de : String(d || ''))
  return String(raw).replace(/[⭐⚠️🌟]/g, '').trim()
}

const getProvisionContent = (d) => {
  if (typeof d === 'string') return null
  if (d && typeof d === 'object' && d.noi_dung) return d.noi_dung
  return null
}

const inferAgencyFallback = (lawObj) => {
  if (!lawObj) return 'Chưa có thông tin trong cơ sở dữ liệu'
  if (lawObj.issuing_agency) return lawObj.issuing_agency
  const so = String(lawObj.so || '').toUpperCase()
  const type = String(lawObj.type || '').toLowerCase()
  if (so.includes('QH') || type === 'luat') return 'Quốc hội'
  if (so.includes('NĐ-CP') || so.includes('ND-CP') || type === 'nd') return 'Chính phủ'
  if (so.includes('BNNMT')) return 'Bộ Nông nghiệp và Môi trường'
  if (so.includes('BTNMT') || type === 'tt' || type === 'qcvn' || type === 'vbhn') return 'Bộ Tài nguyên và Môi trường'
  if (so.includes('QĐ-TTG') || so.includes('QD-TTG')) return 'Thủ tướng Chính phủ'
  return 'Cơ quan nhà nước có thẩm quyền'
}

const findLawInCatalog = (lawId, refText = '') => {
  if (!lawsCatalog.value.length) return null
  const cleanId = String(lawId || '').trim().toLowerCase()
  if (cleanId) {
    const byId = lawsCatalog.value.find(l => String(l.id || '').toLowerCase() === cleanId)
    if (byId) return byId
    const bySo = lawsCatalog.value.find(l => String(l.so || '').toLowerCase() === cleanId)
    if (bySo) return bySo
  }
  const refNorm = normalizeString(refText || '')
  if (refNorm) {
    const byRefSo = lawsCatalog.value.find(l => l.so && refNorm.includes(normalizeString(l.so)))
    if (byRefSo) return byRefSo
  }
  return null
}

// Xây dựng danh sách căn cứ pháp lý gắn trực tiếp với kết quả phân loại
const classificationBases = computed(() => {
  const res = props.classificationResult
  if (!res) return []
  const items = []
  const seenKeys = new Set()

  const addBasis = ({ key, roleTitle, citation, reason, lawId, fallbackTitle }) => {
    const lawObj = findLawInCatalog(lawId, citation || fallbackTitle)
    const dedupKey = `${key}:${lawObj?.id || lawId || citation}`
    if (seenKeys.has(dedupKey)) return
    seenKeys.add(dedupKey)
    items.push({
      key: `${items.length}-${dedupKey}`,
      roleTitle,
      citation: citation || 'Theo quy định pháp luật hiện hành',
      reason,
      lawId: lawObj?.id || lawId || null,
      law: lawObj,
      fallbackTitle: fallbackTitle || lawObj?.ten || citation || 'Căn cứ pháp lý',
    })
  }

  // 1. Căn cứ xác định nhóm dự án, ngưỡng & loại hồ sơ
  if (res.ref || res.ref_law_id || res.phuluc) {
    const rationaleSummary = res.classificationRationale?.summaryText || ''
    addBasis({
      key: 'primary-threshold',
      roleTitle: 'Căn cứ xác định nhóm dự án & loại hồ sơ',
      citation: [res.ref, res.phuluc && res.phuluc !== '—' ? res.phuluc : null].filter(Boolean).join(' · '),
      reason: rationaleSummary
        ? `Hệ thống đối chiếu ngành nghề và quy mô đầu vào (${rationaleSummary}) để xác định nhóm dự án (${res.nhom || 'Chưa xác định'}) và hồ sơ (${res.hs || 'Chưa xác định'}).`
        : 'Căn cứ trực tiếp từ bảng ngưỡng phân loại và phụ lục pháp lý tương ứng.',
      lawId: res.ref_law_id,
      fallbackTitle: res.ref || res.phuluc,
    })
  }

  // 2. Căn cứ điều chỉnh nâng nhóm (nếu có)
  if (Array.isArray(res.nangNhom)) {
    res.nangNhom.forEach((adj, idx) => {
      addBasis({
        key: `escalation-${idx}`,
        roleTitle: 'Căn cứ điều chỉnh nâng nhóm dự án',
        citation: adj.ref || adj.text,
        reason: adj.text || 'Yếu tố nhạy cảm môi trường / quy định điều chỉnh phân loại.',
        lawId: adj.law_id || res.ref_law_id,
        fallbackTitle: adj.ref || adj.text,
      })
    })
  }

  // 3. Căn cứ xác định thẩm quyền
  const authBasis = res.competentAuthority?.legalBasis
  if (Array.isArray(authBasis) && authBasis.length) {
    addBasis({
      key: 'authority',
      roleTitle: 'Căn cứ xác định thẩm quyền giải quyết',
      citation: authBasis.join(' · '),
      reason: `Xác định cơ quan có thẩm quyền (${res.coQuan || res.competentAuthority?.competentAgency || 'Theo phân cấp'}) đối với ${res.nhom || 'dự án'}.`,
      lawId: 'luat_bvmt_2020',
      fallbackTitle: authBasis[0],
    })
  }

  // 4. Căn cứ thủ tục / nghĩa vụ môi trường
  if (Array.isArray(res.obligationDetails) && res.obligationDetails.length) {
    res.obligationDetails.forEach((ob, idx) => {
      const obRefs = Array.isArray(ob.legalBasis) ? ob.legalBasis.join(' · ') : ''
      if (!obRefs) return
      addBasis({
        key: `obligation-${idx}`,
        roleTitle: `Căn cứ thủ tục ${ob.title || ob.code || 'môi trường'}`,
        citation: obRefs,
        reason: ob.description || `Căn cứ xác định đối tượng thực hiện ${ob.title || ob.code}.`,
        lawId: obRefs.includes('08/2022') ? 'nd_08_2022' : (obRefs.includes('05/2025') ? 'nd_05_2025' : 'luat_bvmt_2020'),
        fallbackTitle: ob.title || obRefs,
      })
    })
  }

  // 5. Hệ thống văn bản pháp lý áp dụng (res.lr)
  if (Array.isArray(res.lr)) {
    res.lr.forEach((r, idx) => {
      addBasis({
        key: `lr-${idx}-${r.law_id || r.num}`,
        roleTitle: 'Văn bản pháp lý áp dụng',
        citation: r.num,
        reason: r.desc || 'Văn bản quy phạm pháp luật làm cơ sở cho kết luận phân loại.',
        lawId: r.law_id,
        fallbackTitle: r.num,
      })
    })
  }

  return items
})

const activeBasisItem = computed(() => {
  if (!classificationBases.value.length) return null
  return classificationBases.value.find(b => b.key === selectedBasisKey.value) || classificationBases.value[0]
})

// Văn bản đang hiển thị điều khoản (dùng chung cho mode === 'law' và tab đang chọn của 'classification_basis')
const activeLawObject = computed(() => {
  if (props.mode === 'law') return props.law
  if (props.mode === 'classification_basis') return activeBasisItem.value?.law || null
  return null
})

// Lọc các điều khoản liên quan nếu có từ khóa viện dẫn trong kết quả phân loại
const citedKeywords = computed(() => {
  if (props.mode !== 'classification_basis' || !activeBasisItem.value) return []
  const text = `${activeBasisItem.value.citation || ''} ${props.classificationResult?.ref || ''} ${props.classificationResult?.phuluc || ''}`
  const matches = text.match(/(Điều\s+\d+|Phụ lục\s+[IVX0-9]+|Khoản\s+\d+)/gi) || []
  return Array.from(new Set(matches.map(m => normalizeString(m))))
})

const isClauseDirectlyCited = (clause) => {
  if (!citedKeywords.value.length) return false
  const titleNorm = normalizeString(getProvisionTitle(clause))
  const contentNorm = normalizeString(getProvisionContent(clause) || '')
  return citedKeywords.value.some(kw => titleNorm.includes(kw) || contentNorm.includes(kw))
}

const filteredProvisionsWithIndex = computed(() => {
  const lawObj = activeLawObject.value
  if (!lawObj || !Array.isArray(lawObj.dieu_khoang)) return []
  const q = normalizeString(provisionSearchQuery.value.trim())
  return lawObj.dieu_khoang.map((d, index) => ({ d, index })).filter(({ d }) => {
    if (!q) return true
    const title = normalizeString(getProvisionTitle(d))
    const content = normalizeString(getProvisionContent(d) || '')
    return title.includes(q) || content.includes(q)
  })
})

const toggleProvision = (idx) => {
  const next = new Set(expandedProvisions.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  expandedProvisions.value = next
}

const isProvisionExpanded = (idx) => expandedProvisions.value.has(idx)

const expandAllProvisions = () => {
  const list = activeLawObject.value?.dieu_khoang || []
  expandedProvisions.value = new Set(list.map((_, idx) => idx))
}

const collapseAllProvisions = () => {
  expandedProvisions.value = new Set()
}

// Danh sách thông số cho chế độ QCVN
const qcvnParameterRows = computed(() => {
  const q = props.qcvn
  if (!q) return []
  const params = Array.isArray(q.parameters) ? q.parameters : []
  return params.map((p, idx) => ({
    key: p.code || p.ten || idx,
    name: p.ten || p.name || p.code || `Chỉ tiêu #${idx + 1}`,
    unit: p.unit || '—',
    period: p.averagingPeriod || p.period || '—',
    limitDisplay: p.limitDisplay
      || (p.min !== undefined && p.max !== undefined ? `${p.min} – ${p.max}` : (p.max !== undefined ? `≤ ${p.max}` : (p.colA !== undefined ? `Cột A: ${p.colA} · Cột B: ${p.colB ?? '—'}` : 'Theo bảng quy chuẩn'))),
  }))
})

// Tiêu đề, nhãn loại và trạng thái tổng hợp ở Header
const resolvedTitle = computed(() => {
  if (props.title) return props.title
  if (props.mode === 'law' && props.law) return props.law.ten || props.law.so || 'Chi tiết văn bản pháp luật'
  if (props.mode === 'classification_basis') return 'Căn cứ pháp lý áp dụng cho kết quả phân loại'
  if (props.mode === 'qcvn' && props.qcvn) return `${props.qcvn.applicableStandard || props.qcvn.ten || props.qcvn.id}`
  return 'Chi tiết dữ liệu pháp lý'
})

const resolvedTypeBadge = computed(() => {
  if (props.typeBadge) return props.typeBadge
  if (props.mode === 'law' && props.law) return getLawTypeLabelVi(props.law.type)
  if (props.mode === 'classification_basis') return 'Căn cứ phân loại hồ sơ'
  if (props.mode === 'qcvn' && props.qcvn) return getQcvnDomainLabel(props.qcvn.sourceType || props.qcvn.source_type)
  return 'Thông tin pháp lý'
})

const resolvedStatusBadge = computed(() => {
  if (props.statusLabel) return { label: props.statusLabel, cls: props.statusClass || 'is-pending' }
  if (props.mode === 'law' && props.law) {
    const meta = getLawStatusMeta(props.law.status)
    return { label: meta.label, cls: meta.cls === 'het_hieu_luc' ? 'is-rejected' : (meta.cls === 'con_hieu_luc' ? 'is-approved' : 'is-pending') }
  }
  if (props.mode === 'classification_basis' && props.classificationResult) {
    const cm = getConclusionStatusMeta(props.classificationResult.conclusionStatus || props.classificationResult.verificationStatus)
    return { label: cm.short, cls: cm.tone === 'success' ? 'is-approved' : 'is-pending' }
  }
  if (props.mode === 'qcvn' && props.qcvn) {
    const st = getModerationStatusMeta(props.qcvn.verificationStatus || props.qcvn.verification_status)
    return { label: st.label, cls: st.cls }
  }
  return null
})

// Tự động khởi tạo trạng thái điều khoản & căn cứ khi mở modal
watch(() => [props.open, props.mode, props.law, props.initialLawId, props.classificationResult], async () => {
  if (!props.open) return
  provisionSearchQuery.value = ''
  if (props.mode === 'classification_basis') {
    await ensureLawsCatalog()
    const targetId = String(props.initialLawId || '').trim().toLowerCase()
    const matched = targetId
      ? classificationBases.value.find(b => String(b.lawId || '').toLowerCase() === targetId || String(b.law?.id || '').toLowerCase() === targetId)
      : null
    selectedBasisKey.value = matched?.key || classificationBases.value[0]?.key || ''
  }
}, { immediate: true })

watch(activeLawObject, (newLaw) => {
  expandedProvisions.value = new Set()
  if (!newLaw || !Array.isArray(newLaw.dieu_khoang)) return
  const autoExpand = new Set()
  newLaw.dieu_khoang.forEach((d, idx) => {
    if (newLaw.dieu_khoang.length <= 2 || isClauseDirectlyCited(d)) {
      autoExpand.add(idx)
    }
  })
  expandedProvisions.value = autoExpand
}, { immediate: true })

// Khóa cuộn trang nền khi modal đang mở để giữ nguyên vị trí cuộn
watch(() => props.open, (isOpen) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = isOpen ? 'hidden' : ''
}, { immediate: true })

const attemptClose = (fromBackdropOrEsc = false) => {
  if (fromBackdropOrEsc && props.hasUnsavedChanges) {
    if (!window.confirm('Bạn đang có nội dung chỉnh sửa hoặc ghi chú chưa lưu. Bạn có chắc chắn muốn đóng cửa sổ này không?')) {
      return
    }
  }
  emit('close')
}

const handleKeydown = (e) => {
  if (!props.open) return
  if (e.key === 'Escape') {
    e.stopPropagation()
    attemptClose(true)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="legal-modal-overlay" @click.self="attemptClose(true)">
      <div class="legal-modal-card fade-up" :style="{ width: `min(${maxWidth}, 92vw)` }" role="dialog" aria-modal="true" :aria-label="resolvedTitle">
        <!-- Đầu Modal cố định -->
        <div class="legal-modal-head">
          <div style="min-width:0;flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
              <span class="chip chip-gray" style="font-size:11.5px">{{ resolvedTypeBadge }}</span>
              <span v-if="resolvedStatusBadge" class="mod-status-badge" :class="resolvedStatusBadge.cls">
                {{ resolvedStatusBadge.label }}
              </span>
              <span v-if="mode === 'law' && law?.year" style="font-size:12px;color:var(--text3);font-weight:500">
                Năm ban hành: {{ law.year }}
              </span>
              <slot name="header-meta"></slot>
            </div>
            <h3 style="font-size:18px;font-weight:700;color:var(--text);margin:0;line-height:1.35">
              {{ resolvedTitle }}
            </h3>
            <div v-if="subtitle" style="font-size:12.5px;color:var(--text3);margin-top:4px">
              {{ subtitle }}
            </div>
          </div>

          <button type="button" class="drawer-close-btn" title="Đóng (Esc)" @click="attemptClose(false)">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <!-- Thân Modal cuộn độc lập -->
        <div v-if="loading || (mode === 'classification_basis' && lawsCatalogLoading)" class="legal-modal-body" style="display:flex;align-items:center;justify-content:center;min-height:240px;color:var(--text3);gap:10px">
          <i class="ti ti-loader-2" style="font-size:22px"></i>
          <span>Đang tải chi tiết dữ liệu pháp lý...</span>
        </div>

        <div v-else class="legal-modal-body">
          <!-- CHẾ ĐỘ 1: CHI TIẾT VĂN BẢN PHÁP LUẬT -->
          <template v-if="mode === 'law' && law">
            <div class="mod-col-card">
              <div class="mod-col-title">
                <span>Thông tin tổng quan văn bản</span>
                <a :href="getDirectLawLink(law)" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm">
                  <span>Mở văn bản gốc</span>
                  <i class="ti ti-external-link"></i>
                </a>
              </div>
              <div class="mod-kv-grid">
                <div>
                  <div class="mod-kv-label">Số hiệu văn bản</div>
                  <div class="mod-kv-value">{{ law.so || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Cơ quan ban hành</div>
                  <div class="mod-kv-value">{{ inferAgencyFallback(law) }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Ngày ban hành</div>
                  <div class="mod-kv-value">{{ law.issued_date || law.year || '—' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Hiệu lực áp dụng</div>
                  <div class="mod-kv-value">{{ law.effective_date || law.hieuluc || 'Đang áp dụng' }}</div>
                </div>
              </div>

              <div v-if="law.mo_ta" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
                <div class="mod-kv-label">Mô tả tóm tắt</div>
                <p style="font-size:13.5px;color:var(--text2);line-height:1.6;margin:4px 0 0">{{ law.mo_ta }}</p>
              </div>

              <div v-if="law.note" style="margin-top:12px;padding:10px 14px;background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--radius);font-size:13px;color:var(--warn);display:flex;gap:8px;align-items:flex-start">
                <i class="ti ti-alert-triangle" style="font-size:16px;margin-top:2px"></i>
                <div><strong>Lưu ý:</strong> {{ law.note }}</div>
              </div>
            </div>

            <!-- Danh sách điều khoản -->
            <div class="mod-col-card">
              <div class="mod-col-title" style="flex-wrap:wrap;gap:8px">
                <span>
                  Điều khoản &amp; Phụ lục quy định
                  <span v-if="law.dieu_khoang?.length" style="font-weight:500;color:var(--text3)">
                    ({{ filteredProvisionsWithIndex.length }}/{{ law.dieu_khoang.length }} mục)
                  </span>
                </span>
                <div v-if="law.dieu_khoang?.length > 1" style="display:flex;gap:6px">
                  <button type="button" class="btn-secondary btn-sm" style="height:28px;font-size:11.5px" @click="expandAllProvisions">Mở rộng tất cả</button>
                  <button type="button" class="btn-secondary btn-sm" style="height:28px;font-size:11.5px" @click="collapseAllProvisions">Thu gọn tất cả</button>
                </div>
              </div>

              <div v-if="law.dieu_khoang?.length > 3" style="margin-bottom:10px;position:relative">
                <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
                <input type="text" v-model="provisionSearchQuery" placeholder="Tìm nhanh điều khoản (VD: Điều 28, Phụ lục II, quan trắc...)" style="padding-left:32px;height:34px;font-size:12.5px" />
              </div>

              <div v-if="!law.dieu_khoang || law.dieu_khoang.length === 0" style="padding:14px;background:var(--bg);border:1px dashed var(--border);border-radius:var(--radius);font-size:13px;color:var(--text3)">
                Hệ thống chưa có đủ nội dung điều khoản chi tiết của văn bản này trong cơ sở dữ liệu. Vui lòng mở văn bản gốc để xem toàn văn.
              </div>

              <div v-else-if="filteredProvisionsWithIndex.length === 0" style="padding:12px;font-size:13px;color:var(--text3)">
                Không tìm thấy điều khoản nào khớp với từ khóa "{{ provisionSearchQuery }}".
              </div>

              <div v-else style="display:flex;flex-direction:column;gap:8px">
                <div v-for="{ d, index } in filteredProvisionsWithIndex" :key="index" style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--surface)">
                  <button type="button" @click="toggleProvision(index)" style="width:100%;text-align:left;padding:10px 14px;background:var(--bg);border:none;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text)">
                    <span>{{ getProvisionTitle(d) }}</span>
                    <i class="ti" :class="isProvisionExpanded(index) ? 'ti-chevron-up' : 'ti-chevron-down'" style="color:var(--text3)"></i>
                  </button>
                  <div v-if="isProvisionExpanded(index)" style="padding:12px 14px;font-size:13px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:6px">
                    <template v-if="getProvisionContent(d)">
                      <div v-for="(line, lIdx) in formatLegalTextLines(getProvisionContent(d))" :key="lIdx">{{ line }}</div>
                    </template>
                    <div v-else>Chưa có nội dung trích xuất chi tiết cho mục này trong cơ sở dữ liệu.</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Lịch sử hiệu lực / phiên bản nếu có -->
            <div v-if="history && history.length" class="mod-col-card">
              <div class="mod-col-title"><span>Lịch sử hiệu lực &amp; Cập nhật ({{ history.length }})</span></div>
              <div class="mod-timeline">
                <div v-for="(h, i) in history" :key="i" class="mod-timeline-item">
                  <div><strong>{{ h.actor || 'Hệ thống' }}</strong> · <span style="color:var(--text3)">{{ h.time || '' }}</span></div>
                  <div style="color:var(--text2);margin-top:2px">{{ h.text || h.note || '' }}</div>
                </div>
              </div>
            </div>
          </template>

          <!-- CHẾ ĐỘ 2: XEM CĂN CỨ PHÁP LÝ SAU KHI PHÂN LOẠI HỒ SƠ -->
          <template v-else-if="mode === 'classification_basis' && classificationResult">
            <div v-if="classificationBases.length === 0" class="mod-col-card" style="text-align:center;color:var(--text3)">
              Kết quả phân loại hiện tại chưa gắn mã căn cứ pháp lý cụ thể từ cơ sở dữ liệu.
            </div>

            <div v-else class="legal-modal-split">
              <!-- Cột trái: Danh sách các căn cứ liên kết với kết quả phân loại -->
              <div class="legal-basis-nav">
                <div style="font-size:11.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:0.04em;padding:4px 8px">
                  Căn cứ áp dụng ({{ classificationBases.length }})
                </div>
                <button
                  v-for="item in classificationBases"
                  :key="item.key"
                  type="button"
                  class="legal-basis-nav-item"
                  :class="{ active: activeBasisItem?.key === item.key }"
                  @click="selectedBasisKey = item.key"
                >
                  <span style="font-size:11px;font-weight:700;color:var(--accent)">{{ item.roleTitle }}</span>
                  <span style="font-size:13px;font-weight:700;color:var(--text)">{{ item.law?.so || item.citation }}</span>
                  <span style="font-size:11.5px;color:var(--text3);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                    {{ item.law?.ten || item.fallbackTitle }}
                  </span>
                </button>
              </div>

              <!-- Cột phải: Toàn bộ 11 thông tin chi tiết căn cứ đang chọn -->
              <div v-if="activeBasisItem">
                <!-- Lý do hệ thống sử dụng căn cứ này -->
                <div class="mod-col-card" style="background:var(--accent2);border-color:var(--success-border)">
                  <div style="font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.03em;margin-bottom:4px">
                    {{ activeBasisItem.roleTitle }}
                  </div>
                  <div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:6px">
                    Điều khoản / Phụ lục viện dẫn: {{ activeBasisItem.citation }}
                  </div>
                  <div style="font-size:13px;color:var(--text2);line-height:1.55">
                    <strong>Lý do áp dụng cho hồ sơ này:</strong> {{ activeBasisItem.reason }}
                  </div>
                </div>

                <!-- Thông tin văn bản pháp luật tương ứng từ DB -->
                <div class="mod-col-card">
                  <div class="mod-col-title">
                    <span>Thông tin văn bản pháp luật</span>
                    <a v-if="activeBasisItem.law" :href="getDirectLawLink(activeBasisItem.law)" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm">
                      <span>Mở văn bản gốc</span>
                      <i class="ti ti-external-link"></i>
                    </a>
                  </div>

                  <template v-if="activeBasisItem.law">
                    <div style="font-size:15.5px;font-weight:700;color:var(--text);margin-bottom:12px;line-height:1.4">
                      {{ activeBasisItem.law.ten }}
                    </div>
                    <div class="mod-kv-grid">
                      <div>
                        <div class="mod-kv-label">Số hiệu văn bản</div>
                        <div class="mod-kv-value">{{ activeBasisItem.law.so || '—' }}</div>
                      </div>
                      <div>
                        <div class="mod-kv-label">Loại văn bản</div>
                        <div class="mod-kv-value">{{ getLawTypeLabelVi(activeBasisItem.law.type) }}</div>
                      </div>
                      <div>
                        <div class="mod-kv-label">Cơ quan ban hành</div>
                        <div class="mod-kv-value">{{ inferAgencyFallback(activeBasisItem.law) }}</div>
                      </div>
                      <div>
                        <div class="mod-kv-label">Ngày ban hành</div>
                        <div class="mod-kv-value">{{ activeBasisItem.law.issued_date || activeBasisItem.law.year || '—' }}</div>
                      </div>
                      <div>
                        <div class="mod-kv-label">Ngày có hiệu lực</div>
                        <div class="mod-kv-value">{{ activeBasisItem.law.effective_date || activeBasisItem.law.hieuluc || 'Đang áp dụng' }}</div>
                      </div>
                      <div>
                        <div class="mod-kv-label">Trạng thái xác minh pháp lý</div>
                        <div class="mod-kv-value">
                          <span class="mod-status-badge" :class="getModerationStatusMeta(activeBasisItem.law.verification_status || 'da_xac_minh').cls">
                            {{ getModerationStatusMeta(activeBasisItem.law.verification_status || 'da_xac_minh').label }}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div v-if="activeBasisItem.law.mo_ta" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);font-size:13px;color:var(--text2);line-height:1.55">
                      <strong>Tóm tắt nội dung văn bản:</strong> {{ activeBasisItem.law.mo_ta }}
                    </div>
                  </template>

                  <div v-else style="padding:12px 14px;background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--radius);font-size:13px;color:#8A5A00;line-height:1.5">
                    Hệ thống chỉ ghi nhận mã/số hiệu căn cứ (<strong>{{ activeBasisItem.citation }}</strong>) nhưng chưa có đủ bản ghi nội dung chi tiết của văn bản này trong cơ sở dữ liệu để hiển thị.
                  </div>
                </div>

                <!-- Nội dung điều khoản tương ứng trong DB -->
                <div v-if="activeBasisItem.law" class="mod-col-card">
                  <div class="mod-col-title" style="flex-wrap:wrap;gap:8px">
                    <span>Nội dung điều khoản liên quan ({{ filteredProvisionsWithIndex.length }})</span>
                    <div v-if="activeBasisItem.law.dieu_khoang?.length > 1" style="display:flex;gap:6px">
                      <button type="button" class="btn-secondary btn-sm" style="height:28px;font-size:11.5px" @click="expandAllProvisions">Mở rộng tất cả</button>
                      <button type="button" class="btn-secondary btn-sm" style="height:28px;font-size:11.5px" @click="collapseAllProvisions">Thu gọn tất cả</button>
                    </div>
                  </div>

                  <div v-if="!activeBasisItem.law.dieu_khoang || activeBasisItem.law.dieu_khoang.length === 0" style="padding:12px 14px;background:var(--bg);border:1px dashed var(--border);border-radius:var(--radius);font-size:13px;color:var(--text3)">
                    Văn bản đã có trong danh mục nhưng hệ thống chưa có đủ nội dung điều khoản cụ thể để hiển thị chi tiết. Vui lòng nhấn "Mở văn bản gốc" để tra cứu toàn văn.
                  </div>

                  <div v-else style="display:flex;flex-direction:column;gap:8px">
                    <div v-for="{ d, index } in filteredProvisionsWithIndex" :key="index" style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--surface)" :style="isClauseDirectlyCited(d) ? 'border-color:var(--accent);box-shadow:0 0 0 1px rgba(40,107,79,0.12)' : ''">
                      <button type="button" @click="toggleProvision(index)" style="width:100%;text-align:left;padding:10px 14px;background:var(--bg);border:none;display:flex;justify-content:space-between;align-items:center;gap:10px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text)">
                        <span>
                          <span v-if="isClauseDirectlyCited(d)" class="chip chip-info" style="font-size:10.5px;margin-right:6px">Viện dẫn trực tiếp</span>
                          {{ getProvisionTitle(d) }}
                        </span>
                        <i class="ti" :class="isProvisionExpanded(index) ? 'ti-chevron-up' : 'ti-chevron-down'" style="color:var(--text3)"></i>
                      </button>
                      <div v-if="isProvisionExpanded(index)" style="padding:12px 14px;font-size:13px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);white-space:pre-line">
                        {{ getProvisionContent(d) || 'Chưa có nội dung chi tiết cho điều khoản này trong cơ sở dữ liệu.' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- CHẾ ĐỘ 3: CHI TIẾT QUY CHUẨN QCVN -->
          <template v-else-if="mode === 'qcvn' && qcvn">
            <div class="mod-col-card">
              <div class="mod-col-title"><span>Thông tin quy chuẩn kỹ thuật quốc gia</span></div>
              <div class="mod-kv-grid">
                <div>
                  <div class="mod-kv-label">Mã / Số hiệu quy chuẩn</div>
                  <div class="mod-kv-value">{{ qcvn.applicableStandard || qcvn.standard_code || qcvn.id }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Lĩnh vực áp dụng</div>
                  <div class="mod-kv-value">{{ getQcvnDomainLabel(qcvn.sourceType || qcvn.source_type) }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Căn cứ pháp lý ban hành</div>
                  <div class="mod-kv-value">{{ qcvn.sourceDocument || qcvn.source_document || 'Chưa có thông tin trong cơ sở dữ liệu' }}</div>
                </div>
                <div>
                  <div class="mod-kv-label">Ngày có hiệu lực</div>
                  <div class="mod-kv-value">{{ qcvn.effectiveFrom || qcvn.effective_from || 'Đang áp dụng' }}</div>
                </div>
                <div v-if="qcvn.ruleSource">
                  <div class="mod-kv-label">Nguồn dữ liệu quy chuẩn</div>
                  <div class="mod-kv-value">{{ getRuleSourceLabel(qcvn.ruleSource) }}</div>
                </div>
                <div v-if="qcvn.ruleVersion">
                  <div class="mod-kv-label">Phiên bản dữ liệu</div>
                  <div class="mod-kv-value">{{ qcvn.ruleVersion }}</div>
                </div>
              </div>
            </div>

            <div class="mod-col-card">
              <div class="mod-col-title"><span>Danh mục thông số &amp; Ngưỡng giới hạn ({{ qcvnParameterRows.length }})</span></div>
              <div v-if="qcvnParameterRows.length === 0" style="font-size:13px;color:var(--text3)">
                Chưa có bảng thông số chi tiết cho quy chuẩn này trong cơ sở dữ liệu.
              </div>
              <div v-else class="table-wrap" style="max-height:360px;overflow-y:auto">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Thông số</th>
                      <th>Đơn vị</th>
                      <th>Chu kỳ lấy mẫu</th>
                      <th>Giới hạn quy định</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in qcvnParameterRows" :key="row.key">
                      <td><strong>{{ row.name }}</strong></td>
                      <td>{{ row.unit }}</td>
                      <td>{{ row.period }}</td>
                      <td>{{ row.limitDisplay }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <!-- CHẾ ĐỘ 4: NỘI DUNG TÙY CHỈNH (KIỂM DUYỆT ADMIN 2 CỘT...) -->
          <slot v-else></slot>
        </div>

        <!-- Chân Modal cố định -->
        <div class="legal-modal-foot">
          <slot name="footer">
            <button type="button" class="btn-secondary" @click="attemptClose(false)">Đóng</button>
          </slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
