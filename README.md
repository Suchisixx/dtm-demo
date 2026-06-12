# ETC LegalHub - Hệ thống pháp lý & Đối chiếu môi trường doanh nghiệp

ETC LegalHub là một ứng dụng web toàn diện (Full-stack) được xây dựng dành cho công tác tư vấn môi trường (VILAS 495). Hệ thống tích hợp tra cứu văn bản pháp luật, phân loại dự án/xác định hồ sơ, lưu trữ quản lý dự án nội bộ và đối chiếu nhanh kết quả quan trắc với các Quy chuẩn kỹ thuật quốc gia (QCVN).

---

## 🚀 Các chức năng chính

### 1. Tra cứu Văn bản pháp lý
*   Tổng hợp các Luật, Nghị định, Thông tư và QCVN hiện hành trong ngành môi trường.
*   Lọc văn bản nhanh chóng theo loại hình (Luật, Nghị định, Thông tư, QCVN) và trạng thái hiệu lực (Còn hiệu lực, Đã sửa đổi).
*   Cảnh báo thông minh các bản cập nhật mới nhất (như Nghị định 48/2026, Văn bản hợp nhất 49/VBHN...).

### 2. Phân quyền Đăng nhập (Authentication)
*   **Khi chưa đăng nhập:** Người dùng chỉ có quyền xem tab `Văn bản pháp lý`. Các tab nghiệp vụ chuyên sâu hơn sẽ bị khóa (🔒) để bảo vệ dữ liệu nội bộ công ty.
*   **Khi đã đăng nhập:** Mở khóa toàn bộ tab chức năng và kích hoạt bảng lưu trữ dự án cá nhân.
*   **Bảo mật:** Sử dụng cơ chế token JWT (JSON Web Token) được mã hóa và lưu trữ an toàn trong cookie `HttpOnly` giúp chống lại các cuộc tấn công XSS.

### 3. Phân loại dự án & Quản lý Hồ sơ (bố cục 3 cột hiện đại)
*   **Cột 1 (Sidebar trái):** Quản lý danh sách dự án của riêng nhân viên đang đăng nhập. 
    *   Hỗ trợ tạo mới (`➕ Tạo dự án mới`), xem chi tiết bằng cách click chọn, và xóa dự án (`🗑️`) kèm hộp thoại xác nhận.
    *   Tích hợp tính năng phân trang (`1, 2, 3...`), hiển thị tối đa 5 dự án trên một trang để giao diện gọn gàng.
*   **Cột 2 (Form ở giữa):** Nhập thông tin dự án bao gồm Tên dự án, Loại hình ngành nghề, Quy mô công suất, Lưu lượng nước thải/khí thải, Địa điểm và các điều kiện đặc thù khác.
*   **Cột 3 (Kết quả bên phải):** Tự động tính toán loại hồ sơ cần lập (ĐTM, GPMT, ĐKMT), cơ quan phê duyệt cấp Bộ/Tỉnh/Huyện, thời hạn thẩm định, căn cứ pháp lý và danh mục tài liệu cần chuẩn bị.
*   **Tự động Lưu trữ (Auto-Save):** 
    *   Hệ thống tự động lưu hoặc cập nhật dự án lên cơ sở dữ liệu PostgreSQL mỗi khi bấm nút **Phân loại hồ sơ**.
    *   Tự động lưu trạng thái checkbox tài liệu đã chuẩn bị trong checklist theo thời gian thực (Realtime).

