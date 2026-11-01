const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
const { IND_DB, CHECKLIST, evaluateClassification } = require('../services/classification-service');

// Nhãn hiển thị ngắn gọn cho các ngành nghề
const INDUSTRY_LABELS = {
  che_bien_go: 'Chế biến gỗ / MDF',
  xi_mang: 'Xi măng, VLXD',
  thep: 'Luyện kim, sản xuất thép',
  hoa_chat: 'Hóa chất, phân bón',
  giay_bot: 'Giấy, bột giấy, carton',
  det_nhuom: 'Dệt nhuộm, vải sợi',
  thuc_pham: 'Chế biến thực phẩm, đồ uống',
  nhua_cao_su: 'Nhựa, cao su tổng hợp',
  cao_su_cb: 'Cao su chế biến (mủ khô)',
  duoc_pham: 'Dược phẩm, mỹ phẩm',
  dien_tu: 'Linh kiện điện tử, bán dẫn',
  kcn: 'Khu công nghiệp / KCX',
  do_thi: 'Khu đô thị, nhà ở, chung cư',
  trung_tam_tm: 'Trung tâm thương mại, văn phòng',
  cao_toc: 'Đường cao tốc, quốc lộ',
  cang_bien: 'Cảng biển, bến cảng',
  thuy_dien: 'Thủy điện, năng lượng tái tạo',
  benh_vien: 'Bệnh viện, cơ sở y tế',
  khach_san: 'Khách sạn, resort, du lịch',
  nuoi_thuy_san: 'Nuôi trồng thủy sản',
  chan_nuoi: 'Chăn nuôi gia súc, gia cầm',
  nao_vet: 'Nạo vét luồng, kênh rạch'
};

// Nhãn hiển thị cho các loại môi trường QCVN
const QCVN_TYPE_LABELS = {
  nuoc_thai_cn: 'Nước thải công nghiệp (QCVN 40)',
  nuoc_thai_sh: 'Nước thải sinh hoạt (QCVN 14)',
  nuoc_mat: 'Nước mặt (QCVN 08)',
  khong_khi: 'Không khí xung quanh (QCVN 05)',
  dat: 'Chất lượng đất (QCVN 03)',
  nuoc_duoi_dat: 'Nước dưới đất (QCVN 09)'
};

