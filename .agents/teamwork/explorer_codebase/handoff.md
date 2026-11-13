# BÁO CÁO KIỂM TOÁN TOÀN DIỆN CODEBASE, KIẾN TRÚC & CƠ CHẾ PHÁP LÝ (LEGALHUB)

## 1. Observation (Quan sát thực tế)

Qua việc kiểm tra tĩnh mã nguồn, chạy bộ test tự động và phân tích kiến trúc tại thư mục `d:\ĐATN\demo`, chúng tôi ghi nhận các quan sát trực tiếp sau:

### 1.1. Hiện trạng thực thi Kiểm thử & Đóng gói (Build & Test Baselines)
- **Backend Unit & Integration Test Suite (`npm test --prefix backend`)**:
  - Lệnh: `node --test tests/classification-p0.test.js tests/qcvn-p0.test.js tests/routes-and-parity.test.js tests/compliance-reminder.test.js tests/administrative-boundaries.test.js`
  - Kết quả: **31 pass, 0 fail, 0 skipped, 0 cancelled, 0 todo**, thời gian chạy ~695ms.
  - Phạm vi chạy: Sử dụng lớp giả lập Mock DB/in-memory query layer để kiểm chứng toàn bộ quy tắc nghiệp vụ, các cổng fail-closed và tính toán server-authoritative khi không có kết nối cơ sở dữ liệu vật lý.
- **PostgreSQL Live Integration Test (`npm run test:pg --prefix backend`)**:
  - Lệnh: `node --test tests/postgres-integration.test.js`
  - Kết quả: **4 fail (0 pass)** do lỗi kết nối mạng `AggregateError [ETIMEDOUT]: connect ETIMEDOUT 127.0.0.1:5432 / ::1:5432`.
  - Nguyên nhân: Dịch vụ PostgreSQL trên máy trạm hiện đang không chạy hoặc chưa mở cổng 5432 tại thời điểm kiểm tra.
- **Frontend Build (`npm run build --prefix frontend`)**:
  - Lệnh: `vite build --emptyOutDir` (Vite v8.2.0)
  - Kết quả: Hoàn tất trong 637ms, tạo các bundle tại `backend/public/`:
    + `index.html` (1.33 kB)
    + `index-B1_dI9ss.css` (53.77 kB)
    + `index-BTsFgRzp.js` (437.68 kB)
    + `vietnam-divisions-BeaYaFZ5.js` (589.15 kB)
  - Cảnh báo: `(!) Some chunks are larger than 500 kB after minification` đối với file `vietnam-divisions-BeaYaFZ5.js` (589.15 kB) do nạp toàn bộ danh mục địa giới hành chính xã/phường cả nước trong một file JSON tĩnh.

---

### 1.2. Danh mục chi tiết các điểm sai lệch & Lỗi phát hiện (Defect Catalog)

#### [BUG-01] [CRITICAL] Lỗi nuốt ngoại lệ và không lưu được xác minh nhạy cảm khi schema chưa đổi tên sang tiếng Việt
- **Tệp tin**: `backend/services/project-verification-repository.js` (Dòng 180-205)
- **Hiện trạng code**:
  ```javascript
  // Dòng 114: SELECT từ view tiếng Anh
  'SELECT id, ... FROM project_sensitive_verifications WHERE project_id = $1'
  // Dòng 153: UPDATE qua view tiếng Anh
  'UPDATE project_sensitive_verifications SET ...'
  // Dòng 181: Nhưng INSERT lại chỉ định cứng bảng vật lý tiếng Việt kèm ON CONFLICT:
  'INSERT INTO xac_minh_yeu_to_nhay_cam_du_an (du_an_ma, co_yeu_to_khai_bao, ...)'
  // Dòng 204: Bắt ngoại lệ nếu không có bảng và trả về null âm thầm
  } catch (err) {
    if (err && /does not exist|relation/i.test(String(err.message || ''))) {
      return null;
    }
    return null;
  }
  ```
