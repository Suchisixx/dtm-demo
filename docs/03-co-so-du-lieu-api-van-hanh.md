# 3. Cơ sở dữ liệu, API và vận hành

## PostgreSQL và quy ước dữ liệu

Backend dùng thư viện `pg` với `Pool`. Tên bảng/cột vật lý viết tiếng Việt không dấu, chữ thường, `snake_case`. Mã ứng dụng hiện vẫn truy vấn qua tên SQL tương thích tiếng Anh; sau migration, các tên này là view chiếu lên bảng vật lý. Các key của JSONB và key API được giữ nguyên để tương thích.

### Các bảng vật lý hiện có

| Bảng vật lý | Mục đích |
| --- | --- |
| `nguoi_dung` | Tài khoản, vai trò và thông tin xác thực |
| `du_an` | Hồ sơ, dữ liệu biểu mẫu, kết quả phân loại và vị trí |
| `luat` | Văn bản pháp lý và nội dung điều khoản |
| `quy_tac` | Quy tắc hệ thống |
| `phien_ban_quy_tac` | Lịch sử phiên bản của quy tắc |
| `quy_chuan_qcvn` | Catalog QCVN, giới hạn, hiệu lực và xác minh |
| `mau_quan_trac_qcvn` | Mẫu đo, dữ liệu quan trắc và kết quả đánh giá |
| `nganh_nghe` | Catalog ngành, bí danh và metadata kiểm duyệt |
| `nguong_phan_loai` | Ngưỡng theo ngành, công đoạn, thời gian và thẩm quyền |
| `phu_luc_phap_ly` | Phụ lục, số mục và tóm tắt nội dung văn bản |
| `nhat_ky_kiem_toan` | Nhật ký thao tác kiểm toán |
| `nhat_ky_truy_van` | Tham số và kết quả truy vấn được ghi nhận |
| `lop_ban_do` | Lớp GIS, hình học, nguồn và trạng thái xác minh |
| `anh_huong_quy_tac_van_ban` | Tác động thay đổi văn bản lên quy tắc |
| `lich_su_cap_nhat_van_ban` | Lịch sử cập nhật văn bản pháp lý |
| `xac_minh_yeu_to_nhay_cam_du_an` | Khai báo, chứng cứ và quyết định xác minh yếu tố nhạy cảm |
| `de_xuat_quy_tac` | Đề xuất crawler chờ quản trị viên xem xét |
| `cai_dat_he_thong` | Cấu hình hệ thống theo khóa/giá trị |
| `nghia_vu_tuan_thu` | Nghĩa vụ theo dự án, chu kỳ, hạn nộp và trạng thái nhắc hạn |

`backend/services/vietnamese-schema.js` là danh mục ánh xạ giữa tên SQL tương thích và bảng/cột vật lý. Khóa chính thường dùng `ma`; khóa ngoại dùng tên thực thể như `du_an_ma`, `nguoi_dung_ma`. Cột JSONB có cấu trúc độc lập với tên vật lý, không tự đổi key bên trong JSON.

## Nguồn dữ liệu và bootstrap

- `backend/init-db.js` khởi tạo database/schema và seed ban đầu. Với schema legacy, script yêu cầu migration rõ ràng khi đã tồn tại bảng cũ.
- `backend/services/db-bootstrap.js` chạy khi máy chủ khởi động: phát hiện schema, bổ sung bảng runtime cần thiết, tạo ánh xạ tương thích và nạp catalog nền an toàn.
- `backend/services/rule-repository.js` quản lý catalog ngành, ngưỡng, QCVN, seed và truy vấn dữ liệu hợp lệ.
- `backend/services/project-verification-repository.js` quản lý dữ liệu xác minh nhạy cảm của dự án và các thao tác kho GIS tương ứng.
- `backend/services/repository-shared.js` chia sẻ kết nối, đọc JSON, quy tắc trạng thái công bố và kiểm tra schema.
- `backend/services/vietnamese-schema.js` đổi tên vật lý trong transaction và tạo các view SQL legacy.

Seed chỉ bổ sung hoặc làm giàu dữ liệu phù hợp; không `TRUNCATE` và không ghi đè bản ghi đã `VERIFIED`/`PUBLISHED`. Runtime loại bản ghi chưa công bố/không hợp lệ khỏi catalog kết luận.

