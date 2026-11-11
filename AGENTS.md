# Workspace Rules — LegalHub (`d:\ĐATN\demo`)

Các bất biến kỹ thuật bắt buộc cho mọi thay đổi liên quan đến **Phân loại hồ sơ môi trường**, **Xác định thẩm quyền**, **Đối chiếu QCVN**, **Database/Crawler**, và **Dashboard/Map**:

## 1. Single Database Source of Truth
- Runtime engine phân loại (`classification-service`) và đối chiếu QCVN (`qcvn-service` / API `/api/qcvns`) **chỉ sử dụng dữ liệu quy tắc hợp lệ từ PostgreSQL** (`industries`, `classification_thresholds`, `legal_appendices`, `qcvns`, `rules`).
- Chỉ các bản ghi đã ở trạng thái công bố/hợp lệ mới được dùng để trả kết luận; mọi bản ghi `DRAFT`, `PENDING_REVIEW`, `EXTRACTED`, `RAW`, `REJECTED` phải bị loại khỏi tập runtime.
- File JS tĩnh trong `frontend/src/data/` hoặc bảng hằng trong service chỉ đóng vai trò **seed nền ban đầu** hoặc **fixture test**. Không được chạy `TRUNCATE` hay ghi đè các bản ghi đã `VERIFIED` / `PUBLISHED` trong DB khi khởi tạo/seed.
- Nếu DB không sẵn sàng và buộc dùng fallback tĩnh trong môi trường test/khởi động, phải gắn rõ `ruleSource: 'FALLBACK_UNVERIFIED'` và **hạ trạng thái kết luận xuống `NEEDS_REVIEW`**.

## 2. Fail-Closed Legal & Completeness Gates
- **Không suy đoán pháp lý:** Ngưỡng, đơn vị, thẩm quyền, bảng giới hạn QCVN gắn `NEEDS_LEGAL_VERIFICATION` hoặc chưa xác minh tuyệt đối không được nâng thành kết luận chính thức (`isOfficialConclusion: false`, `canExportOfficialReport: false`, `conclusionStatus: 'NEEDS_LEGAL_VERIFICATION'`).
- **Không fallback im lặng về giá trị mặc định an toàn giả:**
  - Ngành không tồn tại hoặc không hợp lệ -> `UNKNOWN_INDUSTRY` / `NEEDS_REVIEW` (`hs: null`, `nhom: null`, `tq: null`), cấm fallback về `Nhóm IV / DKMT / cap_xa`.
  - Ngành có `processRules` (công đoạn / loại hình nhiên liệu) nhưng thiếu hoặc sai `processStage` -> `NEEDS_REVIEW` (`MISSING_PROCESS_STAGE` / `INVALID_PROCESS_STAGE`), cấm tự rơi về tier chung.
  - `capacity` là `NaN`, rỗng không hợp lệ hoặc `< 0` -> `NEEDS_REVIEW` (`INVALID_CAPACITY`), cấm rơi về tier cuối.
  - QCVN thiếu `flowRate` -> `NEEDS_REVIEW` (`MISSING_FLOW_RATE`), cấm gán giả `100 m³/ngày`.
  - QCVN chưa xác nhận `receivingWaterConfirmed` -> mặc định `false` và trả `NEEDS_REVIEW` (`MISSING_RECEIVING_SOURCE`), cấm gán giả cột `'B'`.
  - Cơ sở cũ trong giai đoạn chuyển tiếp nhưng DB chưa có bảng giới hạn QCVN 40:2011 / QCVN 14:2008 riêng -> `NEEDS_REVIEW` (`TRANSITION_TABLE_NOT_AVAILABLE`), cấm map sang bảng 2025.
  - Mẫu thiếu chỉ tiêu bắt buộc hoặc lệch chu kỳ lấy mẫu -> `INCOMPLETE` (`chua_du_thong_so`) hoặc `PERIOD_MISMATCH` (`period_mismatch`), cấm gán `PASS` (`dat`).
- **Dashboard & Báo cáo:** Không bao giờ đếm mẫu `chua_du_thong_so` (`INCOMPLETE`), `can_ra_soat` (`NEEDS_REVIEW`), hay `period_mismatch` vào `dat` / `passSamples`. UI phải hiển thị cảnh báo và chặn xuất báo cáo/kết luận chính thức khi `!isOfficialConclusion`.

## 3. Server-Authoritative Evaluation
- `POST /api/projects` và `POST /api/qcvns/samples` **phải tính toán lại hoàn toàn** kết quả phân loại, thẩm quyền, `conclusionStatus` và đánh giá QCVN (`trang_thai_tong_quat`, `overall_status`, `evaluation_details`) trên server dựa trên dữ liệu DB tại thời điểm lưu.
- Tuyệt đối không tin `classification_result` hay `trang_thai_tong_quat` tính sẵn từ client; không tin `sensitiveCriteriaVerified` thô từ client như bằng chứng pháp lý đã thẩm định khi chưa có bản ghi xác minh phía server.
- Mọi kết luận lưu DB phải kèm metadata truy xuất: `ruleSource`, `ruleVersion`, `verificationStatus`, `evaluationDate`.

## 4. UI–Engine–DB Parity & Mandatory Tests
- Dropdown ngành, `processStage`, từ khóa map nhanh (`MAP_KEYWORDS`), bộ lọc trạng thái/thẩm quyền (`Dashboard`, `Map`) phải đồng bộ 1-1 với dữ liệu catalog từ API/DB.
- Khi sửa logic phân loại, QCVN, route liên quan hoặc seed/migration DB, bắt buộc:
  1. Cập nhật/bổ sung test trong `backend/tests/`.
  2. Chạy `npm test --prefix backend` và xác nhận tất cả test pass (0 skipped).
  3. Chạy `npm run build --prefix frontend` khi có thay đổi frontend.
