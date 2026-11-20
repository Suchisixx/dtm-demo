# Ma trận Kiểm thử & Kiểm toán Phương pháp Kiểm chứng (`Test_Matrix.md`)

> **Commit baseline:** `69b39e3`  
> **Lưu ý kiểm toán:** Bảng dưới đây phân tách rạch ròi giữa **đếm cấu trúc khai báo `test()` trong mã nguồn** với **kết quả thực thi từng môi trường**, và phân biệt rõ **expected suy từ fixture** với **expected độc lập**.

---

## 1. Tổng quan Các Bộ Kiểm thử Trong Repository (Không Đếm Trùng)

| Nhóm kiểm thử | Lệnh thực thi | Tệp kiểm thử | Số `test()` khai báo | Môi trường DB thực tế | Trạng thái trong Giai đoạn 1 |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **A. Unit & Mock/In-Memory Integration** | `npm test --prefix backend` | 7 tệp trong `backend/tests/` (xem mục 2) | **42** | Mock DB trong bộ nhớ + fixture tĩnh (`IND_DB`, `QCVN_DATA`) | `IMPLEMENTED` / `TESTED` (không chạy mới ở Giai đoạn 1 read-only) |
| **B. Real PostgreSQL + PostGIS Integration** | `npm run test:pg --prefix backend` | `backend/tests/postgres-integration.test.js` | **5** | PostgreSQL thật (CSDL test riêng `etc_legalhub_test`, yêu cầu extension `postgis`) | `IMPLEMENTED` (không chạy mới ở Giai đoạn 1) |
| **C. Kịch bản Thực nghiệm Chương 3** | `node backend/scripts/run-chapter3-evaluation.js` | `backend/scripts/run-chapter3-evaluation.js` | **32** kịch bản (10 PL + 6 QCVN + 4 GIS/RM + 6 SEC + 6 BD) + đo 8 API | PostgreSQL thật (`LIVE_POSTGRES`) **hoặc** tự fallback sang `sandbox-db-adapter.js` (`SANDBOX_SNAPSHOT`) | `IMPLEMENTED` — **KHÔNG chạy** trong Giai đoạn 1 vì script có gọi `ensureRuntimeDatabaseReady()` / thao tác DB |
| **D. E2E Trình duyệt (Playwright)** | `npx playwright test` | `tests/e2e-system.spec.js` | **6** | Express + `backend/public` + PostgreSQL hoặc `sandbox-db-adapter.js` | `IMPLEMENTED` (không chạy mới ở Giai đoạn 1) |

> **Cảnh báo chống đếm sai / đếm trùng:**  
> - `npm test` (42) KHÔNG bao gồm `postgres-integration.test.js` (5), KHÔNG bao gồm `run-chapter3-evaluation.js` (32) và KHÔNG bao gồm `e2e-system.spec.js` (6).  
> - Nhiều kịch bản trong `run-chapter3-evaluation.js` (như `TC-BD-01..06`, `TC-PL-01..10`) kiểm tra trùng miền hành vi với `classification-p0.test.js` và `qcvn-p0.test.js` nhưng chạy trên Express + DB thật (`LIVE_POSTGRES`). Do đó khi lập bảng tổng hợp trong báo cáo cần **tách rõ theo runner và môi trường**, không trình bày mơ hồ như 85 bài toán độc lập hoàn toàn.

---

## 2. Chi tiết Từng Test Khai báo & Phân loại Nguồn `Expected`

