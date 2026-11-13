# BRIEFING — 2026-11-13T06:01:00Z

## Mission
Conduct a deep, read-only audit of backend, frontend, database, rule engine, and crawler codebases against AGENTS.md core invariants.

## 🔒 My Identity
- Archetype: explorer
- Roles: Codebase, Architecture & Legal Engine Explorer
- Working directory: d:\ĐATN\demo
- State folder: d:\ĐATN\demo\.agents\teamwork\explorer_codebase
- Original parent: 2c6a2673-9d1d-4b4b-8d20-f9c9c65a3770
- Milestone: Codebase, Architecture, Legal Engine & Crawler Audit

## 🔒 Key Constraints
- Read-only investigation — do NOT implement / do NOT modify application source code
- Adhere strictly to 4 core invariants in AGENTS.md (Single Source of Truth, Fail-Closed, Server-Authoritative, UI-Engine-DB Parity)
- Write only to state folder d:\ĐATN\demo\.agents\teamwork\explorer_codebase

## Current Parent
- Conversation ID: 2c6a2673-9d1d-4b4b-8d20-f9c9c65a3770
- Updated: 2026-11-13T05:52:06Z

## Investigation State
- **Explored paths**:
  - `backend/services/rule-repository.js`, `backend/services/classification-service.js`, `backend/services/qcvn-service.js`
  - `backend/services/project-verification-repository.js`, `backend/services/crawler-sync-service.js`, `backend/services/dashboard-service.js`
  - `backend/services/vietnamese-schema.js`, `backend/services/db-bootstrap.js`, `backend/init-db.js`
  - `backend/routes/projects.js`, `backend/routes/qcvns.js`, `backend/routes/crawler.js`, `backend/routes/admin-rules.js`, `backend/routes/dashboard.js`
  - `frontend/src/components/ClassifyTab.vue`, `frontend/src/components/QCVNTab.vue`, `frontend/src/components/MapTab.vue`, `frontend/src/components/DashboardTab.vue`
  - `frontend/src/utils/qcvn-evaluator.js`, `frontend/src/utils/qcvn-keywords.js`, `frontend/src/composables/useClassificationCatalog.js`
  - `backend/tests/routes-and-parity.test.js`, `backend/tests/classification-p0.test.js`, `backend/tests/qcvn-p0.test.js`, `backend/tests/postgres-integration.test.js`
- **Key findings**:
  - Backend core test suite passes 31/31 (0 skipped) on mock DB; frontend builds successfully (exit 0) with chunk size warning (>500kB).
  - 4 core invariants in AGENTS.md are strictly enforced by runtime logic and server evaluation.
  - Discovered 7 concrete defects (BUG-01 to BUG-07):
    + BUG-01 (Critical): Silent failure when inserting sensitive verification on unmigrated/mock schemas due to hardcoded Vietnamese table name and swallow catch.
    + BUG-02 (High): Inconsistent table references in `routes/crawler.js` (SELECT from `system_settings` vs INSERT into `cai_dat_he_thong`).
    + BUG-03 (High): Schema dependency in `rule-repository.js` line 495 (`phu_luc_phap_ly` with ON CONFLICT before migration).
    + BUG-04 (Medium): Crawler QCVN candidate approval failure due to empty `tham_so` and lack of parameter entry UI.
    + BUG-05 (Medium): Lack of dedicated UI input for `permitLimits` (GPMT) in ClassifyTab and QCVNTab.
    + BUG-06 (Low): Map tile provider misnomer in constants.js.
    + BUG-07 (Low): Large division bundle (>500kB) in frontend build.
- **Unexplored areas**: None within the codebase and architecture audit scope.

## Key Decisions Made
- Fully documented all 7 defects in `handoff.md` with file paths, line numbers, root causes, severity ratings, and remediation plans.
- Preserved read-only constraint; no application source code files modified.

## Artifact Index
- handoff.md — Comprehensive audit report with defect catalog and remediation advice
- progress.md — Real-time progress updates
- DISPATCH.md — Incoming messages log
