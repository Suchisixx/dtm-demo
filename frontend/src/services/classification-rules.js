// frontend/src/services/classification-rules.js
// Hàm hỗ trợ màn hình phân loại, lấy nhãn công suất ngành nghề từ danh mục runtime qua API

/**
 * Lấy nhãn hiển thị cho trường công suất/quy mô theo ngành từ danh mục nạp qua API cơ sở dữ liệu
 */
export function getCapacityLabel(industryKey, runtimeCatalog = null) {
  const runtimeInd = runtimeCatalog && runtimeCatalog[industryKey] ? runtimeCatalog[industryKey] : null
  if (!runtimeInd) return 'Quy mô / Công suất thiết kế *'
  return runtimeInd.lbl || runtimeInd.label_congSuat || (runtimeInd.unit ? `Công suất thiết kế (${runtimeInd.unit})` : 'Quy mô / Công suất thiết kế *')
}

