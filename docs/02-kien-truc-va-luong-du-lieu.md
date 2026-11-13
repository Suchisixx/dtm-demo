# 2. Kiến trúc và luồng dữ liệu

## Sơ đồ tổng thể

```text
Trình duyệt
  └─ Vue 3 SPA / Leaflet
       ├─ REST/JSON qua /api
       ├─ danh mục địa giới đóng gói cùng frontend
       └─ tile bản đồ, tìm địa điểm và dữ liệu ranh giới qua dịch vụ ngoài
                         ↓
Node.js + Express (backend)
  ├─ routes: HTTP, xác thực, phân quyền, kiểm tra dữ liệu đầu vào
  ├─ services: nghiệp vụ, chính sách runtime và điều phối kho dữ liệu
  ├─ repositories: PostgreSQL, catalog, GIS và xác minh dự án
  └─ middleware/utils: phiên, nhật ký, crawler, scheduler
                         ↓
PostgreSQL
  └─ dữ liệu hồ sơ, văn bản, quy tắc, QCVN, GIS, nhắc hạn và kiểm toán
```

PostgreSQL là nguồn dữ liệu runtime duy nhất cho quy tắc phân loại và QCVN đã được xác minh/công bố. Dữ liệu JS tĩnh được dùng làm dữ liệu seed nền hoặc fixture; nếu bật fallback trong môi trường phù hợp, kết quả phải được đánh dấu chưa xác minh.

## Chạy ứng dụng

- Thư mục gốc quản lý các lệnh chạy toàn bộ dự án trong `package.json`.
- `npm run dev` khởi chạy backend và frontend phát triển đồng thời.
- Vite thường phục vụ giao diện tại cổng `5173`; `frontend/vite.config.js` chuyển `/api` tới `http://localhost:5000`.
- Backend mặc định lắng nghe cổng `5000` (`PORT` có thể ghi đè).
- `npm run build --prefix frontend` biên dịch SPA vào `backend/public`; Express phục vụ thư mục này cùng API.

## Tầng giao diện

- `frontend/src/main.js`: nạp kiểu giao diện và mount Vue.
- `frontend/src/App.vue`: khung trang, menu, phiên đăng nhập, phân quyền hiển thị và điều hướng giữa các phân hệ.
- `frontend/src/components/`: màn hình nghiệp vụ chính gồm `LawsTab.vue`, `ClassifyTab.vue`, `QCVNTab.vue`, `DashboardTab.vue`, `MapTab.vue`, `AdminTab.vue` và `AuthModal.vue`.
- `frontend/src/components/classify/SavedProjectsDrawer.vue`: danh sách dự án đã lưu, phân trang, chọn, xóa và tạo hồ sơ mới.
- `frontend/src/components/SearchableSelect.vue`: danh sách chọn có tìm kiếm; hỗ trợ nhóm ngành với tiêu đề riêng.
- `frontend/src/composables/useClassificationCatalog.js`: tải catalog ngành và tạo nhóm lựa chọn từ metadata API.
- `frontend/src/composables/useAdministrativeDivisions.js`: nạp danh mục địa giới.
- `frontend/src/composables/useAdminPagination.js`: trạng thái phân trang dùng chung trong quản trị.
- `frontend/src/services/classification-rules.js`: tiện ích giao diện cho nhãn quy mô; không phải bộ máy kết luận pháp lý.
- `frontend/src/utils/constants.js`: URL API, cấu hình bản đồ, danh mục và nhãn dùng chung.
- `frontend/src/utils/legalLabels.js`: nhãn trạng thái, nguồn quy tắc và thông điệp nghiệp vụ.
- `frontend/src/utils/qcvn-keywords.js`: từ khóa hỗ trợ nhận diện dữ liệu QCVN nhập/dán.
- `frontend/src/data/`: dữ liệu seed/fixture và danh mục hành chính; không thay thế catalog runtime đã xác minh trong PostgreSQL.
- `frontend/src/assets/css/styles.css`: biến màu, bố cục và kiểu dùng chung.

## Tầng máy chủ

- `backend/server.js`: cấu hình Express, cookie, JSON, file tĩnh, đăng ký route, bootstrap database, scheduler và cổng phục vụ.
- `backend/routes/`: điểm vào HTTP theo nhóm nghiệp vụ; xác thực vai trò, kiểm tra request và gọi service.
- `backend/services/`: xử lý nghiệp vụ, chính sách nguồn dữ liệu và kho dữ liệu.
- `backend/config/db.js`: `pg.Pool` kết nối PostgreSQL.
- `backend/middleware/auth.js`: đọc JWT cookie, xác thực người dùng và quyền admin.
- `backend/utils/`: logger, crawler, lịch chạy, phân trang và nhật ký truy vấn/kiểm toán.
- `backend/fixtures/`: dữ liệu phục vụ seed hoặc kiểm thử.
- `backend/scripts/`: migration, xác minh schema, seed demo và backfill có chủ đích.
- `backend/tests/`: kiểm thử nghiệp vụ, API, địa giới và PostgreSQL integration.

## Luồng phân loại dự án

```text
ClassifyTab.vue
  ├─ GET /api/classification/metadata → catalog ngành từ PostgreSQL
  ├─ POST /api/classification/evaluate → classification-service
  └─ POST /api/projects → máy chủ đánh giá lại rồi lưu
         classification-service
           ├─ runtime-policy / classification-rule-helpers
           ├─ rule-repository → catalog, ngưỡng, phụ lục pháp lý trong PostgreSQL
           └─ project-verification-repository → bằng chứng nhạy cảm phía máy chủ
```

