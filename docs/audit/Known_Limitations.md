# Danh mục Giới hạn Trung thực của Hệ thống (`Known_Limitations.md`)

> **Mục tiêu:** Ghi nhận đầy đủ, minh bạch mọi giới hạn hiện hữu dựa trên mã nguồn thực tế tại commit `69b39e3`, làm cơ sở để viết phần Hạn chế (Chương 3 & Chương 4) và trả lời hội đồng mà không tuyên bố quá mức.

---

## 1. Giới hạn về Xác minh Pháp lý & Độ phủ Nghiệp vụ
1. **Chưa có thẩm định độc lập của chuyên gia pháp lý cho toàn bộ 143 ngưỡng:** Trong `backend/fixtures/classification-catalog.js`, toàn bộ **39/39 ngành** đều còn ghi chú kiểm toán (`auditNote`) cần đối chiếu lại chi tiết từng dòng phụ lục gốc và **143/143 ngưỡng gốc** khởi tạo ở trạng thái `NEEDS_LEGAL_VERIFICATION`. Việc tài khoản `admin` bấm duyệt trong phần mềm chỉ là thao tác kiểm soát quyền kỹ thuật, không đồng nghĩa với thẩm định pháp lý của chuyên gia độc lập.
2. **Phạm vi ngành nghề mới dừng ở 39 nhóm ngành trọng tâm:** Các loại hình sản xuất đặc thù hoặc có điều kiện phân loại hỗn hợp ngoài 39 ngành này sẽ bị chặn an toàn (`UNKNOWN_INDUSTRY` / `NEEDS_REVIEW`) và cần chuyên viên tự tra cứu.
3. **Truy vết cấp bản ghi ngưỡng chưa đầy đủ tuyệt đối ở đầu ra JSON:** `evaluateClassification()` trả về `ref`, `ref_law_id`, `phuluc`, `appliedRuleVersion`, `appliedEffectiveFrom`, nhưng chưa gắn `threshold_id` (`nguong_phan_loai.ma`), `source_url` trực tiếp theo từng dòng ngưỡng và `evidence_hash` (`SHA-256` tài liệu nguồn).
4. **Quy chuẩn chuyển tiếp cũ chưa có đủ bảng giới hạn trong CSDL nền:** Hệ thống bảo vệ an toàn bằng cách chặn (`TRANSITION_TABLE_NOT_AVAILABLE`) chứ chưa nhập sẵn đầy đủ toàn bộ bảng giới hạn cũ (`QCVN 40:2011/BTNMT`, `QCVN 14:2008/BTNMT`); cần Quản trị viên nhập qua API `/api/admin/rules/qcvns/transitional/upsert` kèm chứng từ công bố.

## 2. Giới hạn về Dữ liệu Không gian GIS
1. **Độ phủ ranh giới đa giác (`Polygon`) mới là mẫu minh họa (`4/57` lớp):** Trong 57 lớp lưu ở `lop_ban_do` (25 vùng nhạy cảm, 32 KCN), mới chỉ có **4 khu vực** (`vqg_cat_tien`, `kdt_can_gio`, `kcn_hiep_phuoc`, `kcn_vsip_1`) có đa giác GeoJSON mẫu để PostGIS chạy `ST_Covers`. **53 lớp còn lại** mới lưu điểm tâm + bán kính tham khảo (`POSTGIS_CENTER_RADIUS_APPROXIMATION`) do chưa có dữ liệu địa chính số chính thức toàn quốc.
2. **Ngưỡng vùng đệm không phải ranh giới pháp lý đồng nhất:** Code `spatial-gis-service.js` (`l.306`) áp dụng vùng đệm `5 km` quanh đa giác và `zone.radiusKm + 5 km` với lớp điểm tâm; đường biên giới/bờ biển vẫn là mảng polyline ước lượng trong mã nguồn Node.js (`<= 50 km` / `<= 5 km`). Mọi cảnh báo GIS chỉ mang tính **hỗ trợ rà soát**, không thay thế trích lục ranh giới pháp lý của cơ quan có thẩm quyền.
3. **Biểu diễn dự án bằng một điểm đại diện (`Point`):** Dự án được lưu bằng 1 tọa độ tâm `(vi_do, kinh_do)` $\rightarrow$ `vi_tri_khong_gian geometry(Point, 4326)`. Với các dự án diện tích lớn (khu đô thị, cao tốc, KCN), việc chỉ kiểm tra 1 điểm có thể bỏ sót trường hợp một góc ranh giới dự án cắt vào vùng bảo tồn; cần mở rộng lưu đa giác khu đất dự án (`ST_Intersects`) ở giai đoạn sau.

## 3. Giới hạn về Thu thập Văn bản Pháp luật (Web Crawler)
1. **Phụ thuộc một nguồn duy nhất & không dùng băm nội dung `SHA-256`:** `backend/utils/crawler.js` chỉ quét `https://www.luatmoitruong.vn/sitemap-pages.xml` và bỏ qua nhanh dựa trên thẻ `<lastmod>` (`last_crawled_mod`). Nếu trang nguồn cập nhật nội dung mà không đổi `<lastmod>`, crawler sẽ bỏ qua.
2. **Nhận diện hết hiệu lực & tác động mang tính heuristic:** Dựa trên khớp cụm từ trong tiêu đề/meta/500 ký tự đầu và khớp chuỗi số hiệu/`QCVN`. Crawler **không** tự đọc hiểu điều khoản sửa đổi lồng nhau, bảng PDF quét ảnh hay điều khoản chuyển tiếp phức tạp; mọi đề xuất đều phải chờ con người rà soát.

## 4. Giới hạn về Kiểm thử, Đánh giá Hiệu quả & Tái lập
1. **Kiểm thử độ phủ 143 ngưỡng hiện tại chưa phải kiểm chứng pháp lý độc lập:** `exhaustive-catalog-coverage.test.js` suy đáp án từ `IND_DB` và mới kiểm tra 1 giá trị đại diện mỗi bậc (chưa đủ 3 điểm biên `X - ε`, `X`, `X + ε` cho mọi toán tử `>` / `>=`).
2. **Chưa có thử nghiệm đối chứng bấm giờ trên chuyên viên tư vấn tại doanh nghiệp:** Độ trễ API đo được (`13–15 ms`) chỉ phản ánh tốc độ xử lý máy chủ, không đại diện cho thời gian hoàn thành toàn bộ quy trình tư vấn (thu thập số liệu, nhập biểu mẫu, thẩm định văn bản gốc). Do đó chưa thể tuyên bố định lượng % tiết kiệm thời gian hay % giảm sai sót trong vận hành thực tế.
3. **Chế độ `sandbox-db-adapter.js` có thể gây hiểu nhầm nếu không ghi rõ `DB mode`:** Adapter sandbox ép trạng thái xác minh thành `VERIFIED` trong bộ nhớ để chạy demo/test khi không kết nối được PostgreSQL; tuyệt đối không dùng kết quả chạy chế độ `SANDBOX_SNAPSHOT` làm bằng chứng cho DB thật hay PostGIS thật.
4. **Tài liệu bằng chứng bị ẩn bởi `.gitignore`:** `docs/testing-evidence/` và `backend/backups/` bị gitignore nên người đánh giá trên GitHub công khai chưa thấy trực tiếp log chạy test và manifest nếu không tách bộ artifact công khai không chứa dữ liệu nhạy cảm.
