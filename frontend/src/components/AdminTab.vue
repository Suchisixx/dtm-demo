<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { IND_DB } from '../data/classification-db.js'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'

const props = defineProps({
  currentUser: Object
})

// Subpage state
const currentSubpage = ref('users')

// Data states
const users = ref([])
const projects = ref([])
const laws = ref([])

// Search & Filter for Laws subpage
const lawSearchQuery = ref('')
const lawFilterType = ref('all')

// User Modal State
const showUserModal = ref(false)
const userForm = ref({
  id: '',
  username: '',
  fullName: '',
  password: '',
  role: 'staff'
})
const userModalError = ref('')
const isUserEdit = ref(false)

// Law Modal State
const showLawModal = ref(false)
const lawForm = ref({
  id: '',
  type: 'luat',
  year: new Date().getFullYear(),
  sortDate: '',
  so: '',
  status: 'valid',
  ten: '',
  hieuluc: '',
  mo_ta: '',
  dieu_khoang_text: '',
  note: '',
  link: ''
})
const lawModalError = ref('')
const isLawEdit = ref(false)

// API fetches
const fetchUsers = async () => {
  try {
    const res = await fetch(API.ADMIN_USERS)
    if (res.ok) {
      users.value = await res.json()
    }
  } catch (err) {
    logger.error('Lỗi fetch users:', err)
  }
}

const fetchAllProjects = async () => {
  try {
    const res = await fetch(API.ADMIN_PROJECTS)
    if (res.ok) {
      projects.value = await res.json()
    }
  } catch (err) {
    logger.error('Lỗi fetch projects:', err)
  }
}

const fetchLaws = async () => {
  try {
    const res = await fetch(API.LAWS)
    if (res.ok) {
      laws.value = await res.json()
    }
  } catch (err) {
    logger.error('Lỗi fetch laws:', err)
  }
}

// Crawler Settings & Actions
const autoCrawlEnabled = ref(false)
const crawlHistory = ref([])
const isCrawling = ref(false)
const crawlerMessage = ref('')
const crawlerStatusType = ref('info')
const lastCrawlStats = ref(null)

const getHistoryActionLabel = (action) => {
  if (action === 'AUTO_CRAWL_CREATE' || action === 'create') return 'Thêm mới'
  if (action === 'AUTO_CRAWL_EXPIRE' || action === 'expire') return 'Hết hiệu lực'
  return 'Cập nhật'
}

const getHistoryActionClass = (action) => {
  if (action === 'AUTO_CRAWL_CREATE' || action === 'create') return 'valid'
  if (action === 'AUTO_CRAWL_EXPIRE' || action === 'expire') return 'expired'
  return 'amended'
}

const fetchCrawlerSettings = async () => {
  try {
    const res = await fetch(API.CRAWLER_SETTINGS)
    if (res.ok) {
      const data = await res.json()
      autoCrawlEnabled.value = data.autoCrawlEnabled
      if (data.isRunning) {
        isCrawling.value = true
      }
    }
  } catch (err) {
    logger.error('Lỗi lấy thiết lập crawler:', err)
  }
}

const toggleAutoCrawl = async () => {
  try {
    const res = await fetch(API.CRAWLER_SETTINGS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: autoCrawlEnabled.value })
    })
    const data = await res.json()
    if (res.ok) {
      crawlerMessage.value = data.message
      crawlerStatusType.value = 'success'
    } else {
      autoCrawlEnabled.value = !autoCrawlEnabled.value
      crawlerMessage.value = data.error || 'Có lỗi xảy ra khi lưu thiết lập.'
      crawlerStatusType.value = 'error'
    }
  } catch (err) {
    autoCrawlEnabled.value = !autoCrawlEnabled.value
    crawlerMessage.value = 'Không thể kết nối đến máy chủ.'
    crawlerStatusType.value = 'error'
  }
}

const fetchCrawlHistory = async () => {
  try {
    const res = await fetch(API.CRAWLER_HISTORY)
    if (res.ok) {
      const data = await res.json()
      crawlHistory.value = data.history
    }
  } catch (err) {
    logger.error('Lỗi lấy lịch sử crawler:', err)
  }
}

