<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { LAW_BASE_URL, API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'

const props = defineProps({
  loadLawId: { type: String, default: null }
})
const emit = defineEmits(['law-loaded'])

const laws = ref([])
const searchQuery = ref('')
const currentFilter = ref('all')
const selectedLaw = ref(null)
const viewMode = ref('table') // 'table' | 'cards'

// Phân trang
const pageSize = ref(15)
const currentPage = ref(1)

// Accordion và tìm kiếm điều khoản trong drawer chi tiết
const expandedProvisions = ref(new Set())
const provisionSearchQuery = ref('')

const toggleProvision = (idx) => {
  if (expandedProvisions.value.has(idx)) {
    expandedProvisions.value.delete(idx)
  } else {
    expandedProvisions.value.add(idx)
  }
}

const isProvisionExpanded = (idx) => {
  return expandedProvisions.value.has(idx)
}

const expandAllProvisions = () => {
  if (!selectedLaw.value || !Array.isArray(selectedLaw.value.dieu_khoang)) return
  selectedLaw.value.dieu_khoang.forEach((_, idx) => expandedProvisions.value.add(idx))
}

const collapseAllProvisions = () => {
  expandedProvisions.value.clear()
}

watch(selectedLaw, (newLaw) => {
  expandedProvisions.value.clear()
  provisionSearchQuery.value = ''
  if (newLaw && Array.isArray(newLaw.dieu_khoang)) {
    if (newLaw.dieu_khoang.length <= 2) {
      newLaw.dieu_khoang.forEach((_, idx) => expandedProvisions.value.add(idx))
    }
  }
})

const filteredProvisionsWithIndex = computed(() => {
  if (!selectedLaw.value || !Array.isArray(selectedLaw.value.dieu_khoang)) return []
  const q = normalizeString(provisionSearchQuery.value.trim())
  return selectedLaw.value.dieu_khoang.map((d, index) => ({ d, index })).filter(({ d }) => {
    if (!q) return true
    const title = normalizeString(getProvisionTitle(d))
    const content = normalizeString(getProvisionContent(d) || '')
    return title.includes(q) || content.includes(q)
  })
})

const checkAndOpenLaw = (targetId) => {
  if (!targetId || !laws.value.length) return
  const found = laws.value.find(l => l.id === targetId || l.so === targetId)
  if (found) {
    selectedLaw.value = found
    emit('law-loaded')
  }
}

watch(() => props.loadLawId, (newId) => {
  if (newId) {
    checkAndOpenLaw(newId)
  }
}, { immediate: true })

const fetchLaws = async () => {
  try {
    const res = await fetch(API.LAWS)
    if (res.ok) {
      laws.value = await res.json()
      if (props.loadLawId) {
        checkAndOpenLaw(props.loadLawId)
      }
    } else {
      logger.error('Không thể tải danh sách văn bản pháp lý')
    }
  } catch (err) {
    logger.error('Lỗi khi fetch laws:', err)
  }
}

onMounted(() => {
  fetchLaws()
})

const getProvisionTitle = (d) => {
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && d.tieu_de) return d.tieu_de
  return String(d)
}

const getProvisionContent = (d) => {
  if (typeof d === 'string') return null
  if (d && typeof d === 'object' && d.noi_dung) return d.noi_dung
  return null
}

const getLawSortTime = (law) => {
  if (law.sortDate) return new Date(law.sortDate).getTime()
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(law.hieuluc)) {
    const [day, month, year] = law.hieuluc.split('/')
    return new Date(`${year}-${month}-${day}`).getTime()
  }
  return new Date(`${law.year}-01-01`).getTime()
}

const getTypeLabel = (type) => {
  return {
    luat: 'Luật',
    nd: 'Nghị định',
    tt: 'Thông tư',
    qcvn: 'QCVN',
    vbhn: 'VBHN'
  }[type] || type.toUpperCase()
}

const getStatusLabel = (status) => {
  return {
    valid: 'Còn hiệu lực',
    amended: 'Đã sửa đổi',
    expired: 'Hết hiệu lực'
  }[status] || status
}

