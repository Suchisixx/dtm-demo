import { computed, ref, watch } from 'vue'
import { getCapacityLabel } from '../services/classification-rules.js'
import { API } from '../utils/constants.js'
import { logger } from '../utils/logger.js'

const INDUSTRY_GROUP_ORDER = [
  'Công nghiệp chế biến & Chế tạo',
  'Khai thác Khoáng sản & Năng lượng',
  'Hạ tầng Kỹ thuật, Giao thông & Môi trường',
  'Y tế, Du lịch & Nông — Lâm — Thủy sản',
  'Ngành nghề khác'
]

export function useClassificationCatalog({ industry, processStage, isLoadingSavedProject }) {
  const industriesCatalog = ref({})
  const metadataRuleSource = ref('LOADING')
  const metadataFallbackReason = ref('')

  const capacityLabel = computed(() => getCapacityLabel(industry.value, industriesCatalog.value))
  const currentIndustryMeta = computed(() => industriesCatalog.value[industry.value] || null)
  const availableProcessStages = computed(() => currentIndustryMeta.value?.processStages || [])

  const groupedIndustryOptions = computed(() => {
    const buckets = new Map()
    for (const [code, item] of Object.entries(industriesCatalog.value || {})) {
      const groupLabel = item.groupLabel || 'Ngành nghề khác'
      if (!buckets.has(groupLabel)) buckets.set(groupLabel, [])
      buckets.get(groupLabel).push({ code, name: item.name || code, ...item })
    }

    const ordered = []
    for (const groupLabel of INDUSTRY_GROUP_ORDER) {
      if (buckets.has(groupLabel)) {
      ordered.push({ groupLabel, items: buckets.get(groupLabel) })
        buckets.delete(groupLabel)
      }
    }
    for (const [groupLabel, items] of buckets.entries()) ordered.push({ groupLabel, items })
    return ordered
  })

  const industrySelectOptions = computed(() => Object.entries(industriesCatalog.value || {}).map(([code, item]) => {
    const aliases = Array.isArray(item.aliases) ? item.aliases.join(' ') : ''
    return {
      code,
      name: item.name || code,
      alias: `${code} ${aliases}`
    }
  }))

  watch(industry, () => {
    if (isLoadingSavedProject.value) return
    const validKeys = new Set(availableProcessStages.value.map(stage => stage.key))
    if (!validKeys.has(processStage.value)) processStage.value = ''
  })

  const fetchClassificationMetadata = async () => {
    try {
      const response = await fetch(API.CLASSIFY_METADATA)
      if (response.ok) {
        const data = await response.json()
        industriesCatalog.value = data.industries || {}
        metadataRuleSource.value = data.ruleSource || 'FALLBACK_UNVERIFIED'
        metadataFallbackReason.value = data.fallbackReason || ''
      } else {
        metadataRuleSource.value = 'FALLBACK_UNVERIFIED'
        metadataFallbackReason.value = `HTTP_${response.status}`
      }
    } catch (error) {
      logger.error('Lỗi tải danh mục ngành nghề từ API:', error)
      metadataRuleSource.value = 'FALLBACK_UNVERIFIED'
      metadataFallbackReason.value = error.message || 'NETWORK_ERROR'
    }
  }

  return {
    industriesCatalog,
    metadataRuleSource,
    metadataFallbackReason,
    capacityLabel,
    currentIndustryMeta,
    availableProcessStages,
    groupedIndustryOptions,
    industrySelectOptions,
    fetchClassificationMetadata
  }
}
