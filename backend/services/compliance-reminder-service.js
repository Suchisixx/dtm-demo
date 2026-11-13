// backend/services/compliance-reminder-service.js
// Dịch vụ tính toán, theo dõi và nhắc hạn nghĩa vụ tuân thủ môi trường (Server-Authoritative)
const defaultDb = require('../config/db');
const logger = require('../utils/logger');

const OBLIGATION_STATUS = {
  PENDING: 'chua_hoan_thanh',
  COMPLETED: 'da_hoan_thanh',
};

const ALERT_LEVEL = {
  OVERDUE: 'qua_han',
  DUE_SOON: 'sap_den_han',
  ON_TRACK: 'trong_han',
  COMPLETED: 'da_hoan_thanh',
};

const RECURRENCE = {
  ONCE: 'mot_lan',
  QUARTERLY: 'hang_quy',
  SEMI_ANNUAL: 'sau_thang',
  ANNUAL: 'hang_nam',
};

const RECURRENCE_LABELS = {
  [RECURRENCE.ONCE]: 'Một lần',
  [RECURRENCE.QUARTERLY]: 'Hàng quý (3 tháng)',
  [RECURRENCE.SEMI_ANNUAL]: '6 tháng / lần',
  [RECURRENCE.ANNUAL]: 'Hàng năm',
};

const ALERT_SEVERITY_RANK = {
  [ALERT_LEVEL.OVERDUE]: 0,
  [ALERT_LEVEL.DUE_SOON]: 1,
  [ALERT_LEVEL.ON_TRACK]: 2,
  [ALERT_LEVEL.COMPLETED]: 3,
};

