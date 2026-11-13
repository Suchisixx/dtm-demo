# Handoff Report: Technical Verification & Build Status

**Date**: 2026-11-13T05:57:00Z  
**Worker**: `worker_tech_verify` (Technical Verification Worker)  
**Parent Orchestrator**: `2c6a2673-9d1d-4b4b-8d20-f9c9c65a3770`  
**Milestone**: M1 - Comprehensive Audit & Technical Verification  

---

## 1. Observation

### 1.1 Backend Test Execution (`npm test --prefix backend`)
- **Command**: `npm test --prefix backend`
- **Working Directory**: `d:\ĐATN\demo`
- **Execution Script**: `node --test tests/classification-p0.test.js tests/qcvn-p0.test.js tests/routes-and-parity.test.js tests/compliance-reminder.test.js tests/administrative-boundaries.test.js`
- **Exit Code**: `0`
- **Duration**: `692.6507ms`
- **Test Summary**:
  - Tests total: 31
  - Pass: 31
  - Fail: 0
  - Skipped: 0
  - Cancelled: 0
  - Todo: 0
- **Verbatim Output**:
```text
> etc-legalhub@1.0.0 test
> node --test tests/classification-p0.test.js tests/qcvn-p0.test.js tests/routes-and-parity.test.js tests/compliance-reminder.test.js tests/administrative-boundaries.test.js

✔ danh mục địa giới hiện hành có đủ tỉnh và đơn vị cấp xã, mã duy nhất (1.6074ms)
✔ ranh giới được truy vấn theo mã và chuẩn hóa tọa độ chuỗi (1.1618ms)
✔ tọa độ trung tâm Quận 1 cũ được xác định đúng phường hiện hành (0.4682ms)
✔ tọa độ ngoài phạm vi địa lý không được gửi tới dịch vụ (0.4426ms)
✔ API tra cứu ranh giới nhận mã đơn vị và trả GeoJSON (0.2483ms)
✔ Seed phan loai an toan: khong TRUNCATE, seed du 39 nganh + 6 processRules va giu nguyen ban ghi VERIFIED (18.3099ms)
✔ CL-01: Ma nganh khong ton tai hoac da loai bo (dien_hat_nhan, cang_song) fail-closed NEEDS_REVIEW, khong gan Nhom IV (15.3976ms)
✔ CL-02 & CL-03: Nganh co processRules thieu processStage phai chan; chon 2 processStage cho ket qua khac nhau (6.3121ms)
✔ Cong suat am hoac NaN fail-closed INVALID_CAPACITY (5.6038ms)
✔ CL-07: Rule NEEDS_LEGAL_VERIFICATION khong duoc tra ket luan chinh thuc, chi co preliminary & bi khoa export (6.6507ms)
✔ CL-14 & CL-15: Sua rule trong DB doi ket qua ngay; rule DRAFT / PENDING_REVIEW bi loai khoi runtime (7.1655ms)
✔ DB mat ket noi / offline fallback -> FALLBACK_UNVERIFIED va ep NEEDS_REVIEW (1.473ms)
✔ Phase 2 Item 5: Effective-Date Versioning & Historical Authority (evaluationDate) (9.1986ms)
✔ Phase 2 Item 6: Reject client spoofed sensitiveCriteriaVerified & escalate only on server VERIFIED (10.1262ms)
[2026-11-13T05:52:43.308Z] [INFO] [Nhắc hạn tuân thủ] Quét 1 nghĩa vụ: 1 quá hạn, 0 sắp đến hạn, 0 trong hạn.
✔ computeDeadlineStatus: phân loại chính xác 4 trạng thái tiếng Việt (qua_han, sap_den_han, trong_han, da_hoan_thanh) (1.6159ms)
✔ computeNextDueDate: tính đúng ngày kỳ tiếp theo cho chu kỳ hang_quy, sau_thang, hang_nam (0.6435ms)
✔ buildDefaultObligationsForProject & syncProjectDefaultObligations: sinh đúng nghĩa vụ và không trùng lặp (3.8536ms)
✔ CRUD, RBAC, hoàn thành tự sinh kỳ tiếp theo và quét nhắc hạn toàn hệ thống (3.0991ms)
✔ QV-01 & QV-06 & QV-07: Thieu luu luong hoac thieu/chua xac nhan nguon tiep nhan -> NEEDS_REVIEW (9.6721ms)
✔ Q-09 Transition Guard: Co so chuyen tiep QCVN 40:2011 / 14:2008 khi thieu bang cu -> NEEDS_REVIEW (khong map sang bang 2025) (2.5667ms)
✔ QV-08 & QV-09: Seed QCVN giu metadata day du, khong ghi de VERIFIED, va DB update anh huong evaluator ngay (3.9044ms)
✔ QV-10: DB QCVN loi hoac rong -> FALLBACK_UNVERIFIED va chan PASS (0.3259ms)
✔ QV-11 & QV-17 & Q-10 Range GPMT: Thieu chi tieu bat buoc, sai chu ky CO 8h vs 24h, va GPMT range pH (0.7187ms)
✔ Phase 2 Items 7 & 8: Server QCVN selection by industry, transitional gate & Admin transitional upsert (4.5004ms)
✔ Repository façade giữ nguyên API sau khi tách kho xác minh dự án và GIS (1.358ms)
✔ Server-Authoritative Routes: POST /api/projects, POST /api/qcvns/samples, GET /api/qcvns, GET /api/dashboard/stats (406.0759ms)
✔ Parity UI - Backend - Seed: loai bo fallback 100/F2, loai option chet, sua MAP_KEYWORDS & khong TRUNCATE (3.5881ms)
✔ Phase 2-3 Routes & Crawler Sync: /geo, sensitive-verification, qcvn /select+/evaluate+mismatch+IDOR, dashboard cap_xa & crawler PENDING_REVIEW (17.7358ms)
✔ UX Simplification & Vietnamese Localization Parity + DB Bootstrap Export (6.8404ms)
✔ Simplification Plan: Runtime DB Fail-Closed, Standardized Industries & Aliases, Minimal Rule Admin 3 States & QCVN Decoupling (2.7946ms)
✔ Vietnamese PostgreSQL schema map is complete and preserves legacy API identifiers (0.7479ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 692.6507
```

