# Mẫu Truy vết Quy tắc Pháp lý & Kiểm kê 143 Ngưỡng (`Legal_Rule_Traceability_Template.md`)

> **Commit baseline:** `69b39e3`  
> **Nguồn kiểm kê:** `backend/fixtures/classification-catalog.js`, `docs/etc_legalhub_schema.sql` (`nganh_nghe`, `nguong_phan_loai`), `backend/services/classification-service.js`.  
> **Nguyên tắc kiểm toán:** Tài liệu này **không tự xác nhận** tính đúng đắn pháp lý của bất kỳ ngưỡng nào và **không thay đổi** trạng thái `NEEDS_LEGAL_VERIFICATION`.

---

## 1. Cấu trúc Bản ghi Truy vết Pháp lý Chuẩn & Đối chiếu GAP với Schema Hiện tại

| Trường truy vết chuẩn (theo yêu cầu kiểm toán) | Trạng thái trong Schema/Code hiện tại | Bảng / Cột tương ứng trong PostgreSQL (`etc_legalhub_schema.sql`) | Ghi chú `GAP` |
| :--- | :---: | :--- | :--- |
| `rule_id` | `IMPLEMENTED` (DB) / `GAP` (Output API) | `nguong_phan_loai.ma` (`SERIAL PK`) | DB có khóa chính `ma`, nhưng `evaluateClassification()` chưa gắn `thresholdId` vào JSON kết quả trả về. |
| `industry_code` | `IMPLEMENTED` | `nguong_phan_loai.nganh_nghe_ma` | Đầy đủ 39/39 ngành. |
| `process_stage` | `IMPLEMENTED` | `nguong_phan_loai.cong_doan` | Đầy đủ 12 công đoạn trên 6 ngành phân nhánh. |
| `min`, `max`, `operator`, `unit` | `IMPLEMENTED` | `gia_tri_toi_thieu`, `gia_tri_toi_da`, `toan_tu`, `don_vi` | Fixture đủ `min`/`operator`; nhiều dòng fixture để `max = null` (suy theo thứ tự sắp giảm dần). |
| `group`, `procedure`, `authority` | `IMPLEMENTED` | `nhom_du_an`, `ho_so_phap_ly`, `tham_quyen`, `tham_quyen_lich_su` | Đầy đủ 143/143 ngưỡng. |
| `legal_document`, `article_or_appendix` | `PARTIALLY_IMPLEMENTED` | `can_cu_phap_ly`, `phu_luc`, `luat_ma`, `phu_luc_phap_ly_ma` | Đủ chuỗi tóm tắt `ref` (`0` ngưỡng trống), nhưng **nhiều ngưỡng chỉ ghi chung** (VD: `"NĐ 08/2022 (VBHN 49/2026)"`) chưa trỏ chi tiết tới số thứ tự dòng/mục của Phụ lục II/III/IV. |
| `source_url` | **`GAP`** | Chưa có cột riêng trên `nguong_phan_loai` (mới có `luat.duong_dan` ở bảng `luat`) | Cần liên kết bắt buộc `luat_ma` $\rightarrow$ `luat.duong_dan` hoặc bổ sung ở bảng đối chiếu ngoài. |
| `effective_from`, `effective_to` | `IMPLEMENTED` | `hieu_luc_tu` (`DATE`), `hieu_luc_den` (`DATE`) | 143/143 ngưỡng trong fixture đều có `effectiveFrom = '2026-01-29'`; `effectiveTo` hiện để trống (đang hiệu lực mở). |
| `rule_version` | `IMPLEMENTED` | `phien_ban_quy_tac` (`'2026.2-audit'`) | Đang dùng chung phiên bản cho toàn bộ bộ seed nền. |
| `verification_status` | `IMPLEMENTED` | `trang_thai_xac_minh` | **143/143 ngưỡng trong fixture gốc mang `NEEDS_LEGAL_VERIFICATION`**. Lưu ý: `db-bootstrap.js` (`promoteBaselineCatalogOnce`) và `sandbox-db-adapter.js` có cơ chế nâng trạng thái nền phục vụ demo — cần phân biệt rõ với **xác minh chuyên môn độc lập**. |
| `verified_by`, `verified_at` | `PARTIALLY_IMPLEMENTED` | `nguoi_duyet` (`VARCHAR`), `duyet_luc` (`TIMESTAMP`) | Lưu tài khoản `admin` (vai trò kỹ thuật phần mềm), **chưa tách biệt danh tính/chức danh chuyên gia pháp lý độc lập**. |
| `evidence_hash` (`source_file_sha256`) | **`GAP`** | Chưa có cột trên `nguong_phan_loai` / `quy_chuan_qcvn` | Cần bổ sung trong bộ benchmark/manifest ngoài hoặc giai đoạn nâng cấp DB sau. |

