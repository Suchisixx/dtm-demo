<script setup>
import { ref, onMounted, watch } from 'vue'
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
const getPageFromUrl = () => {
  const pathname = window.location.pathname.replace(/^\/+/, '').split('/')[0].trim()
  const hash = window.location.hash.replace('#', '').replace('/', '').trim()
  const validPages = PAGES
  
  if (validPages.includes(pathname)) return pathname
  if (validPages.includes(hash)) return hash
  return DEFAULT_PAGE
}

const activePage = ref(getPageFromUrl())

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

  // Sau khi kiểm tra auth, kiểm tra quyền truy cập của trang hiện tại
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

// Watch currentUser changes. If logged out, redirect if on private page
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
  
  // Đồng bộ URL sạch (loại bỏ hash nếu có)
  const initialPage = getPageFromUrl()
  window.history.replaceState({ page: initialPage }, '', `/${initialPage}`)
  
  checkAuth()
})
</script>

<template>
  <div style="min-height: 100vh; display: flex; flex-direction: column;">
    <!-- HEADER -->
    <header class="header">
      <div class="header-inner">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/assets/logo/logo-bg.png" alt="Logo" class="logo-img" style="width:38px;height:38px;object-fit:contain;border-radius:50%" />
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <h1 class="logo-text" style="font-size:16px;font-weight:700;margin:0;line-height:1.35">ETC LegalHub</h1>
              <span class="chip-status valid" style="font-size:10px;padding:2px 8px">Cập nhật: NĐ 48/2026</span>
            </div>
            <div style="font-size:11px;color:var(--text3);line-height:1.35;margin-top:2px">Môi trường & Pháp lý doanh nghiệp</div>
          </div>
        </div>
        
        <div class="user-auth-container" style="display:flex;align-items:center;margin-left:auto">
          <div v-if="currentUser" style="display:flex;align-items:center;gap:12px">
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.35">{{ currentUser.fullName }}</div>
              <div style="font-size:10px;color:var(--text3);text-transform:uppercase;line-height:1.35">{{ currentUser.role }}</div>
            </div>
            <button class="btn-clear" style="padding:6px 12px;font-size:12px;margin:0;border-radius:6px" @click="handleLogout">🚪 Đăng xuất</button>
          </div>
          <button v-else class="btn-classify" style="width:auto;margin:0;padding:6px 16px;font-size:13px;border-radius:6px" @click="showLogin = true">Đăng nhập</button>
        </div>
      </div>
    </header>

    <!-- NAVIGATION -->
    <nav class="nav-bar">
      <div class="nav-inner">
        <a href="/laws" class="nav-btn" :class="{ active: activePage === 'laws' }" @click.prevent="handlePageChange('laws')">
          <i class="ti ti-file-text"></i> Tra cứu văn bản pháp lý
        </a>

        <a href="/dashboard" class="nav-btn" :class="{ active: activePage === 'dashboard' }" @click.prevent="handlePageChange('dashboard')">
          <span v-if="!currentUser"><i class="ti ti-lock"></i></span> 📊 Dashboard thống kê
        </a>
        
        <a href="/classify" class="nav-btn" :class="{ active: activePage === 'classify' }" @click.prevent="handlePageChange('classify')">
          <span v-if="!currentUser"><i class="ti ti-lock"></i></span> Phân loại & Xác định hồ sơ
        </a>
        
        <a href="/qcvn" class="nav-btn" :class="{ active: activePage === 'qcvn' }" @click.prevent="handlePageChange('qcvn')">
          <span v-if="!currentUser"><i class="ti ti-lock"></i></span> So sánh QCVN
        </a>
        
        <a href="/map" class="nav-btn" :class="{ active: activePage === 'map' }" @click.prevent="handlePageChange('map')">
          <span v-if="!currentUser"><i class="ti ti-lock"></i></span> 🗺️ Bản đồ dự án
        </a>
        
        <a v-if="currentUser && currentUser.role === 'admin'" href="/admin" class="nav-btn" :class="{ active: activePage === 'admin' }" @click.prevent="handlePageChange('admin')">
          Quản trị hệ thống
        </a>
      </div>
    </nav>

    <!-- MAIN BODY -->
    <main style="flex: 1; padding: 24px 0;">
      <LawsTab v-if="activePage === 'laws'" />
      <DashboardTab v-else-if="activePage === 'dashboard'" :currentUser="currentUser" @view-project="handleViewProject" @view-qcvn-sample="handleViewQcvnSample" @navigate="handlePageChange" />
      <ClassifyTab v-else-if="activePage === 'classify'" :loadProjectId="pendingProjectId" @project-loaded="pendingProjectId = null" @view-qcvn-sample="handleViewQcvnSample" />
      <QCVNTab v-else-if="activePage === 'qcvn'" :loadSampleId="pendingSampleId" @sample-loaded="pendingSampleId = null" />
      <MapTab v-else-if="activePage === 'map'" @view-project="handleViewProject" />
      <AdminTab v-else-if="activePage === 'admin'" :currentUser="currentUser" />
    </main>

    <!-- FOOTER -->
    <footer style="padding: 24px 0; border-top: 1px solid var(--border); margin-top: auto; background: var(--surface);">
      <div class="container" style="text-align: center; font-size: 13px; color: var(--text3)">
        &copy; 2026 ETC Environmental Consulting Hub. Cập nhật theo chuỗi nghị định sửa đổi NĐ 08/2022/NĐ-CP mới nhất.
      </div>
    </footer>

    <!-- AUTH MODAL -->
    <AuthModal v-if="showLogin" @login-success="handleLoginSuccess" @close="showLogin = false" />
  </div>
</template>
