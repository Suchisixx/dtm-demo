# BẢN THẢO THIẾT KẾ GIAO DIỆN (UI/UX REDESIGN SPECIFICATION)
## DỰ ÁN: ETC-LEGALHUB — NỀN TẢNG PHÁP LÝ & QUẢN TRỊ MÔI TRƯỜNG SỐ
> **Tài liệu chuẩn hóa dành riêng cho Google Stitch / Figma AI / UI-UX Generative Tools**  
> *Định hướng phong cách: Clean GreenTech • Modern SaaS • Glassmorphism • Bản đồ số GIS tương tác 3D*

---

## 1. TỔNG QUAN DỰ ÁN & MỤC TIÊU TÁI THIẾT KẾ

### 1.1. Bối cảnh & Sản phẩm
**ETC-LegalHub** là hệ thống webapp chuyên sâu phục vụ doanh nghiệp, cán bộ quản lý môi trường và chuyên gia tư vấn pháp lý môi trường Việt Nam:
1. **Tra cứu Văn bản Pháp luật**: Thư viện văn bản pháp quy, luật, nghị định, thông tư kèm điều khoản chi tiết.
2. **Phân loại & Xác định Hồ sơ Dự án**: Phân nhóm môi trường (Nhóm I, II, III, IV) theo Luật BVMT 2020 & Nghị định 08/2022/NĐ-CP, xác định loại hồ sơ (ĐTM / GPMT / ĐKMT), cơ quan thẩm định, checklist hồ sơ, tích hợp GIS định vị hành chính 3 bước.
3. **So sánh & Kiểm chuẩn QCVN**: Đối chiếu tự động mẫu đo đạc với các Quy chuẩn Việt Nam (Nước thải CN, Nước mặt, Khí thải, Đất, Nước ngầm...), liên kết dự án thông minh và tự match quy chuẩn theo ngành nghề.
4. **Bản đồ Dự án GIS (Spatial Dashboard)**: Giám sát phân bố dự án trên nền bản đồ số, theo dõi trạng thái quan trắc và cảnh báo ô nhiễm.
5. **Quản trị Hệ thống (Admin Hub)**: Quản lý người dùng, dự án, hệ thống Crawler văn bản luật tự động và Audit logs.

### 1.2. Mục tiêu Redesign
- **Vibe & Cảm giác**: Chuyển từ giao diện công cụ nghiệp vụ truyền thống sang **B2B SaaS thế hệ mới** (tương tự Linear, Vercel, Stripe kết hợp phong cách sinh thái công nghệ xanh).
- **Trải nghiệm mượt mà**: Micro-interactions tinh tế, chuyển tab không giật lag, blur glassmorphism, hiệu ứng hover, loading skeleton mượt mà.
- **Điểm nhấn 3D Map GIS**: Nâng cấp bản đồ phẳng 2D hiện tại thành **Bản đồ tương tác không gian 3D (3D Digital Twin / Terrain & Building Extrusion)** với góc nghiêng Camera (Pitch/Tilt), cột mốc dữ liệu 3D phát sáng (glowing 3D pillars/pins), hiệu ứng bay (Fly-through camera), địa hình thực tế (DEM terrain).

---

## 2. DESIGN SYSTEM & IDENTITY (QUY CHUẨN THIẾT KẾ)

### 2.1. Color Palette (Bảng màu chủ đạo)
- **Primary / Emerald Tech**: `#059669` (Chính), `#10B981` (Sáng/Hover), `#047857` (Đậm) — Biểu trưng cho Môi trường & Pháp lý xanh.
- **Secondary / Cyber Cyan**: `#06B6D4` (Điểm nhấn dữ liệu, GIS, kết nối công nghệ).
- **Backgrounds**:
  - *Light Mode*: Nền xám ngọc trai dịu mắt `#F8FAFC`, bề mặt thẻ `#FFFFFF` viền kính siêu mảnh `rgba(0,0,0,0.06)`.
  - *Dark Mode (Khuyên dùng cho 3D Map)*: Nền không gian sâu `#0B0F19`, thẻ kính `#111827` với viền neon mờ `rgba(16, 185, 129, 0.2)`.
- **Status & Nhóm Dự án (Semantic)**:
  - **Nhóm I / Vượt ngưỡng (Danger)**: Đỏ san hô `#EF4444` / Gradient `linear-gradient(135deg, #EF4444, #DC2626)`.
  - **Nhóm II / Cảnh báo (Warning)**: Cam hổ phách `#F59E0B` / Gradient `linear-gradient(135deg, #F59E0B, #D97706)`.
  - **Nhóm III (Notice)**: Vàng hoàng kim `#EAB308`.
  - **Nhóm IV / Đạt chuẩn (Success)**: Xanh ngọc lục bảo `#10B981`.

