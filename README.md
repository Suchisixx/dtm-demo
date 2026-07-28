# ETC LegalHub - Hệ thống pháp lý & Đối chiếu môi trường doanh nghiệp

ETC LegalHub là một ứng dụng web toàn diện (Full-stack) được xây dựng dành cho công tác tư vấn môi trường (VILAS 495). Hệ thống tích hợp tra cứu văn bản pháp luật, phân loại dự án/xác định hồ sơ, lưu trữ quản lý dự án nội bộ, đối chiếu nhanh kết quả quan trắc với các Quy chuẩn kỹ thuật quốc gia (QCVN) mới nhất 2025/2026, và hệ thống Quản trị dành cho Admin để quản lý toàn bộ hệ thống động.

---

## 🚀 Các chức năng chính

### 1. Tra cứu Văn bản pháp lý Động (Dynamic Laws Database)
*   Không còn lưu trữ văn bản pháp lý tĩnh trên mã nguồn. Toàn bộ cơ sở pháp lý (Luật, Nghị định, Thông tư, Quy chuẩn QCVN) được quản lý động thông qua cơ sở dữ liệu PostgreSQL.
*   Trang tìm kiếm công khai hỗ trợ lọc nhanh theo loại hình và trạng thái hiệu lực (Còn hiệu lực, Đã sửa đổi).
*   Đồng bộ trực tiếp: Khi Quản trị viên thay đổi cơ sở pháp lý trên trang Admin, kết quả hiển thị của người dùng sẽ lập tức thay đổi theo thời gian thực (Live Sync).

### 2. Phân quyền Đăng nhập (Authentication & Role Authorization)
*   **Khi chưa đăng nhập:** Người dùng chỉ có quyền xem tab `Văn bản pháp lý`. Các tab nghiệp vụ chuyên sâu hơn sẽ bị khóa (🔒) để bảo vệ dữ liệu nội bộ công ty.
*   **Tài khoản nhân viên (Staff):** Mở khóa tab `Phân loại dự án` và `So sánh QCVN`. Tự động kích hoạt bảng lưu trữ dự án cá nhân (Sidebar 3 cột có phân trang). Không thể truy cập trang Quản trị.
*   **Tài khoản quản trị (Admin):** Xuất hiện thêm tab `⚙️ Quản trị` trên thanh điều hướng, mở khóa toàn bộ quyền điều phối hệ thống.
*   **Bảo mật:** Sử dụng cơ chế token JWT (JSON Web Token) được mã hóa và lưu trữ an toàn trong cookie `HttpOnly` giúp chống lại các cuộc tấn công XSS.

### 3. Trang Quản trị Hệ thống (Admin Panel)
Dashboard quản lý dành riêng cho các tài khoản có quyền `admin` gồm 3 phân hệ chính:
*   **Quản lý Nhân viên (Staff Accounts CRUD):**
    *   Tạo tài khoản nhân viên mới, phân quyền sử dụng (`staff` hoặc `admin`).
    *   Chỉnh sửa Họ tên, quyền hạn và thay đổi mật khẩu của nhân viên.
    *   Xóa tài khoản nhân viên (ngăn cản việc tự xóa tài khoản của chính mình).
*   **Quản lý Dự án (System Projects Management):**
    *   Xem danh sách toàn bộ các dự án được lưu trữ bởi tất cả nhân viên trong hệ thống (gồm tên dự án, thông tin nhân viên sở hữu, ngành nghề và ngày tạo).
    *   Hỗ trợ Admin xóa dọn dẹp dự án của bất kỳ tài khoản nào.
*   **Quản lý Quy chuẩn pháp lý (Laws Dynamic CRUD):**
    *   Cho phép Thêm mới, Sửa đổi, Xóa bỏ bất kỳ văn bản pháp lý nào trong database.
    *   Cho phép chỉnh sửa các điều khoản quan trọng (Mỗi dòng một điều khoản) để nhân viên dễ dàng tham chiếu.

### 4. Phân loại dự án & Quản lý Hồ sơ
*   **Cột 1 (Sidebar trái):** Quản lý danh sách dự án của riêng nhân viên đang đăng nhập. Hỗ trợ tạo mới (`➕ Tạo dự án mới`), xem chi tiết bằng cách click chọn, và xóa dự án (`🗑️`) kèm hộp thoại xác nhận. Tích hợp phân trang (5 dự án/trang).
*   **Cột 2 (Form ở giữa):** Nhập thông tin dự án bao gồm Tên dự án, Loại hình ngành nghề, Quy mô công suất, Lưu lượng nước thải/khí thải, Địa điểm và các điều kiện đặc thù khác.
*   **Cột 3 (Kết quả bên phải):** Tự động tính toán loại hồ sơ cần lập (ĐTM, GPMT, ĐKMT), cơ quan phê duyệt cấp Bộ/Tỉnh/Huyện, thời hạn thẩm định, căn cứ pháp lý và danh mục tài liệu cần chuẩn bị.
*   **Tự động Lưu trữ (Auto-Save):** Tự động lưu hoặc cập nhật dự án lên Postgres mỗi khi bấm nút **Phân loại hồ sơ** và tự động lưu trạng thái checklist tài liệu đã tick chuẩn bị.

