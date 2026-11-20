# Nhật ký Kiểm toán Kỹ thuật, Phát hiện P0/P1/P2 & 40 Câu hỏi Ôn Bảo vệ (`Antigravity_Audit_Log.md`)

> **Thời điểm thực hiện:** `2026-11-19`  
> **Commit baseline:** `69b39e3` (nhánh `main`)  
> **Chế độ vận hành:** **READ-ONLY CODE & DB** (chỉ đọc mã nguồn và xuất 8 tài liệu Markdown trong `docs/audit/`).

---

## 1. Nhật ký Thao tác, Tệp đã Đọc & Tệp đã Tạo

### 1.1. Tệp mã nguồn và cấu hình đã đọc trực tiếp
- Cấu hình & Git: `.gitignore`, `package.json`, `playwright.config.js`, `backend/package.json`, `frontend/package.json`, `backend/server.js`.
- Phân loại & Quy tắc: `backend/routes/classification.js`, `backend/routes/projects.js`, `backend/routes/admin-rules.js`, `backend/services/classification-service.js`, `backend/services/classification-rule-helpers.js`, `backend/services/runtime-policy.js`, `backend/services/rule-repository.js`, `backend/fixtures/classification-catalog.js`, `frontend/src/composables/useClassificationCatalog.js`.
- GIS & Xác minh nhạy cảm: `backend/services/spatial-gis-service.js`, `backend/services/project-verification-repository.js`, `backend/scripts/enable-postgis.js`.
- QCVN: `backend/routes/qcvns.js`, `backend/services/qcvn-service.js`, `frontend/src/utils/qcvn-evaluator.js`.
- Crawler & Đồng bộ: `backend/routes/crawler.js`, `backend/utils/crawler.js`, `backend/services/crawler-sync-service.js`.
- Kiểm thử & Schema: `docs/etc_legalhub_schema.sql`, `backend/scripts/sandbox-db-adapter.js`, `docs/testing-evidence/chapter3-empirical-results.json`, toàn bộ khai báo `test()` trong 8 file `backend/tests/*.test.js` và `tests/e2e-system.spec.js`.

### 1.2. Tệp mới đã tạo trong `docs/audit/` (không ghi đè file ứng dụng nào)
1. `docs/audit/Project_Map.md`
2. `docs/audit/Architecture_And_Data_Flows.md`
3. `docs/audit/Legal_Rule_Traceability_Template.md`
4. `docs/audit/Test_Matrix.md`
5. `docs/audit/Report_Gap_Matrix.md`
6. `docs/audit/Known_Limitations.md`
7. `docs/audit/Reproducibility_Plan.md`
8. `docs/audit/Antigravity_Audit_Log.md`

### 1.3. Các lệnh **KHÔNG chạy** trong Giai đoạn 1 và Lý do An toàn
| Lệnh không chạy | Lý do an toàn (theo Quy tắc Mục 8–9) |
| :--- | :--- |
| `node backend/scripts/run-chapter3-evaluation.js` | Script có gọi `ensureRuntimeDatabaseReady()` và có thể seed/khởi tạo dữ liệu lên DB đang cấu hình hoặc tự rơi về `sandbox-db-adapter.js`. |
| `npm run test:pg --prefix backend` | Chỉ chạy khi có bước tái lập riêng ở Giai đoạn 2 với xác nhận rõ DB test cô lập `etc_legalhub_test`. |
| `node backend/init-db.js` / `enable-postgis.js` / `POST /api/crawler/run` | Thao tác ghi/migration/crawler trực tiếp lên CSDL và mạng ngoài — bị cấm tuyệt đối ở giai đoạn kiểm toán tĩnh. |

---

## 2. Trả lời Ngắn gọn 8 Điểm "ĐẶC BIỆT KIỂM TRA"