## Sao lưu, migration và xác minh schema

Các thao tác schema cần trỏ đúng `.env`, có bản sao lưu có thể phục hồi và kiểm tra dữ liệu sau migration. Không chạy lệnh migration trên DB thật chỉ để thử.

```powershell
# Tạo snapshot JSON rồi đổi tên bảng/cột và tạo view tương thích
node backend/scripts/migrate-vietnamese-schema.js

# Kiểm tra snapshot đã tạo, số bản ghi, view và catalog runtime
node backend/scripts/verify-vietnamese-schema.js "duong-dan-file-snapshot.json"
```

`migrate-vietnamese-schema.js` tạo snapshot lặp đọc trong transaction trước khi đổi tên. Snapshot chứa dữ liệu hệ thống, cần bảo vệ như bản sao lưu nhạy cảm. `verify-vietnamese-schema.js` so sánh số bản ghi với snapshot, kiểm tra cột, khóa ngoại, view tương thích và khả năng nạp catalog. Cần giữ kỳ vọng số bảng đồng bộ với `TABLES` trong `vietnamese-schema.js` khi thêm bảng.

Các script hỗ trợ khác:

- `backend/scripts/backfill-legacy-evaluations.js`: bổ sung metadata đánh giá cho dữ liệu cũ; xem nội dung và snapshot trước khi chạy.
- `backend/scripts/seed-demo-projects.js`: tạo bộ hồ sơ/mẫu quan trắc demo; chỉ chạy trên môi trường dữ liệu thử nghiệm.
- `backend/scripts/generate-drawio-diagrams.js`: sinh sơ đồ kiến trúc/dữ liệu phục vụ tài liệu.

## API theo nhóm chức năng

Tất cả API có tiền tố `/api`, trao đổi JSON; một số API yêu cầu cookie đăng nhập hoặc quyền quản trị.

| Prefix | Ví dụ endpoint | Trách nhiệm |
| --- | --- | --- |
| `/api/auth` | `POST /login`, `POST /logout`, `GET /me` | Phiên đăng nhập và thông tin người dùng |
| `/api/projects` | `GET/POST /`, `GET /:id`, `GET /geo`, `PATCH /:id/location` | Tạo, lưu, tìm, xem và quản lý vị trí dự án |
| `/api/projects` | `GET /:id/qcvn-samples`, `PUT /:id/sensitive-verification` | Mẫu QCVN liên kết và xác minh yếu tố nhạy cảm |
| `/api/classification` | `POST /evaluate`, `POST /spatial-check`, `GET /metadata` | Phân loại, phân tích không gian và catalog ngành |
| `/api/classification` | `GET /gis-layers`, `GET /administrative-units/:code/boundary`, `GET /administrative-units/locate` | Lớp GIS và tra cứu ranh giới/đơn vị hành chính |
| `/api/industries` | `GET /industries` | Danh mục ngành nghề dùng cho giao diện |
| `/api/qcvns` | `GET /`, `POST /select`, `POST /evaluate` | Catalog, lựa chọn và đánh giá QCVN phía server |
| `/api/qcvns` | `GET/POST /samples`, `GET /samples/:id`, `DELETE /samples/:id` | Quản lý mẫu quan trắc; thao tác mẫu yêu cầu đăng nhập |
| `/api/laws` | `GET /`, `POST /`, `PUT /:id`, `DELETE /:id` | Tra cứu văn bản; thay đổi do admin thực hiện |
| `/api/dashboard` | `GET /stats` | Số liệu dashboard theo quyền |
| `/api/admin` | `/users`, `/projects` | Quản lý người dùng và dự án |
| `/api/admin/rules` | `/impacts`, `/candidates`, `/catalog`, `/thresholds` | Kiểm duyệt dữ liệu quy tắc và căn cứ |
| `/api/admin/rules` | `/qcvns/:id/verify`, `/industries/:code/verify` | Xác minh QCVN và ngành nghề |
| `/api/crawler` | `/settings`, `/run`, `/history` | Cấu hình, chạy và theo dõi crawler; admin |
| `/api/reminders` | `GET/POST /`, `POST /projects/:projectId/sync` | Danh sách và đồng bộ nghĩa vụ; yêu cầu đăng nhập |
| `/api/reminders` | `PATCH /:id/complete`, `DELETE /:id`, `POST /scan` | Hoàn tất, xóa và quét nhắc hạn |

