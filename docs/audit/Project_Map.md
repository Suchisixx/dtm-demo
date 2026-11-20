# Bản đồ Codebase Dự án ETC LegalHub (`Project_Map.md`)

> **Commit baseline:** `69b39e3` (nhánh `main`)  
> **Thời điểm kiểm kê:** `2026-11-19`  
> **Phạm vi:** Rà soát tĩnh toàn bộ thư mục `frontend/`, `backend/`, `tests/`, `docs/` — **không chỉnh sửa mã nguồn ứng dụng**.

---

## 1. Cấu trúc Tổng thể Monorepo

| Thư mục / Tệp gốc | Vai trò chính | Trạng thái |
| :--- | :--- | :---: |
| `backend/` | Máy chủ Express REST API, động cơ phân loại, đối chiếu QCVN, phân tích GIS, crawler, nhắc hạn và repository PostgreSQL/PostGIS | `IMPLEMENTED` |
| `frontend/` | Ứng dụng SPA Vue 3 (`3.5.40`) + Vite (`8.2.0`) + Leaflet (`1.9.4`) | `IMPLEMENTED` |
| `tests/` | Kiểm thử E2E trình duyệt Playwright (`tests/e2e-system.spec.js`) | `IMPLEMENTED` |
| `docs/` | Tài liệu kiến trúc (`01`, `02`, `03`), SQL schema (`etc_legalhub_schema.sql`), bằng chứng kiểm thử (`testing-evidence/`, bị gitignore) và bộ kiểm toán (`audit/`) | `IMPLEMENTED` |
| `package.json`, `playwright.config.js` | Bộ điều phối lệnh monorepo và cấu hình Playwright | `IMPLEMENTED` |

---

## 2. Bản đồ Theo Domain Nghiệp vụ (Frontend → API → Service → Repository → DB → Test)