### 5. So sánh kết quả quan trắc với QCVN mới nhất (2025/2026)
*   **Bộ chọn quy chuẩn kép:** Lựa chọn dễ dàng giữa các loại môi trường (Nước mặt, Nước thải công nghiệp, Nước thải sinh hoạt, Nước ngầm, Không khí, Đất) và phân cấp cột giới hạn tương ứng.
*   **Lộ trình chuyển tiếp rõ ràng:** Tích hợp đầy đủ **QCVN 40:2025** (Nước thải công nghiệp), **QCVN 14:2025** (Nước thải sinh hoạt) và **QCVN 05:2023** (Không khí xung quanh) thay thế phiên bản cũ. Giao diện ghi rõ ghi chú lộ trình chuyển tiếp cho dự án nộp hồ sơ sau 01/09/2025 để đảm bảo tính chính xác khi tư vấn.
*   **Dán nhanh số liệu (Smart Paste):** Hỗ trợ copy bảng số liệu từ file Excel, Word, PDF của phòng thí nghiệm và dán vào ô nhập nhanh để tự động điền giá trị.
*   **Đánh giá vượt ngưỡng:** Tự động tô màu kết quả (Màu Xanh = Đạt, Màu Cam = Cảnh báo sát ngưỡng >80%, Màu Đỏ = Vượt ngưỡng kèm hệ số vượt bao nhiêu lần).
*   **In ấn/Xuất PDF chuẩn hóa:** Tích hợp bộ style `@media print` ẩn đi toàn bộ giao diện thừa, tạo ra bản in báo cáo đối chiếu QCVN sạch sẽ, chuyên nghiệp để gửi đối tác.

---

## 🛠 Công nghệ sử dụng

*   **Frontend:** HTML5, CSS3 (Vanilla CSS), JavaScript (ES6+ thuần).
*   **Backend:** Node.js, Express.js.
*   **Database:** PostgreSQL (sử dụng kết nối Pool từ thư viện `pg`).
*   **Security:** JWT (JSON Web Token), Cookie-based sessions, Bcryptjs (mã hóa mật khẩu).

---

## 📂 Cấu trúc thư mục dự án

```text
.
├── config/
│   └── db.js                  # Kết nối và xuất pg.Pool PostgreSQL
├── middleware/
│   └── auth.js                # Middleware xác thực JWT cookie bảo vệ API & vai trò admin
├── routes/
│   ├── auth.js                # Định tuyến API đăng nhập, đăng xuất, phiên làm việc (Ghi log LOGIN/LOGOUT)
│   ├── projects.js            # Định tuyến API CRUD dự án phân loại (Lưu query_logs & audit_logs)
│   ├── admin.js               # Định tuyến API quản trị (CRUD nhân viên, quản lý dự án, thay đổi mật khẩu)
│   ├── laws.js                # Định tuyến API lấy và quản lý văn bản pháp lý (Lưu audit_logs & law_update_history)
│   └── qcvns.js               # Định tuyến API quản lý các mẫu đo đạc QCVN (Lưu query_logs & audit_logs)
├── utils/
│   └── audit.js               # Bộ ghi log bảo mật (Audit log) và lịch sử văn bản
├── public/                    # Thư mục chứa tài nguyên frontend tĩnh
│   ├── index.html             # Trang chủ chính chứa giao diện 4 trang (Văn bản, Phân loại, QCVN, Quản trị)
│   └── assets/
│       ├── css/
│       │   └── styles.css     # Style toàn trang, layout 3 cột, bảng biểu admin & print PDF
│       └── js/
│           ├── app.js         # Khởi tạo auth, quản lý giao diện đăng nhập & nạp động quy chuẩn
│           ├── data/
│           │   ├── classification-db.js # Database quy định quy mô ngành & mẫu hồ sơ
│           │   └── qcvn-db.js           # Database giới hạn thông số QCVN mới
│           ├── services/
│           │   └── classification-rules.js # Logic tính toán phân hạng công suất
│           ├── ui/
│           │   ├── classify-view.js     # Điều khiển nhập form, checklist & auto-save dự án
│           │   ├── laws-view.js         # Render danh sách văn bản và bộ lọc hiệu lực
│           │   ├── navigation.js        # Điều khiển chuyển tab trang, chặn tab riêng tư
│           │   ├── qcvn-view.js         # Điều khiển đối chiếu QCVN, parser dán text & in PDF
│           │   └── admin-view.js        # Điều khiển dashboard admin (nhân viên, dự án, quy chuẩn)
│           └── utils/
│               └── dom.js               # Helper thao tác DOM
├── .env                       # Khai báo biến môi trường (Database, Secret, Port...)
├── package.json               # Quản lý thư viện cài đặt
├── init-db.js                 # Script tự động tạo DB, tạo bảng (13 bảng) và seed dữ liệu mẫu
└── server.js                  # Điểm khởi chạy server backend (Express.js)
```

