# Giải đáp chi tiết 7 câu hỏi của Giảng viên hướng dẫn (kèm căn cứ mã nguồn và kiểm thử)

> **Mục đích tài liệu:** Trả lời trực diện, có dẫn chứng cụ thể đến từng tệp mã nguồn, từng kịch bản kiểm thử và từng tệp log thực thi cho toàn bộ 7 câu hỏi phản biện và yêu cầu cốt lõi của Giảng viên hướng dẫn.  
> **Nguyên tắc trình bày:** Mọi con số đều khớp với mã nguồn tại commit `69b39e3` cùng các tệp kiểm thử bổ sung Giai đoạn 2; mọi giới hạn hiện hữu đều được nêu trung thực để bảo vệ vững chắc trước hội đồng.  
> **Hồ sơ tái lập và mã băm SHA-256:** `docs/audit/Reproducibility_Manifest.json`.

---

## Bảng đối chiếu nhanh: Câu hỏi ↔ Tệp kiểm thử ↔ Log chứng minh

| Câu hỏi | Tệp kiểm thử chính chứng minh | Kịch bản / Ca kiểm thử trọng tâm | Log & Bằng chứng đính kèm |
| :--- | :--- | :--- | :--- |
| **Câu 1:** Cơ sở khẳng định phân loại đúng? Ai xác nhận quy tắc pháp lý? | `backend/tests/classification-p0.test.js`<br>`backend/tests/boundary-and-temporal.test.js`<br>`backend/tests/postgres-integration.test.js` | `CL-07`, `CL-14 & CL-15`, `Independent Legal Golden Benchmark (18 cases)`, `PG Integration: Idempotent seed preserves VERIFIED rows` | `docs/audit/Legal_Golden_Cases.json`<br>`docs/audit/Legal_Golden_Cases.csv`<br>`docs/audit/logs/01_Unit_And_Coverage.log`<br>`docs/audit/logs/02_Postgres_Postgis.log` |
| **Câu 2:** Tốt hơn thủ công không? Tiết kiệm bao nhiêu thời gian, giảm bao nhiêu sai sót? | `backend/scripts/run-chapter3-evaluation.js`<br>`backend/tests/classification-p0.test.js`<br>`backend/tests/qcvn-p0.test.js` | Đo hiệu năng 8 API (`20` vòng/API = `160` lượt), `TC-BD-01..06`, `TC-SEC-04`, `QV-01/06/07/11/17`, `Q-09` | `docs/testing-evidence/chapter3-empirical-results.json`<br>`docs/audit/logs/01_Unit_And_Coverage.log` |
| **Câu 3:** Đóng góp mới của khóa luận so với bài thực tập? | `backend/tests/routes-and-parity.test.js`<br>`backend/tests/postgres-integration.test.js`<br>`backend/tests/compliance-reminder.test.js`<br>`tests/e2e-system.spec.js` | `Server-Authoritative Routes`, `PG Integration` (5 ca), `Compliance Reminder` (4 ca), `E2E-01..06` | `docs/audit/Project_Map.md`<br>`docs/audit/logs/02_Postgres_Postgis.log`<br>`docs/audit/logs/04_Playwright_E2e.log` |
| **Câu 4:** 39 ngành, 143 ngưỡng mà chỉ thử 10 tình huống thì chưa đủ | `backend/tests/exhaustive-catalog-coverage.test.js`<br>`backend/tests/boundary-and-temporal.test.js` | `Coverage 100%: 39 industries, 12 processStages, 143 thresholds`, `Coverage 100%: 35 QCVN tables`, `Boundary 3-Point (X - ε, X, X + ε)`, `Independent Legal Golden Benchmark (18 cases)` | `docs/audit/Legal_Golden_Cases.json`<br>`docs/audit/logs/01_Unit_And_Coverage.log` |
| **Câu 5:** Tại sao dùng bán kính từ tâm? Dùng đa giác được không? Làm sao xác định đúng vùng nhạy cảm? | `backend/tests/postgres-integration.test.js`<br>`backend/tests/spatial-postgis.test.js`<br>`backend/tests/classification-p0.test.js` | `PG Integration: PostGIS covers polygon interior and boundary, excludes exterior`, `DB GIS layers & Server Sensitive Verification lifecycle`, `Reject client spoofed sensitiveCriteriaVerified`, `TC-GIS-01`, `TC-SEC-04` | `docs/audit/logs/02_Postgres_Postgis.log`<br>`docs/audit/logs/01_Unit_And_Coverage.log`<br>`docs/testing-evidence/chapter3-empirical-results.json` |
| **Câu 6:** Khi văn bản sửa đổi hoặc chuyển tiếp, hệ thống xác định đúng quy định bằng cách nào? | `backend/tests/boundary-and-temporal.test.js`<br>`backend/tests/postgres-integration.test.js`<br>`backend/tests/qcvn-p0.test.js` | `Temporal Boundaries (5 Date Points & Overlapping Effective Windows)`, `PG Integration: Real DATE effective_from/effective_to`, `Q-09 Transition Guard`, `PG Integration: Crawler sync creates PENDING_REVIEW` | `docs/audit/logs/01_Unit_And_Coverage.log`<br>`docs/audit/logs/02_Postgres_Postgis.log` |
| **Câu 7:** Dữ liệu không gian hiện lưu bằng cấu trúc nào? Xử lý ở PostgreSQL hay Backend? | `backend/tests/postgres-integration.test.js`<br>`backend/tests/spatial-postgis.test.js`<br>`backend/scripts/run-chapter3-evaluation.js` | `PG Integration: PostGIS covers polygon... and syncs project points`, 4 test trong `spatial-postgis.test.js`, `TC-GIS-01`, `TC-GIS-02` | `docs/audit/logs/02_Postgres_Postgis.log`<br>`docs/audit/logs/01_Unit_And_Coverage.log` |

---

## Câu 1: Em dựa vào đâu để khẳng định hệ thống phân loại đúng? Ai xác nhận các quy tắc pháp lý?

### 1.1. Câu trả lời trực tiếp trước hội đồng
Em **không** khẳng định hệ thống tự động đúng tuyệt đối chỉ bằng cách tự viết mã nguồn, mà chứng minh tính đúng đắn qua **3 tầng bảo đảm độc lập**:
1. **Tầng căn cứ pháp lý và khả năng giải trình:** Toàn bộ 39 ngành nghề và 143 ngưỡng công suất được ánh xạ từ Luật Bảo vệ môi trường 2020 (Điều 25, 28, 30, 35, 39, 41, 49), Nghị định 08/2022/NĐ-CP và Văn bản hợp nhất 49/VBHN-BNNMT (Phụ lục II, III, IV). Mỗi kết quả trả về đều kèm lời giải trình có cấu trúc, điều khoản trích dẫn, phiên bản quy tắc và ngày hiệu lực đang áp dụng.
2. **Tầng kiểm soát xác minh và cơ chế đóng an toàn (Fail-Closed):** Hệ thống phân tách rõ **hai trạng thái quản trị độc lập**: trạng thái công bố (`da_cong_bo` so với `ban_nhap` / `cho_duyet` / `tu_choi`) và trạng thái xác minh pháp lý (`da_xac_minh` so với `can_xac_minh_phap_ly`). **Bất kỳ quy tắc nào chưa được người có thẩm quyền xác minh (`NEEDS_LEGAL_VERIFICATION`) đều bị hệ thống khóa cứng xuất kết luận chính thức** (`isOfficialConclusion = false`, `canExportOfficialReport = false`) và chỉ hiển thị ở mức tham khảo sơ bộ.
3. **Tầng kiểm chứng bằng bộ tình huống chuẩn độc lập:** Em đã tách riêng **18 tình huống chuẩn pháp lý** (`GLB-01` → `GLB-18`) trích xuất trực tiếp từ văn bản gốc vào bộ dữ liệu `docs/audit/Legal_Golden_Cases.json` / `.csv` để đối chiếu độc lập với đầu ra của động cơ suy diễn.

