<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { API, NHOM_COLORS } from '../utils/constants.js'
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
    complianceRate: 100,
    totalLaws: 0,
    validLaws: 0,
    amendedLaws: 0
  },
  distributions: {
    byGroup: { 'Nhóm I': 0, 'Nhóm II': 0, 'Nhóm III': 0, 'Nhóm IV': 0 },
    byDossier: { DTM: 0, GPMT: 0, DKMT: 0 },
    byAuthority: { cap_bo: 0, cap_so: 0, cap_huyen: 0 },
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

// Bộ lọc cho bảng sức khỏe dự án
const healthFilter = ref('all') // 'all' | 'alert' | 'incomplete' | 'unmonitored'
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

// Tính toán biểu đồ Donut SVG cho Nhóm dự án
const GROUP_META = [
  { key: 'Nhóm I', label: 'Nhóm I (Nguy cơ cao)', color: '#C0392B', bg: '#FDECEA' },
  { key: 'Nhóm II', label: 'Nhóm II (Nguy cơ TB)', color: '#D35400', bg: '#FFF4E5' },
  { key: 'Nhóm III', label: 'Nhóm III (Ít nguy cơ)', color: '#D4AC0D', bg: '#FEF9E7' },
  { key: 'Nhóm IV', label: 'Nhóm IV (Không nguy cơ)', color: '#1D5C3A', bg: '#E8F4EC' }
]

const donutSegments = computed(() => {
  const total = stats.value.kpis.totalProjects || 0
  const circumference = 2 * Math.PI * 58 // r = 58 -> ~364.42
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
  { key: 'DTM', label: 'Đánh giá tác động MT (ĐTM)', desc: 'Điều 30 Luật BVMT', color: '#7A1D1D', bg: '#FBEAEA' },
  { key: 'GPMT', label: 'Giấy phép môi trường (GPMT)', desc: 'Điều 39 Luật BVMT', color: '#8B4A0F', bg: '#FDF3E7' },
  { key: 'DKMT', label: 'Đăng ký môi trường (ĐKMT)', desc: 'Điều 49 Luật BVMT', color: '#1D5C3A', bg: '#E8F4EC' }
]

const AUTHORITY_META = [
  { key: 'cap_bo', label: 'Bộ NN&MT (Cấp Bộ)', icon: '🏛️' },
  { key: 'cap_so', label: 'UBND Cấp Tỉnh / Sở NN&MT', icon: '🏢' },
  { key: 'cap_huyen', label: 'UBND Cấp Xã / Phường', icon: '🏘️' }
]

const SENSITIVE_META = [
  { key: 'kcn', label: 'Nằm trong KCN / KCX', icon: '🏭' },
  { key: 'ctnh', label: 'Xử lý chất thải nguy hại', icon: '☣️' },
  { key: 'rung', label: 'Đất rừng tự nhiên / đặc dụng', icon: '🌲' },
  { key: 'lua', label: 'Chuyển đất lúa ≥ 2 vụ', icon: '🌾' },
  { key: 'bg', label: 'Di sản / Khu bảo tồn / Biên giới', icon: '🏞️' },
  { key: 'morongdt', label: 'Dự án mở rộng / nâng công suất', icon: '📈' },
  { key: 'phanky', label: 'Phân kỳ đầu tư nhiều giai đoạn', icon: '🗓️' },
  { key: 'dtcong', label: 'Dự án đầu tư công', icon: '🏗️' }
]

// Đếm số lượng theo từng tab bộ lọc sức khỏe dự án
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

const getGroupColor = (nhom) => NHOM_COLORS[nhom] || '#1D5C3A'

const printDashboard = () => {
  window.print()
}
</script>

<template>
  <div class="container fade-up">
    <!-- HEADER ĐIỀU HÀNH -->
    <div class="dash-header card">
      <div class="dash-header-left">
        <div class="dash-badge-row">
          <span class="dash-scope-pill">
            {{ currentUser?.role === 'admin' ? (selectedStaffId === 'all' ? '🌐 Toàn hệ thống' : '👤 Theo chuyên viên') : '👤 Hồ sơ cá nhân' }}
          </span>
          <span class="dash-law-pill" @click="emit('navigate', 'laws')" title="Bấm để xem danh mục văn bản pháp lý">
            ⚖️ Kho luật: <strong>{{ stats.kpis.validLaws }}</strong> còn hiệu lực / {{ stats.kpis.totalLaws }} văn bản
          </span>
        </div>
        <h2 class="dash-title">Trung tâm Thống kê & Điều hành Hồ sơ Môi trường</h2>
        <p class="dash-subtitle">
          Giám sát toàn diện phân nhóm dự án, tiến độ hoàn thiện hồ sơ pháp lý (ĐTM / GPMT / ĐKMT), tải lượng xả thải và cảnh báo quan trắc QCVN.
        </p>
      </div>

      <div class="dash-header-actions no-print">
        <div v-if="currentUser?.role === 'admin' && stats.staffList.length > 0" class="dash-filter-staff">
          <label class="dash-filter-label">Chuyên viên phụ trách:</label>
          <select v-model="selectedStaffId" @change="fetchDashboardStats" class="dash-select">
            <option value="all">Tất cả nhân sự ({{ stats.staffList.length }})</option>
            <option v-for="u in stats.staffList" :key="u.id" :value="String(u.id)">
              {{ u.full_name }} ({{ u.role === 'admin' ? 'Admin' : 'Staff' }})
            </option>
          </select>
        </div>

        <div class="dash-action-btns">
          <button class="btn-clear dash-btn" @click="fetchDashboardStats" :disabled="loading">
            🔄 Làm mới
          </button>
          <button class="btn-classify dash-btn dash-btn-primary" @click="printDashboard">
            🖨️ In báo cáo
          </button>
        </div>
      </div>
    </div>

    <!-- TRẠNG THÁI TẢI / LỖI -->
    <div v-if="loading" class="card dash-loading">
      <div class="dash-spinner"></div>
      <div style="font-size: 14px; font-weight: 600; color: var(--text2);">Đang tổng hợp dữ liệu dự án và mẫu quan trắc QCVN...</div>
    </div>

    <div v-else-if="errorMsg" class="card dash-error">
      <div style="font-size: 15px; font-weight: 700; color: var(--red); margin-bottom: 6px;">⚠️ {{ errorMsg }}</div>
      <button class="btn-clear" style="width: auto; padding: 6px 14px;" @click="fetchDashboardStats">Thử lại</button>
    </div>

    <template v-else>
      <!-- HÀNG 1: 4 THẺ KPI CỐT LÕI -->
      <div class="dash-kpi-grid">
        <!-- KPI 1: Tổng dự án -->
        <div class="card dash-kpi-card">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">TỔNG DỰ ÁN QUẢN LÝ</span>
            <span class="dash-kpi-icon" style="background: var(--accent2); color: var(--accent);"><i class="ti ti-folder"></i></span>
          </div>
          <div class="dash-kpi-value" style="color: var(--accent);">
            {{ formatNumber(stats.kpis.totalProjects) }}
            <span class="dash-kpi-unit">dự án</span>
          </div>
          <div class="dash-kpi-foot">
            <span class="dash-chip-inline warn">
              ⚡ {{ stats.kpis.highRiskProjects }} dự án Nhóm I & II
            </span>
            <span class="dash-kpi-subtext">nguy cơ tác động MT cao/TB</span>
          </div>
        </div>

        <!-- KPI 2: Tuân thủ QCVN -->
        <div class="card dash-kpi-card">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">TỶ LỆ MẪU ĐẠT QCVN</span>
            <span class="dash-kpi-icon" :style="{
              background: stats.kpis.failSamples > 0 ? 'var(--red-bg)' : 'var(--accent2)',
              color: stats.kpis.failSamples > 0 ? 'var(--red)' : 'var(--accent)'
            }">🔬</span>
          </div>
          <div class="dash-kpi-value" :style="{ color: stats.kpis.failSamples > 0 ? 'var(--red)' : 'var(--accent)' }">
            {{ stats.kpis.complianceRate }}%
            <span class="dash-kpi-unit">({{ stats.kpis.totalSamples }} mẫu)</span>
          </div>
          <div class="dash-kpi-foot">
            <span class="dash-dot-stat pass">✓ {{ stats.kpis.passSamples }} Đạt</span>
            <span class="dash-dot-stat warn">⚠ {{ stats.kpis.warnSamples }} Cận ngưỡng</span>
            <span class="dash-dot-stat fail">✗ {{ stats.kpis.failSamples }} Vượt</span>
          </div>
        </div>

        <!-- KPI 3: Tiến độ Checklist hồ sơ -->
        <div class="card dash-kpi-card">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">TIẾN ĐỘ HỒ SƠ PHÁP LÝ</span>
            <span class="dash-kpi-icon" style="background: var(--blue-bg); color: var(--blue);">📋</span>
          </div>
          <div class="dash-kpi-value" style="color: var(--blue);">
            {{ stats.kpis.avgChecklistPercent }}%
            <span class="dash-kpi-unit">trung bình</span>
          </div>
          <div class="dash-kpi-foot">
            <div class="dash-mini-progress">
              <div class="dash-mini-progress-bar" :style="{ width: stats.kpis.avgChecklistPercent + '%' }"></div>
            </div>
            <span class="dash-kpi-subtext">
              Hoàn tất 100%: <strong>{{ stats.kpis.completedChecklistProjects }}/{{ stats.kpis.totalProjects }}</strong> dự án
            </span>
          </div>
        </div>

        <!-- KPI 4: Độ phủ Bản đồ số & Quan trắc -->
        <div class="card dash-kpi-card">
          <div class="dash-kpi-top">
            <span class="dash-kpi-label">ĐỘ PHỦ BẢN ĐỒ & QUAN TRẮC</span>
            <span class="dash-kpi-icon" style="background: var(--warn-bg); color: var(--warn);">🗺️</span>
          </div>
          <div class="dash-kpi-value" style="color: var(--text);">
            {{ stats.kpis.gisMappedProjects }}<span style="font-size: 18px; color: var(--text3);">/{{ stats.kpis.totalProjects }}</span>
            <span class="dash-kpi-unit">tọa độ GIS</span>
          </div>
          <div class="dash-kpi-foot">
            <span class="dash-chip-inline ok">
              🔗 {{ stats.kpis.monitoredProjects }} dự án đã có mẫu QCVN
            </span>
          </div>
        </div>
      </div>

      <!-- HÀNG 2: CƠ CẤU PHÁP LÝ & TUÂN THỦ QCVN THEO LOẠI MÔI TRƯỜNG -->
      <div class="dash-main-grid">
        <!-- Cột Trái: Phân nhóm dự án (Donut SVG) + Loại hồ sơ + Thẩm quyền -->
        <div class="card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title">⚖️ Cơ cấu Phân nhóm Dự án & Hồ sơ Môi trường</h3>
              <p class="dash-panel-desc">Phân bổ theo Điều 28 Luật BVMT 2020 & Nghị định 08/2022/NĐ-CP (sửa đổi NĐ 05/2025, 48/2026)</p>
            </div>
          </div>

          <div class="dash-group-section">
            <!-- SVG Donut Chart -->
            <div class="dash-donut-wrap">
              <svg viewBox="0 0 150 150" class="dash-donut-svg">
                <circle cx="75" cy="75" r="58" fill="none" stroke="var(--surface2)" stroke-width="18" />
                <circle
                  v-for="seg in donutSegments"
                  :key="seg.key"
                  v-show="seg.count > 0"
                  cx="75"
                  cy="75"
                  r="58"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="18"
                  :stroke-dasharray="seg.dashArray"
                  :stroke-dashoffset="seg.dashOffset"
                  transform="rotate(-90 75 75)"
                  style="transition: stroke-dasharray 0.4s ease;"
                />
                <text x="75" y="70" text-anchor="middle" class="dash-donut-num">{{ stats.kpis.totalProjects }}</text>
                <text x="75" y="88" text-anchor="middle" class="dash-donut-lbl">Dự án</text>
              </svg>
            </div>

            <!-- Chú giải Nhóm I - IV -->
            <div class="dash-group-legend">
              <div v-for="seg in donutSegments" :key="seg.key" class="dash-legend-item">
                <div class="dash-legend-left">
                  <span class="dash-color-dot" :style="{ background: seg.color }"></span>
                  <span class="dash-legend-name">{{ seg.label }}</span>
                </div>
                <div class="dash-legend-right">
                  <strong>{{ seg.count }}</strong>
                  <span class="dash-legend-pct">({{ seg.percent }}%)</span>
                </div>
              </div>
            </div>
          </div>

          <div class="dash-divider"></div>

          <!-- Phân bổ Loại hồ sơ (ĐTM / GPMT / ĐKMT) & Cơ quan thẩm quyền -->
          <div class="dash-sub-split">
            <div>
              <div class="dash-sub-heading">Loại hồ sơ pháp lý yêu cầu</div>
              <div class="dash-dossier-list">
                <div v-for="d in DOSSIER_META" :key="d.key" class="dash-dossier-item" :style="{ background: d.bg }">
                  <div>
                    <div class="dash-dossier-name" :style="{ color: d.color }">{{ d.label }}</div>
                    <div class="dash-dossier-desc">{{ d.desc }}</div>
                  </div>
                  <div class="dash-dossier-count" :style="{ color: d.color }">
                    {{ stats.distributions.byDossier?.[d.key] || 0 }}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div class="dash-sub-heading">Cơ quan thẩm định / cấp phép</div>
              <div class="dash-auth-list">
                <div v-for="a in AUTHORITY_META" :key="a.key" class="dash-auth-item">
                  <div class="dash-auth-label">
                    <span>{{ a.icon }}</span>
                    <span>{{ a.label }}</span>
                  </div>
                  <span class="dash-auth-badge">
                    {{ stats.distributions.byAuthority?.[a.key] || 0 }} dự án
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Cột Phải: Biểu đồ thanh chồng kết quả Quan trắc QCVN theo Thành phần MT -->
        <div class="card dash-panel">
          <div class="dash-panel-header">
            <div>
              <h3 class="dash-panel-title">🔬 Chất lượng Quan trắc theo Quy chuẩn (QCVN)</h3>
              <p class="dash-panel-desc">Tỷ lệ mẫu Đạt / Cận ngưỡng / Vượt ngưỡng trên từng thành phần môi trường</p>
            </div>
            <div class="dash-qcvn-legend">
              <span class="dash-qcvn-key"><i style="background: #1A6B3A;"></i> Đạt</span>
              <span class="dash-qcvn-key"><i style="background: #D97706;"></i> Cảnh báo</span>
              <span class="dash-qcvn-key"><i style="background: #C0392B;"></i> Vượt ngưỡng</span>
            </div>
          </div>

          <div class="dash-qcvn-bars">
            <div v-for="item in stats.distributions.byQcvnType" :key="item.type" class="dash-qcvn-row">
              <div class="dash-qcvn-row-head">
                <span class="dash-qcvn-type-name">{{ item.label }}</span>
                <span class="dash-qcvn-type-total">
                  <strong>{{ item.total }}</strong> mẫu
                  <template v-if="item.total > 0">
                    ({{ item.dat }} đạt · {{ item.canh_bao }} CB · {{ item.vuot_nguong }} vượt)
                  </template>
                </span>
              </div>

              <div class="dash-stacked-track">
                <template v-if="item.total > 0">
                  <div
                    v-if="item.dat > 0"
                    class="dash-stacked-seg pass"
                    :style="{ width: (item.dat / item.total) * 100 + '%' }"
                    :title="`Đạt chuẩn: ${item.dat} mẫu`"
                  ></div>
                  <div
                    v-if="item.canh_bao > 0"
                    class="dash-stacked-seg warn"
                    :style="{ width: (item.canh_bao / item.total) * 100 + '%' }"
                    :title="`Cận ngưỡng (Cảnh báo): ${item.canh_bao} mẫu`"
                  ></div>
                  <div
                    v-if="item.vuot_nguong > 0"
                    class="dash-stacked-seg fail"
                    :style="{ width: (item.vuot_nguong / item.total) * 100 + '%' }"
                    :title="`Vượt ngưỡng QCVN: ${item.vuot_nguong} mẫu`"
                  ></div>
                </template>
                <div v-else class="dash-stacked-empty">Chưa có mẫu quan trắc</div>
              </div>
            </div>
          </div>

          <!-- Tóm tắt mẫu cảnh báo / vượt ngưỡng gần nhất -->
          <div class="dash-divider"></div>
          <div class="dash-sub-heading" style="display: flex; justify-content: space-between; align-items: center;">
            <span>🚨 Mẫu quan trắc cần lưu ý gần đây (Vượt ngưỡng / Cận ngưỡng)</span>
            <span style="font-size: 11px; font-weight: 500; color: var(--text3);">Bấm vào mẫu để kiểm tra bảng thông số</span>
          </div>

          <div v-if="stats.alertSamples.length === 0" class="dash-empty-box">
            ✅ Tuyệt vời! Không có mẫu quan trắc nào bị vượt ngưỡng hoặc cảnh báo.
          </div>
          <div v-else class="dash-alert-samples-list">
            <div
              v-for="s in stats.alertSamples.slice(0, 4)"
              :key="s.id"
              class="dash-alert-sample-item"
              @click="emit('view-qcvn-sample', s.id)"
            >
              <div class="dash-alert-sample-main">
                <div class="dash-alert-sample-title">
                  <span>{{ s.name }}</span>
                  <span v-if="s.project_name" class="dash-sample-proj-tag">🔗 {{ s.project_name }}</span>
                </div>
                <div class="dash-alert-sample-meta">
                  {{ s.type_label }} · {{ formatDate(s.created_at) }}
                </div>
              </div>
              <span class="dash-status-pill" :class="s.status === 'vuot_nguong' ? 'fail' : 'warn'">
                {{ s.status === 'vuot_nguong' ? '✗ Vượt ngưỡng' : '⚠ Cảnh báo' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- HÀNG 3: TẢI LƯỢNG MÔI TRƯỜNG & PHÂN BỐ NGÀNH / ĐỊA PHƯƠNG -->
      <div class="dash-triple-grid">
        <!-- Cột 1: Tổng tải lượng xả thải & Yếu tố nhạy cảm -->
        <div class="card dash-panel">
          <h3 class="dash-panel-title" style="margin-bottom: 4px;">🌊 Tổng Tải lượng Phát thải & Yếu tố Nhạy cảm</h3>
          <p class="dash-panel-desc" style="margin-bottom: 14px;">Tổng hợp quy mô xả thải và các yếu tố nhạy cảm môi trường từ hồ sơ dự án</p>

          <div class="dash-load-cards">
            <div class="dash-load-box">
              <div class="dash-load-label">💧 Tổng lưu lượng Nước thải</div>
              <div class="dash-load-val">{{ formatNumber(stats.environmentalLoad.totalWastewater) }} <small>m³/ngày</small></div>
              <div class="dash-load-sub">Từ {{ stats.environmentalLoad.projectsWithWastewater }} dự án có xả nước thải</div>
            </div>
            <div class="dash-load-box">
              <div class="dash-load-label">💨 Tổng lưu lượng Khí thải</div>
              <div class="dash-load-val">{{ formatNumber(stats.environmentalLoad.totalAirEmission) }} <small>m³/giờ</small></div>
              <div class="dash-load-sub">Từ {{ stats.environmentalLoad.projectsWithAirEmission }} dự án có phát sinh bụi/khí</div>
            </div>
          </div>

          <div class="dash-sub-heading" style="margin-top: 14px;">Các yếu tố nhạy cảm & đặc thù dự án</div>
          <div class="dash-sensitive-grid">
            <div
              v-for="sf in SENSITIVE_META"
              :key="sf.key"
              class="dash-sensitive-item"
              :class="{ active: (stats.environmentalLoad.sensitiveCounts?.[sf.key] || 0) > 0 }"
            >
              <span class="dash-sensitive-name">{{ sf.icon }} {{ sf.label }}</span>
              <strong class="dash-sensitive-count">{{ stats.environmentalLoad.sensitiveCounts?.[sf.key] || 0 }}</strong>
            </div>
          </div>
        </div>

        <!-- Cột 2: Top Ngành nghề -->
        <div class="card dash-panel">
          <h3 class="dash-panel-title" style="margin-bottom: 4px;">🏭 Top Ngành nghề Tư vấn</h3>
          <p class="dash-panel-desc" style="margin-bottom: 14px;">Nhóm ngành sản xuất / đầu tư chiếm tỷ trọng hồ sơ cao nhất</p>

          <div v-if="stats.distributions.topIndustries.length === 0" class="dash-empty-box">
            Chưa có dữ liệu ngành nghề dự án
          </div>
          <div v-else class="dash-rank-list">
            <div v-for="(ind, idx) in stats.distributions.topIndustries" :key="ind.code" class="dash-rank-item">
              <div class="dash-rank-top">
                <span class="dash-rank-name">
                  <strong class="dash-rank-idx">#{{ idx + 1 }}</strong> {{ ind.label }}
                </span>
                <span class="dash-rank-count">{{ ind.count }} dự án</span>
              </div>
              <div class="dash-rank-bar-bg">
                <div
                  class="dash-rank-bar-fill"
                  :style="{ width: Math.max(8, (ind.count / (stats.kpis.totalProjects || 1)) * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Cột 3: Top Tỉnh / Thành phố -->
        <div class="card dash-panel">
          <h3 class="dash-panel-title" style="margin-bottom: 4px;">📍 Phân bố theo Tỉnh / Thành phố</h3>
          <p class="dash-panel-desc" style="margin-bottom: 14px;">Địa bàn tập trung nhiều dự án đầu tư và quan trắc nhất</p>

          <div v-if="stats.distributions.topProvinces.length === 0" class="dash-empty-box">
            Chưa có dữ liệu địa phương
          </div>
          <div v-else class="dash-rank-list">
            <div v-for="(prov, idx) in stats.distributions.topProvinces" :key="prov.name" class="dash-rank-item">
              <div class="dash-rank-top">
                <span class="dash-rank-name">
                  <strong class="dash-rank-idx">#{{ idx + 1 }}</strong> {{ prov.name }}
                </span>
                <span class="dash-rank-count">{{ prov.count }} dự án</span>
              </div>
              <div class="dash-rank-bar-bg">
                <div
                  class="dash-rank-bar-fill secondary"
                  :style="{ width: Math.max(8, (prov.count / (stats.kpis.totalProjects || 1)) * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- HÀNG 4: BẢNG THEO DÕI SỨC KHỎE HỒ SƠ & HÀNH ĐỘNG NHANH -->
      <div class="card dash-panel" style="margin-top: 20px;">
        <div class="dash-table-header">
          <div>
            <h3 class="dash-panel-title">📋 Bảng Theo dõi Sức khỏe Hồ sơ & Tiến độ Dự án</h3>
            <p class="dash-panel-desc">
              Kiểm soát những dự án còn thiếu tài liệu checklist pháp lý, chưa có mẫu quan trắc hoặc có mẫu QCVN vượt ngưỡng cần xử lý ngay.
            </p>
          </div>

          <div class="dash-search-wrap no-print">
            <input
              v-model="searchQuery"
              @input="currentPage = 1"
              type="text"
              placeholder="🔍 Tìm tên dự án, tỉnh thành, ngành nghề..."
              class="dash-search-input"
            />
          </div>
        </div>

        <!-- Các nút lọc nhanh (Quick Filter Pills) -->
        <div class="dash-filter-pills no-print">
          <button
            class="dash-pill-btn"
            :class="{ active: healthFilter === 'all' }"
            @click="setHealthFilter('all')"
          >
            Tất cả dự án ({{ filterCounts.all }})
          </button>
          <button
            class="dash-pill-btn alert"
            :class="{ active: healthFilter === 'alert' }"
            @click="setHealthFilter('alert')"
          >
            🚨 Có mẫu vượt ngưỡng / cảnh báo ({{ filterCounts.alert }})
          </button>
          <button
            class="dash-pill-btn warn"
            :class="{ active: healthFilter === 'incomplete' }"
            @click="setHealthFilter('incomplete')"
          >
            ⏳ Hồ sơ chưa hoàn tất &lt;100% ({{ filterCounts.incomplete }})
          </button>
          <button
            class="dash-pill-btn neutral"
            :class="{ active: healthFilter === 'unmonitored' }"
            @click="setHealthFilter('unmonitored')"
          >
            🔬 Chưa có mẫu quan trắc ({{ filterCounts.unmonitored }})
          </button>
        </div>

        <!-- Bảng dữ liệu -->
        <div class="dash-table-wrap">
          <table class="dash-table">
            <thead>
              <tr>
                <th style="min-width: 220px;">Dự án & Địa điểm</th>
                <th style="min-width: 165px;">Phân loại & Hồ sơ</th>
                <th style="min-width: 135px;">Tải lượng xả thải</th>
                <th style="min-width: 170px;">Tiến độ Checklist</th>
                <th style="min-width: 185px;">Quan trắc QCVN</th>
                <th class="no-print" style="width: 115px; text-align: right;">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="paginatedProjects.length === 0">
                <td colspan="6" style="text-align: center; padding: 32px 16px; color: var(--text3);">
                  Không tìm thấy dự án nào khớp với điều kiện lọc hiện tại.
                </td>
              </tr>
              <tr v-for="proj in paginatedProjects" :key="proj.id">
                <!-- Cột 1: Tên dự án & địa điểm -->
                <td>
                  <div class="dash-proj-name" @click="emit('view-project', proj.id)">
                    {{ proj.name }}
                  </div>
                  <div class="dash-proj-meta">
                    <span>📍 {{ proj.tinh }}</span>
                    <span>· {{ proj.nganh_label }}</span>
                    <span v-if="proj.has_gis" class="dash-gis-tag" title="Đã định vị tọa độ trên bản đồ số">🗺️ Có GIS</span>
                  </div>
                  <div v-if="currentUser?.role === 'admin'" class="dash-proj-staff">
                    👤 Phụ trách: {{ proj.user_name }} · {{ formatDate(proj.created_at) }}
                  </div>
                </td>

                <!-- Cột 2: Nhóm & Hồ sơ -->
                <td>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <span
                      class="dash-group-badge"
                      :style="{ background: getGroupColor(proj.nhom) + '18', color: getGroupColor(proj.nhom), borderColor: getGroupColor(proj.nhom) + '40' }"
                    >
                      {{ proj.nhom }}
                    </span>
                    <span class="dash-hs-badge">{{ proj.hs }}</span>
                  </div>
                  <div class="dash-coquan-text">{{ proj.co_quan }}</div>
                </td>

                <!-- Cột 3: Tải lượng xả thải -->
                <td>
                  <div class="dash-emission-line">
                    💧 NT: <strong>{{ proj.nt > 0 ? formatNumber(proj.nt) + ' m³/ng' : 'Không' }}</strong>
                  </div>
                  <div class="dash-emission-line">
                    💨 KT: <strong>{{ proj.kt > 0 ? formatNumber(proj.kt) + ' m³/h' : 'Không' }}</strong>
                  </div>
                </td>

                <!-- Cột 4: Tiến độ Checklist -->
                <td>
                  <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                    <span :style="{ fontWeight: 700, color: proj.checklist_percent === 100 ? 'var(--accent)' : 'var(--text)' }">
                      {{ proj.checklist_percent }}%
                    </span>
                    <span style="color: var(--text3);">{{ proj.checklist_done }}/{{ proj.checklist_total }} mục</span>
                  </div>
                  <div class="dash-cl-bar-bg">
                    <div
                      class="dash-cl-bar-fill"
                      :style="{
                        width: proj.checklist_percent + '%',
                        background: proj.checklist_percent === 100 ? 'var(--accent)' : proj.checklist_percent >= 50 ? '#D97706' : 'var(--text3)'
                      }"
                    ></div>
                  </div>
                </td>

                <!-- Cột 5: Quan trắc QCVN -->
                <td>
                  <template v-if="proj.sample_count > 0">
                    <div
                      class="dash-sample-chip"
                      :class="proj.latest_sample_status === 'vuot_nguong' ? 'fail' : proj.latest_sample_status === 'canh_bao' ? 'warn' : 'pass'"
                      @click="proj.latest_sample_id && emit('view-qcvn-sample', proj.latest_sample_id)"
                      title="Bấm để mở mẫu quan trắc mới nhất"
                    >
                      <span>
                        {{ proj.latest_sample_status === 'vuot_nguong' ? '✗ Vượt ngưỡng' : proj.latest_sample_status === 'canh_bao' ? '⚠ Cảnh báo' : '✓ Đạt chuẩn' }}
                      </span>
                      <small>({{ proj.sample_count }} mẫu)</small>
                    </div>
                    <div class="dash-sample-sub">
                      {{ proj.latest_sample_name }} · {{ formatDate(proj.latest_sample_date) }}
                    </div>
                  </template>
                  <template v-else>
                    <span class="dash-unmonitored-tag">Chưa có mẫu QCVN</span>
                  </template>
                </td>

                <!-- Cột 6: Thao tác -->
                <td class="no-print" style="text-align: right;">
                  <button class="dash-open-btn" @click="emit('view-project', proj.id)">
                    Mở hồ sơ →
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang bảng dự án -->
        <div v-if="filteredProjects.length > 0" class="dash-pagination no-print" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div style="font-size:13px;color:var(--text2)">
            Hiển thị <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> – <strong>{{ Math.min(currentPage * pageSize, filteredProjects.length) }}</strong> / {{ filteredProjects.length }} dự án
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button
              class="pagination-btn"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              &lt; Trước
            </button>
            <span class="dash-page-info">
              Trang <strong>{{ currentPage }}</strong> / {{ totalPages }}
            </span>
            <button
              class="pagination-btn"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              Sau &gt;
            </button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="pageSize"
              style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px">
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
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.dash-header-left {
  flex: 1;
  min-width: 280px;
}

.dash-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.dash-scope-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  background: var(--accent2);
  color: var(--accent);
  line-height: 1.4;
}

.dash-law-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 99px;
  font-size: 11px;
  background: var(--surface2);
  color: var(--text2);
  cursor: pointer;
  border: 1px solid var(--border);
  line-height: 1.4;
  transition: background 0.15s;
}

