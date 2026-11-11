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

const PAGE_META = {
  dashboard: { title: 'Dashboard điều hành', group: 'Tổng quan' },
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

watch(currentUser, (newUser) => {
  if (!newUser) {
    if (activePage.value !== DEFAULT_PAGE) {
      activePage.value = DEFAULT_PAGE
      window.history.pushState({ page: DEFAULT_PAGE }, '', `/${DEFAULT_PAGE}`)
    }
  }
})

onMounted(() => {
  window.addEventListener('popstate', () => {
    const page = getPageFromUrl()
    activePage.value = page
  })

  const initialPage = getPageFromUrl()
  window.history.replaceState({ page: initialPage }, '', `/${initialPage}`)

  checkAuth()
})
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
    <!-- Mobile Backdrop -->
    <div class="sidebar-backdrop" :class="{ show: mobileMenuOpen }" @click="mobileMenuOpen = false"></div>

    <!-- SIDEBAR -->
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
           title="Dashboard thống kê" @click.prevent="handlePageChange('dashboard')">
          <i class="ti ti-layout-dashboard"></i>
          <span class="sidebar-link-label">Dashboard</span>
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

    <!-- MAIN VIEWPORT -->
    <div class="app-main">
      <!-- TOPBAR -->
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
            <span>Chuẩn pháp lý: NĐ 48/2026 & VBHN 49</span>
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

      <!-- MAIN CONTENT -->
      <main class="app-content">
        <LawsTab v-if="activePage === 'laws'" :loadLawId="pendingLawId" @law-loaded="pendingLawId = null" />
        <DashboardTab v-else-if="activePage === 'dashboard'" :currentUser="currentUser" @view-project="handleViewProject" @view-qcvn-sample="handleViewQcvnSample" @navigate="handlePageChange" />
        <ClassifyTab v-else-if="activePage === 'classify'" :currentUser="currentUser" :loadProjectId="pendingProjectId" @project-loaded="pendingProjectId = null" @view-qcvn-sample="handleViewQcvnSample" @view-law="handleViewLaw" />
        <QCVNTab v-else-if="activePage === 'qcvn'" :loadSampleId="pendingSampleId" @sample-loaded="pendingSampleId = null" />
        <MapTab v-else-if="activePage === 'map'" @view-project="handleViewProject" />
        <AdminTab v-else-if="activePage === 'admin'" :currentUser="currentUser" />
      </main>

      <!-- FOOTER -->
      <footer class="app-footer">
        <span>&copy; 2026 ETC Environmental Consulting Hub. Hệ thống quản trị hồ sơ & đối chiếu quy chuẩn môi trường.</span>
        <span>Dữ liệu đồng bộ theo chuỗi Nghị định 08/2022/NĐ-CP & 48/2026/NĐ-CP</span>
      </footer>
    </div>

    <!-- AUTH MODAL -->
    <AuthModal v-if="showLogin" @login-success="handleLoginSuccess" @close="showLogin = false" />
  </div>
</template>