**Về câu hỏi "Ai xác nhận các quy tắc pháp lý?":**
- Về mặt quy trình trong hệ thống, **Quản trị viên pháp lý** (vai trò `admin`, được kiểm soát phân quyền RBAC và ghi vết đầy đủ `verified_by`, `verified_at` vào bảng nhật ký kiểm toán `nhat_ky_kiem_toan`) là người duy nhất được phép phê duyệt quy tắc từ trạng thái `cho_duyet` / `can_xac_minh_phap_ly` lên `da_xac_minh`. Máy tính và bộ thu thập văn bản **không bao giờ** tự ghi đè hay tự phê duyệt quy tắc.
- Em cũng trình bày trung thực giới hạn hiện tại: trong danh mục khởi tạo nền (`classification-catalog.js`), toàn bộ **143/143 ngưỡng** đều cố ý khởi tạo ở trạng thái `NEEDS_LEGAL_VERIFICATION` kèm ghi chú kiểm toán (`auditNote`), và **18 ca chuẩn pháp lý** trong `Legal_Golden_Cases.csv` hiện đang ở trạng thái `PENDING_EXPERT_SIGN_OFF` — tức đã được đối chiếu chéo theo văn bản quy phạm nhưng **chưa có chữ ký thẩm định độc lập của chuyên viên tư vấn môi trường ngoài nhóm phát triển**. Đây chính là lý do cơ chế khóa cứng Fail-Closed là đóng góp thiết kế cốt lõi về độ an toàn pháp lý.

### 1.2. Căn cứ mã nguồn và CSDL
- **Kho quy tắc gốc & trạng thái bảo thủ:** `backend/fixtures/classification-catalog.js` (39/39 ngành có `auditNote`, 143/143 ngưỡng mặc định `verificationStatus: 'NEEDS_LEGAL_VERIFICATION'`).
- **Động cơ suy diễn & cổng khóa xuất báo cáo:** `backend/services/classification-service.js` (`evaluateClassification`, trả về `isOfficialConclusion`, `canExportOfficialReport`, `conclusionStatus`, `classificationRationale`, `appliedRuleVersion`, `appliedEffectiveFrom`).
- **Lọc bản ghi công bố & không ghi đè dữ liệu đã xác minh:** `backend/services/rule-repository.js` (`seedClassificationCatalog` không chạy `TRUNCATE`, giữ nguyên bản ghi `VERIFIED`; `loadClassificationCatalog` loại bỏ toàn bộ `DRAFT`, `PENDING_REVIEW`, `EXTRACTED`, `RAW`, `REJECTED`).
- **Chính sách chặn cứng khi mất CSDL:** `backend/services/runtime-policy.js` (`ALLOW_STATIC_FALLBACK=false` ném lỗi `503 RuleDataUnavailableError`).
- **Truy vết người duyệt:** Bảng `nhat_ky_kiem_toan` và các cột `trang_thai_xac_minh`, `nguoi_xac_minh`, `thoi_diem_xac_minh` trong `nganh_nghe`, `nguong_phan_loai`, `quy_chuan_qcvn`.

### 1.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Dòng | Tên kịch bản kiểm thử | Điều chứng minh được | Kết quả & Log |
| :--- | :---: | :--- | :--- | :--- |
| `backend/tests/classification-p0.test.js` | `L137` | `Seed phan loai an toan: khong TRUNCATE, seed du 39 nganh + 6 processRules va giu nguyen ban ghi VERIFIED` | Khởi tạo/nạp lại dữ liệu không ghi đè các quy tắc đã được xác minh | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/classification-p0.test.js` | `L231` | `CL-07: Rule NEEDS_LEGAL_VERIFICATION khong duoc tra ket luan chinh thuc, chi co preliminary & bi khoa export` | Quy tắc chưa xác minh pháp lý bị khóa `isOfficialConclusion = false` và `canExportOfficialReport = false` | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/classification-p0.test.js` | `L261` | `CL-14 & CL-15: Sua rule trong DB doi ket qua ngay; rule DRAFT / PENDING_REVIEW bi loai khoi runtime` | Động cơ chỉ đọc quy tắc hợp lệ từ CSDL; quy tắc nháp/chờ duyệt tuyệt đối không ảnh hưởng kết luận | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/classification-p0.test.js` | `L334` | `DB mat ket noi / offline fallback -> FALLBACK_UNVERIFIED va ep NEEDS_REVIEW` | Khi dùng fallback dự phòng, hệ thống hạ ngay về `NEEDS_REVIEW`, cấm trả kết luận chính thức | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/boundary-and-temporal.test.js` | `L230` | `Runtime Policy Strict Fail-Closed: ALLOW_STATIC_FALLBACK=false throws 503 RuleDataUnavailableError on DB failure` | Ở chế độ nghiêm ngặt, mất CSDL sẽ trả mã `503` thay vì tự suy diễn từ file tĩnh | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/boundary-and-temporal.test.js` | `L259` | `Independent Legal Golden Benchmark (18 cases from docs/audit/Legal_Golden_Cases.json)` | 18/18 ca chuẩn pháp lý độc lập khớp nhóm dự án, hồ sơ, thẩm quyền, lời giải trình và cổng khóa | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/postgres-integration.test.js` | `L220` | `PG Integration: Idempotent seed preserves VERIFIED rows & filters out DRAFT/PENDING_REVIEW/REJECTED` | Kiểm chứng trực tiếp trên **PostgreSQL 16.8 thật** (`etc_legalhub_test`) | **PASS** (`02_Postgres_Postgis.log`) |

---

## Câu 2: Phần mềm có tốt hơn cách xử lý thủ công không? Tiết kiệm bao nhiêu thời gian, giảm bao nhiêu sai sót?

### 2.1. Câu trả lời trực tiếp trước hội đồng
Em trả lời theo **hai khía cạnh rạch ròi** để đảm bảo trung thực khoa học:
1. **Những lợi thế đã được chứng minh bằng số liệu kỹ thuật và kiểm thử tự động:**
   - **Về tốc độ xử lý bước tính toán và đối chiếu quy tắc:** Đo kiểm thực nghiệm trên máy chủ thật (`160` lượt gọi trên `8` API trọng tâm, `20` vòng/API) cho thấy độ trễ trung bình bước suy diễn phân loại hồ sơ (`POST /api/classification/evaluate`) là **`14,79 ms`** (`P95 = 16,44 ms`), đối chiếu bảng chỉ tiêu QCVN (`POST /api/qcvns/evaluate`) là **`13,10 ms`** (`P95 = 16,64 ms`), và phân tích không gian GIS (`POST /api/classification/spatial-check`) là **`13,25 ms`** (`P95 = 16,05 ms`).
   - **Về loại trừ 6 nhóm sai sót cấu trúc hay gặp khi tra cứu thủ công bằng Excel/PDF:** Hệ thống loại bỏ hoàn toàn các lỗi thường gặp gồm: (1) bỏ sót phân nhánh công đoạn sản xuất (`MISSING_PROCESS_STAGE`), (2) nhầm toán tử biên `>` và `>=`, (3) nhầm thẩm quyền `cap_huyen` với `cap_xa` quanh mốc `01/07/2025`, (4) tự kết luận mẫu quan trắc "Đạt" khi thiếu chỉ tiêu bắt buộc (`INCOMPLETE`) hoặc lệch chu kỳ lấy mẫu `CO 8h`/`24h` (`PERIOD_MISMATCH`), (5) áp nhầm bảng giới hạn QCVN 2025 cho cơ sở chuyển tiếp QCVN 2011/2008 (`TRANSITION_TABLE_NOT_AVAILABLE`), và (6) tin vào dữ liệu vùng nhạy cảm tự khai báo từ trình duyệt mà chưa có xác minh máy chủ (`PENDING_SERVER_VERIFICATION`).
