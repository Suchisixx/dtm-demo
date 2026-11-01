// frontend/src/services/classification-rules.js
// Utility phục vụ ClassifyTab — chỉ giữ lại hàm được sử dụng

import { IND_DB } from '../data/classification-db.js'

/**
 * Lấy nhãn hiển thị cho trường công suất / quy mô theo ngành
 */
export function getCapacityLabel(industryKey) {
  const ind = IND_DB[industryKey]
  if (!ind || !ind.label_congSuat) return 'Công suất / quy mô'
  return ind.label_congSuat
}