| Domain | Màn hình / Thành phần Frontend | Tuyến API Backend | Dịch vụ xử lý (Services / Utils) | Kho dữ liệu (Repository / Schema) | Bảng / View PostgreSQL | Fixture / Dữ liệu nền | Kiểm thử liên quan |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Phân loại Hồ sơ Môi trường** | `frontend/src/components/ClassifyTab.vue`<br>`frontend/src/composables/useClassificationCatalog.js`<br>`frontend/src/services/classification-rules.js`<br>`frontend/src/components/classify/SavedProjectsDrawer.vue` | `backend/routes/classification.js`<br>- `POST /api/classification/evaluate`<br>- `GET /api/classification/metadata`<br>- `GET /api/classification/industries` (`/api/industries`)<br>`backend/routes/projects.js`<br>- `POST /api/projects`<br>- `PUT /api/projects/:id/sensitive-verification` | `backend/services/classification-service.js`<br>`backend/services/classification-rule-helpers.js`<br>`backend/services/runtime-policy.js` | `backend/services/rule-repository.js`<br>`backend/services/project-verification-repository.js`<br>`backend/services/repository-shared.js` | `nganh_nghe` (`industries`)<br>`nguong_phan_loai` (`classification_thresholds`)<br>`phu_luc_phap_ly` (`legal_appendices`)<br>`du_an` (`projects`)<br>`xac_minh_yeu_to_nhay_cam_du_an` (`project_sensitive_verifications`)<br>`nhat_ky_truy_van` (`query_logs`) | `backend/fixtures/classification-catalog.js` (seed/test/fallback)<br>`frontend/src/data/classification-db.js` (**LEGACY — không còn import runtime**) | `backend/tests/classification-p0.test.js`<br>`backend/tests/exhaustive-catalog-coverage.test.js`<br>`backend/tests/routes-and-parity.test.js`<br>`backend/tests/postgres-integration.test.js`<br>`tests/e2e-system.spec.js` (`E2E-03`) |
| **2. Không gian GIS & Địa giới hành chính** | `frontend/src/components/MapTab.vue`<br>`frontend/src/components/ClassifyTab.vue`<br>`frontend/src/composables/useAdministrativeDivisions.js`<br>`frontend/src/utils/map-layers.js` | `backend/routes/classification.js`<br>- `POST /api/classification/spatial-check`<br>- `GET /api/classification/gis-layers`<br>- `GET /api/classification/administrative-units/locate`<br>- `GET /api/classification/administrative-units/:code/boundary`<br>`backend/routes/projects.js`<br>- `GET /api/projects/geo`<br>- `PATCH /api/projects/:id/location` | `backend/services/spatial-gis-service.js`<br>`backend/services/administrative-boundary-service.js` | `backend/services/project-verification-repository.js` (`ensureGisSchema`, `seedGisLayers`, `loadGisLayers`, `evaluateSpatialLayers`) | `lop_ban_do` (`gis_layers`) — cột `hinh_hoc` JSONB & `hinh_hoc_khong_gian geometry(Geometry, 4326)`<br>`du_an` (`projects`) — cột `vi_tri_khong_gian geometry(Point, 4326)` | `VIETNAM_SENSITIVE_ZONES` (25 lớp, 2 Polygon mẫu), `VIETNAM_INDUSTRIAL_PARKS` (32 lớp, 2 Polygon mẫu), `VIETNAM_LAND_BORDER_POLYLINE`, `VIETNAM_COASTLINE_POLYLINE` trong `spatial-gis-service.js`; `frontend/src/data/vietnam-divisions.json` | `backend/tests/spatial-postgis.test.js`<br>`backend/tests/administrative-boundaries.test.js`<br>`backend/tests/postgres-integration.test.js` (`L296`, `L343`)<br>`tests/e2e-system.spec.js` (`E2E-05`) |
| **3. Đối chiếu Quy chuẩn Kỹ thuật (QCVN)** | `frontend/src/components/QCVNTab.vue`<br>`frontend/src/utils/qcvn-evaluator.js`<br>`frontend/src/utils/qcvn-keywords.js` | `backend/routes/qcvns.js`<br>- `GET /api/qcvns`<br>- `POST /api/qcvns/select`<br>- `POST /api/qcvns/evaluate`<br>- `GET/POST/DELETE /api/qcvns/samples` | `backend/services/qcvn-service.js`<br>`frontend/src/utils/qcvn-evaluator.js` (dùng chung cho backend & frontend)<br>`backend/services/runtime-policy.js` | `backend/services/rule-repository.js` (`ensureQcvnSchema`, `seedQcvnCatalog`, `loadQcvnCatalog`, `upsertTransitionalQcvn`, `verifyAndPublishQcvn`) | `quy_chuan_qcvn` (`qcvns`)<br>`mau_quan_trac_qcvn` (`qcvn_samples`) | `frontend/src/data/qcvn-db.js` (35 bảng QCVN — nguồn seed/test/fallback) | `backend/tests/qcvn-p0.test.js`<br>`backend/tests/exhaustive-catalog-coverage.test.js` (`L109`)<br>`backend/tests/routes-and-parity.test.js`<br>`tests/e2e-system.spec.js` (`E2E-04`) |
| **4. Thư viện Văn bản, Crawler & Kiểm duyệt Quy tắc** | `frontend/src/components/LawsTab.vue`<br>`frontend/src/components/AdminTab.vue`<br>`frontend/src/App.vue` | `backend/routes/laws.js`<br>- `GET /api/laws/active-basis`<br>- `GET/POST/PUT/DELETE /api/laws`<br>`backend/routes/crawler.js`<br>- `GET/POST /api/crawler/settings`, `POST /api/crawler/run`, `GET /api/crawler/history`<br>`backend/routes/admin-rules.js`<br>- `/impacts`, `/candidates`, `/catalog`, `/thresholds`, `/verify`, `/qcvns/transitional/upsert` | `backend/utils/crawler.js`<br>`backend/utils/scheduler.js`<br>`backend/services/crawler-sync-service.js` | `backend/services/rule-repository.js` | `luat` (`laws`)<br>`lich_su_cap_nhat_van_ban` (`law_update_history`)<br>`anh_huong_quy_tac_van_ban` (`law_rule_impacts`)<br>`de_xuat_quy_tac` (`rule_candidates`)<br>`quy_tac` (`rules`)<br>`phien_ban_quy_tac` (`rule_versions`) | Danh sách seed văn bản trong `backend/init-db.js` / `db-bootstrap.js` | `backend/tests/routes-and-parity.test.js` (`L340`, `L1058`, `L1148`)<br>`backend/tests/postgres-integration.test.js` (`L414`)<br>`tests/e2e-system.spec.js` (`E2E-01`, `E2E-06`) |
| **5. Nhắc hạn Tuân thủ & Dashboard** | `frontend/src/components/DashboardTab.vue` | `backend/routes/reminders.js`<br>`backend/routes/dashboard.js` (`GET /api/dashboard/stats`) | `backend/services/compliance-reminder-service.js`<br>`backend/services/dashboard-service.js` | `backend/services/compliance-reminder-service.js`<br>`backend/services/dashboard-service.js` | `nghia_vu_tuan_thu` (`compliance_obligations`)<br>`du_an`, `mau_quan_trac_qcvn`, `luat` | Không dùng fixture tĩnh | `backend/tests/compliance-reminder.test.js`<br>`backend/tests/routes-and-parity.test.js` (`L59`, `L340`)<br>`tests/e2e-system.spec.js` (`E2E-05`) |
| **6. Xác thực, RBAC, Quản trị & Schema Bootstrap** | `frontend/src/components/AuthModal.vue`<br>`frontend/src/components/AdminTab.vue` | `backend/routes/auth.js`<br>`backend/routes/admin.js` (`/users`, `/projects`, `/audit-logs`) | `backend/middleware/auth.js`<br>`backend/utils/audit.js`<br>`backend/services/db-bootstrap.js`<br>`backend/services/vietnamese-schema.js` | `backend/config/db.js`<br>`backend/services/db-bootstrap.js`<br>`backend/services/vietnamese-schema.js` | `nguoi_dung` (`users`)<br>`nhat_ky_kiem_toan` (`audit_logs`)<br>`cai_dat_he_thong` (`system_settings`) | `docs/etc_legalhub_schema.sql`<br>`docs/migrate_vietnamese_values.sql` | `backend/tests/routes-and-parity.test.js` (`L873`, `L897`, `L1058`)<br>`tests/e2e-system.spec.js` (`E2E-02`, `E2E-06`) |