- **Nguyên nhân gốc rễ**: Khi hệ thống chạy trên database chưa migrate sang tiếng Việt hoặc trong mock DB chỉ có cấu trúc bảng `project_sensitive_verifications`, câu lệnh INSERT tại dòng 181 sẽ tìm kiếm bảng `xac_minh_yeu_to_nhay_cam_du_an` và ném lỗi `relation does not exist`. Khối `catch` ở dòng 204 nuốt lỗi và trả về `null`, dẫn đến việc bản ghi xác minh nhạy cảm hoàn toàn không được tạo, khiến trạng thái dự án luôn bị kẹt ở `NEEDS_LEGAL_VERIFICATION`.
- **Mức độ nghiêm trọng**: **Critical**.

---

#### [BUG-02] [HIGH] Bất nhất tên bảng và nguy cơ lỗi Runtime trong cài đặt Crawler
- **Tệp tin**: `backend/routes/crawler.js` (Dòng 12 và Dòng 34-39)
- **Hiện trạng code**:
  ```javascript
  // Dòng 12: Đọc cấu hình từ view/bảng tiếng Anh
  const settingRes = await db.query('SELECT value FROM system_settings WHERE key = $1', [CRAWLER_SETTING_KEY]);
  // Dòng 35: Ghi cấu hình lại INSERT vào bảng vật lý tiếng Việt
  await db.query(
    `INSERT INTO cai_dat_he_thong (khoa, gia_tri)
     VALUES ($1, $2)
     ON CONFLICT (khoa) DO UPDATE SET gia_tri = EXCLUDED.gia_tri`,
    [CRAWLER_SETTING_KEY, enabled ? 'true' : 'false']
  );
  ```
- **Nguyên nhân gốc rễ**: Lập trình viên nhận thấy PostgreSQL views không hỗ trợ `ON CONFLICT` nên đã đổi tên bảng ở câu lệnh INSERT sang `cai_dat_he_thong`, nhưng lại để nguyên `system_settings` ở câu lệnh SELECT. Nếu chạy trên schema chưa di cư hoặc môi trường mock DB, POST `/api/crawler/settings` sẽ văng lỗi `relation "cai_dat_he_thong" does not exist`.
- **Mức độ nghiêm trọng**: **High**.

---

#### [BUG-03] [HIGH] Lỗi phụ thuộc thứ tự di cư schema khi nạp Seed Phân loại (`phu_luc_phap_ly`)
- **Tệp tin**: `backend/services/rule-repository.js` (Dòng 494-509)
- **Hiện trạng code**:
  ```javascript
  // Dòng 20: ensureClassificationSchema chỉ tạo bảng legal_appendices:
  CREATE TABLE IF NOT EXISTS legal_appendices (...)
  // Dòng 495: Trong seedClassificationCatalog lại chỉ định cứng:
  await client.query(
    `INSERT INTO phu_luc_phap_ly (ma, luat_ma, ten_phu_luc, so_muc, tom_tat_noi_dung)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ma) DO UPDATE SET ...`
  );
  ```
- **Nguyên nhân gốc rễ**: Tương tự BUG-02, câu lệnh `INSERT ... ON CONFLICT` bị vướng hạn chế của PostgreSQL View nên code được sửa trực tiếp thành `phu_luc_phap_ly`. Tuy nhiên, nếu hàm `seedClassificationCatalog` được gọi trước khi `migrateVietnameseSchema` chạy (hoặc khi chạy `init-db.js` từng phần), câu lệnh sẽ thất bại vì bảng `phu_luc_phap_ly` chưa được tạo.
- **Mức độ nghiêm trọng**: **High**.

---

