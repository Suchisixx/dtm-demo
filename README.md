# ETC LegalHub - Nền tảng Pháp lý, Phân loại Hồ sơ Môi trường & Bản đồ số GIS

ETC LegalHub là giải pháp web chuyên sâu (Full-stack Monorepo) phục vụ công tác tư vấn môi trường (VILAS 495), thẩm định thủ tục hành chính môi trường theo Luật Bảo vệ Môi trường 2020 và Nghị định 08/2022/NĐ-CP (sửa đổi, bổ sung bởi Nghị định 05/2025/NĐ-CP & VBHN 49/VBHN-BNNMT). 

Hệ thống tích hợp 6 phân hệ nghiệp vụ: **Phân loại hồ sơ môi trường & Xác định thẩm quyền**, **Đối chiếu quy chuẩn kỹ thuật (QCVN 2025/2026)**, **Bản đồ không gian số & Phân tích vùng nhạy cảm GIS**, **Bảng điều khiển điều hành & Thống kê**, **Thư viện văn bản pháp luật** và **Trung tâm Quản trị & Kiểm duyệt pháp lý**.

---

## 🚀 Các Phân hệ Nghiệp vụ Chính

### 1. Phân loại Hồ sơ & Xác định Thẩm quyền (Rule Engine 3 bước)
*   **Single Database Source of Truth:** Thuật toán phân loại nạp trực tiếp danh mục ngành nghề, ngưỡng công suất và phụ lục thẩm định từ PostgreSQL (`industries`, `classification_thresholds`, `legal_appendices`), không suy đoán hay phụ thuộc vào dữ liệu tĩnh.
*   **Xử lý công đoạn sản xuất chuyên sâu (`processStage`):** Hỗ trợ phân nhánh chính xác cho các ngành phức tạp (Thép: luyện kim vs cán kéo; Dệt may: nhuộm giặt vs chỉ dệt may; Nhiệt điện: than vs khí; Giấy: bột giấy vs chỉ xeo giấy; Hóa chất; Điện tử).
*   **Xác định thẩm quyền theo mốc thời gian (`evaluationDate`):** Tự động đối chiếu thẩm quyền giải quyết hồ sơ theo ngày áp dụng:
    *   *Trước ngày 01/07/2025:* Thẩm quyền lịch sử gồm 3 cấp (Bộ NN&MT, UBND cấp Tỉnh/Sở NN&MT, UBND cấp Huyện).
    *   *Từ ngày 01/07/2025 (Chính quyền 2 cấp):* UBND cấp Xã tiếp nhận Đăng ký môi trường theo Nghị định 05/2025/NĐ-CP và phân cấp địa phương.
*   **Nguyên tắc Khóa an toàn pháp lý (Fail-Closed):** Mọi trường hợp thiếu dữ liệu đầu vào (công suất, công đoạn, ngành nghề chưa xác minh) hoặc ngưỡng gắn cờ cần rà soát đều bị hạ trạng thái xuống `Cần rà soát` (`NEEDS_REVIEW`) và khóa tính năng xuất báo cáo chính thức.
*   **Kiểm duyệt vùng nhạy cảm phía Server:** Chống giả mạo dữ liệu từ trình duyệt (client spoofing); chỉ khi Quản trị viên nhập số văn bản chứng cứ và bấm xác nhận hợp lệ thì hệ thống mới nâng bậc hồ sơ chính thức.

### 2. Bản đồ Không gian & Phân vùng đất GIS (GIS Workspace)
*   **Tích hợp Leaflet & Lớp nền đa nguồn:** Bản đồ vệ tinh ESRI Imagery, bản đồ số Carto Voyager và OpenStreetMap Landuse.
*   **Phân tích vùng đệm & yếu tố nhạy cảm:** Tự động tính toán bán kính tác động môi trường (0.8 km – 5.0 km) từ quy mô dự án và đối soát tọa độ:
    *   Phát hiện nằm trong hoặc liền kề Khu công nghiệp / Khu chế xuất.
    *   Cảnh báo khoảng cách tới đường biên giới đất liền (≤ 50 km) và vùng ven biển (≤ 5 km).
    *   Đối soát với các vùng nhạy cảm bảo vệ nghiêm ngặt (Vườn quốc gia, Khu bảo tồn thiên nhiên, Di sản thiên nhiên, Đất ngập nước, Nguồn nước sinh hoạt).
*   **Tích hợp Địa giới hành chính sau sáp nhập 2025:** Hỗ trợ đầy đủ 63 Tỉnh/Thành phố và hệ thống Phường/Xã mới nhất. Dữ liệu địa giới được nạp động (Dynamic Async Chunk), tối ưu hóa tốc độ tải trang.