---

## ⚙ Hướng dẫn Cài đặt & Khởi chạy

### Yêu cầu hệ thống:
*   Máy đã cài đặt **Node.js** (Khuyên dùng v18+).
*   Đang chạy dịch vụ **PostgreSQL** (Port mặc định 5432).

### Bước 1: Cấu hình cơ sở dữ liệu
Mở file [.env](file:///.env) ở thư mục gốc của dự án và cập nhật thông số mật khẩu PostgreSQL của máy bạn ở biến `DB_PASSWORD`:
```ini
DB_USER=postgres
DB_PASSWORD=Mật_khẩu_Postgres_của_bạn
DB_HOST=localhost
DB_PORT=5432
DB_NAME=etc_legalhub
JWT_SECRET=etc_legalhub_jwt_secret_key
PORT=3000
```

### Bước 2: Cài đặt thư viện Node.js
Mở terminal tại thư mục dự án và chạy:
```bash
npm install
```

### Bước 3: Khởi tạo database và tạo dữ liệu mẫu
Chạy câu lệnh dưới đây để hệ thống tự động kết nối PostgreSQL tạo Database, 13 bảng dữ liệu quan hệ hoàn chỉnh, nạp dữ liệu tài khoản nhân viên băm mật khẩu, 40 văn bản pháp lý ban đầu, 17 quy chuẩn QCVN tĩnh, đồng thời tự động phân tích classification-db.js để nạp danh mục ngành nghề, ngưỡng phân loại, phụ lục căn cứ pháp lý và khởi tạo các quy tắc nghiệp vụ cho Rule Engine:
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

Ứng dụng phục vụ trong nội bộ công ty nên tài khoản được quản lý trực tiếp bởi Admin. Các tài khoản mẫu dưới đây được tạo sẵn tự động sau khi chạy lệnh khởi tạo database:

| Tên đăng nhập | Mật khẩu | Tên nhân viên | Vai trò |
| :--- | :--- | :--- | :--- |
| **admin** | `admin123` | Người quản trị | Quản trị viên |
| **staff1** | `staff123` | Nhân viên 1 | Chuyên viên tư vấn |
| **staff2** | `staff223` | Nhân viên 2 | Chuyên viên tư vấn |

---

## 📝 Hướng dẫn cập nhật và mở rộng dữ liệu

*   **Để chỉnh sửa hoặc thêm văn bản pháp lý:** Quản trị viên có thể thực hiện trực tiếp trên giao diện tab `⚙️ Quản trị` mục "Quy chuẩn pháp lý" (Thêm/Sửa/Xóa). Dữ liệu được lưu trữ trực tiếp vào bảng `laws` của cơ sở dữ liệu PostgreSQL. Mọi hành động thêm, sửa, xóa đều được hệ thống tự động lưu vết vào bảng `audit_logs` và `law_update_history`.
*   **Để cập nhật các QCVN đối chiếu (So sánh kết quả quan trắc):** Sửa đổi hoặc thêm cấu trúc chỉ tiêu trong tệp [public/assets/js/data/qcvn-db.js](file:///d:/Download/demo/public/assets/js/data/qcvn-db.js).
*   **Bảo trì quy định phân loại dự án:** Cập nhật bảng tra cứu ngành nghề `IND_DB` và danh mục tài liệu cần chuẩn bị `CHECKLIST` tại tệp [public/assets/js/data/classification-db.js](file:///d:/Download/demo/public/assets/js/data/classification-db.js).

---

## ⚠ Ghi chú sử dụng
Ứng dụng này phục vụ mục đích tra cứu nghiệp vụ, đối chiếu nhanh số liệu và lưu trữ hồ sơ công việc nội bộ của ETC. Khi lập hồ sơ chính thức gửi cơ quan chức năng, nhân viên cần đối chiếu trực tiếp lại với các văn bản pháp luật gốc có hiệu lực tại thời điểm nộp hồ sơ để đảm bảo tính pháp lý tuyệt đối.
