import { computed, ref, watch } from 'vue'

// Tạo trạng thái phân trang dùng chung cho các danh sách quản trị.
export function useAdminPagination(items, { pageSize = 10, resetOn = [] } = {}) {
  const currentPage = ref(1)
  const pageSizeValue = ref(pageSize)
  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / pageSizeValue.value)))
  const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSizeValue.value
    return items.value.slice(start, start + pageSizeValue.value)
  })

  watch([pageSizeValue, ...resetOn], () => {
    currentPage.value = 1
  })

  return { currentPage, pageSize: pageSizeValue, totalPages, paginatedItems }
}
