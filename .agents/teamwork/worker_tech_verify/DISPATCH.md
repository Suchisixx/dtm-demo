# Dispatch: Technical Verification & Build Worker

## Objective
Thực thi kiểm chứng kỹ thuật toàn bộ hệ thống backend và frontend theo quy chuẩn kiểm thử của dự án:
1. Chạy `npm test --prefix backend` và thu thập toàn bộ log chi tiết: số lượng test pass/fail/skip, stacktrace của mọi test thất bại, cảnh báo.
2. Chạy `npm run build --prefix frontend` và thu thập toàn bộ log chi tiết: lỗi biên dịch, cảnh báo lint/build, asset bundle size.
3. Kiểm tra xem backend và frontend server hiện có đang chạy trên các port tương ứng không (ví dụ backend port 5000/3000, frontend vite port 5173/8080/v.v.). Báo cáo trạng thái cổng mạng và process.
4. KHÔNG ĐƯỢC CHỈNH SỬA BẤT KỲ MÃ NGUỒN ỨNG DỤNG NÀO trong đợt rà soát này.

## Input Information
- Workspace: `d:\ĐATN\demo`
- Skill guide: `d:\ĐATN\demo\.agents\skills\legalhub-verification\SKILL.md`
- Original request: `d:\ĐATN\demo\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project scope: `d:\ĐATN\demo\.agents\teamwork\orchestrator\PROJECT.md`

## Output Requirements
- Ghi báo cáo chi tiết vào file `d:\ĐATN\demo\.agents\teamwork\worker_tech_verify\handoff.md`.
- Báo cáo phải bao gồm:
  + Output đầy đủ của lệnh `npm test --prefix backend` (phân tích từng ca test lỗi nếu có).
  + Output đầy đủ của `npm run build --prefix frontend` (phân tích cảnh báo/lỗi nếu có).
  + Trạng thái server & database kết nối (PostgreSQL hay in-memory/mock DB).
  + Đánh giá tổng quan về tính sẵn sàng kỹ thuật của hệ thống.


## 2026-11-13T05:51:57Z
You are the Technical Verification Worker for LegalHub project at d:\ĐATN\demo.
Read your dispatch instructions at d:\ĐATN\demo\.agents\teamwork\worker_tech_verify\DISPATCH.md and d:\ĐATN\demo\.agents\teamwork\ORIGINAL_REQUEST.md.
Also read d:\ĐATN\demo\.agents\skills\legalhub-verification\SKILL.md and d:\ĐATN\demo\AGENTS.md.

Tasks:
1. Execute `npm test --prefix backend` and capture full logs, pass/fail/skip counts, and failure traces.
2. Execute `npm run build --prefix frontend` and capture build logs, warnings, errors, and bundle info.
3. Check backend and frontend service/port status (e.g. ports 5000, 5173, etc.) and database connection status.
4. Record all findings and verification logs into d:\ĐATN\demo\.agents\teamwork\worker_tech_verify\handoff.md.
5. DO NOT modify any application source code files.
6. When completed, notify orchestrator via send_message with a concise summary.
