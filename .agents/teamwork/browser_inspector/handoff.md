# Báo Cáo Kiểm Tra Giao Diện Người Dùng & Tương Tác E2E (Browser UI & E2E Interaction Inspection)

**Agent Archetype**: browser_inspector  
**Ngày thực hiện**: 13/11/2026  
**Phạm vi**: Ứng dụng ETC LegalHub (`d:\ĐATN\demo`)  
**Mục tiêu**: Rà soát toàn diện giao diện, tương tác người dùng, console logs, network requests, layout responsiveness và tính toàn vẹn UI-to-API trên toàn bộ các tab chức năng mà KHÔNG can thiệp chỉnh sửa mã nguồn ứng dụng.

---

## 1. Observation (Các quan sát thực tế)

### 1.1. Hiện trạng Môi trường Dịch vụ & Cổng mạng (Network & Port Status)
- **Port 3000**: Khi chạy `node backend/server.js` hoặc thử lắng nghe cổng mặc định 3000, hệ thống phát sinh lỗi:
  ```
  Error: listen EADDRINUSE: address already in use :::3000
  errno: -4091, code: 'EADDRINUSE', syscall: 'listen', address: '::', port: 3000
  ```
  Và khi thử bind riêng `127.0.0.1:3000`:
  ```
  127.0.0.1 error: EACCES
  ```
  Chứng minh cổng 3000 nằm trong dải cổng dành riêng của hệ điều hành Windows (WinNAT/Hyper-V excluded port range). Khi chuyển sang cổng `5000` (hoặc `5020`, `5025`, `5030`), Express server khởi động thành công:
  `[INFO] ETC server đang hoạt động tại: http://localhost:5000`
- **Frontend Build**: Lệnh `npm run build --prefix frontend` thành công, biên dịch 40 modules thành tệp tĩnh trong `backend/public/`:
  - `../backend/public/index.html` (1.33 kB)
  - `../backend/public/assets/index-B1_dI9ss.css` (53.77 kB)
  - `../backend/public/assets/index-BTsFgRzp.js` (437.68 kB)
  - `../backend/public/assets/vietnam-divisions-BeaYaFZ5.js` (589.15 kB)
- **Backend Tests**: Lệnh `npm test --prefix backend` hoàn thành xuất sắc với **31/31 passed, 0 failed, 0 skipped**.

---

### 1.2. Thất bại Tải Tài nguyên CDN Ngoại tuyến (CDN & Font/Icon Failures)
Khi truy cập ứng dụng qua Chromium headless (Playwright), Console ghi nhận liên tiếp 7 lỗi mạng cố định tại mọi tab:
```
[NET FAILURE]: GET https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED

[NET FAILURE]: GET https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.31.0/dist/tabler-icons.min.css - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED

[NET FAILURE]: GET https://unpkg.com/leaflet@1.9.4/dist/leaflet.css - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED

[NET FAILURE]: GET https://unpkg.com/leaflet@1.9.4/dist/leaflet.js - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED

[NET FAILURE]: GET https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED

[NET FAILURE]: GET https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED

[NET FAILURE]: GET https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js - net::ERR_NAME_NOT_RESOLVED
[CONSOLE ERROR]: Failed to load resource: net::ERR_NAME_NOT_RESOLVED
```
- **File liên quan**: `frontend/index.html` (dòng 9-20).
- **Hệ quả trực tiếp**:
  1. `window.L` không được định nghĩa (`typeof window.L === 'undefined'`), dẫn đến Bản đồ GIS trên `MapTab` và mini-map trên `ClassifyTab` không thể khởi tạo đối tượng bản đồ (`mapInstance = null`).
  2. Toàn bộ icon hệ thống (`<i class="ti ti-*"></i>`) tại thanh điều hướng, nút bấm, bảng QCVN, thông báo cảnh báo và drawer bị khuyết biểu tượng, hiển thị ô vuông trống.
  3. Font chữ Be Vietnam Pro không nạp được, bị đẩy về font sans-serif dự phòng của hệ điều hành.

