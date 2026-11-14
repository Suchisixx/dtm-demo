# ETC LegalHub — Hệ thống Hỗ trợ Quản lý và Giám sát Tuân thủ Pháp lý Môi trường Doanh nghiệp Tích hợp GIS

**ETC LegalHub** là ứng dụng web hỗ trợ quản lý tập trung thông tin dự án, phân loại hồ sơ môi trường, đối chiếu quy chuẩn kỹ thuật quốc gia (QCVN), tra cứu và đồng bộ văn bản pháp luật, theo dõi thời hạn nghĩa vụ tuân thủ định kỳ và trực quan hóa dữ liệu dự án trên bản đồ số GIS.

---

## 1. Các phân hệ chức năng chính

1. **Phân loại & Xác định hồ sơ môi trường (`/classify`)**
   - Tiếp nhận thông tin dự án (ngành nghề, công đoạn sản xuất, quy mô công suất, lưu lượng xả thải, tọa độ vị trí và yếu tố nhạy cảm môi trường).
   - Áp dụng động cơ suy diễn dựa trên luật (*Rule-based Decision Tree*) đọc trực tiếp từ PostgreSQL để xác định **Nhóm dự án (I, II, III, IV)**, **Loại hồ sơ môi trường (ĐTM, GPMT, ĐKMT)**, **Cơ quan có thẩm quyền** và **Căn cứ pháp lý** chi tiết.
2. **Đối chiếu Quy chuẩn Kỹ thuật Quốc gia — QCVN (`/qcvn`)**
   - Hỗ trợ lựa chọn quy chuẩn theo loại hình nguồn thải, lưu lượng xả thải và phân vùng nguồn tiếp nhận (Cột A/B), bao gồm quy tắc chuyển tiếp cho cơ sở hiện hữu.
   - Tự động so sánh từng chỉ tiêu quan trắc với giá trị giới hạn, tính tỷ lệ vượt chuẩn, tổng hợp trạng thái mẫu và xuất báo cáo đối chiếu.
3. **Thư viện Văn bản Pháp luật & Đồng bộ Pháp lý (`/laws`, `/admin`)**
   - Tra cứu văn bản theo loại (Luật, Nghị định, Thông tư, Văn bản hợp nhất, QCVN), tìm kiếm điều khoản và tự động hiển thị chuẩn pháp lý hiện hành từ cơ sở dữ liệu.
   - Công cụ đồng bộ Sitemap XML & Cheerio theo mô hình 2 tầng: cập nhật kho văn bản, phát hiện quy tắc/ngưỡng bị ảnh hưởng và sinh đề xuất quy tắc ở trạng thái chờ Quản trị viên phê duyệt.
4. **Quản lý Dự án & Bản đồ số WebGIS (`/map`)**
   - Hiển thị vị trí dự án theo màu nhóm rủi ro, tra cứu ranh giới hành chính Tỉnh/Thành phố và Phường/Xã, vẽ vòng đệm bán kính tác động và kiểm tra khoảng cách không gian tới Khu công nghiệp, vùng nhạy cảm môi trường.
5. **Nhắc hạn Nghĩa vụ Tuân thủ & Bảng điều khiển (`/dashboard`, `/admin`)**
   - Theo dõi các mốc thời hạn báo cáo, quan trắc định kỳ của từng dự án; tự động phân mức cảnh báo (*Quá hạn*, *Sắp đến hạn*, *Trong hạn*) và sinh kỳ tiếp theo khi hoàn thành.
   - Bảng điều khiển thống kê trực quan (KPI, biểu đồ phân bố dự án và tình trạng mẫu quan trắc) cùng chức năng **Truy vết lịch sử thao tác & cập nhật dữ liệu pháp lý** dành cho Quản trị viên.

---

## 2. Công nghệ sử dụng

- **Giao diện (Frontend):** Vue.js 3 (Composition API), Vite, Leaflet.js (WebGIS), CSS3.
- **Máy chủ (Backend):** Node.js, Express.js (RESTful API).
- **Cơ sở dữ liệu (Database):** PostgreSQL (lược đồ bảng vật lý chuẩn hóa tiếng Việt kèm lớp View tương thích).
- **Thu thập dữ liệu:** Fetch API kết hợp phân tích Sitemap XML và Cheerio.
- **Bảo mật & Xác thực:** JWT lưu trong cookie `HttpOnly`, băm mật khẩu bằng `bcryptjs`, phân quyền theo vai trò (`admin`, `staff`, khách vãng lai) và ghi nhật ký kiểm toán (`nhat_ky_kiem_toan`).
- **Kiểm thử:** Node.js Test Runner (Unit & Integration Tests) và Playwright.

---

## 3. Cấu trúc thư mục

```text
├── backend/
│   ├── config/          # Cấu hình kết nối PostgreSQL
│   ├── middleware/      # Xác thực JWT & kiểm tra phân quyền (requireAuth, requireAdmin)
│   ├── routes/          # Các nhóm REST API (auth, projects, classification, qcvns, laws, reminders, crawler, admin...)
│   ├── services/        # Động cơ phân loại, đối chiếu QCVN, đồng bộ crawler, nhắc hạn, thống kê & kho dữ liệu
│   ├── scripts/         # Kịch bản khởi tạo/chuẩn hóa dữ liệu & sinh sơ đồ kiến trúc
│   ├── tests/           # Bộ kiểm thử tự động Backend & tích hợp PostgreSQL
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
└── docs/                # Tài liệu thiết kế hệ thống, lược đồ SQL và sơ đồ kiến trúc (.drawio, .svg)
```

---

## 4. Hướng dẫn cài đặt và chạy trên máy cá nhân

### Yêu cầu môi trường
- **Node.js** (khuyến nghị phiên bản LTS tương thích với Vite)
- **PostgreSQL** đang hoạt động

### Các bước thực hiện

1. **Tạo tệp cấu hình môi trường `backend/.env`:**

   ```dotenv
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=mat-khau-postgresql-cua-ban
   DB_NAME=etc_legalhub
   JWT_SECRET=chuoi-bi-mat-jwt-cua-ban
   PORT=3000
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
   - Máy chủ API chạy tại: `http://localhost:3000`
   - Giao diện phát triển Vite chạy tại: `http://localhost:5173`

5. **Đóng gói giao diện (Build Production) để chạy trực tiếp qua Express:**

   ```powershell
   npm run build --prefix frontend
   npm run dev:backend
   ```

---

## 5. Kiểm thử

```powershell
# Chạy toàn bộ bộ kiểm thử nghiệp vụ và API backend
npm test --prefix backend

# Chạy kiểm thử tích hợp trực tiếp với PostgreSQL
npm run test:pg --prefix backend

# Kiểm tra đóng gói giao diện frontend
npm run build --prefix frontend
```

---

## 6. Tài liệu hệ thống

- [01. Tổng quan nghiệp vụ và hành trình sử dụng](docs/01-tong-quan-nghiep-vu.md)
- [02. Kiến trúc và luồng dữ liệu](docs/02-kien-truc-va-luong-du-lieu.md)
- [03. Cơ sở dữ liệu, API và vận hành](docs/03-co-so-du-lieu-api-van-hanh.md)
- [Lược đồ cơ sở dữ liệu PostgreSQL](docs/etc_legalhub_schema.sql)
- [Bộ sơ đồ thiết kế hệ thống (Draw.io & SVG)](docs/diagrams/)