function toUtcDateOnly(input = new Date()) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  }
  const str = String(input || '').trim();
  if (!str) return null;
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const dt = new Date(Date.UTC(year, month, day));
    if (dt.getUTCFullYear() === year && dt.getUTCMonth() === month && dt.getUTCDate() === day) {
      return dt;
    }
    return null;
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function formatIsoDate(date) {
  const dt = toUtcDateOnly(date);
  if (!dt) return null;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonthsUtc(date, months) {
  const dt = toUtcDateOnly(date);
  if (!dt) return null;
  const targetMonth = dt.getUTCMonth() + months;
  const targetYear = dt.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const day = Math.min(dt.getUTCDate(), lastDay);
  return new Date(Date.UTC(targetYear, normalizedMonth, day));
}

function computeNextDueDate(currentDueDate, recurrence) {
  if (recurrence === RECURRENCE.QUARTERLY) return formatIsoDate(addMonthsUtc(currentDueDate, 3));
  if (recurrence === RECURRENCE.SEMI_ANNUAL) return formatIsoDate(addMonthsUtc(currentDueDate, 6));
  if (recurrence === RECURRENCE.ANNUAL) return formatIsoDate(addMonthsUtc(currentDueDate, 12));
  return null;
}

/**
 * Tính toán trạng thái nhắc hạn phía server dựa trên ngày đến hạn và ngày tham chiếu.
 */
function computeDeadlineStatus(row = {}, referenceDate = new Date()) {
  const status = row.status || OBLIGATION_STATUS.PENDING;
  const warningDays = Math.max(0, Number.isFinite(Number(row.warning_days)) ? Number(row.warning_days) : 30);
  const dueUtc = toUtcDateOnly(row.due_date);
  const refUtc = toUtcDateOnly(referenceDate) || toUtcDateOnly(new Date());

  if (status === OBLIGATION_STATUS.COMPLETED) {
    return {
      trang_thai: OBLIGATION_STATUS.COMPLETED,
      muc_canh_bao: ALERT_LEVEL.COMPLETED,
      nhan_muc_canh_bao: 'Đã hoàn thành',
      nhan_trang_thai: 'Đã hoàn thành',
      so_ngay_con_lai: dueUtc && refUtc ? Math.round((dueUtc.getTime() - refUtc.getTime()) / 86400000) : null,
      thu_tu_uu_tien: ALERT_SEVERITY_RANK[ALERT_LEVEL.COMPLETED],
    };
  }

  if (!dueUtc || !refUtc) {
    return {
      trang_thai: OBLIGATION_STATUS.PENDING,
      muc_canh_bao: ALERT_LEVEL.DUE_SOON,
      nhan_muc_canh_bao: 'Cần kiểm tra hạn',
      nhan_trang_thai: 'Chưa xác định ngày hạn',
      so_ngay_con_lai: null,
      thu_tu_uu_tien: ALERT_SEVERITY_RANK[ALERT_LEVEL.DUE_SOON],
    };
  }

  const diffDays = Math.round((dueUtc.getTime() - refUtc.getTime()) / 86400000);
  if (diffDays < 0) {
    return {
      trang_thai: OBLIGATION_STATUS.PENDING,
      muc_canh_bao: ALERT_LEVEL.OVERDUE,
      nhan_muc_canh_bao: 'Quá hạn',
      nhan_trang_thai: `Quá hạn ${Math.abs(diffDays)} ngày`,
      so_ngay_con_lai: diffDays,
      thu_tu_uu_tien: ALERT_SEVERITY_RANK[ALERT_LEVEL.OVERDUE],
    };
  }
  if (diffDays <= warningDays) {
    return {
      trang_thai: OBLIGATION_STATUS.PENDING,
      muc_canh_bao: ALERT_LEVEL.DUE_SOON,
      nhan_muc_canh_bao: 'Sắp đến hạn',
      nhan_trang_thai: diffDays === 0 ? 'Đến hạn hôm nay' : `Còn ${diffDays} ngày`,
      so_ngay_con_lai: diffDays,
      thu_tu_uu_tien: ALERT_SEVERITY_RANK[ALERT_LEVEL.DUE_SOON],
    };
  }
  return {
    trang_thai: OBLIGATION_STATUS.PENDING,
    muc_canh_bao: ALERT_LEVEL.ON_TRACK,
    nhan_muc_canh_bao: 'Trong hạn',
    nhan_trang_thai: `Còn ${diffDays} ngày`,
    so_ngay_con_lai: diffDays,
    thu_tu_uu_tien: ALERT_SEVERITY_RANK[ALERT_LEVEL.ON_TRACK],
  };
}

function enrichObligationRow(row, referenceDate = new Date()) {
  const computed = computeDeadlineStatus(row, referenceDate);
  const recurrence = Object.values(RECURRENCE).includes(row.recurrence) ? row.recurrence : RECURRENCE.ONCE;
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name || null,
    user_id: row.user_id,
    user_name: row.user_name || null,
    ma_nghia_vu: row.obligation_code || 'tuy_chinh',
    tieu_de: row.title,
    can_cu_phap_ly: row.legal_basis || '',
    chu_ky: recurrence,
    nhan_chu_ky: RECURRENCE_LABELS[recurrence] || 'Một lần',
    han_nop: formatIsoDate(row.due_date),
    so_ngay_nhac_truoc: Number(row.warning_days ?? 30),
    trang_thai: computed.trang_thai,
    muc_canh_bao: computed.muc_canh_bao,
    nhan_muc_canh_bao: computed.nhan_muc_canh_bao,
    nhan_trang_thai: computed.nhan_trang_thai,
    so_ngay_con_lai: computed.so_ngay_con_lai,
    thu_tu_uu_tien: computed.thu_tu_uu_tien,
    hoan_thanh_luc: row.completed_at || null,
    ghi_chu_hoan_thanh: row.completion_note || null,
    muc_canh_bao_cuoi: row.last_alert_level || null,
    canh_bao_luc: row.last_alerted_at || null,
    tao_luc: row.created_at || null,
  };
}

function sortObligationsByUrgency(items = []) {
  return [...items].sort((a, b) => {
    if (a.thu_tu_uu_tien !== b.thu_tu_uu_tien) {
      return a.thu_tu_uu_tien - b.thu_tu_uu_tien;
    }
    const da = a.so_ngay_con_lai ?? 99999;
    const db = b.so_ngay_con_lai ?? 99999;
    if (da !== db) return da - db;
    return (a.id || 0) - (b.id || 0);
  });
}