---

### 1.3. Lỗi Nhân đôi Danh mục Ngành nghề trong `SearchableSelect.vue` (UI Duplication Bug)
- **Vị trí**: `frontend/src/components/SearchableSelect.vue`, dòng 36-73:
  ```html
  <div class="options-container">
    <template v-if="groups.length">
      <template v-for="group in filteredGroups" :key="group.groupLabel">
        <div class="option-group-heading">{{ group.groupLabel }}</div>
        <div v-for="opt in group.items" :key="opt.code || opt.name" class="option-item" @click="selectOption(opt)">
          <span class="option-name">{{ opt.name }}</span>
        </div>
      </template>
    </template>
    <template v-else>
      <div v-if="filteredOptions.length === 0" class="empty-option">Không tìm thấy kết quả phù hợp</div>
    </template>
    <div v-if="groups.length && filteredGroups.length === 0" class="empty-option">Không tìm thấy kết quả phù hợp</div>
    <div v-for="opt in filteredOptions" :key="opt.code || opt.name" class="option-item" @click="selectOption(opt)">
      <div class="option-content">
        <div class="option-title-group">
          <span class="option-name">{{ opt.name }}</span>
        </div>
      </div>
    </div>
  </div>
  ```
- **Hiện tượng**:
  Khi dropdown ngành nghề được mở trên `ClassifyTab`, thuộc tính `groups` được truyền vào (`groupedIndustryOptions`). Do đoạn mã `v-for="opt in filteredOptions"` nằm **bên ngoài** `<template v-else>`, Vue thực thi render cả hai vòng lặp đồng thời.
  - Kết quả đo đạc từ Playwright: Tổng số options hiển thị trong dropdown là **78 mục** thay vì 39 ngành (chính xác gấp đôi).
  - Khi gõ tìm kiếm từ khóa `"thép"`, dropdown trả về 2 kết quả hoàn toàn giống hệt nhau:
    - Match 1: `Luyện kim, sản xuất thép, phôi thép`
    - Match 2: `Luyện kim, sản xuất thép, phôi thép`

---

### 1.4. Lỗi Khóa Tương tác do `SavedProjectsDrawer.vue` (Pointer Events Interception)
- **Vị trí**: `frontend/src/components/classify/SavedProjectsDrawer.vue`, dòng 16 & 23-25.
- **Hiện tượng**:
  Khi bấm nút "Hồ sơ đã lưu" trên `ClassifyTab`, phần tử `.drawer-overlay` được mở với `v-if="visible"`. Do icon nút đóng `<button class="drawer-close-btn"><i class="ti ti-x"></i></button>` bị mất glyph (do lỗi CDN Tabler), người dùng khó nhận biết vị trí đóng. Nếu không bấm trúng nút đóng hoặc sự kiện `@click.self` bị trượt, lớp overlay vẫn duy trì trên DOM và chặn toàn bộ sự kiện con trỏ:
  ```
  <div class="drawer-overlay"> subtree intercepts pointer events
  ```
  Làm tê liệt toàn bộ các thao tác bấm chuột khác trên trang (thanh topbar, sidebar, nút phân loại).

---

### 1.5. Lỗi Giao diện Chặn Luồng bằng `window.alert()` trong `ClassifyTab.vue`
- **Vị trí**: `frontend/src/components/ClassifyTab.vue`, dòng 1092-1102:
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
- **Hiện tượng**:
  Thay vì dùng toast thông báo hoặc inline validation dưới từng trường nhập liệu, phương thức `handleClassify` kích hoạt popup native của trình duyệt (`window.alert`). Hộp thoại này khóa đứng luồng JavaScript của trang cho đến khi bấm OK, làm gián đoạn trải nghiệm người dùng và gây lỗi treo trong các luồng kiểm thử tự động.

---

