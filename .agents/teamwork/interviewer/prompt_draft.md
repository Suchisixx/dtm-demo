Kiểm tra và rà soát toàn diện tất cả các lỗi từ codebase, dữ liệu/crawler, quy trình nghiệp vụ đến hiển thị và tương tác giao diện người dùng bằng trình duyệt, lập kế hoạch chi tiết và báo cáo danh mục lỗi trước khi can thiệp mã nguồn.

Integrity mode: development

## Requirements

### R1. Rà soát lỗi toàn diện và lập kế hoạch khắc phục chi tiết
Rà soát toàn bộ dự án bao gồm mã nguồn backend/frontend (codebase), tính không đồng bộ giữa các phân hệ (UI - Engine - Database), cơ sở dữ liệu và crawler pháp lý, cũng như quy trình nghiệp vụ. Lập báo cáo chi tiết phân loại từng lỗi (nguyên nhân gốc rễ, vị trí tệp tin, mức độ nghiêm trọng) và kế hoạch khắc phục có thứ tự ưu tiên; không thực hiện sửa đổi mã nguồn ứng dụng trong đợt rà soát này.

### R2. Kiểm tra trực tiếp trên trình duyệt bằng subagent browser
Sử dụng subagent browser để truy cập trực tiếp ứng dụng đang chạy trên trình duyệt web, thực hiện các luồng thao tác người dùng chính (phân loại hồ sơ, đối chiếu QCVN, bản đồ, dashboard, crawler), rà soát mọi lỗi hiển thị (layout, vỡ giao diện, lỗi JavaScript console, phản hồi tương tác, trạng thái đồng bộ dữ liệu UI).

### R3. Kiểm chứng kỹ thuật và tính tuân thủ hệ thống
Đối chiếu hiện trạng toàn bộ hệ thống với bộ test suite hiện có (`npm test --prefix backend`), quy trình đóng gói frontend (`npm run build --prefix frontend`), và các nguyên tắc kỹ thuật cốt lõi (Single Database Source of Truth, Fail-Closed pháp lý, Server-Authoritative Evaluation) để chỉ ra toàn bộ các điểm sai lệch hoặc cảnh báo tồn đọng.

## Acceptance Criteria

### Báo cáo kiểm tra và Kế hoạch khắc phục
- [ ] Báo cáo kiểm tra chi tiết được lập đầy đủ, phân loại toàn bộ lỗi phát hiện được theo từng nhóm: Codebase/Engine, Giao diện/UI, Crawler/Database, Quy trình/Tích hợp không đồng bộ.
- [ ] Mỗi mục lỗi trong báo cáo có mô tả rõ ràng: tệp tin/vị trí liên quan, nguyên nhân gốc rễ, mức độ ảnh hưởng, và phương án khắc phục tương ứng.
- [ ] Kế hoạch khắc phục chi tiết (/plan) được tổ chức theo thứ tự ưu tiên rõ ràng, làm cơ sở chuẩn bị cho giai đoạn thử nghiệm, đánh giá và lập báo cáo đồ án.
- [ ] Không có tệp mã nguồn ứng dụng nào bị can thiệp sửa đổi trái với phạm vi đã xác định (chỉ tạo tài liệu báo cáo và kế hoạch kiểm tra).

### Kiểm tra giao diện qua Browser
- [ ] Subagent browser đã duyệt qua tất cả các trang giao diện chính của hệ thống và ghi nhận kết quả kiểm tra thực tế.
- [ ] Mọi lỗi giao diện (lỗi hiển thị, vỡ layout, lỗi console, lỗi tương tác, hiển thị dữ liệu không đồng bộ) được ghi chép chi tiết kèm bằng chứng trong báo cáo.

### Kiểm chứng kỹ thuật và Parity
- [ ] Kết quả thực thi test suite backend (`npm test --prefix backend`) và build frontend (`npm run build --prefix frontend`) được ghi nhận đầy đủ trong báo cáo, làm rõ các ca kiểm thử thất bại hoặc cảnh báo (nếu có).
- [ ] Đánh giá đầy đủ mức độ tuân thủ nguyên tắc Single Database Source of Truth, Fail-Closed pháp lý, và Server-Authoritative Evaluation trên toàn hệ thống.
