// Admin page UI logic.
(function (global) {
  'use strict';

  let initialized = false;

  // Trạng thái hiện tại
  let currentAdminSubpage = 'users';
  let lastFetchedLaws = []; // Lưu danh sách văn bản tải về để lọc tại Client

  function initAdminView() {
    if (initialized) return;
    initialized = true;

    // 1. Chuyển đổi tab con của admin
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.adminPage;
        switchSubpage(page);
      });
    });

    // 2. Bind sự kiện quản lý tài khoản nhân viên
    document.getElementById('btn-admin-add-user').addEventListener('click', openAddUserModal);
    document.getElementById('btn-close-user-modal').addEventListener('click', closeUserModal);
    document.getElementById('user-form').addEventListener('submit', handleUserFormSubmit);

    // 3. Bind sự kiện quản lý quy chuẩn pháp lý
    document.getElementById('btn-admin-add-law').addEventListener('click', openAddLawModal);
    document.getElementById('btn-close-law-modal').addEventListener('click', closeLawModal);
    document.getElementById('law-form').addEventListener('submit', handleLawFormSubmit);

    // Bind sự kiện cho bộ lọc & tìm kiếm văn bản pháp lý
    const searchInput = document.getElementById('admin-law-search');
    const typeFilter = document.getElementById('admin-law-filter-type');
    
    if (searchInput) {
      searchInput.addEventListener('input', filterAndRenderLawsTable);
    }
    if (typeFilter) {
      typeFilter.addEventListener('change', filterAndRenderLawsTable);
    }

    // Load subpage mặc định
    switchSubpage('users');
  }

  function switchSubpage(subpage) {
    currentAdminSubpage = subpage;
    
    // Cập nhật class active ở sidebar
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      if (btn.dataset.adminPage === subpage) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Hiện subpage tương ứng
    document.querySelectorAll('.admin-subpage').forEach(el => {
      el.style.display = 'none';
    });
    
    const targetEl = document.getElementById(`admin-${subpage}`);
    if (targetEl) targetEl.style.display = 'block';

    // Tải dữ liệu tương ứng
    if (subpage === 'users') {
      loadUsers();
    } else if (subpage === 'projects') {
      loadProjects();
    } else if (subpage === 'laws') {
      loadLaws();
    }
  }

  // =================================================================
  // 👥 QUẢN LÝ TÀI KHOẢN NHÂN VIÊN
  // =================================================================

  function loadUsers() {
    fetch('/api/admin/users')
      .then(res => {
        if (!res.ok) throw new Error('Không thể lấy danh sách nhân viên');
        return res.json();
      })
      .then(users => {
        renderUsersTable(users);
      })
      .catch(err => {
        console.error(err);
        alert('Lỗi tải danh sách tài khoản!');
      });
  }

  function renderUsersTable(users) {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3)">Chưa có tài khoản nào được tạo.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const createdDate = new Date(u.created_at).toLocaleDateString('vi-VN');
      const isSelf = global.CurrentUser && global.CurrentUser.id === u.id;
      
      return `
        <tr>
          <td><strong>${u.username}</strong></td>
          <td>${u.full_name}</td>
          <td><span class="chip-status ${u.role === 'admin' ? 'valid' : 'amended'}">${u.role.toUpperCase()}</span></td>
          <td>${createdDate}</td>
          <td style="text-align:right">
            <div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap">
              <button class="btn-action-edit" onclick="AppAdminView.triggerEditUser(${JSON.stringify(u).replace(/"/g, '&quot;')})">✏️ Sửa</button>
              <button class="btn-action-delete" ${isSelf ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ''} onclick="AppAdminView.triggerDeleteUser(${u.id}, '${u.username}')">🗑️ Xoá</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Mở modal thêm nhân viên
  function openAddUserModal() {
    document.getElementById('user-modal-title').textContent = 'Thêm nhân viên mới';
    document.getElementById('user-modal-id').value = '';
    document.getElementById('user-modal-username').value = '';
    document.getElementById('user-modal-username').disabled = false;
    document.getElementById('user-modal-fullname').value = '';
    document.getElementById('user-modal-password').value = '';
    document.getElementById('user-modal-password').placeholder = 'Nhập mật khẩu cho tài khoản...';
    document.getElementById('user-modal-pw-required-indicator').style.display = 'inline';
    document.getElementById('user-modal-password').setAttribute('required', 'required');
    document.getElementById('user-modal-role').value = 'staff';
    document.getElementById('user-modal-error-msg').style.display = 'none';
    
    document.getElementById('user-modal').style.display = 'flex';
  }

  // Mở modal sửa nhân viên
  function triggerEditUser(user) {
    document.getElementById('user-modal-title').textContent = `Chỉnh sửa: ${user.username}`;
    document.getElementById('user-modal-id').value = user.id;
    document.getElementById('user-modal-username').value = user.username;
    document.getElementById('user-modal-username').disabled = true; // Khóa không cho sửa username
    document.getElementById('user-modal-fullname').value = user.full_name;
    document.getElementById('user-modal-password').value = '';
    document.getElementById('user-modal-password').placeholder = 'Để trống nếu muốn giữ nguyên mật khẩu cũ';
    document.getElementById('user-modal-pw-required-indicator').style.display = 'none';
    document.getElementById('user-modal-password').removeAttribute('required');
    document.getElementById('user-modal-role').value = user.role;
    document.getElementById('user-modal-error-msg').style.display = 'none';

    document.getElementById('user-modal').style.display = 'flex';
  }

  function closeUserModal() {
    document.getElementById('user-modal').style.display = 'none';
    document.getElementById('user-form').reset();
  }

  function handleUserFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('user-modal-id').value;
    const username = document.getElementById('user-modal-username').value;
    const fullName = document.getElementById('user-modal-fullname').value;
    const password = document.getElementById('user-modal-password').value;
    const role = document.getElementById('user-modal-role').value;
    const errorEl = document.getElementById('user-modal-error-msg');

    const isEdit = !!id;
    const url = isEdit ? `/api/admin/users/${id}` : '/api/admin/users';
    const method = isEdit ? 'PUT' : 'POST';

    const body = { username, fullName, role };
    if (password && password.trim() !== '') {
      body.password = password;
    }

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đã xảy ra lỗi!');
      return data;
    })
    .then(data => {
      closeUserModal();
      loadUsers();
      alert(data.message);
    })
    .catch(err => {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    });
  }

  function triggerDeleteUser(id, username) {
    if (!confirm(`Bạn có chắc chắn muốn XÓA hoàn toàn tài khoản nhân viên "${username}" không?\nHành động này không thể hoàn tác!`)) {
      return;
    }

    fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không thể xóa tài khoản!');
        return data;
      })
      .then(data => {
        loadUsers();
        alert(data.message);
      })
      .catch(err => {
        console.error(err);
        alert(err.message);
      });
  }

  // =================================================================
  // 📂 QUẢN LÝ DỰ ÁN TOÀN HỆ THỐNG
  // =================================================================

  function loadProjects() {
    fetch('/api/admin/projects')
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải toàn bộ danh sách dự án');
        return res.json();
      })
      .then(projects => {
        renderProjectsTable(projects);
      })
      .catch(err => {
        console.error(err);
        alert('Lỗi tải danh sách dự án!');
      });
  }

  function renderProjectsTable(projects) {
    const tbody = document.getElementById('admin-projects-tbody');
    if (!tbody) return;

    if (projects.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3)">Chưa có dự án nào trên hệ thống.</td></tr>`;
      return;
    }

    tbody.innerHTML = projects.map(p => {
      const createdDate = new Date(p.created_at).toLocaleString('vi-VN');
      const form = p.form_data || {};
      const industryKey = form.nganh || '';
      
      // Tìm tên ngành nghề
      let industryName = 'Chưa xác định';
      if (global.AppData && global.AppData.IND_DB && global.AppData.IND_DB[industryKey]) {
        industryName = global.AppData.IND_DB[industryKey].name || industryKey;
      }

      return `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.owner_name} (${p.owner_username})</td>
          <td><span style="font-size:12px;color:var(--text2)">${industryName}</span></td>
          <td>${createdDate}</td>
          <td style="text-align:right">
            <div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap">
              <button class="btn-action-delete" onclick="AppAdminView.triggerDeleteProject(${p.id}, '${p.name.replace(/'/g, "\\'")}')">🗑️ Xoá</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function triggerDeleteProject(id, name) {
    if (!confirm(`Bạn có chắc chắn muốn XÓA dự án "${name}" của nhân viên không?\nHành động này không thể hoàn tác!`)) {
      return;
    }

    fetch(`/api/admin/projects/${id}`, { method: 'DELETE' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa dự án');
        return data;
      })
      .then(data => {
        loadProjects();
        alert(data.message);
      })
      .catch(err => {
        console.error(err);
        alert(err.message);
      });
  }

  // =================================================================
  // 📜 QUẢN LÝ VĂN BẢN PHÁP LÝ & QUY CHUẨN
  // =================================================================

  function loadLaws() {
    fetch('/api/laws')
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải danh sách văn bản pháp lý');
        return res.json();
      })
      .then(laws => {
        // Cập nhật lại kho laws toàn cục ở frontend
        if (global.AppData) {
          global.AppData.LAWS = laws;
        }
        lastFetchedLaws = laws;
        filterAndRenderLawsTable();
      })
      .catch(err => {
        console.error(err);
        alert('Lỗi tải danh sách quy chuẩn!');
      });
  }

  function filterAndRenderLawsTable() {
    const searchVal = document.getElementById('admin-law-search').value.toLowerCase().trim();
    const typeVal = document.getElementById('admin-law-filter-type').value;

    const filtered = lastFetchedLaws.filter(l => {
      // 1. Lọc theo Loại văn bản
      if (typeVal !== 'all' && l.type !== typeVal) return false;
      
      // 2. Lọc theo từ khóa tìm kiếm
      if (searchVal) {
        const matchesSo = l.so && l.so.toLowerCase().includes(searchVal);
        const matchesTen = l.ten && l.ten.toLowerCase().includes(searchVal);
        const matchesId = l.id && l.id.toLowerCase().includes(searchVal);
        return matchesSo || matchesTen || matchesId;
      }
      
      return true;
    });

    renderLawsTable(filtered);
  }

  function getTypeLabel(type) {
    return {
      luat: 'Luật',
      nd: 'Nghị định',
      vbhn: 'VBHN',
      tt: 'Thông tư',
      qcvn: 'QCVN'
    }[type] || type.toUpperCase();
  }

  function renderLawsTable(laws) {
    const tbody = document.getElementById('admin-laws-tbody');
    if (!tbody) return;

    if (laws.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3)">Không tìm thấy văn bản phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = laws.map(l => {
      return `
        <tr>
          <td><code>${l.id}</code></td>
          <td><span class="chip-status valid" style="background:#eaf2f8;color:#2980b9">${getTypeLabel(l.type)}</span></td>
          <td>
            <strong>${l.so}</strong>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">Năm ban hành: ${l.year}</div>
          </td>
          <td><span class="chip-status ${l.status}">${l.status === 'valid' ? 'Hiệu lực' : (l.status === 'amended' ? 'Sửa đổi' : 'Hết HL')}</span></td>
          <td style="text-align:right">
            <div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap">
              <button class="btn-action-edit" onclick="AppAdminView.triggerEditLaw(${JSON.stringify(l).replace(/"/g, '&quot;')})">✏️ Sửa</button>
              <button class="btn-action-delete" onclick="AppAdminView.triggerDeleteLaw('${l.id}', '${l.so}')">🗑️ Xoá</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function openAddLawModal() {
    document.getElementById('law-modal-title').textContent = 'Thêm quy chuẩn môi trường mới';
    
    // Reset form
    document.getElementById('law-form').reset();
    document.getElementById('law-modal-id').disabled = false; // Mở khóa cho nhập ID mới
    document.getElementById('law-modal-error-msg').style.display = 'none';

    document.getElementById('law-modal').style.display = 'flex';
  }

  function triggerEditLaw(law) {
    document.getElementById('law-modal-title').textContent = `Sửa văn bản: ${law.so}`;
    
    // Fill fields
    const idEl = document.getElementById('law-modal-id');
    idEl.value = law.id;
    idEl.disabled = true; // Khóa ID không cho sửa

    document.getElementById('law-modal-type').value = law.type;
    document.getElementById('law-modal-year').value = law.year;
    document.getElementById('law-modal-sortdate').value = law.sortDate || '';
    document.getElementById('law-modal-so').value = law.so;
    document.getElementById('law-modal-status').value = law.status || 'valid';
    document.getElementById('law-modal-ten').value = law.ten;
    document.getElementById('law-modal-hieuluc').value = law.hieuluc || '';
    document.getElementById('law-modal-mota').value = law.mo_ta || '';
    
    // Điều khoản: Chuyển mảng thành dạng chuỗi phân dòng
    const dk = law.dieu_khoang || [];
    document.getElementById('law-modal-dieukhoan').value = Array.isArray(dk) ? dk.join('\n') : '';
    
    document.getElementById('law-modal-note').value = law.note || '';
    document.getElementById('law-modal-link').value = law.link || '';
    document.getElementById('law-modal-error-msg').style.display = 'none';

    document.getElementById('law-modal').style.display = 'flex';
  }

  function closeLawModal() {
    document.getElementById('law-modal').style.display = 'none';
    document.getElementById('law-form').reset();
  }

  function handleLawFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('law-modal-id').value;
    const type = document.getElementById('law-modal-type').value;
    const year = document.getElementById('law-modal-year').value;
    const sortDate = document.getElementById('law-modal-sortdate').value;
    const so = document.getElementById('law-modal-so').value;
    const status = document.getElementById('law-modal-status').value;
    const ten = document.getElementById('law-modal-ten').value;
    const hieuluc = document.getElementById('law-modal-hieuluc').value;
    const mota = document.getElementById('law-modal-mota').value;
    const dieukhoanText = document.getElementById('law-modal-dieukhoan').value;
    const note = document.getElementById('law-modal-note').value;
    const link = document.getElementById('law-modal-link').value;
    const errorEl = document.getElementById('law-modal-error-msg');

    // Chuyển chuỗi điều khoản phân dòng thành mảng
    const dieu_khoang = dieukhoanText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const isEdit = document.getElementById('law-modal-id').disabled; // Nếu disabled tức là đang edit
    const url = isEdit ? `/api/laws/${id}` : '/api/laws';
    const method = isEdit ? 'PUT' : 'POST';

    const body = {
      id,
      type,
      year: parseInt(year),
      sortDate: sortDate || null,
      so,
      ten,
      hieuluc: hieuluc || null,
      status,
      mo_ta: mota || null,
      dieu_khoang,
      note: note || null,
      link: link || null
    };

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi khi lưu văn bản!');
      return data;
    })
    .then(data => {
      closeLawModal();
      loadLaws();
      
      // Đồng bộ live sang tab văn bản pháp lý của User
      if (global.AppLawsView && global.AppLawsView.renderLaws) {
        setTimeout(() => {
          global.AppLawsView.renderLaws();
        }, 300);
      }
      
      alert(data.message);
    })
    .catch(err => {
      errorEl.textContent = err.message;
      errorEl.style.display = 'block';
    });
  }

  function triggerDeleteLaw(id, so) {
    if (!confirm(`Bạn có chắc chắn muốn XÓA quy chuẩn/văn bản "${so}" không?\nHành động này sẽ xóa vĩnh viễn dữ liệu trong database!`)) {
      return;
    }

    fetch(`/api/laws/${id}`, { method: 'DELETE' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi xóa quy chuẩn!');
        return data;
      })
      .then(data => {
        loadLaws();
        
        // Đồng bộ live sang tab văn bản pháp lý công khai
        setTimeout(() => {
          if (global.AppLawsView && global.AppLawsView.renderLaws) {
            global.AppLawsView.renderLaws();
          }
        }, 300);

        alert(data.message);
      })
      .catch(err => {
        console.error(err);
        alert(err.message);
      });
  }

  // Export các chức năng cho global scope để gọi từ HTML button onclick
  global.AppAdminView = {
    initAdminView,
    triggerEditUser,
    triggerDeleteUser,
    triggerDeleteProject,
    triggerEditLaw,
    triggerDeleteLaw
  };

})(window);
