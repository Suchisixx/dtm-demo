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

// Phân trang
const pageSize = ref(10)
const currentPage = ref(1)

// Accordion và tìm kiếm điều khoản trong modal chi tiết
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

// Theo dõi khi đổi văn bản được chọn để reset trạng thái mở rộng
watch(selectedLaw, (newLaw) => {
  expandedProvisions.value.clear()
  provisionSearchQuery.value = ''
  if (newLaw && Array.isArray(newLaw.dieu_khoang)) {
    // Nếu có ít mục (<= 2), mặc định mở ra; nếu nhiều mục (> 2), thu gọn để giao diện gọn gàng
    if (newLaw.dieu_khoang.length <= 2) {
      newLaw.dieu_khoang.forEach((_, idx) => expandedProvisions.value.add(idx))
    }
  }
})

// Danh sách điều khoản kèm chỉ số gốc đã lọc theo từ khóa tìm kiếm trong modal
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



// Helper: dieu_khoang item can be a plain string OR an object {tieu_de, noi_dung}
// This normalizes it to a display-friendly title string
const getProvisionTitle = (d) => {
  if (typeof d === 'string') return d
  if (d && typeof d === 'object' && d.tieu_de) return d.tieu_de
  return String(d)
}

// Helper: get full content for detail view
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
    luat: 'LUẬT',
    nd: 'NGHỊ ĐỊNH',
    tt: 'THÔNG TƯ',
    qcvn: 'QCVN',
    vbhn: 'VBHN'
  }[type] || type.toUpperCase()
}

const getStatusLabel = (status) => {
  return {
    valid: 'Còn hiệu lực',
    amended: 'Đã sửa đổi (đọc kết hợp)',
    expired: 'Hết hiệu lực'
  }[status] || status
}

