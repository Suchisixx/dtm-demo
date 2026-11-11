const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { ROLES } = require('../utils/constants');
const logger = require('../utils/logger');
const {
  IND_DB,
  INDUSTRY_META,
  CHECKLIST,
  evaluateStoredProject,
} = require('../services/classification-service');
const { loadClassificationCatalog, loadGisLayers } = require('../services/rule-repository');

// Nhãn hiển thị ngắn gọn cho 39 ngành nghề (đồng bộ 1-1 với INDUSTRY_META)
const INDUSTRY_LABELS = {
  ...Object.fromEntries(
    Object.entries(INDUSTRY_META).map(([k, v]) => [k, v.name])
  ),
  che_bien_go: 'Chế biến gỗ / MDF',
  xi_mang: 'Xi măng, clinker',
  thep: 'Luyện kim, sản xuất thép',
  nhiet_dien: 'Nhiệt điện',
  khai_thac_ks: 'Khai thác khoáng sản',
  hoa_chat: 'Hóa chất, phân bón',
  giay_bot: 'Giấy, bột giấy, carton',
  det_nhuom: 'Dệt nhuộm, vải sợi',
  thuc_pham: 'Chế biến thực phẩm, đồ uống',
  nhua_cao_su: 'Nhựa, cao su tổng hợp',
  cao_su_cb: 'Cao su chế biến (mủ khô)',
  duoc_pham: 'Dược phẩm, mỹ phẩm',
  dien_tu: 'Linh kiện điện tử, bán dẫn',
  vat_lieu_xd: 'Vật liệu xây dựng',
  kcn: 'Khu công nghiệp / KCX',
  khu_cong_nghe: 'Khu công nghệ cao / KKT',
  xl_chat_thai: 'Xử lý chất thải rắn / nguy hại',
  xl_nuoc_thai: 'Hệ thống XLNT tập trung',
  khai_thac_nuoc: 'Khai thác nước mặt / dưới đất',
  khai_thac_dau_khi: 'Khai thác dầu khí',
  do_thi: 'Khu đô thị, nhà ở, chung cư',
  cao_toc: 'Đường cao tốc, quốc lộ',
  duong_sat: 'Đường sắt / Metro',
  cang_bien: 'Cảng biển, cảng sông',
  cang_hang_khong: 'Cảng hàng không, sân bay',
  trung_tam_tm: 'Trung tâm thương mại, siêu thị',
  khach_san: 'Khách sạn, resort, du lịch',
  benh_vien: 'Bệnh viện, cơ sở y tế',
  nuoi_thuy_san: 'Nuôi trồng thủy sản',
  nuoi_ts_bien: 'Nuôi trồng thủy sản biển',
  xu_ly_ctnh: 'Xử lý chất thải nguy hại',
  xu_ly_ctr: 'Xử lý chất thải rắn thông thường',
  bai_rac: 'Bãi chôn lấp chất thải',
  chan_nuoi: 'Chăn nuôi gia súc, gia cầm',
  thuy_dien: 'Thủy điện',
  dien_mat_troi: 'Điện mặt trời',
  dien_gio: 'Điện gió',
  nao_vet: 'Nạo vét luồng, hồ chứa',
  ho_chua: 'Hồ chứa, đập thủy lợi',
};

// Nhãn hiển thị cho các loại môi trường QCVN
const QCVN_TYPE_LABELS = {
  nuoc_thai_cn: 'Nước thải công nghiệp (QCVN 40)',
  nuoc_thai_sh: 'Nước thải sinh hoạt (QCVN 14)',
  khi_thai_cn: 'Khí thải công nghiệp (QCVN 19)',
  nuoc_mat: 'Nước mặt (QCVN 08)',
  khong_khi: 'Không khí xung quanh (QCVN 05)',
  dat: 'Chất lượng đất (QCVN 03)',
  nuoc_duoi_dat: 'Nước dưới đất (QCVN 09)',
  nuoc_ngam: 'Nước dưới đất (QCVN 09)'
};

