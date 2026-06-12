// Classification rules service — v2.0 (cập nhật 06/2026)
// Xử lý toàn bộ logic phân loại: ngưỡng ngành, nâng nhóm, vùng nhạy cảm, cảnh báo luật
(function (global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // getCapacityLabel — Lấy nhãn đơn vị đo lường theo ngành
  // ─────────────────────────────────────────────────────────────
  function getCapacityLabel(projectType) {
    const { IND_DB } = global.AppData;
    return (projectType && IND_DB[projectType])
      ? IND_DB[projectType].lbl
      : 'Quy mô / Công suất *';
  }

  // ─────────────────────────────────────────────────────────────
  // findIndustryTier — Tìm tier phân loại dựa trên quy mô
  // Tiers sắp xếp từ lớn → nhỏ (min giảm dần)
  // ─────────────────────────────────────────────────────────────
  function findIndustryTier(projectType, capacity) {
    const { IND_DB } = global.AppData;
    if (!IND_DB[projectType]) return null;
    const tiers = IND_DB[projectType].t;
    // Lấy tier đầu tiên mà capacity >= min (từ lớn xuống nhỏ)
    for (const tier of tiers) {
      if (capacity >= tier.min) return tier;
    }
    // Fallback: tier nhỏ nhất
    return tiers[tiers.length - 1];
  }

  // ─────────────────────────────────────────────────────────────
  // isForcedGroupOne — Kiểm tra tiêu chí Nhóm I tuyệt đối
  // (Điều 25, Khoản 1, Luật BVMT 2020)
  // Input: object với các key boolean từ form
  // ─────────────────────────────────────────────────────────────
  function isForcedGroupOne(flags) {
    const { SENSITIVE_AREAS } = global.AppData;
    // Các tiêu chí force=true trong SENSITIVE_AREAS
    return SENSITIVE_AREAS.some(area => area.force && flags[area.key]);
  }

  // ─────────────────────────────────────────────────────────────
  // getSensitiveAreaWarnings — Lấy cảnh báo vùng nhạy cảm
  // Trả về array of { icon, text, ref, isForce }
  // ─────────────────────────────────────────────────────────────
  function getSensitiveAreaWarnings(flags) {
    const { SENSITIVE_AREAS } = global.AppData;
    const warnings = [];
    for (const area of SENSITIVE_AREAS) {
      if (flags[area.key]) {
        warnings.push({
          icon: area.force ? '🚫' : '⚠️',
          text: area.label + (area.force
            ? ' → Tự động phân loại Nhóm I, thẩm quyền Bộ NNMT'
            : ' → Có thể bị nâng Nhóm I. Kiểm tra kỹ với cơ quan thẩm quyền'),
          ref: area.ref,
          isForce: area.force,
        });
      }
    }
    return warnings;
  }

  // ─────────────────────────────────────────────────────────────
  // getLawChangeWarnings — Lấy cảnh báo văn bản pháp luật thay đổi
  // Trả về cảnh báo global + cảnh báo riêng theo ngành
  // ─────────────────────────────────────────────────────────────
  function getLawChangeWarnings(projectType) {
    const { LAW_CHANGE_WARNINGS } = global.AppData;
    return LAW_CHANGE_WARNINGS.filter(w =>
      w.applies_to === 'global' || w.applies_to === projectType
    );
  }

  // ─────────────────────────────────────────────────────────────
  // getIndustryNote — Lấy ghi chú riêng của ngành (nếu có)
  // ─────────────────────────────────────────────────────────────
  function getIndustryNote(projectType) {
    const { IND_DB } = global.AppData;
    return (IND_DB[projectType] && IND_DB[projectType].note) || null;
  }

  // ─────────────────────────────────────────────────────────────
  // classify — Hàm phân loại tổng hợp
  // Input: formData object với tất cả các trường
  // Output: result object hoàn chỉnh cho UI render
  // ─────────────────────────────────────────────────────────────
  function classify(formData) {
    const { IND_DB, TQ_LABEL, THOI_HAN, HS_INFO, CHECKLIST, LAW_REFS } = global.AppData;
    const {
      nganh, capacity,
      nt = 0,   // lưu lượng nước thải (m³/ngày)
      kt = 0,   // lưu lượng khí thải (m³/h)
      tinh = '',
      // Flags vùng nhạy cảm (tất cả từ SENSITIVE_AREAS)
      rung = false, lua = false, bg = false,
      bao_ton = false, di_san = false,
      ven_bien = false, nguon_nc = false, dat_ngap = false,
      // Flags đặc biệt
      kcn = false,        // trong KCN đã có ĐTM
      phanky = false,     // dự án phân kỳ đầu tư
      morongdt = false,   // mở rộng/cải tạo
      ctnh = false,       // có phát sinh CTNH
      dtcong = false,     // dự án đầu tư công
      epr = false,        // có trách nhiệm EPR
    } = formData;

    const flags = { rung, lua, bg, bao_ton, di_san, ven_bien, nguon_nc, dat_ngap };

    let hs, tq, phuluc, ref;
    const nangNhom = [];   // điều chỉnh nhóm tự động
    const cauNhom = [];    // lưu ý quan trọng
    const luyTien = [];    // cảnh báo luật thay đổi
    const infoExtra = [];  // thông tin bổ sung

    // ── BƯỚC 1: Kiểm tra tiêu chí Nhóm I tuyệt đối ──────────
    const sensitiveWarnings = getSensitiveAreaWarnings(flags);
    const force1 = sensitiveWarnings.some(w => w.isForce);

    if (force1) {
      hs = 'DTM'; tq = 'cap_bo';
      phuluc = 'Khoản 1, Điều 25';
      ref = 'Luật BVMT 2020';
      sensitiveWarnings
        .filter(w => w.isForce)
        .forEach(w => nangNhom.push({ icon: w.icon, text: w.text, ref: w.ref }));
    } else {
      // ── BƯỚC 2: Phân loại theo ngưỡng ngành ───────────────
      const tier = findIndustryTier(nganh, capacity);
      hs = tier.hs; tq = tier.tq; phuluc = tier.phu_luc; ref = tier.ref;

      // Cảnh báo vùng nhạy cảm không tuyệt đối (có thể nâng)
      sensitiveWarnings
        .filter(w => !w.isForce)
        .forEach(w => cauNhom.push({ icon: w.icon, type: 'warn', text: w.text, ref: w.ref }));

      // ── BƯỚC 3: Nâng nhóm do nước thải ───────────────────
      if (nt >= 1000 && (hs === 'GPMT' || hs === 'DKMT')) {
        hs = 'DTM'; tq = 'cap_so'; phuluc = 'Phụ lục II, NĐ 08/2022 (VBHN 49/2026)';
        ref = 'Phụ lục II, NĐ 08/2022';
        nangNhom.push({
          icon: '💧',
          text: `Lưu lượng nước thải ${nt.toLocaleString('vi-VN')} m³/ngày ≥ 1.000 m³/ngày → tự động nâng lên ĐTM (Nhóm II)`,
          ref: 'Phụ lục II, VBHN 49/2026',
        });
      }

      // ── BƯỚC 4: Nâng nhóm do khí thải lớn ────────────────
      if (kt >= 200000 && hs === 'DKMT') {
        hs = 'DTM'; tq = 'cap_so'; phuluc = 'Phụ lục II, NĐ 08/2022';
        nangNhom.push({
          icon: '🌫️',
          text: `Lưu lượng khí thải ${kt.toLocaleString('vi-VN')} m³/h ≥ 200.000 m³/h → nâng lên ĐTM`,
          ref: 'Phụ lục II, VBHN 49/2026',
        });
      } else if (kt >= 20000 && hs === 'DKMT') {
        hs = 'GPMT'; tq = 'cap_so';
        nangNhom.push({
          icon: '🌫️',
          text: `Lưu lượng khí thải ${kt.toLocaleString('vi-VN')} m³/h ≥ 20.000 m³/h → nâng lên GPMT`,
          ref: 'NĐ 48/2026, Điều 8',
        });
      }

      // ── BƯỚC 5: Trong KCN đã có ĐTM ──────────────────────
      if (kcn && hs === 'DTM') {
        hs = 'GPMT'; tq = 'cap_so'; phuluc = '—';
        ref = 'Khoản 2, Điều 35, Luật BVMT 2020';
        nangNhom.push({
          icon: '🏭',
          text: 'Dự án trong KCN đã được phê duyệt ĐTM → không cần lập ĐTM riêng, chuyển sang GPMT cấp Sở TNMT',
          ref: 'Khoản 2, Điều 35, Luật BVMT 2020',
        });
      }
    }

    // ── BƯỚC 6: Thông tin đặc biệt bổ sung ─────────────────
    if (dtcong && hs === 'DTM' && tq === 'cap_bo') {
      infoExtra.push({
        icon: '🏛️', type: 'info',
        text: 'Dự án đầu tư công không thuộc QH/TTg: UBND tỉnh có thể được phân cấp thẩm định ĐTM theo NĐ 48/2026 Điều 7 — liên hệ Bộ NNMT để xác nhận.',
        ref: 'NĐ 48/2026, Điều 7',
      });
    }

    if (phanky && hs === 'DTM') {
      infoExtra.push({
        icon: '📅', type: 'info',
        text: 'Dự án phân kỳ đầu tư: được lập ĐTM riêng từng giai đoạn. ĐTM giai đoạn sau sẽ thay thế ĐTM giai đoạn trước đã được phê duyệt.',
        ref: 'Điều 27a, NĐ 48/2026 (bổ sung)',
      });
    }

    if (morongdt) {
      if (nt >= 50 || kt >= 20000) {
        cauNhom.push({
          icon: '⚠️', type: 'warn',
          text: `Mở rộng/cải tạo dự án làm tăng lưu lượng thải (NT: ${nt} m³/ngày, KT: ${kt} m³/h) → phải đánh giá lại khả năng phải lập lại ĐTM hoặc GPMT.`,
          ref: 'NĐ 48/2026 Điều 8; Điều 27 Khoản 5, NĐ 08/2022',
        });
      } else {
        infoExtra.push({
          icon: '📌', type: 'info',
          text: 'Dự án cải tạo/mở rộng: kiểm tra so với quy mô ĐTM/GPMT cũ. Nếu không làm tăng lưu lượng thải đáng kể thì không cần lập lại.',
          ref: 'Điều 27, NĐ 08/2022 (VBHN 49/2026)',
        });
      }
    }

    if (ctnh) {
      cauNhom.push({
        icon: '☣️', type: 'warn',
        text: 'Có phát sinh CTNH: bắt buộc đăng ký chủ nguồn thải CTNH và có hợp đồng vận chuyển, xử lý với đơn vị được cấp phép xử lý CTNH.',
        ref: 'TT 02/2022 Điều 13 + TT 10/2021 (cập nhật TT 09/2026)',
      });
    }

    if (epr) {
      cauNhom.push({
        icon: '♻️', type: 'warn',
        text: 'Sản phẩm/bao bì thuộc danh mục EPR: nhà sản xuất/nhập khẩu phải thực hiện trách nhiệm tái chế hoặc đóng góp tài chính vào quỹ tái chế theo NĐ 110/2026.',
        ref: 'NĐ 110/2026/NĐ-CP (25/05/2026)',
      });
    }

    // ── BƯỚC 7: Cảnh báo luật thay đổi ─────────────────────
    const lawWarnings = getLawChangeWarnings(nganh);
    lawWarnings.forEach(w => {
      luyTien.push({ icon: w.icon, text: w.text, ref: w.ref });
    });

    // ── BƯỚC 8: Ghi chú riêng của ngành ──────────────────────
    const industryNote = getIndustryNote(nganh);

    // ── Tổng hợp output ──────────────────────────────────────
    const coQuan = (tinh && tq === 'cap_so')
      ? `Sở Tài nguyên và Môi trường tỉnh ${tinh}`
      : global.AppData.TQ_LABEL[tq];

    const thoiHan = THOI_HAN[`${hs}_${tq}`] || 'Theo quy định cụ thể';
    const nhomMap = {
      DTM_cap_bo: 'Nhóm I', DTM_cap_so: 'Nhóm II',
      GPMT_cap_bo: 'Nhóm I', GPMT_cap_so: 'Nhóm II',
      GPMT_cap_huyen: 'Nhóm III', DKMT_cap_huyen: 'Nhóm IV',
    };
    const nhom = nhomMap[`${hs}_${tq}`] || '—';

    return {
      hs, tq, phuluc, ref, nhom,
      coQuan, thoiHan,
      hi: HS_INFO[hs],
      cl: CHECKLIST[hs],
      lr: LAW_REFS[hs],
      nangNhom,
      cauNhom,
      infoExtra,
      luyTien,
      industryNote,
    };
  }

  // Xuất ra global
  global.AppClassificationRules = {
    getCapacityLabel,
    findIndustryTier,
    isForcedGroupOne,
    getSensitiveAreaWarnings,
    getLawChangeWarnings,
    getIndustryNote,
    classify,
  };

})(window);