### 1.2 Backend PostgreSQL Integration Test (`npm run test:pg --prefix backend`)
- **Command**: `npm run test:pg --prefix backend`
- **Exit Code**: `1`
- **Result**: 0 passed, 4 failed out of 4 tests.
- **Root Cause**: `connect ETIMEDOUT ::1:5432` / `connect ETIMEDOUT 127.0.0.1:5432`.
- **Verbatim Error Trace**:
```text
> etc-legalhub@1.0.0 test:pg
> node --test tests/postgres-integration.test.js

✖ failing tests:
test at tests\postgres-integration.test.js:209:1
✖ PG Integration: Idempotent seed preserves VERIFIED rows & filters out DRAFT/PENDING_REVIEW/REJECTED (567.6055ms)
  AggregateError [ETIMEDOUT]:
      at D:\ĐATN\demo\backend\node_modules\pg-pool\index.js:45:11
      at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
      at async TestContext.<anonymous> (D:\ĐATN\demo\backend\tests\postgres-integration.test.js:71:23)
      at async TestHook.run (node:internal/test_runner/test:1113:7) {
    code: 'ETIMEDOUT',
    [errors]: [
      Error: connect ETIMEDOUT ::1:5432
      Error: connect ETIMEDOUT 127.0.0.1:5432
    ]
  }
```

### 1.3 Frontend Production Build (`npm run build --prefix frontend`)
- **Command**: `npm run build --prefix frontend`
- **Working Directory**: `d:\ĐATN\demo`
- **Execution Script**: `vite build --emptyOutDir`
- **Exit Code**: `0`
- **Build Duration**: `719ms`
- **Output Directory**: `../backend/public` (configured in `frontend/vite.config.js`)
- **Generated Assets & Bundle Sizes**:
  - `../backend/public/index.html`: `1.33 kB` (gzip: `0.62 kB`)
  - `../backend/public/assets/index-B1_dI9ss.css`: `53.77 kB` (gzip: `9.41 kB`)
  - `../backend/public/assets/index-BTsFgRzp.js`: `437.68 kB` (gzip: `118.42 kB`)
  - `../backend/public/assets/vietnam-divisions-BeaYaFZ5.js`: `589.15 kB` (gzip: `101.05 kB`)
