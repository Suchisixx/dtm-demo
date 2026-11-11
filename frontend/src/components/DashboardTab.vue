<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'
import { normalizeString } from '../utils/string-helpers.js'

const props = defineProps({
  currentUser: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['view-project', 'view-qcvn-sample', 'navigate'])

const loading = ref(true)
const errorMsg = ref('')
const selectedStaffId = ref('all')

const stats = ref({
  kpis: {
    totalProjects: 0,
    highRiskProjects: 0,
    gisMappedProjects: 0,
    monitoredProjects: 0,
    avgChecklistPercent: 0,
    completedChecklistProjects: 0,
    totalSamples: 0,
    linkedSamples: 0,
    passSamples: 0,
    warnSamples: 0,
    failSamples: 0,
    incompleteSamples: 0,
    needsReviewSamples: 0,
    needsReviewProjects: 0,
    unverifiedProjects: 0,
    complianceRate: 100,
    totalLaws: 0,
    validLaws: 0,
    amendedLaws: 0
  },
  distributions: {
    byGroup: { 'Nhóm I': 0, 'Nhóm II': 0, 'Nhóm III': 0, 'Nhóm IV': 0, 'Cần rà soát': 0 },
    byDossier: { DTM: 0, GPMT: 0, DKMT: 0 },
    byAuthority: { cap_bo: 0, cap_so: 0, cap_xa: 0, cap_huyen: 0, chua_xac_dinh: 0 },
    byQcvnType: [],
    topIndustries: [],
    topProvinces: []
  },
  environmentalLoad: {
    totalWastewater: 0,
    totalAirEmission: 0,
    projectsWithWastewater: 0,
    projectsWithAirEmission: 0,
    sensitiveCounts: {
      rung: 0,
      lua: 0,
      bg: 0,
      kcn: 0,
      ctnh: 0,
      morongdt: 0,
      phanky: 0,
      dtcong: 0
    }
  },
  alertSamples: [],
  projectHealthList: [],
  staffList: []
})

const healthFilter = ref('all')
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

watch(pageSize, () => {
  currentPage.value = 1
})

const fetchDashboardStats = async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    let url = API.DASHBOARD_STATS
    if (props.currentUser?.role === 'admin' && selectedStaffId.value !== 'all') {
      url += `?user_id=${encodeURIComponent(selectedStaffId.value)}`
    }
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error('Không thể tải dữ liệu thống kê từ máy chủ')
    }
    const data = await res.json()
    stats.value = data
    currentPage.value = 1
  } catch (err) {
    logger.error('Lỗi tải Dashboard:', err)
    errorMsg.value = err.message || 'Đã xảy ra lỗi khi tải bảng điều khiển.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchDashboardStats()
})

const GROUP_META = [
  { key: 'Nhóm I', label: 'Nhóm I (Nguy cơ cao)', color: '#D65B5B', bg: '#FDF0F0' },
  { key: 'Nhóm II', label: 'Nhóm II (Nguy cơ TB)', color: '#D99A38', bg: '#FCF6EC' },
  { key: 'Nhóm III', label: 'Nhóm III (Ít nguy cơ)', color: '#5681A5', bg: '#EFF4F8' },
  { key: 'Nhóm IV', label: 'Nhóm IV (Không nguy cơ)', color: '#286B4F', bg: '#EAF3ED' }
]

const donutSegments = computed(() => {
  const total = stats.value.kpis.totalProjects || 0
  const circumference = 2 * Math.PI * 56
  let accumulatedPercent = 0

  return GROUP_META.map(g => {
    const count = stats.value.distributions.byGroup?.[g.key] || 0
    const pct = total > 0 ? (count / total) * 100 : 0
    const dashArray = `${(pct / 100) * circumference} ${circumference}`
    const dashOffset = -((accumulatedPercent / 100) * circumference)
    accumulatedPercent += pct
    return {
      ...g,
      count,
      percent: Math.round(pct),
      dashArray,
      dashOffset
    }
  })
})

const DOSSIER_META = [
  { key: 'DTM', label: 'Đánh giá tác động MT (ĐTM)', desc: 'Điều 30 Luật BVMT', color: '#D65B5B', bg: '#FDF0F0' },
  { key: 'GPMT', label: 'Giấy phép môi trường (GPMT)', desc: 'Điều 39 Luật BVMT', color: '#D99A38', bg: '#FCF6EC' },
  { key: 'DKMT', label: 'Đăng ký môi trường (ĐKMT)', desc: 'Điều 49 Luật BVMT', color: '#286B4F', bg: '#EAF3ED' }
]