2. **Giới hạn trung thực về tỷ lệ % tiết kiệm thời gian và % giảm sai sót ngoài thực tế:**
   - **Em chưa thực hiện khảo sát bấm giờ đối chứng (user study)** trên nhóm chuyên viên tư vấn môi trường tại doanh nghiệp để đo tổng thời gian trọn gói từ lúc đọc hồ sơ chủ đầu tư, nhập liệu đến lúc phát hành báo cáo cuối.
   - Do đó, em **không đưa ra con số % ước đoán không có mẫu khảo sát** (như "tiết kiệm 90% thời gian" hay "giảm 95% sai sót"). Các con số độ trễ `13–15 ms` chỉ đại diện cho **bước tra cứu và tính toán quy tắc trên máy chủ** sau khi đã có dữ liệu đầu vào hợp lệ; còn việc đo hiệu quả vận hành toàn quy trình trên tập mẫu hồ sơ thực tế được đặt rõ là hướng đánh giá tiếp theo sau khi triển khai thí điểm.

### 2.2. Căn cứ mã nguồn và CSDL
- **Kịch bản đo kiểm hiệu năng 8 API:** `backend/scripts/run-chapter3-evaluation.js` (chạy 20 vòng lặp liên tiếp mỗi API trên `LIVE_POSTGRES`, ghi nhận `Min`, `Avg`, `P95`, `Max`).
- **Các cổng chặn sai sót nghiệp vụ:** `backend/services/classification-service.js`, `backend/services/classification-rule-helpers.js`, `backend/services/qcvn-service.js`.
- **Tài liệu đối chiếu trung thực:** `docs/audit/Known_Limitations.md` (Mục 4.2) và `docs/audit/Report_Gap_Matrix.md` (Phát hiện `F-03`).

### 2.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Kịch bản kiểm thử | Kết quả đo được / Hành vi chặn lỗi | Nguồn bằng chứng |
| :--- | :--- | :--- | :--- |
| `backend/scripts/run-chapter3-evaluation.js` | `performanceBenchmarks` (`POST /api/classification/evaluate`) | `Min = 4,34 ms`, `Avg = 14,79 ms`, `P95 = 16,44 ms`, `Max = 24,14 ms` (`20` vòng, HTTP `200`) | `docs/testing-evidence/chapter3-empirical-results.json` (`L324–332`) |
| `backend/scripts/run-chapter3-evaluation.js` | `performanceBenchmarks` (`POST /api/qcvns/evaluate`) | `Min = 2,58 ms`, `Avg = 13,10 ms`, `P95 = 16,64 ms`, `Max = 18,50 ms` (`20` vòng, HTTP `200`) | `docs/testing-evidence/chapter3-empirical-results.json` (`L334–342`) |
| `backend/scripts/run-chapter3-evaluation.js` | `performanceBenchmarks` (`POST /api/classification/spatial-check`) | `Min = 3,51 ms`, `Avg = 13,25 ms`, `P95 = 16,05 ms`, `Max = 16,26 ms` (`20` vòng, HTTP `200`) | `docs/testing-evidence/chapter3-empirical-results.json` (`L344–352`) |
| `backend/scripts/run-chapter3-evaluation.js` | `TC-BD-01` → `TC-BD-06` (`6` kịch bản biên & Fail-Closed) | Chặn đúng 6/6 lỗi đầu vào: `UNKNOWN_INDUSTRY`, `INVALID_CAPACITY` (âm & chuỗi), `INVALID_PROCESS_STAGE`, `MISSING_RECEIVING_SOURCE`, `TRANSITION_TABLE_NOT_AVAILABLE` | `docs/testing-evidence/chapter3-empirical-results.json` (`L418–460`) |
| `backend/tests/qcvn-p0.test.js` | `QV-01 & QV-06 & QV-07` (`L77`), `Q-09` (`L129`), `QV-11 & QV-17 & Q-10` (`L237`) | Chặn thiếu lưu lượng, chưa xác nhận nguồn tiếp nhận, thiếu chỉ tiêu bắt buộc (`INCOMPLETE`), lệch chu kỳ `CO 8h`/`24h` (`PERIOD_MISMATCH`), và thiếu bảng QCVN chuyển tiếp | `docs/audit/logs/01_Unit_And_Coverage.log` |
| `backend/tests/classification-p0.test.js` | `CL-01` (`L172`), `CL-02 & CL-03` (`L193`), `Cong suat am/NaN` (`L217`) | Loại trừ lỗi rơi nhầm về Nhóm IV hoặc bỏ qua công đoạn sản xuất | `docs/audit/logs/01_Unit_And_Coverage.log` |

---

## Câu 3: Đóng góp mới của khóa luận so với bài thực tập đã làm trước đó là gì?

### 3.1. Câu trả lời trực tiếp trước hội đồng
Bài thực tập trước đây chỉ dừng ở mức **nguyên mẫu giao diện tra cứu tĩnh chạy phía trình duyệt** (quy tắc pháp lý và bảng QCVN viết cứng trong tệp JavaScript, không có CSDL quản trị quy tắc động, chưa có không gian GIS/PostGIS và chưa có cơ chế chặn an toàn pháp lý). Khóa luận tốt nghiệp đã tái kiến trúc toàn bộ sang một **hệ thống hỗ trợ quyết định pháp lý môi trường đầy đủ 3 tầng (Vue 3 – Express – PostgreSQL/PostGIS)** với **6 đóng góp mới có thể kiểm chứng trực tiếp trong mã nguồn**:

1. **Chuyển nguồn sự thật duy nhất (Single Source of Truth) về PostgreSQL 16.8 (19 bảng vật lý chuẩn tiếng Việt):** Tách toàn bộ 39 ngành nghề, 143 ngưỡng công suất, 35 bảng QCVN, 140 văn bản luật, 257 dòng phụ lục và 57 lớp bản đồ GIS sang quản trị tập trung trong CSDL có ràng buộc khóa ngoại, chỉ mục và nhật ký kiểm toán — không còn viết cứng luật suy diễn ở giao diện.
2. **Thiết kế kiến trúc tính toán có thẩm quyền tại máy chủ (Server-Authoritative) và cổng đóng an toàn (Fail-Closed):** Mọi API lưu hồ sơ (`POST /api/projects`, `POST /api/qcvns/samples`) đều bắt buộc tính lại kết luận trên máy chủ từ CSDL; khóa cứng xuất báo cáo khi quy tắc chưa xác minh, thiếu công đoạn, thiếu lưu lượng/nguồn tiếp nhận, thiếu chỉ tiêu hoặc lệch chu kỳ lấy mẫu.
3. **Phiên bản hóa quy tắc theo mốc hiệu lực thời gian (`effective_from` / `effective_to`) và quản lý chuyển tiếp:** Hỗ trợ đánh giá theo ngày hồ sơ (`evaluationDate`), tự động phân biệt thẩm quyền lịch sử `cap_huyen` (trước `01/07/2025`) với `cap_xa` (từ `01/07/2025` theo mô hình chính quyền 2 cấp) và chặn áp nhầm bảng QCVN 2025 cho cơ sở chuyển tiếp 2011/2008.
4. **Tích hợp mở rộng không gian PostGIS 3.6.2 trên PostgreSQL 16.8 và quy trình xác minh vùng nhạy cảm phía máy chủ:** Bổ sung cột hình học `geometry(..., 4326)`, chỉ mục `GiST`, trigger đồng bộ tọa độ/đa giác tự động, truy vấn `ST_Covers` cho 4 lớp đa giác mẫu, đồng thời chống giả mạo cờ vùng nhạy cảm từ trình duyệt (*Client Spoofing*).
5. **Quy trình đồng bộ văn bản bán tự động có kiểm duyệt con người (Human-in-the-loop) và chuẩn pháp lý động:** Tích hợp tiến trình thu thập Sitemap (`backend/utils/crawler.js` + `crawler-sync-service.js`) tạo đề xuất ở trạng thái `cho_duyet` (`PENDING_REVIEW`) chờ quản trị viên phê duyệt; giao diện hiển thị động văn bản hợp nhất hiện hành (`49/VBHN-BNNMT`, `55/VBHN-BNNMT`) trực tiếp từ bảng `luat`.
6. **Bổ sung phân hệ nhắc hạn nghĩa vụ tuân thủ định kỳ (`nghia_vu_tuan_thu`) và bộ kiểm thử tự động đa tầng:** Gồm 46 test đơn vị/hợp đồng/biên 3 điểm/5 mốc thời gian/18 ca chuẩn, 5 test tích hợp PostgreSQL + PostGIS thật, 32 kịch bản thực nghiệm máy chủ và 6 kịch bản Playwright E2E trên Chromium.