### 2.1. `backend/tests/administrative-boundaries.test.js` (`5` tests — `npm test`)
| Dòng | Tên test | Nguồn `expected` | Môi trường DB | Giới hạn chứng minh |
| :---: | :--- | :--- | :---: | :--- |
| `L7` | Danh mục địa giới hiện hành có đủ tỉnh và đơn vị cấp xã, mã duy nhất | Assertion cấu trúc dữ liệu nội bộ | Không dùng DB | Chỉ kiểm tra tính toàn vẹn cấu trúc JSON địa giới |
| `L16` | Ranh giới được truy vấn theo mã và chuẩn hóa tọa độ chuỗi | Mock HTTP response | Không dùng DB | Không gọi dịch vụ địa giới ngoài thật |
| `L30` | Tọa độ trung tâm Quận 1 cũ được xác định đúng phường hiện hành | Hard-code kết quả phường sau sáp nhập | Không dùng DB | Phụ thuộc dữ liệu hành chính nội bộ |
| `L44` | Tọa độ ngoài phạm vi địa lý không được gửi tới dịch vụ | Hard-code reject | Không dùng DB | Chỉ kiểm tra chặn biên tọa độ |
| `L48` | API tra cứu ranh giới nhận mã đơn vị và trả GeoJSON | Mock route/service | Không dùng DB | Kiểm tra hợp đồng API nội bộ |

### 2.2. `backend/tests/classification-p0.test.js` (`9` tests — `npm test`)
| Dòng | Tên test | Nguồn `expected` | Môi trường DB | Giới hạn chứng minh |
| :---: | :--- | :--- | :---: | :--- |
| `L137` | Seed phân loại an toàn: không TRUNCATE, seed đủ 39 ngành + 6 processRules và giữ nguyên `VERIFIED` | Hard-code invariant | Mock DB | Không chạy SQL PostgreSQL thật |
| `L172` | `CL-01`: Mã ngành không tồn tại (`dien_hat_nhan`, `cang_song`) fail-closed `NEEDS_REVIEW` | Hard-code invariant | Mock DB | Chứng minh cổng an toàn fail-closed |
| `L193` | `CL-02 & CL-03`: Ngành có `processRules` thiếu `processStage` phải chặn; 2 công đoạn cho kết quả khác nhau | Hard-code theo quy định `det_nhuom` | Mock DB | Mẫu tiêu biểu trên 1 ngành |
| `L217` | Công suất âm hoặc `NaN` fail-closed `INVALID_CAPACITY` | Hard-code invariant | Mock DB | Chứng minh kiểm tra biên công suất |
| `L231` | `CL-07`: Rule `NEEDS_LEGAL_VERIFICATION` không trả kết luận chính thức, bị khóa export | Hard-code invariant | Mock DB | Chứng minh cổng khóa báo cáo |
| `L261` | `CL-14 & CL-15`: Sửa rule trong DB đổi kết quả ngay; rule `DRAFT` / `PENDING_REVIEW` bị loại khỏi runtime | Hard-code invariant | Mock DB | Chứng minh lọc trạng thái công bố |
| `L334` | DB mất kết nối / offline fallback $\rightarrow$ `FALLBACK_UNVERIFIED` và ép `NEEDS_REVIEW` | Hard-code invariant | Mock DB lỗi | Chưa test riêng `ALLOW_STATIC_FALLBACK=false` (`503`) trong file này |
| `L348` | Effective-Date Versioning & Historical Authority (`evaluationDate`) | Catalog phiên bản tự dựng | Mock DB | Chứng minh cơ chế lọc ngày, không chứng minh dữ liệu lịch sử toàn DB |
| `L424` | Reject client spoofed `sensitiveCriteriaVerified` & escalate only on server `VERIFIED` | Hard-code invariant | Mock DB | Chứng minh chống giả mạo từ client |