const triggerCrawlNow = async () => {
  if (isCrawling.value) return
  if (!confirm('Bạn có chắc chắn muốn kích hoạt quét tự động từ luatmoitruong.vn ngay bây giờ?\nQuá trình này có thể mất từ vài giây đến một phút.')) return
  
  isCrawling.value = true
  crawlerMessage.value = 'Hệ thống đang kết nối sitemap-pages.xml, đối chiếu lastmod cache và kiểm tra hiệu lực văn bản...'
  crawlerStatusType.value = 'info'
  
  try {
    const res = await fetch(API.CRAWLER_RUN, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      crawlerMessage.value = data.message
      crawlerStatusType.value = 'success'
      lastCrawlStats.value = data.stats || data
      await fetchCrawlHistory()
      await fetchLaws()
    } else {
      crawlerMessage.value = data.error || 'Quá trình quét cập nhật gặp lỗi.'
      crawlerStatusType.value = 'error'
    }
  } catch (err) {
    crawlerMessage.value = 'Không thể kết nối đến máy chủ.'
    crawlerStatusType.value = 'error'
  } finally {
    isCrawling.value = false
  }
}

const switchSubpage = (subpage) => {
  currentSubpage.value = subpage
  if (subpage === 'users') fetchUsers()
  else if (subpage === 'projects') fetchAllProjects()
  else if (subpage === 'laws') fetchLaws()
  else if (subpage === 'crawler') {
    fetchCrawlerSettings()
    fetchCrawlHistory()
  }
}

// User Actions
const openAddUserModal = () => {
  isUserEdit.value = false
  userForm.value = { id: '', username: '', fullName: '', password: '', role: 'staff' }
  userModalError.value = ''
  showUserModal.value = true
}

const openEditUserModal = (user) => {
  isUserEdit.value = true
  userForm.value = {
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    password: '',
    role: user.role
  }
  userModalError.value = ''
  showUserModal.value = true
}

const handleUserSubmit = async () => {
  userModalError.value = ''
  const isEdit = isUserEdit.value
  const url = isEdit ? `/api/admin/users/${userForm.value.id}` : API.ADMIN_USERS
  const method = isEdit ? 'PUT' : 'POST'

  const payload = {
    username: userForm.value.username,
    fullName: userForm.value.fullName,
    role: userForm.value.role
  }
  if (userForm.value.password && userForm.value.password.trim() !== '') {
    payload.password = userForm.value.password
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok) {
      showUserModal.value = false
      fetchUsers()
      alert(data.message)
    } else {
      userModalError.value = data.error || 'Có lỗi xảy ra khi lưu tài khoản.'
    }
  } catch (err) {
    logger.error('Lỗi gửi user form:', err)
    userModalError.value = 'Không thể kết nối đến máy chủ.'
  }
}

