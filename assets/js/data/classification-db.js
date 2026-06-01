// Classification reference data.
(function (global) {
  'use strict';

const IND_DB = {
  che_bien_go:{lbl:'Chế biến gỗ / MDF (m³ sản phẩm/năm)',t:[{min:200000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 10.3',ref:'NĐ 08/2022'},{min:50000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 10.3',ref:'NĐ 08/2022'},{min:5000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39, Luật BVMT 2020'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49, Luật BVMT 2020'}]},
  xi_mang:{lbl:'Xi măng, clinker (triệu tấn clinker/năm)',t:[{min:1,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 4.1',ref:'NĐ 08/2022'},{min:0.2,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 4.1',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
  thep:{lbl:'Luyện kim, thép (triệu tấn/năm)',t:[{min:0.5,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 4.3',ref:'NĐ 08/2022'},{min:0.1,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 4.3',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
  hoa_chat:{lbl:'Hóa chất, phân bón (tấn sản phẩm/năm)',t:[{min:50000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 5',ref:'NĐ 08/2022'},{min:10000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 5',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
  giay_bot:{lbl:'Giấy, bột giấy (tấn sản phẩm/năm)',t:[{min:100000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 10.4',ref:'NĐ 08/2022'},{min:50000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 10.4',ref:'NĐ 08/2022'},{min:5000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  det_nhuom:{lbl:'Dệt, nhuộm (tấn sản phẩm/năm)',t:[{min:50000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 10',ref:'NĐ 08/2022'},{min:10000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
  thuc_pham:{lbl:'Chế biến thực phẩm, đồ uống (tấn/năm)',t:[{min:100000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:20000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:1000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  nhua_cao_su:{lbl:'Nhựa, cao su tổng hợp (tấn/năm)',t:[{min:50000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:10000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:1000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  cao_su_cb:{lbl:'Cao su chế biến (tấn mủ khô/năm)',t:[{min:30000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:5000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:1000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  duoc_pham:{lbl:'Dược phẩm (tấn sản phẩm/năm)',t:[{min:10000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:1000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:100,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  kcn:{lbl:'Khu công nghiệp / KCX (ha)',t:[{min:500,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 1.1',ref:'NĐ 08/2022'},{min:0,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 1.1',ref:'NĐ 08/2022'}]},
  do_thi:{lbl:'Khu đô thị, nhà ở (ha) — NĐ 48/2026',t:[{min:300,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III (≥300ha = lớn)',ref:'NĐ 48/2026, Điều 5'},{min:50,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV (50–300ha = trung bình)',ref:'NĐ 48/2026, Điều 5'},{min:10,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  trung_tam_tm:{lbl:'Trung tâm thương mại, văn phòng (m² sàn)',t:[{min:100000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:20000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:3000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  cao_toc:{lbl:'Đường cao tốc, quốc lộ (km)',t:[{min:100,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 7.1',ref:'NĐ 08/2022'},{min:0,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 7.1',ref:'NĐ 08/2022'}]},
  cang_bien:{lbl:'Cảng biển, bến cảng (triệu tấn/năm)',t:[{min:30,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 7.3',ref:'NĐ 08/2022'},{min:1,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 7.3',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
  thuy_dien:{lbl:'Thủy điện / điện mặt trời / điện gió (MW)',t:[{min:50,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 3.1',ref:'NĐ 08/2022'},{min:10,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 3.1',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
  benh_vien:{lbl:'Bệnh viện, cơ sở y tế (số giường bệnh)',t:[{min:1000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III, Mục 9.1',ref:'NĐ 08/2022'},{min:500,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV, Mục 9.1',ref:'NĐ 08/2022'},{min:50,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  khach_san:{lbl:'Khách sạn, resort (số phòng)',t:[{min:1000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:200,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:30,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  nuoi_thuy_san:{lbl:'Nuôi trồng thủy sản (ha mặt nước)',t:[{min:200,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:50,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:10,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  chan_nuoi:{lbl:'Chăn nuôi gia súc, gia cầm (đơn vị vật nuôi)',t:[{min:100000,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:10000,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:1000,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'},{min:0,hs:'DKMT',tq:'cap_huyen',phu_luc:'—',ref:'Điều 49'}]},
  nao_vet:{lbl:'Nạo vét luồng hàng hải (triệu m³ bùn)',t:[{min:5,hs:'DTM',tq:'cap_bo',phu_luc:'Phụ lục III',ref:'NĐ 08/2022'},{min:0.5,hs:'DTM',tq:'cap_so',phu_luc:'Phụ lục IV',ref:'NĐ 08/2022'},{min:0,hs:'GPMT',tq:'cap_so',phu_luc:'—',ref:'Điều 39'}]},
};

const CHECKLIST = {
  DTM:{
    bat_buoc:['Thuyết minh dự án đầu tư / Báo cáo nghiên cứu khả thi','Bản đồ vị trí địa lý và phạm vi ranh giới dự án (tỷ lệ phù hợp)','Báo cáo hiện trạng môi trường khu vực thực hiện dự án','Kết quả đo đạc, lấy mẫu và phân tích các thành phần môi trường nền','Chương trình quản lý và giám sát môi trường trong toàn bộ vòng đời dự án','Văn bản ý kiến của UBND cấp xã nơi thực hiện dự án (kết quả tham vấn)','Cam kết và kế hoạch thực hiện các biện pháp BVMT'],
    bo_sung:['Giấy chứng nhận đăng ký đầu tư hoặc Quyết định chủ trương đầu tư','Hợp đồng thuê đất / Quyết định giao đất','Bản đồ quy hoạch sử dụng đất được phê duyệt tại khu vực dự án','Các hồ sơ địa chất công trình, thủy văn nếu dự án ảnh hưởng nguồn nước']
  },
  GPMT:{
    bat_buoc:['Đơn đề nghị cấp Giấy phép môi trường (Mẫu 01, TT 02/2022/TT-BTNMT)','Báo cáo đề xuất cấp GPMT — dự án mới (Mẫu 02) hoặc cơ sở đang hoạt động (Mẫu 03)','Hồ sơ pháp lý dự án: giấy phép đầu tư, phê duyệt xây dựng','Bản vẽ kỹ thuật và thuyết minh hệ thống xử lý nước thải, khí thải, chất thải rắn','Quy trình vận hành hệ thống xử lý chất thải (có sơ đồ công nghệ)','Hợp đồng xử lý chất thải nguy hại với đơn vị có chức năng (nếu có CTNH)'],
    bo_sung:['Kết quả quan trắc môi trường định kỳ 02 quý gần nhất (nếu cơ sở đang vận hành)','Báo cáo ĐTM được phê duyệt hoặc GPMT cũ (đối với dự án mở rộng, cải tạo)','Kế hoạch phòng ngừa và ứng phó sự cố môi trường (nếu yêu cầu)','Giấy phép khai thác nước mặt/nước ngầm (nếu có nguồn nước cấp từ thiên nhiên)']
  },
  DKMT:{
    bat_buoc:['Mẫu đăng ký môi trường (Mẫu 01, Phụ lục VI, TT 02/2022/TT-BTNMT)','Hồ sơ pháp lý cơ sở: đăng ký kinh doanh, giấy phép xây dựng','Mô tả loại hình hoạt động và khối lượng chất thải dự kiến phát sinh','Biện pháp xử lý, thu gom chất thải đề xuất (đơn giản, thực tế)','Cam kết thực hiện đầy đủ các quy định về BVMT'],
    bo_sung:['Sơ đồ mặt bằng cơ sở','Hợp đồng thu gom chất thải sinh hoạt với đơn vị có chức năng']
  }
};

const LAW_REFS = {
  DTM: [
    {num:'Điều 25, Luật BVMT 2020',desc:'Tiêu chí phân loại Nhóm I (đất rừng, đất lúa, biên giới, vùng nhạy cảm)'},
    {num:'Điều 35, Luật BVMT 2020',desc:'Thẩm quyền thẩm định ĐTM — Bộ NNMT (Nhóm I), UBND tỉnh (Nhóm II)'},
    {num:'NĐ 48/2026, Điều 7',desc:'Phân cấp UBND tỉnh thẩm định ĐTM cho dự án đầu tư công (không thuộc QH/TTg)'},
    {num:'NĐ 48/2026, Điều 9',desc:'Điều 27a — Dự án phân kỳ đầu tư có thể lập ĐTM riêng từng giai đoạn'},
    {num:'Phụ lục III, NĐ 08/2022',desc:'Danh mục ngưỡng công suất theo từng ngành — Nhóm I, thẩm quyền Bộ NNMT'},
    {num:'Phụ lục IV, NĐ 08/2022',desc:'Danh mục ngưỡng công suất theo từng ngành — Nhóm II, thẩm quyền UBND tỉnh'},
    {num:'TT 02/2022, Mẫu 01/ĐTM',desc:'Mẫu đề cương báo cáo ĐTM bắt buộc nộp kèm hồ sơ'},
  ],
  GPMT: [
    {num:'Điều 39, Luật BVMT 2020',desc:'Đối tượng phải có Giấy phép môi trường (Nhóm I, II, III)'},
    {num:'Điều 40, Luật BVMT 2020',desc:'Nội dung GPMT — gồm nguồn thải, giới hạn xả thải, chương trình quan trắc'},
    {num:'Điều 43, Luật BVMT 2020',desc:'Thẩm quyền cấp GPMT — Bộ NNMT, UBND tỉnh, UBND huyện'},
    {num:'NĐ 08/2022, Điều 39–46',desc:'Trình tự, thủ tục, hồ sơ đề nghị cấp GPMT'},
    {num:'NĐ 48/2026, Điều 8',desc:'HTXLNT ≥50m³/ngày hoặc khí thải ≥20.000m³/h thay công nghệ → lập lại ĐTM/GPMT'},
    {num:'TT 02/2022, Mẫu 02, 03',desc:'Mẫu báo cáo đề xuất cấp GPMT cho dự án mới và cơ sở đang hoạt động'},
  ],
  DKMT: [
    {num:'Điều 49, Luật BVMT 2020',desc:'Đối tượng phải đăng ký môi trường (Nhóm IV — quy mô nhỏ, ít nguy cơ)'},
    {num:'Điều 50, Luật BVMT 2020',desc:'Nội dung, thủ tục đăng ký môi trường'},
    {num:'NĐ 08/2022, Điều 49–56',desc:'Trình tự đăng ký, cơ quan tiếp nhận (UBND xã, huyện theo ủy quyền)'},
    {num:'TT 02/2022, Phụ lục VI',desc:'Mẫu đăng ký môi trường — Mẫu 01/ĐKMT'},
  ]
};

const TQ_LABEL = {cap_bo:'Bộ Nông nghiệp và Môi trường (Bộ NNMT)',cap_so:'Sở Tài nguyên và Môi trường tỉnh/thành phố',cap_huyen:'UBND cấp huyện (hoặc xã theo ủy quyền)'};
const THOI_HAN = {DTM_cap_bo:'45 ngày làm việc',DTM_cap_so:'30 ngày làm việc',GPMT_cap_bo:'45 ngày làm việc',GPMT_cap_so:'30 ngày làm việc',GPMT_cap_huyen:'15 ngày làm việc',DKMT_cap_huyen:'5 ngày làm việc'};
const HS_INFO = {
  DTM:{icon:'📋',label:'Báo cáo Đánh giá tác động môi trường',class:'chip-dtm',bg:'#EEF3FF'},
  GPMT:{icon:'🪪',label:'Giấy phép môi trường',class:'chip-gpmt',bg:'#EEF8F3'},
  DKMT:{icon:'📝',label:'Đăng ký môi trường',class:'chip-dkmt',bg:'#F8F8F5'},
};

global.AppData = Object.assign(global.AppData || {}, {
  IND_DB,
  CHECKLIST,
  LAW_REFS,
  TQ_LABEL,
  THOI_HAN,
  HS_INFO,
});
})(window);
