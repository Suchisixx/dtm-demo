// frontend/src/services/classification-rules.js
// Utility phục vụ ClassifyTab — lấy nhãn công suất theo ngành nghề

import { IND_DB } from '../data/classification-db.js'

/**
 * Lấy nhãn hiển thị cho trường công suất / quy mô theo ngành (ưu tiên catalog từ DB API)
 */
export function getCapacityLabel(industryKey, runtimeCatalog = null) {
  const runtimeInd = runtimeCatalog && runtimeCatalog[industryKey] ? runtimeCatalog[industryKey] : null
  const ind = runtimeInd || IND_DB[industryKey]
  if (!ind) return 'Quy mô / Công suất thiết kế *'
  return ind.lbl || ind.label_congSuat || 'Quy mô / Công suất thiết kế *'
}