`classification-service.js` điều phối đánh giá; `classification-rule-helpers.js` giữ các hàm xử lý phụ trợ; `runtime-policy.js` quyết định trạng thái hợp lệ/fallback; `rule-repository.js` truy xuất catalog đã công bố. `project-verification-repository.js` lưu và đọc hồ sơ xác minh dự án, cùng các thao tác GIS được ủy quyền. Kết quả lưu có metadata phiên bản, nguồn và tình trạng xác minh.

## Luồng QCVN

```text
QCVNTab.vue
  ├─ GET /api/qcvns → catalog runtime từ DB
  ├─ POST /api/qcvns/select → gợi ý quy chuẩn phù hợp
  ├─ POST /api/qcvns/evaluate → đánh giá thử ở máy chủ
  └─ POST /api/qcvns/samples → máy chủ đánh giá lại và lưu mẫu
        qcvn-service → rule-repository → PostgreSQL
```

`frontend/src/data/qcvn-db.js` còn cung cấp các loại mẫu và tiện ích giao diện; catalog dùng cho kết luận runtime được nạp qua API. Nếu API không sẵn sàng và fallback được cho phép, giao diện phải hiện nguồn fallback và kết quả không được coi là chính thức.

## Luồng GIS và địa giới

- `MapTab.vue` lấy dự án có tọa độ từ `GET /api/projects/geo` và lớp không gian qua API GIS.
- `spatial-gis-service.js` đọc lớp GIS đã xác minh trong DB và phân tích khoảng cách/ngữ cảnh.
- `ClassifyTab.vue` dùng `vietnam-divisions.json` để chọn tỉnh và 3.321 xã/phường/đặc khu.
- `GET /api/classification/administrative-units/:code/boundary` tải GeoJSON theo mã địa giới qua `administrative-boundary-service.js`; backend chuẩn hóa tọa độ và cache theo mã.
- `GET /api/classification/administrative-units/locate?lat=...&lng=...` truy vấn dịch vụ bản đồ chính thức để tìm đơn vị chứa tọa độ.
- Mã request phía giao diện bỏ qua phản hồi cũ khi người dùng đổi tỉnh/phường liên tiếp. Chọn đơn vị chỉ tô ranh giới/điều hướng bản đồ, không tự đặt ghim. Nếu tra cứu lỗi, tọa độ không bị thay bằng vị trí suy đoán.
- Nominatim phục vụ gợi ý địa điểm hoặc mô tả đường phố; tên gần đúng của dịch vụ này không được dùng làm căn cứ xác định phường/xã.

## Luồng QCVN, dashboard và bản đồ trong lưu trữ

`POST /api/qcvns/samples` đánh giá lại mẫu trên máy chủ; trạng thái `INCOMPLETE`, `NEEDS_REVIEW` và `PERIOD_MISMATCH` không được cộng thành đạt. `dashboard-service.js` tính KPI từ dữ liệu dự án và mẫu, còn `DashboardTab.vue`/`MapTab.vue` trình bày kết quả theo phạm vi quyền.

## Luồng nhắc hạn

```text
ClassifyTab.vue / DashboardTab.vue
  └─ /api/reminders → reminders route → compliance-reminder-service
                                      ├─ PostgreSQL: nghia_vu_tuan_thu
                                      └─ scheduler: quét hằng ngày 07:00
```

Khi tạo/lưu dự án, `projects` route có thể đồng bộ nghĩa vụ mặc định. API nhắc hạn yêu cầu đăng nhập và kiểm tra quyền sở hữu dự án; quản trị viên có thể xem phạm vi toàn hệ thống. Hoàn tất nghĩa vụ có thể tạo kỳ tiếp theo theo chu kỳ.

## Luồng văn bản và crawler

1. Quản trị viên cấu hình crawler và bật/tắt chạy tự động trong hệ thống.
2. `backend/utils/crawler.js` lấy và chuẩn hóa dữ liệu từ nguồn cấu hình.
3. `crawler-sync-service.js` ghi lịch sử thay đổi, tác động văn bản và đề xuất cần kiểm duyệt.
4. Quản trị viên duyệt đề xuất trong `AdminTab.vue`; chỉ dữ liệu được xác minh/công bố mới đi vào tập quy tắc runtime.

`backend/utils/scheduler.js` kiểm tra cấu hình crawler theo lịch; crawler tự động chỉ chạy khi được bật. Cùng scheduler này, tác vụ nhắc hạn chạy mỗi ngày lúc 07:00.

## Đăng nhập và bảo vệ API

`AuthModal.vue` gọi `/api/auth/login`. Backend xác minh mật khẩu đã băm, tạo JWT và đặt cookie `HttpOnly`; `/api/auth/me` trả thông tin phiên, `/api/auth/logout` hủy phiên. Route dùng `requireAuth` hoặc `requireAdmin` tùy nghiệp vụ. Một số route công khai có chủ đích; trạng thái ẩn trang trên frontend không thay thế phân quyền server.

## Tương thích schema và API

PostgreSQL lưu bảng/cột vật lý tiếng Việt không dấu, `snake_case`. `vietnamese-schema.js` ánh xạ tên SQL tương thích mà các route/repository cũ vẫn dùng sang tên vật lý và tạo view tương thích. API giữ nguyên các key JSON hiện hành; tên cột DB không làm thay đổi hợp đồng request/response hoặc key bên trong JSONB.
