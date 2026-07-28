// Legal document list UI.
(function (global) {
  'use strict';

  let currentFilter = 'all';

  function normalizeString(str) {
    return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';
  }

  function getLawSortTime(law) {
    if (law.sortDate) return new Date(law.sortDate).getTime();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(law.hieuluc)) {
      const [day, month, year] = law.hieuluc.split('/');
      return new Date(`${year}-${month}-${day}`).getTime();
    }
    return new Date(`${law.year}-01-01`).getTime();
  }

  function getTypeLabel(type) {
    return {
      luat: 'LUẬT',
      nd: 'NGHỊ ĐỊNH',
      tt: 'THÔNG TƯ',
      qcvn: 'QCVN',
      vbhn: 'VBHN'
    }[type] || type.toUpperCase();
  }

  function getStatusLabel(status) {
    return {
      valid: 'Còn hiệu lực',
      amended: 'Đã sửa đổi (đọc kết hợp)',
      expired: 'Hết hiệu lực'
    }[status] || status;
  }

  function renderLaws() {
    const list = document.getElementById('law-list');
    if (!list) return;

    const searchInput = document.getElementById('public-law-search');
    const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const term = normalizeString(searchVal);

    const filtered = global.AppData.LAWS.filter(l => {
      // 1. Filter by category tabs
      if (currentFilter !== 'all') {
        if (currentFilter === 'hieuluc' && l.status !== 'valid') return false;
        if (currentFilter === 'suadoi' && l.status !== 'amended') return false;
        if (currentFilter !== 'hieuluc' && currentFilter !== 'suadoi' && l.type !== currentFilter) return false;
      }

      // 2. Filter by search input (ten, so, type name)
      if (term) {
        const matchesText = normalizeString(l.ten).includes(term) || normalizeString(l.so).includes(term);

        let matchesType = false;
        if (l.type === 'luat' && ('luat'.includes(term) || 'luật'.includes(searchVal))) matchesType = true;
        if (l.type === 'nd' && ('nghi dinh'.includes(term) || 'nd'.includes(term) || 'nghị định'.includes(searchVal))) matchesType = true;
        if (l.type === 'tt' && ('thong tu'.includes(term) || 'tt'.includes(term) || 'thông tư'.includes(searchVal))) matchesType = true;
        if (l.type === 'qcvn' && ('qcvn'.includes(term) || 'quy chuan'.includes(term) || 'quy chuẩn'.includes(searchVal))) matchesType = true;
        if (l.type === 'vbhn' && ('vbhn'.includes(term) || 'van ban hop nhat'.includes(term) || 'văn bản hợp nhất'.includes(searchVal))) matchesType = true;

        return matchesText || matchesType;
      }

      return true;
    }).sort((a, b) => getLawSortTime(b) - getLawSortTime(a));

    if (filtered.length === 0) {
      list.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text3)">Không tìm thấy văn bản pháp lý nào phù hợp.</div>`;
      return;
    }

    list.innerHTML = filtered.map((l, i) => `
      <div class="law-card ${l.status === 'expired' ? 'expired' : ''} fade-up" style="animation-delay:${i * 0.04}s; display: flex; flex-direction: column; justify-content: space-between">
        <div>
          <div class="law-accent ${l.status}"></div>
          <div style="padding-left:12px">
            <div class="law-meta">
              <div class="law-year">${l.year}</div>
              <div class="law-content">
                <div class="law-status">
                  <div class="status-dot ${l.status}"></div>
                  <span class="status-label">${getStatusLabel(l.status)}</span>
                  <span class="chip chip-gray" style="margin-left:4px">${getTypeLabel(l.type)}</span>
                </div>
                <div class="law-title">${l.ten}</div>
                <div class="law-number">${l.so} — Hiệu lực: ${l.hieuluc}</div>
                <div class="law-desc">${l.mo_ta}</div>
                ${l.note ? `<div style="font-size:12px;color:var(--warn);margin-bottom:8px;padding:6px 10px;background:var(--warn-bg);border-radius:5px;border-left:3px solid #D4860A">⚡ ${l.note}</div>` : ''}
                <div class="law-provisions">
                  ${(l.dieu_khoang || []).slice(0, 3).map(d => `<span class="provision">${d}</span>`).join('')}
                  ${(l.dieu_khoang || []).length > 3 ? `<span class="provision" style="background:var(--surface2);color:var(--text3)">+${l.dieu_khoang.length - 3} điều khoản khác</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div style="padding-left:12px; margin-top:16px; display:flex; justify-content:flex-end">
          <button class="btn-classify" style="width:auto; margin:0; padding:6px 14px; font-size:13px; display:flex; align-items:center; gap:6px" onclick="AppLawsView.showLawDetail('${l.id}')">
            Xem chi tiết
          </button>
        </div>
      </div>`).join('');
  }

  function showLawDetail(lawId) {
    const law = global.AppData.LAWS.find(l => l.id === lawId);
    if (!law) return;

    const typeBadge = document.getElementById('law-detail-type-badge');
    const title = document.getElementById('law-detail-title');
    const meta = document.getElementById('law-detail-meta');
    const desc = document.getElementById('law-detail-desc');
    const provisionsList = document.getElementById('law-detail-provisions-list');
    const noteContainer = document.getElementById('law-detail-note-container');
    const noteText = document.getElementById('law-detail-note-text');
    const externalLink = document.getElementById('law-detail-external-link');
    const modal = document.getElementById('law-detail-modal');

    if (typeBadge) {
      typeBadge.className = `chip chip-status ${law.status}`;
      typeBadge.textContent = getTypeLabel(law.type);
    }
    if (title) title.textContent = law.ten;
    if (meta) {
      meta.textContent = `Số hiệu: ${law.so} | Hiệu lực từ: ${law.hieuluc || 'Chưa rõ'} | Trạng thái: ${getStatusLabel(law.status)}`;
    }
    if (desc) desc.textContent = law.mo_ta || 'Không có mô tả chi tiết.';

    if (provisionsList) {
      if (law.dieu_khoang && law.dieu_khoang.length > 0) {
        provisionsList.innerHTML = law.dieu_khoang.map(d => `
          <div style="background:var(--surface);border:1px solid var(--border);padding:10px 14px;border-radius:var(--radius);font-size:14px;color:var(--text);line-height:1.5;display:flex;align-items:flex-start;gap:8px">
            <span style="color:var(--accent);margin-top:2px">✦</span>
            <span>${d}</span>
          </div>
        `).join('');
      } else {
        provisionsList.innerHTML = `<div style="color:var(--text3);font-size:13px;font-style:italic">Chưa cập nhật các điều khoản chi tiết.</div>`;
      }
    }

    if (noteContainer && noteText) {
      if (law.note) {
        noteText.innerHTML = `⚡ <strong>Ghi chú:</strong> ${law.note}`;
        noteContainer.style.display = 'block';
      } else {
        noteContainer.style.display = 'none';
      }
    }

    function getDirectLawLink(l) {
      if (l.link && l.link.startsWith('https://www.luatmoitruong.vn/')) {
        return l.link;
      }
      
      const norm = (str) => {
        if (!str) return '';
        return str.normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[đĐ]/g, 'd')
          .toLowerCase();
      };

      const cleanNum = norm(l.so)
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (l.type === 'luat') {
        if (l.id.includes('bvmt')) return 'https://www.luatmoitruong.vn/luat-bao-ve-moi-truong-2020';
        if (l.id.includes('dat_dai')) return 'https://www.luatmoitruong.vn/luat-dat-dai-2024';
        if (l.id.includes('tainguyen_nuoc')) return 'https://www.luatmoitruong.vn/luat-tai-nguyen-nuoc-2023';
        if (l.id.includes('dautu')) return 'https://www.luatmoitruong.vn/luat-dau-tu-2020';
        return `https://www.luatmoitruong.vn/luat-${cleanNum}`;
      }
      
      if (l.type === 'nd') {
        return `https://www.luatmoitruong.vn/nghi-dinh-${cleanNum}`;
      }
      
      if (l.type === 'tt') {
        return `https://www.luatmoitruong.vn/thong-tu-${cleanNum}`;
      }
      
      if (l.type === 'qcvn') {
        let qSlug = cleanNum;
        if (!qSlug.startsWith('qcvn')) {
          qSlug = 'qcvn-' + qSlug;
        }
        return `https://www.luatmoitruong.vn/${qSlug}`;
      }
      
      if (l.type === 'vbhn') {
        return `https://www.luatmoitruong.vn/van-ban-hop-nhat-${cleanNum}`;
      }

      return `https://www.luatmoitruong.vn/${cleanNum}`;
    }

    if (externalLink) {
      externalLink.href = getDirectLawLink(law);
    }

    if (modal) {
      modal.style.display = 'flex';
    }
  }

  function filterLaws(type, btn) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderLaws();
  }

  function initLawFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => filterLaws(btn.dataset.filter, btn));
    });

    const searchInput = document.getElementById('public-law-search');
    if (searchInput) {
      searchInput.addEventListener('input', renderLaws);
    }

    // Bind close logic for law detail modal
    const modal = document.getElementById('law-detail-modal');
    const closeBtn = document.getElementById('btn-close-law-detail');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
      });
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    }
  }

  global.AppLawsView = { initLawFilters, renderLaws, filterLaws, showLawDetail };
})(window);