- **Build Warning**:
```text
[plugin builtin:vite-reporter] 
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```
- The oversized chunk is `vietnam-divisions-BeaYaFZ5.js` (589.15 kB minified), containing the entire Vietnam administrative division dataset.

### 1.4 Service, Port & Database Status
- **Probed TCP Ports** (via `System.Net.Sockets.TcpClient` probe to `127.0.0.1`):
  - Port `3000` (Backend default configured in `backend/.env` & `server.js`): **CLOSED / NOT LISTENING**
  - Port `5000` (Alternative backend port): **CLOSED / NOT LISTENING**
  - Port `5173` (Vite dev server default): **CLOSED / NOT LISTENING**
  - Port `5432` (PostgreSQL default): **CLOSED / NOT LISTENING**
  - Port `8080` (Alternative service port): **CLOSED / NOT LISTENING**
- **Running Processes**:
  - `Get-Process -Name node, postgres`: No running `node.exe` or `postgres.exe` processes found.
- **Database Connection**:
  - `backend/.env` configuration: `DB_USER=postgres`, `DB_PASSWORD=123`, `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=etc_legalhub`.
  - Node connection test `db.query('SELECT 1')`: Fails with `ETIMEDOUT` to `localhost:5432`.
  - `node backend/init-db.js`: Fails with `❌ Lỗi kết nối hoặc tạo database:` due to port 5432 unreachable.
  - Local PostgreSQL installation check: Not found in `C:\Program Files\PostgreSQL` or `C:\Program Files (x86)\PostgreSQL`; `psql` and `docker` are not in system `PATH`.

---

## 2. Logic Chain

1. **Step 1: Test Suite Architecture**
   - Observations 1.1 and 1.2 demonstrate a clear architectural separation between:
     (a) Deterministic in-memory unit/route/fail-closed regression tests (`npm test`), which mock repositories or test business invariants in-process; and
     (b) Live database integration tests (`npm run test:pg`), which require an active PostgreSQL instance on `localhost:5432`.
   - The primary test suite `npm test --prefix backend` executed all 31 tests with 100% pass rate (0 failures, 0 skips) in 692ms. All core legal logic invariants (CL-01 through CL-15, QV-01 through QV-17, Fail-Closed on invalid capacity/missing flow rate/unconfirmed receiving water, Server-Authoritative route recalculation, administrative boundary GeoJSON matching) are strictly validated and passing.

2. **Step 2: Database Offline Behavior & Fail-Closed Gates**
   - Observation 1.4 confirms that PostgreSQL is not currently running on `localhost:5432`.
   - Code inspection of `backend/services/rule-repository.js` (lines 583-585, 600+) and `backend/services/classification-service.js` reveals that when PostgreSQL is unreachable:
     - In development mode (`NODE_ENV !== 'production'`), `loadClassificationCatalog` catches the error and marks `ruleSource: 'FALLBACK_UNVERIFIED'`.
     - Under `FALLBACK_UNVERIFIED`, the system automatically forces `conclusionStatus = 'NEEDS_REVIEW'`, `isOfficialConclusion = false`, and disables export of official reports (`canExportOfficialReport = false`).
     - In production mode (`NODE_ENV === 'production'` or `ALLOW_STATIC_FALLBACK === 'false'`), `runtime-policy.js` throws `RuleDataUnavailableError` (HTTP 503), preventing any unverified calculation.
   - This satisfies the mandatory "Fail-Closed Legal & Completeness Gates" and "Single Database Source of Truth" defined in `AGENTS.md`.

3. **Step 3: Frontend Packaging & Production Readiness**
   - Observation 1.3 shows that `npm run build --prefix frontend` succeeds without errors (code 0).
   - Vite builds directly into `backend/public/`, which is statically served by `backend/server.js` (lines 18-19, 38-40) when running the production server.
   - The single warning emitted during build relates to `vietnam-divisions-BeaYaFZ5.js` being 589.15 kB (> 500 kB chunk threshold). While non-fatal and functional, this represents an optimization opportunity (dynamic code splitting or lazy-loading division data).