### 3. Đối chiếu Kết quả Quan trắc với QCVN Mới (QCVN Engine)
*   **35 Bảng Quy chuẩn Số hóa:** Tích hợp đầy đủ QCVN 40:2025/BTNMT (Nước thải công nghiệp), QCVN 14:2025/BTNMT (Nước thải sinh hoạt), QCVN 05:2023/BTNMT (Không khí xung quanh), QCVN 08:2023/BTNMT (Nước mặt), QCVN 03:2023/BTNMT (Đất), QCVN 09:2023/BTNMT (Nước dưới đất).
*   **Tự động map QCVN theo Ngành:** API máy chủ tự động gợi ý quy chuẩn áp dụng tương ứng với ngành nghề và quy mô dự án liên kết.
*   **Chốt an toàn lưu lượng & nguồn tiếp nhận:** Bắt buộc nhập lưu lượng xả thải ($F$) và chọn cột nguồn tiếp nhận (Cột A/B/C/D); nếu thiếu sẽ fail-closed ở trạng thái `Cần rà soát`, không gán giả định.
*   **Bảo vệ lộ trình chuyển tiếp cơ sở hiện hữu:** Ngăn chặn việc áp sai bảng 2025 cho cơ sở cũ đang trong thời gian chuyển tiếp khi chưa có bảng QCVN 40:2011 hoặc QCVN 14:2008 tương ứng.
*   **Kiểm soát chu kỳ lấy mẫu & khoảng giới hạn:** Nhận diện lệch chu kỳ đo (ví dụ: CO đo 8 giờ so với quy chuẩn 24 giờ) hoặc giới hạn khoảng pH trong Giấy phép môi trường.
*   **Dán nhanh thông số (Smart Paste):** Tự động nhận diện từ khóa và bóc tách bảng kết quả quan trắc từ Excel, Word hoặc PDF phòng thí nghiệm.

### 4. Bảng điều khiển Điều hành & Thống kê (Executive Dashboard)
*   **Chỉ số KPI tổng thể:** Tổng số hồ sơ dự án, tỷ lệ hồ sơ đủ điều kiện chính thức vs cần rà soát, tỷ lệ mẫu đạt quy chuẩn, số lượng văn bản pháp lý đang hiệu lực.
*   **Phân tích cơ cấu:** Biểu đồ phân bố theo Nhóm dự án (Nhóm I, II, III, IV), loại thủ tục (ĐTM, GPMT, ĐKMT), cấp thẩm quyền phê duyệt và loại hình môi trường quan trắc.
*   **Phụ tải môi trường tích lũy:** Tổng lưu lượng nước thải (m³/ngày), tổng lưu lượng khí thải (m³/giờ) và thống kê dự án theo yếu tố nhạy cảm.
*   **Phân quyền hiển thị:** Chuyên viên theo dõi hồ sơ cá nhân; Quản trị viên xem toàn hệ thống hoặc lọc theo từng chuyên viên.

### 5. Thư viện Văn bản Pháp luật Động (Laws Library)
*   Cơ sở dữ liệu văn bản pháp lý (Luật, Nghị định, Thông tư, Quy chuẩn QCVN) lưu trữ trong PostgreSQL.
*   Bộ lọc đa tiêu chí theo cơ quan ban hành, loại văn bản và trạng thái hiệu lực (Còn hiệu lực, Hết hiệu lực, Đã sửa đổi/bổ sung).
*   Xem chi tiết từng điều khoản văn bản và sao chép liên kết điều khoản trực tiếp.

### 6. Quản trị Hệ thống & Trung tâm Kiểm duyệt (Admin Center)
*   **Quản lý người dùng & phân quyền:** Tạo, cập nhật và quản lý tài khoản với 2 vai trò (`admin` và `staff`).
*   **Đồng bộ dữ liệu văn bản (Web Crawler):** Cơ chế crawler tích hợp nguồn `luatmoitruong.vn`. **Mặc định tắt chạy tự động ngầm; Quản trị viên chủ động kích hoạt cập nhật thủ công khi cần.**
*   **Kiểm duyệt tác động thay đổi văn bản (`law_rule_impacts`):** Tự động phát hiện các quy tắc chịu ảnh hưởng khi văn bản pháp lý sửa đổi hoặc hết hiệu lực để chuyên viên pháp lý rà soát.
*   **Kiểm duyệt đề xuất quy tắc bóc tách (`rule_candidates`):** Toàn bộ đề xuất trích xuất tự động đều ở trạng thái chờ duyệt `PENDING_REVIEW`; Quản trị viên kiểm tra dữ liệu bóc tách và nhập số hiệu công báo trước khi công bố.
*   **Xác nhận pháp lý QCVN & Ngành nghề:** Cho phép nhập số hiệu chứng từ công báo (`sourceDocument`) và ký xác nhận pháp lý để nâng kết quả thành chính thức.
*   **Nhập và ký duyệt bảng QCVN chuyển tiếp:** Hỗ trợ nhập bảng giới hạn thông số QCVN 40:2011 và QCVN 14:2008 từ văn bản gốc trực tiếp trên giao diện Admin.