---

## 2. Thống kê Kiểm kê Thực tế 39 Ngành & 143 Ngưỡng trong `classification-catalog.js`

- **Tổng số ngành nghề:** `39` ngành.
- **Số ngành có phân nhánh công đoạn (`processRules`):** `6` ngành (`thep`, `nhiet_dien`, `hoa_chat`, `giay_bot`, `det_nhuom`, `dien_tu`) gồm tổng cộng **`12` công đoạn**.
- **Tổng số ngưỡng phân loại (`t` + `processRules`):** `143` ngưỡng.
- **Số ngành có ghi chú kiểm toán (`auditNote`) yêu cầu đối chiếu lại văn bản gốc:** **`39 / 39` ngành (100%)**.
- **Số ngưỡng trong fixture có `verificationStatus === 'NEEDS_LEGAL_VERIFICATION'`:** **`143 / 143` ngưỡng (100%)**.
- **Số ngưỡng thiếu `ref` hoặc thiếu `effectiveFrom`:** `0 / 143`.

---

## 3. Danh mục 39 Ngành Cần Chuyên viên Đối chiếu Văn bản Gốc (Trích từ `auditNote`)

| STT | Mã ngành (`code`) | Tên ngành | Số công đoạn | Số ngưỡng | Trạng thái gốc trong fixture | Tóm tắt nội dung cần đối chiếu pháp lý (`auditNote`) |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| 1 | `che_bien_go` | Chế biến gỗ, dăm gỗ, ván nhân tạo | 0 | 4 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu mốc `200.000 / 50.000 / 5.000` với đúng dòng phụ lục hiện hành |
| 2 | `xi_mang` | Xi măng, clinker | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Phân biệt công suất clinker với xi măng sản phẩm và đơn vị tính |
| 3 | `thep` | Luyện kim, sản xuất thép, phôi thép | 2 | 7 | `NEEDS_LEGAL_VERIFICATION` | Tách luyện từ quặng/phế liệu với cán thép, gia công cơ khí |
| 4 | `nhiet_dien` | Nhiệt điện (than, khí, sinh khối) | 2 | 7 | `NEEDS_LEGAL_VERIFICATION` | Tách nhiệt điện than (ngưỡng sơ bộ 600 MW) với nhiệt điện khí/sinh khối |
| 5 | `khai_thac_ks` | Khai thác khoáng sản rắn | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Phân biệt khai thác với chế biến khoáng sản độc hại/kim loại |
| 6 | `hoa_chat` | Hóa chất, phân bón, thuốc BVTV | 2 | 8 | `NEEDS_LEGAL_VERIFICATION` | Kiểm tra ngưỡng riêng giữa hóa chất vô cơ cơ bản, phân bón và BVTV |
| 7 | `giay_bot` | Giấy, bột giấy, carton | 2 | 10 | `NEEDS_LEGAL_VERIFICATION` | Phân biệt sản xuất bột giấy/nguyên liệu tái chế với gia công giấy |
| 8 | `det_nhuom` | Dệt, nhuộm, hoàn tất vải sợi | 2 | 8 | `NEEDS_LEGAL_VERIFICATION` | Kiểm tra đơn vị triệu m²/năm (vải) và tấn/năm (sợi) khi có nhuộm giặt |
| 9 | `thuc_pham` | Chế biến thực phẩm, đồ uống, thủy sản | 0 | 5 | `NEEDS_LEGAL_VERIFICATION` | Đang gộp nhiều tiểu ngành (bia, đường, thủy sản, tinh bột sắn...) |
| 10 | `nhua_cao_su` | Nhựa, cao su tổng hợp | 0 | 4 | `NEEDS_LEGAL_VERIFICATION` | Đang gộp nhựa và cao su tổng hợp; cần tách hạt nhựa nguyên sinh/tái chế |
| 11 | `cao_su_cb` | Chế biến mủ cao su tự nhiên | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Đã đối chiếu sơ bộ ngưỡng lớn `>= 15.000`; cần ký duyệt chính thức |
| 12 | `duoc_pham` | Dược phẩm, sinh phẩm, mỹ phẩm | 0 | 4 | `NEEDS_LEGAL_VERIFICATION` | Chưa đủ căn cứ dòng phụ lục cho mốc `10.000 / 1.000 / 100 tấn` |
| 13 | `dien_tu` | Điện tử, bán dẫn, linh kiện công nghệ | 2 | 8 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu ngưỡng 50 triệu sản phẩm/năm và 100.000 sản phẩm/năm |
| 14 | `vat_lieu_xd` | Vật liệu xây dựng (gạch, ngói, gốm sứ) | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Gộp gạch, ngói, gốm sứ vào một bộ ngưỡng chung |
| 15 | `kcn` | Khu công nghiệp / KCX / Khu kinh tế | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Không chỉ dùng diện tích KCN mà cần xét loại hình thu hút/hạ tầng |
| 16 | `khu_cong_nghe` | Khu công nghệ cao, cụm công nghiệp | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Gộp khu công nghệ cao và cụm công nghiệp; cần đối chiếu điều kiện riêng |
| 17 | `xl_chat_thai` | Cơ sở tái chế, xử lý chất thải rắn | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Cần tách rõ xử lý CTNH với CTR sinh hoạt/công nghiệp thông thường |
| 18 | `xl_nuoc_thai` | Hệ thống xử lý nước thải tập trung | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Phân biệt hệ thống XLNT tập trung độc lập với công trình nội bộ dự án |
| 19 | `khai_thac_nuoc` | Khai thác tài nguyên nước | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Gộp nước mặt và nước dưới đất; cần đối chiếu thêm Luật Tài nguyên nước |
| 20 | `khai_thac_dau_khi` | Khai thác dầu khí | 0 | 1 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu phạm vi nhóm lớn theo phụ lục hiện hành |
| 21 | `do_thi` | Khu đô thị, nhà ở, chung cư | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Gắn mốc 300 ha và 50 ha với đúng tiêu chí phân loại dự án đầu tư công/đất |
| 22 | `cao_toc` | Đường cao tốc, quốc lộ, đường bộ | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Cần xét cấp kỹ thuật đường bộ và quy mô sử dụng đất |
| 23 | `duong_sat` | Đường sắt, đường sắt đô thị | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Cần xét loại tuyến và điều kiện pháp lý cụ thể |
| 24 | `cang_bien` | Cảng biển, bến cảng nước sâu | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Chưa xác minh mốc 30 và 1 triệu tấn/năm theo loại cảng |
| 25 | `cang_hang_khong` | Cảng hàng không, sân bay | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Chưa xác minh mốc 5 triệu hành khách/năm |
| 26 | `trung_tam_tm` | Trung tâm thương mại, siêu thị, văn phòng | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Không chỉ dựa vào diện tích sàn; phải xét diện tích sử dụng đất & xả thải |
| 27 | `khach_san` | Khách sạn, resort, khu du lịch | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Không chỉ dựa vào số phòng; phải xét diện tích sử dụng đất & vùng nhạy cảm |
| 28 | `benh_vien` | Bệnh viện, phòng khám, cơ sở y tế | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Không chỉ dựa vào số giường bệnh; phải xét nước thải y tế & CTNH |
| 29 | `nuoi_thuy_san` | Nuôi trồng thủy sản nước ngọt/lợ | 0 | 4 | `NEEDS_LEGAL_VERIFICATION` | Phải xét phương pháp nuôi (thâm canh, bán thâm canh, quảng canh) |
| 30 | `nuoi_ts_bien` | Nuôi trồng thủy sản trên biển | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu diện tích khu vực biển giao nuôi và thẩm quyền giao biển |
| 31 | `xu_ly_ctnh` | Xử lý, tiêu hủy chất thải nguy hại | 0 | 1 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu đầy đủ điều kiện nhóm I theo phụ lục hiện hành |
| 32 | `xu_ly_ctr` | Xử lý chất thải rắn SH/CN thông thường | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu ngưỡng công suất xử lý tại Phụ lục II, III, IV |
| 33 | `bai_rac` | Bãi chôn lấp chất thải | 0 | 2 | `NEEDS_LEGAL_VERIFICATION` | Đối chiếu công suất tiếp nhận (tấn/ngày) và quy mô bãi chôn lấp |
| 34 | `chan_nuoi` | Chăn nuôi gia súc, gia cầm tập trung | 0 | 4 | `NEEDS_LEGAL_VERIFICATION` | Đã đối chiếu sơ bộ theo ĐVVN (lớn >= 3.000); cần xác nhận đủ các bậc dưới |
| 35 | `thuy_dien` | Thủy điện | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Chưa xác minh mốc 50 MW / 10 MW là tiêu chí duy nhất (cần xét dung tích hồ) |
| 36 | `dien_mat_troi` | Nhà máy điện mặt trời | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Chưa xác minh mốc 100 MWp / 10 MWp (phải xét diện tích sử dụng đất) |
| 37 | `dien_gio` | Nhà máy điện gió | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Chưa xác minh mốc công suất; cần tách trên bờ và ngoài khơi |
| 38 | `nao_vet` | Nạo vét luồng hàng hải, kênh rạch | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Cần xét loại luồng, khu vực nhận chìm và tính chất bùn nạo vét |
| 39 | `ho_chua` | Hồ chứa nước, công trình thủy lợi | 0 | 3 | `NEEDS_LEGAL_VERIFICATION` | Phân biệt hồ chứa, đập thủy lợi và yếu tố liên tỉnh |

---

## 4. Mẫu Record Truy vết Đề xuất cho Chuyên viên Rà soát (CSV/JSON Schema)

```json
{
  "rule_id": "THR-det_nhuom-dyeing_washing-01",
  "industry_code": "det_nhuom",
  "process_stage": "dyeing_washing",
  "min": 50,
  "max": null,
  "operator": ">=",
  "unit": "triệu m²/năm hoặc tấn sợi/năm",
  "project_group": "Nhóm I",
  "procedure": "DTM",
  "authority": "cap_bo",
  "legal_document": "49/VBHN-BNNMT (hợp nhất NĐ 08/2022, NĐ 05/2025, NĐ 48/2026)",
  "article_or_appendix": "Phụ lục II, Mục 8 & Phụ lục III",
  "source_url": "https://vanban.chinhphu.vn/...",
  "effective_from": "2026-01-29",
  "effective_to": null,
  "rule_version": "2026.2-audit",
  "verification_status": "NEEDS_LEGAL_VERIFICATION",
  "verified_by": null,
  "verified_role": "Chuyên viên/Chuyên gia pháp lý môi trường (chưa xác nhận)",
  "verified_at": null,
  "evidence_hash": null
}
```