### 1.6. Thiếu Thuộc tính Định danh Ngữ nghĩa trên Dropdown Công đoạn (`processStage`)
- **Vị trí**: `frontend/src/components/ClassifyTab.vue`.
- **Hiện tượng**:
  Phần tử `<select>` chọn công đoạn sản xuất cho 6 ngành đặc thù (`thep`, `nhiet_dien`, `hoa_chat`, `giay_bot`, `det_nhuom`, `dien_tu`) được render ở dạng `<select data-v-7ba86009="">` mà không có thuộc tính `id="processStage"` hay `name="processStage"`. Điều này gây khó khăn cho việc tự động điền form, kiểm thử E2E và tính năng trợ năng (accessibility/a11y).

---

### 1.7. Lỗi Tràn Chiều Ngang trên Giao diện Di động (Horizontal Overflow on Mobile 375px)
- **Vị trí**: Toàn bộ shell ứng dụng (`.app-shell`, `.kpi-grid`, `.form-row`).
- **Số liệu đo đạc Playwright tại 3 kích thước màn hình**:
  - **Desktop (1440x900)**: `scrollWidth = 1440px`, `clientWidth = 1440px` -> **Hợp lệ (không tràn)**.
  - **Tablet (768x1024)**: `scrollWidth = 768px`, `clientWidth = 768px` -> **Hợp lệ (không tràn)**.
  - **Mobile (375x667)**: `scrollWidth = 455px`, `clientWidth = 375px` -> **Bị tràn ngang 80px (`overflow = true`)**.
- **Hiện tượng**: Trên màn hình smartphone, trang bị thanh cuộn ngang khó chịu, giao diện form và các thanh điều khiển bị cắt mép phải.

---

### 1.8. Lỗi Truy cập Thuộc tính Không An toàn trong `DashboardTab.vue` (Unsafe Property Access)
- **Vị trí**: `frontend/src/components/DashboardTab.vue`, dòng 325:
  ```html
  <div v-if="currentUser?.role === 'admin' && stats.staffList.length > 0" ...>
  ```
- **Hiện tượng**:
  Khởi tạo ban đầu của `stats` (dòng 20) không chứa thuộc tính `staffList`. Nếu API trả về chậm hoặc phản hồi không có mảng `staffList`, việc truy cập trực tiếp `.length` mà không có toán tử optional chaining (`stats.staffList?.length`) sẽ gây ngoại lệ `TypeError: Cannot read properties of undefined (reading 'length')` khiến cây thành phần Vue bị sập.

---

### 1.9. Các Lỗi Phản hồi Mạng Backend khi Cơ sở Dữ liệu Ngoại tuyến
- Khi PostgreSQL không khả dụng trên cổng 5432:
  - `GET /api/laws` -> Phản hồi `500 Internal Server Error` (sau 20s pg connect timeout).
  - `GET /api/dashboard/stats` -> Phản hồi `500 Internal Server Error`.
  - `GET /api/reminders` -> Phản hồi `500 Internal Server Error`.
  - `GET /api/projects` -> Phản hồi `500 Internal Server Error`.
  - `POST /api/auth/login` -> Phản hồi `500 Internal Server Error` (với thông báo `"Đã xảy ra lỗi trên hệ thống!"`).
  - `GET /api/qcvns` -> Phản hồi `503 Service Unavailable`.
  - `GET /api/classification/administrative-units/:code/boundary` -> Phản hồi `502 Bad Gateway` do không phân giải được tên miền ngoại tuyến `sapnhap.bando.com.vn`.
- **Hành vi Fail-Closed phía UI**:
  - Giao diện `ClassifyTab` tự động chuyển sang `ruleSource: 'FALLBACK_UNVERIFIED'` và hiển thị cảnh báo `Cần rà soát` (tuân thủ nguyên tắc AGENTS.md).
  - Giao diện `QCVNTab` hiển thị chip `FALLBACK_UNVERIFIED` và chặn cấp kết luận đạt chính thức.

---

## 2. Logic Chain (Chuỗi suy luận từ quan sát đến kết luận)