### 3.2. Căn cứ mã nguồn và CSDL
- **Thiết kế 19 bảng tiếng Việt:** `docs/etc_legalhub_schema.sql`, `backend/services/vietnamese-schema.js`.
- **Server-Authoritative & Parity:** `backend/routes/projects.js`, `backend/routes/qcvns.js`, `backend/routes/laws.js` (`GET /api/laws/active-basis`).
- **Nhắc hạn tuân thủ:** `backend/services/compliance-reminder-service.js`, `backend/routes/compliance.js`.
- **Crawler & duyệt quy tắc:** `backend/utils/crawler.js`, `backend/services/crawler-sync-service.js`, `backend/routes/admin-rules.js`.

### 3.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Số ca | Phạm vi chứng minh đóng góp mới | Log kết quả |
| :--- | :---: | :--- | :--- |
| `backend/tests/routes-and-parity.test.js` | `10` | Server-Authoritative `POST /api/projects` & `POST /api/qcvns/samples`, đồng bộ 1-1 UI–Engine–DB, ánh xạ 19 bảng tiếng Việt, RBAC `audit-logs`, API chuẩn pháp lý động `49/VBHN-BNNMT` & `55/VBHN-BNNMT` | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/compliance-reminder.test.js` | `4` | Phân loại 4 trạng thái (`qua_han`, `sap_den_han`, `trong_han`, `da_hoan_thanh`), tự sinh kỳ hạn mới (`hang_quy`, `sau_thang`, `hang_nam`), CRUD & RBAC | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/postgres-integration.test.js` | `5` | Chạy trực tiếp trên **PostgreSQL 16.8 + PostGIS 3.6.2 thật**: seed an toàn, so sánh `DATE` thật, `ST_Covers` đa giác, vòng đời xác minh nhạy cảm, crawler `PENDING_REVIEW` + admin duyệt + QCVN chuyển tiếp | **PASS 5/5** (`02_Postgres_Postgis.log`) |
| `tests/e2e-system.spec.js` | `6` | `E2E-01` → `E2E-06` chạy trình duyệt Chromium thật xuyên suốt 6 phân hệ từ Thư viện pháp lý, chặn đăng nhập, Phân loại, QCVN, Dashboard/Bản đồ GIS đến Quản trị & Truy vết | **PASS 6/6** (`04_Playwright_E2e.log`) |

---

## Câu 4: Có 39 ngành nghề, 143 ngưỡng phân loại nhưng chỉ thử 10 tình huống thì chưa đủ để chứng minh tính chính xác và độ tin cậy

### 4.1. Câu trả lời trực tiếp trước hội đồng
Em hoàn toàn tiếp thu nhận xét rất xác đáng này của thầy/cô. `10` tình huống phân loại (`TC-PL-01` → `TC-PL-10`) trong kịch bản thực nghiệm Chương 3 ban đầu chỉ là tập minh họa điển hình, đúng là **chưa đủ** để chứng minh cho toàn bộ `39` ngành nghề và `143` ngưỡng. Vì vậy, em đã mở rộng kiểm chứng thành **3 lớp bổ sung rõ ràng, không đánh tráo khái niệm**:

1. **Lớp 1 — Kiểm thử độ phủ 100% cấu trúc danh mục (`exhaustive-catalog-coverage.test.js`):** Quét toàn bộ **39/39 ngành nghề**, **12/12 công đoạn sản xuất (`processStage`)** của 6 ngành có phân nhánh, **143/143 ngưỡng phân loại** và **35/35 bảng giới hạn QCVN** (`PASS`, `FAIL`, `INCOMPLETE`, `MISSING_RECEIVING_SOURCE`). *Em nêu rõ bản chất:* lớp này chứng minh **tính nhất quán và không bỏ sót nhánh (consistency & 100% coverage)** giữa động cơ suy diễn với danh mục dữ liệu, chứ không tự coi là kiểm chứng pháp lý độc lập.
2. **Lớp 2 — Kiểm thử điểm biên 3 mốc `X - ε`, `X`, `X + ε` (`boundary-and-temporal.test.js`):** Khắc phục hạn chế chỉ lấy 1 điểm mẫu mỗi bậc bằng cách tự động kiểm tra **3 điểm kề biên (`X - ε`, đúng `X`, và `X + ε`)** trên toàn bộ các bậc có ngưỡng `min > 0` trong `143` ngưỡng, đồng thời kiểm tra trực tiếp sự khác biệt giữa toán tử **`>`** (tại `X` rơi xuống bậc dưới) và **`>=`** (tại `X` khớp bậc hiện tại).
3. **Lớp 3 — Bộ 18 ca chuẩn pháp lý độc lập (`docs/audit/Legal_Golden_Cases.json` & `.csv`):** Mở rộng từ `7` ca nội bộ lên **18 tình huống chuẩn pháp lý độc lập (`GLB-01` → `GLB-18`)** tách khỏi mã nguồn, mỗi ca có đủ 14 trường gồm văn bản nguồn, điều khoản/phụ lục cụ thể, ngày hiệu lực, kết quả kỳ vọng và cột `review_status: "PENDING_EXPERT_SIGN_OFF"` sẵn sàng cho chuyên gia pháp lý ký xác nhận.

### 4.2. Căn cứ mã nguồn và dữ liệu kiểm chứng
- **Danh mục 39 ngành / 12 công đoạn / 143 ngưỡng:** `backend/fixtures/classification-catalog.js`.
- **Danh mục 35 bảng QCVN:** `frontend/src/data/qcvn-db.js` (seed vào bảng `quy_chuan_qcvn`).
- **Hàm so sánh biên toán tử `>` vs `>=`:** `backend/services/classification-rule-helpers.js` (`matchesThreshold`, `findIndustryTierDetailed`).
- **Bộ 18 ca chuẩn độc lập (JSON & CSV):** `docs/audit/Legal_Golden_Cases.json`, `docs/audit/Legal_Golden_Cases.csv`.