1. **`exhaustive-catalog-coverage.test.js` có dùng fixture làm expected không?** **CÓ.** `deriveExpectedGroup(tier)` (`l.20–26`) suy trực tiếp từ `IND_DB`, nên chỉ chứng minh **độ phủ và tính nhất quán giữa dữ liệu và thuật toán**, KHÔNG phải kiểm chứng pháp lý độc lập.
2. **Nơi import `frontend/src/data/classification-db.js`:** **0 file `.js`/`.vue` runtime import** (chỉ được nhắc tên trong `docs/03-co-so-du-lieu-api-van-hanh.md`) $\rightarrow$ xác nhận là tệp di sản (*legacy*).
3. **Crawler dùng `lastmod` hay `SHA-256`?** **Chỉ dùng `lastmod` vs `last_crawled_mod`** (`backend/utils/crawler.js` `l.109`, `l.401`, `l.450`); **0 dòng SHA-256** trong crawler. Không tự phân tích điều khoản chuyển tiếp; hết hiệu lực nhận diện bằng từ khóa heuristic (`l.140–150`).
4. **Spatial logic gọi `ST_Covers`/`ST_Distance` ở đâu & dữ liệu polygon thật nào đang có?** Gọi tại `evaluateSpatialLayers()` (`project-verification-repository.js` `l.490–507`). Fallback Haversine chạy tại `analyzeSpatialContext()` (`spatial-gis-service.js` `l.304`, `l.328`, `l.418`). Seed hiện có **4 đa giác Polygon mẫu**: `vqg_cat_tien`, `kdt_can_gio` (nhạy cảm) và `kcn_hiep_phuoc`, `kcn_vsip_1` (KCN) trên tổng `57` lớp (`25` nhạy cảm + `32` KCN). Ngưỡng phát hiện vùng nhạy cảm không đa giác là `zone.radiusKm + 5` (`l.306`), có đa giác là `5 km`.
5. **Phân tách bộ test:** `npm test` chạy **7 file (`42` khai báo `test()`)** trong bộ nhớ; `test:pg` chạy **1 file (`5` khai báo `test()`)** trên PostgreSQL thật; Playwright chạy `tests/e2e-system.spec.js` (**6** kịch bản).
6. **`sandbox-db-adapter.js` biến đổi gì?** Ép toàn bộ `industries`, `classification_thresholds`, `qcvns` (cả `tham_so`), `gis_layers` sang trạng thái `da_xac_minh`/`VERIFIED` và tự chèn `tt_55_vbhn_bnnmt` + tài khoản `admin` (`l.19–128`). Kết quả snapshot **không được coi là** kiểm thử DB thật hay xác minh pháp lý.
7. **Cơ chế Fail-Closed:** DB lỗi $\rightarrow$ trả `503 RULE_DB_UNAVAILABLE` nếu `NODE_ENV==='production'` hoặc `ALLOW_STATIC_FALLBACK==='false'` (`runtime-policy.js`), ngược lại ép `FALLBACK_UNVERIFIED` + `NEEDS_REVIEW`; rule chưa verified $\rightarrow$ khóa `isOfficialConclusion=false`, `canExportOfficialReport=false`; thiếu/sai input $\rightarrow$ `UNKNOWN_INDUSTRY`, `MISSING_PROCESS_STAGE`, `INVALID_CAPACITY`, `NO_ACTIVE_RULE_FOR_DATE`.
8. **Truy vết giải trình đầu ra:** Output trả về các trường có cấu trúc (`ref`, `ref_law_id`, `phuluc`, `appliedRuleVersion`, `appliedEffectiveFrom`, `appliedEffectiveTo`, `ruleSource`, `verificationStatus`, `classificationRationale` gồm `matchedMin`, `matchedMax`, `legalRefs`, `adjustments`, `summaryText`) — **không chỉ là chuỗi text tự do**, nhưng còn thiếu `threshold_id` (`nguong_phan_loai.ma`) của dòng ngưỡng khớp.

---

## 3. Bảng Tổng hợp Phát hiện Kiểm toán (P0 / P1 / P2)