1. **Từ Quan sát 1.1**:
   - Lệnh `node backend/server.js` mặc định nghe cổng 3000. Do Windows chặn cổng 3000 (`EADDRINUSE`/`EACCES`), quá trình khởi động bị từ chối nếu không truyền tham số môi trường `PORT=5000`. Cả frontend `vite.config.js` proxy cũng đang cấu hình cứng mục tiêu tới `http://localhost:3000`. Khi phát triển trên Windows, cần hỗ trợ cấu hình cổng linh hoạt qua `.env` và proxy fallback.

2. **Từ Quan sát 1.2**:
   - `frontend/index.html` nhúng trực tiếp CDN của Leaflet, Tabler Icons và Google Fonts mà không cài đặt gói qua `package.json`. Khi môi trường kiểm thử/triển khai bị ngắt internet hoặc sandbox chặn DNS ngoại mạng, toàn bộ 7 file CDN đều trả về `ERR_NAME_NOT_RESOLVED`. Vì vậy, ứng dụng bị mất toàn bộ icon giao diện và Leaflet GIS map bị vô hiệu hóa hoàn toàn trên trình duyệt. Để ứng dụng hoạt động độc lập và ổn định (self-contained), bắt buộc phải bundle thư viện cục bộ qua npm.

3. **Từ Quan sát 1.3**:
   - Trong `SearchableSelect.vue`, khối `v-for="opt in filteredOptions"` nằm độc lập sau `<template v-else>`. Do đó khi component nhận danh sách có phân nhóm (`groups`), cả 2 vòng lặp (theo nhóm và danh sách phẳng) đều cùng xuất hiện trên DOM. Dẫn tới hiện tượng 100% các ngành nghề trong dropdown đều bị nhân đôi (39 ngành -> 78 dòng chọn).

4. **Từ Quan sát 1.4 & 1.5**:
   - Việc lạm dụng `window.alert()` chặn đứng tương tác của người dùng và các công cụ E2E test. Đồng thời, cấu trúc modal/drawer thiếu icon hiển thị nút thoát rõ ràng khi offline CDN làm người dùng bị kẹt trong màn hình mờ `.drawer-overlay`.

5. **Từ Quan sát 1.7**:
   - Tại viewport di động 375px, trang web có `scrollWidth = 455px` (lệch 80px). Kiểm tra CSS cho thấy các grid container và thẻ bảng điều khiển chưa có quy tắc `min-width: 0` và responsive wrap hợp lý, dẫn đến vỡ layout chiều ngang trên màn hình smartphone.

6. **Từ Quan sát 1.8 & 1.9**:
   - Thiếu optional chaining tại `stats.staffList.length` tạo ra rủi ro sập runtime. Khi DB offline, các route thiếu lớp xử lý lỗi nhẹ nhàng (graceful degradation) mà để timeout kéo dài 20s rồi trả mã 500, khiến trải nghiệm người dùng trên các tab Bảng điều khiển và Thư viện luật bị đơ tạm thời trước khi hiện thông báo lỗi.

---

## 3. Caveats (Các điểm giới hạn & Giả định)

1. **PostgreSQL Service**: Do môi trường thực thi là sandbox Windows không có quyền quản trị dịch vụ hệ thống (`GetServiceCommand` báo CIM access restriction), PostgreSQL service trên cổng 5432 chưa được kích hoạt trực tiếp từ terminal. Các kiểm chứng kết nối thực tế đã xác nhận hành vi phản hồi fail-closed và static fallback đúng như thiết kế của AGENTS.md.
2. **Khảo sát không can thiệp mã nguồn**: Theo đúng yêu cầu điều phối (Task 5), subagent `browser_inspector` KHÔNG sửa đổi bất kỳ tệp tin nào trong `backend/` hay `frontend/`. Toàn bộ dữ liệu kiểm tra, mã kịch bản Playwright và ảnh chụp màn hình được lưu trữ hoàn toàn bên trong thư mục quản lý `.agents/teamwork/browser_inspector/`.

