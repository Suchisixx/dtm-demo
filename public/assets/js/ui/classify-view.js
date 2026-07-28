// Classification form UI and Saved Projects integration.
(function (global) {
  'use strict';

  const { IND_DB, CHECKLIST, LAW_REFS, TQ_LABEL, THOI_HAN, HS_INFO } = global.AppData;

  const _checks = {};
  let _loadedProjects = [];
  let _currentProjectPage = 1;

  function toggleCL(id) {
    _checks[id] = !_checks[id];
    const box = document.getElementById('b' + id);
    const txt = document.getElementById('t' + id);
    if (box) { box.classList.toggle('done', _checks[id]); }
    if (txt) { txt.classList.toggle('done', _checks[id]); }
    updateProgress();
    
    // Auto save checklist state if currently editing a saved project
    const projectId = document.getElementById('f-project-id').value;
    if (projectId) {
      autoSaveCurrentChecklistState();
    }
  }

  function updateProgress() {
    const all = document.querySelectorAll('.cl-box');
    const done = Object.values(_checks).filter(Boolean).length;
    const total = all.length;
    const pf = document.getElementById('progress-fill');
    const pl = document.getElementById('progress-label');
    if (pf) pf.style.width = total ? `${Math.round(done / total * 100)}%` : '0%';
    if (pl) pl.textContent = total ? `${done}/${total} tài liệu đã chuẩn bị` : '';
  }

  // Phân loại hồ sơ chính (trả về kết quả hiển thị)
  function runClassification(shouldSave = true) {
    const name = document.getElementById('f-name').value.trim();
    const nganh = document.getElementById('f-nganh').value;
    const cap = parseFloat(document.getElementById('f-cap').value) || 0;
    const nt = parseFloat(document.getElementById('f-nt').value) || 0;
    const kt = parseFloat(document.getElementById('f-kt').value) || 0;
    const tinh = document.getElementById('f-tinh').value.trim();
    const rung = document.getElementById('ck-rung').checked;
    const lua = document.getElementById('ck-lua').checked;
    const bg = document.getElementById('ck-bg').checked;
    const kcn = document.getElementById('ck-kcn').checked;
    const phanky = document.getElementById('ck-phanky').checked;
    const morongdt = document.getElementById('ck-morongdt').checked;
    const ctnh = document.getElementById('ck-ctnh').checked;
    const dtcong = document.getElementById('ck-dtcong').checked;

    if (!name) { alert('Vui lòng nhập tên dự án!'); return; }
    if (!nganh) { alert('Vui lòng chọn loại hình dự án!'); return; }
    if (cap <= 0) { alert('Vui lòng nhập quy mô / công suất!'); return; }

    let hs, tq, phuluc, ref, nang = [], canh = [], info_extra = [];

    // Bước 1: Nâng nhóm tuyệt đối
    const force1 = global.AppClassificationRules.isForcedGroupOne({ rung, lua, bg });
    if (force1) {
      hs = 'DTM'; tq = 'cap_bo'; phuluc = 'Khoản 1 Điều 25'; ref = 'Luật BVMT 2020';
      if (rung) nang.push({ icon: '🌲', text: 'Sử dụng đất rừng phòng hộ/đặc dụng → tự động Nhóm I, thẩm quyền Bộ NNMT', ref: 'Điểm b, Khoản 1, Điều 25' });
      if (lua) nang.push({ icon: '🌾', text: 'Chuyển đổi đất lúa 2 vụ >10ha → tự động Nhóm I', ref: 'Điểm c, Khoản 1, Điều 25' });
      if (bg) nang.push({ icon: '🚩', text: 'Dự án trong vùng 50km biên giới quốc gia → tự động Nhóm I', ref: 'Điểm d, Khoản 1, Điều 25' });
    } else {
      const match = global.AppClassificationRules.findIndustryTier(nganh, cap);
      hs = match.hs; tq = match.tq; phuluc = match.phu_luc; ref = match.ref;

      // Bước 2: Nâng nhóm do nước thải
      if (nt >= 1000 && (hs === 'GPMT' || hs === 'DKMT')) {
        hs = 'DTM'; tq = 'cap_so'; phuluc = 'Phụ lục II, NĐ 08/2022';
        nang.push({ icon: '💧', text: `Lưu lượng nước thải ${nt.toLocaleString()} m³/ngày ≥ 1.000 → nâng lên ĐTM`, ref: 'Phụ lục II, NĐ 08/2022' });
      }
      // Bước 3: Nâng nhóm do khí thải lớn
      if (kt >= 20000 && hs === 'DKMT') {
        hs = 'GPMT'; tq = 'cap_so';
        nang.push({ icon: '🌫️', text: `Lưu lượng khí thải ${kt.toLocaleString()} m³/h ≥ 20.000 → nâng lên GPMT`, ref: 'NĐ 48/2026, Điều 8' });
      }
      // Bước 4: Trong KCN đã có ĐTM
      if (kcn && hs === 'DTM') {
        hs = 'GPMT'; tq = 'cap_so'; phuluc = '—';
        nang.push({ icon: '🏭', text: 'Trong KCN đã được phê duyệt ĐTM → không cần lập ĐTM riêng, chuyển GPMT', ref: 'Khoản 2 Điều 35, Luật BVMT 2020' });
      }
    }

    // Thông tin phân cấp đặc biệt
    if (dtcong && hs === 'DTM' && tq === 'cap_bo') {
      canh.push({ icon: '🏛️', type: 'info', text: 'Dự án đầu tư công không thuộc QH/TTg: có thể phân cấp cho UBND tỉnh thẩm định ĐTM theo NĐ 48/2026 Điều 7.', ref: 'NĐ 48/2026, Điều 7' });
    }
    if (phanky && hs === 'DTM') {
      canh.push({ icon: '📅', type: 'info', text: 'Dự án phân kỳ đầu tư: có thể lập ĐTM riêng từng giai đoạn. ĐTM của giai đoạn sau thay thế ĐTM giai đoạn trước đã được phê duyệt.', ref: 'Điều 27a, NĐ 48/2026 bổ sung' });
    }
    if (morongdt) {
      if (nt >= 50 || kt >= 20000) {
        canh.push({ icon: '⚠️', type: 'warn', text: `Mở rộng dự án làm tăng lưu lượng thải (NT: ${nt} m³/ngày, KT: ${kt} m³/h) → phải đánh giá lại. Nếu vượt ngưỡng phải lập lại ĐTM/GPMT.`, ref: 'Điều 27 Khoản 5, NĐ 08/2022; NĐ 48/2026 Điều 8' });
      } else {
        canh.push({ icon: '📌', type: 'info', text: 'Dự án cải tạo/mở rộng: kiểm tra so với quy mô cũ. Nếu không làm tăng lưu lượng thải thì không cần lập lại ĐTM/GPMT.', ref: 'Điều 27, NĐ 08/2022' });
      }
    }
    if (ctnh) {
      canh.push({ icon: '☣️', type: 'warn', text: 'Có phát sinh CTNH: bổ sung hồ sơ đăng ký chủ nguồn thải CTNH. Phải có hợp đồng vận chuyển và xử lý với đơn vị được cấp phép.', ref: 'TT 02/2022/TT-BTNMT, Điều 13' });
    }

    const coQuan = tinh && tq === 'cap_so' ? `Sở TNMT tỉnh ${tinh}` : TQ_LABEL[tq];
    const thoiHan = THOI_HAN[`${hs}_${tq}`] || 'Theo quy định cụ thể';
    const hi = HS_INFO[hs];
    const cl = CHECKLIST[hs];
    const lr = LAW_REFS[hs];
    const nhomMap = { DTM_cap_bo: 'Nhóm I', DTM_cap_so: 'Nhóm II', GPMT_cap_bo: 'Nhóm I', GPMT_cap_so: 'Nhóm II', GPMT_cap_huyen: 'Nhóm III', DKMT_cap_huyen: 'Nhóm IV' };
    const nhom = nhomMap[`${hs}_${tq}`] || '—';

    // RENDER RA GIAO DIỆN KẾT QUẢ
    document.getElementById('result-area').innerHTML = `
  <div class="fade-up">
    <div class="result-hero">
      <div class="result-main">
        <div class="result-icon" style="background:${hi.bg}">${hi.icon}</div>
        <div>
          <div class="result-label">${hi.label}</div>
          <div class="result-sub">${nhom} theo NĐ 08/2022 (cập nhật NĐ 48/2026)</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="chip ${hi.class}">${hs}</span>
        <span class="chip ${{ cap_bo: 'chip-bo', cap_so: 'chip-so', cap_huyen: 'chip-huyen' }[tq]}">${coQuan}</span>
        <span class="chip chip-gray">⏱ ${thoiHan}</span>
        ${phuluc && phuluc !== '—' ? `<span class="chip chip-info">${phuluc}</span>` : ''}
      </div>
      <div style="font-size:12px;color:var(--text3);padding:8px 12px;background:var(--surface2);border-radius:6px">
        <strong style="color:var(--text2)">Căn cứ áp dụng:</strong> ${ref}
      </div>
      <div class="info-grid">
        <div class="info-box"><div class="info-box-label">Loại hồ sơ</div><div class="info-box-val">${hs}</div></div>
        <div class="info-box"><div class="info-box-label">Nhóm dự án</div><div class="info-box-val">${nhom}</div></div>
        <div class="info-box"><div class="info-box-label">Thẩm quyền</div><div class="info-box-val ${tq === 'cap_bo' ? 'warn' : tq === 'cap_so' ? 'green' : 'info'}">${tq === 'cap_bo' ? 'Bộ NNMT' : tq === 'cap_so' ? 'Sở TNMT tỉnh' : 'UBND huyện/xã'}</div></div>
        <div class="info-box"><div class="info-box-label">Thời hạn thẩm định</div><div class="info-box-val">${thoiHan}</div></div>
      </div>
    </div>

    ${nang.length ? `<div class="upgrade-box">
      <div class="upgrade-title">⚡ Điều chỉnh nhóm tự động</div>
      ${nang.map(n => `<div class="upgrade-item">${n.icon} ${n.text} <span style="font-size:10px;font-style:italic">(${n.ref})</span></div>`).join('')}
    </div>`: ''}

    ${canh.length ? canh.map(c => `<div class="${c.type === 'warn' ? 'upgrade-box' : 'phanlky-box'}" style="margin-top:10px">
      <div class="${c.type === 'warn' ? 'upgrade-title' : 'phanlky-title'}">${c.icon} Lưu ý quan trọng</div>
      <div class="${c.type === 'warn' ? 'upgrade-item' : 'phanlky-text'}">${c.text} <span style="font-size:10px;font-style:italic">(${c.ref})</span></div>
    </div>`).join('') : ''}

    <div class="law-ref-block" style="margin-top:14px">
      <div class="law-ref-title">📖 Văn bản pháp lý áp dụng</div>
      ${lr.map(r => `<div class="law-ref-item">
        <div class="law-ref-num">${r.num}</div> 
        <div class="law-ref-desc">${r.desc}</div>
      </div>`).join('')}
    </div>

    <div class="checklist-block">
      <div class="checklist-title">📋 Danh mục tài liệu cần chuẩn bị
        <span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:auto">${cl.bat_buoc.length + cl.bo_sung.length} tài liệu</span>
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin:4px 0 8px">Tài liệu bắt buộc</div>
      ${cl.bat_buoc.map((item, i) => `
        <div class="cl-item" data-check-id="${i}">
          <div class="cl-box" id="b${i}"></div>
          <div><div class="cl-text" id="t${i}">${item}</div><div class="cl-required">BẮT BUỘC</div></div>
        </div>`).join('')}
      ${cl.bo_sung.length ? `<div style="font-size:12px;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:0.4px;margin:14px 0 8px">Tài liệu bổ sung (tuỳ trường hợp)</div>
      ${cl.bo_sung.map((item, i) => `
        <div class="cl-item" data-check-id="${cl.bat_buoc.length + i}">
          <div class="cl-box" id="b${cl.bat_buoc.length + i}"></div>
          <div><div class="cl-text" id="t${cl.bat_buoc.length + i}">${item}</div></div>
        </div>`).join('')}` : ''}
      <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
      <div class="progress-label" id="progress-label">0/${cl.bat_buoc.length + cl.bo_sung.length} tài liệu đã chuẩn bị</div>
    </div>

    <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:12px;padding:8px;background:var(--surface2);border-radius:6px">
      Kết quả mang tính tham khảo. Căn cứ: Luật BVMT 2020 • NĐ 08/2022 • NĐ 05/2025 • NĐ 48/2026 • TT 02/2022.
    </div>
  </div>`;

    // Gọi API để tự động lưu dự án lên Database
    if (shouldSave) {
      const projectId = document.getElementById('f-project-id').value;
      const formData = { nganh, cap, nt, kt, tinh, rung, lua, bg, kcn, phanky, morongdt, ctnh, dtcong };
      
      saveProject({
        id: projectId ? parseInt(projectId) : null,
        name: name,
        form_data: formData,
        checklist_state: _checks
      });
    } else {
      updateProgress();
    }
  }

  function doClassify() {
    runClassification(true);
  }

  // API: Lưu dự án (Tạo mới hoặc Cập nhật)
  function saveProject(projectData) {
    fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(projectData)
    })
    .then(res => {
      if (!res.ok) {
        throw new Error('Lỗi phản hồi hệ thống.');
      }
      return res.json();
    })
    .then(data => {
      // Cập nhật Project ID ẩn để lần bấm tiếp theo là UPDATE thay vì INSERT mới
      document.getElementById('f-project-id').value = data.project.id;
      
      // Load lại danh sách bên trái
      loadProjects(_currentProjectPage);
      console.log('✔ Dự án đã được tự động lưu thành công.');
    })
    .catch(err => {
      console.error('Lỗi lưu dự án tự động:', err);
    });
  }

  // Tự động lưu nhanh trạng thái checklist khi tick chọn tài liệu
  function autoSaveCurrentChecklistState() {
    const projectId = document.getElementById('f-project-id').value;
    const name = document.getElementById('f-name').value.trim();
    if (!projectId || !name) return;

    const nganh = document.getElementById('f-nganh').value;
    const cap = parseFloat(document.getElementById('f-cap').value) || 0;
    const nt = parseFloat(document.getElementById('f-nt').value) || 0;
    const kt = parseFloat(document.getElementById('f-kt').value) || 0;
    const tinh = document.getElementById('f-tinh').value.trim();
    const rung = document.getElementById('ck-rung').checked;
    const lua = document.getElementById('ck-lua').checked;
    const bg = document.getElementById('ck-bg').checked;
    const kcn = document.getElementById('ck-kcn').checked;
    const phanky = document.getElementById('ck-phanky').checked;
    const morongdt = document.getElementById('ck-morongdt').checked;
    const ctnh = document.getElementById('ck-ctnh').checked;
    const dtcong = document.getElementById('ck-dtcong').checked;

    const formData = { nganh, cap, nt, kt, tinh, rung, lua, bg, kcn, phanky, morongdt, ctnh, dtcong };

    fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: parseInt(projectId),
        name: name,
        form_data: formData,
        checklist_state: _checks
      })
    })
    .then(res => res.json())
    .catch(err => console.error('Lỗi tự động lưu trạng thái checklist:', err));
  }

  // API: Tải danh sách dự án
  function loadProjects(page = 1) {
    if (!global.CurrentUser) return;
    _currentProjectPage = page;

    fetch(`/api/projects?page=${page}&limit=5`)
    .then(res => {
      if (res.status === 401) {
        return { projects: [], pagination: { totalPages: 0 } };
      }
      return res.json();
    })
    .then(data => {
      _loadedProjects = data.projects || [];
      renderProjectsList(data.projects || []);
      renderPagination(data.pagination || { totalPages: 0, currentPage: 1 });
    })
    .catch(err => console.error('Lỗi tải danh sách dự án:', err));
  }

  // Render danh sách dự án ra UI
  function renderProjectsList(projects) {
    const listContainer = document.getElementById('saved-projects-list');
    if (!listContainer) return;

    if (projects.length === 0) {
      listContainer.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px 0">Chưa có dự án nào</div>';
      return;
    }

    const currentActiveId = document.getElementById('f-project-id').value;

    let html = '';
    projects.forEach(p => {
      const activeClass = currentActiveId && parseInt(currentActiveId) === p.id ? 'active' : '';
      html += `
        <div class="project-item">
          <button class="project-btn ${activeClass}" onclick="AppClassifyView.selectProject(${p.id})">${p.name}</button>
          <button class="btn-delete-project" onclick="AppClassifyView.deleteProject(${p.id})" title="Xóa dự án">🗑️</button>
        </div>
      `;
    });
    listContainer.innerHTML = html;
  }

  // Render các nút phân trang
  function renderPagination(pagination) {
    const pagContainer = document.getElementById('projects-pagination');
    if (!pagContainer) return;

    const totalPages = pagination.totalPages || 0;
    const current = pagination.currentPage || 1;

    if (totalPages <= 1) {
      pagContainer.innerHTML = '';
      return;
    }

    let html = '';
    
    // Nút trước (Prev)
    html += `<button class="pagination-btn" ${current === 1 ? 'disabled' : ''} onclick="AppClassifyView.loadProjects(${current - 1})">&lt;</button>`;

    // Các số trang
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn ${i === current ? 'active' : ''}" onclick="AppClassifyView.loadProjects(${i})">${i}</button>`;
    }

    // Nút sau (Next)
    html += `<button class="pagination-btn" ${current === totalPages ? 'disabled' : ''} onclick="AppClassifyView.loadProjects(${current + 1})">&gt;</button>`;

    pagContainer.innerHTML = html;
  }

  // Chọn dự án đã lưu
  function selectProject(id) {
    const project = _loadedProjects.find(p => p.id === id);
    if (!project) return;

    // Reset list check
    Object.keys(_checks).forEach(k => delete _checks[k]);

    // 1. Điền lại toàn bộ dữ liệu biểu mẫu
    document.getElementById('f-project-id').value = project.id;
    document.getElementById('f-name').value = project.name;
    document.getElementById('f-nganh').value = project.form_data.nganh;
    
    // Cập nhật lại nhãn công suất dựa trên ngành đã chọn
    global.AppNavigation.updateCapLabel();

    document.getElementById('f-cap').value = project.form_data.cap;
    document.getElementById('f-nt').value = project.form_data.nt;
    document.getElementById('f-kt').value = project.form_data.kt;
    
    const tinhSelect = document.getElementById('f-tinh');
    if (tinhSelect) {
      const val = project.form_data.tinh || '';
      let exists = false;
      for (let i = 0; i < tinhSelect.options.length; i++) {
        if (tinhSelect.options[i].value === val) {
          exists = true;
          break;
        }
      }
      if (!exists && val) {
        const newOpt = document.createElement('option');
        newOpt.value = val;
        newOpt.textContent = val;
        tinhSelect.appendChild(newOpt);
      }
      tinhSelect.value = val;
    }
    
    document.getElementById('ck-rung').checked = project.form_data.rung;
    document.getElementById('ck-lua').checked = project.form_data.lua;
    document.getElementById('ck-bg').checked = project.form_data.bg;
    document.getElementById('ck-kcn').checked = project.form_data.kcn;
    document.getElementById('ck-phanky').checked = project.form_data.phanky;
    document.getElementById('ck-morongdt').checked = project.form_data.morongdt;
    document.getElementById('ck-ctnh').checked = project.form_data.ctnh;
    document.getElementById('ck-dtcong').checked = project.form_data.dtcong;

    // Khôi phục checklist state lưu trong database
    const savedChecks = project.checklist_state || {};
    Object.assign(_checks, savedChecks);

    // 2. Chạy phân loại (tắt chế độ tự động lưu để tránh trùng lặp)
    runClassification(false);

    // 3. Phục hồi tick chọn checklist hiển thị lên UI
    Object.entries(savedChecks).forEach(([chkId, checked]) => {
      const box = document.getElementById('b' + chkId);
      const txt = document.getElementById('t' + chkId);
      if (box) box.classList.toggle('done', checked);
      if (txt) txt.classList.toggle('done', checked);
    });

    updateProgress();
    
    // Cập nhật trạng thái active trên danh sách UI
    renderProjectsList(_loadedProjects);
  }

  // API: Xóa dự án
  function deleteProject(id) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra nút dự án lớn
    
    const project = _loadedProjects.find(p => p.id === id);
    const projectName = project ? project.name : 'dự án này';

    if (!confirm(`Bạn có chắc chắn muốn xóa "${projectName}"? Hành động này không thể khôi phục!`)) {
      return;
    }

    fetch(`/api/projects/${id}`, {
      method: 'DELETE'
    })
    .then(res => {
      if (!res.ok) throw new Error('Không thể xóa dự án.');
      return res.json();
    })
    .then(data => {
      alert('Đã xóa dự án thành công!');
      
      const currentActiveId = document.getElementById('f-project-id').value;
      if (currentActiveId && parseInt(currentActiveId) === id) {
        resetClassifyForm();
      }
      
      // Load lại trang hiện tại
      loadProjects(_currentProjectPage);
    })
    .catch(err => {
      console.error(err);
      alert('Đã xảy ra lỗi khi xóa dự án!');
    });
  }

  // Xóa trắng form để chuẩn bị tạo dự án mới
  function resetClassifyForm() {
    document.getElementById('f-project-id').value = '';
    document.getElementById('f-name').value = '';
    document.getElementById('f-nganh').value = '';
    document.getElementById('f-cap').value = '';
    document.getElementById('f-nt').value = '';
    document.getElementById('f-kt').value = '';
    document.getElementById('f-tinh').value = '';
    
    document.getElementById('ck-rung').checked = false;
    document.getElementById('ck-lua').checked = false;
    document.getElementById('ck-bg').checked = false;
    document.getElementById('ck-kcn').checked = false;
    document.getElementById('ck-phanky').checked = false;
    document.getElementById('ck-morongdt').checked = false;
    document.getElementById('ck-ctnh').checked = false;
    document.getElementById('ck-dtcong').checked = false;

    // Reset checks
    Object.keys(_checks).forEach(k => delete _checks[k]);

    // Trả lại kết quả rỗng
    document.getElementById('result-area').innerHTML = `
      <div class="result-empty">
        <div style="font-size:40px;margin-bottom:12px">📋</div>
        <div style="font-weight:500;color:var(--text2);margin-bottom:6px">Nhập thông tin dự án</div>
        <div style="font-size:13px">Điền form bên trái và nhấn <strong>Phân loại</strong><br>để xem kết quả chi tiết</div>
      </div>
    `;

    // Cập nhật lại nhãn công suất
    global.AppNavigation.updateCapLabel();
    
    // Cập nhật lại active class trên UI
    renderProjectsList(_loadedProjects);
  }

  function initClassifyForm() {
    document.querySelector('.btn-classify').addEventListener('click', doClassify);
    
    document.getElementById('result-area').addEventListener('click', (event) => {
      const item = event.target.closest('.cl-item');
      if (item && item.dataset.checkId) toggleCL(item.dataset.checkId);
    });

    const newProjBtn = document.getElementById('btn-new-project');
    if (newProjBtn) {
      newProjBtn.addEventListener('click', resetClassifyForm);
    }
  }

  global.AppClassifyView = { 
    initClassifyForm, 
    doClassify, 
    toggleCL, 
    updateProgress,
    loadProjects,
    selectProject,
    deleteProject,
    resetClassifyForm
  };
})(window);
