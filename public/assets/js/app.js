// Application entry point with Authentication control.
(function (global) {
  'use strict';

  global.CurrentUser = null;

  // --- HỆ THỐNG XÁC THỰC (AUTH MODULE) ---
  const AppAuth = {
    showLoginModal() {
      const modal = document.getElementById('login-modal');
      if (modal) modal.style.display = 'flex';
      // Xóa thông báo lỗi cũ
      const errEl = document.getElementById('login-error-msg');
      if (errEl) errEl.style.display = 'none';
    },

    hideLoginModal() {
      const modal = document.getElementById('login-modal');
      if (modal) modal.style.display = 'none';
      // Reset form
      const form = document.getElementById('login-form');
      if (form) form.reset();
    },

    checkAuthStatus() {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.loggedIn) {
            global.CurrentUser = data.user;
            AppAuth.updateUIForLoggedIn(data.user);
          } else {
            global.CurrentUser = null;
            AppAuth.updateUIForLoggedOut();
          }
        })
        .catch(err => {
          console.error('Lỗi kiểm tra auth:', err);
          global.CurrentUser = null;
          AppAuth.updateUIForLoggedOut();
        });
    },

    updateUIForLoggedIn(user) {
      // 1. Cập nhật header hiển thị tên & nút Đăng xuất
      const authContainer = document.getElementById('auth-status-container');
      if (authContainer) {
        authContainer.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:13px;color:var(--text2)">Xin chào, <strong>${user.fullName}</strong></span>
            <button class="filter-btn" id="btn-logout" style="border-radius:6px;padding:6px 12px;font-weight:600">Đăng xuất</button>
          </div>
        `;
        // Bind sự kiện Đăng xuất
        document.getElementById('btn-logout').addEventListener('click', AppAuth.handleLogout);
      }

      // 2. Mở khóa các tab nội bộ (Phân loại & QCVN)
      const tabClassify = document.getElementById('tab-classify');
      const tabQcvn = document.getElementById('tab-qcvn');
      const tabAdmin = document.getElementById('tab-admin');
      
      if (tabClassify) tabClassify.innerHTML = '🔍 Phân loại dự án';
      if (tabQcvn) tabQcvn.innerHTML = '📊 So sánh QCVN';
      
      if (user.role === 'admin') {
        if (tabAdmin) tabAdmin.style.display = 'block';
        if (global.AppAdminView && global.AppAdminView.initAdminView) {
          global.AppAdminView.initAdminView();
        }
      } else {
        if (tabAdmin) tabAdmin.style.display = 'none';
      }

      // 3. Hiển thị Sidebar dự án đã lưu
      const sidebar = document.getElementById('projects-sidebar-container');
      const grid = document.querySelector('.classify-grid');
      if (sidebar) sidebar.style.display = 'block';
      if (grid) grid.classList.add('has-sidebar');

      // Hiển thị Sidebar QCVN mẫu đã lưu
      const qcvnSidebar = document.getElementById('qcvn-sidebar-container');
      const qcvnGrid = document.getElementById('qv-grid-container');
      const btnSaveQcvn = document.getElementById('btn-save-qcvn-sample');
      if (qcvnSidebar) qcvnSidebar.style.display = 'block';
      if (qcvnGrid) qcvnGrid.classList.add('has-sidebar');
      if (btnSaveQcvn) btnSaveQcvn.style.display = 'inline-block';

      // 4. Gọi API tải danh sách dự án của nhân viên này
      if (global.AppClassifyView && global.AppClassifyView.loadProjects) {
        global.AppClassifyView.loadProjects(1);
      }

      // Gọi API tải danh sách mẫu QCVN của nhân viên này
      if (global.AppQcvnView && global.AppQcvnView.loadQcvnSamples) {
        global.AppQcvnView.loadQcvnSamples(1);
      }
    },

    updateUIForLoggedOut() {
      // 1. Cập nhật header hiển thị nút Đăng nhập
      const authContainer = document.getElementById('auth-status-container');
      if (authContainer) {
        authContainer.innerHTML = `
          <button class="filter-btn" id="btn-show-login" style="border-radius:6px;padding:6px 12px;font-weight:600">🔒 Đăng nhập</button>
        `;
        document.getElementById('btn-show-login').addEventListener('click', AppAuth.showLoginModal);
      }

      // 2. Khóa các tab nội bộ (Thêm icon ổ khóa)
      const tabClassify = document.getElementById('tab-classify');
      const tabQcvn = document.getElementById('tab-qcvn');
      const tabAdmin = document.getElementById('tab-admin');
      
      if (tabClassify) tabClassify.innerHTML = '🔒 Phân loại dự án';
      if (tabQcvn) tabQcvn.innerHTML = '🔒 So sánh QCVN';
      if (tabAdmin) tabAdmin.style.display = 'none';

      // 3. Ẩn Sidebar dự án đã lưu
      const sidebar = document.getElementById('projects-sidebar-container');
      const grid = document.querySelector('.classify-grid');
      if (sidebar) sidebar.style.display = 'none';
      if (grid) grid.classList.remove('has-sidebar');

      // Ẩn Sidebar QCVN mẫu đã lưu
      const qcvnSidebar = document.getElementById('qcvn-sidebar-container');
      const qcvnGrid = document.getElementById('qv-grid-container');
      const btnSaveQcvn = document.getElementById('btn-save-qcvn-sample');
      if (qcvnSidebar) qcvnSidebar.style.display = 'none';
      if (qcvnGrid) qcvnGrid.classList.remove('has-sidebar');
      if (btnSaveQcvn) btnSaveQcvn.style.display = 'none';

      // 4. Nếu người dùng đang đứng ở tab bị khóa, chuyển ngay về tab Văn bản pháp lý
      const activeTab = document.querySelector('.nav-btn.active');
      if (activeTab && activeTab.classList.contains('tab-private')) {
        const defaultTab = document.querySelector('.nav-btn[data-page="laws"]');
        if (defaultTab) {
          global.AppNavigation.showPage('laws', defaultTab);
        }
      }

      // Reset form nhập phân loại
      if (global.AppClassifyView && global.AppClassifyView.resetClassifyForm) {
        global.AppClassifyView.resetClassifyForm();
      }

      // Reset QCVN view
      if (global.AppQcvnView && global.AppQcvnView.clearValues) {
        global.AppQcvnView.clearValues();
      }
      if (global.AppQcvnView && global.AppQcvnView.resetUnsavedChanges) {
        global.AppQcvnView.resetUnsavedChanges();
      }
    },

    handleLogin(e) {
      e.preventDefault();
      const usernameInput = document.getElementById('login-username');
      const passwordInput = document.getElementById('login-password');
      const errorEl = document.getElementById('login-error-msg');

      const username = usernameInput.value;
      const password = passwordInput.value;

      fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.error || 'Đăng nhập không thành công.'); });
        }
        return res.json();
      })
      .then(data => {
        AppAuth.hideLoginModal();
        global.CurrentUser = data.user;
        AppAuth.updateUIForLoggedIn(data.user);
        alert(`Chào mừng trở lại, ${data.user.fullName}!`);
      })
      .catch(err => {
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.style.display = 'block';
        }
      });
    },

    handleLogout() {
      if (!confirm('Bạn có chắc chắn muốn đăng xuất không?')) return;

      fetch('/api/auth/logout', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          global.CurrentUser = null;
          AppAuth.updateUIForLoggedOut();
          alert('Đăng xuất thành công!');
        })
        .catch(err => console.error('Lỗi đăng xuất:', err));
    }
  };

  // --- KHỞI CHẠY HỆ THỐNG (INITIALIZER) ---
  function initApp() {
    // 1. Khởi chạy navigation & laws
    global.AppNavigation.initNavigation();
    global.AppLawsView.initLawFilters();
    global.AppClassifyView.initClassifyForm();

    // Tải động văn bản pháp lý từ API
    global.AppData = global.AppData || {};
    fetch('/api/laws')
      .then(res => res.json())
      .then(laws => {
        global.AppData.LAWS = laws;
        global.AppLawsView.renderLaws();
      })
      .catch(err => {
        console.error('Lỗi tải văn bản pháp lý từ API:', err);
        global.AppData.LAWS = [];
        global.AppLawsView.renderLaws();
      });

    // Tải động dữ liệu QCVN từ API
    fetch('/api/qcvns')
      .then(res => res.json())
      .then(qcvns => {
        global.AppData.QCVN_DATA = qcvns;
        if (global.AppQcvnView && global.AppQcvnView.initQcvnView) {
          global.AppQcvnView.initQcvnView();
        }
      })
      .catch(err => {
        console.error('Lỗi tải dữ liệu QCVN từ API:', err);
        global.AppData.QCVN_DATA = {};
        if (global.AppQcvnView && global.AppQcvnView.initQcvnView) {
          global.AppQcvnView.initQcvnView();
        }
      });

    // 2. Bind các sự kiện login modal ở frontend
    const closeLoginBtn = document.getElementById('btn-close-login');
    const loginForm = document.getElementById('login-form');

    if (closeLoginBtn) closeLoginBtn.addEventListener('click', AppAuth.hideLoginModal);
    if (loginForm) loginForm.addEventListener('submit', AppAuth.handleLogin);

    // 3. Kiểm tra trạng thái đăng nhập từ Cookie của Server
    AppAuth.checkAuthStatus();
  }

  global.AppAuth = AppAuth;
  document.addEventListener('DOMContentLoaded', initApp);
})(window);