const AUTHORITY_META = [
  { key: 'cap_bo', label: 'Bộ NN&MT (Cấp Bộ)', icon: 'ti-building-bank' },
  { key: 'cap_so', label: 'UBND Cấp Tỉnh / Sở NN&MT', icon: 'ti-building-community' },
  { key: 'cap_xa', label: 'UBND Cấp Xã / Phường', icon: 'ti-building' },
  { key: 'cap_huyen', label: 'UBND Cấp Huyện (Lịch sử trước 01/07/2025)', icon: 'ti-history' },
  { key: 'chua_xac_dinh', label: 'Chưa xác định thẩm quyền', icon: 'ti-help-circle' }
]

const SENSITIVE_META = [
  { key: 'kcn', label: 'Nằm trong KCN / KCX', icon: 'ti-building-factory-2' },
  { key: 'ctnh', label: 'Xử lý chất thải nguy hại', icon: 'ti-biohazard' },
  { key: 'rung', label: 'Đất rừng tự nhiên / đặc dụng', icon: 'ti-trees' },
  { key: 'lua', label: 'Chuyển đất lúa ≥ 2 vụ', icon: 'ti-plant-2' },
  { key: 'bg', label: 'Di sản / Bảo tồn / Biên giới', icon: 'ti-shield-pin' },
  { key: 'morongdt', label: 'Mở rộng / nâng công suất', icon: 'ti-trending-up' },
  { key: 'phanky', label: 'Phân kỳ đầu tư', icon: 'ti-calendar-stats' },
  { key: 'dtcong', label: 'Dự án đầu tư công', icon: 'ti-briefcase' }
]

const filterCounts = computed(() => {
  const list = stats.value.projectHealthList || []
  return {
    all: list.length,
    alert: list.filter(p => p.latest_sample_status === 'vuot_nguong' || p.latest_sample_status === 'canh_bao').length,
    incomplete: list.filter(p => p.checklist_percent < 100).length,
    unmonitored: list.filter(p => p.sample_count === 0).length
  }
})

const filteredProjects = computed(() => {
  let list = stats.value.projectHealthList || []

  if (healthFilter.value === 'alert') {
    list = list.filter(p => p.latest_sample_status === 'vuot_nguong' || p.latest_sample_status === 'canh_bao')
  } else if (healthFilter.value === 'incomplete') {
    list = list.filter(p => p.checklist_percent < 100)
  } else if (healthFilter.value === 'unmonitored') {
    list = list.filter(p => p.sample_count === 0)
  }

  if (searchQuery.value.trim()) {
    const q = normalizeString(searchQuery.value)
    list = list.filter(p =>
      normalizeString(p.name).includes(q) ||
      normalizeString(p.tinh).includes(q) ||
      normalizeString(p.nganh_label).includes(q) ||
      normalizeString(p.user_name).includes(q)
    )
  }

  return list
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredProjects.value.length / pageSize.value)))

const paginatedProjects = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredProjects.value.slice(start, start + pageSize.value)
})

const setHealthFilter = (f) => {
  healthFilter.value = f
  currentPage.value = 1
}

const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  return Number(num).toLocaleString('vi-VN')
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('vi-VN')
}

const getGroupColor = (nhom) => {
  if (nhom === 'Nhóm I') return '#D65B5B'
  if (nhom === 'Nhóm II') return '#D99A38'
  if (nhom === 'Nhóm III') return '#5681A5'
  if (nhom === 'Cần rà soát') return '#6B7280'
  return '#286B4F'
}

const getDashboardSampleBadge = (status) => {
  switch (status) {
    case 'vuot_nguong':
      return { cls: 'expired', label: 'Vượt ngưỡng' }
    case 'canh_bao':
      return { cls: 'amended', label: 'Cảnh báo' }
    case 'dat':
    case 'dat_chuan':
      return { cls: 'valid', label: 'Đạt chuẩn' }
    case 'chua_du_thong_so':
      return { cls: 'neutral', label: 'Thiếu chỉ tiêu' }
    case 'period_mismatch':
      return { cls: 'neutral', label: 'Lệch chu kỳ' }
    case 'can_ra_soat':
    default:
      return { cls: 'neutral', label: 'Cần rà soát' }
  }
}

const printDashboard = () => {
  window.print()
}
</script>

