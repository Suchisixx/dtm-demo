<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { PAGES, PRIVATE_PAGES, DEFAULT_PAGE, API } from './utils/constants.js'
import { logger } from './utils/logger.js'
import AuthModal from './components/AuthModal.vue'
import LawsTab from './components/LawsTab.vue'
import ClassifyTab from './components/ClassifyTab.vue'
import QCVNTab from './components/QCVNTab.vue'
import AdminTab from './components/AdminTab.vue'
import MapTab from './components/MapTab.vue'
import DashboardTab from './components/DashboardTab.vue'

const currentUser = ref(null)
const showLogin = ref(false)
const sidebarCollapsed = ref(false)
const mobileMenuOpen = ref(false)
const legalBasis = ref({
  ndVbhnSo: '49/VBHN-BNNMT',
  ttVbhnSo: '55/VBHN-BNNMT',
  latestVbhnSo: '55/VBHN-BNNMT',
  badgeText: 'Chuẩn pháp lý: NĐ 48/2026 • 49/VBHN-BNNMT & 55/VBHN-BNNMT',
  classificationSubText: 'Căn cứ Nghị định 08/2022/NĐ-CP (49/VBHN-BNNMT) & 55/VBHN-BNNMT',
  dashboardSubText: 'Theo Điều 28 Luật BVMT 2020, NĐ 08/2022 (NĐ 48/2026 • 49/VBHN-BNNMT & 55/VBHN-BNNMT)',
  footerText: 'Dữ liệu đồng bộ theo chuỗi Nghị định 08/2022/NĐ-CP, NĐ 48/2026/NĐ-CP (49/VBHN-BNNMT & 55/VBHN-BNNMT)',
  noticeText: 'Nghị định 08/2022/NĐ-CP và Thông tư 02/2022/TT-BTNMT hiện được áp dụng đồng thời với chuỗi sửa đổi, bổ sung tại Nghị định 05/2025/NĐ-CP, Nghị định 48/2026/NĐ-CP, Nghị định 110/2026/NĐ-CP cùng các Văn bản hợp nhất hiện hành trong CSDL: 49/VBHN-BNNMT (hợp nhất Nghị định) và 55/VBHN-BNNMT (hợp nhất Thông tư).',
})

const fetchActiveLegalBasis = async () => {
  try {
    const res = await fetch(API.LAWS_ACTIVE_BASIS)
    if (res.ok) {
      const data = await res.json()
      if (data && data.badgeText) {
        legalBasis.value = { ...legalBasis.value, ...data }
      }
    }
  } catch (err) {
    logger.error('Lỗi tải thông tin chuẩn pháp lý hiện hành:', err)
  }
}

const PAGE_META = {
  dashboard: { title: 'Bảng điều khiển & Thống kê', group: 'Tổng quan' },
  laws: { title: 'Thư viện văn bản pháp lý', group: 'Tra cứu' },
  classify: { title: 'Phân loại & Xác định hồ sơ', group: 'Nghiệp vụ' },
  qcvn: { title: 'Đối chiếu quy chuẩn QCVN', group: 'Nghiệp vụ' },
  map: { title: 'Bản đồ GIS dự án', group: 'Không gian' },
  admin: { title: 'Quản trị hệ thống', group: 'Hệ thống' }
}

const getPageFromUrl = () => {
  const pathname = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim()
  const hash = window.location.hash.replace('#', '').replace('/', '').trim()
  const validPages = PAGES

  if (validPages.includes(pathname)) return pathname
  if (validPages.includes(hash)) return hash
  return DEFAULT_PAGE
}

const activePage = ref(getPageFromUrl())

const currentPageTitle = computed(() => {
  return PAGE_META[activePage.value]?.title || 'ETC LegalHub'
})

const userInitials = computed(() => {
  if (!currentUser.value?.fullName) return 'U'
  const parts = currentUser.value.fullName.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
})

const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'))
  }, 220)
}