---

## 4. Conclusion (Kết luận đánh giá)

Hệ thống LegalHub vận hành tốt về mặt nghiệp vụ lõi (tuân thủ chặt chẽ các bất biến pháp lý Fail-Closed và quy tắc phân loại, test suite backend đạt 31/31 passed). Tuy nhiên, trên phương diện giao diện người dùng (Browser UI/UX) và tương tác E2E, tồn tại **6 nhóm khiếm khuyết then chốt** cần được đưa vào Kế hoạch khắc phục (/plan):

1. **[P0 - Nghiêm trọng] Lệ thuộc CDN bên ngoài**: Cần chuyển Leaflet, Leaflet-MarkerCluster và Tabler Icons thành các package npm nội bộ được bundle qua Vite, bảo đảm ứng dụng hiển thị đầy đủ bản đồ và icon khi chạy offline/intranet.
2. **[P1 - Cao] Lỗi nhân đôi dropdown trong `SearchableSelect.vue`**: Cần bao bọc khối `v-for="opt in filteredOptions"` vào trong `<template v-else>` để triệt tiêu tình trạng hiển thị trùng lặp 78 options.
3. **[P1 - Cao] Thay thế `window.alert()` bằng Toast/Inline Notification**: Hiện đại hóa các thông báo lỗi kiểm tra biểu mẫu trong `ClassifyTab.vue` để không chặn luồng giao diện người dùng.
4. **[P1 - Cao] Xử lý xung đột cổng 3000 trên Windows**: Chuẩn hóa cổng mặc định của backend sang `5000` (hoặc cấu hình tự động chọn cổng rảnh) và đồng bộ proxy trong `frontend/vite.config.js`.
5. **[P2 - Trung bình] Khắc phục tràn layout di động (Mobile Overflow 375px)**: Bổ sung CSS responsive để đưa `scrollWidth` trên màn hình 375px về đúng bằng `375px` (khử 80px tràn ngang).
6. **[P2 - Trung bình] Phòng vệ an toàn trong `DashboardTab.vue`**: Thêm optional chaining `stats.staffList?.length` và cơ chế graceful fallback khi API trả dữ liệu rỗng.

---

## 5. Verification Method (Phương pháp Kiểm chứng độc lập)

Để kiểm chứng độc lập toàn bộ các kết quả trên, người kiểm tra có thể thực thi các lệnh sau từ thư mục gốc `d:\ĐATN\demo`:

1. **Chạy bộ kiểm tra Playwright tự động**:
   ```powershell
   node .agents/teamwork/browser_inspector/scripts/test-all-tabs-deep.js
   ```
   *Kết quả mong đợi*: Lệnh thực thi thành công, lưu 19 ảnh chụp màn hình tại `.agents/teamwork/browser_inspector/screenshots/` và ghi nhận 82 console errors (do CDN offline) cùng lỗi tràn màn hình di động `mobile_375 (scrollWidth=455, clientWidth=375)`.

2. **Kiểm tra trực quan lỗi nhân đôi dropdown trong `SearchableSelect.vue`**:
   ```powershell
   node .agents/teamwork/browser_inspector/scripts/test-classify-deep.js
   ```
   *Kết quả mong đợi*: Output terminal in rõ `Total options in dropdown: 78` và `Filtered options for "thép": 2 (hai dòng hoàn toàn trùng nhau)`.

3. **Kiểm tra mã nguồn lỗi template**:
   - Mở `frontend/src/components/SearchableSelect.vue` dòng 51-57: kiểm tra vị trí của `v-for="opt in filteredOptions"` nằm ngoài `<template v-else>`.
   - Mở `frontend/src/components/DashboardTab.vue` dòng 325: kiểm tra `stats.staffList.length` thiếu `?.`.
   - Mở `frontend/index.html` dòng 9-20: kiểm tra 7 liên kết CDN ngoại tuyến.