| Mã | Mức độ | Phát hiện kiểm toán | Bằng chứng đường dẫn | Tác động tới khóa luận | Đề xuất tiếp theo (Giai đoạn 2) |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **F-01** | **P0** | Word tuyên bố Crawler dùng băm `SHA-256`, nhưng code chỉ dùng `lastmod` của Sitemap XML | `backend/utils/crawler.js` (`l.109`, `l.401`, `l.450`) | Mâu thuẫn trực tiếp (`CONTRADICTED`), dễ bị hội đồng bắt lỗi trung thực | Sửa Word theo Lựa chọn A: mô tả đúng cơ chế `lastmod` + Cheerio |
| **F-02** | **P0** | `exhaustive-catalog-coverage.test.js` suy `expected` từ `IND_DB` và chỉ test 1 điểm/bậc; toàn bộ 143 ngưỡng gốc trong fixture vẫn ở `NEEDS_LEGAL_VERIFICATION` & có `39/39` `auditNote` | `backend/tests/exhaustive-catalog-coverage.test.js` (`l.20–26`, `l.75`); `backend/fixtures/classification-catalog.js` | Không đủ cơ sở gọi là *"kiểm chứng pháp lý độc lập 143/143"* | Đổi tên thành *"kiểm thử độ phủ & tính nhất quán"*; tạo bộ `legal-golden-cases` độc lập (15–20 ca) + test biên 3 điểm (`X-ε`, `X`, `X+ε`) |
| **F-03** | **P0** | So sánh độ trễ API `13–15 ms` trực tiếp với quy trình thủ công ("nhiều phút") mà chưa có bấm giờ người dùng | `docs/testing-evidence/chapter3-empirical-results.json` | Nguy cơ bị phản biện đánh tráo khái niệm hiệu năng API với hiệu quả quy trình | Tách rạch ròi thời gian xử lý API máy chủ với thời gian quy trình chuyên viên; áp dụng mẫu Kết luận trung thực (Mục 7 `.md`) |
| **F-04** | **P1** | Ngưỡng phát hiện vùng nhạy cảm GIS là `zone.radiusKm + 5` (điểm) / `5 km` (đa giác), không phải bán kính 15 km đồng nhất | `backend/services/spatial-gis-service.js` (`l.306–308`, `l.400`); `backend/routes/classification.js` (`l.85–86`) | Mô tả chưa khớp thuật toán thực tế ở Chương 2 & Chương 3 | Ghi chính xác từng ngưỡng theo code và phân rõ bảng PostgreSQL/PostGIS vs Node.js |
| **F-05** | **P1** | `sandbox-db-adapter.js` ép trạng thái `VERIFIED` khi chạy fallback; `.gitignore` ẩn `docs/testing-evidence/` | `backend/scripts/sandbox-db-adapter.js` (`l.19–49`); `.gitignore` (`l.30–32`) | Khó kiểm chứng khả năng tái lập và dễ nhầm kết quả snapshot với DB thật | Đóng gói `REPRODUCIBILITY_MANIFEST.json` kèm commit SHA, DB mode & log sạch trong `docs/audit/` |
| **F-06** | **P1** | Output phân loại chưa có `threshold_id`; chưa có test biên 5 mốc thời gian hiệu lực + `ALLOW_STATIC_FALLBACK=false` | `backend/services/classification-service.js` (`l.953–1001`); `backend/services/runtime-policy.js` | Thiếu hoàn thiện truy vết cấp dòng ngưỡng và kiểm thử biên thời gian | Bổ sung `boundary-and-temporal.test.js` ở Giai đoạn 2 |
| **F-07** | **P2** | `frontend/src/data/classification-db.js` là file di sản không còn import runtime; các file service lớn (`rule-repository.js`, `classification-service.js`) | `frontend/src/data/classification-db.js`; `backend/services/` | Rủi ro gây hiểu nhầm tồn tại 2 nguồn dữ liệu quy tắc | Dọn/refactor có kiểm soát theo từng commit nhỏ ở Giai đoạn 3 (sau khi chốt khóa luận) |

---

## 4. Gợi ý Trả lời Ngắn gọn 40 Câu hỏi Tự Kiểm tra Bảo vệ (Bám sát 100% Mã nguồn)