---

## 🛡️ Bất biến Kỹ thuật & Nguyên tắc Pháp lý (AGENTS.md)

1. **Single Database Source of Truth:** Toàn bộ kết luận phân loại và đối chiếu QCVN runtime chỉ sử dụng dữ liệu quy tắc hợp lệ đã `VERIFIED` hoặc `PUBLISHED` từ PostgreSQL. Tệp tĩnh chỉ đóng vai trò seed ban đầu hoặc fixture kiểm thử.
2. **Fail-Closed Legal Gates:** Tuyệt đối không suy đoán pháp lý hoặc fallback ngầm về giá trị an toàn giả định. Dữ liệu chưa xác minh chỉ được trả về dưới dạng kết quả sơ bộ tham khảo (`NEEDS_REVIEW` hoặc `NEEDS_LEGAL_VERIFICATION`).
3. **Server-Authoritative Evaluation:** API `POST /api/projects` và `POST /api/qcvns/samples` luôn tính toán lại toàn bộ kết quả phân loại, thẩm quyền và tuân thủ trên máy chủ tại thời điểm lưu; không tin tưởng kết quả tính sẵn từ máy khách.
4. **UI-Engine-DB Parity:** Bộ lọc, dropdown ngành, công đoạn sản xuất và bảng dữ liệu phải đồng bộ 1-1 giữa giao diện, máy chủ và cơ sở dữ liệu.

---

## 🛠 Kiến trúc Công nghệ

| Tầng hệ thống | Công nghệ sử dụng | Vai trò & Đặc điểm |
| :--- | :--- | :--- |
| **Frontend** | Vue 3 (Composition API / `<script setup>`), Vite 8 | Giao diện Single Page Application, kiến trúc component module hóa, nạp động địa giới hành chính (bundle JS ~449 kB). |
| **Styling** | Vanilla CSS module hóa (`base.css`, `layout.css`, `components.css`) | Hệ thống biến CSS SaaS hiện đại, hỗ trợ `@media print` cho báo cáo A4 chuẩn mực. |
| **Bản đồ số** | Leaflet.js | Tích hợp tile vệ tinh ESRI, bản đồ giao thông Carto Voyager, phân tích polygon KCN và vùng đệm. |
| **Backend** | Node.js (v18+), Express.js | Kiến trúc Thin Controllers, Service Layer (`classification-service`, `qcvn-service`, `dashboard-service`, `spatial-gis-service`). |
| **Cơ sở dữ liệu** | PostgreSQL (kết nối qua `pg.Pool`) | Lưu trữ 13 bảng dữ liệu quan hệ, hỗ trợ migration và seed dữ liệu an toàn không `TRUNCATE`. |
| **Bảo mật** | JWT (HttpOnly Cookie), Bcrypt.js | Cơ chế phiên làm việc an toàn, chống tấn công XSS/CSRF, kiểm soát quyền truy cập RBAC. |
| **Kiểm thử** | Node.js Test Runner tích hợp (`node --test`) | 19 bài kiểm tra nghiệp vụ & parity backend, 4 bài kiểm tra tích hợp PostgreSQL thực tế. |

---

## 📂 Cấu trúc Thư mục Dự án