.dash-law-pill:hover {
  background: var(--border);
}

.dash-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 4px 0;
  line-height: 1.35;
}

.dash-subtitle {
  font-size: 13px;
  color: var(--text2);
  margin: 0;
  line-height: 1.5;
}

.dash-header-actions {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.dash-filter-staff {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dash-filter-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text3);
}

.dash-select {
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
  min-width: 210px;
}

.dash-action-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-btn {
  width: auto !important;
  margin: 0 !important;
  padding: 8px 14px !important;
  font-size: 13px !important;
  border-radius: 6px !important;
  white-space: nowrap;
}

/* KPI Grid */
.dash-kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.dash-kpi-card {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.dash-kpi-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.dash-kpi-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text3);
  line-height: 1.4;
}

.dash-kpi-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
}

.dash-kpi-value {
  font-size: 28px;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 10px;
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.dash-kpi-unit {
  font-size: 12px;
  font-weight: 500;
  color: var(--text3);
}

.dash-kpi-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  line-height: 1.4;
}

.dash-kpi-subtext {
  font-size: 11.5px;
  color: var(--text3);
}

.dash-chip-inline {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.dash-chip-inline.warn {
  background: var(--warn-bg);
  color: var(--warn);
}

.dash-chip-inline.ok {
  background: var(--accent2);
  color: var(--accent);
}

.dash-dot-stat {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.dash-dot-stat.pass {
  background: #E8F4EC;
  color: #1D5C3A;
}

.dash-dot-stat.warn {
  background: #FDF3E7;
  color: #8B4A0F;
}

.dash-dot-stat.fail {
  background: #FBEAEA;
  color: #7A1D1D;
}

.dash-mini-progress {
  width: 100%;
  height: 6px;
  background: var(--surface2);
  border-radius: 99px;
  overflow: hidden;
}

.dash-mini-progress-bar {
  height: 100%;
  background: var(--blue);
  border-radius: 99px;
  transition: width 0.3s ease;
}

/* Main 2-column grid */
.dash-main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.dash-panel {
  padding: 20px 22px;
}

.dash-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.dash-panel-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 3px 0;
  line-height: 1.4;
}

.dash-panel-desc {
  font-size: 12px;
  color: var(--text3);
  margin: 0;
  line-height: 1.45;
}

/* Donut section */
.dash-group-section {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
}

.dash-donut-wrap {
  width: 145px;
  height: 145px;
  flex-shrink: 0;
  margin: 0 auto;
}

.dash-donut-svg {
  width: 100%;
  height: 100%;
}

.dash-donut-num {
  font-size: 24px;
  font-weight: 800;
  fill: var(--text);
}

.dash-donut-lbl {
  font-size: 11px;
  font-weight: 600;
  fill: var(--text3);
}

.dash-group-legend {
  flex: 1;
  min-width: 210px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dash-legend-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  background: var(--surface2);
  border-radius: 6px;
  font-size: 12.5px;
}

.dash-legend-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dash-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dash-legend-name {
  color: var(--text);
  font-weight: 500;
}

.dash-legend-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.dash-legend-pct {
  font-size: 11.5px;
  color: var(--text3);
}

.dash-divider {
  height: 1px;
  background: var(--border);
  margin: 16px 0;
}

.dash-sub-split {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
}

.dash-sub-heading {
  font-size: 12px;
  font-weight: 700;
  color: var(--text2);
  margin-bottom: 10px;
  line-height: 1.4;
}

.dash-dossier-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dash-dossier-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  gap: 8px;
}