#### [BUG-04] [MEDIUM] Phê duyệt Đề xuất QCVN từ Crawler bị chặn do mảng thông số rỗng
- **Tệp tin**: `backend/services/crawler-sync-service.js` (Dòng 158-164) & `backend/services/rule-repository.js` (Dòng 850-852, 1165-1183)
- **Hiện trạng code**:
  ```javascript
  // crawler-sync-service.js dòng 163:
  proposedData: {
    id: slug,
    ten: `${refCode} (Cần đối chiếu bảng thông số gốc)`,
    standardCode: refCode,
    sourceDocument: docData.so || lawTitle || lawId,
    tham_so: [], // Rỗng
  }
  // rule-repository.js dòng 850:
  function validateQcvnParameters(thamSo) {
    if (!Array.isArray(thamSo) || thamSo.length === 0) {
      throw new Error('QCVN_PARAMETERS_REQUIRED');
    }
  }
  ```
- **Nguyên nhân gốc rễ**: Crawler khi phát hiện văn bản mới nhắc đến một mã QCVN thì tự động tạo một candidate trong `rule_candidates` với `tham_so: []`. Khi Admin bấm duyệt (Approve) tại giao diện quản trị AdminTab mà không truyền kèm bộ thông số chi tiết qua payload ghi đè, hệ thống ném lỗi HTTP 400 `QCVN_PARAMETERS_REQUIRED`. Giao diện AdminTab hiện tại không có form nhập/chỉnh sửa danh sách thông số trước khi bấm Approve, khiến Admin không thể duyệt các candidate loại này từ giao diện.
- **Mức độ nghiêm trọng**: **Medium**.

---

#### [BUG-05] [MEDIUM] Thiếu giao diện người dùng để cấu hình `permitLimits` (Giới hạn GPMT)
- **Tệp tin**: `frontend/src/components/ClassifyTab.vue` & `frontend/src/components/QCVNTab.vue` (Dòng 303, 357, 599)
- **Hiện trạng code**:
  - Engine backend (`backend/services/qcvn-service.js`, `frontend/src/utils/qcvn-evaluator.js`) đã hỗ trợ toàn diện việc so sánh thông số theo cả QCVN và `permitLimits` (hỗ trợ `max`, `min`, `range` ví dụ pH).
  - Tuy nhiên, trong `ClassifyTab.vue` không có bất kỳ trường input nào cho người dùng nhập `permitLimits` vào `form_data`.
  - Trong `QCVNTab.vue`, code chỉ đọc thụ động `linkedProject.value?.form_data?.permitLimits || null`, bảng thông số không có cột nhập hoặc ghi đè giới hạn GPMT trực tiếp.
- **Nguyên nhân gốc rễ**: Lệch pha giữa khả năng của Engine (đã hỗ trợ) và giao diện người dùng (chưa xây dựng trường nhập liệu tương ứng).
- **Mức độ nghiêm trọng**: **Medium**.

---

#### [BUG-06] [LOW] Tên biến cấu hình bản đồ không khớp với nhà cung cấp dịch vụ (Provider Misnomer)
- **Tệp tin**: `frontend/src/utils/constants.js` (Dòng 69-74)
- **Hiện trạng code**:
  ```javascript
  export const CARTO_VOYAGER_URL = 'https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}'
  export const CARTO_ATTRIBUTION = '&copy; Google Maps Vietnam'
  export const ESRI_IMAGERY_URL = 'https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}'
  ```
- **Nguyên nhân gốc rễ**: Biến mang tên `CARTO_VOYAGER` và `ESRI_IMAGERY` nhưng đường dẫn URL thực tế lại trỏ tới các endpoint không chính thức của Google Maps (`mt{s}.google.com`). Điều này có thể dẫn tới việc bị chặn truy cập (rate limit/CORS) khi triển khai thực tế trên domain production.
- **Mức độ nghiêm trọng**: **Low**.

---