<template>
  <div class="container fade-up">
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span class="chip chip-info">
            <i class="ti" :class="currentUser?.role === 'admin' ? 'ti-building-Skyscraper' : 'ti-user'"></i>
            {{ currentUser?.role === 'admin' ? (selectedStaffId === 'all' ? 'Toàn hệ thống' : 'Theo chuyên viên') : 'Hồ sơ cá nhân' }}
          </span>
          <button type="button" class="chip chip-gray" style="cursor:pointer" @click="emit('navigate', 'laws')">
            <i class="ti ti-scale"></i>
            <span>Kho luật: <strong>{{ stats.kpis.validLaws }}</strong> hiệu lực / {{ stats.kpis.totalLaws }} văn bản</span>
          </button>
        </div>
        <h2 class="section-head">Trung tâm Điều hành Hồ sơ Môi trường</h2>
        <p class="section-desc">
          Giám sát phân nhóm dự án, tiến độ hoàn thiện hồ sơ pháp lý (ĐTM / GPMT / ĐKMT), tải lượng phát thải và tuân thủ quy chuẩn QCVN.
        </p>
      </div>

      <div class="no-print" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div v-if="currentUser?.role === 'admin' && stats.staffList.length > 0" style="display:flex;align-items:center;gap:8px">
          <span style="font-size:12.5px;color:var(--text2);font-weight:500;white-space:nowrap">Chuyên viên:</span>
          <select v-model="selectedStaffId" @change="fetchDashboardStats" style="width:210px">
            <option value="all">Tất cả nhân sự ({{ stats.staffList.length }})</option>
            <option v-for="u in stats.staffList" :key="u.id" :value="String(u.id)">
              {{ u.full_name }} ({{ u.role === 'admin' ? 'Admin' : 'Staff' }})
            </option>
          </select>
        </div>

        <button type="button" class="btn-secondary" @click="fetchDashboardStats" :disabled="loading">
          <i class="ti ti-refresh"></i>
          <span>Làm mới</span>
        </button>
        <button type="button" class="btn-primary" @click="printDashboard">
          <i class="ti ti-printer"></i>
          <span>In báo cáo</span>
        </button>
      </div>
    </div>

    <!-- LOADING / ERROR -->
    <div v-if="loading" class="card" style="text-align:center;padding:48px 20px;color:var(--text2)">
      <i class="ti ti-loader" style="font-size:24px;color:var(--accent);display:block;margin-bottom:8px"></i>
      <span>Đang tổng hợp dữ liệu dự án và mẫu quan trắc QCVN...</span>
    </div>

    <div v-else-if="errorMsg" class="card" style="text-align:center;padding:36px 20px;border-color:var(--danger-border);background:var(--red-bg)">
      <div style="font-size:14px;font-weight:600;color:var(--red);margin-bottom:10px">
        <i class="ti ti-alert-circle"></i> {{ errorMsg }}
      </div>
      <button type="button" class="btn-secondary btn-sm" @click="fetchDashboardStats">Thử lại</button>
    </div>

    <template v-else>
      <!-- ROW 1: 4 CORE KPI CARDS -->
      <div class="kpi-grid">
        <!-- KPI 1: Tổng dự án -->
        <div class="kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Tổng số dự án</span>
            <div class="kpi-icon"><i class="ti ti-folder"></i></div>
          </div>
          <div class="kpi-value">{{ formatNumber(stats.kpis.totalProjects) }}</div>
          <div class="kpi-sub">
            <i class="ti ti-map-pin" style="color:var(--accent)"></i>
            Đã định vị GIS: <strong>{{ stats.kpis.gisMappedProjects }}/{{ stats.kpis.totalProjects }}</strong> dự án
          </div>
        </div>

        <!-- KPI 2: Dự án Nhóm I & II -->
        <div class="kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Dự án Nhóm I &amp; II</span>
            <div class="kpi-icon warn"><i class="ti ti-alert-triangle"></i></div>
          </div>
          <div class="kpi-value" style="color:var(--warn)">{{ formatNumber(stats.kpis.highRiskProjects) }}</div>
          <div class="kpi-sub">
            Chiếm <strong>{{ stats.kpis.totalProjects > 0 ? Math.round((stats.kpis.highRiskProjects / stats.kpis.totalProjects) * 100) : 0 }}%</strong> dự án nguy cơ MT cao &amp; TB
            <span v-if="stats.kpis.needsReviewProjects > 0" style="display:block;color:var(--red);margin-top:2px">
              <strong>{{ stats.kpis.needsReviewProjects }}</strong> dự án cần rà soát pháp lý
            </span>
          </div>
        </div>

        <!-- KPI 3: Tỷ lệ mẫu đạt QCVN -->
        <div class="kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Tỷ lệ mẫu đạt QCVN</span>
            <div class="kpi-icon" :class="{ danger: stats.kpis.failSamples > 0 }">
              <i class="ti ti-flask-2"></i>
            </div>
          </div>
          <div class="kpi-value" :style="{ color: stats.kpis.failSamples > 0 ? 'var(--red)' : 'var(--success)' }">
            {{ stats.kpis.complianceRate }}%
          </div>
          <div class="kpi-sub" style="display:flex;gap:8px;flex-wrap:wrap">
            <span style="color:var(--success);font-weight:600">{{ stats.kpis.passSamples }} đạt</span>
            <span style="color:var(--warn);font-weight:600">{{ stats.kpis.warnSamples }} cảnh báo</span>
            <span style="color:var(--red);font-weight:600">{{ stats.kpis.failSamples }} vượt</span>
            <span v-if="stats.kpis.incompleteSamples > 0" style="color:#475569;font-weight:600">{{ stats.kpis.incompleteSamples }} thiếu chỉ tiêu</span>
            <span v-if="stats.kpis.needsReviewSamples > 0" style="color:#4B5563;font-weight:600">{{ stats.kpis.needsReviewSamples }} rà soát</span>
          </div>
        </div>

        <!-- KPI 4: Tiến độ hoàn thiện hồ sơ -->
        <div class="kpi-card">
          <div class="kpi-card-top">
            <span class="kpi-label">Tiến độ hoàn thiện hồ sơ</span>
            <div class="kpi-icon info"><i class="ti ti-checklist"></i></div>
          </div>
          <div class="kpi-value" style="color:var(--info)">{{ stats.kpis.avgChecklistPercent }}%</div>
          <div class="kpi-sub">
            Hoàn tất 100%: <strong>{{ stats.kpis.completedChecklistProjects }}/{{ stats.kpis.totalProjects }}</strong> hồ sơ
          </div>
        </div>
      </div>

      <!-- ROW 2: CHARTS & DISTRIBUTIONS -->
      <div class="dash-two-col">
        <!-- Left: Phân bố nhóm dự án & Loại hồ sơ -->
        <div class="card" style="margin-bottom:0">
          <div class="card-header">
            <div>
              <div class="card-title">
                <i class="ti ti-chart-pie"></i>
                <span>Phân bố Nhóm Dự án &amp; Hồ sơ Môi trường</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px">
                Theo Điều 28 Luật BVMT 2020 &amp; Nghị định 08/2022/NĐ-CP (cập nhật NĐ 48/2026)
              </div>
            </div>
          </div>

          <div class="dash-donut-layout">
            <div class="dash-donut-wrap">
              <svg viewBox="0 0 144 144" class="dash-donut-svg">
                <circle cx="72" cy="72" r="56" fill="none" stroke="var(--surface2)" stroke-width="16" />
                <circle
                  v-for="seg in donutSegments"
                  :key="seg.key"
                  v-show="seg.count > 0"
                  cx="72"
                  cy="72"
                  r="56"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="16"
                  :stroke-dasharray="seg.dashArray"
                  :stroke-dashoffset="seg.dashOffset"
                  transform="rotate(-90 72 72)"
                />
                <text x="72" y="68" text-anchor="middle" style="font-size:22px;font-weight:700;fill:var(--text)">{{ stats.kpis.totalProjects }}</text>
                <text x="72" y="85" text-anchor="middle" style="font-size:10.5px;font-weight:600;fill:var(--text3);text-transform:uppercase">Dự án</text>
              </svg>
            </div>

            <div class="dash-legend-list">
              <div v-for="seg in donutSegments" :key="seg.key" class="dash-legend-row">
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="width:10px;height:10px;border-radius:3px;flex-shrink:0" :style="{ background: seg.color }"></span>
                  <span style="font-size:13px;color:var(--text2);font-weight:500">{{ seg.label }}</span>
                </div>
                <div style="font-size:13px;color:var(--text)">
                  <strong>{{ seg.count }}</strong>
                  <span style="color:var(--text3);font-size:12px;margin-left:4px">({{ seg.percent }}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="dash-split-sub">
            <div>
              <div class="dash-sub-title">Loại hồ sơ pháp lý</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div v-for="d in DOSSIER_META" :key="d.key" class="dash-mini-stat-row">
                  <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text)">{{ d.label }}</div>
                    <div style="font-size:11.5px;color:var(--text3)">{{ d.desc }}</div>
                  </div>
                  <span class="chip" :style="{ background: d.bg, color: d.color }">{{ stats.distributions.byDossier?.[d.key] || 0 }}</span>
                </div>
              </div>
            </div>

            <div>
              <div class="dash-sub-title">Thẩm quyền cấp phép</div>
              <div style="display:flex;flex-direction:column;gap:8px">
                <div v-for="a in AUTHORITY_META.filter(a => a.key !== 'chua_xac_dinh' || (stats.distributions.byAuthority?.[a.key] || 0) > 0)" :key="a.key" class="dash-mini-stat-row">
                  <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);font-weight:500">
                    <i class="ti" :class="a.icon" style="color:var(--accent);font-size:16px"></i>
                    <span>{{ a.label }}</span>
                  </div>
                  <strong style="font-size:13px;color:var(--text)">{{ stats.distributions.byAuthority?.[a.key] || 0 }}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Kết quả quan trắc QCVN & Cảnh báo -->
        <div class="card" style="margin-bottom:0">
          <div class="card-header">
            <div>
              <div class="card-title">
                <i class="ti ti-activity"></i>
                <span>Kết quả Quan trắc theo Quy chuẩn (QCVN)</span>
              </div>
              <div style="font-size:12px;color:var(--text3);margin-top:2px">
                Phân tích tỷ lệ Đạt / Cảnh báo / Vượt ngưỡng / Thiếu chỉ tiêu / Cần rà soát
              </div>
            </div>
            <div style="display:flex;gap:8px;font-size:11.5px;color:var(--text2);flex-wrap:wrap">
              <span style="display:inline-flex;align-items:center;gap:4px"><i style="width:8px;height:8px;border-radius:2px;background:var(--success)"></i> Đạt</span>
              <span style="display:inline-flex;align-items:center;gap:4px"><i style="width:8px;height:8px;border-radius:2px;background:var(--warn)"></i> Cảnh báo</span>
              <span style="display:inline-flex;align-items:center;gap:4px"><i style="width:8px;height:8px;border-radius:2px;background:var(--red)"></i> Vượt</span>
              <span style="display:inline-flex;align-items:center;gap:4px"><i style="width:8px;height:8px;border-radius:2px;background:#64748B"></i> Thiếu</span>
              <span style="display:inline-flex;align-items:center;gap:4px"><i style="width:8px;height:8px;border-radius:2px;background:#9CA3AF"></i> Rà soát</span>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:12px">
            <div v-for="item in stats.distributions.byQcvnType" :key="item.type">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:12.5px;margin-bottom:5px">
                <span style="font-weight:500;color:var(--text)">{{ item.label }}</span>
                <span style="color:var(--text3);font-size:12px">
                  <strong style="color:var(--text)">{{ item.total }}</strong> mẫu
                  <template v-if="item.total > 0">
                    ({{ item.dat || 0 }} đạt · {{ item.canh_bao || 0 }} CB · {{ item.vuot_nguong || 0 }} vượt<template v-if="(item.chua_du_thong_so || 0) > 0"> · {{ item.chua_du_thong_so }} thiếu</template><template v-if="(item.can_ra_soat || 0) > 0"> · {{ item.can_ra_soat }} rà soát</template>)
                  </template>
                </span>
              </div>
              <div class="dash-bar-track">
                <template v-if="item.total > 0">
                  <div v-if="item.dat > 0" class="dash-bar-seg pass" :style="{ width: (item.dat / item.total) * 100 + '%' }"></div>
                  <div v-if="item.canh_bao > 0" class="dash-bar-seg warn" :style="{ width: (item.canh_bao / item.total) * 100 + '%' }"></div>
                  <div v-if="item.vuot_nguong > 0" class="dash-bar-seg fail" :style="{ width: (item.vuot_nguong / item.total) * 100 + '%' }"></div>
                  <div v-if="item.chua_du_thong_so > 0" class="dash-bar-seg incomplete" :style="{ width: (item.chua_du_thong_so / item.total) * 100 + '%' }"></div>
                  <div v-if="item.can_ra_soat > 0" class="dash-bar-seg review" :style="{ width: (item.can_ra_soat / item.total) * 100 + '%' }"></div>
                </template>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <div class="dash-sub-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>Mẫu quan trắc cần chú ý gần đây</span>
            <span style="font-weight:400;text-transform:none;font-size:11.5px;color:var(--text3)">Nhấn để mở bảng thông số</span>
          </div>

          <div v-if="stats.alertSamples.length === 0" style="padding:14px;background:var(--success-bg);border:1px solid var(--success-border);border-radius:var(--radius);font-size:13px;color:var(--success);display:flex;align-items:center;gap:8px">
            <i class="ti ti-circle-check"></i>
            <span>Tất cả mẫu quan trắc hiện tại đều nằm trong giới hạn cho phép.</span>
          </div>
          <div v-else style="display:flex;flex-direction:column;gap:8px">
            <div v-for="s in stats.alertSamples.slice(0, 4)" :key="s.id"
                 class="dash-alert-item" @click="emit('view-qcvn-sample', s.id)">
              <div style="min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span>{{ s.name }}</span>
                  <span v-if="s.project_name" style="font-size:11.5px;font-weight:500;color:var(--accent)">
                    <i class="ti ti-link"></i> {{ s.project_name }}
                  </span>
                </div>
                <div style="font-size:12px;color:var(--text3);margin-top:2px">
                  {{ s.type_label }} · {{ formatDate(s.created_at) }}
                </div>
              </div>
              <span class="chip-status" :class="getDashboardSampleBadge(s.status).cls">
                {{ getDashboardSampleBadge(s.status).label }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- ROW 3: ENVIRONMENTAL LOAD & TOP RANKINGS -->
      <div class="dash-three-col" style="margin-top:16px">
        <!-- Col 1: Tải lượng phát thải & Yếu tố nhạy cảm -->
        <div class="card" style="margin-bottom:0">
          <div class="card-title" style="margin-bottom:12px">
            <i class="ti ti-droplet-half-2"></i>
            <span>Tải lượng Xả thải &amp; Yếu tố Nhạy cảm</span>
          </div>

          <div class="form-grid-2" style="margin-bottom:14px">
            <div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
              <div style="font-size:11.5px;color:var(--text2);font-weight:500">Tổng lưu lượng Nước thải</div>
              <div style="font-size:18px;font-weight:700;color:var(--accent);margin:4px 0 2px">
                {{ formatNumber(stats.environmentalLoad.totalWastewater) }} <small style="font-size:11.5px;font-weight:500;color:var(--text3)">m³/ngày</small>
              </div>
              <div style="font-size:11px;color:var(--text3)">{{ stats.environmentalLoad.projectsWithWastewater }} dự án phát sinh</div>
            </div>
            <div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius)">
              <div style="font-size:11.5px;color:var(--text2);font-weight:500">Tổng lưu lượng Khí thải</div>
              <div style="font-size:18px;font-weight:700;color:var(--info);margin:4px 0 2px">
                {{ formatNumber(stats.environmentalLoad.totalAirEmission) }} <small style="font-size:11.5px;font-weight:500;color:var(--text3)">m³/giờ</small>
              </div>
              <div style="font-size:11px;color:var(--text3)">{{ stats.environmentalLoad.projectsWithAirEmission }} dự án phát sinh</div>
            </div>
          </div>

          <div class="dash-sub-title">Đặc thù môi trường ghi nhận</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div v-for="sf in SENSITIVE_META" :key="sf.key"
                 style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px"
                 :style="(stats.environmentalLoad.sensitiveCounts?.[sf.key] || 0) > 0 ? { background: 'var(--accent2)', borderColor: 'var(--success-border)', color: 'var(--accent)' } : { color: 'var(--text2)' }">
              <span style="display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                <i class="ti" :class="sf.icon"></i>
                <span>{{ sf.label }}</span>
              </span>
              <strong>{{ stats.environmentalLoad.sensitiveCounts?.[sf.key] || 0 }}</strong>
            </div>
          </div>
        </div>

        <!-- Col 2: Top Ngành nghề -->
        <div class="card" style="margin-bottom:0">
          <div class="card-title" style="margin-bottom:12px">
            <i class="ti ti-building-factory"></i>
            <span>Phân bố theo Ngành nghề</span>
          </div>
          <div v-if="stats.distributions.topIndustries.length === 0" style="color:var(--text3);font-size:13px;padding:24px 0;text-align:center">
            Chưa có dữ liệu ngành nghề dự án
          </div>
          <div v-else style="display:flex;flex-direction:column;gap:12px">
            <div v-for="(ind, idx) in stats.distributions.topIndustries" :key="ind.code">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="color:var(--text);font-weight:500">{{ idx + 1 }}. {{ ind.label }}</span>
                <span style="color:var(--text2);font-weight:600">{{ ind.count }} dự án</span>
              </div>
              <div class="dash-bar-track" style="height:6px">
                <div style="height:100%;background:var(--accent);border-radius:3px"
                     :style="{ width: Math.max(8, (ind.count / (stats.kpis.totalProjects || 1)) * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Col 3: Top Địa phương -->
        <div class="card" style="margin-bottom:0">
          <div class="card-title" style="margin-bottom:12px">
            <i class="ti ti-map-pin"></i>
            <span>Phân bố theo Địa phương</span>
          </div>
          <div v-if="stats.distributions.topProvinces.length === 0" style="color:var(--text3);font-size:13px;padding:24px 0;text-align:center">
            Chưa có dữ liệu địa phương
          </div>
          <div v-else style="display:flex;flex-direction:column;gap:12px">
            <div v-for="(prov, idx) in stats.distributions.topProvinces" :key="prov.name">
              <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
                <span style="color:var(--text);font-weight:500">{{ idx + 1 }}. {{ prov.name }}</span>
                <span style="color:var(--text2);font-weight:600">{{ prov.count }} dự án</span>
              </div>
              <div class="dash-bar-track" style="height:6px">
                <div style="height:100%;background:var(--info);border-radius:3px"
                     :style="{ width: Math.max(8, (prov.count / (stats.kpis.totalProjects || 1)) * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ROW 4: PROJECT HEALTH & RECENT PROJECTS TABLE -->
      <div class="card" style="margin-top:16px;padding:0;overflow:hidden">
        <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
          <div>
            <div class="card-title">
              <i class="ti ti-Clipboard-list"></i>
              <span>Danh sách Dự án &amp; Trạng thái Hồ sơ</span>
            </div>
            <div style="font-size:12.5px;color:var(--text3);margin-top:2px">
              Theo dõi tiến độ checklist pháp lý và kết quả đối chiếu mẫu quan trắc của từng dự án
            </div>
          </div>

          <div class="no-print" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="position:relative;width:260px">
              <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
              <input v-model="searchQuery" @input="currentPage = 1" type="text"
                     placeholder="Tìm dự án, tỉnh thành, ngành..." style="padding-left:32px" />
            </div>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="no-print" style="padding:10px 22px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="filter-btn" :class="{ on: healthFilter === 'all' }" @click="setHealthFilter('all')">
            Tất cả dự án ({{ filterCounts.all }})
          </button>
          <button type="button" class="filter-btn" :class="{ on: healthFilter === 'alert' }" @click="setHealthFilter('alert')">
            <i class="ti ti-alert-triangle"></i> Cần chú ý / Vượt QCVN ({{ filterCounts.alert }})
          </button>
          <button type="button" class="filter-btn" :class="{ on: healthFilter === 'incomplete' }" @click="setHealthFilter('incomplete')">
            <i class="ti ti-clock"></i> Hồ sơ chưa hoàn tất ({{ filterCounts.incomplete }})
          </button>
          <button type="button" class="filter-btn" :class="{ on: healthFilter === 'unmonitored' }" @click="setHealthFilter('unmonitored')">
            <i class="ti ti-flask-off"></i> Chưa có mẫu quan trắc ({{ filterCounts.unmonitored }})
          </button>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table" style="min-width:860px">
            <thead>
              <tr>
                <th>Dự án &amp; Địa điểm</th>
                <th>Phân loại &amp; Hồ sơ</th>
                <th>Tải lượng xả thải</th>
                <th style="width:170px">Tiến độ Hồ sơ</th>
                <th>Quan trắc QCVN</th>
                <th class="no-print" style="text-align:right;width:120px">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedProjects.length === 0">
                <td colspan="6" style="text-align:center;padding:36px 16px;color:var(--text3)">
                  Không tìm thấy dự án nào khớp với bộ lọc hiện tại.
                </td>
              </tr>
              <tr v-for="proj in paginatedProjects" :key="proj.id">
                <td>
                  <div style="font-weight:600;color:var(--accent);cursor:pointer" @click="emit('view-project', proj.id)">
                    {{ proj.name }}
                  </div>
                  <div style="font-size:12px;color:var(--text2);margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <span><i class="ti ti-map-pin" style="color:var(--text3)"></i> {{ proj.tinh }}</span>
                    <span>· {{ proj.nganh_label }}</span>
                    <span v-if="proj.has_gis" class="chip chip-gray" style="height:20px;font-size:10.5px;padding:0 6px">Đã gắn GIS</span>
                  </div>
                  <div v-if="currentUser?.role === 'admin'" style="font-size:11.5px;color:var(--text3);margin-top:2px">
                    Phụ trách: {{ proj.user_name }} · {{ formatDate(proj.created_at) }}
                  </div>
                </td>

                <td>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <span class="chip" :style="{ background: getGroupColor(proj.nhom) + '15', color: getGroupColor(proj.nhom), border: '1px solid ' + getGroupColor(proj.nhom) + '35' }">
                      {{ proj.nhom }}
                    </span>
                    <span class="chip chip-gray">{{ proj.hs }}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text3);margin-top:4px">{{ proj.co_quan }}</div>
                </td>

                <td style="font-size:12.5px;color:var(--text2)">
                  <div>NT: <strong style="color:var(--text)">{{ proj.nt > 0 ? formatNumber(proj.nt) + ' m³/ng' : '—' }}</strong></div>
                  <div style="margin-top:2px">KT: <strong style="color:var(--text)">{{ proj.kt > 0 ? formatNumber(proj.kt) + ' m³/h' : '—' }}</strong></div>
                </td>

                <td>
                  <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
                    <strong :style="{ color: proj.checklist_percent === 100 ? 'var(--success)' : 'var(--text)' }">{{ proj.checklist_percent }}%</strong>
                    <span style="color:var(--text3)">{{ proj.checklist_done }}/{{ proj.checklist_total }} mục</span>
                  </div>
                  <div class="dash-bar-track" style="height:6px">
                    <div style="height:100%;border-radius:3px;transition:width 0.3s"
                         :style="{
                           width: proj.checklist_percent + '%',
                           background: proj.checklist_percent === 100 ? 'var(--success)' : proj.checklist_percent >= 50 ? 'var(--warn)' : 'var(--text3)'
                         }"></div>
                  </div>
                </td>

                <td>
                  <template v-if="proj.sample_count > 0">
                    <span class="chip-status" style="cursor:pointer"
                          :class="getDashboardSampleBadge(proj.latest_sample_status).cls"
                          @click="proj.latest_sample_id && emit('view-qcvn-sample', proj.latest_sample_id)">
                      {{ getDashboardSampleBadge(proj.latest_sample_status).label }}
                      ({{ proj.sample_count }})
                    </span>
                    <div style="font-size:11.5px;color:var(--text3);margin-top:3px">
                      {{ proj.latest_sample_name }} · {{ formatDate(proj.latest_sample_date) }}
                    </div>
                  </template>
                  <span v-else style="font-size:12px;color:var(--text3)">Chưa quan trắc</span>
                </td>

                <td class="no-print" style="text-align:right">
                  <button type="button" class="btn-secondary btn-sm" @click="emit('view-project', proj.id)">
                    <span>Mở hồ sơ</span>
                    <i class="ti ti-arrow-right"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="filteredProjects.length > 0" class="no-print"
             style="padding:12px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;background:var(--surface)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> – <strong>{{ Math.min(currentPage * pageSize, filteredProjects.length) }}</strong> / {{ filteredProjects.length }} dự án
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="currentPage--">‹ Trước</button>
            <span style="font-size:12.5px;color:var(--text2);padding:0 8px">Trang <strong>{{ currentPage }}</strong> / {{ totalPages }}</span>
            <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="currentPage++">Sau ›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="pageSize" style="width:105px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash-two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dash-three-col {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 16px;
}

.dash-donut-layout {
  display: flex;
  align-items: center;
  gap: 24px;
}

.dash-donut-wrap {
  width: 136px;
  height: 136px;
  flex-shrink: 0;
}

.dash-donut-svg {
  width: 100%;
  height: 100%;
}

.dash-legend-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dash-legend-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg);
  border-radius: var(--radius-sm);
}

.dash-split-sub {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.dash-sub-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}

.dash-mini-stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.dash-bar-track {
  width: 100%;
  height: 8px;
  background: var(--surface2);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
}

.dash-bar-seg {
  height: 100%;
  transition: width 0.3s ease;
}

.dash-bar-seg.pass { background: var(--success); }
.dash-bar-seg.warn { background: var(--warn); }
.dash-bar-seg.fail { background: var(--red); }
.dash-bar-seg.incomplete { background: #64748B; }
.dash-bar-seg.review { background: #9CA3AF; }
.chip-status.neutral { background: #F3F4F6; color: #374151; border-color: #D1D5DB; }

.dash-alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.dash-alert-item:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}

@media (max-width: 1100px) {
  .dash-two-col,
  .dash-three-col {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dash-donut-layout,
  .dash-split-sub {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
