# ETC LegalHub — Hệ thống Hỗ trợ Quản lý và Giám sát Tuân thủ Pháp lý Môi trường Doanh nghiệp Tích hợp GIS

**ETC LegalHub** là ứng dụng web hỗ trợ quản lý tập trung thông tin dự án, phân loại hồ sơ môi trường, đối chiếu quy chuẩn kỹ thuật quốc gia (QCVN), tra cứu và đồng bộ văn bản pháp luật, theo dõi thời hạn nghĩa vụ tuân thủ định kỳ và trực quan hóa dữ liệu dự án trên bản đồ số GIS.

---

## 1. Các phân hệ chức năng chính

1. **Phân loại & Xác định hồ sơ môi trường (`/classify`)**
   - Tiếp nhận thông tin dự án (39 ngành nghề trọng tâm, 6 ngành phân nhánh công đoạn sản xuất, 143 ngưỡng công suất, lưu lượng xả thải, tọa độ vị trí và yếu tố nhạy cảm môi trường).
   - Áp dụng động cơ suy diễn 3 bước độc lập (*Rule-based Decision Tree*) đọc trực tiếp từ PostgreSQL kèm cổng an toàn (*Fail-Closed*) để xác định **Nhóm dự án (I, II, III, IV)**, **Loại hồ sơ môi trường (ĐTM, GPMT, ĐKMT)**, **Cơ quan có thẩm quyền** và **Căn cứ pháp lý** chi tiết.
2. **Đối chiếu Quy chuẩn Kỹ thuật Quốc gia — QCVN (`/qcvn`)**
   - Quản lý 35 bảng giới hạn quy chuẩn (QCVN 40:2025, QCVN 14:2025, QCVN 19:2024, QCVN 05:2023, QCVN 08:2023, QCVN 09:2023, QCVN 03:2023), lựa chọn theo loại hình nguồn thải, lưu lượng (F1/F2/F3), phân vùng nguồn tiếp nhận (Cột A/B/C) và quy tắc chuyển tiếp cho cơ sở hiện hữu.
   - Tự động đối chiếu từng chỉ tiêu quan trắc với cả giới hạn QCVN và giới hạn riêng trong GPMT (hỗ trợ cả định dạng số thập phân dấu phẩy/dấu chấm), tính tỷ lệ so với ngưỡng, cảnh báo sớm các thông số tiệm cận ngưỡng và xuất báo cáo đối chiếu.
3. **Thư viện Văn bản Pháp luật & Đồng bộ Pháp lý (`/laws`, `/admin`)**
   - Tra cứu 140 văn bản theo loại (Luật, Nghị định, Thông tư, Văn bản hợp nhất, Quyết định, Nghị quyết, QCVN), lọc theo hiệu lực, tìm kiếm điều khoản và tự động hiển thị chuẩn pháp lý hiện hành từ cơ sở dữ liệu (`/api/laws/active-basis`).
   - Công cụ đồng bộ Sitemap XML & Cheerio theo mô hình 2 tầng: cập nhật kho văn bản, phát hiện quy tắc/ngưỡng bị ảnh hưởng và sinh đề xuất quy tắc ở trạng thái chờ Quản trị viên phê duyệt.
4. **Quản lý Dự án & Bản đồ số WebGIS (`/map`)**
   - Hiển thị vị trí dự án theo màu nhóm rủi ro, tra cứu ranh giới hành chính Tỉnh/Thành phố và Phường/Xã sau sáp nhập, vẽ vòng đệm bán kính tác động và kiểm tra khoảng cách không gian Haversine tới 57 lớp Khu công nghiệp, vùng nhạy cảm môi trường và biên giới/bờ biển.
5. **Nhắc hạn Nghĩa vụ Tuân thủ & Bảng điều khiển (`/dashboard`, `/admin`)**
   - Theo dõi các mốc thời hạn báo cáo, quan trắc định kỳ của từng dự án; tự động phân mức cảnh báo (*Quá hạn*, *Sắp đến hạn*, *Trong hạn*, *Đã hoàn thành*) và sinh kỳ tiếp theo khi hoàn thành.
   - Bảng điều khiển thống kê trực quan (KPI, biểu đồ phân bố dự án và tình trạng mẫu quan trắc) cùng chức năng **Truy vết lịch sử thao tác & cập nhật dữ liệu pháp lý** hợp nhất dành cho Quản trị viên.

---

## 2. Công nghệ sử dụng

- **Giao diện (Frontend):** Vue.js 3 (Composition API), Vite 8, Leaflet.js (WebGIS), CSS3.
- **Máy chủ (Backend):** Node.js 22, Express.js 4 (61 RESTful API endpoints).
- **Cơ sở dữ liệu (Database):** PostgreSQL (19 bảng vật lý chuẩn hóa tiếng Việt kèm lớp View tương thích).
- **Thu thập dữ liệu & Lập lịch:** Fetch API, Sitemap XML, Cheerio và `node-cron`.
- **Bảo mật & Xác thực:** JWT lưu trong cookie `HttpOnly`, băm mật khẩu bằng `bcryptjs`, phân quyền theo vai trò (`admin`, `staff`, khách vãng lai), đánh giá có thẩm quyền tại máy chủ và ghi nhật ký kiểm toán (`nhat_ky_kiem_toan`).
- **Kiểm thử:** Node.js Test Runner (`node:test`) và Playwright (Chromium E2E).