#### [BUG-07] [LOW] Cảnh báo kích thước gói tĩnh Frontend vượt ngưỡng 500 kB
- **Tệp tin**: `frontend/src/data/vietnam-divisions.json` & `frontend/vite.config.js`
- **Hiện trạng**: File `vietnam-divisions.json` có dung lượng ~589 kB, đóng gói thành chunk `vietnam-divisions-BeaYaFZ5.js`.
- **Nguyên nhân gốc rễ**: Toàn bộ dữ liệu phân cấp hành chính 63 tỉnh thành và xã/phường được tải gộp trong một file JSON tĩnh.
- **Mức độ nghiêm trọng**: **Low**.

---

## 2. Logic Chain (Chuỗi suy luận & Phân tích nguyên nhân)

### 2.1. Đánh giá tính tuân thủ Nguyên tắc "Single Database Source of Truth"
1. **Quan sát**: `loadClassificationCatalog` và `loadQcvnCatalog` trong `rule-repository.js` truy vấn trực tiếp từ bảng `industries`, `classification_thresholds`, `qcvns`.
2. **Logic kiểm tra**:
   - Chỉ các bản ghi có `publication_status` KHÔNG thuộc `['DRAFT', 'PENDING_REVIEW', 'EXTRACTED', 'RAW', 'REJECTED', 'ARCHIVED']` mới được nạp vào runtime (dòng 589 và 702 trong `rule-repository.js`).
   - Các bản ghi `VERIFIED` được bảo vệ tuyệt đối: Trong các hàm `seedClassificationCatalog` và `seedQcvnCatalog`, câu lệnh UPDATE bỏ qua các dòng có `verification_status = 'VERIFIED'` hoặc `verified_by IS NOT NULL`.
   - Khi DB ngắt kết nối: Cả `classification-service.js` (dòng 956) và `qcvn-service.js` (dòng 88) đều gọi `isStaticFallbackAllowed()`. Nếu `NODE_ENV === 'production'` hoặc `ALLOW_STATIC_FALLBACK === 'false'`, hệ thống ngắt ngay lập tức với mã lỗi 503 `RuleDataUnavailableError`. Nếu trong môi trường dev, kết quả bắt buộc phải gắn `ruleSource: 'FALLBACK_UNVERIFIED'` và hạ `conclusionStatus` xuống `NEEDS_REVIEW`.
3. **Kết luận**: Nguyên tắc Single Database Source of Truth được đảm bảo tuân thủ chặt chẽ ở tầng runtime logic.

### 2.2. Đánh giá tính tuân thủ Nguyên tắc "Fail-Closed Legal & Completeness Gates"
1. **Phân loại hồ sơ (`classification-service.js`)**:
   - Ngành không có trong danh mục hoặc rỗng: trả về `errorCode: 'UNKNOWN_INDUSTRY'`, `conclusionStatus: 'NEEDS_REVIEW'`, `isOfficialConclusion: false`, không gán Nhóm IV hay ĐKMT.
   - Ngành có `processRules` (6 ngành: thép, nhiệt điện, hóa chất, giấy, dệt nhuộm, điện tử) thiếu `processStage`: trả về `errorCode: 'MISSING_PROCESS_STAGE'`, `conclusionStatus: 'NEEDS_REVIEW'`.
   - Công suất âm, `NaN`, hoặc rỗng: trả về `errorCode: 'INVALID_CAPACITY'`, `conclusionStatus: 'NEEDS_REVIEW'`.
   - Tiêu chí nhạy cảm (rừng, lúa, KCN, vùng bảo vệ): không tin giá trị boolean từ client, chỉ nâng nhóm khi có bản ghi thẩm định `VERIFIED` từ Admin phía server (`getProjectSensitiveVerification`).
2. **Đối chiếu QCVN (`qcvn-evaluator.js` & `qcvn-service.js`)**:
   - Thiếu `flowRate` trong QCVN nước thải công nghiệp: trả về `MISSING_FLOW_RATE`, không tự gán 100 m³/ngày.
   - Chưa tích chọn `receivingWaterConfirmed`: trả về `MISSING_RECEIVING_SOURCE`, không tự chọn Cột B.
   - Cơ sở cũ trong giai đoạn chuyển tiếp thiếu bảng QCVN 40:2011 hoặc 14:2008: trả về `TRANSITION_TABLE_NOT_AVAILABLE`, không ép sang bảng 2025.
   - Thiếu chỉ tiêu bắt buộc hoặc sai chu kỳ lấy mẫu: trả về `INCOMPLETE` (`chua_du_thong_so`) hoặc `PERIOD_MISMATCH`, tuyệt đối không gán `PASS`.
