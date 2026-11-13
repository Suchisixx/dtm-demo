# 1. Tổng quan nghiệp vụ ETC LegalHub

## Mục tiêu hệ thống

ETC LegalHub hỗ trợ đội ngũ tư vấn môi trường quản lý hồ sơ dự án, tra cứu văn bản pháp luật, phân loại nghĩa vụ môi trường, xác định thẩm quyền, đối chiếu kết quả quan trắc với QCVN, theo dõi nghĩa vụ đến hạn và xem dữ liệu theo không gian. Hệ thống hỗ trợ chuyên viên rà soát; chỉ kết luận đủ căn cứ đã xác minh mới được coi là chính thức.

## Người dùng và quyền

- **Khách chưa đăng nhập:** tra cứu danh sách văn bản pháp lý và xem các trang công khai được máy chủ cho phép.
- **Chuyên viên (`staff`):** quản lý hồ sơ trong phạm vi tài khoản, phân loại, so sánh QCVN, theo dõi nhắc hạn, dashboard và bản đồ.
- **Quản trị viên (`admin`):** quản lý người dùng/hồ sơ, văn bản, dữ liệu crawler, ngành, ngưỡng, QCVN, đề xuất quy tắc và xác minh yếu tố nhạy cảm.

Đăng nhập dùng JWT trong cookie `HttpOnly`. Giao diện điều hướng theo vai trò để thuận tiện; máy chủ vẫn xác thực và phân quyền từng API.

## Các phân hệ nghiệp vụ

### Thư viện văn bản pháp lý

Tra cứu luật, nghị định, thông tư, văn bản hợp nhất và QCVN; lọc, tìm kiếm, xem hiệu lực và nội dung điều khoản. Quản trị viên cập nhật văn bản. Crawler ghi nhận thay đổi và đề xuất để kiểm duyệt, không tự công bố quy tắc pháp lý.

### Lập hồ sơ, phân loại và xác định thẩm quyền

Chuyên viên nhập ngành, công suất/quy mô, công đoạn, ngày đánh giá, vị trí, thông tin thủ tục và yếu tố nhạy cảm. Máy chủ đối chiếu catalog và ngưỡng đang hiệu lực trong PostgreSQL, xác định nhóm hồ sơ, thủ tục và thẩm quyền. Khi lưu dự án, máy chủ đánh giá lại từ dữ liệu hiện hành thay vì tin kết quả do trình duyệt gửi.

Hồ sơ được lưu trong danh sách dự án; màn hình phân loại hỗ trợ nạp hồ sơ cũ và xử lý tên phường/xã trước sáp nhập thông qua bí danh trong danh mục hiện hành. Chọn tỉnh/phường chỉ điều hướng bản đồ và hiển thị ranh giới, không thay tọa độ ghim của dự án.

### Đối chiếu QCVN

Người dùng chọn loại nước thải/khí thải, QCVN áp dụng và nhập lưu lượng, nguồn tiếp nhận cùng kết quả đo. Máy chủ xác định quy chuẩn phù hợp và tính trạng thái từng chỉ tiêu; khi lưu mẫu, máy chủ đánh giá lại.

- Thiếu chỉ tiêu bắt buộc: `INCOMPLETE` / `chua_du_thong_so`.
- Thiếu lưu lượng hoặc chưa xác nhận nguồn tiếp nhận: `NEEDS_REVIEW`.
- Sai chu kỳ lấy mẫu: `PERIOD_MISMATCH` / `period_mismatch`.
- Thiếu bảng riêng cho trường hợp chuyển tiếp: `NEEDS_REVIEW`.
- Mẫu thiếu dữ liệu, cần rà soát hoặc sai chu kỳ không được tính là mẫu đạt.

### Bản đồ GIS và địa giới hành chính

Bản đồ hiển thị vị trí dự án, lớp GIS, khu công nghiệp và cảnh báo không gian. Danh mục địa giới trong `frontend/src/data/vietnam-divisions.json` gồm 34 tỉnh/thành và 3.321 xã, phường, đặc khu theo bộ dữ liệu hiện hành. Backend tra ranh giới theo mã tại dịch vụ bản đồ hành chính; khi rê/đặt ghim, việc xác định đơn vị dựa trên giao cắt không gian từ dịch vụ này, không dùng tên gần đúng của Nominatim để kết luận. Khi dịch vụ lỗi, giữ nguyên tọa độ và thông báo chưa xác định.

### Dashboard và nhắc hạn tuân thủ

Dashboard tổng hợp hồ sơ, mẫu quan trắc, trạng thái rà soát và chỉ số theo phạm vi quyền. Nhắc hạn theo dõi nghĩa vụ theo dự án, căn cứ, ngày đến hạn và chu kỳ; hiển thị quá hạn, sắp đến hạn, trong hạn hoặc đã hoàn thành. Scheduler quét nhắc hạn hằng ngày lúc 07:00.

### Quản trị và kiểm duyệt

Quản trị viên quản lý tài khoản, dự án, văn bản, tác động văn bản lên quy tắc, đề xuất crawler, catalog ngành, ngưỡng phân loại, QCVN và xác minh nhạy cảm. Chỉ dữ liệu đủ trạng thái xác minh/công bố mới được dùng trong runtime.

## Nguyên tắc kết luận pháp lý

- `DRAFT`, `PENDING_REVIEW`, `EXTRACTED`, `RAW`, `REJECTED` và `ARCHIVED` bị loại khỏi tập dữ liệu runtime hợp lệ.
- Không tự suy đoán ngành, nhóm hồ sơ, thẩm quyền, lưu lượng, nguồn tiếp nhận hoặc giới hạn QCVN khi thiếu dữ liệu.
- Khi dùng nguồn dự phòng chưa xác minh, kết quả phải mang `ruleSource: 'FALLBACK_UNVERIFIED'`, trạng thái rà soát và không được xuất báo cáo chính thức.
- Kết luận phải có metadata truy xuất như `ruleSource`, `ruleVersion`, `verificationStatus`, `evaluationDate`.
- Dashboard và báo cáo không tính mẫu thiếu chỉ tiêu, cần rà soát hay lệch chu kỳ thành đạt.

## Quy trình sử dụng thường gặp

1. Đăng nhập bằng tài khoản được cấp.
2. Tạo hoặc mở hồ sơ dự án, nhập thông tin ngành, quy mô, công đoạn và vị trí ghim.
3. Kiểm tra kết quả phân loại, căn cứ và trạng thái xác minh; bổ sung dữ liệu nếu cần.
4. Lưu hồ sơ; máy chủ tính lại kết quả trước khi ghi PostgreSQL.
5. Tạo mẫu quan trắc, xác nhận lưu lượng/nguồn tiếp nhận và nhập đủ chỉ tiêu; kiểm tra đánh giá QCVN.
6. Theo dõi nghĩa vụ môi trường đến hạn, dashboard và bản đồ; yêu cầu quản trị viên rà soát các căn cứ chưa được xác minh.

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
| --- | --- |
| ĐTM | Đánh giá tác động môi trường |
| GPMT | Giấy phép môi trường |
| ĐKMT | Đăng ký môi trường |
| QCVN | Quy chuẩn kỹ thuật quốc gia |
| GIS | Hệ thống thông tin địa lý |
| `VERIFIED` / `PUBLISHED` | Dữ liệu đã được xác minh hoặc công bố theo quy trình quản trị |
| `NEEDS_REVIEW` | Thiếu căn cứ hoặc dữ liệu; cần rà soát |
| `INCOMPLETE` | Thiếu dữ liệu bắt buộc |
