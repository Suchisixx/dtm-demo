# Dispatch: Codebase, Architecture & Legal Engine Explorer

## Objective
Rà soát toàn diện codebase, cấu trúc cơ sở dữ liệu, crawler pháp lý và các quy tắc nghiệp vụ theo 3 nguyên tắc bất biến trong `AGENTS.md` và `SKILL.md`:
1. **Single Database Source of Truth**:
   - Kiểm tra `backend/services/rule-repository.js`, `backend/init-db.js`, `backend/routes/`, và các file tĩnh trong `frontend/src/data/`.
   - Xác định xem có nơi nào fallback tĩnh mà không đánh dấu `FALLBACK_UNVERIFIED` hoặc không hạ trạng thái xuống `NEEDS_REVIEW` không.
   - Kiểm tra logic seed/init-db có nguy cơ truncate hoặc ghi đè bản ghi VERIFIED/PUBLISHED không.
2. **Fail-Closed Legal & Completeness Gates**:
   - Kiểm tra `backend/services/classification-service.js`, `backend/routes/classification.js`, `backend/routes/projects.js`:
     + Ngành lạ -> UNKNOWN_INDUSTRY / NEEDS_REVIEW (có fallback ngầm về Nhóm IV/DKMT/cap_xa không?)
     + Ngành có processRules (thép, nhiệt điện, hóa chất, giấy, dệt nhuộm, điện tử) -> thiếu processStage có trả NEEDS_REVIEW không?
     + Capacity âm, NaN, rỗng -> INVALID_CAPACITY / NEEDS_REVIEW.
     + Sensitive criteria verified -> có tin cậy trực tiếp từ client không?
   - Kiểm tra `backend/services/qcvn-service.js`, `backend/routes/qcvns.js`:
     + Thiếu flowRate -> MISSING_FLOW_RATE / NEEDS_REVIEW (có tự gán 100 m3/ngày không?)
     + receivingWaterConfirmed chưa xác nhận -> MISSING_RECEIVING_SOURCE / NEEDS_REVIEW (có tự gán cột B không?)
     + Cơ sở cũ chuyển tiếp thiếu bảng QCVN 40:2011/14:2008 -> TRANSITION_TABLE_NOT_AVAILABLE / NEEDS_REVIEW (có map ẩu sang 2025 không?)
     + Thiếu chỉ tiêu bắt buộc / lệch chu kỳ -> INCOMPLETE / PERIOD_MISMATCH (có gán pass không?)
   - Kiểm tra `backend/routes/dashboard.js`: có đếm nhầm mẫu INCOMPLETE, NEEDS_REVIEW, PERIOD_MISMATCH vào `dat`/`passSamples` không?
3. **Server-Authoritative Evaluation**:
   - `POST /api/projects` và `POST /api/qcvns/samples` có tính toán lại hoàn toàn kết quả phân loại, thẩm quyền, QCVN trên server không? Có lưu metadata truy xuất (`ruleSource`, `ruleVersion`, `verificationStatus`, `evaluationDate`) không?
4. **UI-Engine-DB Parity**:
   - Dropdown ngành trên frontend có đồng bộ với `GET /api/classification/metadata` không?
   - 6 ngành có processRules đã có metadata và seed đầy đủ chưa?
   - `MAP_KEYWORDS` trong frontend có chuẩn hóa đúng tên chỉ tiêu QCVN không?
   - `permitLimits` có hỗ trợ đủ 3 loại `max`, `min`, `range` (ví dụ pH) không?
5. **Crawler & Database Engine**:
   - Rà soát mã nguồn crawler (`backend/crawler/` hoặc tương tự): nguồn crawl, cơ chế phân tích văn bản, trích xuất phụ lục, lưu trữ DB.
   - Xác định các lỗi logic, thiếu exception handling, hoặc dữ liệu crawler chưa được validate.
6. KHÔNG ĐƯỢC CHỈNH SỬA BẤT KỲ MÃ NGUỒN ỨNG DỤNG NÀO trong đợt rà soát này.

## Input Information
- Workspace: `d:\ĐATN\demo`
- Workspace rules: `d:\ĐATN\demo\AGENTS.md`
- Skill guide: `d:\ĐATN\demo\.agents\skills\legalhub-verification\SKILL.md`
- Original request: `d:\ĐATN\demo\.agents\teamwork\ORIGINAL_REQUEST.md`
- Project scope: `d:\ĐATN\demo\.agents\teamwork\orchestrator\PROJECT.md`

## Output Requirements
- Ghi báo cáo chi tiết vào file `d:\ĐATN\demo\.agents\teamwork\explorer_codebase\handoff.md`.
- Danh mục lỗi được phân loại theo:
  + Tệp tin & dòng code cụ thể
  + Nguyên nhân gốc rễ
  + Mức độ nghiêm trọng (Critical, High, Medium, Low)
  + Phương án khắc phục chi tiết


## 2026-11-13T05:52:06Z
Received from orchestrator (2c6a2673-9d1d-4b4b-8d20-f9c9c65a3770):
You are the Codebase, Architecture & Legal Engine Explorer for LegalHub project at d:\ĐATN\demo.
Read your dispatch instructions at d:\ĐATN\demo\.agents\teamwork\explorer_codebase\DISPATCH.md and d:\ĐATN\demo\.agents\teamwork\ORIGINAL_REQUEST.md.
Also read d:\ĐATN\demo\AGENTS.md and d:\ĐATN\demo\.agents\skills\legalhub-verification\SKILL.md.