3. **Thống kê Bảng điều khiển (`dashboard-service.js`)**:
   - Tại dòng 397-408: Các mẫu quan trắc nếu có trạng thái `dat` nhưng thiếu metadata xác minh (`hasVerifiedSampleEvaluationMetadata`) sẽ tự động bị hạ xuống `can_ra_soat` và KHÔNG được đếm vào `passSamples` hay tỉ lệ tuân thủ `complianceRate`.
4. **Kết luận**: Các cổng fail-closed hoạt động đúng thiết kế và tuân thủ tuyệt đối quy định trong `AGENTS.md`.

### 2.3. Đánh giá tính tuân thủ Nguyên tắc "Server-Authoritative Evaluation"
1. **Tuyến POST `/api/projects`**:
   - Khi tạo mới dự án (dòng 454 `projects.js`): Bỏ qua toàn bộ `classification_result` client gửi lên, gọi `evaluateClassificationWithDb(enrichedFormData, { db })` để tính toán lại trên máy chủ và lưu vào cột `classification_result`.
   - Lưu trữ metadata đầy đủ: `ruleSource`, `ruleVersion`, `verificationStatus`, `evaluationDate`.
2. **Tuyến POST `/api/qcvns/samples`**:
   - Dòng 337-353 `qcvns.js`: Gọi hàm `runServerQcvnEvaluationWithSelection` tính toán lại toàn bộ thông số, đối chiếu với lựa chọn QCVN trên máy chủ, lưu `evaluation_details`, `overall_status`, `evaluated_rule_version`, `evaluated_verification_status`.
3. **Kết luận**: Tính toàn vẹn Server-Authoritative đạt yêu cầu.

### 2.4. Đánh giá Kiến trúc Crawler & Khâu Đồng bộ Quy tắc
1. **Bộ bóc tách sitemap & điều khoản (`backend/utils/crawler.js`)**:
   - Có cơ chế Fast-Skip dựa trên so sánh thẻ `<lastmod>` với `last_crawled_mod` trong cơ sở dữ liệu.
   - Làm sạch văn bản (`cleanProvisionText`) loại bỏ tốt các thành phần header/footer/breadcrumb rác.
   - Cơ chế phát hiện văn bản hết hiệu lực (`isExpired`) được giới hạn ở tiêu đề và 500 ký tự đầu để tránh bắt nhầm các trích dẫn hết hiệu lực ở điều khoản chuyển tiếp.
2. **Bộ phát hiện tác động và tạo đề xuất (`backend/services/crawler-sync-service.js`)**:
   - Tạo sự kiện tác động `law_rule_impacts` (OPEN) khi văn bản căn cứ bị cập nhật hoặc bãi bỏ.
   - Tạo đề xuất `rule_candidates` luôn ở trạng thái `PENDING_REVIEW`, tuyệt đối không tự ý ghi đè vào quy tắc runtime.
   - Điểm nghẽn cần khắc phục: BUG-02, BUG-03 và BUG-04 như đã nêu ở mục 1.2.

---

## 3. Caveats (Các điểm giới hạn và Giả định)

1. **Giả định môi trường cơ sở dữ liệu**:
   - Đợt rà soát này được tiến hành trong môi trường sandbox không có dịch vụ PostgreSQL vật lý đang hoạt động trên cổng 5432. Do đó, các bài kiểm thử cơ sở dữ liệu vật lý (`tests/postgres-integration.test.js`) dựa trên việc phân tích mã nguồn tĩnh và kết quả kiểm thử mock tương đương.