.dash-dossier-name {
  font-size: 12.5px;
  font-weight: 700;
  line-height: 1.35;
}

.dash-dossier-desc {
  font-size: 11px;
  color: var(--text3);
  margin-top: 1px;
}

.dash-dossier-count {
  font-size: 18px;
  font-weight: 800;
  flex-shrink: 0;
}

.dash-auth-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dash-auth-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 11px;
  background: var(--surface2);
  border-radius: 6px;
  font-size: 12px;
  gap: 8px;
}

.dash-auth-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-weight: 500;
  line-height: 1.35;
}

.dash-auth-badge {
  font-weight: 700;
  color: var(--accent);
  white-space: nowrap;
}

/* QCVN Bars */
.dash-qcvn-legend {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--text2);
}

.dash-qcvn-key {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dash-qcvn-key i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
}

.dash-qcvn-bars {
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.dash-qcvn-row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.dash-qcvn-type-name {
  font-weight: 600;
  color: var(--text);
}

.dash-qcvn-type-total {
  font-size: 11.5px;
  color: var(--text3);
}

.dash-stacked-track {
  height: 10px;
  background: var(--surface2);
  border-radius: 99px;
  overflow: hidden;
  display: flex;
}

.dash-stacked-seg {
  height: 100%;
  transition: width 0.3s ease;
}

.dash-stacked-seg.pass {
  background: #1A6B3A;
}

.dash-stacked-seg.warn {
  background: #D97706;
}

.dash-stacked-seg.fail {
  background: #C0392B;
}

.dash-stacked-empty {
  font-size: 10px;
  color: var(--text3);
  line-height: 10px;
  padding-left: 8px;
}

.dash-alert-samples-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.dash-alert-sample-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.dash-alert-sample-item:hover {
  background: #F3F1EC;
  border-color: var(--accent);
}

.dash-alert-sample-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dash-sample-proj-tag {
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  background: var(--accent2);
  padding: 1px 7px;
  border-radius: 4px;
}

.dash-alert-sample-meta {
  font-size: 11px;
  color: var(--text3);
  margin-top: 2px;
}

.dash-status-pill {
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.dash-status-pill.fail {
  background: #FDECEA;
  color: #A82020;
}

.dash-status-pill.warn {
  background: #FFF8EC;
  color: #8B6010;
}

/* Row 3: Triple Grid */
.dash-triple-grid {
  display: grid;
  grid-template-columns: 1.25fr 0.875fr 0.875fr;
  gap: 20px;
}

.dash-load-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dash-load-box {
  padding: 12px 14px;
  background: var(--surface2);
  border-radius: 8px;
  border: 1px solid var(--border);
}

.dash-load-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text2);
  margin-bottom: 4px;
}