const filteredLaws = computed(() => {
  const term = normalizeString(searchQuery.value.trim())

  return laws.value.filter(l => {
    if (currentFilter.value !== 'all') {
      if (currentFilter.value === 'hieuluc' && l.status !== 'valid') return false
      if (currentFilter.value === 'suadoi' && l.status !== 'amended') return false
      if (currentFilter.value !== 'hieuluc' && currentFilter.value !== 'suadoi' && l.type !== currentFilter.value) return false
    }

    if (term) {
      const matchesText = normalizeString(l.ten).includes(term) || normalizeString(l.so).includes(term)

      let matchesType = false
      if (l.type === 'luat' && ('luat'.includes(term) || searchQuery.value.toLowerCase().includes('luật'))) matchesType = true
      if (l.type === 'nd' && ('nghi dinh'.includes(term) || 'nd'.includes(term) || searchQuery.value.toLowerCase().includes('nghị định'))) matchesType = true
      if (l.type === 'tt' && ('thong tu'.includes(term) || 'tt'.includes(term) || searchQuery.value.toLowerCase().includes('thông tư'))) matchesType = true
      if (l.type === 'qcvn' && ('qcvn'.includes(term) || 'quy chuan'.includes(term) || searchQuery.value.toLowerCase().includes('quy chuẩn'))) matchesType = true
      if (l.type === 'vbhn' && ('vbhn'.includes(term) || 'van ban hop nhat'.includes(term) || searchQuery.value.toLowerCase().includes('văn bản hợp nhất'))) matchesType = true

      return matchesText || matchesType
    }

    return true
  }).sort((a, b) => getLawSortTime(b) - getLawSortTime(a))
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredLaws.value.length / pageSize.value))
})

const paginatedLaws = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredLaws.value.slice(start, start + pageSize.value)
})

const pageNumbers = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const pages = []
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i)
    pages.push('...')
    pages.push(total)
  } else if (current >= total - 3) {
    pages.push(1)
    pages.push('...')
    for (let i = total - 4; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    pages.push('...')
    pages.push(current - 1)
    pages.push(current)
    pages.push(current + 1)
    pages.push('...')
    pages.push(total)
  }
  return pages
})