const checkAuth = async () => {
  try {
    const res = await fetch(API.AUTH_ME)
    if (res.ok) {
      const data = await res.json()
      if (data.loggedIn) {
        currentUser.value = data.user
      } else {
        currentUser.value = null
      }
    }
  } catch (err) {
    logger.error('Lỗi checkAuth:', err)
  }

  const initialPage = getPageFromUrl()
  if (initialPage === 'admin') {
    if (!currentUser.value || currentUser.value.role !== 'admin') {
      activePage.value = DEFAULT_PAGE
      window.history.replaceState({ page: DEFAULT_PAGE }, '', `/${DEFAULT_PAGE}`)
    } else {
      activePage.value = 'admin'
    }
  } else if (PRIVATE_PAGES.includes(initialPage)) {
    if (!currentUser.value) {
      pendingTargetPage.value = initialPage
      showLogin.value = true
      activePage.value = DEFAULT_PAGE
      window.history.replaceState({ page: DEFAULT_PAGE }, '', `/${DEFAULT_PAGE}`)
    } else {
      activePage.value = initialPage
    }
  } else {
    activePage.value = initialPage
  }
}

const pendingTargetPage = ref(null)
const pendingProjectId = ref(null)
const pendingSampleId = ref(null)
const pendingLawId = ref(null)

const handleLoginSuccess = (user) => {
  currentUser.value = user
  showLogin.value = false
  if (pendingTargetPage.value) {
    if (pendingTargetPage.value === 'admin' && user.role !== 'admin') {
      activePage.value = DEFAULT_PAGE
      window.history.pushState({ page: DEFAULT_PAGE }, '', `/${DEFAULT_PAGE}`)
    } else {
      activePage.value = pendingTargetPage.value
      window.history.pushState({ page: pendingTargetPage.value }, '', `/${pendingTargetPage.value}`)
    }
    pendingTargetPage.value = null
  }
}

const handleLogout = async () => {
  if (!confirm('Bạn có chắc chắn muốn đăng xuất không?')) return
  try {
    const res = await fetch(API.AUTH_LOGOUT, { method: 'POST' })
    if (res.ok) {
      currentUser.value = null
      activePage.value = DEFAULT_PAGE
      window.history.pushState({ page: DEFAULT_PAGE }, '', `/${DEFAULT_PAGE}`)
      alert('Đăng xuất thành công!')
    }
  } catch (err) {
    logger.error('Lỗi đăng xuất:', err)
  }
}

const handlePageChange = (page) => {
  mobileMenuOpen.value = false
  if (page === 'admin') {
    if (!currentUser.value || currentUser.value.role !== 'admin') {
      pendingTargetPage.value = 'admin'
      showLogin.value = true
      return
    }
  } else if (PRIVATE_PAGES.includes(page)) {
    if (!currentUser.value) {
      pendingTargetPage.value = page
      showLogin.value = true
      return
    }
  }
  activePage.value = page
  window.history.pushState({ page }, '', `/${page}`)
}

const handleViewProject = (projectId) => {
  pendingProjectId.value = projectId
  activePage.value = 'classify'
  window.history.pushState({ page: 'classify' }, '', '/classify')
}

const handleViewQcvnSample = (sampleId) => {
  pendingSampleId.value = sampleId
  activePage.value = 'qcvn'
  window.history.pushState({ page: 'qcvn' }, '', '/qcvn')
}

const handleViewLaw = (lawId) => {
  pendingLawId.value = lawId
  activePage.value = 'laws'
  window.history.pushState({ page: 'laws' }, '', '/laws')
}

const urgentReminderCount = ref(0)

const fetchUrgentReminderCount = async () => {
  if (!currentUser.value) {
    urgentReminderCount.value = 0
    return
  }
  try {
    const res = await fetch(API.REMINDERS)
    if (!res.ok) return
    const data = await res.json()
    const s = data.summary || {}
    urgentReminderCount.value = (s.qua_han || 0) + (s.sap_den_han || 0)
  } catch {
    // Không chặn giao diện nếu endpoint nhắc hạn chưa sẵn sàng
  }
}