function summarizeObligations(items = []) {
  const summary = {
    tong_so: items.length,
    qua_han: 0,
    sap_den_han: 0,
    trong_han: 0,
    da_hoan_thanh: 0,
  };
  for (const item of items) {
    if (item.muc_canh_bao === ALERT_LEVEL.OVERDUE) summary.qua_han++;
    else if (item.muc_canh_bao === ALERT_LEVEL.DUE_SOON) summary.sap_den_han++;
    else if (item.muc_canh_bao === ALERT_LEVEL.ON_TRACK) summary.trong_han++;
    else if (item.muc_canh_bao === ALERT_LEVEL.COMPLETED) summary.da_hoan_thanh++;
  }
  return summary;
}

function nextAnnualReportDate(referenceDate = new Date()) {
  const ref = toUtcDateOnly(referenceDate) || toUtcDateOnly(new Date());
  const year = ref.getUTCFullYear();
  const jan15ThisYear = new Date(Date.UTC(year, 0, 15));
  if (ref <= jan15ThisYear) {
    return formatIsoDate(jan15ThisYear);
  }
  return formatIsoDate(new Date(Date.UTC(year + 1, 0, 15)));
}

function nextQuarterEndReportDate(referenceDate = new Date()) {
  const ref = toUtcDateOnly(referenceDate) || toUtcDateOnly(new Date());
  const year = ref.getUTCFullYear();
  const month = ref.getUTCMonth(); // 0..11
  const quarterStarts = [
    new Date(Date.UTC(year, 0, 15)),
    new Date(Date.UTC(year, 3, 15)),
    new Date(Date.UTC(year, 6, 15)),
    new Date(Date.UTC(year, 9, 15)),
    new Date(Date.UTC(year + 1, 0, 15)),
  ];
  const next = quarterStarts.find((d) => d >= ref) || quarterStarts[quarterStarts.length - 1];
  if (month === 0 && ref <= quarterStarts[0]) return formatIsoDate(quarterStarts[0]);
  return formatIsoDate(next);
}

/**
 * Đề xuất bộ nghĩa vụ mặc định theo kết quả phân loại dự án (ĐTM / GPMT / ĐKMT) và xả thải.
 */
function buildDefaultObligationsForProject(projectRow = {}, evaluatedResult = {}, referenceDate = new Date()) {
  const fd = projectRow.form_data || evaluatedResult.formData || {};
  const nhom = evaluatedResult.nhom || projectRow.nhom || null;
  const hs = evaluatedResult.hs || projectRow.hs || null;
  const obligations = Array.isArray(evaluatedResult.environmentalObligations)
    ? evaluatedResult.environmentalObligations
    : [];
  const hasDtm = hs === 'DTM' || obligations.includes('DTM');
  const hasGpmt = hs === 'GPMT' || obligations.includes('GPMT');
  const hasDkmt = hs === 'DKMT' || obligations.includes('DKMT');
  const nt = parseFloat(fd.nt || 0) || 0;
  const kt = parseFloat(fd.kt || 0) || 0;
  const refUtc = toUtcDateOnly(referenceDate) || toUtcDateOnly(new Date());

  const defaults = [];

  if (hasGpmt || hasDkmt || hasDtm) {
    defaults.push({
      obligation_code: 'bao_cao_bvmt_nam',
      title: 'Nộp Báo cáo công tác bảo vệ môi trường định kỳ năm',
      legal_basis: 'Điều 66, Thông tư 02/2022/TT-BTNMT',
      recurrence: RECURRENCE.ANNUAL,
      due_date: nextAnnualReportDate(refUtc),
      warning_days: 30,
    });
  }

  if (hasGpmt && (nt > 0 || kt > 0)) {
    const isHighFrequency = nhom === 'Nhóm I' || nt >= 500 || kt >= 50000;
    defaults.push({
      obligation_code: 'quan_trac_dinh_ky',
      title: isHighFrequency
        ? 'Nộp kết quả quan trắc chất thải định kỳ (hàng quý)'
        : 'Nộp kết quả quan trắc chất thải định kỳ (6 tháng)',
      legal_basis: 'Điều 97, 98 Nghị định 08/2022/NĐ-CP',
      recurrence: isHighFrequency ? RECURRENCE.QUARTERLY : RECURRENCE.SEMI_ANNUAL,
      due_date: nextQuarterEndReportDate(refUtc),
      warning_days: 15,
    });
  }

  if (hasGpmt) {
    const validityYears = nhom === 'Nhóm I' ? 7 : 10;
    defaults.push({
      obligation_code: 'gia_han_gpmt',
      title: `Rà soát gia hạn / cấp lại Giấy phép môi trường (thời hạn ${validityYears} năm)`,
      legal_basis: 'Điều 40, Luật Bảo vệ môi trường 2020',
      recurrence: RECURRENCE.ONCE,
      due_date: formatIsoDate(addMonthsUtc(refUtc, validityYears * 12)),
      warning_days: 180,
    });
  }

  if (hasDtm) {
    defaults.push({
      obligation_code: 'van_hanh_thu_nghiem',
      title: 'Báo cáo kết quả vận hành thử nghiệm công trình xử lý chất thải',
      legal_basis: 'Điều 31, Nghị định 08/2022/NĐ-CP',
      recurrence: RECURRENCE.ONCE,
      due_date: formatIsoDate(addMonthsUtc(refUtc, 6)),
      warning_days: 30,
    });
  }

  return defaults;
}