### 4. So sánh kết quả quan trắc với QCVN
*   **Bộ chọn quy chuẩn kép:** Lựa chọn dễ dàng giữa các loại môi trường (Nước mặt, Nước thải công nghiệp, Nước thải sinh hoạt, Nước ngầm, Không khí, Đất) và phân cấp cột giới hạn (Cột A, B, A1, A2, B1, B2, Loại 1, 2, 3) tương ứng.
*   **Dán nhanh số liệu (Smart Paste):** Hỗ trợ copy bảng số liệu từ file Excel, Word, PDF của phòng thí nghiệm và dán vào ô nhập nhanh. Hệ thống sử dụng thuật toán chuẩn hóa không dấu tự động nhận diện chỉ tiêu và điền nhanh giá trị tương ứng.
*   **Đánh giá vượt ngưỡng:** Tự động tô màu kết quả (Màu Xanh = Đạt, Màu Cam = Cảnh báo sát ngưỡng >80%, Màu Đỏ = Vượt ngưỡng kèm hệ số vượt bao nhiêu lần).
*   **Bổ sung QCVN 03:2023/BTNMT:** Tích hợp đầy đủ các thông số giới hạn kim loại nặng của quy chuẩn chất lượng đất mới nhất.
*   **In ấn/Xuất PDF chuẩn hóa:** Bộ style `@media print` ẩn đi toàn bộ giao diện điều hướng thừa, chỉ in ra một bản báo cáo đối chiếu QCVN sạch sẽ, chuyên nghiệp để gửi khách hàng hoặc lưu trữ.

---

## 🛠 Công nghệ sử dụng

*   **Frontend:** HTML5, CSS3 (Vanilla CSS), JavaScript (ES6+ thuần).
*   **Backend:** Node.js, Express.js.
*   **Database:** PostgreSQL (vử dụng kết nối Pool từ thư viện `pg`).
*   **Security:** JWT (JSON Web Token), Cookie-based sessions, Bcryptjs (mã hóa mật khẩu).

---

## 📂 Cấu trúc thư mục dự án

```text
.
├── config/
│   └── db.js                  # Kết nối và xuất pg.Pool PostgreSQL
├── middleware/
│   └── auth.js                # Middleware xác thực JWT cookie bảo vệ API
├── routes/
│   ├── auth.js                # Định tuyến API đăng nhập, đăng xuất, phiên làm việc
│   └── projects.js            # Định tuyến API CRUD dự án phân loại (phân trang)
├── public/                    # Thư mục chứa tài nguyên frontend tĩnh
│   ├── index.html             # Trang chủ chính (Đổi tên từ moi_truong_portal.html)
│   └── assets/
│       ├── css/
│       │   └── styles.css     # Định nghĩa style toàn trang, layout 3 cột & print PDF
│       └── js/
│           ├── app.js         # Khởi tạo auth, quản lý giao diện trạng thái đăng nhập
│           ├── data/
│           │   ├── laws.js              # Database văn bản pháp lý hiển thị ở tab 1
│           │   ├── classification-db.js # Database quy định quy mô ngành & mẫu hồ sơ
│           │   └── qcvn-db.js           # Database giới hạn thông số QCVN (mới)
│           ├── services/
│           │   └── classification-rules.js # Logic tính toán phân hạng công suất
│           ├── ui/
│           │   ├── classify-view.js     # Điều khiển nhập form, checklist & auto-save dự án
│           │   ├── laws-view.js         # Render danh sách văn bản và bộ lọc hiệu lực
│           │   ├── navigation.js        # Điều khiển chuyển tab trang, chặn tab riêng tư
│           │   └── qcvn-view.js         # Điều khiển đối chiếu QCVN, parser dán text & in PDF
│           └── utils/
│               └── dom.js               # Helper thao tác DOM
├── .env                       # Khai báo biến môi trường (Database, Secret...)
├── package.json               # Quản lý thư viện cài đặt
├── init-db.js                 # Script tự động tạo DB, tạo bảng và seed tài khoản mẫu
└── server.js                  # Điểm khởi chạy server backend (Express.js)
```

---

## ⚙ Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu hệ thống:
*   Máy đã cài đặt **Node.js** (Khuyên dùng v18+).
*   Đang chạy dịch vụ **PostgreSQL** (Port mặc định 5432).