### 2.2. Typography
- **Font chữ chính**: `Be Vietnam Pro` hoặc `Plus Jakarta Sans` (Hỗ trợ tiếng Việt hoàn hảo, hình học hiện đại, nét thoáng).
- **Mono Font (Cho số liệu, tọa độ GIS, QCVN)**: `JetBrains Mono` hoặc `Fira Code`.

### 2.3. Hiệu ứng thị giác (Visual Treatment)
- **Frosted Glass (Kính mờ)**: `backdrop-filter: blur(16px)`, nền `rgba(255, 255, 255, 0.75)` hoặc `rgba(15, 23, 42, 0.75)`.
- **Bo góc (Border Radius)**: Thẻ `16px`, Nút bấm `10px`, Tag/Badge `9999px` (Pill).
- **Đổ bóng (Soft Elevation)**: Nhiều lớp mờ sâu `0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)`.

---

## 3. CHI TIẾT 5 MÀN HÌNH CHÍNH & YÊU CẦU REDESIGN

### 3.1. Navigation Header & Global Control
- **Thanh điều hướng**: Thanh Header dạng kính nổi (Floating Glass Island) cố định ở đỉnh trang.
- **Logo**: Biểu tượng khối đa diện kết hợp chiếc lá sinh thái 3D phát sáng + Chữ "ETC LegalHub".
- **Tab chuyển đổi**: Các nút dạng viên thuốc (Pill switches) có hiệu ứng trượt mượt mà (Sliding indicator):
  - 📜 *Tra cứu văn bản*
  - ⚖️ *Phân loại dự án*
  - 🧪 *So sánh QCVN*
  - 🌐 *Bản đồ GIS 3D*
  - ⚙️ *Quản trị*
- **Góc phải**: Trạng thái người dùng (Avatar tròn, Badge vai trò: `ADMIN` màu tím gradient / `CHUYÊN VIÊN` màu xanh ngọc), nút chuyển đổi Dark/Light mode và nút Đăng xuất nhanh.

---

### 3.2. Màn hình 1: Tra cứu Văn bản Pháp luật (Laws Explorer)
- **Hero Search Box**: Thanh tìm kiếm trung tâm lớn dạng Spotlight (giống Raycast / macOS Alfred) với phím tắt `Ctrl + K`.
- **Bộ lọc thông minh (Faceted Filter Bar)**: Dạng thanh cuộn ngang chứa các chip bấm nhanh: *Cấp thẩm quyền (Bộ TNMT, Chính phủ, Quốc hội), Năm hiệu lực, Thể loại (Luật, Nghị định, Thông tư)*.
- **Danh sách văn bản**: Thẻ lưới (Card Grid) dạng modular:
  - Huy hiệu loại văn bản: Viền màu theo cấp ban hành.
  - Tên viết tắt & số hiệu nổi bật (Ví dụ: `NĐ 08/2022/NĐ-CP`).
  - Nút tải trực tiếp file gốc PDF/Word và nút xem tóm tắt các điều khoản quan trọng bằng Drawer trượt từ cạnh phải sang.

---

### 3.3. Màn hình 2: Phân loại & Xác định Hồ sơ Dự án (Classify Studio)
- **Bố cục**: 2 Cột linh hoạt (Split View 45% - 55%):
  - **Cột trái — Form thu thập thông tin**:
    - Trường nhập liệu dạng Floating Label thanh thoát.
    - Chọn ngành nghề: Dropdown dạng nhóm có icon sinh động.
    - Công suất, Lưu lượng xả thải (Nước thải, Khí thải) có thanh kéo trực quan (Slider input).
    - **Vị trí 3 Bước có Mini Map GIS**:
      - Bước 1: 2 Dropdown Tỉnh/TP và Phường/Xã (Tự động zoom map).
      - Bước 2: Mini Map có thể ghim vị trí, hiển thị bán kính ảnh hưởng nhạy cảm (biên giới, biển, rừng, đất lúa).
      - Bước 3: Địa chỉ tự động điền với hiệu ứng gõ chữ (typing effect) khi xác nhận tọa độ.
  - **Cột phải — Bảng kết quả Dashboard (Interactive Result Hero)**:
    - **Card kết quả phân loại**: Card lớn hiển thị Nhóm dự án (Nhóm I/II/III/IV) với hiệu ứng hào quang màu sắc tương ứng.
    - Thẩm quyền thẩm định hồ sơ: Huy hiệu cấp Bộ hoặc cấp Tỉnh/Sở.
    - **Checklist giấy phép môi trường cần thực hiện**: Tiến độ hình tròn (Radial Progress Bar) trực quan.
    - **Khối Lịch sử Quan trắc gắn liền dự án**: Liệt kê các lần đo đạc QCVN đã lưu kèm badge trạng thái `Đạt` / `Cảnh báo` / `Vượt ngưỡng`, click vào chuyển thẳng sang tab QCVN.

