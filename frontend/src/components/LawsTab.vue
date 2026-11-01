<script setup>
import { ref, computed, onMounted } from 'vue'
import { LAW_BASE_URL, API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'

const laws = ref([])
const searchQuery = ref('')
const currentFilter = ref('all')
const selectedLaw = ref(null)

const fetchLaws = async () => {
  try {
    const res = await fetch(API.LAWS)
    if (res.ok) {
      laws.value = await res.json()
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

const getDirectLawLink = (l) => {
  if (l.link && l.link.startsWith(LAW_BASE_URL)) {
    return l.link
  }

  const cleanNum = normalizeString(l.so || '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (l.type === 'luat') {
    if (l.id.includes('bvmt')) return `${LAW_BASE_URL}luat-bao-ve-moi-truong-2020`
    if (l.id.includes('dat_dai')) return `${LAW_BASE_URL}luat-dat-dai-2024`
    if (l.id.includes('tainguyen_nuoc')) return `${LAW_BASE_URL}luat-tai-nguyen-nuoc-2023`
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

    <div id="law-list">
      <div v-if="filteredLaws.length === 0" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text3)">
        Không tìm thấy văn bản pháp lý nào phù hợp.
      </div>
      
      <div v-for="(l, i) in filteredLaws" :key="l.id" 
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

    <!-- Modal Chi tiết Văn bản Pháp lý -->
    <div v-if="selectedLaw" class="modal-overlay" style="display: flex;" @click.self="selectedLaw = null">
      <div class="modal-card fade-up" style="width:650px;max-height:85vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:12px">
          <span class="chip chip-status" :class="selectedLaw.status" style="font-size:11px">
            {{ getTypeLabel(selectedLaw.type) }}
          </span>
          <button @click="selectedLaw = null"
            style="background:transparent;border:none;font-size:24px;cursor:pointer;color:var(--text3);line-height:1">&times;</button>
        </div>
        <div>
          <h3 style="font-family:'Playfair Display',serif;font-size:22px;color:var(--accent);margin:0 0 6px;line-height:1.3">
            {{ selectedLaw.ten }}
          </h3>
          <div style="font-size:13px;color:var(--text2);margin-bottom:16px">
            Số hiệu: {{ selectedLaw.so }} | Hiệu lực từ: {{ selectedLaw.hieuluc || 'Chưa rõ' }} | Trạng thái: {{ getStatusLabel(selectedLaw.status) }}
          </div>

          <div style="margin-bottom:20px">
            <h4 style="font-size:14px;font-weight:700;margin:0 0 6px;color:var(--text)">Mô tả tóm tắt:</h4>
            <p style="font-size:14px;color:var(--text2);line-height:1.6;background:var(--surface2);padding:12px;border-radius:var(--radius);margin:0">
              {{ selectedLaw.mo_ta || 'Không có mô tả chi tiết.' }}
            </p>
          </div>

          <div style="margin-bottom:20px">
            <h4 style="font-size:14px;font-weight:700;margin:0 0 8px;color:var(--text)">Các điều khoản / Phụ lục quan trọng cần lưu ý:</h4>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div v-for="(d, idx) in selectedLaw.dieu_khoang" :key="idx"
                style="background:var(--surface);border:1px solid var(--border);padding:10px 14px;border-radius:var(--radius);font-size:14px;color:var(--text);line-height:1.5">
                <div style="display:flex;align-items:flex-start;gap:8px">
                  <span style="color:var(--accent);margin-top:2px">✦</span>
                  <strong>{{ getProvisionTitle(d) }}</strong>
                </div>
                <p v-if="getProvisionContent(d)" style="margin:6px 0 0 22px;font-size:13px;color:var(--text2);line-height:1.6;white-space:pre-wrap">{{ getProvisionContent(d) }}</p>
              </div>
              <div v-if="!selectedLaw.dieu_khoang || selectedLaw.dieu_khoang.length === 0" style="color:var(--text3);font-size:13px;font-style:italic">
                Chưa cập nhật các điều khoản chi tiết.
              </div>
            </div>
          </div>

          <div v-if="selectedLaw.note" style="margin-bottom:24px;">
            <div style="font-size:13px;color:var(--warn);padding:10px 14px;background:var(--warn-bg);border-radius:var(--radius);border-left:4px solid #D4860A">
              ⚡ <strong>Ghi chú:</strong> {{ selectedLaw.note }}
            </div>
          </div>

          <div style="display:flex;justify-content:center;align-items:center;border-top:1px solid var(--border);padding-top:16px;margin-top:16px">
            <a :href="getDirectLawLink(selectedLaw)" target="_blank" class="btn-classify"
              style="width:auto;margin:0;padding:8px 18px;text-decoration:none;display:inline-flex;align-items:center;gap:6px">
              📥 Xem file / Tải văn bản gốc
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