### Bước 1: Cấu hình cơ sở dữ liệu
Mở file [.env](file:///.env) ở thư mục gốc của dự án và cập nhật thông số mật khẩu PostgreSQL của máy bạn:
```ini
DB_USER=postgres
DB_PASSWORD=Mật_khẩu_Postgres_của_bạn
DB_HOST=localhost
DB_PORT=5432
DB_NAME=etc_legalhub
JWT_SECRET=etc_legalhub_jwt_secret_key_2026
PORT=3000
```

### Bước 2: Cài đặt thư viện Node.js
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### Bước 3: Khởi tạo database và tạo tài khoản mẫu
Chạy câu lệnh dưới đây để hệ thống tự động kết nối PostgreSQL tạo Database, bảng biểu, và nạp dữ liệu tài khoản nhân viên mặc định:
```bash
npm run init-db
```
*Màn hình sẽ hiển thị `--- KHỞI TẠO HOÀN TẤT ---` báo thành công.*

### Bước 4: Chạy ứng dụng
Khởi động máy chủ web:
```bash
npm start
```
Truy cập ứng dụng tại địa chỉ: **[http://localhost:3000](http://localhost:3000)**.

---

## 🔑 Danh sách tài khoản mẫu (Nội bộ doanh nghiệp)

Ứng dụng không thiết kế tính năng Đăng ký tài khoản vì giới hạn sử dụng trong nội bộ công ty. Các tài khoản dưới đây được tạo sẵn tự động:

| Tên đăng nhập | Mật khẩu | Tên nhân viên | Vai trò |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Người quản trị | Quản trị viên |
| **staff1** | `staff123` | Nhân viên 1 | Chuyên viên tư vấn |
| **staff2** | `staff223` | Nhân viên 2 | Chuyên viên tư vấn |

---

## 📝 Hướng dẫn cập nhật và mở rộng dữ liệu

*   **Để chỉnh sửa hoặc thêm văn bản pháp lý:** Thay đổi mảng `LAWS` trong file [public/assets/js/data/laws.js](file:///d:/Download/demo/public/assets/js/data/laws.js).
*   **Để cập nhật các QCVN đối chiếu:** Sửa đổi hoặc thêm cấu trúc chỉ tiêu trong tệp [public/assets/js/data/qcvn-db.js](file:///d:/Download/demo/public/assets/js/data/qcvn-db.js). Mỗi chỉ tiêu cần có các thuộc tính:
    *   `key`: Định danh (Ví dụ: `BOD5`, `COD`...).
    *   `ten`: Tên hiển thị đầy đủ.
    *   `don_vi`: Đơn vị đo (`mg/L`, `µg/m³`...).
    *   `loai`: Loại kiểm tra (`max` để so sánh nhỏ hơn hoặc bằng giới hạn, `min` cho lớn hơn hoặc bằng giới hạn, `range` cho khoảng pH).
    *   `gioi_han`: Ngưỡng số cho phép (với `max` hoặc `min`).
    *   `min` & `max`: Ngưỡng cho khoảng (với `range`).
*   **Bảo trì quy định phân loại dự án:** Cập nhật bảng tra cứu ngành nghề `IND_DB` và danh mục tài liệu cần chuẩn bị `CHECKLIST` tại tệp [public/assets/js/data/classification-db.js](file:///d:/Download/demo/public/assets/js/data/classification-db.js).

---

## ⚠ Ghi chú sử dụng
Ứng dụng này phục vụ mục đích tra cứu nghiệp vụ, đối chiếu nhanh số liệu và lưu trữ hồ sơ công việc nội bộ của ETC. Khi lập hồ sơ chính thức gửi cơ quan chức năng, nhân viên cần đối chiếu trực tiếp lại với các văn bản pháp luật gốc có hiệu lực tại thời điểm nộp hồ sơ để đảm bảo tính pháp lý tuyệt đối.