.dash-load-val {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
  line-height: 1.3;
}

.dash-load-val small {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text3);
}

.dash-load-sub {
  font-size: 11px;
  color: var(--text3);
  margin-top: 3px;
}

.dash-sensitive-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 7px;
}

.dash-sensitive-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--surface2);
  font-size: 11.5px;
  color: var(--text3);
}

.dash-sensitive-item.active {
  background: #FDF3E7;
  color: #8B4A0F;
  font-weight: 600;
}

.dash-sensitive-name {
  line-height: 1.35;
}

.dash-sensitive-count {
  font-size: 12.5px;
}

/* Rank Lists */
.dash-rank-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dash-rank-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  margin-bottom: 5px;
}

.dash-rank-name {
  color: var(--text);
  font-weight: 500;
  line-height: 1.35;
}

.dash-rank-idx {
  color: var(--accent);
  margin-right: 4px;
}

.dash-rank-count {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text2);
  white-space: nowrap;
}

.dash-rank-bar-bg {
  height: 7px;
  background: var(--surface2);
  border-radius: 99px;
  overflow: hidden;
}

.dash-rank-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
}

.dash-rank-bar-fill.secondary {
  background: #2E6B9E;
}

/* Health Table */
.dash-table-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.dash-search-wrap {
  min-width: 280px;
}