watch(currentUser, (newUser) => {
  if (!newUser) {
    urgentReminderCount.value = 0
    if (activePage.value !== DEFAULT_PAGE) {
      activePage.value = DEFAULT_PAGE
      window.history.pushState({ page: DEFAULT_PAGE }, '', `/${DEFAULT_PAGE}`)
    }
  } else {
    fetchUrgentReminderCount()
  }
})

onMounted(() => {
  window.addEventListener('popstate', () => {
    const page = getPageFromUrl()
    activePage.value = page
  })

  const initialPage = getPageFromUrl()
  window.history.replaceState({ page: initialPage }, '', `/${initialPage}`)

  fetchActiveLegalBasis()
  checkAuth()
})
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Lớp nền khi mở menu trên màn hình nhỏ -->
    <div class="sidebar-backdrop" :class="{ show: mobileMenuOpen }" @click="mobileMenuOpen = false"></div>

    <!-- Thanh điều hướng bên -->
    <aside class="app-sidebar" :class="{ collapsed: sidebarCollapsed, 'mobile-open': mobileMenuOpen }">
      <div class="sidebar-brand">
        <img src="/assets/logo/logo-bg.png" alt="ETC LegalHub" class="sidebar-logo" />
        <div v-if="!sidebarCollapsed" class="sidebar-brand-text">
          <span class="sidebar-brand-title">ETC LegalHub</span>
          <span class="sidebar-brand-sub">Pháp lý & Môi trường</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="sidebar-group-label">Phân hệ nghiệp vụ</div>

        <a href="/dashboard" class="sidebar-link" :class="{ active: activePage === 'dashboard' }"
           title="Bảng điều khiển &amp; Thống kê" @click.prevent="handlePageChange('dashboard')">
          <i class="ti ti-layout-dashboard"></i>
          <span class="sidebar-link-label">Bảng điều khiển</span>
          <span v-if="currentUser && urgentReminderCount > 0 && !sidebarCollapsed"
                style="margin-left:auto;background:#DC2626;color:#FFFFFF;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:999px;line-height:1.4"
                :title="`${urgentReminderCount} nghĩa vụ quá hạn hoặc sắp đến hạn`">
            {{ urgentReminderCount }}
          </span>
          <i v-if="!currentUser" class="ti ti-lock sidebar-lock-icon"></i>
        </a>

        <a href="/laws" class="sidebar-link" :class="{ active: activePage === 'laws' }"
           title="Văn bản pháp lý" @click.prevent="handlePageChange('laws')">
          <i class="ti ti-scale"></i>
          <span class="sidebar-link-label">Văn bản pháp lý</span>
        </a>

        <a href="/classify" class="sidebar-link" :class="{ active: activePage === 'classify' }"
           title="Phân loại dự án" @click.prevent="handlePageChange('classify')">
          <i class="ti ti-file-analytics"></i>
          <span class="sidebar-link-label">Phân loại dự án</span>
          <i v-if="!currentUser" class="ti ti-lock sidebar-lock-icon"></i>
        </a>

        <a href="/qcvn" class="sidebar-link" :class="{ active: activePage === 'qcvn' }"
           title="So sánh QCVN" @click.prevent="handlePageChange('qcvn')">
          <i class="ti ti-flask-2"></i>
          <span class="sidebar-link-label">So sánh QCVN</span>
          <i v-if="!currentUser" class="ti ti-lock sidebar-lock-icon"></i>
        </a>

        <a href="/map" class="sidebar-link" :class="{ active: activePage === 'map' }"
           title="Bản đồ dự án" @click.prevent="handlePageChange('map')">
          <i class="ti ti-map-2"></i>
          <span class="sidebar-link-label">Bản đồ dự án</span>
          <i v-if="!currentUser" class="ti ti-lock sidebar-lock-icon"></i>
        </a>

        <template v-if="currentUser && currentUser.role === 'admin'">
          <div class="sidebar-group-label" style="margin-top: 12px;">Quản trị</div>
          <a href="/admin" class="sidebar-link" :class="{ active: activePage === 'admin' }"
             title="Quản trị hệ thống" @click.prevent="handlePageChange('admin')">
            <i class="ti ti-settings"></i>
            <span class="sidebar-link-label">Quản trị hệ thống</span>
          </a>
        </template>
      </nav>

      <div class="sidebar-footer">
        <button type="button" class="sidebar-collapse-btn" @click="toggleSidebar" :title="sidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'">
          <i class="ti" :class="sidebarCollapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'" style="font-size: 18px;"></i>
          <span v-if="!sidebarCollapsed">Thu gọn menu</span>
        </button>
      </div>
    </aside>

    <!-- Vùng hiển thị chính -->
    <div class="app-main">
      <!-- Thanh tiêu đề trên -->
      <header class="app-topbar">
        <div class="topbar-left">
          <button type="button" class="mobile-menu-btn" @click="mobileMenuOpen = !mobileMenuOpen" aria-label="Menu">
            <i class="ti ti-menu-2"></i>
          </button>
          <div class="topbar-breadcrumb">
            <span class="breadcrumb-root">ETC LegalHub</span>
            <i class="ti ti-chevron-right breadcrumb-sep"></i>
            <span class="breadcrumb-current">{{ currentPageTitle }}</span>
          </div>
        </div>

        <div class="topbar-right">
          <div class="legal-version-pill">
            <i class="ti ti-shield-check"></i>
            <span>{{ legalBasis.badgeText }}</span>
          </div>

          <div class="user-profile-bar">
            <template v-if="currentUser">
              <div class="user-avatar">{{ userInitials }}</div>
              <div class="user-info-text">
                <span class="user-info-name">{{ currentUser.fullName }}</span>
                <span class="user-info-role">{{ currentUser.role === 'admin' ? 'Quản trị viên' : 'Chuyên viên' }}</span>
              </div>
              <button type="button" class="btn-ghost btn-sm" style="margin-left: 4px;" @click="handleLogout" title="Đăng xuất">
                <i class="ti ti-logout"></i>
                <span>Đăng xuất</span>
              </button>
            </template>
            <button v-else type="button" class="btn-primary btn-sm" @click="showLogin = true">
              <i class="ti ti-login"></i>
              <span>Đăng nhập</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Nội dung chính -->
      <main class="app-content">
        <LawsTab v-if="activePage === 'laws'" :loadLawId="pendingLawId" :legalBasis="legalBasis" @law-loaded="pendingLawId = null" />
        <DashboardTab v-else-if="activePage === 'dashboard'" :currentUser="currentUser" :legalBasis="legalBasis" @view-project="handleViewProject" @view-qcvn-sample="handleViewQcvnSample" @navigate="handlePageChange" />
        <ClassifyTab v-else-if="activePage === 'classify'" :currentUser="currentUser" :legalBasis="legalBasis" :loadProjectId="pendingProjectId" @project-loaded="pendingProjectId = null" @view-qcvn-sample="handleViewQcvnSample" @view-law="handleViewLaw" />
        <QCVNTab v-else-if="activePage === 'qcvn'" :loadSampleId="pendingSampleId" @sample-loaded="pendingSampleId = null" />
        <MapTab v-else-if="activePage === 'map'" @view-project="handleViewProject" />
        <AdminTab v-else-if="activePage === 'admin'" :currentUser="currentUser" />
      </main>

      <!-- Chân trang -->
      <footer class="app-footer">
        <span>&copy; 2026 ETC Environmental Consulting Hub. Hệ thống quản trị hồ sơ & đối chiếu quy chuẩn môi trường.</span>
        <span>{{ legalBasis.footerText }}</span>
      </footer>
    </div>

    <!-- Hộp thoại xác thực -->
    <AuthModal v-if="showLogin" @login-success="handleLoginSuccess" @close="showLogin = false" />
  </div>
</template>