const handleDeleteUser = async (id, username) => {
  if (props.currentUser && props.currentUser.id === id) {
    alert('Bạn không thể tự xóa tài khoản của chính mình!')
    return
  }
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản nhân viên "${username}" không?\nHành động này không thể hoàn tác!`)) {
    return
  }

  try {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchUsers()
      alert(data.message)
    } else {
      alert(data.error || 'Không thể xóa tài khoản!')
    }
  } catch (err) {
    logger.error('Lỗi xóa user:', err)
  }
}

// Project Actions
const handleDeleteProject = async (id, name) => {
  if (!confirm(`Bạn có chắc chắn muốn XÓA dự án "${name}" của nhân viên không?\nHành động này không thể hoàn tác!`)) {
    return
  }
  try {
    const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchAllProjects()
      alert(data.message)
    } else {
      alert(data.error || 'Lỗi khi xóa dự án!')
    }
  } catch (err) {
    logger.error('Lỗi xóa dự án admin:', err)
  }
}

// Law Actions
const openAddLawModal = () => {
  isLawEdit.value = false
  lawForm.value = {
    id: '',
    type: 'luat',
    year: new Date().getFullYear(),
    sortDate: '',
    so: '',
    status: 'valid',
    ten: '',
    hieuluc: '',
    mo_ta: '',
    dieu_khoang_text: '',
    note: '',
    link: ''
  }
  lawModalError.value = ''
  showLawModal.value = true
}

const openEditLawModal = (law) => {
  isLawEdit.value = true
  lawForm.value = {
    id: law.id,
    type: law.type,
    year: law.year,
    sortDate: law.sortDate || '',
    so: law.so,
    status: law.status || 'valid',
    ten: law.ten,
    hieuluc: law.hieuluc || '',
    mo_ta: law.mo_ta || '',
    dieu_khoang_text: Array.isArray(law.dieu_khoang) ? law.dieu_khoang.map(d => typeof d === 'object' && d.tieu_de ? d.tieu_de : String(d)).join('\n') : '',
    note: law.note || '',
    link: law.link || ''
  }
  lawModalError.value = ''
  showLawModal.value = true
}

const handleLawSubmit = async () => {
  lawModalError.value = ''
  const isEdit = isLawEdit.value
  const url = isEdit ? `/api/laws/${lawForm.value.id}` : API.LAWS
  const method = isEdit ? 'PUT' : 'POST'

  const dieu_khoang = lawForm.value.dieu_khoang_text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  const payload = {
    id: lawForm.value.id,
    type: lawForm.value.type,
    year: parseInt(lawForm.value.year),
    sortDate: lawForm.value.sortDate || null,
    so: lawForm.value.so,
    ten: lawForm.value.ten,
    hieuluc: lawForm.value.hieuluc || null,
    status: lawForm.value.status,
    mo_ta: lawForm.value.mo_ta || null,
    dieu_khoang,
    note: lawForm.value.note || null,
    link: lawForm.value.link || null
  }

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (res.ok) {
      showLawModal.value = false
      fetchLaws()
      alert(data.message)
    } else {
      lawModalError.value = data.error || 'Có lỗi xảy ra khi lưu văn bản.'
    }
  } catch (err) {
    logger.error('Lỗi lưu văn bản:', err)
    lawModalError.value = 'Không thể kết nối đến máy chủ.'
  }
}

const handleDeleteLaw = async (id, so) => {
  if (!confirm(`Bạn có chắc chắn muốn XÓA quy chuẩn/văn bản "${so}" không?\nHành động này sẽ xóa vĩnh viễn dữ liệu trong database!`)) {
    return
  }
  try {
    const res = await fetch(`/api/laws/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      fetchLaws()
      alert(data.message)
    } else {
      alert(data.error || 'Lỗi khi xóa quy chuẩn!')
    }
  } catch (err) {
    logger.error('Lỗi xóa luật:', err)
  }
}

// Helpers
const getLawTypeLabel = (type) => {
  return {
    luat: 'Luật',
    nd: 'Nghị định',
    vbhn: 'VBHN',
    tt: 'Thông tư',
    qcvn: 'QCVN'
  }[type] || type.toUpperCase()
}

// Filters laws listing
const filteredLaws = computed(() => {
  const query = lawSearchQuery.value.toLowerCase().trim()
  return laws.value.filter(l => {
    if (lawFilterType.value !== 'all' && l.type !== lawFilterType.value) return false
    if (query) {
      return (l.so && l.so.toLowerCase().includes(query)) ||
             (l.ten && l.ten.toLowerCase().includes(query)) ||
             (l.id && l.id.toLowerCase().includes(query))
    }
    return true
  })
})

// Phân trang Quản lý Quy chuẩn & Văn bản pháp lý
const lawPageSize = ref(10)
const lawCurrentPage = ref(1)
const lawTotalPages = computed(() => Math.max(1, Math.ceil(filteredLaws.value.length / lawPageSize.value)))
const paginatedLaws = computed(() => {
  const start = (lawCurrentPage.value - 1) * lawPageSize.value
  return filteredLaws.value.slice(start, start + lawPageSize.value)
})
watch([lawSearchQuery, lawFilterType, lawPageSize], () => {
  lawCurrentPage.value = 1
})

// Phân trang Quản lý Dự án
const projectPageSize = ref(10)
const projectCurrentPage = ref(1)
const projectTotalPages = computed(() => Math.max(1, Math.ceil(projects.value.length / projectPageSize.value)))
const paginatedProjects = computed(() => {
  const start = (projectCurrentPage.value - 1) * projectPageSize.value
  return projects.value.slice(start, start + projectPageSize.value)
})
watch([projectPageSize], () => {
  projectCurrentPage.value = 1
})

// Phân trang Quản lý Nhân viên
const userPageSize = ref(10)
const userCurrentPage = ref(1)
const userTotalPages = computed(() => Math.max(1, Math.ceil(users.value.length / userPageSize.value)))
const paginatedUsers = computed(() => {
  const start = (userCurrentPage.value - 1) * userPageSize.value
  return users.value.slice(start, start + userPageSize.value)
})
watch([userPageSize], () => {
  userCurrentPage.value = 1
})

