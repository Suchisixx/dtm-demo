# BÁO CÁO RÀ SOÁT LỖI TOÀN DIỆN VÀ KẾ HOẠCH KHẮC PHỤC HỆ THỐNG LEGALHUB
**Dự án**: ETC LegalHub (`d:\ĐATN\demo`)  
**Ngày lập**: 13/11/2026  
**Chế độ thực thi**: Development & Comprehensive Audit (Read-Only — Không can thiệp mã nguồn)  
**Đơn vị điều phối**: Orchestrator (với sự tham gia của 3 subagent độc lập: `worker_tech_verify`, `explorer_codebase`, `browser_inspector`)

---

## MỤC LỤC
1. [Tổng quan Đợt Rà soát & Tuyên bố Không Can thiệp Mã nguồn](#1-tổng-quan-đợt-rà-soát)
2. [Kết quả Kiểm chứng Kỹ thuật & Test Suite](#2-kết-quả-kiểm-chứng-kỹ-thuật)
3. [Đánh giá Tuân thủ 4 Bất biến Kỹ thuật Cốt lõi (AGENTS.md)](#3-đánh-giá-tuân-thủ-bất-biến-kỹ-thuật)
4. [Kết quả Kiểm tra Trực tiếp trên Trình duyệt Web (Browser E2E)](#4-kết-quả-kiểm-tra-trực-tiếp-trên-trình-duyệt)
5. [Danh mục Toàn diện các Lỗi và Sai lệch Phát hiện (Defect Catalog)](#5-danh-mục-toàn-diện-các-lỗi-phát-hiện)
   - 5.1. Nhóm 1: Codebase & Core Engine
   - 5.2. Nhóm 2: Giao diện & Tương tác UI/UX
   - 5.3. Nhóm 3: Crawler & Cơ sở dữ liệu
   - 5.4. Nhóm 4: Quy trình & Tích hợp Không đồng bộ (Parity)
6. [Kế hoạch Khắc phục Chi tiết theo Thứ tự Ưu tiên (/plan)](#6-kế-hoạch-khắc-phục-chi-tiết)
7. [Phương pháp Kiểm chứng Độc lập (Verification Method)](#7-phương-pháp-kiểm-chứng-độc-lập)

---

## 1. TỔNG QUAN ĐỢT RÀ SOÁT

Đợt rà soát được tiến hành theo yêu cầu của hội đồng đánh giá và định hướng đồ án tốt nghiệp, nhằm đánh giá toàn diện hiện trạng hệ thống LegalHub từ tầng kiến trúc mã nguồn, cơ chế suy luận pháp lý, quy trình crawler dữ liệu, đến tính hiển thị và tương tác người dùng thực tế trên trình duyệt web.

### Cam kết Bất biến về Phạm vi
- **Tuyệt đối không chỉnh sửa mã nguồn ứng dụng**: Trong toàn bộ quá trình rà soát, không có bất kỳ tệp mã nguồn nào trong `backend/` hay `frontend/` bị can thiệp, sửa đổi hoặc thêm mới.
- **Tính độc lập của dữ liệu kiểm tra**: Mọi dữ liệu kiểm thử, log thực thi, mã kịch bản Playwright và ảnh chụp màn hình (19 screenshots) đều được ghi nhận độc lập trong thư mục điều phối `.agents/teamwork/`.

---

## 2. KẾT QUẢ KIỂM CHỨNG KỸ THUẬT

### 2.1. Backend Test Suite (`npm test --prefix backend`)
- **Lệnh thực thi**:
  ```powershell
  npm test --prefix backend
  # node --test tests/classification-p0.test.js tests/qcvn-p0.test.js tests/routes-and-parity.test.js tests/compliance-reminder.test.js tests/administrative-boundaries.test.js
  ```
- **Kết quả**: **31/31 passed, 0 failed, 0 skipped, 0 cancelled**. Thời gian thực thi: **692ms**.
- **Đánh giá**:
  - Toàn bộ 5 bộ kiểm thử cốt lõi đều đạt 100% khi chạy trên tầng Mock DB / in-memory repository.
  - Các ca kiểm thử pháp lý nghiêm ngặt (CL-01 đến CL-15, QV-01 đến QV-17) xác nhận tính toán phân loại (Nhóm dự án → Thủ tục môi trường → Thẩm quyền giải quyết) và đối chiếu QCVN hoàn toàn chính xác.

### 2.2. PostgreSQL Live Integration Test (`npm run test:pg --prefix backend`)
- **Lệnh thực thi**: `npm run test:pg --prefix backend` (`tests/postgres-integration.test.js`)
- **Kết quả**: **0 passed, 4 failed**.
- **Nguyên nhân**: `AggregateError [ETIMEDOUT]: connect ETIMEDOUT 127.0.0.1:5432 / ::1:5432`.
- **Đánh giá**: Do môi trường kiểm thử hiện tại chưa bật dịch vụ PostgreSQL trên cổng 5432. Bộ test integration phụ thuộc trực tiếp vào DB vật lý.

### 2.3. Frontend Production Build (`npm run build --prefix frontend`)
- **Lệnh thực thi**: `npm run build --prefix frontend` (Vite v8.2.0)
- **Kết quả**: **Thành công (Exit code 0)** trong **719ms**, tạo gói bundle tại `backend/public/`:
  - `backend/public/index.html`: `1.33 kB` (gzip: `0.62 kB`)
  - `backend/public/assets/index-B1_dI9ss.css`: `53.77 kB` (gzip: `9.41 kB`)
  - `backend/public/assets/index-BTsFgRzp.js`: `437.68 kB` (gzip: `118.42 kB`)
  - `backend/public/assets/vietnam-divisions-BeaYaFZ5.js`: `589.15 kB` (gzip: `101.05 kB`)
- **Cảnh báo ghi nhận**:
  `(!) Some chunks are larger than 500 kB after minification.` đối với chunk `vietnam-divisions-BeaYaFZ5.js` (589.15 kB).

### 2.4. Trạng thái Mạng, Dịch vụ & Cổng kết nối (Ports Status)
- **Port 3000**: **Xung đột / Bị khóa bởi Windows NAT/Hyper-V** (`EADDRINUSE` / `EACCES`).
- **Port 5000**: Khả dụng và hoạt động ổn định khi chạy Express backend (`[INFO] ETC server đang hoạt động tại: http://localhost:5000`).
- **Port 5432**: Đóng (PostgreSQL offline).

---

## 3. ĐÁNH GIÁ TUÂN THỦ 4 BẤT BIẾN KỸ THUẬT (AGENTS.MD)

| Bất biến kỹ thuật | Hiện trạng kiểm tra | Đánh giá | Bằng chứng kiểm chứng |
|---|---|:---:|---|
| **1. Single Database Source of Truth** | Runtime nạp quy tắc trực tiếp từ DB repository; lọc bỏ triệt để các trạng thái `DRAFT`, `PENDING_REVIEW`, `EXTRACTED`, `RAW`, `REJECTED`. Bản ghi `VERIFIED` được bảo vệ không bị ghi đè khi seed. Khi DB offline, backend tự động chuyển sang `ruleSource: 'FALLBACK_UNVERIFIED'` và hạ kết luận xuống `NEEDS_REVIEW`. Nếu ở chế độ production, ngắt mã lỗi 503 `RuleDataUnavailableError`. | **ĐẠT** | `rule-repository.js:589,702`, `classification-p0.test.js:41`, `qcvn-p0.test.js:52`. |
| **2. Fail-Closed Legal & Completeness Gates** | - Ngành lạ/xóa bỏ -> `UNKNOWN_INDUSTRY` / `NEEDS_REVIEW` (không gán Nhóm IV hay cấp xã).<br>- Ngành có `processRules` thiếu `processStage` -> `MISSING_PROCESS_STAGE` / `NEEDS_REVIEW`.<br>- Công suất âm/NaN -> `INVALID_CAPACITY` / `NEEDS_REVIEW`.<br>- QCVN thiếu lưu lượng -> `MISSING_FLOW_RATE` (không gán 100 m³/ngày).<br>- Chưa xác nhận nguồn tiếp nhận -> `MISSING_RECEIVING_SOURCE` (không gán Cột B).<br>- Thiếu chỉ tiêu/lệch chu kỳ -> `INCOMPLETE` / `PERIOD_MISMATCH` (chặn PASS).<br>- Dashboard không đếm mẫu `INCOMPLETE`, `NEEDS_REVIEW` vào `dat`/`passSamples`. | **ĐẠT** | `classification-service.js:940-1010`, `qcvn-evaluator.js:120-210`, `dashboard-service.js:397-408`. |
| **3. Server-Authoritative Evaluation** | Tuyến `POST /api/projects` và `POST /api/qcvns/samples` bỏ qua toàn bộ kết quả client gửi lên; tính toán lại 100% trên server trước khi lưu DB. Gắn đầy đủ metadata truy xuất (`ruleSource`, `ruleVersion`, `verificationStatus`, `evaluationDate`). | **ĐẠT** | `routes/projects.js:454`, `routes/qcvns.js:337-353`, `tests/routes-and-parity.test.js:56`. |
| **4. UI–Engine–DB Parity** | Dropdown ngành khớp mã danh mục từ DB (`GET /api/classification/metadata`); 6 ngành đặc thù có metadata công đoạn đầy đủ; `MAP_KEYWORDS` map chuẩn tên thông số. Tuy nhiên, phát hiện thiếu trường nhập `permitLimits` trên UI (xem BUG-05). | **ĐẠT MỘT PHẦN** | Giao diện thiếu input `permitLimits`; dropdown ngành bị lỗi hiển thị lặp do code Vue (xem BUG-05 & BUG-09). |

---

## 4. KẾT QUẢ KIỂM TRA TRỰC TIẾP TRÊN TRÌNH DUYỆT WEB (BROWSER E2E)

Subagent `browser_inspector` đã khởi động ứng dụng trên cổng `5000` và thực hiện kiểm thử tự động chuyên sâu qua trình duyệt Chromium (Playwright) trên 3 độ phân giải: Desktop (1440x900), Tablet (768x1024), và Mobile (375x667). 

### Kết quả trên từng Phân hệ Giao diện
1. **Phân loại hồ sơ môi trường (`ClassifyTab`)**:
   - **Thao tác**: Nhập tên dự án, chọn ngành nghề, công đoạn, quy mô công suất, vị trí hành chính và bấm "Phân loại hồ sơ".
   - **Ghi nhận**: Cơ chế tính toán hoạt động chính xác; bảng kết quả hiển thị Nhóm dự án, Thủ tục và Thẩm quyền. Tuy nhiên, phát hiện lỗi lặp 78 options ngành nghề (BUG-09), sử dụng `window.alert()` làm đơ giao diện (BUG-10), và mất icon trên nút bấm (BUG-08).
2. **Đối chiếu QCVN (`QCVNTab`)**:
   - **Thao tác**: Chọn QCVN 40:2025, chọn nguồn tiếp nhận (Cột A/B), nhập lưu lượng, điền giá trị đo đạc mẫu (BOD5, COD, TSS...).
   - **Ghi nhận**: Bảng tính toán tự động sinh giới hạn Cmax chuẩn xác, phát hiện vượt ngưỡng đúng thông số; hiển thị cảnh báo `FALLBACK_UNVERIFIED` khi DB offline. Thiếu cột/trường nhập `permitLimits` theo GPMT (BUG-05).
3. **Bản đồ GIS (`MapTab`)**:
   - **Thao tác**: Chuyển sang tab Bản đồ, tương tác zoom, lọc theo thẩm quyền.
   - **Ghi nhận**: Bản đồ **không thể khởi tạo** do phụ thuộc CDN `unpkg.com` bị lỗi DNS khi chạy offline (`window.L` undefined) (BUG-08).
4. **Bảng điều khiển (`DashboardTab`)**:
   - **Thao tác**: Tải thống kê dự án, biểu đồ tỷ lệ tuân thủ, danh sách cảnh báo.
   - **Ghi nhận**: Giao diện KPI hiển thị tốt. Khi DB offline, API trả về 500 khiến danh sách rỗng; phát hiện điểm lỗi tiềm ẩn `stats.staffList.length` thiếu `?.` có thể làm sập component (BUG-13).
5. **Thư viện pháp luật (`LawsTab`) & Quản trị Crawler (`AdminTab`)**:
   - **Thao tác**: Duyệt danh mục văn bản pháp luật, xem các đề xuất quy chuẩn mới từ crawler.
   - **Ghi nhận**: Đề xuất QCVN mới từ crawler có mảng thông số rỗng `tham_so: []`, khi Admin bấm Duyệt bị văng lỗi 400 do giao diện thiếu form cấu hình thông số (BUG-04).

---

## 5. DANH MỤC TOÀN DIỆN CÁC LỖI PHÁT HIỆN (DEFECT CATALOG)

### 5.1. Nhóm 1: Codebase & Core Engine

#### [BUG-01] [CRITICAL] Nuốt ngoại lệ và không lưu được xác minh nhạy cảm do lệch tên bảng
- **Vị trí**: `backend/services/project-verification-repository.js` (Dòng 181-205)
- **Hiện trạng code**:
  ```javascript
  // Dòng 114 & 153: Đọc và cập nhật qua view tiếng Anh:
  SELECT ... FROM project_sensitive_verifications WHERE project_id = $1
  UPDATE project_sensitive_verifications SET ...
  // Dòng 181: Nhưng INSERT lại chỉ định cứng bảng vật lý tiếng Việt:
  INSERT INTO xac_minh_yeu_to_nhay_cam_du_an (du_an_ma, co_yeu_to_khai_bao, ...)
  // Dòng 204: Bắt lỗi nếu bảng không tồn tại và nuốt lỗi:
  } catch (err) {
    if (err && /does not exist|relation/i.test(String(err.message || ''))) return null;
    return null;
  }
  ```
- **Nguyên nhân gốc rễ**: Khi ứng dụng chạy trên schema cũ hoặc mock DB chỉ có cấu trúc `project_sensitive_verifications`, câu lệnh INSERT ném lỗi `relation "xac_minh_yeu_to_nhay_cam_du_an" does not exist`. Khối `catch` nuốt lỗi và trả về `null`.
- **Mức độ ảnh hưởng**: **Critical** — Thẩm định nhạy cảm của dự án bị thất bại âm thầm, khiến dự án mãi mãi bị khóa ở trạng thái sơ bộ `NEEDS_LEGAL_VERIFICATION`.
- **Phương án khắc phục**: Bổ sung cơ chế fallback kiểm tra tương thích schema: nếu bảng tiếng Việt chưa có, thử INSERT vào `project_sensitive_verifications` hoặc bảo đảm câu lệnh migration luôn được thực thi trước. Ghi log cảnh báo chi tiết thay vì nuốt lỗi âm thầm.

---

### 5.2. Nhóm 2: Giao diện & Tương tác UI/UX

#### [BUG-08] [P0 / CRITICAL] Lệ thuộc CDN ngoại tuyến gây sập Bản đồ GIS và mất toàn bộ Icon
- **Vị trí**: `frontend/index.html` (Dòng 9-20)
- **Hiện trạng code**:
  Nhúng trực tiếp 7 tài nguyên CDN bên ngoài:
  - `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` & `leaflet.js`
  - `https://unpkg.com/leaflet.markercluster@1.5.3/...`
  - `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css`
  - `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro...`
- **Nguyên nhân gốc rễ**: Ứng dụng không bundle các thư viện UI thiết yếu vào `package.json` mà phụ thuộc vào mạng internet công cộng. Khi chạy trên mạng nội bộ, phòng thí nghiệm không có internet hoặc sandbox chặn DNS, phát sinh liên tiếp 7 lỗi `net::ERR_NAME_NOT_RESOLVED`.
- **Mức độ ảnh hưởng**: **Critical / P0** — `window.L` là `undefined`, MapTab hoàn toàn bị tê liệt; toàn bộ icon trên hệ thống biến thành ô vuông khuyết.
- **Phương án khắc phục**: Cài đặt `leaflet`, `leaflet.markercluster` và `@tabler/icons` qua npm (`npm install --save leaflet leaflet.markercluster @tabler/icons-webfont`), import trực tiếp trong `frontend/src/main.js` để Vite tự động đóng gói nội bộ (self-contained).

---

#### [BUG-09] [P1 / HIGH] Lỗi nhân đôi 100% danh mục ngành nghề trong `SearchableSelect.vue`
- **Vị trí**: `frontend/src/components/SearchableSelect.vue` (Dòng 51-57)
- **Hiện trạng code**:
  ```html
  <template v-if="groups.length">
    <template v-for="group in filteredGroups" ...>...</template>
  </template>
  <template v-else>
    <div v-if="filteredOptions.length === 0" ...>...</div>
  </template>
  <!-- LỖI: Vòng lặp phẳng nằm ngoài khối v-else -->
  <div v-for="opt in filteredOptions" :key="opt.code || opt.name" class="option-item" @click="selectOption(opt)">
  ```
- **Nguyên nhân gốc rễ**: Vòng lặp `v-for="opt in filteredOptions"` nằm bên ngoài thẻ `<template v-else>`. Khi component nhận prop `groups` (như 39 ngành nghề), cả 2 vòng lặp (theo nhóm và danh sách phẳng) đều cùng render.
- **Mức độ ảnh hưởng**: **High / P1** — Danh mục 39 ngành bị nhân đôi thành **78 options**. Khi người dùng tìm kiếm từ khóa `"thép"`, dropdown trả về 2 kết quả y hệt nhau, gây bối rối cho người dùng và giảm tính chuyên nghiệp của hệ thống.
- **Phương án khắc phục**: Đưa toàn bộ khối `v-for="opt in filteredOptions"` vào bên trong `<template v-else>`.

---

#### [BUG-10] [P1 / HIGH] Chặn đứng giao diện bằng `window.alert()` trong `ClassifyTab.vue`
- **Vị trí**: `frontend/src/components/ClassifyTab.vue` (Dòng 1092-1102)
- **Hiện trạng code**:
  ```javascript
  if (!name.value || !name.value.trim()) { alert('Vui lòng nhập tên dự án!'); return }
  if (!nganh.value) { alert('Vui lòng chọn loại hình dự án!'); return }
  if (availableProcessStages.value.length > 0 && !processStage.value) {
    alert('Ngành nghề này bắt buộc phải chọn công đoạn sản xuất hoặc loại nhiên liệu áp dụng!')
    return
  }
  if (Number.isNaN(parsedCap) || parsedCap < 0) { alert('Vui lòng nhập quy mô / công suất hợp lệ (>= 0)!'); return }
  if (!tinh.value && !selectedProvince.value) { alert('Vui lòng chọn Tỉnh / Thành phố hoặc chấm vị trí trên bản đồ!'); return }
  ```
- **Nguyên nhân gốc rễ**: Lạm dụng hàm popup native `window.alert` của trình duyệt thay vì xây dựng thông báo lỗi trên giao diện.
- **Mức độ ảnh hưởng**: **High / P1** — Làm đơ toàn bộ luồng tương tác của trang web, gây lỗi treo các framework kiểm thử tự động (Playwright/Cypress) và tạo trải nghiệm người dùng lạc hậu.
- **Phương án khắc phục**: Thay thế bằng inline error message dưới từng trường nhập liệu (viền đỏ kèm thông báo lỗi) hoặc sử dụng toast notification không chặn (non-blocking notification component).

---

#### [BUG-11] [P1 / HIGH] Vỡ giao diện và tràn chiều ngang 80px trên màn hình di động (375px)
- **Vị trí**: Shell ứng dụng và các grid container (`.app-shell`, `.kpi-grid`, `.form-row`)
- **Hiện trạng đo đạc**: Tại viewport 375x667, `scrollWidth = 455px` trong khi `clientWidth = 375px` (bị tràn ngang 80px).
- **Nguyên nhân gốc rễ**: Các phần tử form, filter và bảng điều khiển có thuộc tính `min-width` cố định vượt quá 375px hoặc thiếu quy tắc `flex-wrap: wrap` trên màn hình nhỏ.
- **Mức độ ảnh hưởng**: **High / P1** — Xuất hiện thanh cuộn ngang gây vỡ bố cục trên smartphone, nội dung và các nút bấm bị cắt mép phải.
- **Phương án khắc phục**: Bổ sung media query `@media (max-width: 640px)` với `overflow-x: hidden`, cấu hình `width: 100%`, `min-width: 0` cho các container biểu mẫu và lưới KPI.

---

#### [BUG-12] [P1 / HIGH] Xung đột cổng mặc định 3000 trên hệ điều hành Windows
- **Vị trí**: `backend/server.js` (Dòng 18), `backend/.env`, và `frontend/vite.config.js` (Dòng 18)
- **Hiện trạng**: Cổng 3000 bị chặn bởi cơ chế loại trừ cổng của Windows NAT/Hyper-V (`EADDRINUSE` / `EACCES`), trong khi `vite.config.js` proxy cứng tới `http://localhost:3000`.
- **Mức độ ảnh hưởng**: **High / P1** — Người dùng hoặc lập trình viên khi gõ `npm start` trên Windows bị báo lỗi sập server ngay lập tức.
- **Phương án khắc phục**: Đổi cổng mặc định trong `backend/.env` và `server.js` thành `5000` (hoặc cơ chế tự động tìm cổng rảnh khi bị chiếm dụng), đồng bộ cổng proxy trong `frontend/vite.config.js`.

---

#### [BUG-13] [P2 / MEDIUM] Truy cập thuộc tính không an toàn trong `DashboardTab.vue`
- **Vị trí**: `frontend/src/components/DashboardTab.vue` (Dòng 325)
- **Hiện trạng code**:
  ```html
  <div v-if="currentUser?.role === 'admin' && stats.staffList.length > 0" ...>
  ```
- **Nguyên nhân gốc rễ**: Biến phản ứng `stats` ban đầu không có trường `staffList`. Khi API phản hồi rỗng hoặc chưa nạp xong, việc gọi trực tiếp `.length` sẽ gây ngoại lệ `TypeError: Cannot read properties of undefined (reading 'length')`.
- **Mức độ ảnh hưởng**: **Medium / P2** — Nguy cơ làm sập component render của toàn bộ tab Dashboard đối với tài khoản Admin.
- **Phương án khắc phục**: Bổ sung toán tử optional chaining: `stats.staffList?.length > 0`.

---

#### [BUG-14] [P2 / MEDIUM] Lớp màn mờ `.drawer-overlay` kẹt chặn sự kiện con trỏ
- **Vị trí**: `frontend/src/components/classify/SavedProjectsDrawer.vue` (Dòng 16, 23-25)
- **Hiện trạng**: Khi mở drawer "Hồ sơ đã lưu", nếu nút đóng bị mất icon (do lỗi CDN Tabler) và người dùng bấm trượt, lớp overlay vẫn duy trì trên DOM và chặn toàn bộ pointer events của trang.
- **Mức độ ảnh hưởng**: **Medium / P2** — Làm tê liệt tương tác chuột trên màn hình, buộc người dùng phải F5 tải lại trang.
- **Phương án khắc phục**: Bổ sung phím tắt `Esc` để đóng drawer, hiển thị rõ ràng chữ "Đóng (×)" dự phòng khi icon không nạp được, và bảo đảm sự kiện click bên ngoài overlay luôn đóng drawer tin cậy.

---

### 5.3. Nhóm 3: Crawler & Cơ sở dữ liệu

#### [BUG-02] [HIGH] Bất nhất tên bảng tiếng Anh - tiếng Việt trong cài đặt Crawler
- **Vị trí**: `backend/routes/crawler.js` (Dòng 12 và 34-39)
- **Hiện trạng code**:
  ```javascript
  // SELECT đọc từ view tiếng Anh:
  SELECT value FROM system_settings WHERE key = $1
  // Nhưng INSERT lại ghi vào bảng vật lý tiếng Việt:
  INSERT INTO cai_dat_he_thong (khoa, gia_tri) VALUES ($1, $2) ON CONFLICT (khoa) ...
  ```
- **Nguyên nhân gốc rễ**: Do PostgreSQL view không hỗ trợ cú pháp `ON CONFLICT`, lập trình viên đã đổi tên bảng ở lệnh INSERT sang `cai_dat_he_thong` nhưng giữ nguyên `system_settings` ở câu lệnh SELECT.
- **Mức độ ảnh hưởng**: **High** — Gây lỗi `relation "cai_dat_he_thong" does not exist` khi chạy trên schema chưa di cư hoặc trong môi trường mock DB.
- **Phương án khắc phục**: Đồng bộ truy vấn cấu hình qua một hàm helper duy nhất trong repository, tự động phát hiện tên bảng khả dụng.

---

#### [BUG-03] [HIGH] Lỗi phụ thuộc thứ tự di cư schema khi nạp Seed Phân loại (`phu_luc_phap_ly`)
- **Vị trí**: `backend/services/rule-repository.js` (Dòng 495)
- **Hiện trạng code**: `seedClassificationCatalog` thực hiện `INSERT INTO phu_luc_phap_ly ... ON CONFLICT (ma)`, trong khi schema ban đầu chỉ tạo bảng `legal_appendices`.
- **Nguyên nhân gốc rễ**: Xung đột giữa bảng gốc và migration tiếng Việt.
- **Mức độ ảnh hưởng**: **High** — Nếu chạy seed trước migration hoặc chạy từng phần, lệnh seed sẽ bị hủy bỏ (aborted).
- **Phương án khắc phục**: Đảm bảo `ensureClassificationSchema` tạo bảng thống nhất trước khi seed hoặc bọc lệnh kiểm tra bảng tương thích.

---

#### [BUG-04] [MEDIUM] Phê duyệt Đề xuất QCVN từ Crawler bị chặn do mảng thông số rỗng
- **Vị trí**: `backend/services/crawler-sync-service.js` (Dòng 163) & `backend/services/rule-repository.js` (Dòng 850)
- **Hiện trạng code**: Crawler tự động tạo candidate đề xuất với `tham_so: []`. Khi Admin bấm Duyệt trên giao diện AdminTab, backend gọi `validateQcvnParameters(thamSo)` và ném lỗi HTTP 400 `QCVN_PARAMETERS_REQUIRED`.
- **Nguyên nhân gốc rễ**: Giao diện AdminTab chưa có form/modal cho Admin xem và bổ sung danh sách thông số đo đạc trước khi bấm Phê duyệt.
- **Mức độ ảnh hưởng**: **Medium** — Tính năng phê duyệt đề xuất quy chuẩn tự động từ crawler bị nghẽn ở bước cuối cùng, không thể chuyển đổi candidate thành quy chuẩn chính thức.
- **Phương án khắc phục**: Bổ sung modal "Cấu hình thông số quy chuẩn" trên AdminTab cho phép nhập các thông số (tên, đơn vị, ngưỡng Cột A/B) trước khi gửi yêu cầu Approve.

---

#### [BUG-15] [MEDIUM] Timeout 20 giây và phản hồi mã 500 khi cơ sở dữ liệu ngoại tuyến
- **Vị trí**: Các tuyến API nghiệp vụ (`backend/routes/laws.js`, `routes/dashboard.js`, `routes/auth.js`)
- **Hiện trạng**: Khi PostgreSQL offline, các route không ngắt nhanh (fast-fail) mà chờ hết 20 giây kết nối của pg-pool rồi trả về `500 Internal Server Error`.
- **Nguyên nhân gốc rễ**: Thiếu lớp middleware kiểm tra tính sẵn sàng của cơ sở dữ liệu (`healthcheck / circuit breaker`).
- **Mức độ ảnh hưởng**: **Medium** — Gây cảm giác ứng dụng bị đơ (lag 20s) trước khi hiển thị thông báo lỗi trên UI.
- **Phương án khắc phục**: Thiết lập timeout kết nối ngắn hơn (ví dụ 2000ms) trong môi trường phát triển và trả về mã lỗi 503 kèm thông báo thân thiện.

---

### 5.4. Nhóm 4: Quy trình & Tích hợp Không đồng bộ (Parity)

#### [BUG-05] [MEDIUM] Thiếu giao diện người dùng để cấu hình `permitLimits` (Giới hạn GPMT)
- **Vị trí**: `frontend/src/components/ClassifyTab.vue` & `frontend/src/components/QCVNTab.vue` (Dòng 303, 357, 599)
- **Hiện trạng**: Engine backend (`qcvn-service.js`, `qcvn-evaluator.js`) đã hoàn thiện tính năng đối chiếu kép: vừa so sánh theo QCVN, vừa so sánh theo Giới hạn Giấy phép môi trường riêng của cơ sở (`permitLimits`, hỗ trợ đủ 3 loại `max`, `min`, `range`). Tuy nhiên, trên cả 2 tab `ClassifyTab` và `QCVNTab` đều hoàn toàn thiếu các ô input để người dùng nhập ngưỡng GPMT này.
- **Nguyên nhân gốc rễ**: Bất đồng bộ giữa tiến độ phát triển của Engine và Giao diện người dùng.
- **Mức độ ảnh hưởng**: **Medium** — Người dùng không thể khai thác tính năng đánh giá theo Giấy phép môi trường thực tế từ giao diện web.
- **Phương án khắc phục**: Bổ sung trường nhập hoặc bảng cấu hình "Giới hạn theo Giấy phép Môi trường (nếu có)" trong `QCVNTab.vue` và lưu kèm vào hồ sơ dự án.

---

#### [BUG-06] [LOW] Tên biến cấu hình bản đồ không khớp với dịch vụ thực tế
- **Vị trí**: `frontend/src/utils/constants.js` (Dòng 69-74)
- **Hiện trạng**: Biến mang tên `CARTO_VOYAGER_URL` và `CARTO_ATTRIBUTION` nhưng lại trỏ tới đường link không chính thức của Google Maps (`https://mt{s}.google.com/...`).
- **Nguyên nhân gốc rễ**: Lập trình viên đổi nguồn tile map nhưng không đổi tên biến và attribution.
- **Mức độ ảnh hưởng**: **Low** — Nguy cơ bị Google chặn IP do truy cập tile map không có API key khi triển khai production.
- **Phương án khắc phục**: Chuẩn hóa lại nguồn tile map mở chuẩn (OpenStreetMap / CartoDB chuẩn) hoặc cấu hình Google Maps API key hợp lệ.

---

#### [BUG-07] [LOW] Cảnh báo kích thước gói tĩnh Frontend vượt ngưỡng 500 kB
- **Vị trí**: `frontend/src/data/vietnam-divisions.json` & `frontend/vite.config.js`
- **Hiện trạng**: Tệp `vietnam-divisions.json` (589 kB) tạo ra chunk `vietnam-divisions-BeaYaFZ5.js` vượt ngưỡng cảnh báo của Vite.
- **Nguyên nhân gốc rễ**: Toàn bộ dữ liệu 63 tỉnh thành và đơn vị cấp xã được nạp tĩnh một lần.
- **Mức độ ảnh hưởng**: **Low** — Tăng nhẹ thời gian tải trang ban đầu trên mạng chậm (tuy nhiên file được cache tốt sau lần tải đầu).
- **Phương án khắc phục**: Áp dụng dynamic `import()` theo từng tỉnh hoặc tăng `build.chunkSizeWarningLimit` lên `700` trong `vite.config.js`.

---

## 6. KẾ HOẠCH KHẮC PHỤC CHI TIẾT THEO THỨ TỰ ƯU TIÊN (/PLAN)

Kế hoạch khắc phục được tổ chức thành **4 giai đoạn (Phases)** có thứ tự ưu tiên chặt chẽ, bảo đảm giải quyết dứt điểm các lỗi chặn đứng hệ thống trước khi tối ưu hóa trải nghiệm:

```
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 1 (P0 & Critical): Tính Độc lập Ngoại tuyến & Schema DB      │
│  - Khử phụ thuộc CDN (npm install Leaflet, Tabler, Fonts)              │
│  - Sửa lỗi nuốt catch & lệch schema xac_minh_yeu_to_nhay_cam (BUG-01) │
│  - Chuẩn hóa cổng 5000 & khắc phục xung đột Port 3000 trên Windows     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 2 (P1 & High): Khắc phục Khiếm khuyết Giao diện & Tương tác  │
│  - Sửa lỗi nhân đôi 78 options trong SearchableSelect.vue (BUG-09)    │
│  - Thay thế window.alert() bằng Toast/Inline validation (BUG-10)       │
│  - Khắc phục tràn ngang 80px trên giao diện di động 375px (BUG-11)     │
│  - Sửa bất nhất schema system_settings vs cai_dat_he_thong (BUG-02)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 3 (P2 & Medium): Parity Engine - UI & Quy trình Crawler      │
│  - Bổ sung UI cấu hình permitLimits (Giới hạn GPMT) trên QCVNTab      │
│  - Thêm Modal cấu hình thông số cho Admin khi duyệt QCVN (BUG-04)      │
│  - Thêm optional chaining stats.staffList?.length trong DashboardTab   │
│  - Xử lý cơ chế đóng an toàn và phím Esc cho SavedProjectsDrawer      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ GIAI ĐOẠN 4 (Low): Tinh chỉnh Tối ưu hóa & Đóng gói Báo cáo Đồ án      │
│  - Chuẩn hóa nguồn Tile map (OpenStreetMap) và biến cấu hình (BUG-06)  │
│  - Tối ưu chunk size vietnam-divisions.json qua dynamic import (BUG-07)│
│  - Chạy toàn bộ kiểm thử xác nhận (npm test & npm run build)           │
│  - Bàn giao hệ thống hoàn chỉnh phục vụ đánh giá đồ án tốt nghiệp      │
└────────────────────────────────────────────────────────────────────────┘
```

### Chi tiết Phân công Nhiệm vụ theo Giai đoạn

#### GIAI ĐOẠN 1: Tính Độc lập Ngoại tuyến & Tính Toàn vẹn Schema (P0 & Critical)
1. **Nhiệm vụ 1.1 (Khử phụ thuộc CDN)**:
   - Cài đặt npm: `leaflet`, `leaflet.markercluster`, `@tabler/icons-webfont`.
   - Cập nhật `frontend/src/main.js` import trực tiếp CSS và JS của các thư viện trên.
   - Loại bỏ toàn bộ các thẻ `<link>` và `<script>` CDN công cộng trong `frontend/index.html`.
   - *Tiêu chí nghiệm thu*: Mọi icon hiển thị sắc nét và Bản đồ GIS khởi tạo thành công khi ngắt kết nối internet (`ERR_NAME_NOT_RESOLVED = 0`).
2. **Nhiệm vụ 1.2 (Sửa lỗi lưu xác minh nhạy cảm - BUG-01)**:
   - Cập nhật `backend/services/project-verification-repository.js` dòng 181-205: Đảm bảo kiểm tra schema tương thích hoặc thực thi migration bảng tiếng Việt tự động trước khi INSERT; không nuốt lỗi `catch` âm thầm.
   - *Tiêu chí nghiệm thu*: Gọi API xác minh nhạy cảm trả về bản ghi hợp lệ, không trả về null.
3. **Nhiệm vụ 1.3 (Chuẩn hóa cổng 5000 cho hệ điều hành Windows - BUG-12)**:
   - Cấu hình cổng mặc định của backend trong `backend/.env` và `backend/server.js` là `5000`.
   - Cập nhật proxy trong `frontend/vite.config.js` trỏ về `http://localhost:5000`.
   - *Tiêu chí nghiệm thu*: Chạy `npm start` trên Windows khởi động thành công không bị `EADDRINUSE`.

#### GIAI ĐOẠN 2: Khắc phục Lỗi Giao diện & Tương tác UI/UX (P1 & High)
1. **Nhiệm vụ 2.1 (Sửa lỗi nhân đôi Dropdown ngành - BUG-09)**:
   - Trong `frontend/src/components/SearchableSelect.vue`, đưa khối `v-for="opt in filteredOptions"` vào bên trong `<template v-else>`.
   - *Tiêu chí nghiệm thu*: Danh mục ngành nghề hiển thị chính xác 39 mục; tìm kiếm từ khóa `"thép"` chỉ ra 1 kết quả duy nhất.
2. **Nhiệm vụ 2.2 (Thay thế `window.alert()` bằng Toast/Inline Notification - BUG-10)**:
   - Xây dựng component Toast hoặc hiển thị inline validation text màu đỏ dưới các trường: Tên dự án, Loại hình, Công đoạn, Công suất, Địa giới.
   - Loại bỏ 5 câu lệnh `alert(...)` trong `ClassifyTab.vue`.
   - *Tiêu chí nghiệm thu*: Khi để trống form và bấm "Phân loại", giao diện báo lỗi nổi bật mà không chặn luồng trình duyệt.
3. **Nhiệm vụ 2.3 (Khắc phục tràn màn hình di động 375px - BUG-11)**:
   - Rà soát các class `.kpi-grid`, `.form-row`, `.app-shell` và bổ sung CSS responsive.
   - Thiết lập `min-width: 0` và cho phép wrap các phần tử trên màn hình nhỏ.
   - *Tiêu chí nghiệm thu*: Chạy kịch bản kiểm tra viewport 375px đạt `scrollWidth === 375px` (0px overflow).
4. **Nhiệm vụ 2.4 (Đồng bộ tên bảng trong route Crawler - BUG-02)**:
   - Trong `backend/routes/crawler.js`, đồng bộ cả SELECT và INSERT sử dụng tên bảng nhất quán.
   - *Tiêu chí nghiệm thu*: Bật/tắt crawler từ AdminTab lưu cấu hình thành công vào cơ sở dữ liệu.

#### GIAI ĐOẠN 3: Parity Engine - UI & Hoàn thiện Quy trình Nghiệp vụ (P2 & Medium)
1. **Nhiệm vụ 3.1 (Bổ sung UI cho `permitLimits` - BUG-05)**:
   - Trong `frontend/src/components/QCVNTab.vue`, bổ sung bảng hoặc modal "Cấu hình Giới hạn Giấy phép môi trường (GPMT)" cho phép người dùng tùy chọn nhập ngưỡng riêng.
   - *Tiêu chí nghiệm thu*: Kết quả đối chiếu hiển thị song song cột Quy chuẩn và cột Giấy phép GPMT.
2. **Nhiệm vụ 3.2 (Thêm Modal cấu hình thông số duyệt QCVN Crawler - BUG-04)**:
   - Trong `frontend/src/components/AdminTab.vue`, khi bấm "Phê duyệt" một QCVN candidate có `tham_so: []`, mở modal cho Admin nhập danh sách chỉ tiêu hoặc chọn nạp từ mẫu mặc định.
   - *Tiêu chí nghiệm thu*: Admin duyệt thành công QCVN mới từ crawler mà không bị lỗi 400.
3. **Nhiệm vụ 3.3 (Bảo vệ an toàn component `DashboardTab.vue` - BUG-13)**:
   - Đổi `stats.staffList.length` thành `stats.staffList?.length > 0`.
   - *Tiêu chí nghiệm thu*: Render Dashboard mượt mà ngay cả khi dữ liệu trả về rỗng.
4. **Nhiệm vụ 3.4 (Thoát an toàn cho Drawer Hồ sơ đã lưu - BUG-14)**:
   - Bổ sung phím `Esc` và text đóng dự phòng trong `SavedProjectsDrawer.vue`.

#### GIAI ĐOẠN 4: Tinh chỉnh Tối ưu hóa & Hoàn thiện Đồ án (Low)
1. **Nhiệm vụ 4.1 (Chuẩn hóa tile map - BUG-06)**:
   - Đổi URL tile map sang OpenStreetMap chính thức (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) với attribution chính xác.
2. **Nhiệm vụ 4.2 (Tối ưu hóa chunk size - BUG-07)**:
   - Cấu hình dynamic import cho `vietnam-divisions.json` hoặc nâng `build.chunkSizeWarningLimit` lên `700` trong `vite.config.js`.
3. **Nhiệm vụ 4.3 (Kiểm thử xác nhận toàn diện)**:
   - Chạy `npm test --prefix backend` bảo đảm 31/31 passed.
   - Chạy `npm run build --prefix frontend` bảo đảm build thành công 0 cảnh báo.
   - Chạy lại kịch bản kiểm tra trình duyệt Playwright xác nhận toàn bộ 19 kịch bản đều đạt.

---

## 7. PHƯƠNG PHÁP KIỂM CHỨNG ĐỘC LẬP (VERIFICATION METHOD)

Để bất kỳ kỹ sư hoặc thành viên hội đồng nào có thể kiểm chứng độc lập tính xác thực của báo cáo này:

### 1. Kiểm chứng Test Suite Backend & Build Frontend
```powershell
# Chạy từ d:\ĐATN\demo
npm test --prefix backend
npm run build --prefix frontend
```
*Kết quả kỳ vọng*: Backend test hoàn thành với 31 pass (0 fail, 0 skip); Frontend build thành công sinh asset tại `backend/public/`.

### 2. Tái hiện lỗi Nhân đôi Dropdown ngành
```powershell
node .agents/teamwork/browser_inspector/scripts/test-classify-deep.js
```
*Kết quả kỳ vọng*: Output terminal in ra `Total options in dropdown: 78` (nhân đôi so với 39 ngành gốc).

### 3. Tái hiện lỗi CDN và Tràn màn hình di động
```powershell
node .agents/teamwork/browser_inspector/scripts/test-all-tabs-deep.js
```
*Kết quả kỳ vọng*: Sinh 19 ảnh chụp màn hình trong `.agents/teamwork/browser_inspector/screenshots/`, ghi nhận 82 lỗi console (do CDN offline) và lỗi tràn màn hình di động `mobile_375 (scrollWidth=455, clientWidth=375)`.

---
*Báo cáo được lập tự động dựa trên dữ liệu kiểm chứng thực tế từ 3 subagent chuyên trách, không can thiệp mã nguồn ứng dụng, hoàn toàn sẵn sàng làm cơ sở triển khai kế hoạch khắc phục.*