const filteredLaws = computed(() => {
  const term = normalizeString(searchQuery.value.trim())
  
  return laws.value.filter(l => {
    // 1. Filter by category
    if (currentFilter.value !== 'all') {
      if (currentFilter.value === 'hieuluc' && l.status !== 'valid') return false
      if (currentFilter.value === 'suadoi' && l.status !== 'amended') return false
      if (currentFilter.value !== 'hieuluc' && currentFilter.value !== 'suadoi' && l.type !== currentFilter.value) return false
    }

    // 2. Filter by search input (ten, so, type)
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
  <div id="laws" class="page active container">
    <div class="section-head">Hệ thống văn bản pháp lý môi trường</div>
    <div class="section-desc">Tổng hợp Luật, Nghị định, Thông tư và QCVN còn hiệu lực áp dụng trong công tác tư vấn môi trường</div>

    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-num">{{ laws.filter(l => l.type === 'luat').length }}</div>
        <div class="stat-label">Luật / Bộ luật</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">{{ laws.filter(l => l.type === 'nd').length }}</div>
        <div class="stat-label">Nghị định</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">{{ laws.filter(l => l.type === 'tt').length }}</div>
        <div class="stat-label">Thông tư</div>
      </div>
      <div class="stat-box">
        <div class="stat-num">{{ laws.filter(l => l.type === 'qcvn').length }}</div>
        <div class="stat-label">QCVN đang theo dõi</div>
      </div>
    </div>

    <div class="notice-banner">
      <svg viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
      <span><strong>Thay đổi quan trọng:</strong> NĐ 08/2022 hiện không nên đọc riêng bản gốc. Chuỗi cập nhật mới gồm NĐ 05/2025, NĐ 48/2026, NĐ 110/2026 và bản hợp nhất 49/VBHN-BNNMT ngày 17/04/2026.</span>
    </div>

    <div class="legal-update-panel">
      <div class="legal-update-head">
        <div>
          <div class="legal-update-title">Trạng thái cập nhật cơ sở pháp lý</div>
          <div class="legal-update-sub">Đồng bộ tự động qua cơ sở dữ liệu PostgreSQL của hệ thống ETC LegalHub.</div>
        </div>
      </div>
      <div class="legal-update-grid">
        <div class="legal-update-item">
          <strong>Đã bổ sung</strong>
          <span>NĐ 110/2026, VBHN 49/VBHN-BNNMT và TT 09/2026 để phản ánh chuỗi cập nhật mới nhất của NĐ 08/2022 và TT 02/2022.</span>
        </div>
        <div class="legal-update-item">
          <strong>Còn thiếu văn bản pháp lý nào</strong>
          <span>Còn thiếu các thông tư bổ sung của tuyến TT 02/2022 như TT 07/2025/TT-BTNMT, TT 07/2025/TT-BNNMT và thông tư ngưng hiệu lực TT 04/2023/TT-BTNMT trên luatmoitruong.vn.</span>
        </div>
        <div class="legal-update-item">
          <strong>Lưu ý</strong>
          <span>Engine phân loại hiện vẫn cần rà lại theo VBHN 49 và NĐ 110; phần checklist/mẫu hồ sơ cần rà lại theo tuyến TT 02/2022 đã sửa đổi.</span>
        </div>
      </div>
    </div>

    <!-- Thanh tìm kiếm văn bản pháp lý -->
    <div style="margin-bottom:20px">
      <input type="text" v-model="searchQuery"
        placeholder="🔍 Nhập số hiệu, tên hoặc loại văn bản cần tìm (ví dụ: 72/2020, Nghị định 48, Thông tư...)"
        style="width:100%;padding:12px 18px;border:1px solid var(--border);border-radius:var(--radius-lg);font-size:14px;background:var(--surface);color:var(--text);box-shadow:var(--shadow);outline:none;transition:border-color 0.15s" />
    </div>

    <div class="filter-bar">
      <button class="filter-btn" :class="{ on: currentFilter === 'all' }" @click="currentFilter = 'all'">Tất cả</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'luat' }" @click="currentFilter = 'luat'">Luật</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'nd' }" @click="currentFilter = 'nd'">Nghị định</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'vbhn' }" @click="currentFilter = 'vbhn'">VBHN</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'tt' }" @click="currentFilter = 'tt'">Thông tư</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'qcvn' }" @click="currentFilter = 'qcvn'">QCVN</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'hieuluc' }" @click="currentFilter = 'hieuluc'">Còn hiệu lực</button>
      <button class="filter-btn" :class="{ on: currentFilter === 'suadoi' }" @click="currentFilter = 'suadoi'">Đã sửa đổi</button>
    </div>

    <!-- Thanh phân trang trên -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;background:var(--surface);padding:10px 16px;border-radius:var(--radius);border:1px solid var(--border)">
      <div style="font-size:13px;color:var(--text2)">
        Tìm thấy <strong>{{ filteredLaws.length }}</strong> văn bản & quy chuẩn
        <span v-if="filteredLaws.length > 0"> (Trang {{ currentPage }}/{{ totalPages }})</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
        <label for="laws-page-size-top" style="font-weight:500">Hiển thị:</label>
        <select id="laws-page-size-top" v-model.number="pageSize"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px;cursor:pointer">
          <option :value="10">10 / trang</option>
          <option :value="20">20 / trang</option>
          <option :value="50">50 / trang</option>
        </select>
      </div>
    </div>

    <div id="law-list">
      <div v-if="filteredLaws.length === 0" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text3)">
        Không tìm thấy văn bản pháp lý nào phù hợp.
      </div>
      
      <div v-for="(l, i) in paginatedLaws" :key="l.id" 
           class="law-card fade-up" :class="{ expired: l.status === 'expired' }" 
           style="display: flex; flex-direction: column; justify-content: space-between">
        <div>
          <div class="law-accent" :class="l.status"></div>
          <div style="padding-left:12px">
            <div class="law-meta">
              <div class="law-year">{{ l.year }}</div>
              <div class="law-content">
                <div class="law-status">
                  <div class="status-dot" :class="l.status"></div>
                  <span class="status-label">{{ getStatusLabel(l.status) }}</span>
                  <span class="chip chip-gray" style="margin-left:4px">{{ getTypeLabel(l.type) }}</span>
                </div>
                <div class="law-title">{{ l.ten }}</div>
                <div class="law-number">{{ l.so }} — Hiệu lực: {{ l.hieuluc }}</div>
                <div class="law-desc">{{ l.mo_ta }}</div>
                <div v-if="l.note" style="font-size:12px;color:var(--warn);margin-bottom:8px;padding:6px 10px;background:var(--warn-bg);border-radius:5px;border-left:3px solid #D4860A">
                  ⚡ {{ l.note }}
                </div>
                <div class="law-provisions">
                  <span v-for="(d, idx) in (l.dieu_khoang || []).slice(0, 3)" :key="idx" class="provision">{{ getProvisionTitle(d) }}</span>
                  <span v-if="(l.dieu_khoang || []).length > 3" class="provision" style="background:var(--surface2);color:var(--text3)">
                    +{{ l.dieu_khoang.length - 3 }} điều khoản khác
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style="padding-left:12px; margin-top:16px; display:flex; justify-content:flex-end">
          <button class="btn-classify" style="width:auto; margin:0; padding:6px 14px; font-size:13px; display:flex; align-items:center; gap:6px" @click="selectedLaw = l">
            Xem chi tiết
          </button>
        </div>
      </div>
    </div>

    <!-- Thanh phân trang dưới -->
    <div v-if="filteredLaws.length > 0"
      style="display:flex;justify-content:space-between;align-items:center;margin-top:24px;flex-wrap:wrap;gap:16px;padding:14px 20px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">
      <div style="font-size:13px;color:var(--text2)">
        Hiển thị <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> – <strong>{{ Math.min(currentPage * pageSize, filteredLaws.length) }}</strong> trong tổng số <strong>{{ filteredLaws.length }}</strong> văn bản & quy chuẩn
      </div>

      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <button class="pagination-btn" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
          ‹ Trước
        </button>
        <button v-for="(p, idx) in pageNumbers" :key="idx"
          class="pagination-btn"
          :class="{ active: p === currentPage }"
          :disabled="p === '...'"
          :style="p === '...' ? { cursor: 'default', border: 'none', background: 'transparent' } : {}"
          @click="typeof p === 'number' && changePage(p)">
          {{ p }}
        </button>
        <button class="pagination-btn" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">
          Sau ›
        </button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
        <span>Hiển thị:</span>
        <select v-model.number="pageSize"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px;cursor:pointer">
          <option :value="10">10 / trang</option>
          <option :value="20">20 / trang</option>
          <option :value="50">50 / trang</option>
        </select>
      </div>
    </div>

    <!-- Modal Chi tiết Văn bản Pháp lý -->
    <div v-if="selectedLaw" class="modal-overlay" style="display: flex;" @click.self="selectedLaw = null">
      <div class="modal-card fade-up" style="width:720px;max-width:92vw;max-height:88vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--border);padding-bottom:12px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="chip chip-status" :class="selectedLaw.status" style="font-size:11px">
              {{ getTypeLabel(selectedLaw.type) }}
            </span>
            <span v-if="selectedLaw.year" style="font-size:12px;color:var(--text3);font-weight:600">
              Năm ban hành: {{ selectedLaw.year }}
            </span>
          </div>
          <button @click="selectedLaw = null" title="Đóng"
            style="background:transparent;border:none;font-size:24px;cursor:pointer;color:var(--text3);line-height:1;padding:0 4px">&times;</button>
        </div>

        <div>
          <h3 style="font-family:'Playfair Display',serif;font-size:22px;color:var(--accent);margin:0 0 6px;line-height:1.35">
            {{ selectedLaw.ten }}
          </h3>
          <div style="font-size:13px;color:var(--text2);margin-bottom:14px;display:flex;flex-wrap:wrap;gap:12px">
            <span><strong>Số hiệu:</strong> {{ selectedLaw.so }}</span>
            <span><strong>Hiệu lực từ:</strong> {{ selectedLaw.hieuluc || 'Chưa rõ' }}</span>
            <span><strong>Trạng thái:</strong> {{ getStatusLabel(selectedLaw.status) }}</span>
          </div>

          <!-- Banner liên kết trực tiếp website chuyên ngành bên thứ 3 -->
          <div style="background:linear-gradient(135deg, rgba(46,125,50,0.08), rgba(27,94,32,0.03));border:1px solid rgba(46,125,50,0.25);padding:10px 14px;border-radius:var(--radius);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="font-size:13px;color:var(--accent);display:flex;align-items:center;gap:8px;font-weight:500">
              <span style="font-size:16px">🌐</span>
              <span>Trang tra cứu chuyên ngành <strong>luatmoitruong.vn</strong>:</span>
            </div>
            <a :href="getDirectLawLink(selectedLaw)" target="_blank" rel="noopener noreferrer"
              style="display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:#fff;font-size:12.5px;font-weight:600;padding:6px 12px;border-radius:6px;text-decoration:none;box-shadow:0 1px 3px rgba(0,0,0,0.1);transition:opacity 0.2s">
              Xem toàn văn gốc trực tiếp ↗
            </a>
          </div>

          <!-- Mô tả tóm tắt -->
          <div v-if="selectedLaw.mo_ta" style="margin-bottom:18px">
            <h4 style="font-size:13.5px;font-weight:700;margin:0 0 6px;color:var(--text)">Mô tả tóm tắt:</h4>
            <p style="font-size:13.5px;color:var(--text2);line-height:1.6;background:var(--surface2);padding:10px 14px;border-radius:var(--radius);margin:0;border:1px solid var(--border)">
              {{ selectedLaw.mo_ta }}
            </p>
          </div>

          <!-- Danh sách điều khoản / phụ lục với accordion -->
          <div style="margin-bottom:20px">
            <!-- Header điều khoản & nút mở rộng/thu gọn -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
              <h4 style="font-size:13.5px;font-weight:700;margin:0;color:var(--text)">
                Các điều khoản / Phụ lục quy định
                <span v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length" style="font-size:12px;color:var(--text3);font-weight:normal">
                  ({{ filteredProvisionsWithIndex.length }}/{{ selectedLaw.dieu_khoang.length }} mục)
                </span>
              </h4>
              <div v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length > 1" style="display:flex;align-items:center;gap:6px">
                <button type="button" @click="expandAllProvisions"
                  style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:11.5px;color:var(--text2);cursor:pointer;font-family:inherit">
                  + Mở rộng tất cả
                </button>
                <button type="button" @click="collapseAllProvisions"
                  style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:11.5px;color:var(--text2);cursor:pointer;font-family:inherit">
                  − Thu gọn tất cả
                </button>
              </div>
            </div>

            <!-- Ô tìm kiếm điều khoản nhanh khi danh sách dài -->
            <div v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length > 3" style="margin-bottom:10px">
              <input type="text" v-model="provisionSearchQuery"
                placeholder="Tìm nhanh trong các điều khoản (vd: Điều 1, QCVN, quan trắc...)..."
                style="width:100%;padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-size:12.5px;font-family:inherit" />
            </div>

            <!-- Danh sách Accordion -->
            <div style="display:flex;flex-direction:column;gap:8px">
              <div v-for="{ d, index } in filteredProvisionsWithIndex" :key="index"
                style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">
                
                <!-- Tiêu đề mục: Click để đóng / mở -->
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
                    <span style="color:var(--accent);margin-top:2px;font-size:13px">✦</span>
                    <strong style="font-size:13.5px;color:var(--text);line-height:1.45">{{ getProvisionTitle(d) }}</strong>
                  </div>
                  <div v-if="getProvisionContent(d)" style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    <span style="font-size:11.5px;color:var(--accent);padding:3px 8px;border-radius:4px;background:rgba(46,125,50,0.08);font-weight:600">
                      {{ isProvisionExpanded(index) ? 'Thu gọn ▲' : 'Xem nội dung ▼' }}
                    </span>
                  </div>
                </div>

                <!-- Chi tiết nội dung điều khoản: Thu gọn / Mở rộng -->
                <div v-if="getProvisionContent(d) && isProvisionExpanded(index)"
                  style="padding:14px 16px;border-top:1px dashed var(--border);background:var(--surface);font-size:13px;color:var(--text);line-height:1.7;white-space:pre-wrap;font-family:inherit">
                  {{ getProvisionContent(d) }}
                </div>
              </div>

              <!-- Trạng thái trống khi tìm kiếm hoặc chưa có điều khoản -->
              <div v-if="selectedLaw.dieu_khoang && selectedLaw.dieu_khoang.length > 0 && filteredProvisionsWithIndex.length === 0"
                style="color:var(--text3);font-size:13px;font-style:italic;text-align:center;padding:16px;background:var(--surface2);border-radius:var(--radius)">
                Không tìm thấy điều khoản nào khớp với "{{ provisionSearchQuery }}".
              </div>
              <div v-if="!selectedLaw.dieu_khoang || selectedLaw.dieu_khoang.length === 0"
                style="color:var(--text3);font-size:13px;font-style:italic;padding:12px;background:var(--surface2);border-radius:var(--radius)">
                Chưa cập nhật các điều khoản chi tiết cho văn bản này. Bạn có thể xem liên kết trực tiếp trên luatmoitruong.vn bên trên.
              </div>
            </div>
          </div>

          <div v-if="selectedLaw.note" style="margin-bottom:20px;">
            <div style="font-size:13px;color:var(--warn);padding:10px 14px;background:var(--warn-bg);border-radius:var(--radius);border-left:4px solid #D4860A">
              ⚡ <strong>Ghi chú:</strong> {{ selectedLaw.note }}
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:16px;margin-top:16px;flex-wrap:wrap;gap:10px">
            <button type="button" @click="selectedLaw = null"
              style="background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:8px 18px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit">
              ✕ Đóng lại
            </button>
            <a :href="getDirectLawLink(selectedLaw)" target="_blank" rel="noopener noreferrer" class="btn-classify"
              style="width:auto;margin:0;padding:8px 18px;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:13px">
              🌐 Xem toàn văn trên luatmoitruong.vn ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
