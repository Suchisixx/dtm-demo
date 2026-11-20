# Kế hoạch Tái lập Thực nghiệm & Đóng gói Bằng chứng (`Reproducibility_Plan.md`)

> **Commit baseline:** `69b39e3` (nhánh `main`)  
> **Lưu ý an toàn:** Tài liệu này chỉ định nghĩa quy trình, lệnh và cấu trúc đóng gói để tái lập kiểm thử một cách cô lập, minh bạch — **không tự thực thi** bất kỳ lệnh nào ghi vào cơ sở dữ liệu đang vận hành trong Giai đoạn 1.

---

## 1. Thông tin Môi trường Baseline (Ghi nhận tĩnh)

| Thành phần | Phiên bản / Giá trị ghi nhận | Nguồn xác nhận |
| :--- | :--- | :--- |
| **Git Commit SHA / Branch** | `69b39e3` (`main`) | `git rev-parse --short HEAD` |
| **Node.js / Express** | Node.js `v24.11.0`, Express `^4.19.2` | `chapter3-empirical-results.json`, `backend/package.json` |
| **Frontend** | Vue `^3.5.40`, Vite `^8.2.0`, Leaflet `^1.9.4` | `frontend/package.json` |
| **PostgreSQL / PostGIS** | PostgreSQL `16.8`, PostGIS `3.6.2` (cần xác nhận lại trong log chạy thực tế của từng máy) | `chapter3-empirical-results.json` |
| **Playwright** | `@playwright/test ^1.65.0` (Chromium) | `package.json`, `playwright.config.js` |

---

## 2. Quy tắc Cô lập Cơ sở dữ liệu Trước Khi Chạy Kiểm thử

1. **Không bao giờ chạy kiểm thử tích hợp hay seed lên CSDL production (`etc_legalhub`):**
   - `backend/tests/postgres-integration.test.js` sử dụng biến môi trường `PG_TEST_DATABASE` (mặc định là **`etc_legalhub_test`** — hoàn toàn tách biệt với `etc_legalhub`).
   - Trước khi chạy `npm run test:pg`, bắt buộc kiểm tra `PG_TEST_DATABASE` trỏ vào CSDL test riêng và KHÔNG chứa dữ liệu thật.
2. **Kiểm soát chính sách fallback (`ALLOW_STATIC_FALLBACK`):**
   - Khi chạy kiểm chứng runtime chuẩn, thiết lập `ALLOW_STATIC_FALLBACK=false` để bảo đảm hệ thống fail-closed (`HTTP 503`) nếu DB không sẵn sàng, không âm thầm rơi về fixture tĩnh.
3. **Rà soát trước khi chạy `backend/scripts/run-chapter3-evaluation.js`:**
   - Script có gọi `ensureRuntimeDatabaseReady()` (có thể thực hiện seed/bootstrap bảng nếu thiếu) và `installSandboxDbFallbackIfNeeded(db)`.
   - Khi chạy để lấy số liệu báo cáo chính thức, bắt buộc xác minh log đầu ra ghi rõ `DB Mode: LIVE_POSTGRES` (tuyệt đối không dùng kết quả `SANDBOX_SNAPSHOT` cho bảng hiệu năng và kết quả PostGIS).

---

## 3. Bộ Lệnh Tái lập Chuẩn (Thực hiện ở Giai đoạn 2 sau khi được duyệt)

| Bước | Nhóm kiểm thử | Lệnh thực thi chuẩn | Môi trường DB | Tệp log đề xuất lưu trữ |
| :---: | :--- | :--- | :---: | :--- |
| **1** | Unit & In-Memory Integration (7 tệp) | `npm test --prefix backend` | Mock DB + Fixture | `docs/audit/logs/01-unit-and-coverage.log` |
| **2** | Real PostgreSQL + PostGIS Integration (1 tệp) | `npm run test:pg --prefix backend` *(trên DB riêng `etc_legalhub_test`)* | Real PostgreSQL 16.8 + PostGIS 3.6.2 | `docs/audit/logs/02-postgres-postgis.log` |
| **3** | Build kiểm tra Frontend | `npm run build --prefix frontend` | Không cần DB | `docs/audit/logs/03-frontend-build.log` |
| **4** | E2E Trình duyệt Chromium (Playwright) | `npx playwright test` | Express + `backend/public` + DB (ghi rõ `DB mode`) | `docs/audit/logs/04-playwright-e2e.log` |
| **5** | Thực nghiệm API & Hiệu năng (nếu chạy trên DB test cô lập) | `node backend/scripts/run-chapter3-evaluation.js` | `LIVE_POSTGRES` (xác nhận không dùng snapshot) | `docs/audit/logs/05-empirical-eval.log` |

---

## 4. Cấu trúc Gói Artifact Công khai An toàn (`REPRODUCIBILITY_MANIFEST.json`)

Để người phản biện có thể kiểm tra trên GitHub mà **không làm lộ thông tin nhạy cảm** (tuyệt đối không commit `.env`, mật khẩu, dữ liệu người dùng thật, file backup DB):

```json
{
  "commitSha": "69b39e3",
  "branch": "main",
  "generatedAt": "ISO-8601 timestamp",
  "environment": {
    "os": "Windows x64",
    "nodeVersion": "v24.11.0",
    "postgresVersion": "PostgreSQL 16.8",
    "postgisVersion": "3.6.2"
  },
  "runs": [
    {
      "name": "backend-unit-and-coverage",
      "command": "npm test --prefix backend",
      "dbMode": "MOCK_IN_MEMORY",
      "passed": 0,
      "failed": 0,
      "skipped": 0,
      "logFile": "docs/audit/logs/01-unit-and-coverage.log",
      "logSha256": "..."
    }
  ],
  "independentBenchmark": {
    "file": "docs/audit/legal-golden-cases.json",
    "caseCount": 0,
    "reviewStatus": "PENDING_EXPERT_SIGN_OFF",
    "sha256": "..."
  }
}
```