### 2.3. `backend/tests/exhaustive-catalog-coverage.test.js` (`3` tests — `npm test`) — **TRỌNG TÂM KIỂM TOÁN**
| Dòng | Tên test | Nguồn `expected` | Môi trường DB | Giới hạn chứng minh (ĐẶC BIỆT LƯU Ý) |
| :---: | :--- | :--- | :---: | :--- |
| `L45` | Coverage 100%: 39 ngành, 12 `processStages`, 143 ngưỡng | **SUY TỪ FIXTURE (`deriveExpectedGroup(tier)` trên chính `IND_DB`)** | Không dùng DB (truyền `catalog: IND_DB`) | **KHÔNG phải kiểm chứng pháp lý độc lập!** Chỉ chứng minh **tính nhất quán & độ phủ** giữa engine và dữ liệu `IND_DB`. Ngoài ra `buildSampleCapacityForTier()` chỉ kiểm 1 điểm đại diện mỗi bậc, chưa kiểm đủ 3 điểm biên `X - ε`, `X`, `X + ε`. |
| `L109` | Coverage 100%: 35 bảng QCVN (`PASS`/`FAIL`/`INCOMPLETE`/`MISSING_RECEIVING_SOURCE`) | **Tự sinh input từ chính giới hạn của `QCVN_DATA`** | Không dùng DB (tạo `verifiedCatalog` trong RAM) | Chứng minh tính nhất quán thuật toán đánh giá QCVN trên đủ 35 bảng, **không chứng minh các con số giới hạn trong `QCVN_DATA` đã khớp 100% văn bản QCVN gốc**. |
| `L190` | Golden Legal Benchmark (7 ca) & Temporal Versioning | Hard-code 7 tình huống trích dẫn Luật BVMT 2020 & VBHN 49/2026 + catalog phiên bản tự dựng | Không dùng DB | Là bước khởi đầu đúng hướng nhưng mới có **7 ca** viết trong file test (chưa tách thành file benchmark độc lập có nguồn URL/SHA-256 và chữ ký chuyên viên). |

### 2.4. `backend/tests/qcvn-p0.test.js` (`7` tests — `npm test`)
| Dòng | Tên test | Nguồn `expected` | Môi trường DB | Giới hạn chứng minh |
| :---: | :--- | :--- | :---: | :--- |
| `L77` | `QV-01/06/07`: Thiếu lưu lượng / chưa xác nhận nguồn tiếp nhận $\rightarrow$ `NEEDS_REVIEW` | Hard-code invariant | Mock DB | Chứng minh cổng fail-closed QCVN |
| `L129` | `Q-09`: Transition Guard `QCVN 40:2011` / `14:2008` thiếu bảng cũ $\rightarrow$ `TRANSITION_TABLE_NOT_AVAILABLE` | Hard-code invariant | Mock DB | Chứng minh không map nhầm sang bảng 2025 |
| `L157` | `QV-08/09`: Seed QCVN không ghi đè `VERIFIED`; DB update ảnh hưởng evaluator ngay | Hard-code invariant | Mock DB | Chứng minh nguồn sự thật DB |
| `L225` | `QV-10`: DB QCVN lỗi/rỗng $\rightarrow$ `FALLBACK_UNVERIFIED` & chặn `PASS` | Hard-code invariant | Mock DB lỗi | Chứng minh fail-closed khi mất DB |
| `L237` | `QV-11/17` & `Q-10`: Thiếu chỉ tiêu bắt buộc, sai chu kỳ `CO 8h` vs `24h`, GPMT khoảng `pH` | Hard-code invariant | Không dùng DB | Chứng minh kiểm tra chu kỳ & khoảng |
| `L325` | Server QCVN selection by industry, transitional gate & Admin transitional upsert | Hard-code invariant | Mock DB | Kiểm tra luồng chọn QCVN và nạp bảng chuyển tiếp |
| `L504` | Tính tỷ lệ từng thông số, dấu phẩy thập phân và nhãn nhóm tiếng Việt | Hard-code | Không dùng DB | Kiểm tra tính toán hiển thị |

### 2.5. `backend/tests/routes-and-parity.test.js` (`10` tests — `npm test`)
- `L44`, `L59`, `L279`, `L340`, `L696`, `L738`, `L873`, `L897`, `L1058`, `L1148`: Kiểm tra Express routes (`POST /api/projects`, `POST /api/qcvns/samples`, `GET /api/dashboard/stats`, `GET /api/admin/audit-logs`, `GET /api/laws/active-basis`, crawler sync `PENDING_REVIEW`, parity UI-Engine-DB, ánh xạ 19 bảng tiếng Việt). **Môi trường:** Mock DB in-memory + đọc tĩnh source frontend.

