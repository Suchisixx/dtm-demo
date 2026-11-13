<template>
  <div class="searchable-select-wrap" ref="wrapRef">
    <div 
      class="select-trigger" 
      :class="{ 'is-open': isOpen, 'is-disabled': disabled }" 
      @click="toggleDropdown"
      :title="selectedItem ? selectedItem.name : placeholder"
    >
      <span class="selected-text" :class="{ 'placeholder-text': !selectedItem }">
        {{ selectedItem ? selectedItem.name : placeholder }}
      </span>
      <i class="ti ti-chevron-down arrow-icon" :class="{ 'rotated': isOpen }"></i>
    </div>

    <div v-if="isOpen && !disabled" class="dropdown-popover">
      <div class="search-box">
        <input 
          ref="searchInputRef"
          type="text" 
          v-model="searchQuery" 
          class="search-input" 
          :placeholder="searchPlaceholder || 'Gõ từ khóa để lọc...'"
          @click.stop
        />
        <button 
          v-if="searchQuery" 
          type="button" 
          class="clear-search-btn" 
          @click.stop="searchQuery = ''"
        >
          <i class="ti ti-x"></i>
        </button>
      </div>

      <div class="options-container">
        <template v-if="groups.length">
          <template v-for="group in filteredGroups" :key="group.groupLabel">
            <div class="option-group-heading">{{ group.groupLabel }}</div>
            <div
              v-for="opt in group.items"
              :key="opt.code || opt.name"
              class="option-item"
              :class="{ 'is-selected': isSelected(opt) }"
              @click="selectOption(opt)"
            >
              <span class="option-name">{{ opt.name }}</span>
              <i v-if="isSelected(opt)" class="ti ti-check check-mark"></i>
            </div>
          </template>
        </template>
        <template v-else>
          <div v-if="filteredOptions.length === 0" class="empty-option">
            Không tìm thấy kết quả phù hợp
          </div>
          <div
            v-for="opt in filteredOptions"
            :key="opt.code || opt.name"
            class="option-item"
            :class="{ 'is-selected': isSelected(opt) }"
            @click="selectOption(opt)"
          >
            <div class="option-content">
              <div class="option-title-group">
                <span class="option-name">{{ opt.name }}</span>
                <span v-if="opt.subText" class="option-subtext">{{ opt.subText }}</span>
              </div>
              <span v-if="opt.districtName" class="option-dist-badge">{{ opt.districtName }}</span>
            </div>
            <i v-if="isSelected(opt)" class="ti ti-check check-mark"></i>
          </div>
        </template>
        <div v-if="groups.length && filteredGroups.length === 0" class="empty-option">Không tìm thấy kết quả phù hợp</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { normalizeString } from '../utils/string-helpers.js'

const props = defineProps({
  modelValue: {
    type: [String, Number, null],
    default: null
  },
  options: {
    type: Array,
    default: () => []
  },
  groups: { type: Array, default: () => [] },
  placeholder: {
    type: String,
    default: 'Chọn danh mục...'
  },
  searchPlaceholder: {
    type: String,
    default: '🔍 Gõ tìm kiếm...'
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const isOpen = ref(false)
const searchQuery = ref('')
const wrapRef = ref(null)
const searchInputRef = ref(null)

const selectedItem = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') {
    return null
  }
  return props.options.find(opt => 
    String(opt.code) === String(props.modelValue) || 
    opt.name === props.modelValue || 
    (opt.wardName && opt.wardName === props.modelValue)
  ) || null
})

const isSelected = (opt) => {
  if (props.modelValue === null || props.modelValue === undefined) return false
  return String(opt.code) === String(props.modelValue) || 
         opt.name === props.modelValue || 
         (opt.wardName && opt.wardName === props.modelValue)
}

const filteredOptions = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.options
  }
  const query = normalizeString(searchQuery.value)
  return props.options.filter(opt => {
    const nameClean = normalizeString(opt.name || '')
    const wardClean = normalizeString(opt.wardName || '')
    const distClean = normalizeString(opt.districtName || '')
    const subClean = normalizeString(opt.subText || '')
    const aliasClean = normalizeString(opt.alias || '')
    return nameClean.includes(query) || 
           wardClean.includes(query) || 
           distClean.includes(query) || 
           subClean.includes(query) || 
           aliasClean.includes(query)
  })
})

