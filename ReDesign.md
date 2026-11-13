# ETC LegalHub — Hướng dẫn giao diện và hệ thống thiết kế

Khi tạo hoặc chỉnh sửa mã giao diện (`frontend/src/**`) trong kho mã này, cần tuân thủ **Hệ thống thiết kế ETC LegalHub**:

## 1. Nguyên tắc thiết kế
- **Gọn gàng · Tối giản · Hiện đại · Chuyên nghiệp · Dễ đọc**
- *Giảm trang trí, tăng độ rõ ràng. Giảm nhiễu, tập trung vào thông tin.*
- **Không sử dụng**:
  - Biểu tượng cảm xúc (`📊`, `🗺️`, `🚪`, `🏭`, `💧`, `🗑️`, `✏️`, `➕`, `📋`, `⚡`, v.v.) làm biểu tượng giao diện. Dùng bộ Tabler Outline (`<i class="ti ti-..."></i>`).
  - Hiệu ứng phát sáng neon, kính mờ, giả nổi, bóng đổ nặng hoặc chuyển sắc tím/xanh nhiều màu.
  - Phông `Playfair Display` hoặc phông chân có chân. Dùng `Be Vietnam Pro` cho tiêu đề, nội dung và điều khiển.
  - Thay đổi nghiệp vụ, API, quy tắc phân loại, công thức QCVN hoặc luồng xác thực/phân quyền khi chỉ cập nhật giao diện.

## 2. Bảng màu (biến CSS)
- **Nền chính (`--bg`)**: `#F6F8F6`
- **Bề mặt/thẻ (`--surface`)**: `#FFFFFF`
- **Bề mặt phụ (`--surface2`)**: `#F0F4F1`
- **Xanh chủ đạo (`--accent` / `--primary`)**: `#286B4F`
- **Màu khi rê chuột (`--primary-hover`)**: `#20573F`
- **Xanh nhạt (`--accent2` / `--primary-light`)**: `#EAF3ED`
- **Chữ tiêu đề (`--text`)**: `#192A21`
- **Chữ nội dung (`--text2`)**: `#526158`
- **Chữ phụ (`--text3`)**: `#89958D`
- **Đường viền (`--border`)**: `#E5EBE6`
- **Màu trạng thái**:
  - Thành công (`--success` / `--success-bg`): `#25845B` / `#EAF5EF`
  - Cảnh báo (`--warn` / `--warn-bg`): `#D99A38` / `#FCF6EC`
  - Nguy hiểm (`--red` / `--red-bg`): `#D65B5B` / `#FDF0F0`
  - Thông tin (`--info` / `--info-bg`): `#5681A5` / `#EFF4F8`

## 3. Quy chuẩn thành phần và bố cục
- **Khung ứng dụng**: Thanh điều hướng trái có thể thu gọn (`248px` / `68px`), thanh trên (`56px`, có đường dẫn và hồ sơ người dùng) và vùng làm việc chính (`max-width: 1360px`).
- **Tránh lặp thanh bên**: Danh sách dự án/mẫu đã lưu và chi tiết văn bản dùng thanh chọn phía trên cùng ngăn trượt (`.drawer-overlay` + `.drawer-panel`).
- **Điều khiển**: Ô nhập, danh sách chọn và nút tiêu chuẩn cao `38px`; bo góc `8px–12px`; viền `1px solid var(--border)`.
- **Yêu cầu build**: Khi sửa `frontend/src/**`, chạy `npm run build` trong `frontend/` để cập nhật giao diện tĩnh trong `backend/public/` cho Express cổng `3000`.