const changePage = (p) => {
  if (typeof p !== 'number' || p < 1 || p > totalPages.value) return
  currentPage.value = p
  const el = document.getElementById('laws')
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

watch([searchQuery, currentFilter, pageSize], () => {
  currentPage.value = 1
})

const getDirectLawLink = (l) => {
  if (l.link && l.link.startsWith(LAW_BASE_URL)) {
    return l.link
  }

  const cleanNum = normalizeString(l.so || '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (l.type === 'luat') {
    if (l.id.includes('bvmt') || l.id.includes('bao_ve_moi_truong')) return `${LAW_BASE_URL}luat-bao-ve-moi-truong-2020`
    if (l.id.includes('dat_dai')) return `${LAW_BASE_URL}luat-dat-dai-2024`
    if (l.id.includes('tainguyen_nuoc') || l.id.includes('tai_nguyen_nuoc')) return `${LAW_BASE_URL}luat-tai-nguyen-nuoc-2023`
    if (l.id.includes('dautu')) return `${LAW_BASE_URL}luat-dau-tu-2020`
    return `${LAW_BASE_URL}luat-${cleanNum}`
  }

  if (l.type === 'nd') {
    return `${LAW_BASE_URL}nghi-dinh-${cleanNum}`
  }

  if (l.type === 'tt') {
    return `${LAW_BASE_URL}thong-tu-${cleanNum}`
  }

  if (l.type === 'qcvn') {
    let qSlug = cleanNum
    if (!qSlug.startsWith('qcvn')) {
      qSlug = 'qcvn-' + qSlug
    }
    return `${LAW_BASE_URL}${qSlug}`
  }

  if (l.type === 'vbhn') {
    return `${LAW_BASE_URL}van-ban-hop-nhat-${cleanNum}`
  }

  return `${LAW_BASE_URL}${cleanNum}`
}
</script>

<template>
  <div id="laws" class="page active container fade-up">
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div>
        <h2 class="section-head">Thư viện Văn bản Pháp lý Môi trường</h2>
        <p class="section-desc">
          Hệ thống tra cứu Luật, Nghị định, Văn bản hợp nhất, Thông tư và Quy chuẩn kỹ thuật quốc gia (QCVN) phục vụ tư vấn môi trường.
        </p>
      </div>
    </div>

    <!-- KPI SUMMARY ROW -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Luật / Bộ luật</span>
          <div class="kpi-icon"><i class="ti ti-book"></i></div>
        </div>
        <div class="kpi-value">{{ laws.filter(l => l.type === 'luat').length }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Nghị định &amp; VBHN</span>
          <div class="kpi-icon info"><i class="ti ti-gavel"></i></div>
        </div>
        <div class="kpi-value">{{ laws.filter(l => l.type === 'nd' || l.type === 'vbhn').length }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Thông tư hướng dẫn</span>
          <div class="kpi-icon warn"><i class="ti ti-file-certificate"></i></div>
        </div>
        <div class="kpi-value">{{ laws.filter(l => l.type === 'tt').length }}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-card-top">
          <span class="kpi-label">Quy chuẩn (QCVN)</span>
          <div class="kpi-icon"><i class="ti ti-flask-2"></i></div>
        </div>
        <div class="kpi-value">{{ laws.filter(l => l.type === 'qcvn').length }}</div>
      </div>
    </div>

    <!-- LEGAL NOTICE BANNER -->
    <div class="notice-banner">
      <i class="ti ti-info-circle"></i>
      <span>
        <strong>Lưu ý áp dụng pháp lý:</strong> Nghị định 08/2022/NĐ-CP hiện được áp dụng đồng thời với chuỗi sửa đổi, bổ sung tại Nghị định 05/2025/NĐ-CP, Nghị định 48/2026/NĐ-CP, Nghị định 110/2026/NĐ-CP và Văn bản hợp nhất 49/VBHN-BNNMT.
      </span>
    </div>

    <!-- UNIFIED SEARCH & FILTER TOOLBAR -->
    <div class="card" style="padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
        <div style="position:relative;flex:1;min-width:260px">
          <i class="ti ti-search" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--text3);font-size:16px"></i>
          <input type="text" v-model="searchQuery"
                 placeholder="Tìm theo số hiệu, tên văn bản hoặc nội dung (ví dụ: 72/2020, Nghị định 48, QCVN 40...)"
                 style="padding-left:36px" />
        </div>

        <div style="display:flex;align-items:center;gap:8px">
          <div style="display:inline-flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;background:var(--bg)">
            <button type="button" @click="viewMode = 'table'"
                    :style="{
                      height: '36px', padding: '0 12px', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit',
                      background: viewMode === 'table' ? 'var(--accent)' : 'transparent',
                      color: viewMode === 'table' ? '#fff' : 'var(--text2)'
                    }">
              <i class="ti ti-list"></i>
              <span>Bảng</span>
            </button>
            <button type="button" @click="viewMode = 'cards'"
                    :style="{
                      height: '36px', padding: '0 12px', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit',
                      background: viewMode === 'cards' ? 'var(--accent)' : 'transparent',
                      color: viewMode === 'cards' ? '#fff' : 'var(--text2)'
                    }">
              <i class="ti ti-layout-grid"></i>
              <span>Thẻ</span>
            </button>
          </div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div class="filter-bar">
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'all' }" @click="currentFilter = 'all'">Tất cả</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'luat' }" @click="currentFilter = 'luat'">Luật</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'nd' }" @click="currentFilter = 'nd'">Nghị định</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'vbhn' }" @click="currentFilter = 'vbhn'">VBHN</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'tt' }" @click="currentFilter = 'tt'">Thông tư</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'qcvn' }" @click="currentFilter = 'qcvn'">QCVN</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'hieuluc' }" @click="currentFilter = 'hieuluc'">Còn hiệu lực</button>
          <button type="button" class="filter-btn" :class="{ on: currentFilter === 'suadoi' }" @click="currentFilter = 'suadoi'">Đã sửa đổi</button>
        </div>

        <div style="font-size:12.5px;color:var(--text2)">
          Tìm thấy <strong style="color:var(--text)">{{ filteredLaws.length }}</strong> văn bản
        </div>
      </div>
    </div>

    <!-- EMPTY STATE -->
    <div v-if="filteredLaws.length === 0" class="card" style="text-align:center;padding:48px 20px;color:var(--text3)">
      <i class="ti ti-file-off" style="font-size:32px;display:block;margin-bottom:8px"></i>
      <div>Không tìm thấy văn bản pháp lý nào phù hợp với bộ lọc hiện tại.</div>
    </div>

    <!-- TABLE VIEW (DEFAULT) -->
    <div v-else-if="viewMode === 'table'" class="card" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto">
        <table class="saas-table" style="min-width:820px">
          <thead>
            <tr>
              <th style="width:165px">Số hiệu &amp; Năm</th>
              <th>Tên văn bản &amp; Nội dung trọng tâm</th>
              <th style="width:110px">Phân loại</th>
              <th style="width:135px">Trạng thái</th>
              <th style="width:120px">Điều khoản</th>
              <th style="width:120px;text-align:right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in paginatedLaws" :key="l.id" style="cursor:pointer" @click="selectedLaw = l">
              <td>
                <div class="law-number">{{ l.so }}</div>
                <div style="font-size:11.5px;color:var(--text3);margin-top:2px">
                  Năm {{ l.year }} · {{ l.hieuluc || 'Đang áp dụng' }}
                </div>
              </td>
              <td>
                <div class="law-title">{{ l.ten }}</div>
                <div v-if="l.mo_ta" style="font-size:12.5px;color:var(--text2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">
                  {{ l.mo_ta }}
                </div>
              </td>
              <td>
                <span class="chip chip-gray">{{ getTypeLabel(l.type) }}</span>
              </td>
              <td>
                <span class="chip-status" :class="l.status">
                  <span class="status-dot" :class="l.status"></span>
                  <span>{{ getStatusLabel(l.status) }}</span>
                </span>
              </td>
              <td style="font-size:12.5px;color:var(--text2)">
                <span v-if="l.dieu_khoang && l.dieu_khoang.length">
                  <strong>{{ l.dieu_khoang.length }}</strong> mục
                </span>
                <span v-else style="color:var(--text3)">—</span>
              </td>
              <td style="text-align:right" @click.stop>
                <button type="button" class="btn-secondary btn-sm" @click="selectedLaw = l">
                  <span>Chi tiết</span>
                  <i class="ti ti-chevron-right"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- CARDS VIEW (OPTIONAL) -->
    <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px">
      <div v-for="l in paginatedLaws" :key="l.id"
           class="law-card" :class="{ expired: l.status === 'expired' }"
           style="margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;cursor:pointer"
           @click="selectedLaw = l">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px">
              <span class="chip chip-gray">{{ getTypeLabel(l.type) }}</span>
              <span class="law-number">{{ l.so }}</span>
            </div>
            <span class="chip-status" :class="l.status">
              <span class="status-dot" :class="l.status"></span>
              {{ getStatusLabel(l.status) }}
            </span>
          </div>
          <div class="law-title">{{ l.ten }}</div>
          <div v-if="l.mo_ta" class="law-desc" style="margin-top:4px">{{ l.mo_ta }}</div>
          <div v-if="l.dieu_khoang && l.dieu_khoang.length" class="law-provisions">
            <span v-for="(d, idx) in l.dieu_khoang.slice(0, 2)" :key="idx" class="provision">{{ getProvisionTitle(d) }}</span>
            <span v-if="l.dieu_khoang.length > 2" class="provision">+{{ l.dieu_khoang.length - 2 }} điều khoản</span>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
          <span style="font-size:12px;color:var(--text3)">Hiệu lực: {{ l.hieuluc || l.year }}</span>
          <button type="button" class="btn-secondary btn-sm" @click.stop="selectedLaw = l">
            <span>Xem chi tiết</span>
            <i class="ti ti-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- BOTTOM PAGINATION -->
    <div v-if="filteredLaws.length > 0"
         style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:14px;padding:12px 18px;background:var(--surface);border-radius:var(--radius-lg);border:1px solid var(--border)">
      <div style="font-size:12.5px;color:var(--text2)">
        Hiển thị <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> – <strong>{{ Math.min(currentPage * pageSize, filteredLaws.length) }}</strong> / <strong>{{ filteredLaws.length }}</strong> văn bản
      </div>

      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">‹ Trước</button>
        <button v-for="(p, idx) in pageNumbers" :key="idx"
                type="button"
                class="pagination-btn"
                :class="{ active: p === currentPage }"
                :disabled="p === '...'"
                @click="typeof p === 'number' && changePage(p)">
          {{ p }}
        </button>
        <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">Sau ›</button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
        <span>Hiển thị:</span>
        <select v-model.number="pageSize" style="width:105px;height:30px;font-size:12.5px">
          <option :value="10">10 / trang</option>
          <option :value="15">15 / trang</option>
          <option :value="30">30 / trang</option>
          <option :value="50">50 / trang</option>
        </select>
      </div>
    </div>

    <!-- SLIDE-OVER READING DRAWER FOR LAW DETAILS -->
    <div v-if="selectedLaw" class="drawer-overlay" @click.self="selectedLaw = null">
      <div class="drawer-panel">
        <!-- Drawer Header -->
        <div class="drawer-header">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span class="chip chip-gray">{{ getTypeLabel(selectedLaw.type) }}</span>
            <span class="chip-status" :class="selectedLaw.status">
              <span class="status-dot" :class="selectedLaw.status"></span>
              {{ getStatusLabel(selectedLaw.status) }}
            </span>
            <span v-if="selectedLaw.year" style="font-size:12px;color:var(--text3);font-weight:500">
              Năm ban hành: {{ selectedLaw.year }}
            </span>
          </div>
          <button type="button" class="drawer-close-btn" @click="selectedLaw = null" title="Đóng">
            <i class="ti ti-x"></i>
          </button>
        </div>

        <!-- Drawer Body -->
        <div class="drawer-body">
          <h3 style="font-size:19px;font-weight:700;color:var(--text);margin:0 0 8px;line-height:1.4">
            {{ selectedLaw.ten }}
          </h3>

          <div style="font-size:13px;color:var(--text2);margin-bottom:16px;display:flex;flex-wrap:wrap;gap:16px">
            <span><strong style="color:var(--text)">Số hiệu:</strong> {{ selectedLaw.so }}</span>
            <span><strong style="color:var(--text)">Hiệu lực:</strong> {{ selectedLaw.hieuluc || 'Đang áp dụng' }}</span>
          </div>

          <!-- Prominent 3rd-party direct link banner -->
          <div style="background:var(--accent2);border:1px solid var(--success-border);padding:12px 16px;border-radius:var(--radius);margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="font-size:13px;color:var(--accent);display:flex;align-items:center;gap:8px;font-weight:500">
              <i class="ti ti-world" style="font-size:18px"></i>
              <span>Tra cứu toàn văn gốc trên <strong>luatmoitruong.vn</strong></span>
            </div>
            <a :href="getDirectLawLink(selectedLaw)" target="_blank" rel="noopener noreferrer" class="btn-primary btn-sm">
              <span>Mở văn bản gốc</span>
              <i class="ti ti-external-link"></i>
            </a>
          </div>

          <!-- Summary -->
          <div v-if="selectedLaw.mo_ta" style="margin-bottom:18px">
            <div style="font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em">
              Mô tả tóm tắt
            </div>
            <p style="font-size:13.5px;color:var(--text2);line-height:1.6;background:var(--bg);padding:12px 14px;border-radius:var(--radius);border:1px solid var(--border);margin:0">
              {{ selectedLaw.mo_ta }}
            </p>
          </div>

          <!-- Note if any -->
          <div v-if="selectedLaw.note" style="margin-bottom:18px">
            <div style="font-size:13px;color:var(--warn);padding:10px 14px;background:var(--warn-bg);border:1px solid var(--warn-border);border-radius:var(--radius);display:flex;align-items:flex-start;gap:8px">
              <i class="ti ti-alert-triangle" style="font-size:16px;margin-top:2px"></i>
              <div><strong>Lưu ý:</strong> {{ selectedLaw.note }}</div>
            </div>
          </div>

          <!-- Provisions Accordion -->
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
              <div style="font-size:12.5px;font-weight:600;color:var(--text);text-transform:uppercase;letter-spacing:0.04em">
                Điều khoản &amp; Phụ lục quy định
                <span v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length" style="color:var(--text3);font-weight:500;text-transform:none">
                  ({{ filteredProvisionsWithIndex.length }}/{{ selectedLaw.dieu_khoang.length }} mục)
                </span>
              </div>

              <div v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length > 1" style="display:flex;align-items:center;gap:6px">
                <button type="button" class="btn-secondary btn-sm" style="height:28px;font-size:11.5px" @click="expandAllProvisions">
                  <i class="ti ti-arrows-maximize"></i>
                  <span>Mở rộng tất cả</span>
                </button>
                <button type="button" class="btn-secondary btn-sm" style="height:28px;font-size:11.5px" @click="collapseAllProvisions">
                  <i class="ti ti-arrows-minimize"></i>
                  <span>Thu gọn tất cả</span>
                </button>
              </div>
            </div>

            <div v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length > 3" style="margin-bottom:10px;position:relative">
              <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
              <input type="text" v-model="provisionSearchQuery"
                     placeholder="Lọc nhanh điều khoản (VD: Điều 1, Phụ lục, quan trắc...)"
                     style="padding-left:32px;height:34px;font-size:12.5px" />
            </div>

            <div style="display:flex;flex-direction:column;gap:8px">
              <div v-for="{ d, index } in filteredProvisionsWithIndex" :key="index"
                   style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
                <div @click="getProvisionContent(d) && toggleProvision(index)"
                     :style="{
                       display: 'flex',
                       justifyContent: 'space-between',
                       alignItems: 'center',
                       gap: '10px',
                       padding: '10px 14px',
                       cursor: getProvisionContent(d) ? 'pointer' : 'default',
                       background: isProvisionExpanded(index) && getProvisionContent(d) ? 'var(--surface2)' : 'transparent',
                       userSelect: 'none'
                     }">
                  <div style="display:flex;align-items:flex-start;gap:8px;flex:1">
                    <i class="ti ti-bookmark" style="color:var(--accent);margin-top:2px;font-size:15px"></i>
                    <strong style="font-size:13.5px;color:var(--text);line-height:1.45">{{ getProvisionTitle(d) }}</strong>
                  </div>
                  <div v-if="getProvisionContent(d)" style="flex-shrink:0">
                    <span class="chip chip-gray" style="height:22px;font-size:11px">
                      <span>{{ isProvisionExpanded(index) ? 'Thu gọn' : 'Xem nội dung' }}</span>
                      <i class="ti" :class="isProvisionExpanded(index) ? 'ti-chevron-up' : 'ti-chevron-down'"></i>
                    </span>
                  </div>
                </div>

                <div v-if="getProvisionContent(d) && isProvisionExpanded(index)"
                     style="padding:14px 16px;border-top:1px solid var(--border);background:var(--surface);font-size:13.5px;color:var(--text);line-height:1.7;white-space:pre-wrap">
                  {{ getProvisionContent(d) }}
                </div>
              </div>

              <div v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length > 0 && filteredProvisionsWithIndex.length === 0"
                   style="color:var(--text3);font-size:13px;text-align:center;padding:20px;background:var(--bg);border-radius:var(--radius)">
                Không tìm thấy điều khoản nào khớp với từ khóa "{{ provisionSearchQuery }}".
              </div>

              <div v-if="!selectedLaw.dieu_khoang || selectedLaw.dieu_khoang.length === 0"
                   style="color:var(--text3);font-size:13px;padding:14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
                Chưa cập nhật danh mục điều khoản chi tiết. Vui lòng nhấn nút mở toàn văn trên luatmoitruong.vn ở trên để xem chi tiết.
              </div>
            </div>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="drawer-footer">
          <button type="button" class="btn-secondary" @click="selectedLaw = null">
            <i class="ti ti-x"></i>
            <span>Đóng lại</span>
          </button>
          <a :href="getDirectLawLink(selectedLaw)" target="_blank" rel="noopener noreferrer" class="btn-primary">
            <i class="ti ti-world"></i>
            <span>Xem toàn văn trên luatmoitruong.vn</span>
            <i class="ti ti-external-link"></i>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