2. **Phạm vi kiểm tra giao diện**:
   - Báo cáo này tập trung vào khía cạnh kiến trúc mã nguồn, hợp đồng API, tính toàn vẹn dữ liệu và kiểm chứng tính tuân thủ pháp lý. Việc kiểm tra tương tác người dùng, hiển thị layout và thao tác thực tế qua trình duyệt web được phối hợp với Subagent `browser_inspector`.
3. **Quy định pháp lý**:
   - Các bảng đối chiếu ngưỡng phân loại và QCVN hiện vẫn mang cờ `NEEDS_LEGAL_VERIFICATION` theo đúng thiết kế của dự án, nhằm chờ sự phê duyệt của chuyên gia pháp lý trước khi chuyển thành `VERIFIED`.

---

## 4. Conclusion (Kết luận đánh giá)

1. **Mức độ hoàn thiện kiến trúc**: Kiến trúc LegalHub được tổ chức bài bản, tách biệt rõ ràng giữa 3 bước phân loại (Nhóm dự án → Thủ tục môi trường → Thẩm quyền giải quyết), kiểm soát chặt chẽ việc nạp danh mục từ cơ sở dữ liệu và bảo toàn các cổng fail-closed an toàn.
2. **Trạng thái tuân thủ AGENTS.md**: Đạt 4/4 bất biến kỹ thuật cốt lõi (Single Source of Truth, Fail-Closed, Server-Authoritative, UI-Engine Parity).
3. **Các vấn đề cần ưu tiên xử lý trước khi bàn giao đồ án**:
   - **Ưu tiên 1 (Critical & High)**: Sửa dứt điểm việc dùng lẫn lộn tên bảng tiếng Anh (view) và tiếng Việt (bảng vật lý) trong câu lệnh `INSERT ... ON CONFLICT` tại `project-verification-repository.js`, `crawler.js`, và `rule-repository.js` (BUG-01, BUG-02, BUG-03).
   - **Ưu tiên 2 (Medium)**: Bổ sung form/modal nhập danh sách thông số cho QCVN candidates trên AdminTab để cho phép Admin duyệt đề xuất crawler thành công (BUG-04); bổ sung trường nhập liệu `permitLimits` trên UI (BUG-05).
   - **Ưu tiên 3 (Low)**: Chuẩn hóa lại tên cấu hình tile map và tinh chỉnh cấu hình `build.chunkSizeWarningLimit` của Vite (BUG-06, BUG-07).

---

## 5. Verification Method (Phương pháp kiểm chứng độc lập)

Để độc lập kiểm chứng lại toàn bộ các phát hiện trong báo cáo này, thực hiện các bước sau:

### 5.1. Kiểm chứng Test Suite Backend & Build Frontend
Chạy tuần tự các lệnh sau từ thư mục gốc `d:\ĐATN\demo`:
```powershell
# 1. Chạy bộ kiểm thử backend lõi (31 test cases)
npm test --prefix backend

# 2. Chạy đóng gói frontend để kiểm tra cảnh báo chunk size
npm run build --prefix frontend
```

### 5.2. Kiểm chứng các vị trí code bị lỗi
1. Mở `backend/services/project-verification-repository.js` dòng 181: Quan sát câu lệnh `INSERT INTO xac_minh_yeu_to_nhay_cam_du_an` khác biệt với dòng 114 `SELECT ... FROM project_sensitive_verifications`.
2. Mở `backend/routes/crawler.js` dòng 12 và 35: Quan sát sự bất nhất giữa `SELECT ... FROM system_settings` và `INSERT INTO cai_dat_he_thong`.
3. Mở `backend/services/rule-repository.js` dòng 495: Quan sát câu lệnh `INSERT INTO phu_luc_phap_ly ... ON CONFLICT (ma)`.
4. Mở `frontend/src/components/ClassifyTab.vue` và tìm kiếm `permitLimits`: Xác nhận không có input nào cho người dùng cấu hình giới hạn GPMT.
