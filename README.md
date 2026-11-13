# ETC LegalHub

ETC LegalHub là ứng dụng web hỗ trợ tư vấn môi trường: quản lý hồ sơ dự án, tra cứu văn bản pháp lý, phân loại nghĩa vụ môi trường, đối chiếu kết quả quan trắc với QCVN, theo dõi số liệu và xem dự án trên bản đồ GIS.

## Tài liệu hệ thống

Đọc theo thứ tự sau để hiểu từ nghiệp vụ đến triển khai:

1. [Tổng quan nghiệp vụ và hành trình sử dụng](docs/01-tong-quan-nghiep-vu.md)
2. [Kiến trúc và luồng dữ liệu](docs/02-kien-truc-va-luong-du-lieu.md)
3. [Cơ sở dữ liệu, API và vận hành](docs/03-co-so-du-lieu-api-van-hanh.md)

Các tài liệu này mô tả mục tiêu từng phân hệ, cách giao diện/máy chủ/PostgreSQL trao đổi dữ liệu, 18 bảng vật lý và vai trò của các tệp chính. `AGENTS.md` ghi lại những bất biến kỹ thuật/pháp lý cần tuân thủ khi sửa hệ thống.

## Công nghệ

- Giao diện: Vue 3, Vite và CSS.
- Máy chủ: Node.js, Express và REST API trao đổi JSON.
- Cơ sở dữ liệu: PostgreSQL, kết nối qua `pg.Pool`.
- Bản đồ: Leaflet và các nguồn lớp nền/địa lý được cấu hình trong ứng dụng.
- Xác thực: JWT trong cookie `HttpOnly`, băm mật khẩu bằng `bcryptjs`.
- Kiểm thử: Node.js Test Runner; kiểm thử trình duyệt cấu hình qua Playwright.

## Chạy trên máy cá nhân

Yêu cầu Node.js tương thích với Vite hiện tại và PostgreSQL đang hoạt động.

1. Tạo `backend/.env` với cấu hình phù hợp:

   ```dotenv
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=thay-bang-mat-khau-cua-ban
   DB_NAME=etc_legalhub
   JWT_SECRET=tao-chuoi-bi-mat-rieng
   PORT=3000
   NODE_ENV=development
   ```

2. Cài các gói phụ thuộc:

   ```powershell
   npm run install:all
   ```

3. Khởi tạo schema và dữ liệu nền an toàn:

   ```powershell
   npm run init-db --prefix backend
   ```

4. Chạy máy chủ và giao diện phát triển:

   ```powershell
   npm run dev
   ```

Máy chủ API mặc định ở `http://localhost:3000`; giao diện Vite ở `http://localhost:5173`. Để build frontend vào `backend/public` và chạy giao diện qua Express:

```powershell
npm run build --prefix frontend
npm run dev:backend
```

## Kiểm tra

```powershell
# Kiểm thử nghiệp vụ và API backend
npm test --prefix backend

# Kiểm thử tích hợp với PostgreSQL đã cấu hình
npm run test:pg --prefix backend

# Build frontend
npm run build --prefix frontend
```

Kiểm thử PostgreSQL cần cơ sở dữ liệu phù hợp. Không đưa mật khẩu, JWT hoặc dữ liệu cá nhân vào mã nguồn hay nhật ký.

## Nguyên tắc dữ liệu và pháp lý

- PostgreSQL là nguồn runtime có thẩm quyền cho quy tắc phân loại và QCVN đã được xác minh/công bố.
- Dữ liệu tĩnh chỉ dùng khởi tạo hoặc kiểm thử; khi được phép dùng dự phòng phải gắn `FALLBACK_UNVERIFIED` và hạ kết luận xuống `NEEDS_REVIEW`.
- Máy chủ tính lại kết quả trước khi lưu dự án hoặc mẫu QCVN; không tin kết quả do trình duyệt tự gửi.
- Thiếu dữ liệu/căn cứ phải trả trạng thái cần rà soát; không tự suy đoán giá trị hoặc thẩm quyền.
- Seed phải chạy an toàn, không xóa hàng loạt hay ghi đè dữ liệu đã xác minh/công bố.
