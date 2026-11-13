<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  projects: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  selectedProjectId: { type: [Number, String], default: null },
  currentPage: { type: Number, default: 1 },
  totalPages: { type: Number, default: 1 }
})

const emit = defineEmits(['close', 'create', 'select', 'remove', 'change-page'])

const handleEscapeKey = (event) => {
  if (event.key === 'Escape' && props.visible) {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', handleEscapeKey))
onUnmounted(() => window.removeEventListener('keydown', handleEscapeKey))
</script>

<template>
  <div v-if="visible" class="drawer-overlay" @click.self="emit('close')">
    <div class="drawer-panel drawer-sm">
      <div class="drawer-header">
        <div class="drawer-title">
          <i class="ti ti-folders" style="color:var(--accent)"></i>
          <span>Danh sách Dự án đã lưu ({{ projects.length }})</span>
        </div>
        <button type="button" class="drawer-close-btn" title="Đóng (Esc)" aria-label="Đóng danh sách dự án" @click="emit('close')">
          <i class="ti ti-x"></i>
        </button>
      </div>

      <div class="drawer-body">
        <button type="button" class="btn-primary" style="width:100%;margin-bottom:16px" @click="emit('create')">
          <i class="ti ti-plus"></i>
          <span>Khởi tạo dự án mới</span>
        </button>

        <div v-if="loading" style="text-align:center;padding:36px 16px;color:var(--text3);font-size:13px">
          Đang tải danh sách hồ sơ đã lưu...
        </div>

        <div v-else-if="errorMessage" role="alert" style="text-align:center;padding:24px 16px;color:var(--danger);font-size:13px">
          {{ errorMessage }}
        </div>

        <div v-else-if="projects.length === 0" style="text-align:center;padding:36px 16px;color:var(--text3);font-size:13px">
          Chưa có dự án nào được lưu trong tài khoản.
        </div>

        <div v-else style="display:flex;flex-direction:column;gap:8px">
          <div v-for="project in projects" :key="project.id" class="project-item">
            <button type="button" class="project-btn" :class="{ active: selectedProjectId === project.id }" @click="emit('select', project)">
              <div style="display:flex;align-items:center;gap:8px">
                <i class="ti ti-folder" style="color:var(--accent)"></i>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ project.name }}</span>
              </div>
            </button>
            <button type="button" class="btn-delete-project" title="Xóa dự án" @click="emit('remove', project.id)">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>

        <div v-if="totalPages > 1" class="pagination-container">
          <button type="button" class="pagination-btn" :disabled="currentPage === 1" @click="emit('change-page', currentPage - 1)">&lt;</button>
          <button v-for="page in totalPages" :key="page" type="button" class="pagination-btn" :class="{ active: page === currentPage }" @click="emit('change-page', page)">
            {{ page }}
          </button>
          <button type="button" class="pagination-btn" :disabled="currentPage === totalPages" @click="emit('change-page', currentPage + 1)">&gt;</button>
        </div>
      </div>
    </div>
  </div>
</template>