---

## 3. Kiểm kê Nguồn Dữ liệu Tĩnh & Di sản (Legacy Check)

| Tệp dữ liệu tĩnh | Nơi import trong mã nguồn thực tế (quét toàn repo) | Phân loại vai trò | Ghi chú kiểm toán |
| :--- | :--- | :--- | :--- |
| `backend/fixtures/classification-catalog.js` | `classification-service.js`, `classification-rule-helpers.js`, `db-bootstrap.js`, `rule-repository.js`, `classification-p0.test.js`, `exhaustive-catalog-coverage.test.js`, `postgres-integration.test.js`, `run-chapter3-evaluation.js` | **Seed / Test / Dev-Fallback Fixture** | Chứa 39 ngành, 143 ngưỡng; **100% (143/143) ngưỡng gốc mang `NEEDS_LEGAL_VERIFICATION`** và **39/39 ngành có `auditNote`**. Không được coi mặc nhiên là căn cứ pháp lý đã xác minh độc lập. |
| `frontend/src/data/classification-db.js` | **0 file `.js`/`.vue` runtime import** (chỉ được nhắc tên trong `docs/03-co-so-du-lieu-api-van-hanh.md`) | **LEGACY / UNUSED** | An toàn để lưu trữ hoặc gỡ bỏ ở giai đoạn refactor sau khi kiểm tra lại lần cuối. Không ảnh hưởng runtime hiện tại (`useClassificationCatalog.js` gọi `GET /api/classification/metadata`). |
| `frontend/src/data/qcvn-db.js` | `backend/services/qcvn-service.js` (`getFallbackQcvnFixture`), `db-bootstrap.js`, `qcvn-p0.test.js`, `exhaustive-catalog-coverage.test.js`, `postgres-integration.test.js` | **Seed / Test / Dev-Fallback Fixture** | Chứa 35 bảng QCVN; `qcvn-service.js` chỉ dùng làm fallback khi `isStaticFallbackAllowed() === true` và bắt buộc gắn `ruleSource: 'FALLBACK_UNVERIFIED'`. |
| `backend/services/spatial-gis-service.js` (`VIETNAM_SENSITIVE_ZONES`, `VIETNAM_INDUSTRIAL_PARKS`) | `db-bootstrap.js`, `enable-postgis.js`, `spatial-gis-service.js`, `postgres-integration.test.js` | **Seed / Fallback GIS** | Chứa 25 vùng nhạy cảm (2 có `Polygon` GeoJSON: `vqg_cat_tien`, `kdt_can_gio`) và 32 KCN (2 có `Polygon` GeoJSON: `kcn_hiep_phuoc`, `kcn_vsip_1`). Đường biên giới & đường bờ biển vẫn là mảng polyline tĩnh trong JS. |

---

## 4. Điểm Nóng Về Kích thước File (Ứng viên Refactor Giai đoạn sau)

| Tệp | Số dòng hiện tại | Lý do cần lưu ý |
| :--- | :---: | :--- |
| `backend/services/rule-repository.js` | ~1.600 | Gộp schema, seed, load catalog, duyệt candidate, cập nhật ngưỡng và QCVN |
| `backend/services/classification-service.js` | 1.171 | Gộp validate input, 3 bước suy diễn, giải trình và đánh giá dự án đã lưu |
| `backend/services/project-verification-repository.js` | 694 | Gộp xác minh vùng nhạy cảm dự án và quản trị schema/truy vấn PostGIS |
| `backend/utils/crawler.js` | 519 | Gộp tải sitemap, chuẩn hóa HTML, phát hiện hết hiệu lực và ghi lịch sử |
| `backend/routes/projects.js` & `backend/routes/qcvns.js` | 531 / 503 | Chứa cả route xử lý, kiểm tra quyền và luồng tính toán lại tại máy chủ |
| `frontend/src/components/ClassifyTab.vue` | File component lớn | Gộp form nhập liệu, bản đồ, kết quả phân loại và hộp thoại lưu dự án |