Không đổi shape request/response khi chỉnh tên vật lý database. Lưu dự án và mẫu QCVN luôn phải đánh giá lại trên máy chủ tại thời điểm lưu.

## Cấu hình môi trường

Tạo `backend/.env` cục bộ; không commit thông tin bí mật:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=mat-khau-cua-ban
DB_NAME=etc_legalhub
JWT_SECRET=chuoi-bi-mat-rieng
PORT=5000
NODE_ENV=development
ALLOW_STATIC_FALLBACK=false
```

Backend mặc định dùng cổng `5000`. Trong `production`, static fallback luôn bị tắt. Đặt `ALLOW_STATIC_FALLBACK=false` cũng tắt fallback ở môi trường khác; nếu fallback được phép trong dev/test thì kết quả phải gắn `FALLBACK_UNVERIFIED` và `NEEDS_REVIEW`.

## Cài đặt và chạy

Yêu cầu Node.js tương thích phiên bản Vite, PostgreSQL và các gói npm của từng workspace.

```powershell
# Cài gói tại thư mục gốc, backend và frontend
npm run install:all

# Khởi tạo/cập nhật database theo môi trường đã cấu hình
npm run init-db --prefix backend

# Chạy cả backend và Vite
npm run dev
```

Backend mặc định: `http://localhost:5000`. Vite thường dùng `http://localhost:5173` và proxy `/api` về backend. Để đóng gói frontend và phục vụ qua Express:

```powershell
npm run build --prefix frontend
npm run dev:backend
```

## Kiểm thử

```powershell
# Bộ test nghiệp vụ/API, địa giới và nhắc hạn
npm test --prefix backend

# Test tích hợp cần PostgreSQL được cấu hình
npm run test:pg --prefix backend

# Build giao diện
npm run build --prefix frontend
```

Các bất biến nghiệp vụ, test bắt buộc và trạng thái pháp lý được ghi trong `AGENTS.md`. Khi chạm phân loại, QCVN, route, database, crawler hoặc GIS cần bổ sung test backend; khi sửa frontend cần build frontend. Không xem test bị bỏ qua là đạt.

## Vận hành định kỳ

- `backend/utils/scheduler.js` chạy crawler theo lịch cấu hình, chỉ khi admin bật tự động trong cài đặt; crawler vẫn có thể được khởi chạy thủ công.
- Scheduler quét nghĩa vụ tuân thủ hằng ngày lúc 07:00.
- Theo dõi log khi bootstrap DB và khi gọi dịch vụ bản đồ ngoài. API ranh giới phụ thuộc kết nối outbound từ backend tới `sapnhap.bando.com.vn`; khi dịch vụ không sẵn sàng, giao diện giữ nguyên tọa độ ghim và không tự gán phường/xã.
- Dữ liệu danh mục địa giới trong frontend dùng để chọn đơn vị; hình học ranh giới và nhận diện tọa độ được tra cứu theo mã qua backend.
- Chỉ kết luận đủ metadata xác minh mới được xuất như kết luận chính thức.

## Danh mục tệp và trách nhiệm

### Điểm vào và cấu hình

| Tệp | Mục tiêu |
| --- | --- |
| `package.json` | Điều phối cài đặt, chạy backend/frontend và build |
| `backend/package.json` | Lệnh khởi động, migration và test backend |
| `frontend/package.json` | Lệnh phát triển và build giao diện |
| `frontend/vite.config.js` | Proxy API phát triển và thư mục đầu ra build |
| `backend/server.js` | Ghép middleware, API, bootstrap DB, scheduler và file frontend |
| `backend/config/db.js` | Khởi tạo nhóm kết nối PostgreSQL |
| `backend/init-db.js` | Tạo database/schema và nạp dữ liệu ban đầu |
| `backend/middleware/auth.js` | Xác thực JWT và quyền người dùng/admin |
| `AGENTS.md` | Các bất biến kỹ thuật và nghiệp vụ phải tuân thủ |