async function loadSensitiveVerifMap() {
  try {
    const res = await db.query(
      `SELECT project_id, declared_flags, declared_details, evidence_ref, verification_status, verified_by
       FROM project_sensitive_verifications`
    );
    const map = new Map();
    for (const r of (res?.rows || [])) {
      map.set(Number(r.project_id), r);
    }
    return map;
  } catch {
    return new Map();
  }
}

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

    // Nạp runtime catalog phân loại & GIS 1 lần dùng chung cho mọi dự án trên Dashboard
    const [catalogRes, gisRes, verifMap] = await Promise.all([
      loadClassificationCatalog({ db }),
      loadGisLayers({ db }),
      loadSensitiveVerifMap(),
    ]);
    const activeCatalog = catalogRes.ok && catalogRes.catalog ? catalogRes.catalog : IND_DB;
    const activeRuleSource = catalogRes.ok ? 'DATABASE' : 'FALLBACK_UNVERIFIED';
    const activeGisLayers = gisRes.ok ? gisRes : null;

    // 1. Phân tích dữ liệu Dự án
    const byGroup = { 'Nhóm I': 0, 'Nhóm II': 0, 'Nhóm III': 0, 'Nhóm IV': 0 };
    const byDossier = { DTM: 0, GPMT: 0, DKMT: 0 };
    const byAuthority = { cap_bo: 0, cap_so: 0, cap_xa: 0, cap_huyen: 0 };
    const industryMap = {};
    const provinceMap = {};

    let gisMappedProjects = 0;
    let monitoredProjects = 0;
    let totalChecklistPercent = 0;
    let completedChecklistProjects = 0;
    let needsReviewProjects = 0;
    let unverifiedProjects = 0;

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
      const evaluated = evaluateStoredProject(row, {
        catalog: activeCatalog,
        ruleSource: activeRuleSource,
        fallbackReason: catalogRes.error || null,
        gisLayers: activeGisLayers,
        serverSensitiveVerification: verifMap.get(Number(row.id)) || null,
      });
      const fd = evaluated.formData || {};

      const nhom = evaluated.nhom;
      const hs = evaluated.hs;
      const tq = evaluated.tq;
      const coQuan = evaluated.coQuan || '—';

      if (evaluated.conclusionStatus === 'NEEDS_REVIEW' || !nhom || !hs || !tq) {
        needsReviewProjects++;
      }
      if (!evaluated.isOfficialConclusion) {
        unverifiedProjects++;
      }

      if (nhom && byGroup[nhom] !== undefined) byGroup[nhom]++;
      if (hs && byDossier[hs] !== undefined) byDossier[hs]++;
      if (tq && byAuthority[tq] !== undefined) byAuthority[tq]++;

      // Ngành nghề
      const nganhCode = fd.nganh || 'khac';
      const nganhLabel = INDUSTRY_LABELS[nganhCode] || activeCatalog?.[nganhCode]?.name || (IND_DB[nganhCode]?.lbl?.split('(')[0]?.trim()) || 'Ngành khác';
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
        nhom: nhom || 'Cần rà soát',
        hs: hs || '—',
        tq: tq || null,
        co_quan: coQuan,
        conclusion_status: evaluated.conclusionStatus,
        is_official_conclusion: evaluated.isOfficialConclusion,
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
        vuot_nguong: 0,
        chua_du_thong_so: 0,
        can_ra_soat: 0
      };
    });

    let linkedSamples = 0;
    let passSamples = 0;
    let warnSamples = 0;
    let failSamples = 0;
    let incompleteSamples = 0;
    let reviewSamples = 0;

    samplesRes.rows.forEach(s => {
      const status = s.trang_thai_tong_quat || 'can_ra_soat';
      if (s.project_id) linkedSamples++;

      if (status === 'dat') passSamples++;
      else if (status === 'canh_bao') warnSamples++;
      else if (status === 'vuot_nguong') failSamples++;
      else if (status === 'chua_du_thong_so') incompleteSamples++;
      else reviewSamples++;

      const tKey = s.type || 'nuoc_mat';
      if (!qcvnByTypeMap[tKey]) {
        qcvnByTypeMap[tKey] = {
          type: tKey,
          label: QCVN_TYPE_LABELS[tKey] || tKey,
          total: 0,
          dat: 0,
          canh_bao: 0,
          vuot_nguong: 0,
          chua_du_thong_so: 0,
          can_ra_soat: 0
        };
      }
      qcvnByTypeMap[tKey].total++;
      if (status === 'dat') qcvnByTypeMap[tKey].dat++;
      else if (status === 'canh_bao') qcvnByTypeMap[tKey].canh_bao++;
      else if (status === 'vuot_nguong') qcvnByTypeMap[tKey].vuot_nguong++;
      else if (status === 'chua_du_thong_so') qcvnByTypeMap[tKey].chua_du_thong_so++;
      else qcvnByTypeMap[tKey].can_ra_soat++;
    });

    const totalSamples = samplesRes.rows.length;
    const complianceRate = totalSamples > 0
      ? Math.round((passSamples / totalSamples) * 100)
      : 0;

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
        needsReviewProjects,
        unverifiedProjects,
        gisMappedProjects,
        monitoredProjects,
        avgChecklistPercent,
        completedChecklistProjects,
        totalSamples,
        linkedSamples,
        passSamples,
        warnSamples,
        failSamples,
        incompleteSamples,
        reviewSamples,
        needsReviewSamples: reviewSamples,
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