// GET /api/dashboard/stats - Tổng hợp số liệu thống kê cho Dashboard
router.get('/stats', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === ROLES.ADMIN;
  const filterUserId = isAdmin && req.query.user_id && req.query.user_id !== 'all'
    ? parseInt(req.query.user_id, 10)
    : null;

  try {
    // Xây dựng điều kiện lọc theo phân quyền (staff chỉ xem của mình, admin xem tất cả hoặc lọc theo nhân viên)
    const targetUserId = isAdmin ? filterUserId : userId;
    const projectWhere = targetUserId ? 'WHERE p.user_id = $1' : '';
    const sampleWhere = targetUserId ? 'WHERE s.user_id = $1' : '';
    const queryParams = targetUserId ? [targetUserId] : [];

    const [projectsRes, samplesRes, lawsRes, usersRes] = await Promise.all([
      db.query(
        `SELECT 
          p.id,
          p.user_id,
          p.name,
          p.form_data,
          p.checklist_state,
          p.latitude,
          p.longitude,
          p.dia_chi_hien_thi,
          p.phuong_xa,
          p.classification_result,
          p.created_at,
          u.full_name AS user_name,
          COALESCE(sc.sample_count, 0)::INT AS sample_count,
          latest_qs.id AS latest_sample_id,
          latest_qs.name AS latest_sample_name,
          latest_qs.type AS latest_sample_type,
          latest_qs.trang_thai_tong_quat AS latest_sample_status,
          latest_qs.created_at AS latest_sample_date
        FROM projects p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN (
          SELECT project_id, COUNT(*) AS sample_count
          FROM qcvn_samples
          WHERE project_id IS NOT NULL
          GROUP BY project_id
        ) sc ON sc.project_id = p.id
        LEFT JOIN (
          SELECT DISTINCT ON (project_id)
            id, project_id, name, type, trang_thai_tong_quat, created_at
          FROM qcvn_samples
          WHERE project_id IS NOT NULL
          ORDER BY project_id, created_at DESC
        ) latest_qs ON latest_qs.project_id = p.id
        ${projectWhere}
        ORDER BY p.created_at DESC`,
        queryParams
      ),
      db.query(
        `SELECT 
          s.id,
          s.user_id,
          s.project_id,
          s.name,
          s.type,
          s.sub_type,
          s.trang_thai_tong_quat,
          s.created_at,
          p.name AS project_name,
          u.full_name AS user_name
        FROM qcvn_samples s
        LEFT JOIN projects p ON s.project_id = p.id
        LEFT JOIN users u ON s.user_id = u.id
        ${sampleWhere}
        ORDER BY s.created_at DESC`,
        queryParams
      ),
      db.query(
        `SELECT type, status, COUNT(*)::INT AS count
         FROM laws
         GROUP BY type, status`
      ),
      isAdmin
        ? db.query('SELECT id, username, full_name, role FROM users ORDER BY role ASC, full_name ASC')
        : Promise.resolve({ rows: [] })
    ]);

    // 1. Phân tích dữ liệu Dự án
    const byGroup = { 'Nhóm I': 0, 'Nhóm II': 0, 'Nhóm III': 0, 'Nhóm IV': 0 };
    const byDossier = { DTM: 0, GPMT: 0, DKMT: 0 };
    const byAuthority = { cap_bo: 0, cap_so: 0, cap_huyen: 0 };
    const industryMap = {};
    const provinceMap = {};

    let gisMappedProjects = 0;
    let monitoredProjects = 0;
    let totalChecklistPercent = 0;
    let completedChecklistProjects = 0;

    let totalWastewater = 0;
    let totalAirEmission = 0;
    let projectsWithWastewater = 0;
    let projectsWithAirEmission = 0;

    const sensitiveCounts = {
      rung: 0,
      lua: 0,
      bg: 0,
      kcn: 0,
      ctnh: 0,
      morongdt: 0,
      phanky: 0,
      dtcong: 0
    };

    const projectHealthList = projectsRes.rows.map(row => {
      const fd = row.form_data || {};
      const fallbackCr = evaluateClassification(fd);
      const cr = (row.classification_result && row.classification_result.nhom)
        ? row.classification_result
        : fallbackCr;

      const nhom = cr.nhom || fallbackCr.nhom || 'Nhóm III';
      const hs = cr.hs || fallbackCr.hs || 'GPMT';
      const tq = cr.tq || fallbackCr.tq || 'cap_so';
      const coQuan = cr.coQuan || fallbackCr.coQuan || '—';

      if (byGroup[nhom] !== undefined) byGroup[nhom]++;
      if (byDossier[hs] !== undefined) byDossier[hs]++;
      if (byAuthority[tq] !== undefined) byAuthority[tq]++;

      // Ngành nghề
      const nganhCode = fd.nganh || 'khac';
      const nganhLabel = INDUSTRY_LABELS[nganhCode] || (IND_DB[nganhCode]?.lbl?.split('(')[0]?.trim()) || 'Ngành khác';
      if (fd.nganh) {
        industryMap[nganhCode] = industryMap[nganhCode] || { code: nganhCode, label: nganhLabel, count: 0 };
        industryMap[nganhCode].count++;
      }

      // Tỉnh thành
      const tinhName = (fd.tinh || '').trim();
      if (tinhName) {
        provinceMap[tinhName] = (provinceMap[tinhName] || 0) + 1;
      }

      // Tọa độ GIS & Quan trắc
      const hasGis = row.latitude !== null && row.longitude !== null;
      if (hasGis) gisMappedProjects++;
      if (row.sample_count > 0) monitoredProjects++;

      // Tiến độ Checklist tài liệu
      const cl = CHECKLIST[hs] || { bat_buoc: [], bo_sung: [] };
      const totalDocs = (cl.bat_buoc?.length || 0) + (cl.bo_sung?.length || 0);
      const clState = row.checklist_state || {};
      const checkedDocs = Object.keys(clState).filter(k => clState[k] && parseInt(k, 10) < totalDocs).length;
      const checklistPercent = totalDocs > 0 ? Math.round((checkedDocs / totalDocs) * 100) : 0;

      totalChecklistPercent += checklistPercent;
      if (totalDocs > 0 && checklistPercent === 100) {
        completedChecklistProjects++;
      }

      // Lưu lượng xả thải & Yếu tố nhạy cảm
      const ntVal = parseFloat(fd.nt) || 0;
      const ktVal = parseFloat(fd.kt) || 0;
      if (ntVal > 0) {
        totalWastewater += ntVal;
        projectsWithWastewater++;
      }
      if (ktVal > 0) {
        totalAirEmission += ktVal;
        projectsWithAirEmission++;
      }

      Object.keys(sensitiveCounts).forEach(flag => {
        if (fd[flag]) sensitiveCounts[flag]++;
      });

      return {
        id: row.id,
        name: row.name,
        user_id: row.user_id,
        user_name: row.user_name || 'Ẩn danh',
        tinh: tinhName || '—',
        dia_chi: row.dia_chi_hien_thi || tinhName || '—',
        nganh: nganhCode,
        nganh_label: nganhLabel,
        nhom,
        hs,
        tq,
        co_quan: coQuan,
        nt: ntVal,
        kt: ktVal,
        has_gis: hasGis,
        checklist_done: checkedDocs,
        checklist_total: totalDocs,
        checklist_percent: checklistPercent,
        sample_count: row.sample_count,
        latest_sample_id: row.latest_sample_id || null,
        latest_sample_name: row.latest_sample_name || null,
        latest_sample_type: row.latest_sample_type || null,
        latest_sample_status: row.latest_sample_status || null,
        latest_sample_date: row.latest_sample_date || null,
        created_at: row.created_at
      };
    });

    const totalProjects = projectHealthList.length;
    const avgChecklistPercent = totalProjects > 0
      ? Math.round(totalChecklistPercent / totalProjects)
      : 0;

    // 2. Phân tích dữ liệu Mẫu quan trắc QCVN
    const qcvnByTypeMap = {};
    Object.keys(QCVN_TYPE_LABELS).forEach(typeKey => {
      qcvnByTypeMap[typeKey] = {
        type: typeKey,
        label: QCVN_TYPE_LABELS[typeKey],
        total: 0,
        dat: 0,
        canh_bao: 0,
        vuot_nguong: 0
      };
    });

    let linkedSamples = 0;
    let passSamples = 0;
    let warnSamples = 0;
    let failSamples = 0;

    samplesRes.rows.forEach(s => {
      const status = s.trang_thai_tong_quat || 'dat';
      if (s.project_id) linkedSamples++;

      if (status === 'vuot_nguong') failSamples++;
      else if (status === 'canh_bao') warnSamples++;
      else passSamples++;

      const tKey = s.type || 'nuoc_mat';
      if (!qcvnByTypeMap[tKey]) {
        qcvnByTypeMap[tKey] = {
          type: tKey,
          label: QCVN_TYPE_LABELS[tKey] || tKey,
          total: 0,
          dat: 0,
          canh_bao: 0,
          vuot_nguong: 0
        };
      }
      qcvnByTypeMap[tKey].total++;
      if (status === 'vuot_nguong') qcvnByTypeMap[tKey].vuot_nguong++;
      else if (status === 'canh_bao') qcvnByTypeMap[tKey].canh_bao++;
      else qcvnByTypeMap[tKey].dat++;
    });

    const totalSamples = samplesRes.rows.length;
    const complianceRate = totalSamples > 0
      ? Math.round((passSamples / totalSamples) * 100)
      : 100;

    const alertSamples = samplesRes.rows
      .filter(s => s.trang_thai_tong_quat === 'vuot_nguong' || s.trang_thai_tong_quat === 'canh_bao')
      .slice(0, 8)
      .map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        type_label: QCVN_TYPE_LABELS[s.type] || s.type,
        status: s.trang_thai_tong_quat,
        project_id: s.project_id,
        project_name: s.project_name || null,
        user_name: s.user_name || 'Ẩn danh',
        created_at: s.created_at
      }));

    // 3. Phân tích dữ liệu Văn bản pháp lý
    let totalLaws = 0;
    let validLaws = 0;
    let amendedLaws = 0;
    lawsRes.rows.forEach(r => {
      totalLaws += r.count;
      if (r.status === 'valid') validLaws += r.count;
      if (r.status === 'amended') amendedLaws += r.count;
    });

    // Sắp xếp Top ngành nghề & Top tỉnh thành
    const topIndustries = Object.values(industryMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const topProvinces = Object.entries(provinceMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return res.json({
      kpis: {
        totalProjects,
        highRiskProjects: (byGroup['Nhóm I'] || 0) + (byGroup['Nhóm II'] || 0),
        gisMappedProjects,
        monitoredProjects,
        avgChecklistPercent,
        completedChecklistProjects,
        totalSamples,
        linkedSamples,
        passSamples,
        warnSamples,
        failSamples,
        complianceRate,
        totalLaws,
        validLaws,
        amendedLaws
      },
      distributions: {
        byGroup,
        byDossier,
        byAuthority,
        byQcvnType: Object.values(qcvnByTypeMap),
        topIndustries,
        topProvinces
      },
      environmentalLoad: {
        totalWastewater: Math.round(totalWastewater * 100) / 100,
        totalAirEmission: Math.round(totalAirEmission * 100) / 100,
        projectsWithWastewater,
        projectsWithAirEmission,
        sensitiveCounts
      },
      alertSamples,
      projectHealthList,
      staffList: usersRes.rows
    });
  } catch (error) {
    logger.error('Lỗi tải số liệu Dashboard:', error);
    return res.status(500).json({ error: 'Không thể tải dữ liệu thống kê Dashboard!' });
  }
});

module.exports = router;