async function syncProjectDefaultObligations({
  db = defaultDb,
  projectRow,
  evaluatedResult = {},
  userId = null,
  referenceDate = new Date(),
}) {
  if (!projectRow?.id) return { inserted: 0, items: [] };
  const defaults = buildDefaultObligationsForProject(projectRow, evaluatedResult, referenceDate);
  if (defaults.length === 0) return { inserted: 0, items: [] };

  const existingRes = await db.query(
    `SELECT obligation_code
     FROM compliance_obligations
     WHERE project_id = $1 AND status = $2`,
    [projectRow.id, OBLIGATION_STATUS.PENDING]
  );
  const existingCodes = new Set((existingRes.rows || []).map((r) => r.obligation_code));

  const inserted = [];
  for (const item of defaults) {
    if (existingCodes.has(item.obligation_code)) continue;
    const res = await db.query(
      `INSERT INTO compliance_obligations
         (project_id, user_id, obligation_code, title, legal_basis, recurrence, due_date, warning_days, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        projectRow.id,
        userId || projectRow.user_id || null,
        item.obligation_code,
        item.title,
        item.legal_basis,
        item.recurrence,
        item.due_date,
        item.warning_days,
        OBLIGATION_STATUS.PENDING,
      ]
    );
    if (res.rows?.[0]) inserted.push(enrichObligationRow(res.rows[0], referenceDate));
  }

  return { inserted: inserted.length, items: inserted };
}

async function listComplianceObligations({
  db = defaultDb,
  userId,
  isAdmin = false,
  projectId = null,
  alertLevel = null,
  filterUserId = null,
  referenceDate = new Date(),
} = {}) {
  const conditions = [];
  const params = [];

  if (!isAdmin) {
    params.push(userId);
    conditions.push(`p.user_id = $${params.length}`);
  } else if (filterUserId) {
    params.push(filterUserId);
    conditions.push(`p.user_id = $${params.length}`);
  }

  if (projectId) {
    params.push(projectId);
    conditions.push(`co.project_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT
       co.*,
       p.name AS project_name,
       p.user_id AS project_owner_id,
       u.full_name AS user_name
     FROM compliance_obligations co
     JOIN projects p ON p.id = co.project_id
     LEFT JOIN users u ON u.id = p.user_id
     ${whereClause}
     ORDER BY co.due_date ASC, co.id ASC`,
    params
  );

  const allItems = sortObligationsByUrgency(
    (result.rows || []).map((row) => enrichObligationRow(row, referenceDate))
  );
  const summary = summarizeObligations(allItems);
  const filtered = alertLevel && alertLevel !== 'tat_ca'
    ? allItems.filter((item) => item.muc_canh_bao === alertLevel)
    : allItems;

  return { items: filtered, allItems, summary };
}

async function assertProjectAccess({ db = defaultDb, projectId, userId, isAdmin = false }) {
  const res = await db.query('SELECT id, user_id, name, form_data, classification_result FROM projects WHERE id = $1', [projectId]);
  if (res.rowCount === 0) {
    const err = new Error('Không tìm thấy dự án.');
    err.statusCode = 404;
    throw err;
  }
  const project = res.rows[0];
  if (!isAdmin && Number(project.user_id) !== Number(userId)) {
    const err = new Error('Bạn không có quyền thao tác lịch nhắc hạn của dự án này.');
    err.statusCode = 403;
    throw err;
  }
  return project;
}

async function createComplianceObligation({
  db = defaultDb,
  payload = {},
  userId,
  isAdmin = false,
  referenceDate = new Date(),
}) {
  const projectId = Number(payload.project_id);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    const err = new Error('Mã dự án không hợp lệ.');
    err.statusCode = 400;
    throw err;
  }

  await assertProjectAccess({ db, projectId, userId, isAdmin });

  const title = String(payload.tieu_de || payload.title || '').trim();
  if (!title) {
    const err = new Error('Vui lòng nhập tiêu đề nghĩa vụ tuân thủ.');
    err.statusCode = 400;
    throw err;
  }

  const dueDateIso = formatIsoDate(payload.han_nop || payload.due_date);
  if (!dueDateIso) {
    const err = new Error('Ngày đến hạn không hợp lệ (định dạng YYYY-MM-DD).');
    err.statusCode = 400;
    throw err;
  }

  const recurrenceInput = String(payload.chu_ky || payload.recurrence || RECURRENCE.ONCE).trim();
  const recurrence = Object.values(RECURRENCE).includes(recurrenceInput) ? recurrenceInput : RECURRENCE.ONCE;
  const warningDaysRaw = payload.so_ngay_nhac_truoc ?? payload.warning_days ?? 30;
  const warningDays = Math.max(0, Math.min(365, parseInt(warningDaysRaw, 10) || 30));

  const res = await db.query(
    `INSERT INTO compliance_obligations
       (project_id, user_id, obligation_code, title, legal_basis, recurrence, due_date, warning_days, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      projectId,
      userId || null,
      String(payload.ma_nghia_vu || payload.obligation_code || 'tuy_chinh').slice(0, 60),
      title.slice(0, 255),
      String(payload.can_cu_phap_ly || payload.legal_basis || '').slice(0, 255),
      recurrence,
      dueDateIso,
      warningDays,
      OBLIGATION_STATUS.PENDING,
    ]
  );

  return enrichObligationRow(res.rows[0], referenceDate);
}

async function completeComplianceObligation({
  db = defaultDb,
  id,
  userId,
  isAdmin = false,
  note = '',
  createNextPeriod = true,
  referenceDate = new Date(),
}) {
  const existingRes = await db.query(
    `SELECT co.*, p.user_id AS project_owner_id
     FROM compliance_obligations co
     JOIN projects p ON p.id = co.project_id
     WHERE co.id = $1`,
    [id]
  );
  if (existingRes.rowCount === 0) {
    const err = new Error('Không tìm thấy mốc nhắc hạn.');
    err.statusCode = 404;
    throw err;
  }
  const current = existingRes.rows[0];
  if (!isAdmin && Number(current.project_owner_id) !== Number(userId)) {
    const err = new Error('Bạn không có quyền cập nhật mốc nhắc hạn của dự án này.');
    err.statusCode = 403;
    throw err;
  }

  const updatedRes = await db.query(
    `UPDATE compliance_obligations
     SET status = $1,
         completed_at = CURRENT_TIMESTAMP,
         completed_by = $2,
         completion_note = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [OBLIGATION_STATUS.COMPLETED, userId || null, String(note || '').trim() || null, id]
  );
  const completedItem = enrichObligationRow(updatedRes.rows[0], referenceDate);

  let nextItem = null;
  if (createNextPeriod && current.recurrence && current.recurrence !== RECURRENCE.ONCE) {
    const nextDue = computeNextDueDate(current.due_date, current.recurrence);
    if (nextDue) {
      const nextRes = await db.query(
        `INSERT INTO compliance_obligations
           (project_id, user_id, obligation_code, title, legal_basis, recurrence, due_date, warning_days, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          current.project_id,
          current.user_id || userId || null,
          current.obligation_code,
          current.title,
          current.legal_basis,
          current.recurrence,
          nextDue,
          current.warning_days ?? 30,
          OBLIGATION_STATUS.PENDING,
        ]
      );
      if (nextRes.rows?.[0]) {
        nextItem = enrichObligationRow(nextRes.rows[0], referenceDate);
      }
    }
  }

  return { completedItem, nextItem };
}