### Backend: API và nghiệp vụ

| Tệp | Mục tiêu |
| --- | --- |
| `backend/routes/auth.js` | Đăng nhập, đăng xuất và kiểm tra phiên |
| `backend/routes/projects.js` | API hồ sơ, tìm kiếm, vị trí, xác minh và đồng bộ nghĩa vụ |
| `backend/routes/classification.js` | API phân loại, metadata, GIS và địa giới hành chính |
| `backend/routes/qcvns.js` | API catalog, chọn, đánh giá và lưu mẫu QCVN |
| `backend/routes/laws.js` | API tra cứu và cập nhật văn bản pháp lý |
| `backend/routes/dashboard.js` | API thống kê dashboard |
| `backend/routes/admin.js` | API quản trị người dùng và dự án |
| `backend/routes/admin-rules.js` | API kiểm duyệt quy tắc, ngành, ngưỡng và QCVN |
| `backend/routes/crawler.js` | API cấu hình, chạy và xem lịch sử crawler |
| `backend/routes/reminders.js` | API nghĩa vụ và nhắc hạn tuân thủ |
| `backend/services/classification-service.js` | Điều phối phân loại, thẩm quyền, căn cứ và metadata kết luận |
| `backend/services/classification-rule-helpers.js` | Hàm hỗ trợ tra ngưỡng và xử lý quy tắc phân loại |
| `backend/services/qcvn-service.js` | Chọn QCVN và đánh giá mẫu phía server |
| `backend/services/rule-repository.js` | Schema catalog, seed an toàn và truy vấn dữ liệu runtime |
| `backend/services/project-verification-repository.js` | Xác minh nhạy cảm dự án và truy cập các lớp GIS |
| `backend/services/repository-shared.js` | Kết nối, trạng thái công bố và hàm dùng chung cho repository |
| `backend/services/runtime-policy.js` | Chính sách fallback và fail-closed khi DB lỗi |
| `backend/services/spatial-gis-service.js` | Lớp GIS DB, khoảng cách và phân tích không gian |
| `backend/services/administrative-boundary-service.js` | Tải/cache hình học và tìm đơn vị hành chính theo tọa độ |
| `backend/services/dashboard-service.js` | Tổng hợp KPI dự án và mẫu quan trắc |
| `backend/services/compliance-reminder-service.js` | Tính hạn, chu kỳ, trạng thái và đồng bộ nghĩa vụ |
| `backend/services/crawler-sync-service.js` | Ghi lịch sử, tác động và đề xuất từ dữ liệu crawler |
| `backend/services/db-bootstrap.js` | Chuẩn bị schema/catalog runtime khi máy chủ chạy |
| `backend/services/vietnamese-schema.js` | Ánh xạ tên SQL và migration schema vật lý tiếng Việt |
| `backend/utils/crawler.js` | Tải và chuẩn hóa văn bản pháp luật từ nguồn cấu hình |
| `backend/utils/scheduler.js` | Lập lịch crawler và quét nhắc hạn |
| `backend/utils/audit.js` | Ghi nhật ký kiểm toán |
| `backend/utils/helpers.js` | Phân trang và tiện ích log truy vấn |
| `backend/utils/logger.js` | Ghi log thống nhất |
| `backend/utils/constants.js` | Vai trò, cookie, trạng thái và hằng số backend |

### Frontend: giao diện và dữ liệu