---

### 3.4. Màn hình 3: So sánh & Kiểm chuẩn QCVN (QCVN Compliance Engine)
- **Sidebar danh sách mẫu**: Cột bên trái hiển thị các mẫu quan trắc đã lưu, phân nhóm theo dự án với bộ lọc tìm kiếm nhanh.
- **Workspace phân tích trung tâm**:
  - **Banner liên kết dự án thông minh**: Thẻ nổi bật hiển thị: `🔗 Đã liên kết với dự án [Tên Dự Án] — ⚡ Tự động khớp quy chuẩn [QCVN 40 - Nước thải CN, Cột A]`.
  - **Bảng nhập liệu thông số**: Hỗ trợ 2 chế độ:
    - *Chế độ 1*: Dán nhanh bảng Excel (Quick Paste) — tự động phân tích và bóc tách chỉ số với hiệu ứng highlight các dòng nhận diện thành công.
    - *Chế độ 2*: Bảng lưới tương tác cao (Data Grid) với các cột: Tên chỉ tiêu, Đơn vị, Ngưỡng cho phép, Giá trị đo, Trạng thái (Đạt/Cảnh báo/Vượt) có màu cảnh báo trực quan.
  - **Thống kê tổng quát (Status KPI Cards)**: 3 Thẻ lớn: *Tổng chỉ tiêu đo | Chỉ tiêu đạt chuẩn | Chỉ tiêu vượt ngưỡng/nguy cơ*.
  - **Bộ nút tác vụ**: Nút In báo cáo PDF chuẩn cơ quan nhà nước, Xuất bảng số liệu TXT/Excel.

---

### 3.5. Màn hình 4: BẢN ĐỒ DỰ ÁN GIS 3D (3D SPATIAL DIGITAL TWIN) — [ĐIỂM NHẤN QUAN TRỌNG NHẤT]

#### A. Kiến trúc không gian 3D
- **Nền bản đồ 3D**: Sử dụng Mapbox GL JS / Cesium JS hoặc Deck.gl với:
  - Địa hình đồi núi 3D thực tế (3D Terrain Mesh với độ cao DEM).
  - Tòa nhà và khối công trình 3D (3D Building Footprints extrusion).
  - Góc nhìn nghiêng Camera tự do (Tilt 45°–60°, Xoay 360° Rotate/Bearing).
  - Chu kỳ ánh sáng ngày/đêm (Day/Night sun lighting simulation) tạo chiều sâu điện ảnh.

#### B. Điểm đánh dấu dự án 3D (3D Spatial Markers)
- Không dùng icon 2D phẳng thông thường. Dùng **Cột năng lượng 3D phát sáng (3D Floating Glowing Pillars / Holographic Pins)**:
  - Chiều cao cột tương ứng với quy mô dự án hoặc lưu lượng phát thải.
  - Màu sắc cột phản ánh Nhóm dự án & Trạng thái quan trắc:
    - *Xanh ngọc*: Dự án Nhóm IV hoặc Đạt chuẩn quan trắc.
    - *Vàng cam phát sáng*: Nhóm II/III hoặc Cảnh báo tiệm cận ngưỡng.
    - *Đỏ neon nhấp nháy (Pulse animation)*: Nhóm I hoặc có thông số Vượt ngưỡng.
- **Vòng quét radar (Pulse Wave / Radar scan effect)** lan tỏa từ chân marker trên mặt đất để thu hút sự chú ý.

#### C. Bảng điều khiển HUD nổi (Floating Futuristic HUD Controls)
- **Thanh công cụ lọc kính mờ (Floating Island Filter)**: Nằm lơ lửng phía trên bản đồ:
  - Bộ lọc nhóm dự án (Tất cả, Nhóm I, II, III, IV) dạng chip có led sáng.
  - Dropdown chọn Tỉnh/Thành phố: Chọn đến đâu, camera bản đồ lượn mượt mà (Cinematic Fly-through) từ trên cao hạ cánh xuống khu vực đó.
  - Toggle bật tắt chế độ: *Xem 2D Mặt phẳng ↔ Xem 3D Không gian*.
  - Toggle lớp bản đồ: *Vệ tinh (Satellite 3D) | Giao thông đô thị (Dark Cyber Vector)*.
- **Popup dự án thông minh 3D (Holographic Card Popup)**: Khi nhấp vào marker:
  - Thẻ thông tin bay nổi phía trên cột mốc với đường gióng kết nối (leader line).
  - Thông tin đầy đủ: Tên dự án, loại hồ sơ, cơ quan phê duyệt, ngày đo quan trắc mới nhất, badge trạng thái quan trắc kèm nút `📋 Xem chi tiết hồ sơ`.

---

