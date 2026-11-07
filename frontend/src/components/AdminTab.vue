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

const fetchCrawlerSettings = async () => {
  try {
    const res = await fetch(API.CRAWLER_SETTINGS)
    if (res.ok) {
      const data = await res.json()
      autoCrawlEnabled.value = data.autoCrawlEnabled
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
  crawlerMessage.value = 'Hệ thống đang kiểm tra sitemap và tải thông tin các văn bản mới...'
  crawlerStatusType.value = 'info'
  
  try {
    const res = await fetch(API.CRAWLER_RUN, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      crawlerMessage.value = data.message
      crawlerStatusType.value = 'success'
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
  <div id="admin" class="page container">
    <div class="section-head">Trang Quản trị hệ thống</div>
    <div class="section-desc">Quản lý nhân viên, dự án và cơ sở dữ liệu quy chuẩn động</div>

    <div class="admin-grid">
      <!-- Sidebar -->
      <div class="admin-sidebar">
        <button class="admin-tab-btn" :class="{ active: currentSubpage === 'users' }" @click="switchSubpage('users')">👥 Nhân viên</button>
        <button class="admin-tab-btn" :class="{ active: currentSubpage === 'projects' }" @click="switchSubpage('projects')">📂 Dự án</button>
        <button class="admin-tab-btn" :class="{ active: currentSubpage === 'laws' }" @click="switchSubpage('laws')">📜 Quy chuẩn pháp lý</button>
        <button class="admin-tab-btn" :class="{ active: currentSubpage === 'crawler' }" @click="switchSubpage('crawler')">🔄 Cập nhật tự động</button>
      </div>

      <!-- Content area -->
      <div class="admin-content">
        <!-- Subpage: Users -->
        <div v-if="currentSubpage === 'users'" id="admin-users" class="admin-subpage">
          <div class="admin-section-header">
            <div class="admin-section-title">Quản lý tài khoản nhân viên</div>
            <button class="btn-classify" @click="openAddUserModal"
              style="width:auto;margin:0;padding:6px 14px;font-size:13px">➕ Thêm nhân viên</button>
          </div>
          <div style="overflow-x:auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Tên đăng nhập</th>
                  <th>Họ và tên</th>
                  <th>Vai trò</th>
                  <th>Ngày tạo</th>
                  <th style="width:120px;text-align:right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="users.length === 0">
                  <td colspan="5" style="text-align:center;color:var(--text3)">Chưa có tài khoản nào được tạo.</td>
                </tr>
                <tr v-for="u in paginatedUsers" :key="u.id">
                  <td><strong>{{ u.username }}</strong></td>
                  <td>{{ u.full_name }}</td>
                  <td><span class="chip-status" :class="u.role === 'admin' ? 'valid' : 'amended'">{{ u.role.toUpperCase() }}</span></td>
                  <td>{{ new Date(u.created_at).toLocaleDateString('vi-VN') }}</td>
                  <td style="text-align:right">
                    <div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap">
                      <button class="btn-action-edit" @click="openEditUserModal(u)">✏️ Sửa</button>
                      <button class="btn-action-delete" :disabled="currentUser && currentUser.id === u.id"
                        :style="currentUser && currentUser.id === u.id ? { opacity: 0.4, cursor: 'not-allowed' } : {}"
                        @click="handleDeleteUser(u.id, u.username)">🗑️ Xoá</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Phân trang Users -->
          <div v-if="users.length > 0"
            style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding:12px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">
            <div style="font-size:13px;color:var(--text2)">
              Hiển thị <strong>{{ (userCurrentPage - 1) * userPageSize + 1 }}</strong> – <strong>{{ Math.min(userCurrentPage * userPageSize, users.length) }}</strong> / {{ users.length }} nhân viên
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="pagination-btn" :disabled="userCurrentPage === 1" @click="userCurrentPage--">‹</button>
              <button v-for="pg in userTotalPages" :key="pg" class="pagination-btn" :class="{ active: pg === userCurrentPage }" @click="userCurrentPage = pg">{{ pg }}</button>
              <button class="pagination-btn" :disabled="userCurrentPage === userTotalPages" @click="userCurrentPage++">›</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
              <span>Hiển thị:</span>
              <select v-model.number="userPageSize"
                style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px">
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
            <div class="admin-section-title">Quản lý dự án toàn hệ thống</div>
          </div>
          <div style="overflow-x:auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Tên dự án</th>
                  <th>Người sở hữu</th>
                  <th>Ngành nghề</th>
                  <th>Ngày tạo</th>
                  <th style="width:100px;text-align:right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="projects.length === 0">
                  <td colspan="5" style="text-align:center;color:var(--text3)">Chưa có dự án nào trên hệ thống.</td>
                </tr>
                <tr v-for="p in paginatedProjects" :key="p.id">
                  <td><strong>{{ p.name }}</strong></td>
                  <td>{{ p.owner_name }} ({{ p.owner_username }})</td>
                  <td>
                    <span style="font-size:12px;color:var(--text2)">
                      {{ IND_DB[p.form_data?.nganh]?.lbl || p.form_data?.nganh || 'Chưa xác định' }}
                    </span>
                  </td>
                  <td>{{ new Date(p.created_at).toLocaleString('vi-VN') }}</td>
                  <td style="text-align:right">
                    <div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap">
                      <button class="btn-action-delete" @click="handleDeleteProject(p.id, p.name)">🗑️ Xoá</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Phân trang Projects -->
          <div v-if="projects.length > 0"
            style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding:12px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">
            <div style="font-size:13px;color:var(--text2)">
              Hiển thị <strong>{{ (projectCurrentPage - 1) * projectPageSize + 1 }}</strong> – <strong>{{ Math.min(projectCurrentPage * projectPageSize, projects.length) }}</strong> / {{ projects.length }} dự án
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="pagination-btn" :disabled="projectCurrentPage === 1" @click="projectCurrentPage--">‹</button>
              <button v-for="pg in projectTotalPages" :key="pg" class="pagination-btn" :class="{ active: pg === projectCurrentPage }" @click="projectCurrentPage = pg">{{ pg }}</button>
              <button class="pagination-btn" :disabled="projectCurrentPage === projectTotalPages" @click="projectCurrentPage++">›</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
              <span>Hiển thị:</span>
              <select v-model.number="projectPageSize"
                style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px">
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
            <div class="admin-section-title">Quản lý văn bản pháp lý & Quy chuẩn</div>
            <button class="btn-classify" @click="openAddLawModal"
              style="width:auto;margin:0;padding:6px 14px;font-size:13px">➕ Thêm quy chuẩn</button>
          </div>
          
          <div style="display:flex;gap:12px;margin-bottom:16px;align-items:center">
            <input type="text" v-model="lawSearchQuery" placeholder="🔍 Tìm kiếm theo số hiệu hoặc tên..."
              style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--surface);color:var(--text)" />
            <select v-model="lawFilterType"
              style="width:180px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--surface);color:var(--text)">
              <option value="all">Tất cả loại văn bản</option>
              <option value="luat">Luật</option>
              <option value="nd">Nghị định</option>
              <option value="vbhn">Văn bản hợp nhất</option>
              <option value="tt">Thông tư</option>
              <option value="qcvn">Quy chuẩn (QCVN)</option>
            </select>
          </div>
          
          <div style="overflow-x:auto">
            <table class="admin-table">
              <thead>
                <tr>
                  <th style="width:120px">Mã VB</th>
                  <th style="width:100px">Loại</th>
                  <th>Số hiệu</th>
                  <th style="width:100px">Hiệu lực</th>
                  <th style="width:150px;text-align:right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="filteredLaws.length === 0">
                  <td colspan="5" style="text-align:center;color:var(--text3)">Không tìm thấy văn bản phù hợp.</td>
                </tr>
                <tr v-for="l in paginatedLaws" :key="l.id">
                  <td><code>{{ l.id }}</code></td>
                  <td><span class="chip-status valid" style="background:#eaf2f8;color:#2980b9">{{ getLawTypeLabel(l.type) }}</span></td>
                  <td>
                    <strong>{{ l.so }}</strong>
                    <div style="font-size:11px;color:var(--text3);margin-top:2px">Năm ban hành: {{ l.year }}</div>
                  </td>
                  <td><span class="chip-status" :class="l.status">{{ l.status === 'valid' ? 'Hiệu lực' : (l.status === 'amended' ? 'Sửa đổi' : 'Hết HL') }}</span></td>
                  <td style="text-align:right">
                    <div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap">
                      <button class="btn-action-edit" @click="openEditLawModal(l)">✏️ Sửa</button>
                      <button class="btn-action-delete" @click="handleDeleteLaw(l.id, l.so)">🗑️ Xoá</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Phân trang Quy chuẩn & Văn bản pháp lý -->
          <div v-if="filteredLaws.length > 0"
            style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;flex-wrap:wrap;gap:12px;padding:12px 16px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)">
            <div style="font-size:13px;color:var(--text2)">
              Hiển thị <strong>{{ (lawCurrentPage - 1) * lawPageSize + 1 }}</strong> – <strong>{{ Math.min(lawCurrentPage * lawPageSize, filteredLaws.length) }}</strong> / {{ filteredLaws.length }} quy chuẩn & văn bản
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button class="pagination-btn" :disabled="lawCurrentPage === 1" @click="lawCurrentPage--">‹</button>
              <button v-for="pg in lawTotalPages" :key="pg" class="pagination-btn" :class="{ active: pg === lawCurrentPage }" @click="lawCurrentPage = pg">{{ pg }}</button>
              <button class="pagination-btn" :disabled="lawCurrentPage === lawTotalPages" @click="lawCurrentPage++">›</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2)">
              <span>Hiển thị:</span>
              <select v-model.number="lawPageSize"
                style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg);color:var(--text);font-size:13px">
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
            <div class="admin-section-title">Cấu hình cập nhật luật tự động</div>
          </div>
          
          <!-- Control Panel Card -->
          <div class="card" style="padding:20px;margin-bottom:24px;border:1px solid var(--border)">
            <h4 style="font-size:15px;margin-bottom:12px;color:var(--text)">Trình cập nhật tự động (luatmoitruong.vn)</h4>
            <p style="font-size:13px;color:var(--text2);margin-bottom:20px;line-height:1.5">
              Hệ thống sử dụng Scheduler tự động quét sitemap và bài viết mới từ trang luatmoitruong.vn định kỳ mỗi tháng một lần (ngày 01 hàng tháng lúc 00:00). Hệ thống tra cứu nhanh, tự động bỏ qua các văn bản đã có không đổi hoặc hết hiệu lực, chỉ thêm mới các văn bản pháp lý còn hiệu lực.
            </p>
            
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
              <label class="switch-label" style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600;cursor:pointer">
                <input type="checkbox" v-model="autoCrawlEnabled" @change="toggleAutoCrawl" style="width:18px;height:18px;accent-color:var(--accent)" />
                Bật tự động quét hàng tháng
              </label>
            </div>

            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
              <button class="btn-classify" :disabled="isCrawling" @click="triggerCrawlNow" style="width:auto;margin:0;padding:8px 16px;font-size:13px">
                <span v-if="isCrawling">⏳ Đang quét dữ liệu...</span>
                <span v-else>⚡ Chạy kiểm tra & Cập nhật ngay</span>
              </button>
            </div>
            
            <!-- Crawler status message -->
            <div v-if="crawlerMessage" :style="{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '13px',
              border: '1px solid',
              backgroundColor: crawlerStatusType === 'success' ? 'var(--accent2)' : crawlerStatusType === 'error' ? 'var(--red-bg)' : 'var(--info-bg)',
              color: crawlerStatusType === 'success' ? 'var(--accent)' : crawlerStatusType === 'error' ? 'var(--red)' : 'var(--info)',
              borderColor: crawlerStatusType === 'success' ? 'var(--border)' : crawlerStatusType === 'error' ? 'var(--red)' : 'var(--info)'
            }">
              {{ crawlerMessage }}
            </div>
          </div>

          <!-- Update Log history -->
          <div class="admin-section-header" style="margin-top:24px">
            <div class="admin-section-title" style="font-size:16px">Nhật ký cập nhật luật tự động</div>
          </div>
          
          <div style="overflow-x:auto">
            <table class="admin-table" style="min-width:650px">
              <thead>
                <tr>
                  <th style="width:160px">Thời gian</th>
                  <th style="width:120px">Mã luật</th>
                  <th style="width:120px">Hành động</th>
                  <th style="width:150px">Người thực hiện</th>
                  <th>Mô tả chi tiết</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="crawlHistory.length === 0">
                  <td colspan="5" style="text-align:center;color:var(--text3)">Chưa ghi nhận lịch sử cập nhật nào từ crawler.</td>
                </tr>
                <tr v-for="h in crawlHistory" :key="h.id">
                  <td>{{ new Date(h.updated_at).toLocaleString('vi-VN') }}</td>
                  <td><code>{{ h.law_id }}</code></td>
                  <td>
                    <span class="chip-status" :class="h.action === 'AUTO_CRAWL_CREATE' ? 'valid' : 'amended'">
                      {{ h.action === 'AUTO_CRAWL_CREATE' ? 'THÊM MỚI' : 'CẬP NHẬT' }}
                    </span>
                  </td>
                  <td>{{ h.updated_by_name || 'Hệ thống tự động' }}</td>
                  <td style="color:var(--text2)">{{ h.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Thêm/Sửa Nhân viên -->
    <div v-if="showUserModal" class="modal-overlay" style="display:flex" @click.self="showUserModal = false">
      <div class="modal-card fade-up" style="width:450px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-family:'Playfair Display',serif;font-size:20px;color:var(--accent);margin:0">
            {{ isUserEdit ? `Chỉnh sửa: ${userForm.username}` : 'Thêm nhân viên mới' }}
          </h3>
          <button @click="showUserModal = false"
            style="background:transparent;border:none;font-size:20px;cursor:pointer;color:var(--text3)">&times;</button>
        </div>
        <form @submit.prevent="handleUserSubmit" id="user-form">
          <div class="form-group">
            <label class="form-label">Tên đăng nhập *</label>
            <input type="text" v-model="userForm.username" placeholder="Nhập tên đăng nhập..." :disabled="isUserEdit" required />
          </div>
          <div class="form-group">
            <label class="form-label">Họ và tên *</label>
            <input type="text" v-model="userForm.fullName" placeholder="Nhập họ và tên..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Mật khẩu <span v-if="!isUserEdit">*</span></label>
            <input type="password" v-model="userForm.password" :placeholder="isUserEdit ? 'Để trống nếu muốn giữ nguyên mật khẩu cũ' : 'Nhập mật khẩu...'" :required="!isUserEdit"
              style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);background:var(--surface)" />
          </div>
          <div class="form-group">
            <label class="form-label">Vai trò *</label>
            <select v-model="userForm.role"
              style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);background:var(--surface)">
              <option value="staff">Nhân viên (staff)</option>
              <option value="admin">Quản trị viên (admin)</option>
            </select>
          </div>
          <div v-if="userModalError" style="color:var(--red);font-size:13px;margin-bottom:12px;">{{ userModalError }}</div>
          <button type="submit" class="btn-classify" style="margin-top:8px">Lưu thay đổi</button>
        </form>
      </div>
    </div>

    <!-- Modal Thêm/Sửa Quy chuẩn -->
    <div v-if="showLawModal" class="modal-overlay" style="display:flex" @click.self="showLawModal = false">
      <div class="modal-card fade-up" style="width:550px;max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-family:'Playfair Display',serif;font-size:20px;color:var(--accent);margin:0">
            {{ isLawEdit ? `Sửa văn bản: ${lawForm.so}` : 'Thêm quy chuẩn môi trường mới' }}
          </h3>
          <button @click="showLawModal = false"
            style="background:transparent;border:none;font-size:20px;cursor:pointer;color:var(--text3)">&times;</button>
        </div>
        <form @submit.prevent="handleLawSubmit" id="law-form">
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Mã văn bản (ID duy nhất) *</label>
              <input type="text" v-model="lawForm.id" placeholder="VD: luat_bvmt_2020" :disabled="isLawEdit" required />
            </div>
            <div class="form-group">
              <label class="form-label">Loại văn bản *</label>
              <select v-model="lawForm.type"
                style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);background:var(--surface)">
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
              <select v-model="lawForm.status"
                style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);background:var(--surface)">
                <option value="valid">Còn hiệu lực</option>
                <option value="amended">Đã sửa đổi</option>
                <option value="expired">Hết hiệu lực</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Tên văn bản *</label>
            <input type="text" v-model="lawForm.ten" placeholder="Nhập tên văn bản pháp lý..." required />
          </div>
          <div class="form-group">
            <label class="form-label">Ngày có hiệu lực (Hiển thị)</label>
            <input type="text" v-model="lawForm.hieuluc" placeholder="VD: 17/04/2026" />
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả tóm tắt</label>
            <textarea v-model="lawForm.mo_ta" rows="3" placeholder="Nhập mô tả tóm tắt nội dung..."
              style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--bg);resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Các điều khoản quan trọng (Mỗi dòng một điều khoản)</label>
            <textarea v-model="lawForm.dieu_khoang_text" rows="3" placeholder="Điều 1...&#13;Điều 2..."
              style="width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;background:var(--bg);resize:vertical"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Ghi chú thêm</label>
            <input type="text" v-model="lawForm.note" placeholder="VD: ⭐ Quan trọng" />
          </div>
          <div class="form-group">
            <label class="form-label">Đường dẫn tài liệu</label>
            <input type="url" v-model="lawForm.link" placeholder="VD: https://www.luatmoitruong.vn/van-ban/..."
              style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--radius);font-size:14px;color:var(--text);background:var(--surface)" />
          </div>
          <div v-if="lawModalError" style="color:var(--red);font-size:13px;margin-bottom:12px;">{{ lawModalError }}</div>
          <button type="submit" class="btn-classify" style="margin-top:8px">Lưu quy chuẩn</button>
        </form>
      </div>
    </div>
  </div>
</template>