| Tệp | Mục tiêu |
| --- | --- |
| `frontend/src/main.js` | Nạp CSS và khởi chạy ứng dụng Vue |
| `frontend/src/App.vue` | Điều hướng, trang, phiên đăng nhập và liên kết sự kiện |
| `frontend/src/components/ClassifyTab.vue` | Biểu mẫu phân loại, GIS, vị trí và điều phối hồ sơ đã lưu |
| `frontend/src/components/classify/SavedProjectsDrawer.vue` | Giao diện danh sách dự án lưu, chọn, xóa và phân trang |
| `frontend/src/components/QCVNTab.vue` | Nhập mẫu, chọn QCVN và trình bày trạng thái đánh giá |
| `frontend/src/components/LawsTab.vue` | Tra cứu và đọc văn bản pháp lý |
| `frontend/src/components/DashboardTab.vue` | KPI, danh sách và biểu đồ tổng quan |
| `frontend/src/components/MapTab.vue` | Bản đồ dự án, lớp GIS và bộ lọc |
| `frontend/src/components/AdminTab.vue` | Người dùng, catalog, kiểm duyệt và crawler |
| `frontend/src/components/AuthModal.vue` | Biểu mẫu đăng nhập |
| `frontend/src/components/SearchableSelect.vue` | Bộ chọn có tìm kiếm và nhóm tiêu đề |
| `frontend/src/composables/useClassificationCatalog.js` | Tải metadata ngành và tạo các nhóm lựa chọn |
| `frontend/src/composables/useAdministrativeDivisions.js` | Nạp danh mục tỉnh/xã/phường/đặc khu |
| `frontend/src/composables/useAdminPagination.js` | Phân trang dùng lại trong màn quản trị |
| `frontend/src/data/vietnam-divisions.json` | Danh mục mã/tên/bí danh 34 tỉnh và 3.321 đơn vị cấp xã |
| `frontend/src/data/qcvn-db.js` | Hằng số loại mẫu/fixture và tiện ích hỗ trợ giao diện; không là nguồn kết luận runtime |
| `frontend/src/data/classification-db.js` | Dữ liệu nền/fixture phân loại, không thay catalog DB runtime |
| `frontend/src/utils/constants.js` | URL API và cấu hình dùng chung frontend |
| `frontend/src/utils/legalLabels.js` | Nhãn trạng thái, nguồn và lý do pháp lý cho giao diện |
| `frontend/src/utils/qcvn-keywords.js` | Từ khóa hỗ trợ nhận diện nội dung nhập/dán QCVN |
| `frontend/src/services/classification-rules.js` | Hỗ trợ nhãn công suất từ catalog runtime |
| `frontend/src/utils/qcvn-evaluator.js` | Tiện ích hiển thị/nháp phía giao diện; kết luận chính thức do server trả |
| `frontend/src/assets/css/styles.css` | Kiểu nền, bố cục và thành phần giao diện |
| `backend/public/` | Tài nguyên frontend được tạo bởi lệnh build |

### Tài liệu, dữ liệu nền và kiểm thử

| Tệp/thư mục | Mục tiêu |
| --- | --- |
| `backend/fixtures/classification-catalog.js` | Catalog seed/fixture phía backend |
| `backend/scripts/migrate-vietnamese-schema.js` | Snapshot dữ liệu và chạy migration có chủ đích |
| `backend/scripts/verify-vietnamese-schema.js` | Đối chiếu schema sau migration với snapshot |
| `backend/scripts/backfill-legacy-evaluations.js` | Backfill có kiểm soát cho kết quả cũ |
| `backend/scripts/seed-demo-projects.js` | Nạp hồ sơ/mẫu quan trắc dùng cho demo |
| `backend/scripts/generate-drawio-diagrams.js` | Tạo sơ đồ kỹ thuật |
| `backend/tests/classification-p0.test.js` | Quy tắc phân loại và chặn kết luận thiếu căn cứ |
| `backend/tests/qcvn-p0.test.js` | Chọn QCVN, giới hạn và tính đầy đủ mẫu |
| `backend/tests/routes-and-parity.test.js` | Hợp đồng route và parity giao diện–engine–DB |
| `backend/tests/administrative-boundaries.test.js` | Danh mục địa giới, API ranh giới và nhận diện tọa độ |
| `backend/tests/compliance-reminder.test.js` | Hạn, chu kỳ, quyền và trạng thái nghĩa vụ |
| `backend/tests/postgres-integration.test.js` | Tích hợp thật với PostgreSQL theo cấu hình kiểm thử |
| `docs/01-tong-quan-nghiep-vu.md` | Mục tiêu và quy trình nghiệp vụ |
| `docs/02-kien-truc-va-luong-du-lieu.md` | Kiến trúc và luồng giữa giao diện, API, service, DB |
| `docs/03-co-so-du-lieu-api-van-hanh.md` | Schema, endpoint, cài đặt, vận hành và vai trò tệp |
| `README.md` | Giới thiệu và điểm bắt đầu nhanh |
| `ReDesign.md` | Quy chuẩn thiết kế giao diện |