### 2.6. `backend/tests/compliance-reminder.test.js` (`4` tests — `npm test`)
- `L139`, `L161`, `L168`, `L187`: Kiểm tra phân loại 4 trạng thái (`qua_han`, `sap_den_han`, `trong_han`, `da_hoan_thanh`), tính kỳ tiếp theo (`hang_quy`, `sau_thang`, `hang_nam`), sinh nghĩa vụ mặc định và CRUD/RBAC. **Môi trường:** Unit + Mock DB.

### 2.7. `backend/tests/spatial-postgis.test.js` (`4` tests — `npm test`)
- `L30`, `L45`, `L52`, `L72`: Kiểm tra câu SQL tạo ra chứa `ST_Covers` / `ST_Distance(...::geography)`, nhánh fallback `FALLBACK_UNVERIFIED`, schema khi thiếu PostGIS và từ chối polygon không hợp lệ. **Môi trường:** Mock DB (chỉ kiểm tra chuỗi SQL & logic xử lý, **không thay thế PostGIS thật**).

### 2.8. `backend/tests/postgres-integration.test.js` (`5` tests — `npm run test:pg`)
- `L220`, `L262`, `L296`, `L343`, `L414`: Kết nối PostgreSQL thật (CSDL test riêng `etc_legalhub_test`). Kiểm tra seed bảo toàn `VERIFIED`, so sánh `DATE` thật (`2025-05-01` $\rightarrow$ `cap_huyen` vs `2026-08-01` $\rightarrow$ `cap_xa`; `2020-01-01` $\rightarrow$ `NO_ACTIVE_RULE_FOR_DATE`), PostGIS `ST_Covers` trong/biên/ngoài đa giác + trigger đồng bộ `du_an.vi_tri_khong_gian`, vòng đời xác minh nhạy cảm (tự reset khi sửa dự án) và crawler sync + duyệt đề xuất + upsert QCVN chuyển tiếp.

### 2.9. `tests/e2e-system.spec.js` (`6` tests — `npx playwright test`)
- `L77`, `L92`, `L100`, `L109`, `L117`, `L128` (`E2E-01` $\rightarrow$ `E2E-06`): Chạy trình duyệt Chromium thật kiểm tra giao diện Vue 3 + Express API. **Lưu ý:** File này có import `installSandboxDbFallbackIfNeeded` (`L16`) nên cần ghi rõ trong log chạy thực tế là DB mode nào (`LIVE_POSTGRES` hay `SANDBOX_SNAPSHOT`).

---

## 3. Phân tích Rủi ro của `sandbox-db-adapter.js` (Điểm Đặc biệt Kiểm tra #6)

Qua đọc trực tiếp `backend/scripts/sandbox-db-adapter.js` (`l.19–128`):
1. Khi PostgreSQL thật không kết nối được, adapter nạp file snapshot `backend/backups/schema-rename/postgres-before-vietnamese-schema-20261112T104106Z.json` và **chủ động biến đổi dữ liệu trong bộ nhớ**:
   - Ép toàn bộ `industries`, `classification_thresholds`, `qcvns` (và từng thông số `tham_so`), `gis_layers` sang `verification_status: 'da_xac_minh'` / `'VERIFIED'` và `publication_status: 'da_cong_bo'` (`l.20–49`).
   - Tự chuẩn hóa/chèn thêm bản ghi `tt_55_vbhn_bnnmt` (`55/VBHN-BNNMT`) nếu chưa có (`l.63–114`) và tài khoản `admin` (`l.118–128`).
2. **Kết luận kiểm toán:** Kết quả chạy trong chế độ `SANDBOX_SNAPSHOT` **tuyệt đối không được coi là** bằng chứng kiểm thử PostgreSQL thật, không phải bằng chứng PostGIS thật và càng không phải bằng chứng xác minh pháp lý. Mọi báo cáo kết quả từ `run-chapter3-evaluation.js` bắt buộc phải ghi rõ trường `DB mode` thực tế (`LIVE_POSTGRES` vs `SANDBOX_SNAPSHOT`).
