# Project: LegalHub Comprehensive Audit & Remediation Plan

## Architecture
- Backend: Node.js / Express (`backend/server.js`, `backend/services/`, `backend/routes/`, `backend/init-db.js`)
- Frontend: Vue 3 / Vite / Tailwind (`frontend/src/App.vue`, `frontend/src/components/`)
- Database: PostgreSQL with raw pg pool / schema migrations (`industries`, `classification_thresholds`, `legal_appendices`, `qcvns`, `rules`)
- Crawler: Legal documents crawler & rule extraction (`backend/crawler/` or crawler scripts)
- Core Domains:
  1. Phân loại hồ sơ môi trường (ĐTM, GPMT, ĐKMT, Cấp bộ / tỉnh / huyện / xã)
  2. Đối chiếu QCVN (QCVN 40, QCVN 14, QCVN 19, QCVN 20, v.v., công thức tính qcvn, lưu lượng, hệ số)
  3. Dashboard & Bản đồ dự án (Giám sát, thống kê, cảnh báo vi phạm)
  4. Quản lý văn bản pháp lý & Crawler dữ liệu

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Codebase & Architecture Audit | Rà soát lỗi engine, routes, database, crawler, logic fail-closed | Audit-M1 | ORIGINAL_REQUEST §R1 |
| 2 | R2: Browser UI/UX Inspection | Kiểm tra trực tiếp trên trình duyệt bằng browser/tools, kiểm tra console logs, layout, tương tác | Audit-M2 | ORIGINAL_REQUEST §R2 |
| 3 | R3: Technical Verification & Parity | Chạy test suite backend (`npm test`), build frontend (`npm run build`), kiểm tra 3 bất biến AGENTS.md | Audit-M3 | ORIGINAL_REQUEST §R3 |
| 4 | R4: Synthesis & Prioritized Remediation Plan | Báo cáo chi tiết danh mục lỗi và lập kế hoạch khắc phục ưu tiên | Audit-M4 | ORIGINAL_REQUEST §AC |

## Milestones
| # | Name | Scope | Dependencies | Status | Key Output |
|---|------|-------|-------------|:------:|------------|
| 1 | Survey & Technical Verification | Run backend tests, frontend build, catalog test failures & build warnings | none | **DONE** | `worker_tech_verify/handoff.md` (31/31 passed) |
| 2 | Codebase & Parity Deep Audit | Audit backend routes, classification service, qcvn service, DB rules, fail-closed compliance | none | **DONE** | `explorer_codebase/handoff.md` (BUG-01 to BUG-07) |
| 3 | Browser UI & E2E Flow Inspection | Check running app, test user flows on Classify, QCVN, Map, Dashboard, Crawler tabs, capture console/layout bugs | none | **DONE** | `browser_inspector/handoff.md` (BUG-08 to BUG-14, 19 screenshots) |
| 4 | Comprehensive Report & Plan | Synthesize all findings into structured report and prioritized remediation plan | M1, M2, M3 | **DONE** | `orchestrator/AUDIT_REPORT.md` |

## Code Layout
- `backend/`: Express server, services, routes, tests
- `frontend/`: Vue 3 application, components, stores, styles
- `.agents/teamwork/`: Agent metadata, logs, screenshots, and audit reports
- Rules & Invariants: `AGENTS.md`, `.agents/skills/legalhub-verification/SKILL.md`