```text
.
├── backend/                               # Máy chủ API & Dịch vụ nghiệp vụ
│   ├── config/
│   │   └── db.js                          # Kết nối pg.Pool PostgreSQL
│   ├── fixtures/                          # Dữ liệu từ điển & seed tĩnh
│   │   └── classification-catalog.js      # IND_DB, INDUSTRY_META, CHECKLIST (~850 dòng)
│   ├── middleware/
│   │   └── auth.js                        # Xác thực JWT & phân quyền requireAdmin
│   ├── routes/                            # Thin Controllers định tuyến API
│   │   ├── admin.js                       # Quản trị người dùng, dự án
│   │   ├── admin-rules.js                 # Kiểm duyệt impacts, candidates, QCVN chuyển tiếp
│   │   ├── auth.js                        # Đăng nhập, đăng xuất, lấy phiên làm việc
│   │   ├── classification.js              # Đánh giá phân loại & metadata ngành
│   │   ├── crawler.js                     # Trạng thái crawler & kích hoạt thủ công
│   │   ├── dashboard.js                   # Thống kê KPI điều hành (~24 dòng)
│   │   ├── laws.js                        # Tra cứu thư viện văn bản pháp luật
│   │   ├── projects.js                    # Quản lý hồ sơ dự án & xác minh vùng nhạy cảm
│   │   └── qcvns.js                       # Đánh giá & quản lý mẫu quan trắc QCVN
│   ├── services/                          # Tầng xử lý logic nghiệp vụ
│   │   ├── classification-service.js      # Thuật toán phân loại 3 bước & thẩm quyền
│   │   ├── crawler-sync-service.js        # Phát hiện tác động luật & bóc tách candidate
│   │   ├── dashboard-service.js           # Tính toán số liệu thống kê & KPI
│   │   ├── db-bootstrap.js                # Khởi tạo & làm giàu CSDL tự động khi start
│   │   ├── qcvn-service.js                # Đối chiếu mẫu đo QCVN & kiểm soát IDOR
│   │   ├── rule-repository.js             # Truy vấn CSDL ngành nghề, QCVN, GIS layers
│   │   └── spatial-gis-service.js         # Thuật toán không gian (Haversine, Buffer, KCN)
│   ├── utils/                             # Tiện ích bổ trợ (Logger, Constants, Scheduler)
│   ├── tests/                             # Bộ kiểm thử tự động
│   │   ├── classification-p0.test.js      # Test logic phân loại, công đoạn, fail-closed
│   │   ├── qcvn-p0.test.js                # Test đối chiếu QCVN, lưu lượng, chuyển tiếp
│   │   ├── routes-and-parity.test.js      # Test parity giao diện, API & dữ liệu CSDL
│   │   └── postgres-integration.test.js   # Test tích hợp PostgreSQL thật
│   ├── init-db.js                         # Script khởi tạo CSDL & 13 bảng dữ liệu
│   ├── server.js                          # Điểm khởi chạy máy chủ Express
│   └── package.json
│
├── frontend/                              # Ứng dụng giao diện người dùng (Vue 3 + Vite)
│   ├── src/
│   │   ├── assets/css/
│   │   │   ├── base.css                   # Biến màu sắc, typography, reset
│   │   │   ├── layout.css                 # Khung ứng dụng, sidebar, topbar
│   │   │   ├── components.css             # Buttons, cards, bảng, modals, drawers
│   │   │   └── styles.css                 # Entry point nạp CSS
│   │   ├── components/                    # Các phân hệ giao diện Vue SFC
│   │   │   ├── ClassifyTab.vue            # Phân loại hồ sơ môi trường & bản đồ GIS
│   │   │   ├── QCVNTab.vue                # Đối chiếu quy chuẩn môi trường
│   │   │   ├── MapTab.vue                 # Bản đồ số không gian dự án
│   │   │   ├── DashboardTab.vue           # Bảng điều khiển điều hành
│   │   │   ├── LawsTab.vue                # Thư viện văn bản pháp luật
│   │   │   ├── AdminTab.vue               # Trung tâm quản trị & kiểm duyệt
│   │   │   ├── AuthModal.vue              # Hộp thoại đăng nhập
│   │   │   └── SearchableSelect.vue       # Dropdown tìm kiếm từ khóa
│   │   ├── composables/
│   │   │   └── useAdministrativeDivisions.js # Nạp động danh mục địa giới hành chính
│   │   ├── data/
│   │   │   ├── qcvn-db.js                 # Cầu nối dữ liệu QCVN
│   │   │   ├── classification-db.js       # Cầu nối dữ liệu phân loại
│   │   │   └── vietnam-divisions.json     # Dữ liệu phân cấp hành chính 63 tỉnh thành
│   │   ├── utils/
│   │   │   ├── constants.js               # Hằng số cấu hình & API endpoints
│   │   │   ├── legalLabels.js             # Từ điển ánh xạ nhãn tiếng Việt chuẩn
│   │   │   └── qcvn-evaluator.js          # Core engine đánh giá QCVN
│   │   ├── App.vue                        # Shell ứng dụng chính
│   │   └── main.js                        # Khởi tạo Vue app
│   ├── vite.config.js                     # Cấu hình Vite build (outDir: ../backend/public)
│   └── package.json
│
├── AGENTS.md                              # Bất biến kỹ thuật bắt buộc cho toàn dự án
├── package.json                           # Monorepo controller scripts
└── README.md                              # Tài liệu hướng dẫn dự án
```