4. **Step 4: Runtime Server Status**
   - Observation 1.4 demonstrates that neither the Express backend nor the Vite frontend dev server is currently running in the background.
   - For subagent browser testing or live UI interaction, the Express backend (`npm start --prefix backend` on port 3000) or Vite dev server (`npm run dev --prefix frontend` on port 5173 with API proxy to port 3000) will need to be launched.

---

## 3. Caveats

1. **PostgreSQL Service Offline**:
   - Because no PostgreSQL server is running on `127.0.0.1:5432`, `npm run test:pg` cannot pass until a PostgreSQL database instance is started and initialized via `npm run init-db --prefix backend`.
2. **Read-Only Scope Maintained**:
   - As mandated by the dispatch instructions, no application source code files (`.js`, `.vue`, `.json`, `.css`) were modified or touched.
3. **Browser Execution Prerequisites**:
   - Any live browser testing requires starting the server daemon (e.g. `node backend/server.js` or `npm run dev`). Because backend currently runs with fallback in absence of DB, browser workflows will operate under the `FALLBACK_UNVERIFIED` / `NEEDS_REVIEW` legal guardrails.

---

## 4. Conclusion

1. **Backend Test Suite Status**: **PASS** (31/31 passed, 0 skipped, 0 failed). All 5 core test files validate business logic, fail-closed constraints, administrative boundaries, and server-authoritative route behavior.
2. **Frontend Build Status**: **PASS** (exited code 0, bundled in 719ms to `backend/public/`). A minor non-blocking bundle size warning on `vietnam-divisions` (589 kB) was captured.
3. **Database & Services Status**:
   - Ports 3000, 5000, 5173, 5432, 8080 are currently CLOSED / not listening.
   - PostgreSQL is offline (`ETIMEDOUT`).
   - The application codebase correctly honors the fail-closed invariant by returning `FALLBACK_UNVERIFIED` and `NEEDS_REVIEW` when the database is unavailable.
4. **Actionable Recommendations for Phase 2 / Planning**:
   - [P1] Start PostgreSQL service or Docker container with database `etc_legalhub` and user `postgres/123`, then execute `npm run init-db --prefix backend` and `npm run test:pg --prefix backend` to verify live database parity.
   - [P2] In `frontend/src/composables/useAdministrativeDivisions.js` or `vite.config.js`, apply dynamic `import()` or code splitting for `vietnam-divisions.json` to eliminate the >500kB chunk warning.
   - [P3] When launching the server for browser testing, use `PORT=3000 node backend/server.js` (which serves both the API and the compiled frontend in `backend/public/`).

---

## 5. Verification Method

To independently reproduce and verify these findings:

1. **Verify Backend Tests**:
   ```powershell
   npm test --prefix backend
   ```
   *Expected*: 31 tests passed, 0 failed, duration < 1s.

2. **Verify PostgreSQL Integration Test (Live DB check)**:
   ```powershell
   npm run test:pg --prefix backend
   ```
   *Expected*: Fails with `ETIMEDOUT ::1:5432` if PostgreSQL is offline; passes 4 tests if PostgreSQL is online.

3. **Verify Frontend Build**:
   ```powershell
   npm run build --prefix frontend
   ```
   *Expected*: Build completes with exit code 0, producing assets in `backend/public/assets/`, displaying chunk size notice for `vietnam-divisions-*.js`.

4. **Verify Port & Process Status**:
   ```powershell
   powershell -Command "& { @(3000, 5000, 5173, 5432) | ForEach-Object { $p = $_; $t = New-Object System.Net.Sockets.TcpClient; try { $ar = $t.BeginConnect('127.0.0.1', $p, $null, $null); if ($ar.AsyncWaitHandle.WaitOne(500) -and $t.Connected) { Write-Output \"Port $p : OPEN\" } else { Write-Output \"Port $p : CLOSED\" }; $t.Close() } catch { Write-Output \"Port $p : CLOSED\" } } }"
   ```
   *Expected*: Outputs `Port 3000 : CLOSED`, `Port 5000 : CLOSED`, `Port 5173 : CLOSED`, `Port 5432 : CLOSED`.
