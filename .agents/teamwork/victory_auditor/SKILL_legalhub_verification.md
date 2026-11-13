---
name: legalhub-verification
description: Quy trình kiểm chứng parity UI-Engine-DB, chốt fail-closed pháp lý, chạy unit/integration test backend và build frontend cho LegalHub trước khi bàn giao.
---

# LegalHub Verification Skill

Kích hoạt skill này mỗi khi chỉnh sửa các module lõi:
- Phân loại hồ sơ & thẩm quyền (`backend/services/classification-service.js`, `backend/routes/classification.js`, `backend/routes/projects.js`, `frontend/src/components/ClassifyTab.vue`)
- Đối chiếu QCVN (`backend/services/qcvn-service.js`, `frontend/src/data/qcvn-db.js`, `backend/routes/qcvns.js`, `frontend/src/components/QCVNTab.vue`)
- Seed / Migration / Dashboard / Map (`backend/services/rule-repository.js`, `backend/init-db.js`, `backend/routes/dashboard.js`, `frontend/src/components/DashboardTab.vue`, `frontend/src/components/MapTab.vue`)

## Checklist Bắt Buộc

1. **Kiểm tra nguồn sự thật DB & trạng thái duyệt**
   - Không có `TRUNCATE` hay câu lệnh ghi đè bản ghi có `verification_status IN ('VERIFIED', 'PUBLISHED')`.
   - Engine đọc từ DB repository (chỉ lấy rule hợp lệ), không dùng `DRAFT` / `PENDING_REVIEW` / `REJECTED`.
   - Fallback tĩnh khi không có DB phải gán `ruleSource: 'FALLBACK_UNVERIFIED'` và trả `NEEDS_REVIEW`.

2. **Kiểm tra Fail-Closed & Độ hoàn chỉnh**
   - `NEEDS_LEGAL_VERIFICATION` luôn giữ `isOfficialConclusion: false` và `canExportOfficialReport: false`.
   - Kiểm tra cả 2 hướng: UI `ClassifyTab.vue` / `QCVNTab.vue` không tự điền giá trị giả (`100`, `'B'`, `'qcvn40_a_low'`, `Nhóm IV`) trước khi gọi engine/API.
   - `POST /api/projects` và `POST /api/qcvns/samples` bỏ qua kết luận gửi sẵn từ client và luôn tính lại phía server.
   - `routes/dashboard.js` chỉ đếm `status === 'dat'` vào `passSamples` / `dat`.

3. **Kiểm tra Parity UI – Engine – DB**
   - Mọi `<option>` ngành trên UI khớp mã ngành do `GET /api/classification/metadata` trả về.
   - Toàn bộ 6 ngành có `processRules` (`thep`, `nhiet_dien`, `hoa_chat`, `giay_bot`, `det_nhuom`, `dien_tu`) đều có metadata công đoạn và được seed vào `classification_thresholds.process_stage`.
   - `MAP_KEYWORDS` trong `QCVNTab.vue` map đúng tên chuẩn (`Cr_tong`, `Sulfide`, `NO2`, ...) trùng key trong bảng QCVN tương ứng.
   - `permitLimits` xử lý đúng cả 3 loại `'max'`, `'min'`, `'range'` (ví dụ pH) tại cả UI lẫn server.

4. **Chạy Kiểm thử & Build (Bắt buộc)**
   Chạy tuần tự 2 lệnh sau từ `d:\ĐATN\demo` (hoặc tương ứng):
   ```powershell
   npm test --prefix backend
   npm run build --prefix frontend
   ```
   Chỉ báo cáo hoàn tất khi cả 2 lệnh thoát mã `0`, không có test bị bỏ qua, và báo rõ phạm vi chạy trên mock DB hay PostgreSQL thực.