onMounted(() => {
  fetchUsers()
})
</script>

<template>
  <div id="admin" class="page container fade-up">
    <!-- PAGE HEADER -->
    <div class="page-header">
      <div>
        <h2 class="section-head">Bảng Điều khiển Quản trị Hệ thống</h2>
        <p class="section-desc">
          Quản lý phân quyền tài khoản nhân sự, giám sát danh mục dự án toàn hệ thống, cập nhật cơ sở dữ liệu văn bản pháp lý và đồng bộ tự động.
        </p>
      </div>
    </div>

    <!-- HORIZONTAL NAVIGATION TABS -->
    <div class="admin-tabs-bar">
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'users' }" @click="switchSubpage('users')">
        <i class="ti ti-users"></i>
        <span>Quản lý Nhân viên ({{ users.length }})</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'projects' }" @click="switchSubpage('projects')">
        <i class="ti ti-folders"></i>
        <span>Dự án toàn hệ thống ({{ projects.length }})</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'laws' }" @click="switchSubpage('laws')">
        <i class="ti ti-scale"></i>
        <span>Văn bản &amp; Quy chuẩn ({{ laws.length }})</span>
      </button>
      <button type="button" class="admin-tab-btn" :class="{ active: currentSubpage === 'crawler' }" @click="switchSubpage('crawler')">
        <i class="ti ti-refresh"></i>
        <span>Đồng bộ dữ liệu tự động</span>
      </button>
    </div>

    <!-- CONTENT AREA -->
    <div class="admin-content">
      <!-- Subpage: Users -->
      <div v-if="currentSubpage === 'users'" id="admin-users" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Danh sách tài khoản nhân sự</div>
          <button type="button" class="btn-primary btn-sm" @click="openAddUserModal">
            <i class="ti ti-user-plus"></i>
            <span>Thêm nhân viên</span>
          </button>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ và tên</th>
                <th>Vai trò</th>
                <th>Ngày khởi tạo</th>
                <th style="width:150px;text-align:right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="users.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa có tài khoản nào được tạo.</td>
              </tr>
              <tr v-for="u in paginatedUsers" :key="u.id">
                <td><strong style="color:var(--text)">{{ u.username }}</strong></td>
                <td>{{ u.full_name }}</td>
                <td>
                  <span class="chip-status" :class="u.role === 'admin' ? 'valid' : 'amended'">
                    {{ u.role === 'admin' ? 'Quản trị viên' : 'Chuyên viên' }}
                  </span>
                </td>
                <td style="color:var(--text2)">{{ new Date(u.created_at).toLocaleDateString('vi-VN') }}</td>
                <td style="text-align:right">
                  <div style="display:flex;gap:6px;justify-content:flex-end">
                    <button type="button" class="btn-action-edit" @click="openEditUserModal(u)">
                      <i class="ti ti-edit"></i>
                      <span>Sửa</span>
                    </button>
                    <button type="button" class="btn-action-delete"
                            :disabled="currentUser && currentUser.id === u.id"
                            @click="handleDeleteUser(u.id, u.username)">
                      <i class="ti ti-trash"></i>
                      <span>Xóa</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang Users -->
        <div v-if="users.length > 0"
             style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (userCurrentPage - 1) * userPageSize + 1 }}</strong> – <strong>{{ Math.min(userCurrentPage * userPageSize, users.length) }}</strong> / {{ users.length }} nhân viên
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="userCurrentPage === 1" @click="userCurrentPage--">‹</button>
            <button v-for="pg in userTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === userCurrentPage }" @click="userCurrentPage = pg">{{ pg }}</button>
            <button type="button" class="pagination-btn" :disabled="userCurrentPage === userTotalPages" @click="userCurrentPage++">›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="userPageSize" style="width:100px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Subpage: Projects -->
      <div v-if="currentSubpage === 'projects'" id="admin-projects" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Quản lý hồ sơ dự án toàn hệ thống</div>
        </div>
        <div style="overflow-x:auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th>Tên dự án</th>
                <th>Chuyên viên phụ trách</th>
                <th>Ngành nghề</th>
                <th>Thời gian tạo</th>
                <th style="width:110px;text-align:right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="projects.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa có dự án nào trên hệ thống.</td>
              </tr>
              <tr v-for="p in paginatedProjects" :key="p.id">
                <td><strong style="color:var(--text)">{{ p.name }}</strong></td>
                <td style="color:var(--text2)">{{ p.owner_name }} ({{ p.owner_username }})</td>
                <td>
                  <span class="chip chip-gray">
                    {{ IND_DB[p.form_data?.nganh]?.lbl || p.form_data?.nganh || 'Chưa xác định' }}
                  </span>
                </td>
                <td style="color:var(--text2)">{{ new Date(p.created_at).toLocaleString('vi-VN') }}</td>
                <td style="text-align:right">
                  <button type="button" class="btn-action-delete" @click="handleDeleteProject(p.id, p.name)">
                    <i class="ti ti-trash"></i>
                    <span>Xóa</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang Projects -->
        <div v-if="projects.length > 0"
             style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (projectCurrentPage - 1) * projectPageSize + 1 }}</strong> – <strong>{{ Math.min(projectCurrentPage * projectPageSize, projects.length) }}</strong> / {{ projects.length }} dự án
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="projectCurrentPage === 1" @click="projectCurrentPage--">‹</button>
            <button v-for="pg in projectTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === projectCurrentPage }" @click="projectCurrentPage = pg">{{ pg }}</button>
            <button type="button" class="pagination-btn" :disabled="projectCurrentPage === projectTotalPages" @click="projectCurrentPage++">›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="projectPageSize" style="width:100px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Subpage: Laws -->
      <div v-if="currentSubpage === 'laws'" id="admin-laws" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Quản lý cơ sở dữ liệu Văn bản pháp lý &amp; Quy chuẩn</div>
          <button type="button" class="btn-primary btn-sm" @click="openAddLawModal">
            <i class="ti ti-plus"></i>
            <span>Thêm văn bản / quy chuẩn</span>
          </button>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:240px">
            <i class="ti ti-search" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);color:var(--text3)"></i>
            <input type="text" v-model="lawSearchQuery" placeholder="Tìm theo mã, số hiệu hoặc tên văn bản..." style="padding-left:32px" />
          </div>
          <select v-model="lawFilterType" style="width:200px">
            <option value="all">Tất cả loại văn bản</option>
            <option value="luat">Luật</option>
            <option value="nd">Nghị định</option>
            <option value="vbhn">Văn bản hợp nhất</option>
            <option value="tt">Thông tư</option>
            <option value="qcvn">Quy chuẩn (QCVN)</option>
          </select>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table">
            <thead>
              <tr>
                <th style="width:150px">Mã định danh</th>
                <th style="width:110px">Loại</th>
                <th>Số hiệu &amp; Tên văn bản</th>
                <th style="width:125px">Trạng thái</th>
                <th style="width:150px;text-align:right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredLaws.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Không tìm thấy văn bản phù hợp.</td>
              </tr>
              <tr v-for="l in paginatedLaws" :key="l.id">
                <td><code style="font-size:12px;color:var(--text2);background:var(--bg);padding:2px 6px;border-radius:4px">{{ l.id }}</code></td>
                <td><span class="chip chip-gray">{{ getLawTypeLabel(l.type) }}</span></td>
                <td>
                  <div style="font-weight:600;color:var(--accent)">{{ l.so }}</div>
                  <div style="font-size:13px;color:var(--text);margin-top:2px">{{ l.ten }}</div>
                  <div style="font-size:11.5px;color:var(--text3);margin-top:2px">Năm ban hành: {{ l.year }}</div>
                </td>
                <td>
                  <span class="chip-status" :class="l.status">
                    {{ l.status === 'valid' ? 'Hiệu lực' : (l.status === 'amended' ? 'Sửa đổi' : 'Hết HL') }}
                  </span>
                </td>
                <td style="text-align:right">
                  <div style="display:flex;gap:6px;justify-content:flex-end">
                    <button type="button" class="btn-action-edit" @click="openEditLawModal(l)">
                      <i class="ti ti-edit"></i>
                      <span>Sửa</span>
                    </button>
                    <button type="button" class="btn-action-delete" @click="handleDeleteLaw(l.id, l.so)">
                      <i class="ti ti-trash"></i>
                      <span>Xóa</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Phân trang Laws -->
        <div v-if="filteredLaws.length > 0"
             style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding-top:14px;border-top:1px solid var(--border)">
          <div style="font-size:12.5px;color:var(--text2)">
            Hiển thị <strong>{{ (lawCurrentPage - 1) * lawPageSize + 1 }}</strong> – <strong>{{ Math.min(lawCurrentPage * lawPageSize, filteredLaws.length) }}</strong> / {{ filteredLaws.length }} văn bản
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <button type="button" class="pagination-btn" :disabled="lawCurrentPage === 1" @click="lawCurrentPage--">‹</button>
            <button v-for="pg in lawTotalPages" :key="pg" type="button" class="pagination-btn" :class="{ active: pg === lawCurrentPage }" @click="lawCurrentPage = pg">{{ pg }}</button>
            <button type="button" class="pagination-btn" :disabled="lawCurrentPage === lawTotalPages" @click="lawCurrentPage++">›</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text2)">
            <span>Hiển thị:</span>
            <select v-model.number="lawPageSize" style="width:100px;height:30px;font-size:12.5px">
              <option :value="10">10 / trang</option>
              <option :value="20">20 / trang</option>
              <option :value="50">50 / trang</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Subpage: Crawler -->
      <div v-if="currentSubpage === 'crawler'" id="admin-crawler" class="admin-subpage">
        <div class="admin-section-header">
          <div class="admin-section-title">Cấu hình đồng bộ văn bản pháp lý tự động</div>
        </div>

        <div style="padding:20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-lg);margin-bottom:20px">
          <div style="font-size:14.5px;font-weight:600;color:var(--text);margin-bottom:6px;display:flex;align-items:center;gap:8px">
            <i class="ti ti-cloud-download" style="color:var(--accent);font-size:18px"></i>
            <span>Trình đồng bộ Sitemap &amp; Bóc tách Điều khoản tự động (luatmoitruong.vn)</span>
          </div>
          <p style="font-size:13px;color:var(--text2);margin-bottom:14px;line-height:1.6">
            Hệ thống vận hành theo kiến trúc <strong>Đồng bộ 2 tầng (Human-in-the-loop Regulatory Governance)</strong>:
            Tầng 1 tự động quét <code>sitemap-pages.xml</code> định kỳ (ngày 01 hàng tháng lúc 00:00), đối chiếu dấu thời gian <code>lastmod</code> với bộ nhớ đệm PostgreSQL, tự động bóc tách điều khoản theo thứ tự tự nhiên và phát hiện văn bản hết hiệu lực. Tầng 2 ghi nhận nhật ký biến động để Quản trị viên rà soát và cập nhật có kiểm soát các thông số định lượng QCVN hoặc ngưỡng phân loại dự án.
          </p>

          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;padding-top:10px;border-top:1px solid var(--border)">
            <label style="display:inline-flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;color:var(--text);cursor:pointer">
              <input type="checkbox" v-model="autoCrawlEnabled" @change="toggleAutoCrawl" style="width:16px;height:16px;accent-color:var(--accent)" />
              <span>Kích hoạt tự động quét định kỳ hàng tháng (Cron Scheduler: 00:00 ngày 01)</span>
            </label>

            <button type="button" class="btn-primary" :disabled="isCrawling" @click="triggerCrawlNow">
              <i class="ti" :class="isCrawling ? 'ti-loader' : 'ti-player-play'"></i>
              <span>{{ isCrawling ? 'Đang quét & đồng bộ dữ liệu...' : 'Chạy kiểm tra & cập nhật ngay' }}</span>
            </button>
          </div>

          <div v-if="crawlerMessage" style="margin-top:14px;padding:10px 14px;border-radius:var(--radius);font-size:13px;border:1px solid"
               :style="{
                 backgroundColor: crawlerStatusType === 'success' ? 'var(--success-bg)' : crawlerStatusType === 'error' ? 'var(--red-bg)' : 'var(--info-bg)',
                 color: crawlerStatusType === 'success' ? 'var(--success)' : crawlerStatusType === 'error' ? 'var(--red)' : 'var(--info)',
                 borderColor: crawlerStatusType === 'success' ? 'var(--success-border)' : crawlerStatusType === 'error' ? 'var(--danger-border)' : 'var(--info-border)'
               }">
            {{ crawlerMessage }}
          </div>
        </div>

        <!-- Bảng thống kê phiên quét trực quan (Crawl Session Telemetry) -->
        <div v-if="lastCrawlStats" class="kpi-grid fade-up" style="margin-bottom:24px">
          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Tổng URL Sitemap đã quét</span>
              <div class="kpi-icon"><i class="ti ti-sitemap"></i></div>
            </div>
            <div class="kpi-value">{{ lastCrawlStats.totalSitemapUrls || 0 }}</div>
            <div class="kpi-sub">{{ lastCrawlStats.totalMainDocs || 0 }} văn bản gốc · {{ lastCrawlStats.totalSubPages || 0 }} trang điều khoản</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Đã đồng bộ (Fast Cache Skip)</span>
              <div class="kpi-icon" style="color:var(--success);background:var(--success-bg)"><i class="ti ti-database-check"></i></div>
            </div>
            <div class="kpi-value" style="color:var(--success)">{{ lastCrawlStats.skippedExistingCount || 0 }}</div>
            <div class="kpi-sub">Khớp dấu thời gian lastmod trong PostgreSQL</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Biến động pháp lý ghi nhận</span>
              <div class="kpi-icon" style="color:var(--info);background:var(--info-bg)"><i class="ti ti-file-diff"></i></div>
            </div>
            <div class="kpi-value" style="color:var(--info)">
              {{ (lastCrawlStats.createdCount || 0) + (lastCrawlStats.updatedCount || 0) + (lastCrawlStats.expiredUpdatedCount || 0) }}
            </div>
            <div class="kpi-sub">
              +{{ lastCrawlStats.createdCount || 0 }} mới · {{ lastCrawlStats.updatedCount || 0 }} sửa đổi · {{ lastCrawlStats.expiredUpdatedCount || 0 }} hết HL
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Thời gian thực thi</span>
              <div class="kpi-icon"><i class="ti ti-clock-bolt"></i></div>
            </div>
            <div class="kpi-value">{{ ((lastCrawlStats.durationMs || 0) / 1000).toFixed(2) }}s</div>
            <div class="kpi-sub">Bỏ qua {{ lastCrawlStats.skippedExpiredCount || 0 }} văn bản ngoài hệ thống đã hết HL</div>
          </div>
        </div>

        <div class="admin-section-header" style="margin-top:8px">
          <div class="admin-section-title" style="font-size:15px">Nhật ký cập nhật cơ sở dữ liệu pháp lý</div>
        </div>

        <div style="overflow-x:auto">
          <table class="saas-table" style="min-width:650px">
            <thead>
              <tr>
                <th style="width:165px">Thời gian</th>
                <th style="width:140px">Mã văn bản</th>
                <th style="width:125px">Loại thao tác</th>
                <th style="width:150px">Thực hiện bởi</th>
                <th>Chi tiết thay đổi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="crawlHistory.length === 0">
                <td colspan="5" style="text-align:center;color:var(--text3);padding:32px">Chưa ghi nhận lịch sử cập nhật nào.</td>
              </tr>
              <tr v-for="h in crawlHistory" :key="h.id">
                <td style="color:var(--text2);font-size:12.5px">{{ new Date(h.updated_at).toLocaleString('vi-VN') }}</td>
                <td><code style="font-size:12px">{{ h.law_id }}</code></td>
                <td>
                  <span class="chip-status" :class="getHistoryActionClass(h.action)">
                    {{ getHistoryActionLabel(h.action) }}
                  </span>
                </td>
                <td style="font-weight:500">{{ h.updated_by_name || 'Hệ thống tự động' }}</td>
                <td style="color:var(--text2)">{{ h.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Thêm/Sửa Nhân viên -->
    <div v-if="showUserModal" class="modal-overlay" @click.self="showUserModal = false">
      <div class="modal-card fade-up" style="width:440px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0">
            {{ isUserEdit ? `Chỉnh sửa nhân viên: ${userForm.username}` : 'Thêm tài khoản nhân viên mới' }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="showUserModal = false">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <form @submit.prevent="handleUserSubmit" id="user-form">
          <div class="form-group">
            <label class="form-label">Tên đăng nhập *</label>
            <input type="text" v-model="userForm.username" placeholder="Nhập tên đăng nhập..." :disabled="isUserEdit" required />
          </div>
          <div class="form-group">
            <label class="form-label">Họ và tên *</label>
            <input type="text" v-model="userForm.fullName" placeholder="Nhập họ và tên đầy đủ..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu <span v-if="!isUserEdit">*</span></label>
            <input type="password" v-model="userForm.password" :placeholder="isUserEdit ? 'Để trống nếu giữ nguyên mật khẩu cũ' : 'Nhập mật khẩu...'" :required="!isUserEdit" />
          </div>
          <div class="form-group">
            <label class="form-label">Vai trò hệ thống *</label>
            <select v-model="userForm.role">
              <option value="staff">Chuyên viên (staff)</option>
              <option value="admin">Quản trị viên (admin)</option>
            </select>
          </div>
          <div v-if="userModalError" style="color:var(--red);background:var(--red-bg);padding:8px 12px;border-radius:var(--radius);font-size:12.5px;margin-bottom:12px">
            {{ userModalError }}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button type="button" class="btn-secondary" @click="showUserModal = false">Hủy</button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-device-floppy"></i>
              <span>Lưu thông tin</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Thêm/Sửa Quy chuẩn -->
    <div v-if="showLawModal" class="modal-overlay" @click.self="showLawModal = false">
      <div class="modal-card fade-up" style="width:580px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <h3 style="font-size:16px;font-weight:600;color:var(--text);margin:0">
            {{ isLawEdit ? `Cập nhật văn bản: ${lawForm.so}` : 'Thêm văn bản / quy chuẩn mới' }}
          </h3>
          <button type="button" class="drawer-close-btn" @click="showLawModal = false">
            <i class="ti ti-x"></i>
          </button>
        </div>
        <form @submit.prevent="handleLawSubmit" id="law-form">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Mã văn bản (ID duy nhất) *</label>
              <input type="text" v-model="lawForm.id" placeholder="VD: luat_bvmt_2020" :disabled="isLawEdit" required />
            </div>
            <div class="form-group">
              <label class="form-label">Loại văn bản *</label>
              <select v-model="lawForm.type">
                <option value="luat">Luật</option>
                <option value="nd">Nghị định</option>
                <option value="vbhn">Văn bản hợp nhất</option>
                <option value="tt">Thông tư</option>
                <option value="qcvn">Quy chuẩn (QCVN)</option>
              </select>
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Năm ban hành *</label>
              <input type="number" v-model="lawForm.year" placeholder="VD: 2026" required />
            </div>
            <div class="form-group">
              <label class="form-label">Ngày sắp xếp (YYYY-MM-DD)</label>
              <input type="text" v-model="lawForm.sortDate" placeholder="VD: 2026-04-17" />
            </div>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Số hiệu *</label>
              <input type="text" v-model="lawForm.so" placeholder="VD: 49/VBHN-BNNMT" required />
            </div>
            <div class="form-group">
              <label class="form-label">Trạng thái hiệu lực</label>
              <select v-model="lawForm.status">
                <option value="valid">Còn hiệu lực</option>
                <option value="amended">Đã sửa đổi</option>
                <option value="expired">Hết hiệu lực</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tên văn bản *</label>
            <input type="text" v-model="lawForm.ten" placeholder="Nhập tên đầy đủ của văn bản..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Ngày có hiệu lực (Hiển thị)</label>
            <input type="text" v-model="lawForm.hieuluc" placeholder="VD: 17/04/2026" />
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả tóm tắt</label>
            <textarea v-model="lawForm.mo_ta" rows="3" placeholder="Nhập mô tả tóm tắt nội dung..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Các điều khoản quan trọng (Mỗi dòng một điều khoản)</label>
            <textarea v-model="lawForm.dieu_khoang_text" rows="3" placeholder="Điều 1...&#13;Điều 2..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Ghi chú áp dụng</label>
            <input type="text" v-model="lawForm.note" placeholder="Nhập lưu ý áp dụng (nếu có)..." />
          </div>
          <div class="form-group">
            <label class="form-label">Đường dẫn tài liệu gốc</label>
            <input type="text" v-model="lawForm.link" placeholder="VD: https://luatmoitruong.vn/..." />
          </div>
          <div v-if="lawModalError" style="color:var(--red);background:var(--red-bg);padding:8px 12px;border-radius:var(--radius);font-size:12.5px;margin-bottom:12px">
            {{ lawModalError }}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button type="button" class="btn-secondary" @click="showLawModal = false">Hủy</button>
            <button type="submit" class="btn-primary">
              <i class="ti ti-device-floppy"></i>
              <span>Lưu văn bản</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
