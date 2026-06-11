// QCVN comparison view logic.
(function (global) {
  'use strict';

  const { QCVN_DATA } = global.AppData;

  // Sub-types for each environmental category
  const SUB_TYPES = {
    nuoc_mat: [
      { value: 'qcvn08_a1', text: 'Cột A1 - Cấp nước sinh hoạt' },
      { value: 'qcvn08_a2', text: 'Cột A2 - Sinh hoạt (có xử lý), Thủy sản' },
      { value: 'qcvn08_b1', text: 'Cột B1 - Tưới tiêu, giao thông thủy' },
      { value: 'qcvn08_b2', text: 'Cột B2 - Các mục đích khác' }
    ],
    nuoc_thai_cn: [
      { value: 'qcvn40_a', text: 'Cột A - Xả vào nguồn dùng cấp nước sinh hoạt' },
      { value: 'qcvn40_b', text: 'Cột B - Xả vào nguồn không dùng cấp nước sinh hoạt' }
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
        const handler = () => evaluate(key, currentIdx);
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
            resEl.innerHTML = `<span class="result-fail">✗ Vượt ngưỡng</span><br><span style="font-size:11px;color:var(--text3)">Khoảng: ${p.min}–${p.max}</span>`;
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
            resEl.innerHTML = `<span class="result-fail">✗ Thấp hơn ngưỡng</span><br><span style="font-size:11px;color:var(--text3)">Cần ≥ ${p.gioi_han}</span>`;
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

    // Reset current values before parsing new ones
    clearValues();
    // Re-fill the paste area content since clearValues wipes it
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
    // Inject dynamic print-specific header details before printing
    const key = document.getElementById('qv-sub-type').value;
    const data = QCVN_DATA[key];
    const tenMau = document.getElementById('qv-name').value || 'Mẫu không rõ tên';
    const now = new Date().toLocaleString('vi-VN');

    // Create a temporary element for printing header
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
        <h2 style="font-family: 'Playfair Display', serif; font-size: 24px; color: #1D5C3A; margin-bottom: 4px;">ETC LEGALHUB — PHÒNG THÍ NGHIỆM VILAS 495</h2>
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

    // Trigger standard browser print which supports save to PDF
    window.print();
  }

  function initQcvnView() {
    const typeSelect = document.getElementById('qv-type');
    const parseBtn = document.getElementById('btn-parse-paste');
    
    if (typeSelect) {
      typeSelect.addEventListener('change', updateQcvnSubTypes);
    }
    if (parseBtn) {
      parseBtn.addEventListener('click', handleQuickPaste);
    }
    
    // Initial populate
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
    exportQcvnPDF
  };

})(window);