### 4.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Dòng | Tên kịch bản kiểm thử | Phạm vi kiểm tra thực tế | Kết quả & Log |
| :--- | :---: | :--- | :--- | :--- |
| `backend/tests/exhaustive-catalog-coverage.test.js` | `L45` | `Coverage 100%: All 39 industries, 12 processStages, and 143 classification thresholds evaluate accurately at boundaries` | Quét `39/39` ngành, `12/12` công đoạn, `143/143` ngưỡng, kiểm chặn thiếu `processStage` trên cả 6 ngành phân nhánh | **PASS** (`45,46 ms`, `01_Unit_And_Coverage.log`) |
| `backend/tests/exhaustive-catalog-coverage.test.js` | `L109` | `Coverage 100%: All 35 QCVN tables pass/fail/incomplete/fail-closed evaluations consistently` | Quét `35/35` bảng QCVN với 4 trạng thái (`PASS`, `FAIL`, `INCOMPLETE`, `MISSING_RECEIVING_SOURCE`) | **PASS** (`12,26 ms`, `01_Unit_And_Coverage.log`) |
| `backend/tests/exhaustive-catalog-coverage.test.js` | `L190` | `Golden Legal Benchmark & Temporal Versioning: Cross-checked against Luật BVMT 2020 & VBHN 49/2026` | 7 ca đối chiếu nhanh điều khoản Luật BVMT 2020 & VBHN 49/2026 | **PASS** (`1,04 ms`, `01_Unit_And_Coverage.log`) |
| `backend/tests/boundary-and-temporal.test.js` | `L23` | `Boundary 3-Point (X - ε, X, X + ε): Operator > vs >= and all 143 catalog thresholds` | Kiểm tra trực tiếp `>` vs `>=` tại `49.999 / 50 / 50.001` và `99.99 / 100 / 100.01`, sau đó quét 3 điểm biên cho toàn bộ `143` ngưỡng (`>= 90` ngưỡng có `min > 0`) | **PASS** (`4,59 ms`, `01_Unit_And_Coverage.log`) |
| `backend/tests/boundary-and-temporal.test.js` | `L259` | `Independent Legal Golden Benchmark (18 cases from docs/audit/Legal_Golden_Cases.json)` | Đọc file benchmark độc lập gồm `18` tình huống (`GLB-01` → `GLB-18`) phủ Nhóm I–IV, 6 ngành phân nhánh, nâng nhóm vùng nhạy cảm, chặn giả mạo client và thẩm quyền trước/sau `2025-07-01` | **PASS** (`5,47 ms`, `01_Unit_And_Coverage.log`) |

---

## Câu 5: Tại sao sử dụng bán kính từ tâm vùng, nếu dùng ranh giới đa giác được không? Làm sao xác định chính xác dự án thuộc vùng nhạy cảm?

### 5.1. Câu trả lời trực tiếp trước hội đồng
1. **Có dùng được ranh giới đa giác không?** — **Hoàn toàn được và hệ thống ĐÃ triển khai sẵn cơ chế xử lý đa giác (`Polygon` / `MultiPolygon`) trên PostGIS 3.6.2.** Khi một lớp dữ liệu trong bảng `lop_ban_do` có trường hình học đa giác hợp lệ (`ST_IsValid`), PostgreSQL + PostGIS sẽ chạy trực tiếp phép kiểm tra điểm nằm trong/trên biên đa giác (`ST_Covers`) và tính khoảng cách địa lý tới mép ranh giới (`ST_Distance(...::geography) / 1000.0`).
2. **Tại sao vẫn còn các lớp dùng bán kính từ tâm vùng?** — Vì lý do **độ phủ dữ liệu địa chính số mở ở quy mô toàn quốc**. Trong `57` lớp bản đồ hiện có (`25` vùng nhạy cảm và `32` KCN), em đã nạp đa giác mẫu GeoJSON cho **4 khu vực trọng điểm** (`vqg_cat_tien`, `kdt_can_gio`, `kcn_hiep_phuoc`, `kcn_vsip_1`) để chứng minh năng lực chạy PostGIS đa giác (`method = POSTGIS_POLYGON`). **53 lớp còn lại** hiện chưa có bộ ranh giới đa giác pháp lý chính thức dạng số hóa công khai, nên hệ thống dùng **điểm tâm + bán kính tham khảo** (`POSTGIS_CENTER_RADIUS_APPROXIMATION`), gắn nhãn rõ đây là ước lượng cảnh báo chứ không phải ranh giới pháp lý. Kiến trúc bảng `lop_ban_do` cho phép nạp bổ sung GeoJSON đa giác cho 53 lớp còn lại bất kỳ lúc nào mà **không phải sửa một dòng mã nguồn nào** nhờ trigger tự động đồng bộ sang cột `hinh_hoc_khong_gian`.
3. **Làm sao xác định chính xác dự án thuộc vùng nhạy cảm mà không bị sai lệch do GIS ước lượng hoặc bị người dùng gian lận?** — Hệ thống tách làm **2 bước bắt buộc**:
   - **Bước 1 — Cảnh báo hỗ trợ từ GIS:** Phân tích tọa độ trả về các cảnh báo (vùng lõi hoặc vùng đệm `5 km` quanh đa giác / `radiusKm + 5 km` quanh lớp điểm tâm; gần biên giới `<= 50 km`, gần bờ biển `<= 5 km`). Kết quả GIS **chỉ tạo cảnh báo gợi ý**, **tuyệt đối không tự ý nâng dự án lên Nhóm I**.
   - **Bước 2 — Xác minh pháp lý phía máy chủ (Server-Side Verification):** Các cờ nhạy cảm do người dùng tự tích trên trình duyệt (`sensitiveCriteriaVerified` từ client) **bị máy chủ bỏ qua hoàn toàn** để chống giả mạo (*Client Spoofing*), đồng thời tạo bản ghi trạng thái `cho_xac_minh` (`PENDING_VERIFICATION`) trong bảng `xac_minh_yeu_to_nhay_cam_du_an` kèm trường lưu chứng từ tham chiếu (`evidence_ref`, ví dụ trích lục tọa độ, quyết định chuyển mục đích sử dụng đất lúa/rừng). **Chỉ khi người có thẩm quyền thẩm định chứng từ và chuyển bản ghi trên máy chủ sang `da_xac_minh` (`VERIFIED`)**, động cơ phân loại mới nâng dự án lên **Nhóm I (ĐTM – cấp Bộ)** theo Điều 25 và Điều 28 Luật BVMT 2020. Nếu chủ đầu tư sửa tọa độ/thông số dự án sau khi đã duyệt, hệ thống tự động đặt lại trạng thái về `cho_xac_minh` để thẩm định lại.

### 5.2. Căn cứ mã nguồn và CSDL
- **Truy vấn PostGIS đa giác `ST_Covers` & `ST_Distance`:** `backend/services/project-verification-repository.js` (`L471–508`, hàm `evaluateSpatialLayers`).
- **Quy tắc vùng đệm `5 km` / `radiusKm + 5 km` & gắn nhãn `POSTGIS_POLYGON` vs `POSTGIS_CENTER_RADIUS_APPROXIMATION`:** `backend/services/spatial-gis-service.js` (`L302–344`, `L369–390`).
- **Bảng xác minh vùng nhạy cảm phía máy chủ & luồng duyệt/reset:** `backend/services/project-verification-repository.js` (`L51–322`, bảng `xac_minh_yeu_to_nhay_cam_du_an` / `project_sensitive_verifications`).
- **Chống giả mạo cờ client trong động cơ phân loại:** `backend/services/classification-service.js` (bỏ qua `sensitiveCriteriaVerified` từ client, chỉ đọc `serverSensitiveVerification.verification_status === 'VERIFIED'`).