### Nhóm 1 — Classification (10 câu)
1. **Input API phân loại:** `nganh` (bắt buộc), `capacity`/`cap` (bắt buộc, số `>= 0`), `processStage` (bắt buộc với 6 ngành có `processRules`), tùy chọn `evaluationDate` (`YYYY-MM-DD`), tọa độ `latitude`/`longitude`, cờ nhạy cảm (`bao_ton`, `rung`, `lua`, `bg`, `di_san`, `ven_bien`, `nguon_nc`, `dat_ngap`), `noWasteGenerated`, `kcn`, `projectId`.
2. **Nhận diện mã ngành & bí danh:** `resolveIndustryCode()` (`classification-rule-helpers.js` `l.8–33`) chuẩn hóa chuỗi, tra `INDUSTRY_ALIASES`, rồi đối chiếu mã trực tiếp, mảng `aliases` hoặc tên ngành đã bỏ dấu tiếng Việt.
3. **Tại sao 6 ngành bắt buộc chọn công đoạn?** Vì cùng một ngành (như `det_nhuom` có nhuộm vs chỉ dệt may, `thep` luyện quặng vs chỉ cán kéo) nhưng bản chất phát sinh chất thải và nhóm dự án theo Phụ lục II/III/IV hoàn toàn khác nhau; thiếu `processStage` phải fail-closed `MISSING_PROCESS_STAGE`.
4. **Sắp xếp & chọn threshold:** `findIndustryTierDetailed()` (`l.88–99`) lọc theo `isEffectiveOnDate()`, sắp tăng dần theo `tierOrder`, sau đó giảm dần theo `min` và mới nhất theo `effectiveFrom`, rồi chọn phần tử đầu tiên khớp `matchesThreshold()` (*first-match*).
5. **Khác biệt `>` và `>=` tại điểm biên:** `matchesThreshold(value, min, operator)` (`l.3–6`): với `'>'` thì `value === min` **không khớp** (rơi xuống bậc thấp hơn); với `'>='` thì `value === min` **khớp ngay bậc đó**.
6. **Ảnh hưởng của `evaluationDate`:** Lọc các ngưỡng thỏa `effectiveFrom <= evaluationDate <= effectiveTo` và xác định thẩm quyền lịch sử (trước `2025-07-01` dùng `cap_huyen`, từ `2025-07-01` dùng `cap_xa` / mô hình 02 cấp). Ngoài khoảng hiệu lực $\rightarrow$ `NO_ACTIVE_RULE_FOR_DATE`.
7. **`NEEDS_LEGAL_VERIFICATION` vs `VERIFIED`:** `NEEDS_LEGAL_VERIFICATION` chỉ trả kết quả sơ bộ (`isOfficialConclusion: false`, `canExportOfficialReport: false`, khóa xuất báo cáo chính thức); chỉ khi toàn bộ rule và xác minh nhạy cảm đều `VERIFIED` mới được xuất chính thức.
8. **Nếu DB lỗi có kết luận chính thức không?** **KHÔNG.** Trong `production` hoặc `ALLOW_STATIC_FALLBACK=false` trả lỗi `503 RULE_DB_UNAVAILABLE`; trong dev/test dùng fallback phải gắn `FALLBACK_UNVERIFIED` và ép `NEEDS_REVIEW`.
9. **Trường truy vết căn cứ trong output:** `ref`, `ref_law_id`, `phuluc`, `appliedRuleVersion`, `appliedEffectiveFrom`, `appliedEffectiveTo`, `classificationRationale` (`legalRefs`, `matchedMin`, `matchedMax`, `adjustments`).
10. **Tách 3 bước quy tắc:** Bước 1 `determineProjectGroup()` xác định nhóm (`I–IV`) từ ngành/công suất/nhạy cảm đã xác minh; Bước 2 `determineEnvironmentalObligations()` suy thủ tục (`ĐTM`/`GPMT`/`ĐKMT`); Bước 3 `determineCompetentAuthority()` xác định cơ quan thẩm quyền theo nhóm, loại thủ tục, vị trí và ngày hiệu lực.