.dash-search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  color: var(--text);
  background: var(--surface);
}

.dash-filter-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.dash-pill-btn {
  padding: 6px 12px;
  border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text2);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}

.dash-pill-btn:hover {
  border-color: var(--accent);
}

.dash-pill-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.dash-pill-btn.alert.active {
  background: var(--red);
  border-color: var(--red);
}

.dash-pill-btn.warn.active {
  background: var(--warn);
  border-color: var(--warn);
}

.dash-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.dash-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.dash-table th {
  background: var(--surface2);
  color: var(--text2);
  font-weight: 700;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 11px 14px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

.dash-table td {
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  line-height: 1.45;
}

.dash-table tbody tr:last-child td {
  border-bottom: none;
}

.dash-table tbody tr:hover {
  background: #FAF9F6;
}

.dash-proj-name {
  font-weight: 700;
  color: var(--accent);
  cursor: pointer;
  line-height: 1.4;
}

.dash-proj-name:hover {
  text-decoration: underline;
}

.dash-proj-meta {
  font-size: 11.5px;
  color: var(--text2);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dash-gis-tag {
  background: var(--accent2);
  color: var(--accent);
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.dash-proj-staff {
  font-size: 11px;
  color: var(--text3);
  margin-top: 3px;
}

.dash-group-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
}

.dash-hs-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border);
}

