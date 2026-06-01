# ETC LegalHub - Hệ thống pháp lý môi trường

ETC LegalHub là một ứng dụng web tĩnh dùng để tra cứu văn bản pháp lý môi trường và hỗ trợ phân loại dự án theo loại hồ sơ cần thực hiện. Dự án chạy bằng HTML, CSS và JavaScript thuần, không cần cài package hay build tool.

## Chức năng chính

- Tra cứu danh sách văn bản pháp lý môi trường theo nhóm: Luật, Nghị định, Thông tư, QCVN.
- Lọc văn bản theo trạng thái còn hiệu lực hoặc đã sửa đổi.
- Nhập thông tin dự án để xác định loại hồ sơ: ĐTM, GPMT, ĐKMT.
- Hiển thị thẩm quyền, thời hạn thẩm định, căn cứ pháp lý và danh mục tài liệu cần chuẩn bị.
- Checklist tài liệu có thể đánh dấu tiến độ ngay trên giao diện.

## Cách mở dự án

Mở trực tiếp file:

```text
moi_truong_portal.html
```

Nếu muốn chạy qua local server, có thể dùng một trong các cách sau tại thư mục dự án:

```bash
python -m http.server 8000
```

Sau đó mở:

```text
http://localhost:8000/moi_truong_portal.html
```

Hoặc dùng Node nếu máy có sẵn:

```bash
npx serve .
```

## Cấu trúc thư mục

```text
.
├── moi_truong_portal.html
├── README.md
└── assets
    ├── css
    │   └── styles.css
    └── js
        ├── app.js
        ├── data
        │   ├── classification-db.js
        │   └── laws.js
        ├── services
        │   └── classification-rules.js
        ├── ui
        │   ├── classify-view.js
        │   ├── laws-view.js
        │   └── navigation.js
        └── utils
            └── dom.js
```

## Vai trò từng file

`moi_truong_portal.html`  
Chứa markup chính của ứng dụng, các khu vực giao diện, form nhập thông tin và danh sách script/style được load.

`assets/css/styles.css`  
Chứa toàn bộ style của ứng dụng: layout, card, filter, form, result, checklist và responsive.

`assets/js/app.js`  
Entry point của ứng dụng. File này khởi tạo navigation, bộ lọc văn bản, form phân loại và render danh sách văn bản ban đầu.

`assets/js/data/laws.js`  
Chứa dữ liệu các văn bản pháp lý hiển thị ở tab "Văn bản pháp lý".

`assets/js/data/classification-db.js`  
Chứa database phân loại dự án, checklist hồ sơ, văn bản tham chiếu, thời hạn và label hiển thị.

`assets/js/services/classification-rules.js`  
Chứa các hàm xử lý logic có thể tái sử dụng, ví dụ lấy label công suất, tìm ngưỡng phân loại theo ngành và kiểm tra điều kiện nâng nhóm.

`assets/js/ui/laws-view.js`  
Quản lý render danh sách văn bản và xử lý các nút lọc.

`assets/js/ui/navigation.js`  
Quản lý chuyển tab và cập nhật label quy mô/công suất khi người dùng chọn ngành nghề.

`assets/js/ui/classify-view.js`  
Đọc dữ liệu từ form, gọi logic phân loại, render kết quả và xử lý checklist tài liệu.

`assets/js/utils/dom.js`  
Chứa helper DOM dùng chung, giúp code UI ngắn gọn hơn.

## Luồng khởi chạy

1. Trình duyệt load `moi_truong_portal.html`.
2. CSS được load từ `assets/css/styles.css`.
3. Các file data được load trước để tạo `window.AppData`.
4. Các file service và UI được load tiếp theo.
5. `assets/js/app.js` lắng nghe `DOMContentLoaded` và khởi tạo ứng dụng.

## Cập nhật dữ liệu

### Thêm hoặc sửa văn bản pháp lý

Sửa file:

```text
assets/js/data/laws.js
```

Mỗi văn bản nằm trong mảng `LAWS`, với các trường chính:

```js
{
  id: 'ma_van_ban',
  type: 'luat',
  year: 2026,
  so: '48/2026/ND-CP',
  ten: 'Tên văn bản',
  hieuluc: '29/01/2026',
  status: 'valid',
  mo_ta: 'Mô tả ngắn',
  dieu_khoang: ['Điều khoản liên quan'],
  note: 'Ghi chú nếu có'
}
```

Giá trị `type` đang được dùng để lọc:

- `luat`
- `nd`
- `tt`
- `qcvn`

Giá trị `status` đang được dùng để hiển thị trạng thái:

- `valid`
- `amended`
- `expired`

### Cập nhật ngưỡng phân loại dự án

Sửa file:

```text
assets/js/data/classification-db.js
```

Mỗi ngành nằm trong object `IND_DB`, ví dụ:

```js
do_thi: {
  lbl: 'Khu đô thị, nhà ở (ha)',
  t: [
    { min: 300, hs: 'DTM', tq: 'cap_bo', phu_luc: 'Phụ lục III', ref: 'NĐ 48/2026' },
    { min: 50, hs: 'DTM', tq: 'cap_so', phu_luc: 'Phụ lục IV', ref: 'NĐ 48/2026' },
    { min: 10, hs: 'GPMT', tq: 'cap_so', phu_luc: '-', ref: 'Điều 39' }
  ]
}
```

Lưu ý: các mốc `min` nên sắp xếp từ lớn đến nhỏ, vì logic sẽ chọn mốc đầu tiên mà quy mô dự án đạt ngưỡng.

### Cập nhật checklist hồ sơ

Sửa object `CHECKLIST` trong:

```text
assets/js/data/classification-db.js
```

Các nhóm hồ sơ hiện có:

- `DTM`
- `GPMT`
- `DKMT`

## Nguyên tắc khi sửa code

- Dữ liệu tĩnh nên để trong `assets/js/data`.
- Logic xử lý nên để trong `assets/js/services`.
- Code thao tác DOM và render giao diện nên để trong `assets/js/ui`.
- Helper dùng chung nên để trong `assets/js/utils`.
- Hạn chế viết logic trực tiếp trong HTML. Nên dùng `data-*` attribute và `addEventListener`.

## Kiểm tra nhanh

Kiểm tra cú pháp JavaScript:

```bash
node --check assets/js/data/laws.js
node --check assets/js/data/classification-db.js
node --check assets/js/services/classification-rules.js
node --check assets/js/ui/laws-view.js
node --check assets/js/ui/navigation.js
node --check assets/js/ui/classify-view.js
node --check assets/js/app.js
```

Kiểm tra bằng trình duyệt:

1. Mở trang.
2. Thử bấm các filter văn bản.
3. Chuyển sang tab phân loại.
4. Chọn một ngành nghề, nhập quy mô, bấm "Phân loại hồ sơ".
5. Kiểm tra kết quả và checklist hiển thị đúng.

## Ghi chú

Ứng dụng này mang tính hỗ trợ tra cứu và tham khảo nội bộ. Khi áp dụng vào hồ sơ thực tế, cần đối chiếu lại với văn bản pháp lý mới nhất và quy định của cơ quan có thẩm quyền tại thời điểm lập hồ sơ.