---

## 3. Cấu trúc thư mục

```text
├── backend/
│   ├── config/          # Cấu hình kết nối PostgreSQL
│   ├── middleware/      # Xác thực JWT & kiểm tra phân quyền (requireAuth, requireAdmin)
│   ├── routes/          # 10 nhóm REST API (auth, projects, classification, qcvns, laws, reminders, crawler, admin...)
│   ├── services/        # Động cơ phân loại, đối chiếu QCVN, đồng bộ crawler, nhắc hạn, thống kê & kho dữ liệu
│   ├── scripts/         # Kịch bản khởi tạo/chuẩn hóa dữ liệu, máy chủ E2E và đánh giá thực nghiệm
│   ├── tests/           # Bộ kiểm thử đơn vị & tích hợp Backend (35 kịch bản) và tích hợp PostgreSQL
│   ├── utils/           # Tiện ích dùng chung (crawler, logger, audit, hằng số)
│   ├── init-db.js       # Khởi tạo lược đồ cơ sở dữ liệu và dữ liệu nền an toàn
│   └── server.js        # Điểm khởi chạy máy chủ Express
├── frontend/
│   ├── src/
│   │   ├── assets/      # Biểu tượng, hình ảnh và bảng định kiểu CSS
│   │   ├── components/  # Các trang phân hệ (DashboardTab, ClassifyTab, QCVNTab, LawsTab, MapTab, AdminTab...)
│   │   ├── composables/ # Quản lý danh mục phân loại và đơn vị hành chính
│   │   ├── data/        # Dữ liệu khởi tạo ban đầu và ranh giới hành chính
│   │   ├── utils/       # Hằng số API, bộ đánh giá sơ bộ, lớp bản đồ và nhãn hiển thị tiếng Việt
│   │   └── App.vue      # Khung giao diện chính
│   └── vite.config.js
├── tests/               # Bộ kiểm thử hệ thống tự động đầu-cuối Playwright (E2E)
├── docs/                # Tài liệu thiết kế hệ thống và lược đồ SQL PostgreSQL
├── package.json
└── playwright.config.js
```

---

## 4. Hướng dẫn cài đặt và chạy trên máy cá nhân

### Yêu cầu môi trường
- **Node.js** (khuyến nghị phiên bản 20+ / 22 LTS tương thích với Vite)
- **PostgreSQL** đang hoạt động

### Các bước thực hiện

1. **Tạo tệp cấu hình môi trường `backend/.env`:**

   ```dotenv
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=mat_khau_db
   DB_NAME=etc_legalhub
   JWT_SECRET=chuoi_bi_mat_jwt
   PORT=5000
   NODE_ENV=development
   ```

2. **Cài đặt các gói phụ thuộc cho toàn dự án:**

   ```powershell
   npm run install:all
   ```

3. **Khởi tạo lược đồ PostgreSQL và dữ liệu danh mục chuẩn:**

   ```powershell
   npm run init-db --prefix backend
   ```

4. **Chạy môi trường phát triển (Backend + Frontend):**

   ```powershell
   npm run dev
   ```
   - Máy chủ API chạy tại: `http://localhost:5000`
   - Giao diện phát triển Vite chạy tại: `http://localhost:5173`

5. **Đóng gói giao diện (Build Production) để chạy trực tiếp qua Express:**

   ```powershell
   npm run build --prefix frontend
   npm run dev:backend
   ```

---

## 5. Kiểm thử

```powershell
# Chạy toàn bộ bộ kiểm thử đơn vị và tích hợp backend (35/35 kịch bản)
npm test --prefix backend

# Chạy kiểm thử tích hợp trực tiếp với PostgreSQL
npm run test:pg --prefix backend

# Chạy kiểm thử hệ thống đầu-cuối (End-to-End) trên trình duyệt Chromium với Playwright
npx playwright test

# Kiểm tra đóng gói giao diện frontend
npm run build --prefix frontend
```

---

## 6. Tài liệu hệ thống

- [01. Tổng quan nghiệp vụ và hành trình sử dụng](docs/01-tong-quan-nghiep-vu.md)
- [02. Kiến trúc và luồng dữ liệu](docs/02-kien-truc-va-luong-du-lieu.md)
- [03. Cơ sở dữ liệu, API và vận hành](docs/03-co-so-du-lieu-api-van-hanh.md)
- [Lược đồ cơ sở dữ liệu PostgreSQL](docs/etc_legalhub_schema.sql)