.dash-coquan-text {
  font-size: 11px;
  color: var(--text3);
  margin-top: 4px;
}

.dash-emission-line {
  font-size: 12px;
  color: var(--text2);
  line-height: 1.5;
}

.dash-cl-bar-bg {
  width: 100%;
  height: 7px;
  background: var(--surface2);
  border-radius: 99px;
  overflow: hidden;
}

.dash-cl-bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width 0.3s ease;
}

.dash-sample-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.dash-sample-chip.pass {
  background: #E6F7EF;
  color: #1A6B3A;
}

.dash-sample-chip.warn {
  background: #FFF8EC;
  color: #8B6010;
}

.dash-sample-chip.fail {
  background: #FDECEA;
  color: #A82020;
}

.dash-sample-sub {
  font-size: 11px;
  color: var(--text3);
  margin-top: 3px;
}

.dash-unmonitored-tag {
  font-size: 11.5px;
  color: var(--text3);
  font-style: italic;
}

.dash-open-btn {
  padding: 6px 11px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: var(--accent2);
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}

.dash-open-btn:hover {
  background: var(--accent);
  color: #fff;
}

.dash-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 16px;
}

.dash-page-info {
  font-size: 12.5px;
  color: var(--text2);
}

.dash-empty-box {
  padding: 18px;
  text-align: center;
  background: var(--surface2);
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text3);
}

.dash-loading,
.dash-error {
  padding: 48px 24px;
  text-align: center;
}

.dash-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  margin: 0 auto 12px auto;
  animation: dashSpin 0.8s linear infinite;
}

@keyframes dashSpin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1024px) {
  .dash-kpi-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .dash-main-grid,
  .dash-triple-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .dash-kpi-grid,
  .dash-sub-split,
  .dash-load-cards,
  .dash-sensitive-grid {
    grid-template-columns: 1fr;
  }
}
</style>
