// QCVN comparison view logic.
(function (global) {
  'use strict';

  let QCVN_DATA = {};
  let _loadedSamples = [];
  let _currentSamplePage = 1;
  let _qvUnsavedChanges = false;
  let _qvCurrentSampleId = null;

  // Sub-types for each environmental category
  const SUB_TYPES = {
    nuoc_mat: [
      { value: 'qcvn08_a1', text: 'Cột A1 - Cấp nước sinh hoạt' },
      { value: 'qcvn08_a2', text: 'Cột A2 - Sinh hoạt (có xử lý), Thủy sản' },
      { value: 'qcvn08_b1', text: 'Cột B1 - Tưới tiêu, giao thông thủy' },
      { value: 'qcvn08_b2', text: 'Cột B2 - Các mục đích khác' }
    ],
    nuoc_thai_cn: [
      { value: 'qcvn40_a_low', text: 'Cột A - Lưu lượng xả ≤ 2000 m³/ngày' },
      { value: 'qcvn40_a_high', text: 'Cột A - Lưu lượng xả > 2000 m³/ngày' },
      { value: 'qcvn40_b_low', text: 'Cột B - Lưu lượng xả ≤ 2000 m³/ngày' },
      { value: 'qcvn40_b_high', text: 'Cột B - Lưu lượng xả > 2000 m³/ngày' }
    ],
    nuoc_thai_sh: [
      { value: 'qcvn14_a', text: 'Cột A - Khu vực nhạy cảm' },
      { value: 'qcvn14_b', text: 'Cột B - Các khu vực còn lại' }
    ],
    nuoc_duoi_dat: [
      { value: 'qcvn09', text: 'Quy chuẩn chung' }
    ],
    khong_khi: [
      { value: 'qcvn05_1h', text: 'Trung bình 1 giờ' },
      { value: 'qcvn05_24h', text: 'Trung bình 24 giờ' },
      { value: 'qcvn05_nam', text: 'Trung bình năm' }
    ],
    dat: [
      { value: 'qcvn03_type1', text: 'Loại 1 - Đất nông nghiệp, đất ở, công cộng' },
      { value: 'qcvn03_type2', text: 'Loại 2 - Đất rừng, phi nông nghiệp khác' },
      { value: 'qcvn03_type3', text: 'Loại 3 - Đất công nghiệp, khoáng sản, bãi thải' }
    ]
  };

  // Keywords mapping for parsing pasted text
  const MAP_KEYWORDS = {
    'ph': 'pH',
    'do': 'DO',
    'bod': 'BOD5',
    'cod': 'COD',
    'tss': 'TSS',
    'ran lo lung': 'TSS',
    'amoni': 'NH4N',
    'nh4': 'NH4N',
    'nitrit': 'NO2N',
    'no2': 'NO2N',
    'nitrat': 'NO3N',
    'no3': 'NO3N',
    'phosphat': 'PO4P',
    'po4': 'PO4P',
    'phospho': 'TotalP',
    'total p': 'TotalP',
    'nito': 'TotalN',
    'total n': 'TotalN',
    'xyanua': 'CN',
    'cyanide': 'CN',
    'cn': 'CN',
    'asen': 'As',
    'arsenic': 'As',
    'as': 'As',
    'cadimi': 'Cd',
    'cadmium': 'Cd',
    'cd': 'Cd',
    'chi': 'Pb',
    'lead': 'Pb',
    'pb': 'Pb',
    'crom vi': 'Cr6',
    'crom 6': 'Cr6',
    'cr6': 'Cr6',
    'crom iii': 'Cr3',
    'crom 3': 'Cr3',
    'cr3': 'Cr3',
    'crom': 'Cr',
    'cr': 'Cr',
    'thuy ngan': 'Hg',
    'mercury': 'Hg',
    'hg': 'Hg',
    'dong': 'Cu',
    'copper': 'Cu',
    'cu': 'Cu',
    'kem': 'Zn',
    'zinc': 'Zn',
    'zn': 'Zn',
    'sat': 'Fe',
    'iron': 'Fe',
    'fe': 'Fe',
    'mangan': 'Mn',
    'manganese': 'Mn',
    'mn': 'Mn',
    'niken': 'Ni',
    'nickel': 'Ni',
    'ni': 'Ni',
    'florua': 'F',
    'fluoride': 'F',
    'f': 'F',
    'clo': 'Cl2',
    'chlorine': 'Cl2',
    'cl2': 'Cl2',
    'sunfua': 'S',
    'sulfide': 'S',
    's': 'S',
    'dau mo': 'Oil',
    'oil': 'Oil',
    'coliform': 'Coliform',
    'ecoli': 'Ecoli',
    'so2': 'SO2',
    'co': 'CO',
    'o3': 'O3',
    'ozon': 'O3',
    'tsp': 'TSP',
    'pm10': 'PM10',
    'pm25': 'PM25',
    'pm2.5': 'PM25',
    'tds': 'TDS',
    'do cung': 'Hardness',
    'hardness': 'Hardness',
    'clorua': 'Cl',
    'chloride': 'Cl',
    'cl': 'Cl',
    'sunfat': 'SO4',
    'sulfate': 'SO4',
    'so4': 'SO4'
  };

  function removeAccents(str) {
    return str.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  function matchKey(nameStr) {
    const norm = removeAccents(nameStr.toLowerCase().trim());
    if (MAP_KEYWORDS[norm]) return MAP_KEYWORDS[norm];
    for (const [kw, key] of Object.entries(MAP_KEYWORDS)) {
      if (norm.includes(kw)) return key;
    }
    return null;
  }

  function parsePastedText(text) {
    const lines = text.split('\n');
    const results = {};
    lines.forEach(line => {
      // Split by common delimiters (tabs, colons, equal signs, or multiple spaces)
      const parts = line.split(/\s*[:=,\t]\s*|\s{2,}/);
      if (parts.length >= 2) {
        let nameStr = parts[0].trim();
        let valStr = parts[1].trim();
        nameStr = nameStr.replace(/^\d+[\.\/\)\-]\s*/, ''); // Strip line numbers

        let val = parseFloat(valStr.replace(',', '.'));
        if (isNaN(val)) {
          for (let i = 1; i < parts.length; i++) {
            const testVal = parseFloat(parts[i].trim().replace(',', '.'));
            if (!isNaN(testVal)) {
              val = testVal;
              break;
            }
          }
        }
        if (!isNaN(val)) {
          const matchedKey = matchKey(nameStr);
          if (matchedKey) results[matchedKey] = val;
        }
      } else {
        // Fallback regex for simpler matching like "pH 7.2" or "BOD5 15"
        const match = line.match(/([a-zA-Z0-9\s_đĐàÀảẢãÃáÁạẠằẰằẲẳẴẵắẮặẶèÈẻẺẽẼéÉẹẸềỀểỂễỄếẾệỆìÌỉỈĩĨíÍịỊòÒỏỎõÕóÓọỌồỒổỔỗỖốỐộỘờỜởỞỡỠớỚợỢùÙủỦũŨúÚụỤừỪửỬữỮứỨựỰỳỲỷỶỹỸýÝỵỴ\-\+₅₄]+?)\s+([\d\.,]+)(?:\s|$)/);
        if (match) {
          let nameStr = match[1].trim();
          nameStr = nameStr.replace(/^\d+[\.\/\)\-]\s*/, '');
          const val = parseFloat(match[2].replace(',', '.'));
          if (!isNaN(val)) {
            const matchedKey = matchKey(nameStr);
            if (matchedKey) results[matchedKey] = val;
          }
        }
      }
    });
    return results;
  }

  function updateQcvnSubTypes() {
    const type = document.getElementById('qv-type').value;
    const subTypeSelect = document.getElementById('qv-sub-type');
    if (!subTypeSelect) return;

    const list = SUB_TYPES[type] || [];
    let options = '';
    list.forEach(item => {
      options += `<option value="${item.value}">${item.text}</option>`;
    });
    subTypeSelect.innerHTML = options;

    // Show/hide subtype selector depending on count
    const group = document.getElementById('qv-sub-type-group');
    if (group) {
      group.style.display = list.length > 1 ? 'block' : 'none';
    }

    buildQcvnTable();
  }

  function buildQcvnTable() {
    const key = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[key];
    if (!data) return;

    document.getElementById('qv-std-ref').textContent = data.ap_dung;
    document.getElementById('qv-summary').style.display = 'none';

    let rows = '';
    let paramIdx = 0;
    data.tham_so.forEach(p => {
      if (p.nhom) {
        rows += `<tr><td class="param-group-head" colspan="6">${p.nhom}</td></tr>`;
        return;
      }
      const limitText = p.loai === 'range'
        ? `${p.min} – ${p.max}`
        : p.loai === 'min'
          ? `≥ ${p.gioi_han}`
          : (p.note || `≤ ${p.gioi_han}`);
      rows += `<tr id="row-${key}-${paramIdx}">
        <td>${p.ten}</td>
        <td style="color:var(--text3)">${p.don_vi}</td>
        <td><span class="limit-val">${limitText}</span></td>
        <td><input type="number" step="any" min="0"
             id="inp-${key}-${paramIdx}"
             placeholder="—"/></td>
        <td id="res-${key}-${paramIdx}"><span class="result-empty">—</span></td>
        <td id="bar-${key}-${paramIdx}"></td>
      </tr>`;
      paramIdx++;
    });

    document.getElementById('qv-tbody').innerHTML = rows;

    // Attach listeners dynamically to prevent issues
    paramIdx = 0;
    data.tham_so.forEach(p => {
      if (p.nhom) return;
      const currentIdx = paramIdx;
      const inp = document.getElementById(`inp-${key}-${currentIdx}`);
      if (inp) {
        const handler = () => {
          _qvUnsavedChanges = true;
          evaluate(key, currentIdx);
        };
        inp.addEventListener('change', handler);
        inp.addEventListener('input', handler);
      }
      paramIdx++;
    });
  }

  function evaluate(stdKey, idx) {
    const data = QCVN_DATA[stdKey];
    let paramIdx = 0;
    for (const p of data.tham_so) {
      if (p.nhom) continue;
      if (paramIdx === idx) {
        const inp = document.getElementById(`inp-${stdKey}-${idx}`);
        const resEl = document.getElementById(`res-${stdKey}-${idx}`);
        const barEl = document.getElementById(`bar-${stdKey}-${idx}`);
        const rowEl = document.getElementById(`row-${stdKey}-${idx}`);
        const val = parseFloat(inp.value);

        rowEl.classList.remove('row-pass', 'row-fail', 'row-near');

        if (inp.value === '' || isNaN(val)) {
          resEl.innerHTML = '<span class="result-empty">—</span>';
          barEl.innerHTML = '';
          updateSummary(stdKey);
          return;
        }

        let status, ratioHtml = '';

        if (p.loai === 'range') {
          if (val < p.min || val > p.max) {
            status = 'fail';
            resEl.innerHTML = `<span class="result-fail">✗ Vượt ngưỡng</span>`;
          } else {
            const distMin = (val - p.min) / (p.max - p.min);
            const distMax = (p.max - val) / (p.max - p.min);
            status = (distMin < 0.1 || distMax < 0.1) ? 'near' : 'pass';
            resEl.innerHTML = status === 'near'
              ? `<span class="result-near">⚠ Gần giới hạn</span>`
              : `<span class="result-pass">✓ Đạt</span>`;
          }
        } else if (p.loai === 'min') {
          const ratio = p.gioi_han > 0 ? val / p.gioi_han : 1;
          if (val < p.gioi_han) {
            status = 'fail';
            resEl.innerHTML = `<span class="result-fail">✗ Thấp hơn ngưỡng</span>`;
          } else {
            status = ratio < 1.1 ? 'near' : 'pass';
            resEl.innerHTML = status === 'near'
              ? `<span class="result-near">⚠ Gần giới hạn</span>`
              : `<span class="result-pass">✓ Đạt</span>`;
          }
          const fillW = Math.min(ratio * 50, 100);
          const fillColor = status === 'fail' ? '#C0392B' : status === 'near' ? '#D4860A' : '#2E7D50';
          ratioHtml = `<span style="font-size:11px;color:var(--text3)">${ratio.toFixed(2)}x</span>
            <span class="ratio-bar"><span class="ratio-fill" style="width:${fillW}%;background:${fillColor}"></span></span>`;
        } else {
          if (p.note === 'Không phát hiện') {
            status = val > 0 ? 'fail' : 'pass';
            resEl.innerHTML = status === 'fail'
              ? `<span class="result-fail">✗ Phát hiện</span>`
              : `<span class="result-pass">✓ Không phát hiện</span>`;
          } else {
            const ratio = p.gioi_han > 0 ? val / p.gioi_han : (val > 0 ? Infinity : 0);
            if (ratio > 1) {
              status = 'fail';
              const times = ratio.toFixed(2);
              resEl.innerHTML = `<span class="result-fail">✗ Vượt ${times}x</span>`;
            } else if (ratio >= 0.8) {
              status = 'near';
              resEl.innerHTML = `<span class="result-near">⚠ ${Math.round(ratio * 100)}% ngưỡng</span>`;
            } else {
              status = 'pass';
              resEl.innerHTML = `<span class="result-pass">✓ Đạt (${Math.round(ratio * 100)}%)</span>`;
            }
            const fillW = Math.min(ratio * 100, 100);
            const fillColor = status === 'fail' ? '#C0392B' : status === 'near' ? '#D4860A' : '#2E7D50';
            const displayRatio = isFinite(ratio) ? ratio.toFixed(2) : '∞';
            ratioHtml = `<span style="font-size:11px;color:var(--text3)">${displayRatio}x</span>
              <span class="ratio-bar"><span class="ratio-fill" style="width:${fillW}%;background:${fillColor}"></span></span>`;
          }
        }

        rowEl.classList.add(`row-${status}`);
        barEl.innerHTML = ratioHtml;
        break;
      }
      paramIdx++;
    }
    updateSummary(stdKey);
  }

  function updateSummary(stdKey) {
    const data = QCVN_DATA[stdKey];
    let total = 0, pass = 0, near = 0, fail = 0;
    let paramIdx = 0;
    for (const p of data.tham_so) {
      if (p.nhom) continue;
      const inp = document.getElementById(`inp-${stdKey}-${paramIdx}`);
      if (inp && inp.value !== '' && !isNaN(parseFloat(inp.value))) {
        total++;
        const row = document.getElementById(`row-${stdKey}-${paramIdx}`);
        if (row.classList.contains('row-fail')) fail++;
        else if (row.classList.contains('row-near')) near++;
        else if (row.classList.contains('row-pass')) pass++;
      }
      paramIdx++;
    }

    const summaryEl = document.getElementById('qv-summary');
    if (total > 0) {
      summaryEl.style.display = 'flex';
      document.getElementById('sum-total').textContent = total;
      document.getElementById('sum-pass').textContent = pass;
      document.getElementById('sum-near').textContent = near;
      document.getElementById('sum-fail').textContent = fail;
    } else {
      summaryEl.style.display = 'none';
    }
  }

  function clearValues() {
    const key = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[key];
    if (!data) return;
    let paramIdx = 0;
    for (const p of data.tham_so) {
      if (p.nhom) continue;
      const inp = document.getElementById(`inp-${key}-${paramIdx}`);
      const res = document.getElementById(`res-${key}-${paramIdx}`);
      const bar = document.getElementById(`bar-${key}-${paramIdx}`);
      const row = document.getElementById(`row-${key}-${paramIdx}`);
      if (inp) inp.value = '';
      if (res) res.innerHTML = '<span class="result-empty">—</span>';
      if (bar) bar.innerHTML = '';
      if (row) row.classList.remove('row-pass', 'row-fail', 'row-near');
      paramIdx++;
    }
    const pasteArea = document.getElementById('qv-paste-area');
    if (pasteArea) pasteArea.value = '';
    document.getElementById('qv-summary').style.display = 'none';

    _qvUnsavedChanges = false;
    _qvCurrentSampleId = null;
    document.getElementById('qv-sample-id').value = '';
    document.getElementById('qv-name').value = '';

    document.querySelectorAll('#saved-qcvn-samples-list .project-btn').forEach(btn => btn.classList.remove('active'));
  }

  function handleQuickPaste() {
    const pasteArea = document.getElementById('qv-paste-area');
    if (!pasteArea) return;
    const text = pasteArea.value.trim();
    if (!text) {
      alert('Vui lòng dán nội dung bảng số liệu vào ô văn bản trước!');
      return;
    }

    const key = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[key];
    if (!data) return;

    clearValues();
    pasteArea.value = text;

    const parsedValues = parsePastedText(text);
    let matchedCount = 0;

    let paramIdx = 0;
    data.tham_so.forEach(p => {
      if (p.nhom) return;
      if (parsedValues[p.key] !== undefined) {
        const inp = document.getElementById(`inp-${key}-${paramIdx}`);
        if (inp) {
          inp.value = parsedValues[p.key];
          evaluate(key, paramIdx);
          matchedCount++;
        }
      }
      paramIdx++;
    });

    if (matchedCount > 0) {
      _qvUnsavedChanges = true;
      alert(`Đã nhận diện và điền tự động ${matchedCount} thông số thành công!`);
    } else {
      alert('Không nhận diện được thông số nào. Vui lòng kiểm tra lại định dạng bảng số liệu dán vào.');
    }
  }

  function exportQcvn() {
    const key = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[key];
    const tenMau = document.getElementById('qv-name').value || 'Mẫu không rõ tên';
    const now = new Date().toLocaleString('vi-VN');
    let lines = [
      '═══════════════════════════════════════════════════════',
      `KẾT QUẢ SO SÁNH QCVN`,
      `Ngày: ${now}`,
      `Tên mẫu / Vị trí: ${tenMau}`,
      `QCVN áp dụng: ${data.ten}`,
      `Mục đích: ${data.ap_dung}`,
      '═══════════════════════════════════════════════════════',
      ''
    ];
    let paramIdx = 0;
    for (const p of data.tham_so) {
      if (p.nhom) { lines.push(`\n── ${p.nhom} ──`); continue; }
      const inp = document.getElementById(`inp-${key}-${paramIdx}`);
      const val = inp && inp.value !== '' ? inp.value : '—';
      let limitStr = p.loai === 'range' ? `${p.min}–${p.max}` : p.loai === 'min' ? `≥${p.gioi_han}` : (p.note || `≤${p.gioi_han}`);
      let result = '—';
      if (inp && inp.value !== '') {
        const row = document.getElementById(`row-${key}-${paramIdx}`);
        if (row.classList.contains('row-fail')) result = 'VƯỢT NGƯỠNG';
        else if (row.classList.contains('row-near')) result = 'CẢNH BÁO';
        else if (row.classList.contains('row-pass')) result = 'ĐẠT';
      }
      lines.push(`${p.ten.padEnd(30)} ${p.don_vi.padEnd(12)} Giới hạn: ${limitStr.padEnd(12)} Kết quả: ${val.padEnd(10)} → ${result}`);
      paramIdx++;
    }
    lines.push('\n═══════════════════════════════════════════════════════');
    lines.push('Lưu ý: Kết quả mang tính tham khảo. Đối chiếu với văn bản QCVN gốc.');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `so_sanh_qcvn_${key}_${Date.now()}.txt`;
    a.click();
  }

  function exportQcvnPDF() {
    const key = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[key];
    const tenMau = document.getElementById('qv-name').value || 'Mẫu không rõ tên';
    const now = new Date().toLocaleString('vi-VN');

    let printHeader = document.getElementById('qv-print-header');
    if (!printHeader) {
      printHeader = document.createElement('div');
      printHeader.id = 'qv-print-header';
      printHeader.className = 'print-only-header';
      const container = document.getElementById('qcvn');
      container.insertBefore(printHeader, container.firstChild);
    }

    printHeader.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px; font-family: 'Be Vietnam Pro', sans-serif;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; color: #1D5C3A; margin-bottom: 4px;">ETC — PHÒNG THÍ NGHIỆM</h2>
        <h3 style="font-size: 16px; font-weight: 600; color: #1A1917; margin-bottom: 16px; text-transform: uppercase;">BÁO CÁO ĐỐI CHIẾU KẾT QUẢ QUAN TRẮC VỚI QCVN</h3>
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; margin-bottom: 20px;">
          <tr>
            <th style="width: 150px; padding: 4px 0; color: #6B6760;">Tên mẫu / Vị trí:</th>
            <td style="padding: 4px 0; font-weight: 600; color: #1A1917;">${tenMau}</td>
          </tr>
          <tr>
            <th style="padding: 4px 0; color: #6B6760;">Quy chuẩn đối chiếu:</th>
            <td style="padding: 4px 0; font-weight: 600; color: #1A1917;">${data.ten}</td>
          </tr>
          <tr>
            <th style="padding: 4px 0; color: #6B6760;">Áp dụng cho:</th>
            <td style="padding: 4px 0; color: #1A1917;">${data.ap_dung}</td>
          </tr>
          <tr>
            <th style="padding: 4px 0; color: #6B6760;">Thời gian xuất báo cáo:</th>
            <td style="padding: 4px 0; color: #1A1917;">${now}</td>
          </tr>
        </table>
        <hr style="border: 0; border-top: 1px solid #E2DDD6; margin-bottom: 20px;"/>
      </div>
    `;

    window.print();
  }

  function loadQcvnSamples(page = 1) {
    if (!global.CurrentUser) {
      const sidebar = document.getElementById('qcvn-sidebar-container');
      const grid = document.getElementById('qv-grid-container');
      const btnSave = document.getElementById('btn-save-qcvn-sample');
      if (sidebar) sidebar.style.display = 'none';
      if (grid) grid.classList.remove('has-sidebar');
      if (btnSave) btnSave.style.display = 'none';
      return;
    }

    _currentSamplePage = page;

    const sidebar = document.getElementById('qcvn-sidebar-container');
    const grid = document.getElementById('qv-grid-container');
    const btnSave = document.getElementById('btn-save-qcvn-sample');
    if (sidebar) sidebar.style.display = 'block';
    if (grid) grid.classList.add('has-sidebar');
    if (btnSave) btnSave.style.display = 'inline-block';

    fetch(`/api/qcvns/samples?page=${page}&limit=5`)
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải danh sách mẫu.');
        return res.json();
      })
      .then(data => {
        _loadedSamples = data.samples || [];
        renderQcvnSamplesSidebar(_loadedSamples, data.pagination || { currentPage: 1, totalPages: 1 });
      })
      .catch(err => {
        console.error('Lỗi tải danh sách mẫu QCVN:', err);
      });
  }

  function renderQcvnSamplesSidebar(samples, pagination) {
    const listContainer = document.getElementById('saved-qcvn-samples-list');
    if (!listContainer) return;

    if (samples.length === 0) {
      listContainer.innerHTML = '<div style="font-size:12px;color:var(--text3);text-align:center;padding:20px 0">Chưa có mẫu nào</div>';
      renderQcvnPagination(pagination);
      return;
    }

    let html = '';
    samples.forEach(s => {
      const activeClass = _qvCurrentSampleId && parseInt(_qvCurrentSampleId) === s.id ? 'active' : '';
      html += `
        <div class="project-item">
          <button class="project-btn ${activeClass}" onclick="AppQcvnView.selectQcvnSample(${s.id})">${s.name}</button>
          <button class="btn-delete-project" onclick="AppQcvnView.deleteQcvnSample(${s.id})" title="Xóa kết quả mẫu">🗑️</button>
        </div>
      `;
    });
    listContainer.innerHTML = html;

    renderQcvnPagination(pagination);
  }

  function renderQcvnPagination(pagination) {
    const pagContainer = document.getElementById('qcvn-samples-pagination');
    if (!pagContainer) return;

    const totalPages = pagination.totalPages || 0;
    const current = pagination.currentPage || 1;

    if (totalPages <= 1) {
      pagContainer.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="pagination-btn" ${current === 1 ? 'disabled' : ''} onclick="AppQcvnView.loadQcvnSamples(${current - 1})">&lt;</button>`;

    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="pagination-btn ${i === current ? 'active' : ''}" onclick="AppQcvnView.loadQcvnSamples(${i})">${i}</button>`;
    }

    html += `<button class="pagination-btn" ${current === totalPages ? 'disabled' : ''} onclick="AppQcvnView.loadQcvnSamples(${current + 1})">&gt;</button>`;

    pagContainer.innerHTML = html;
  }

  function selectQcvnSample(id) {
    const sample = _loadedSamples.find(s => s.id === id);
    if (!sample) return;

    if (_qvUnsavedChanges) {
      if (!confirm('Bạn có thay đổi chưa lưu trên bảng QCVN. Bạn có chắc chắn muốn mở mẫu này và ghi đè dữ liệu hiện tại không?')) {
        return;
      }
    }

    _qvUnsavedChanges = false;
    _qvCurrentSampleId = sample.id;
    document.getElementById('qv-sample-id').value = sample.id;
    document.getElementById('qv-name').value = sample.name;

    document.getElementById('qv-type').value = sample.type;

    updateQcvnSubTypes();
    document.getElementById('qv-sub-type').value = sample.sub_type;

    buildQcvnTable();

    const key = sample.sub_type;
    const data = QCVN_DATA[key];
    if (data) {
      let paramIdx = 0;
      data.tham_so.forEach(p => {
        if (p.nhom) return;
        const inp = document.getElementById(`inp-${key}-${paramIdx}`);
        if (inp) {
          if (sample.values && sample.values[p.key] !== undefined) {
            inp.value = sample.values[p.key];
            evaluate(key, paramIdx);
          } else {
            inp.value = '';
            const res = document.getElementById(`res-${key}-${paramIdx}`);
            const bar = document.getElementById(`bar-${key}-${paramIdx}`);
            const row = document.getElementById(`row-${key}-${paramIdx}`);
            if (res) res.innerHTML = '<span class="result-empty">—</span>';
            if (bar) bar.innerHTML = '';
            if (row) row.classList.remove('row-pass', 'row-fail', 'row-near');
          }
        }
        paramIdx++;
      });
    }

    document.querySelectorAll('#saved-qcvn-samples-list .project-btn').forEach(btn => btn.classList.remove('active'));
    loadQcvnSamples(_currentSamplePage);
  }

  function saveQcvnSample() {
    const name = document.getElementById('qv-name').value.trim();
    if (!name) {
      alert('Vui lòng nhập tên mẫu / vị trí để lưu kết quả mẫu!');
      document.getElementById('qv-name').focus();
      return;
    }

    const type = document.getElementById('qv-type').value;
    const subType = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[subType];
    if (!data) return;

    const values = {};
    let paramIdx = 0;
    data.tham_so.forEach(p => {
      if (p.nhom) return;
      const inp = document.getElementById(`inp-${subType}-${paramIdx}`);
      if (inp && inp.value !== '') {
        values[p.key] = parseFloat(inp.value);
      }
      paramIdx++;
    });

    const payload = {
      id: _qvCurrentSampleId,
      name,
      type,
      sub_type: subType,
      values
    };

    fetch('/api/qcvns/samples', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Không thể lưu kết quả mẫu.');
        return res.json();
      })
      .then(result => {
        alert(result.message || 'Đã lưu mẫu kết quả quan trắc thành công!');
        _qvUnsavedChanges = false;
        _qvCurrentSampleId = result.sample.id;
        document.getElementById('qv-sample-id').value = result.sample.id;
        loadQcvnSamples(_currentSamplePage);
      })
      .catch(err => {
        console.error(err);
        alert('Đã xảy ra lỗi khi lưu mẫu kết quả quan trắc!');
      });
  }

  function deleteQcvnSample(id) {
    if (event) event.stopPropagation();

    const sample = _loadedSamples.find(s => s.id === id);
    const sampleName = sample ? sample.name : 'mẫu này';

    if (!confirm(`Bạn có chắc chắn muốn xóa mẫu "${sampleName}"? Hành động này không thể khôi phục!`)) {
      return;
    }

    fetch(`/api/qcvns/samples/${id}`, {
      method: 'DELETE'
    })
      .then(res => {
        if (!res.ok) throw new Error('Không thể xóa kết quả mẫu.');
        return res.json();
      })
      .then(data => {
        alert('Đã xóa mẫu kết quả quan trắc thành công!');
        if (_qvCurrentSampleId && parseInt(_qvCurrentSampleId) === id) {
          clearValues();
        }
        loadQcvnSamples(_currentSamplePage);
      })
      .catch(err => {
        console.error(err);
        alert('Đã xảy ra lỗi khi xóa mẫu kết quả quan trắc!');
      });
  }

  function hasUnsavedChanges() {
    return _qvUnsavedChanges;
  }

  function resetUnsavedChanges() {
    _qvUnsavedChanges = false;
  }

  function initQcvnView() {
    QCVN_DATA = global.AppData.QCVN_DATA || {};
    const typeSelect = document.getElementById('qv-type');
    const subTypeSelect = document.getElementById('qv-sub-type');
    const parseBtn = document.getElementById('btn-parse-paste');
    const saveBtn = document.getElementById('btn-save-qcvn-sample');
    const newSampleBtn = document.getElementById('btn-new-qcvn-sample');
    const nameInput = document.getElementById('qv-name');

    if (typeSelect) {
      let prevTypeVal = '';
      typeSelect.addEventListener('focus', () => {
        prevTypeVal = typeSelect.value;
      });
      typeSelect.addEventListener('change', () => {
        if (_qvUnsavedChanges) {
          if (!confirm('Bạn có thay đổi chưa lưu trên bảng QCVN. Bạn có chắc chắn muốn chuyển đổi loại quy chuẩn và mất dữ liệu hiện tại không?')) {
            typeSelect.value = prevTypeVal;
            return;
          }
        }
        _qvUnsavedChanges = false;
        _qvCurrentSampleId = null;
        document.getElementById('qv-sample-id').value = '';
        document.getElementById('qv-name').value = '';
        updateQcvnSubTypes();
        prevTypeVal = typeSelect.value;
      });
    }

    if (subTypeSelect) {
      let prevSubTypeVal = '';
      subTypeSelect.addEventListener('focus', () => {
        prevSubTypeVal = subTypeSelect.value;
      });
      subTypeSelect.addEventListener('change', () => {
        if (_qvUnsavedChanges) {
          if (!confirm('Bạn có thay đổi chưa lưu trên bảng QCVN. Bạn có chắc chắn muốn chuyển phân loại và mất dữ liệu hiện tại không?')) {
            subTypeSelect.value = prevSubTypeVal;
            return;
          }
        }
        _qvUnsavedChanges = false;
        _qvCurrentSampleId = null;
        document.getElementById('qv-sample-id').value = '';
        document.getElementById('qv-name').value = '';
        buildQcvnTable();
        prevSubTypeVal = subTypeSelect.value;
      });
    }

    if (parseBtn) {
      parseBtn.addEventListener('click', handleQuickPaste);
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', saveQcvnSample);
    }

    if (newSampleBtn) {
      newSampleBtn.addEventListener('click', () => {
        if (_qvUnsavedChanges) {
          if (!confirm('Bạn có thay đổi chưa lưu trên bảng QCVN. Bạn có chắc chắn muốn tạo mẫu mới và xóa trắng bảng hiện tại không?')) {
            return;
          }
        }
        clearValues();
      });
    }

    if (nameInput) {
      nameInput.addEventListener('input', () => {
        _qvUnsavedChanges = true;
      });
    }

    window.addEventListener('beforeunload', (e) => {
      if (_qvUnsavedChanges) {
        const msg = 'Bạn có thay đổi chưa lưu trên bảng QCVN. Bạn có chắc chắn muốn rời đi và mất dữ liệu này không?';
        e.returnValue = msg;
        return msg;
      }
    });

    updateQcvnSubTypes();
  }

  global.AppQcvnView = {
    initQcvnView,
    updateQcvnSubTypes,
    buildQcvnTable,
    evaluate,
    updateSummary,
    clearValues,
    handleQuickPaste,
    exportQcvn,
    exportQcvnPDF,
    loadQcvnSamples,
    renderQcvnSamplesSidebar,
    renderQcvnPagination,
    selectQcvnSample,
    saveQcvnSample,
    deleteQcvnSample,
    hasUnsavedChanges,
    resetUnsavedChanges
  };

})(window);