async function deleteComplianceObligation({ db = defaultDb, id, userId, isAdmin = false }) {
  const existingRes = await db.query(
    `SELECT co.id, p.user_id AS project_owner_id
     FROM compliance_obligations co
     JOIN projects p ON p.id = co.project_id
     WHERE co.id = $1`,
    [id]
  );
  if (existingRes.rowCount === 0) {
    const err = new Error('Không tìm thấy mốc nhắc hạn.');
    err.statusCode = 404;
    throw err;
  }
  if (!isAdmin && Number(existingRes.rows[0].project_owner_id) !== Number(userId)) {
    const err = new Error('Bạn không có quyền xóa mốc nhắc hạn của dự án này.');
    err.statusCode = 403;
    throw err;
  }

  await db.query('DELETE FROM compliance_obligations WHERE id = $1', [id]);
  return { deletedId: Number(id) };
}

/**
 * Quét toàn bộ nghĩa vụ chưa hoàn thành để phân mức cảnh báo và cập nhật mốc nhắc gần nhất.
 */
async function runComplianceDeadlineScan({ db = defaultDb, referenceDate = new Date() } = {}) {
  const res = await db.query(
    `SELECT co.*, p.name AS project_name
     FROM compliance_obligations co
     JOIN projects p ON p.id = co.project_id
     WHERE co.status = $1`,
    [OBLIGATION_STATUS.PENDING]
  );

  const summary = {
    tong_quet: res.rows?.length || 0,
    qua_han: 0,
    sap_den_han: 0,
    trong_han: 0,
    canh_bao_moi: 0,
  };

  for (const row of res.rows || []) {
    const computed = computeDeadlineStatus(row, referenceDate);
    if (computed.muc_canh_bao === ALERT_LEVEL.OVERDUE) summary.qua_han++;
    else if (computed.muc_canh_bao === ALERT_LEVEL.DUE_SOON) summary.sap_den_han++;
    else summary.trong_han++;

    const isEscalated = computed.muc_canh_bao !== ALERT_LEVEL.ON_TRACK && row.last_alert_level !== computed.muc_canh_bao;
    if (isEscalated) summary.canh_bao_moi++;

    if (row.last_alert_level !== computed.muc_canh_bao) {
      await db.query(
        `UPDATE compliance_obligations
         SET last_alert_level = $1,
             last_alerted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [computed.muc_canh_bao, row.id]
      );
    }
  }

  logger.info(
    `[Nhắc hạn tuân thủ] Quét ${summary.tong_quet} nghĩa vụ: ${summary.qua_han} quá hạn, ${summary.sap_den_han} sắp đến hạn, ${summary.trong_han} trong hạn.`
  );
  return summary;
}

module.exports = {
  OBLIGATION_STATUS,
  ALERT_LEVEL,
  RECURRENCE,
  RECURRENCE_LABELS,
  computeDeadlineStatus,
  computeNextDueDate,
  enrichObligationRow,
  sortObligationsByUrgency,
  summarizeObligations,
  buildDefaultObligationsForProject,
  syncProjectDefaultObligations,
  listComplianceObligations,
  assertProjectAccess,
  createComplianceObligation,
  completeComplianceObligation,
  deleteComplianceObligation,
  runComplianceDeadlineScan,
};
