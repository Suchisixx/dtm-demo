## 2026-11-13T05:49:44Z

Kiểm tra và rà soát toàn diện tất cả các lỗi từ codebase, dữ liệu/crawler, quy trình nghiệp vụ đến hiển thị và tương tác giao diện người dùng bằng trình duyệt, lập kế hoạch chi tiết và báo cáo danh mục lỗi trước khi can thiệp mã nguồn.

Integrity mode: development

## Requirements

### R1. Rà soát lỗi toàn diện và lập kế hoạch khắc phục chi tiết
Rà soát toàn bộ dự án bao gồm mã nguồn backend/frontend (codebase), tính không đồng bộ giữa các phân hệ (UI - Engine - Database), cơ sở dữ liệu và crawler pháp lý, cũng như quy trình nghiệp vụ. Lập báo cáo chi tiết phân loại từng lỗi (nguyên nhân gốc rễ, vị trí tệp tin, mức độ nghiêm trọng) và kế hoạch khắc phục có thứ tự ưu tiên; không thực hiện sửa đổi mã nguồn ứng dụng trong đợt rà soát này.

### R2. Kiểm tra trực tiếp trên trình duyệt bằng subagent browser
Sử dụng subagent browser để truy cập trực tiếp ứng dụng đang chạy trên trình duyệt web, thực hiện các luồng thao tác người dùng chính (phân loại hồ sơ, đối chiếu QCVN, bản đồ, dashboard, crawler), rà soát mọi lỗi hiển thị (layout, vỡ giao diện, lỗi JavaScript console, phản hồi tương tác, trạng thái đồng bộ dữ liệu UI).

### R3. Kiểm chứng kỹ thuật và tính tuân thủ hệ thống
Đối chiếu hiện trạng toàn bộ hệ thống với bộ test suite hiện có (`npm test --prefix backend`), quy trình đóng gói frontend (`npm run build --prefix frontend`), và các nguyên tắc kỹ thuật cốt lõi (Single Database Source of Truth, Fail-Closed pháp lý, Server-Authoritative Evaluation) để chỉ ra toàn bộ các điểm sai lệch hoặc cảnh báo tồn đọng.