### 5.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Dòng | Tên kịch bản kiểm thử | Điều chứng minh được | Kết quả & Log |
| :--- | :---: | :--- | :--- | :--- |
| `backend/tests/postgres-integration.test.js` | `L296` | `PG Integration: PostGIS covers polygon interior and boundary, excludes exterior, and syncs project points` | PostGIS 3.6.2 thật chạy `ST_Covers = true` cho điểm trong lõi & trên biên đa giác (`distance_km = 0`), `ST_Covers = false` cho điểm ngoài đa giác (`distance_km > 0`) | **PASS** (`42,12 ms`, `02_Postgres_Postgis.log`) |
| `backend/tests/postgres-integration.test.js` | `L343` | `PG Integration: DB GIS layers & Server Sensitive Verification lifecycle (escalate + reset on edit)` | Lưu khai báo vùng nhạy cảm ở `PENDING_VERIFICATION` → chưa nâng Nhóm I; sau khi máy chủ duyệt `VERIFIED` → nâng Nhóm I; khi sửa dự án → tự reset về chờ xác minh | **PASS** (`14,78 ms`, `02_Postgres_Postgis.log`) |
| `backend/tests/classification-p0.test.js` | `L424` | `Phase 2 Item 6: Reject client spoofed sensitiveCriteriaVerified & escalate only on server VERIFIED` | Gửi cờ giả mạo từ client vẫn bị giữ ở `PENDING_SERVER_VERIFICATION` và `isOfficialConclusion = false` | **PASS** (`10,65 ms`, `01_Unit_And_Coverage.log`) |
| `backend/tests/spatial-postgis.test.js` | `L30`, `L72` | `PostGIS result marks polygon-covered point and uses DB spatial query` & `invalid polygon geometry is not treated as a verified PostGIS boundary` | Kiểm tra gán đúng `POSTGIS_POLYGON` và từ chối đa giác lỗi hình học (`ST_IsValid = false`) | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/scripts/run-chapter3-evaluation.js` | `TC-GIS-01`, `TC-SEC-04` | Tọa độ lõi Cần Giờ `(10.5214, 106.8856)` & Chống giả mạo cờ nhạy cảm | `TC-GIS-01` trả `method=POSTGIS_POLYGON, dist=0 km, inCore=true`; `TC-SEC-04` giữ `nhom=Nhóm II, PENDING_SERVER_VERIFICATION` | **PASS** (`chapter3-empirical-results.json`, `L264–268`, `L397–401`) |

---

## Câu 6: Khi văn bản sửa đổi hoặc có quy định chuyển tiếp, hệ thống xác định đúng quy định đang áp dụng bằng cách nào?

### 6.1. Câu trả lời trực tiếp trước hội đồng
Hệ thống giải quyết bài toán thay đổi pháp luật và giai đoạn chuyển tiếp bằng **4 cơ chế phối hợp từ tầng thu thập đến tầng suy diễn**:

1. **Quản lý cửa sổ hiệu lực theo ngày (`effective_from`, `effective_to`) trên từng quy tắc:** Mỗi dòng trong bảng `nguong_phan_loai` (và `phien_ban_quy_tac`) đều mang mốc ngày bắt đầu hiệu lực và ngày hết hiệu lực. Khi đánh giá một dự án tại ngày `evaluationDate`, động cơ chỉ lọc các quy tắc thỏa mãn `effective_from <= evaluationDate <= effective_to` (hoặc `effective_to IS NULL`).
   - Nếu `evaluationDate` nằm ngoài mọi cửa sổ hiệu lực (ví dụ trước ngày luật có hiệu lực hoặc sau khi quy tắc hết hạn mà chưa có bản thay thế) → hệ thống **chặn an toàn** với mã `NO_ACTIVE_RULE_FOR_DATE` (`NEEDS_REVIEW`), tuyệt đối không tự suy đoán.
   - Nếu có **hai cửa sổ hiệu lực chồng lấn** cùng áp dụng tại một ngày → động cơ có thứ tự ưu tiên xác định (`effective_from` mới hơn được ưu tiên áp dụng).
   - Với mốc tổ chức lại chính quyền địa phương 2 cấp **`01/07/2025`**, hồ sơ có `evaluationDate < 2025-07-01` tự động ánh xạ thẩm quyền lịch sử `cap_huyen` (UBND cấp huyện), còn từ `2025-07-01` trở đi áp dụng `cap_xa` (UBND cấp xã).
2. **Cổng bảo vệ giai đoạn chuyển tiếp cho Quy chuẩn QCVN (`QCVN 40:2025` vs `40:2011`, `QCVN 14:2025` vs `14:2008`):** Khi đánh giá cơ sở cũ đang vận hành trước mốc chuyển tiếp (`operatingBefore2025 = true` / lộ trình đến hết `31/12/2031`), hệ thống kiểm tra xem CSDL đã có **bảng giới hạn chuyển tiếp riêng** của quy chuẩn cũ (`40:2011` / `14:2008`) ở trạng thái hợp lệ hay chưa. Nếu chưa có, hệ thống trả về `NEEDS_REVIEW` (`TRANSITION_TABLE_NOT_AVAILABLE`) — **cấm hoàn toàn việc đánh tráo sang bảng giới hạn năm 2025**. Quản trị viên có thể nạp bổ sung bảng chuyển tiếp qua giao diện/API quản trị (`upsertTransitionalQcvn`) kèm tài liệu căn cứ.
3. **Đồng bộ văn bản sửa đổi theo mô hình kiểm duyệt con người (Human-in-the-loop):** Tiến trình thu thập văn bản (`backend/utils/crawler.js`) định kỳ quét Sitemap `luatmoitruong.vn`, so sánh thẻ `<lastmod>` với `last_crawled_mod` để chỉ tải các trang mới hoặc có cập nhật (em lưu ý trung thực: hiện dùng `<lastmod>` của Sitemap XML, **không** dùng băm nội dung SHA-256). Sau khi lưu lịch sử vào `lich_su_cap_nhat_van_ban`, bộ dò ảnh hưởng (`crawler-sync-service.js`) tự động ánh xạ sang bảng `anh_huong_quy_tac_van_ban` và sinh đề xuất quy tắc ở trạng thái **`cho_duyet` (`PENDING_REVIEW`)** trong `de_xuat_quy_tac`. Quy tắc mới **chỉ có hiệu lực thực thi sau khi Quản trị viên rà soát văn bản gốc và bấm phê duyệt**.
4. **Chuẩn pháp lý hiển thị động từ CSDL:** API `GET /api/laws/active-basis` tổng hợp trực tiếp các văn bản `con_hieu_luc` (ưu tiên `loai = 'vbhn'` như `49/VBHN-BNNMT`, `55/VBHN-BNNMT`) để cập nhật giao diện mà không phải sửa mã nguồn.

### 6.2. Căn cứ mã nguồn và CSDL
- **Lọc ngày hiệu lực & xử lý chồng lấn:** `backend/services/classification-rule-helpers.js`, `backend/services/classification-service.js` (`evaluationDate`, `historicalTq`, `NO_ACTIVE_RULE_FOR_DATE`).
- **Cổng chuyển tiếp QCVN & API nạp bảng cũ:** `backend/services/qcvn-service.js` (`selectQcvnForProjectWithDb`, `TRANSITION_TABLE_NOT_AVAILABLE`), `backend/services/rule-repository.js` (`upsertTransitionalQcvn`).
- **Crawler & dò ảnh hưởng quy tắc:** `backend/utils/crawler.js` (`last_crawled_mod`), `backend/services/crawler-sync-service.js` (`detectImpactedRules`, `extractRuleCandidatesFromLaw`).
- **Chuẩn pháp lý động:** `backend/routes/laws.js` (`GET /api/laws/active-basis`).

### 6.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Dòng | Tên kịch bản kiểm thử | Điều chứng minh được | Kết quả & Log |
| :--- | :---: | :--- | :--- | :--- |
| `backend/tests/boundary-and-temporal.test.js` | `L119` | `Temporal Boundaries (5 Date Points & Overlapping Effective Windows)` | Kiểm đủ **5 mốc biên thời gian**: trước `effective_from` (`2022-01-09` → `NO_ACTIVE_RULE_FOR_DATE`), đúng `2022-01-10` (`cap_huyen`), đúng `2025-06-30` (`cap_huyen`), đúng `2025-07-01` (`cap_xa`), đúng `2027-12-31` & sau hạn `2028-01-01` (`NO_ACTIVE_RULE_FOR_DATE`) + cửa sổ chồng lấn ưu tiên `effective_from` mới hơn | **PASS** (`36,24 ms`, `01_Unit_And_Coverage.log`) |
| `backend/tests/postgres-integration.test.js` | `L262` | `PG Integration: Real DATE effective_from/effective_to comparison & historical authority` | Kiểm chứng so sánh cột kiểu `DATE` thật trên **PostgreSQL 16.8** (`2025-05-01` → `cap_huyen`, `2026-08-01` → `cap_xa`, `2020-01-01` → `NO_ACTIVE_RULE_FOR_DATE`) | **PASS** (`24,81 ms`, `02_Postgres_Postgis.log`) |
| `backend/tests/qcvn-p0.test.js` | `L129`, `L325` | `Q-09 Transition Guard` & `Phase 2 Items 7 & 8: Server QCVN selection by industry, transitional gate & Admin transitional upsert` | Cơ sở cũ thiếu bảng `40:2011` / `14:2008` bị chặn `TRANSITION_TABLE_NOT_AVAILABLE`; sau khi Admin nạp bảng chuyển tiếp hợp lệ mới cho phép đối chiếu | **PASS** (`01_Unit_And_Coverage.log`) |
| `backend/tests/postgres-integration.test.js` | `L414` | `PG Integration: Crawler sync creates PENDING_REVIEW candidates, Admin approves & QCVN transitional upsert` | Chứng minh trọn vòng đời trên PostgreSQL thật: Crawler chỉ tạo đề xuất `PENDING_REVIEW` (không tự động áp dụng), chỉ có hiệu lực sau khi Admin duyệt + nạp QCVN chuyển tiếp | **PASS** (`59,21 ms`, `02_Postgres_Postgis.log`) |
| `backend/tests/routes-and-parity.test.js` | `L1148` | `GET /api/laws/active-basis: dynamically synthesizes 49/VBHN-BNNMT and 55/VBHN-BNNMT from database` | Chuỗi căn cứ pháp lý hiển thị trên giao diện được tổng hợp động từ bảng `luat` | **PASS** (`31,54 ms`, `01_Unit_And_Coverage.log`) |

---

## Câu 7: Chương 2 thiết kế PostgreSQL + PostGIS nhưng Chương 4 lại nói chưa dùng PostGIS. Vậy hiện tại dữ liệu không gian lưu bằng cấu trúc nào? Phép kiểm tra vị trí xử lý ở PostgreSQL hay Backend?

### 7.1. Câu trả lời trực tiếp trước hội đồng
Em xin cảm ơn thầy/cô đã chỉ ra sự **không nhất quán giữa Chương 2 và Chương 4** trong bản báo cáo nháp trước đó. Nguyên nhân là ở giai đoạn đầu hệ thống chưa cài extension PostGIS nên Chương 4 ghi theo trạng thái cũ, sau đó em đã **cài đặt và kích hoạt thành công PostGIS 3.6.2 trên PostgreSQL 16.8** cho cả CSDL vận hành (`etc_legalhub`) và CSDL kiểm thử (`etc_legalhub_test`), đồng thời cập nhật đồng bộ lại Chương 1–4 trong tệp phụ lục sửa đổi luận văn (`Phu_Luc_Sua_Doi_Luan_Van.docx`).

Về **cấu trúc lưu trữ không gian thực tế hiện nay** và **phân công xử lý giữa PostgreSQL/PostGIS với Backend Node.js**:

#### A. Cấu trúc lưu trữ dữ liệu không gian trong PostgreSQL 16.8 + PostGIS 3.6.2
1. **Bảng `du_an` (hồ sơ dự án):**
   - Lưu song song tọa độ số thập phân `vi_do` (`DOUBLE PRECISION`), `kinh_do` (`DOUBLE PRECISION`) để hiển thị nhanh và cột hình học PostGIS **`vi_tri_khong_gian`** kiểu `geometry(Point, 4326)`, đánh chỉ mục không gian **`GiST`** (`idx_du_an_geom`).
   - Trigger **`legalhub_project_geometry_sync`** tự động chuyển `(kinh_do, vi_do)` sang `ST_SetSRID(ST_MakePoint(kinh_do, vi_do), 4326)` mỗi khi `INSERT` hoặc `UPDATE`.
2. **Bảng `lop_ban_do` (57 lớp: 25 vùng nhạy cảm + 32 KCN):**
   - Lưu tọa độ tâm `vi_do`, `kinh_do`, bán kính tham khảo `ban_kinh_km`, dữ liệu GeoJSON gốc `hinh_hoc` (`JSONB`) và cột hình học PostGIS **`hinh_hoc_khong_gian`** kiểu `geometry(Geometry, 4326)` kèm chỉ mục **`GiST`** (`idx_lop_ban_do_geom`).
   - Trigger **`legalhub_layer_geometry_sync`** tự động phân tích: nếu `hinh_hoc` chứa đa giác `Polygon`/`MultiPolygon` hợp lệ (hiện có **4 lớp mẫu**: VQG Cát Tiên, Khu Dự trữ Sinh quyển Cần Giờ, KCN Hiệp Phước, KCN VSIP 1) thì sinh hình học đa giác qua `ST_GeomFromGeoJSON`; nếu không (53 lớp còn lại) thì sinh điểm tâm `Point(4326)`.

#### B. Phân công rõ ràng phép kiểm tra vị trí giữa PostgreSQL/PostGIS và Backend Node.js
| Phép kiểm tra vị trí | Nơi thực thi thực tế | Cơ chế kỹ thuật cụ thể |
| :--- | :--- | :--- |
| **1. Kiểm tra điểm nằm trong / trên biên đa giác 4 lớp mẫu** | **PostgreSQL + PostGIS 3.6.2** | Chạy câu SQL trong `evaluateSpatialLayers()`: `ST_IsValid(hinh_hoc_khong_gian) AND ST_Covers(hinh_hoc_khong_gian, ST_SetSRID(ST_MakePoint($2, $1), 4326))` (`method = POSTGIS_POLYGON`). |
| **2. Tính khoảng cách địa lý từ dự án tới 57 lớp vùng nhạy cảm & KCN** | **PostgreSQL + PostGIS 3.6.2** | Chạy trực tiếp trên kiểu `geography` của PostGIS: `ST_Distance(hinh_hoc_khong_gian::geography, point::geography) / 1000.0` (tới mép đa giác với 4 lớp đa giác, tới điểm tâm với 53 lớp điểm tâm). |
| **3. Khoảng cách tới đường biên giới đất liền (`<= 50 km`) và đường bờ biển (`<= 5 km`)** | **Backend Node.js** | Tính bằng hàm `minDistanceToPolyline()` trên 2 mảng polyline ước lượng trong `spatial-gis-service.js` (chỉ mang tính cảnh báo tham khảo). |
| **4. Tổng hợp cờ cảnh báo, ngưỡng vùng đệm (`5 km` / `radiusKm + 5 km`), tìm KCN gần nhất (`<= 15 km`) và dự phòng khi mất PostGIS** | **Backend Node.js** | `analyzeSpatialContext()` nhận kết quả từ PostGIS để lập danh sách `spatialAlerts`. Nếu môi trường không có PostGIS hoặc truy vấn SQL lỗi, Backend mới hạ về công thức Haversine dự phòng và gắn nhãn tường minh `HAVERSINE_APPROXIMATION` / `FALLBACK_UNVERIFIED`. |

### 7.2. Căn cứ mã nguồn và CSDL
- **Kích hoạt extension, tạo cột `geometry(..., 4326)`, chỉ mục `GiST` & trigger đồng bộ:** `backend/services/project-verification-repository.js` (`L327–469`, `ensureGisSchema`) và `backend/scripts/enable-postgis.js`.
- **Truy vấn PostGIS `ST_Covers` & `ST_Distance(...::geography)`:** `backend/services/project-verification-repository.js` (`L471–508`, `evaluateSpatialLayers`).
- **Tầng điều phối & tính polyline biên giới/bờ biển ở Backend:** `backend/services/spatial-gis-service.js` (`L282–425`).

### 7.3. Căn cứ kiểm thử chi tiết
| Tệp kiểm thử | Dòng | Tên kịch bản kiểm thử | Điều chứng minh được | Kết quả & Log |
| :--- | :---: | :--- | :--- | :--- |
| `backend/tests/postgres-integration.test.js` | `L296` | `PG Integration: PostGIS covers polygon interior and boundary, excludes exterior, and syncs project points` | Xác nhận trên **PostgreSQL 16.8 + PostGIS 3.6.2 thật**: trigger tự điền `du_an.vi_tri_khong_gian`, `ST_Covers` trả `true` cho điểm trong và trên biên đa giác, `false` cho điểm ngoài đa giác | **PASS** (`42,12 ms`, `02_Postgres_Postgis.log`) |
| `backend/tests/spatial-postgis.test.js` | `L30`, `L45`, `L52`, `L72` | 4 kịch bản kiểm thử lớp PostGIS & fallback | Xác nhận truy vấn SQL chứa `ST_Covers`/`ST_Distance`, khi lỗi truy vấn chuyển sang `FALLBACK_UNVERIFIED`, khi thiếu PostGIS vẫn giữ schema tương thích và không nhận vơ đã xác minh không gian, từ chối polygon không hợp lệ | **PASS 4/4** (`01_Unit_And_Coverage.log`) |
| `backend/scripts/run-chapter3-evaluation.js` | `TC-GIS-01`, `TC-GIS-02` | Kiểm tra điểm lõi Cần Giờ & KCN Tân Thuận trên `LIVE_POSTGRES` | `postgisStatus.enabled = true`, `postgis 3.6.2`; `TC-GIS-01` chạy qua `POSTGIS_POLYGON` (`dist = 0 km`, `inCore = true`); `TC-GIS-02` trả `gisSource = DATABASE` kèm khoảng cách biên giới/bờ biển | **PASS** (`chapter3-empirical-results.json`, `L11–19`, `L264–275`) |

---

## Mục 8: Tổng hợp chứng minh 4 trụ cột theo định hướng của Giảng viên

Giảng viên nhấn mạnh: *"Em cần phải chứng minh: phương pháp đề xuất đưa ra kết quả đúng, có thể giải thích, được kiểm chứng độc lập và cải thiện so với phương pháp hiện có"*. Bảng sau tổng hợp đúng 4 trụ cột để chốt bài trình bày:

| Trụ cột yêu cầu | Cách hệ thống chứng minh | Tệp bằng chứng cụ thể | Điểm còn hạn chế (nêu trung thực) |
| :--- | :--- | :--- | :--- |
| **1. Kết quả đúng & an toàn pháp lý** | Ánh xạ 39 ngành / 143 ngưỡng / 35 QCVN vào PostgreSQL; kiểm thử biên 3 điểm (`X - ε`, `X`, `X + ε`) & 5 mốc thời gian; cơ chế Fail-Closed khóa xuất báo cáo nếu chưa xác minh hoặc thiếu dữ liệu | `backend/tests/classification-p0.test.js`, `qcvn-p0.test.js`, `boundary-and-temporal.test.js`, `postgres-integration.test.js` | 143 ngưỡng nền giữ trạng thái `NEEDS_LEGAL_VERIFICATION` cho đến khi có người thẩm định; bảng QCVN cũ 2011/2008 cần nhập bổ sung khi phát sinh cơ sở chuyển tiếp |
| **2. Có thể giải thích (Explainable)** | Mọi kết luận trả về `classificationRationale` (tóm tắt diễn giải từng bước), `ref` (điều khoản/phụ lục), `appliedRuleVersion`, `appliedEffectiveFrom`, `ruleSource`, và tỷ lệ vượt từng chỉ tiêu QCVN kèm nhật ký kiểm toán `nhat_ky_kiem_toan` | `backend/services/classification-service.js`, `qcvn-service.js`, `routes-and-parity.test.js` (`GET /api/admin/audit-logs`) | Chưa xuất mã định danh `threshold_id` và `source_url` trực tiếp theo từng dòng ngưỡng trong payload JSON |
| **3. Kiểm chứng độc lập** | Tách 18 tình huống chuẩn pháp lý trích từ văn bản gốc sang `Legal_Golden_Cases.json`/`.csv` tách rời mã nguồn và đối chiếu tự động trong `boundary-and-temporal.test.js` (18/18 khớp); chạy kiểm thử tích hợp trên PostgreSQL 16.8 + PostGIS 3.6.2 thật và Playwright E2E trên Chromium | `docs/audit/Legal_Golden_Cases.json`, `docs/audit/Legal_Golden_Cases.csv`, `docs/audit/Reproducibility_Manifest.json`, 4 tệp log trong `docs/audit/logs/` | 18 ca chuẩn đang ở trạng thái `PENDING_EXPERT_SIGN_OFF` (chờ chữ ký rà soát độc lập của chuyên viên tư vấn môi trường ngoài nhóm) |
| **4. Cải thiện so với phương pháp hiện có** | So với bài thực tập tĩnh: nâng cấp lên 19 bảng PostgreSQL + PostGIS 3.6.2, Server-Authoritative, Fail-Closed, phiên bản hóa theo ngày, nhắc hạn tuân thủ. So với tra cứu thủ công: tính toán quy tắc trong `13,10–15,40 ms`, loại trừ 6 nhóm sai sót cấu trúc và truy vết toàn bộ lịch sử | `docs/testing-evidence/chapter3-empirical-results.json`, `docs/audit/Project_Map.md`, `tests/e2e-system.spec.js` | Chưa có thử nghiệm bấm giờ trên chuyên viên tư vấn tại doanh nghiệp nên không tuyên bố % tiết kiệm thời gian trọn gói |

---

## Mục 9: 4 lệnh tái lập toàn bộ kiểm chứng trực tiếp trước hội đồng

Khi cần chứng minh trực tiếp trên máy tính trước hội đồng bảo vệ, chạy lần lượt 4 lệnh sau tại thư mục `d:\ĐATN\demo`:

1. **Bộ kiểm thử đơn vị, độ phủ 100%, biên 3 điểm, 5 mốc thời gian và 18 ca chuẩn pháp lý (46/46 PASS):**
   ```powershell
   npm test --prefix backend
   ```
   *(Đối chiếu log chuẩn: `docs/audit/logs/01_Unit_And_Coverage.log`)*

2. **Bộ kiểm thử tích hợp PostgreSQL 16.8 + PostGIS 3.6.2 thật trên CSDL test độc lập `etc_legalhub_test` (5/5 PASS):**
   ```powershell
   npm run test:pg --prefix backend
   ```
   *(Đối chiếu log chuẩn: `docs/audit/logs/02_Postgres_Postgis.log`)*

3. **Kiểm tra đóng gói giao diện Vue 3 + Vite sản xuất (Build sạch, 47 modules):**
   ```powershell
   npm run build --prefix frontend
   ```
   *(Đối chiếu log chuẩn: `docs/audit/logs/03_Frontend_Build.log`)*

4. **Bộ kiểm thử hệ thống tự động đầu-cuối trên trình duyệt Chromium (6/6 PASS):**
   ```powershell
   npx playwright test
   ```
   *(Đối chiếu log chuẩn: `docs/audit/logs/04_Playwright_E2e.log`)*
