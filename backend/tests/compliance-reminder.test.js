const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OBLIGATION_STATUS,
  ALERT_LEVEL,
  RECURRENCE,
  computeDeadlineStatus,
  computeNextDueDate,
  buildDefaultObligationsForProject,
  syncProjectDefaultObligations,
  listComplianceObligations,
  createComplianceObligation,
  completeComplianceObligation,
  deleteComplianceObligation,
  runComplianceDeadlineScan,
} = require('../services/compliance-reminder-service');

function createReminderMockDb() {
  const projects = [
    { id: 1, user_id: 10, name: 'Nhà máy Dệt nhuộm A', form_data: { nganh: 'det_nhuom', nt: 600 }, classification_result: { nhom: 'Nhóm I', hs: 'DTM' } },
    { id: 2, user_id: 20, name: 'Cơ sở Kho vận B', form_data: { nganh: 'khac', nt: 10 }, classification_result: { nhom: 'Nhóm III', hs: 'GPMT' } },
  ];
  const users = [
    { id: 10, full_name: 'Chuyên viên A' },
    { id: 20, full_name: 'Chuyên viên B' },
  ];
  const obligations = [];
  let seq = 1;

  return {
    obligations,
    async query(sql, params = []) {
      const norm = sql.replace(/\s+/g, ' ').trim();

      if (norm.startsWith('SELECT id, user_id, name, form_data, classification_result FROM projects WHERE id = $1')) {
        const p = projects.find((x) => x.id === Number(params[0]));
        return { rowCount: p ? 1 : 0, rows: p ? [p] : [] };
      }

      if (norm.startsWith('SELECT obligation_code FROM compliance_obligations WHERE project_id = $1 AND status = $2')) {
        const rows = obligations.filter((o) => o.project_id === Number(params[0]) && o.status === params[1]);
        return { rowCount: rows.length, rows: rows.map((r) => ({ obligation_code: r.obligation_code })) };
      }

      if (norm.startsWith('INSERT INTO compliance_obligations')) {
        const row = {
          id: seq++,
          project_id: Number(params[0]),
          user_id: params[1] ? Number(params[1]) : null,
          obligation_code: params[2],
          title: params[3],
          legal_basis: params[4],
          recurrence: params[5],
          due_date: params[6],
          warning_days: Number(params[7]),
          status: params[8],
          completed_at: null,
          completed_by: null,
          completion_note: null,
          last_alert_level: null,
          last_alerted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        obligations.push(row);
        return { rowCount: 1, rows: [row] };
      }

      if (norm.includes('FROM compliance_obligations co JOIN projects p ON p.id = co.project_id') && norm.includes('WHERE co.id = $1')) {
        const ob = obligations.find((o) => o.id === Number(params[0]));
        if (!ob) return { rowCount: 0, rows: [] };
        const p = projects.find((x) => x.id === ob.project_id);
        return { rowCount: 1, rows: [{ ...ob, project_owner_id: p?.user_id }] };
      }

      if (norm.includes('FROM compliance_obligations co JOIN projects p ON p.id = co.project_id') && norm.includes('WHERE co.status = $1')) {
        const rows = obligations
          .filter((o) => o.status === params[0])
          .map((o) => {
            const p = projects.find((x) => x.id === o.project_id);
            return { ...o, project_name: p?.name || null };
          });
        return { rowCount: rows.length, rows };
      }

      if (norm.includes('FROM compliance_obligations co JOIN projects p ON p.id = co.project_id')) {
        let rows = obligations.map((o) => {
          const p = projects.find((x) => x.id === o.project_id);
          const u = users.find((x) => x.id === p?.user_id);
          return {
            ...o,
            project_name: p?.name || null,
            project_owner_id: p?.user_id || null,
            user_name: u?.full_name || null,
          };
        });
        if (norm.includes('p.user_id = $1')) {
          rows = rows.filter((r) => Number(r.project_owner_id) === Number(params[0]));
          if (norm.includes('co.project_id = $2')) {
            rows = rows.filter((r) => Number(r.project_id) === Number(params[1]));
          }
        } else if (norm.includes('co.project_id = $1')) {
          rows = rows.filter((r) => Number(r.project_id) === Number(params[0]));
        }
        return { rowCount: rows.length, rows };
      }

      if (norm.startsWith('UPDATE compliance_obligations SET status = $1')) {
        const ob = obligations.find((o) => o.id === Number(params[3]));
        if (!ob) return { rowCount: 0, rows: [] };
        ob.status = params[0];
        ob.completed_by = params[1];
        ob.completion_note = params[2];
        ob.completed_at = new Date().toISOString();
        return { rowCount: 1, rows: [ob] };
      }

      if (norm.startsWith('UPDATE compliance_obligations SET last_alert_level = $1')) {
        const ob = obligations.find((o) => o.id === Number(params[1]));
        if (ob) {
          ob.last_alert_level = params[0];
          ob.last_alerted_at = new Date().toISOString();
        }
        return { rowCount: ob ? 1 : 0, rows: [] };
      }

      if (norm.startsWith('DELETE FROM compliance_obligations WHERE id = $1')) {
        const idx = obligations.findIndex((o) => o.id === Number(params[0]));
        if (idx >= 0) obligations.splice(idx, 1);
        return { rowCount: idx >= 0 ? 1 : 0, rows: [] };
      }

      return { rowCount: 0, rows: [] };
    },
  };
}

test('computeDeadlineStatus: phân loại chính xác 4 trạng thái tiếng Việt (qua_han, sap_den_han, trong_han, da_hoan_thanh)', () => {
  const ref = '2026-11-13';

  const overdue = computeDeadlineStatus({ due_date: '2026-11-08', warning_days: 30, status: OBLIGATION_STATUS.PENDING }, ref);
  assert.equal(overdue.muc_canh_bao, ALERT_LEVEL.OVERDUE);
  assert.equal(overdue.so_ngay_con_lai, -5);
  assert.equal(overdue.nhan_trang_thai, 'Quá hạn 5 ngày');

  const dueSoon = computeDeadlineStatus({ due_date: '2026-11-28', warning_days: 30, status: OBLIGATION_STATUS.PENDING }, ref);
  assert.equal(dueSoon.muc_canh_bao, ALERT_LEVEL.DUE_SOON);
  assert.equal(dueSoon.so_ngay_con_lai, 15);
  assert.equal(dueSoon.nhan_trang_thai, 'Còn 15 ngày');

  const onTrack = computeDeadlineStatus({ due_date: '2027-01-15', warning_days: 30, status: OBLIGATION_STATUS.PENDING }, ref);
  assert.equal(onTrack.muc_canh_bao, ALERT_LEVEL.ON_TRACK);
  assert.equal(onTrack.so_ngay_con_lai, 63);

  const completed = computeDeadlineStatus({ due_date: '2026-11-01', warning_days: 30, status: OBLIGATION_STATUS.COMPLETED }, ref);
  assert.equal(completed.muc_canh_bao, ALERT_LEVEL.COMPLETED);
  assert.equal(completed.nhan_trang_thai, 'Đã hoàn thành');
});

test('computeNextDueDate: tính đúng ngày kỳ tiếp theo cho chu kỳ hang_quy, sau_thang, hang_nam', () => {
  assert.equal(computeNextDueDate('2026-01-15', RECURRENCE.QUARTERLY), '2026-04-15');
  assert.equal(computeNextDueDate('2026-01-15', RECURRENCE.SEMI_ANNUAL), '2026-07-15');
  assert.equal(computeNextDueDate('2026-01-15', RECURRENCE.ANNUAL), '2027-01-15');
  assert.equal(computeNextDueDate('2026-01-15', RECURRENCE.ONCE), null);
});

test('buildDefaultObligationsForProject & syncProjectDefaultObligations: sinh đúng nghĩa vụ và không trùng lặp', async () => {
  const db = createReminderMockDb();
  const project = { id: 1, user_id: 10, form_data: { nt: 600, kt: 0 } };
  const evaluated = { nhom: 'Nhóm I', hs: 'DTM', environmentalObligations: ['DTM', 'GPMT'] };

  const defaults = buildDefaultObligationsForProject(project, evaluated, '2026-11-13');
  const codes = defaults.map((d) => d.obligation_code);
  assert.ok(codes.includes('bao_cao_bvmt_nam'));
  assert.ok(codes.includes('quan_trac_dinh_ky'));
  assert.ok(codes.includes('gia_han_gpmt'));
  assert.ok(codes.includes('van_hanh_thu_nghiem'));

  const firstSync = await syncProjectDefaultObligations({ db, projectRow: project, evaluatedResult: evaluated, userId: 10, referenceDate: '2026-11-13' });
  assert.equal(firstSync.inserted, 4);

  const secondSync = await syncProjectDefaultObligations({ db, projectRow: project, evaluatedResult: evaluated, userId: 10, referenceDate: '2026-11-13' });
  assert.equal(secondSync.inserted, 0);
});

test('CRUD, RBAC, hoàn thành tự sinh kỳ tiếp theo và quét nhắc hạn toàn hệ thống', async () => {
  const db = createReminderMockDb();
  const refDate = '2026-11-13';

  const ob1 = await createComplianceObligation({
    db,
    userId: 10,
    isAdmin: false,
    referenceDate: refDate,
    payload: {
      project_id: 1,
      tieu_de: 'Nộp báo cáo quan trắc quý IV/2026',
      han_nop: '2026-11-10',
      chu_ky: RECURRENCE.QUARTERLY,
      so_ngay_nhac_truoc: 15,
    },
  });
  assert.equal(ob1.muc_canh_bao, ALERT_LEVEL.OVERDUE);
  assert.equal(ob1.trang_thai, OBLIGATION_STATUS.PENDING);

  // Staff 20 không thể thao tác dự án của Staff 10
  await assert.rejects(
    () => createComplianceObligation({
      db,
      userId: 20,
      isAdmin: false,
      payload: { project_id: 1, tieu_de: 'Trái phép', han_nop: '2026-12-01' },
    }),
    (err) => err.statusCode === 403
  );
  await assert.rejects(
    () => deleteComplianceObligation({ db, id: ob1.id, userId: 20, isAdmin: false }),
    (err) => err.statusCode === 403
  );

  // Quét hạn toàn hệ thống
  const scanRes = await runComplianceDeadlineScan({ db, referenceDate: refDate });
  assert.equal(scanRes.tong_quet, 1);
  assert.equal(scanRes.qua_han, 1);

  // Đánh dấu hoàn thành -> tự sinh kỳ tiếp theo (2027-02-10)
  const completedRes = await completeComplianceObligation({
    db,
    id: ob1.id,
    userId: 10,
    isAdmin: false,
    note: 'Đã nộp qua cổng dịch vụ công',
    createNextPeriod: true,
    referenceDate: refDate,
  });
  assert.equal(completedRes.completedItem.trang_thai, OBLIGATION_STATUS.COMPLETED);
  assert.equal(completedRes.completedItem.muc_canh_bao, ALERT_LEVEL.COMPLETED);
  assert.ok(completedRes.nextItem);
  assert.equal(completedRes.nextItem.han_nop, '2027-02-10');
  assert.equal(completedRes.nextItem.muc_canh_bao, ALERT_LEVEL.ON_TRACK);

  const list = await listComplianceObligations({ db, userId: 10, isAdmin: false, projectId: 1, referenceDate: refDate });
  assert.equal(list.summary.tong_so, 2);
  assert.equal(list.summary.da_hoan_thanh, 1);
  assert.equal(list.summary.trong_han, 1);
});