const filteredGroups = computed(() => {
  const query = normalizeString(searchQuery.value.trim())
  return props.groups.map(group => ({
    ...group,
    items: (group.items || []).filter(opt => {
      if (!query) return true
      return [opt.name, opt.alias, opt.code].some(value => normalizeString(String(value || '')).includes(query))
    })
  })).filter(group => group.items.length)
})

const toggleDropdown = () => {
  if (props.disabled) return
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    nextTick(() => {
      if (searchInputRef.value) {
        searchInputRef.value.focus()
      }
    })
  }
}

const selectOption = (opt) => {
  const val = (opt.code !== undefined && opt.code !== null) ? opt.code : opt.name
  emit('update:modelValue', val)
  emit('change', opt)
  isOpen.value = false
  searchQuery.value = ''
}

const handleClickOutside = (e) => {
  if (wrapRef.value && !wrapRef.value.contains(e.target)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

watch(() => props.disabled, (newVal) => {
  if (newVal) isOpen.value = false
})
</script>

<style scoped>
.searchable-select-wrap {
  position: relative;
  width: 100%;
  flex: 1;
  min-width: 140px;
  font-family: inherit;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border: 1px solid var(--border, #dee2e6);
  border-radius: var(--radius, 6px);
  background: var(--surface, #fff);
  color: var(--text, #333);
  font-size: 13.5px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
  min-height: 40px;
  box-sizing: border-box;
}

.select-trigger:hover:not(.is-disabled) {
  border-color: var(--accent, #1b4332);
}

.select-trigger.is-open {
  border-color: var(--accent, #1b4332);
  box-shadow: 0 0 0 3px var(--accent2, rgba(29, 92, 58, 0.15));
}

.select-trigger.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background: var(--surface2, #f8f9fa);
}

.selected-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 6px;
  font-weight: 500;
}

.placeholder-text {
  color: var(--text3, #888);
  font-weight: normal;
}

.arrow-icon {
  font-size: 11px;
  color: var(--text3, #888);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.arrow-icon.rotated {
  transform: rotate(180deg);
}

.dropdown-popover {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #dee2e6);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 1050;
  overflow: hidden;
  animation: fadeIn 0.15s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-box {
  position: relative;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #eee);
  background: var(--surface2, #fafafa);
}

.search-input {
  width: 100%;
  padding: 6px 26px 6px 10px;
  border: 1px solid var(--border, #ccc);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text, #333);
  background: #fff;
  box-sizing: border-box;
  outline: none;
}

.search-input:focus {
  border-color: var(--accent, #1b4332);
}

.clear-search-btn {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  font-size: 11px;
  color: #999;
  cursor: pointer;
  padding: 2px 4px;
}

.clear-search-btn:hover {
  color: #333;
}

/* Giới hạn hiển thị tương đương 10 mục (~280px), thanh cuộn đẹp */
.options-container {
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.options-container::-webkit-scrollbar {
  width: 6px;
}

.options-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.options-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.options-container::-webkit-scrollbar-thumb:hover {
  background: #999;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text, #333);
  cursor: pointer;
  transition: background 0.1s ease;
  line-height: 1.4;
  gap: 8px;
}

.option-group-heading {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 12px 6px;
  background: var(--surface2, #f4f7f5);
  border-top: 1px solid var(--border, #e5ebe6);
  color: var(--text2, #52645a);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .02em;
}

.option-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  gap: 8px;
}

.option-title-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.option-name {
  white-space: normal;
  overflow-wrap: anywhere;
  font-weight: 500;
}

.option-subtext {
  font-size: 11px;
  color: var(--text3, #89958D);
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.option-dist-badge {
  font-size: 10.5px;
  color: var(--text3, #89958D);
  background: var(--surface2, #F0F4F1);
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--border, #E5EBE6);
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
}

.option-item:hover {
  background: var(--surface2, #f0f4f2);
  color: var(--accent, #1b4332);
}

.option-item.is-selected {
  background: #eef7f2;
  color: var(--accent, #1b4332);
  font-weight: 600;
}

.check-mark {
  color: var(--accent, #1b4332);
  font-weight: bold;
  font-size: 12px;
}

.empty-option {
  padding: 20px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text3, #888);
}
</style>