### Nhóm 2 — GIS (10 câu)
11. **Định dạng & hệ quy chiếu tọa độ:** Độ thập phân WGS84 (`SRID 4326`), kiểm tra hợp lệ `vi_do ∈ [-90, 90]`, `kinh_do ∈ [-180, 180]`.
12. **Vì sao `ST_MakePoint($2, $1)` nhận kinh độ trước vĩ độ?** Theo chuẩn toán học/PostGIS `(X, Y)` = `(longitude, latitude)` — kinh độ là trục hoành X, vĩ độ là trục tung Y.
13. **Ý nghĩa `ST_Covers(geom, point)`:** Trả về `true` khi điểm nằm **bên trong hoặc ngay trên đường biên** của đa giác (khác `ST_Contains` vốn trả `false` khi điểm nằm đúng trên biên).
14. **`ST_Distance` đo trên `geometry` hay `geography`?** Đo trên **`geography`** (`::geography / 1000.0`) để tính khoảng cách trắc địa theo mét trên mặt cầu Trái Đất rồi đổi ra kilômét, không bị méo theo đơn vị độ.
15. **Kiểm tra đa giác hợp lệ:** Hàm SQL `legalhub_geojson_polygon()` và `evaluateSpatialLayers()` đều kiểm tra `GeometryType(geom) IN ('POLYGON', 'MULTIPOLYGON') AND ST_IsValid(geom)`.
16. **Khi không có polygon dùng gì?** Dùng `ST_Distance` trên `geography` từ điểm tâm (`POSTGIS_CENTER_RADIUS_APPROXIMATION`) trong PostgreSQL, hoặc `haversineDistanceKm()` (`HAVERSINE_APPROXIMATION`) tại Node.js nếu DB lỗi.
17. **Bán kính trong fixture có phải ranh giới pháp lý không?** **KHÔNG.** Chỉ là vùng đệm tham khảo để cảnh báo sớm (`radiusKm + 5 km` với vùng nhạy cảm điểm tâm).
18. **Cảnh báo không gian có tự nâng nhóm không?** **KHÔNG.** Chỉ tạo `spatialAlerts` và lưu snapshot vào `xac_minh_yeu_to_nhay_cam_du_an` ở trạng thái `cho_xac_minh`.
19. **Ai xác minh vị trí/vùng nhạy cảm?** Quản trị viên (`PUT /api/projects/:id/sensitive-verification`) duyệt `VERIFIED` dựa trên tài liệu/văn bản trích lục hoặc số liệu diện tích hợp lệ do chuyên viên đối chiếu.
20. **Một điểm đại diện có đủ cho dự án diện tích lớn?** **Chưa đủ.** Với dự án lớn (KCN, khu đô thị, cao tốc), cần mở rộng lưu đa giác ranh giới dự án và dùng `ST_Intersects` ở hướng phát triển tiếp theo.

