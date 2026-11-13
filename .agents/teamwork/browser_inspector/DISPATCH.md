# Dispatch: Browser UI & E2E Interaction Inspector

## Objective
Kiểm tra trực tiếp ứng dụng LegalHub đang chạy trên trình duyệt web (UI, layout, console logs, tương tác, đồng bộ dữ liệu):
1. Xác định địa chỉ frontend (thông thường http://localhost:5173 hoặc tương tự) và backend (http://localhost:5000 hoặc tương tự). Nếu dịch vụ chưa chạy, kiểm tra quy trình khởi động và thực hiện truy cập.
2. Duyệt qua tất cả các tab và luồng tương tác chính:
   - **Phân loại hồ sơ môi trường (ClassifyTab)**: Thao tác chọn ngành, nhập quy mô công suất, chọn công đoạn (processStage), bấm phân loại, kiểm tra kết quả hiển thị, nút lưu hồ sơ, cảnh báo pháp lý.
   - **Đối chiếu QCVN (QCVNTab)**: Chọn quy chuẩn (QCVN 40, QCVN 14, QCVN 19...), nhập lưu lượng, hệ số Kq/Kf/Kp/Kv, chọn nguồn tiếp nhận, nhập thông số đo đạc, kiểm tra bảng so sánh, cảnh báo vượt ngưỡng / không đạt / cần rà soát.
   - **Bản đồ dự án (MapTab)**: Hiển thị bản đồ Leaflet/Mapbox/OpenLayers, hiển thị marker cơ sở dữ liệu, bộ lọc theo thẩm quyền/trạng thái, popup chi tiết khi click marker.
   - **Bảng điều khiển (DashboardTab)**: Thống kê tổng số dự án, tỷ lệ đạt/vượt, biểu đồ phân bố, danh sách cảnh báo.
   - **Quản lý quy chuẩn / Crawler**: Giao diện danh mục văn bản pháp lý, danh mục quy chuẩn, nút kích hoạt crawl hoặc trạng thái crawler.
3. Rà soát toàn bộ các lỗi hiển thị:
   - Lỗi JavaScript runtime trong Console (Uncaught Error, TypeError, warning).
   - Lỗi mạng / Network requests (404, 500, CORS, timeout).
   - Lỗi hiển thị giao diện: vỡ layout, responsive vỡ trên màn hình khác nhau, text overflow, overlap, mất icon, lệch padding/margin.
   - Lỗi phản hồi tương tác: nút bấm không phản hồi, spinner loading vô tận, thiếu feedback khi lưu/thao tác lỗi.
   - Lỗi đồng bộ dữ liệu: dropdown không tải được dữ liệu từ API, dữ liệu cũ hiển thị đè dữ liệu mới, kết quả UI khác với server.
4. Ghi lại bằng chứng cụ thể: URL, thao tác kích hoạt lỗi, console log output, vị trí element trên DOM, mức độ ảnh hưởng.
5. KHÔNG ĐƯỢC CHỈNH SỬA BẤT KỲ MÃ NGUỒN ỨNG DỤNG NÀO trong đợt rà soát này.

## Input Information
- Workspace: `d:\ĐATN\demo`
- Workspace rules: `d:\ĐATN\demo\AGENTS.md`
- Original request: `d:\ĐATN\demo\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project scope: `d:\ĐATN\demo\.agents\teamwork\orchestrator\PROJECT.md`

## Output Requirements
- Ghi báo cáo chi tiết vào file `d:\ĐATN\demo\.agents\teamwork\browser_inspector\handoff.md`.