---

## ⚙ Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu Hệ thống
*   **Node.js:** Phiên bản 18.x trở lên (đã kiểm thử tương thích với Node 20, 22, 24).
*   **PostgreSQL:** Phiên bản 14 trở lên đang chạy tại cổng mặc định `5432`.

### Bước 1: Cấu hình Biến môi trường
Mở hoặc tạo tệp `backend/.env` (và `.env` tại thư mục gốc) với nội dung:
```ini
DB_USER=postgres
DB_PASSWORD= Mật khẩu PostgreSQL
DB_HOST= localhost
DB_PORT= 5432
DB_NAME= tên DB
JWT_SECRET=etc_legalhub_jwt_secret_key
PORT=3000
```

### Bước 2: Cài đặt Thư viện
Chạy câu lệnh tại thư mục gốc để cài đặt tất cả các gói phụ thuộc (Monorepo, Backend, Frontend):
```bash
npm run install:all
```

### Bước 3: Khởi tạo Cơ sở Dữ liệu
Chạy lệnh khởi tạo để hệ thống tự động tạo Database, 13 bảng quan hệ, nạp tài khoản mặc định, các quy chuẩn QCVN và nạp danh mục ngành nghề, ngưỡng phân loại:
```bash
npm run init-db --prefix backend
```
> *Ghi chú:* Khi máy chủ backend khởi động, hàm `ensureRuntimeDatabaseReady()` sẽ tự động kiểm tra và làm giàu dữ liệu (Bootstrap) mà không ghi đè các bản ghi đã `VERIFIED`.

### Bước 4: Build Giao diện Frontend
Biên dịch ứng dụng Vue 3 sang thư mục tĩnh của máy chủ backend:
```bash
npm run build:frontend
```

### Bước 5: Khởi chạy Ứng dụng
*   **Chạy chế độ Production (Backend phục vụ giao diện tĩnh):**
    ```bash
    npm run dev:backend
    ```
    Truy cập hệ thống tại: **[http://localhost:3000](http://localhost:3000)**.
*   **Chạy chế độ Phát triển (Dev Mode song song có Hot-Reload):**
    ```bash
    npm run dev
    ```
    Frontend chạy tại `http://localhost:5173` và tự động proxy API sang `http://localhost:3000`.

---

## 🧪 Quy trình Kiểm thử Tự động

Hệ thống được bảo vệ bởi bộ kiểm thử tự động toàn diện. Bắt buộc chạy kiểm thử trước khi bàn giao:

```bash
# 1. Chạy toàn bộ bài test unit, logic phân loại, QCVN và kiểm tra tính toàn vẹn (19 suites)
npm test --prefix backend

# 2. Chạy bài test tích hợp kết nối trực tiếp PostgreSQL thực tế (4 suites)
npm run test:pg --prefix backend

# 3. Kiểm tra tính toàn vẹn bản build frontend
npm run build --prefix frontend
```

---

## 🔑 Danh sách Tài khoản Mẫu Mặc định

| Tên đăng nhập | Mật khẩu | Họ và tên | Quyền hạn | Phạm vi sử dụng |
| :--- | :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Quản trị viên hệ thống | `admin` | Toàn quyền cấu hình, duyệt đề xuất, xác nhận pháp lý, quản lý dự án & nhân viên |
| **staff1** | `staff123` | Chuyên viên tư vấn 1 | `staff` | Lập hồ sơ phân loại, đối chiếu QCVN, quản lý dự án cá nhân |
| **staff2** | `staff223` | Chuyên viên tư vấn 2 | `staff` | Lập hồ sơ phân loại, đối chiếu QCVN, quản lý dự án cá nhân |

---

## ⚠ Lưu ý Pháp lý & Khuyến nghị Chuyên môn

1. **Ý nghĩa của trạng thái "Cần rà soát":** Hệ thống tuân thủ nguyên tắc fail-closed nhằm bảo vệ đơn vị tư vấn. Kết quả gắn trạng thái `Cần rà soát` mang tính chất định hướng kỹ thuật sơ bộ; chuyên viên cần bổ sung đầy đủ thông số đầu vào hoặc liên hệ Quản trị viên để đối chiếu văn bản quy định gốc trước khi ban hành hồ sơ chính thức.
2. **Cập nhật quy định:** Khi văn bản pháp luật có sự thay đổi, Quản trị viên sử dụng Trung tâm Quản trị để cập nhật quy chuẩn và phê duyệt tác động, bảo đảm tính liên tục và chuẩn xác của hệ thống.