### Nhóm 3 — Crawler và Hiệu lực Pháp lý (10 câu)
21. **Nguồn crawler:** `https://www.luatmoitruong.vn/sitemap-pages.xml`.
22. **Vai trò `lastmod`:** So sánh với `last_crawled_mod` trong bảng `luat` để bỏ qua nhanh các URL không thay đổi (*Fast-Skip*), giảm tải HTTP.
23. **Có dùng `SHA-256` nội dung không?** **KHÔNG** (0 dòng `SHA-256` trong `crawler.js`).
24. **Thư viện trích xuất HTML:** `cheerio` (`^1.2.0`).
25. **Nhận diện rule bị tác động:** `detectImpactedRules()` (`crawler-sync-service.js`) truy vấn `classification_thresholds` và `qcvns` khớp `law_id`, số hiệu `so` hoặc mã `QCVN` để tạo bản ghi `law_rule_impacts`.
26. **Vì sao đề xuất phải chờ duyệt?** Văn bản luật dài, phức tạp và dễ có ngoại lệ/chuyển tiếp; áp thẳng vào runtime có thể làm sai toàn bộ kết luận pháp lý nên bắt buộc qua hàng đợi `PENDING_REVIEW`.
27. **Ngày hiệu lực lưu ở đâu?** Cột `hieu_luc_tu` (`effective_from`) và `hieu_luc_den` (`effective_to`) kiểu `DATE` trên bảng `nguong_phan_loai`, và thông tin hiệu lực trên bảng `quy_chuan_qcvn` & `luat`.
28. **Xử lý điều khoản chuyển tiếp:** Phân loại dự án lọc theo `evaluationDate`; QCVN kiểm tra cờ cơ sở hiện hữu (`isExistingFacility`) trước mốc chuyển tiếp (2032) để xác định áp dụng QCVN cũ hay mới.
29. **Nếu thiếu bảng QCVN cũ hệ thống làm gì?** Fail-closed trả `NEEDS_REVIEW` với mã `TRANSITION_TABLE_NOT_AVAILABLE`, cấm tự map sang bảng `QCVN 40:2025` / `14:2025`.
30. **Crawler có tự kết luận pháp lý không?** **KHÔNG.** Chỉ thu thập văn bản, ghi lịch sử và tạo cảnh báo/đề xuất chờ người có thẩm quyền duyệt.

### Nhóm 4 — Kiểm thử và Đánh giá (10 câu)
31. **Test dùng mock:** 7 file trong `npm test` (`administrative-boundaries`, `classification-p0`, `compliance-reminder`, `exhaustive-catalog-coverage`, `qcvn-p0`, `routes-and-parity`, `spatial-postgis`).
32. **Test kết nối PostgreSQL thật:** `backend/tests/postgres-integration.test.js` (`npm run test:pg`, dùng DB riêng `etc_legalhub_test`).
33. **Test/script có thể chạy trên snapshot:** `run-chapter3-evaluation.js` và `tests/e2e-system.spec.js` (chỉ rơi vào `sandbox-db-adapter.js` nếu không kết nối được PostgreSQL thật; phải luôn kiểm tra cờ `DB mode`).
34. **Nguồn `expected` của từng test:** `exhaustive-catalog-coverage` (`L45`, `L109`) suy từ fixture (`IND_DB`/`QCVN_DATA`); các test `p0`/`routes`/`pg`/`E2E` dùng hard-code invariant & 7 ca golden trích luật; bộ benchmark độc lập đầy đủ là hạng mục Giai đoạn 2.
35. **Test phủ 143 ngưỡng có chứng minh đúng pháp lý không?** **KHÔNG.** Chỉ chứng minh engine nhất quán 100% với 143 ngưỡng đã nhập trong fixture.
36. **Số lượng test khai báo thực tế:** `42` trong `npm test` + `5` trong `test:pg` + `6` trong Playwright E2E (+ `32` kịch bản trong script thực nghiệm Chương 3). Con số cuối cùng trong báo cáo phải lấy từ log chạy thực tế theo từng runner.
37. **Cách tính `P95`:** Sắp tăng dần mảng thời gian 20 lần gọi và lấy phần tử tại vị trí phân vị 95% (95% lượt yêu cầu hoàn thành nhanh hơn hoặc bằng mốc này).
38. **Benchmark API có tính thời gian nhập liệu của chuyên viên không?** **KHÔNG.** Chỉ đo thời gian xử lý HTTP của máy chủ.
39. **Đã thử nghiệm tại doanh nghiệp chưa?** **Chưa** có thử nghiệm bấm giờ chính thức trên nhóm chuyên viên tại doanh nghiệp.
40. **Hạn chế cần chủ động trình bày với hội đồng:** (1) 143 ngưỡng mới đối chiếu sơ bộ, chưa có hội đồng chuyên gia pháp lý độc lập ký xác nhận toàn bộ; (2) 4/57 lớp GIS có đa giác mẫu, 53 lớp còn lại là bán kính tham khảo; (3) crawler 1 nguồn theo `lastmod`, không thay thế thẩm định văn bản; (4) chưa đo khảo sát bấm giờ diện rộng tại doanh nghiệp.