### 3.6. Màn hình 5: Quản trị Hệ thống (Admin & Crawler Console)
- **Thống kê tổng quan**: Thẻ KPI doanh nghiệp (Tổng người dùng, Dự án active, Số văn bản đã crawl, Tình trạng server).
- **Trình quản lý Crawler luật tự động**:
  - Switch gạt bật/tắt Auto-crawl định kỳ.
  - Nút kích hoạt quét ngay lập tức với thanh tiến trình quét thời gian thực (Live crawling terminal log).
- **Bảng quản trị người dùng**: Bảng dữ liệu hiện đại với avatar, phân quyền phân cấp (Admin / Staff), thao tác nhanh dạng dropdown inline.

---

## 4. DESIGN PROMPT DÀNH RIÊNG CHO GOOGLE STITCH

Dưới đây là các prompt chuẩn tiếng Anh & tiếng Việt tối ưu cho **Google Stitch** để bạn sao chép trực tiếp vào công cụ:

### 🌟 Prompt Tổng Thể (Master Prompt for Stitch)
```markdown
Design a cutting-edge, ultra-modern B2B SaaS web application called "ETC-LegalHub" for environmental legal compliance and industrial project GIS management.

Visual Style:
- Futuristic yet clean GreenTech aesthetics, inspired by Linear.app, Stripe Dashboard, and Vercel.
- Frosted glassmorphism cards with smooth subtle emerald borders (rgba(16, 185, 129, 0.2)), soft layered drop shadows, and refined blur effects.
- Typography: Clean geometric sans-serif (Plus Jakarta Sans / Be Vietnam Pro), high contrast, elegant hierarchy.
- Dark mode primary theme with deep space background (#0B0F19) and emerald accents (#10B981, #06B6D4).
- Floating top navigation bar with pill-shaped active state indicator.

Key Screens to Generate:
1. "Classify Studio": Two-column layout. Left: project classification inputs with 3-step administrative cascader and interactive mini-map. Right: stunning project tier result hero card (Group I/II/III/IV) with glowing border, checklist progress circle, and linked environmental monitoring history.
2. "QCVN Compliance Engine": Split view with a saved samples sidebar on the left and a data grid workspace on the right. Shows linked project banner with "auto-matched QCVN 40 standard", quick paste table parser, and color-coded compliance status badges (Pass, Warning, Exceeded).
3. "3D GIS Spatial Map": Full-screen 3D terrain satellite map with tilted camera perspective. Features glowing 3D holographic vertical pillar markers for industrial projects with radar pulse waves on the terrain. Floating frosted-glass HUD filter controls at the top and holographic floating project card popups.
```

### 🗺️ Prompt Chi Tiết Cho Màn Hình Bản Đồ 3D (3D GIS Map Screen)
```markdown
Design an immersive 3D Spatial GIS Environmental Dashboard screen for "ETC-LegalHub".

Key Features:
- Canvas: Realistic 3D terrain relief and extruded 3D buildings at a 45-degree isometric tilt angle with night-time cyber-vector satellite satellite hybrid styling.
- 3D Markers: Vertical glowing translucent energy pillars (holographic cylinders) protruding from project coordinates. Height indicates industrial scale; colors represent environmental risk: Glowing Emerald (#10B981) for compliant, Amber (#F59E0B) for warning, and Pulsing Neon Red (#EF4444) with expanding concentric ripple rings for high-risk Group I projects.
- Floating HUD Controls: Translucent frosted glass island at top-center containing:
  - Multi-select pill filters: "All Projects", "Group I", "Group II", "Group III", "Group IV".
  - Province quick-jump dropdown with smooth camera fly-to trigger.
  - Map mode toggle: "2D Flat" vs "3D Perspective", "Satellite" vs "Dark Vector".
- Holographic Popup Card: Attached via an elegant glowing laser pointer line to a selected 3D marker. Displays Project Name, Jurisdiction Authority, EIA Profile Type, and Latest Monitoring Quality with colored status badge.
```

---

## 5. HƯỚNG DẪN KỸ THUẬT KHI LẬP TRÌNH SAU THIẾT KẾ
Khi đã có bản thiết kế từ Google Stitch, các thư viện công nghệ khuyến nghị để biến bản vẽ 3D thành hiện thực mượt mà trên Vue 3:
1. **Map 3D**: `Mapbox GL JS v3` (hỗ trợ 3D Terrain, 3D Building models trực tiếp) hoặc `Deck.gl` kết hợp `Leaflet`.
2. **Animation**: `GSAP` hoặc `@vueuse/motion` cho hiệu ứng số nhảy và thẻ lướt êm ái.
3. **Icons & Graphic**: `Lucide Icons` phong cách viền mảnh siêu nét (Stroke 1.5px).
4. **CSS**: Tận dụng CSS Variables và TailwindCSS với các class `backdrop-blur-md`, `ring-1`, `shadow-2xl`.
