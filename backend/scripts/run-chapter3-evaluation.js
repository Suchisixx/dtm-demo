// backend/scripts/run-chapter3-evaluation.js
// Kịch bản thực nghiệm toàn diện Chương 3:
// 1. Khảo sát môi trường phần cứng, phần mềm & thống kê 19 bảng vật lý PostgreSQL
// 2. Thực nghiệm Chức năng (10 kịch bản Phân loại hồ sơ, 6 kịch bản QCVN, 4 kịch bản GIS & Nhắc hạn)
// 3. Thực nghiệm Phi chức năng / Hiệu năng (Đo độ trễ Min, Avg, P95, Max qua 20 lần gọi mỗi API)
// 4. Thực nghiệm Bảo mật & Phân quyền (JWT, RBAC, Client Spoofing, Audit Trace)
// 5. Thực nghiệm Biên dữ liệu & Cổng an toàn pháp lý (Boundary & Fail-Closed)
// 6. Xuất dữ liệu JSON tại docs/testing-evidence/chapter3-empirical-results.json

const os = require('os');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { performance } = require('perf_hooks');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const db = require('../config/db');
const { JWT_SECRET, COOKIE_NAME } = require('../utils/constants');
const { ensureRuntimeDatabaseReady } = require('../services/db-bootstrap');
const { installSandboxDbFallbackIfNeeded } = require('./sandbox-db-adapter');
const { loadClassificationCatalog } = require('../services/rule-repository');
const {
  evaluateClassification,
  evaluateClassificationWithDb,
} = require('../services/classification-service');
const { analyzeSpatialContextWithDb } = require('../services/spatial-gis-service');
const {
  evaluateQcvnSampleWithDb,
  selectApplicableQcvnWithDb,
} = require('../services/qcvn-service');
const {
  computeDeadlineStatus,
  computeNextDueDate,
} = require('../services/compliance-reminder-service');

const EVIDENCE_DIR = path.join(__dirname, '../../docs/testing-evidence');
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function createTestExpressApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/projects', require('../routes/projects'));
  app.use('/api/classification', require('../routes/classification'));
  app.use('/api/admin/rules', require('../routes/admin-rules'));
  app.use('/api/admin', require('../routes/admin'));
  app.use('/api/laws', require('../routes/laws'));
  app.use('/api/qcvns', require('../routes/qcvns'));
  app.use('/api/crawler', require('../routes/crawler'));
  app.use('/api/dashboard', require('../routes/dashboard'));
  app.use('/api/reminders', require('../routes/reminders'));

  return app;
}

function percentile(sortedArr, p) {
  if (!sortedArr.length) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[Math.max(0, idx)];
}

async function measureEndpoint(name, method, url, options = {}, iterations = 20) {
  const samples = [];
  let lastStatus = 0;
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const res = await fetch(url, { method, ...options });
    await res.text();
    const dt = performance.now() - t0;
    lastStatus = res.status;
    samples.push(dt);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    name,
    method,
    status: lastStatus,
    iterations,
    minMs: Number(sorted[0].toFixed(2)),
    avgMs: Number((sum / sorted.length).toFixed(2)),
    p95Ms: Number(percentile(sorted, 95).toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

async function runEvaluation() {
  console.log('--- BẮT ĐẦU CHẠY THỰC NGHIỆM HỆ THỐNG CHO CHƯƠNG 3 ---');
  const dbMode = await installSandboxDbFallbackIfNeeded(db);
  console.log(`✔ Chế độ kết nối dữ liệu: ${dbMode.mode}`);
  await ensureRuntimeDatabaseReady(db);
  const loadedCatalog = await loadClassificationCatalog({ db });

  // 1. Thu thập thông tin môi trường & CSDL
  const pgVersionRes = await db.query('SELECT version() AS ver');
  const physicalTables = [
    { name: 'nguoi_dung', desc: 'Tài khoản người dùng và vai trò phân quyền (Quản trị viên, Nhân viên)' },
    { name: 'nhat_ky_kiem_toan', desc: 'Nhật ký kiểm toán toàn bộ thao tác nghiệp vụ và pháp lý' },
    { name: 'nhat_ky_truy_van', desc: 'Lịch sử truy vấn phân loại dự án và tra cứu quy chuẩn' },
    { name: 'cai_dat_he_thong', desc: 'Tham số cấu hình hệ thống vận hành' },
    { name: 'luat', desc: 'Kho văn bản quy phạm pháp luật môi trường (Luật, Nghị định, Thông tư, VBHN)' },
    { name: 'phu_luc_phap_ly', desc: 'Danh mục Phụ lục II, III, IV theo Nghị định 08/2022/NĐ-CP và VBHN 49/VBHN-BNNMT' },
    { name: 'quy_tac', desc: 'Tập quy tắc suy diễn phân loại hồ sơ môi trường' },
    { name: 'phien_ban_quy_tac', desc: 'Quản lý phiên bản bộ quy tắc theo mốc hiệu lực thời gian' },
    { name: 'lich_su_cap_nhat_van_ban', desc: 'Lịch sử thu thập và đồng bộ văn bản của tiến trình Web Crawler' },
    { name: 'anh_huong_quy_tac_van_ban', desc: 'Bản đồ liên kết ảnh hưởng giữa văn bản pháp lý và quy tắc ngành nghề' },
    { name: 'de_xuat_quy_tac', desc: 'Hàng đợi đề xuất cập nhật quy tắc chờ thẩm định' },
    { name: 'nganh_nghe', desc: 'Danh mục 39 nhóm ngành nghề đầu tư sản xuất kinh doanh' },
    { name: 'nguong_phan_loai', desc: 'Bảng ngưỡng công suất định lượng và phân nhánh công đoạn sản xuất' },
    { name: 'du_an', desc: 'Hồ sơ dự án đầu tư, tọa độ GIS và kết quả phân loại' },
    { name: 'xac_minh_yeu_to_nhay_cam_du_an', desc: 'Bản ghi thẩm định yếu tố nhạy cảm môi trường phía máy chủ' },
    { name: 'lop_ban_do', desc: 'Dữ liệu không gian GIS (Vườn quốc gia, Khu bảo tồn, Khu công nghiệp)' },
    { name: 'nghia_vu_tuan_thu', desc: 'Lịch nhắc hạn nghĩa vụ báo cáo và quan trắc môi trường định kỳ' },
    { name: 'quy_chuan_qcvn', desc: 'Danh mục Quy chuẩn kỹ thuật quốc gia về môi trường và bảng giới hạn thông số' },
    { name: 'mau_quan_trac_qcvn', desc: 'Hồ sơ mẫu quan trắc môi trường và kết quả đối chiếu chi tiết từng chỉ tiêu' },
  ];

  const tableCounts = [];
  for (const tbl of physicalTables) {
    try {
      const r = await db.query(`SELECT COUNT(*)::int AS cnt FROM ${tbl.name}`);
      tableCounts.push({ table: tbl.name, description: tbl.desc, count: r.rows[0]?.cnt ?? 0 });
    } catch {
      tableCounts.push({ table: tbl.name, description: tbl.desc, count: 0 });
    }
  }

  const cpus = os.cpus();
  const envInfo = {
    os: `${os.type()} ${os.release()} (${os.arch()})`,
    cpu: cpus[0]?.model ? cpus[0].model.trim() : 'x64 Processor',
    cpuCores: cpus.length,
    totalRamGb: Number((os.totalmem() / (1024 ** 3)).toFixed(1)),
    nodeVersion: process.version,
    postgresVersion: (pgVersionRes.rows[0]?.ver || 'PostgreSQL').split(',')[0],
    evaluatedAt: new Date().toISOString(),
  };

  // 2. Thực nghiệm 10 kịch bản Phân loại hồ sơ môi trường
  const classificationCases = [
    {
      id: 'TC-PL-01',
      title: 'Dệt nhuộm công suất lớn (60 triệu m²/năm, có nhuộm/giặt mài)',
      input: { nganh: 'det_nhuom', processStage: 'dyeing_washing', capacity: 60 },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo', valid: true },
    },
    {
      id: 'TC-PL-02',
      title: 'Chỉ dệt may không nhuộm công suất 60 triệu m²/năm',
      input: { nganh: 'det_nhuom', processStage: 'weaving_garment_no_dyeing', capacity: 60 },
      expected: { nhom: 'Nhóm III', hs: 'GPMT', tq: 'cap_so', valid: true },
    },
    {
      id: 'TC-PL-03',
      title: 'Luyện kim từ quặng/phế liệu công suất 0,35 triệu tấn/năm (350.000 tấn/năm)',
      input: { nganh: 'thep', processStage: 'ore_smelting', capacity: 0.35 },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo', valid: true },
    },
    {
      id: 'TC-PL-04',
      title: 'Chỉ cán, kéo thép cơ khí không luyện kim 0,02 triệu tấn/năm (20.000 tấn/năm)',
      input: { nganh: 'thep', processStage: 'rolling_only', capacity: 0.02 },
      expected: { nhom: 'Nhóm III', hs: 'GPMT', tq: 'cap_so', valid: true },
    },
    {
      id: 'TC-PL-05',
      title: 'Chế biến gỗ và dăm gỗ công suất trung bình 60.000 m³/năm',
      input: { nganh: 'che_bien_go', capacity: 60000 },
      expected: { nhom: 'Nhóm II', hs: 'DTM', tq: 'cap_so', valid: true },
    },
    {
      id: 'TC-PL-06',
      title: 'Chế biến gỗ quy mô nhỏ 10.000 m³/năm',
      input: { nganh: 'che_bien_go', capacity: 10000 },
      expected: { nhom: 'Nhóm III', hs: 'GPMT', tq: 'cap_so', valid: true },
    },
    {
      id: 'TC-PL-07',
      title: 'Chăn nuôi gia súc, gia cầm tập trung quy mô lớn 3.500 ĐVVN',
      input: { nganh: 'chan_nuoi', capacity: 3500 },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo', valid: true },
    },
    {
      id: 'TC-PL-08',
      title: 'Trung tâm thương mại, siêu thị, văn phòng quy mô nhỏ 5.000 m² sàn (không phát sinh nước thải phải xử lý)',
      input: { nganh: 'trung_tam_tm', capacity: 5000, noWasteGenerated: true },
      expected: { nhom: 'Nhóm IV', hs: 'DKMT', tq: 'cap_xa', valid: true },
    },
    {
      id: 'TC-PL-09',
      title: 'Dự án Nhóm II có yếu tố nhạy cảm môi trường (đã xác minh máy chủ) -> Nâng lên Nhóm I',
      input: { nganh: 'che_bien_go', capacity: 60000, bao_ton: true },
      serverVerif: {
        verification_status: 'VERIFIED',
        verified_by: 1,
        evidence_ref: 'QĐ-UBND-2026/BTTN',
        declared_details: { insideCoreProtectedZone: true },
      },
      expected: { nhom: 'Nhóm I', hs: 'DTM', tq: 'cap_bo', valid: true },
    },
    {
      id: 'TC-PL-10',
      title: 'Ngành dệt nhuộm nhưng bỏ trống công đoạn sản xuất -> Chặn an toàn (MISSING_PROCESS_STAGE)',
      input: { nganh: 'det_nhuom', processStage: '', capacity: 60 },
      expected: { nhom: null, hs: null, tq: null, valid: false, errorCode: 'MISSING_PROCESS_STAGE' },
    },
  ];

  const classificationResults = [];
  for (const tc of classificationCases) {
    const res = tc.serverVerif
      ? evaluateClassification(tc.input, {
          catalog: loadedCatalog.catalog,
          ruleSource: 'DATABASE',
          serverSensitiveVerification: tc.serverVerif,
        })
      : await evaluateClassificationWithDb(tc.input, { db });

    const pass = tc.expected.valid
      ? res.nhom === tc.expected.nhom && res.hs === tc.expected.hs && res.tq === tc.expected.tq
      : res.nhom === null && res.hs === null && res.errorCode === tc.expected.errorCode;

    classificationResults.push({
      id: tc.id,
      title: tc.title,
      inputSummary: `${tc.input.nganh}${tc.input.processStage ? ` (${tc.input.processStage})` : ''}, Q=${tc.input.capacity}`,
      expected: tc.expected.valid
        ? `${tc.expected.nhom} / ${tc.expected.hs} / ${tc.expected.tq}`
        : `Chặn an toàn (${tc.expected.errorCode})`,
      actual: res.nhom
        ? `${res.nhom} / ${res.hs} / ${res.tq}`
        : `Chặn an toàn (${res.errorCode || res.conclusionStatus})`,
      legalRef: res.ref || res.errorCode || '—',
      passed: pass,
    });
  }

  // 3. Thực nghiệm 6 kịch bản Đối chiếu QCVN
  const qcvnCases = [
    {
      id: 'TC-QC-01',
      title: 'Nước thải công nghiệp QCVN 40:2025 Cột A (F1 ≤ 50 m³/ngày) — Đạt toàn bộ 10 chỉ tiêu bắt buộc',
      run: async () =>
        evaluateQcvnSampleWithDb(
          {
            qcvnId: 'qcvn40_a_f1',
            receivingWaterConfirmed: true,
            measuredValues: {
              Temp: 30,
              pH: 7.2,
              Color: 25,
              BOD5: 18,
              COD: 45,
              TSS: 30,
              NH4N: 2.5,
              TotalN: 12,
              TotalP: 2.5,
              Coliform: 1500,
            },
          },
          { db }
        ),
      expectedPreliminary: 'PASS',
      expectedDbStatus: 'dat',
    },
    {
      id: 'TC-QC-02',
      title: 'Nước thải công nghiệp QCVN 40:2025 Cột A (F1 ≤ 50 m³/ngày) — Vượt ngưỡng COD (140 > 75) & BOD5 (65 > 30)',
      run: async () =>
        evaluateQcvnSampleWithDb(
          {
            qcvnId: 'qcvn40_a_f1',
            receivingWaterConfirmed: true,
            measuredValues: {
              Temp: 31,
              pH: 7.0,
              Color: 30,
              BOD5: 65,
              COD: 140,
              TSS: 35,
              NH4N: 3.0,
              TotalN: 14,
              TotalP: 3.0,
              Coliform: 2000,
            },
          },
          { db }
        ),
      expectedPreliminary: 'FAIL',
      expectedDbStatus: 'vuot_nguong',
    },
    {
      id: 'TC-QC-03',
      title: 'Nước thải công nghiệp QCVN 40:2025 Cột B (F2) — pH nằm ngoài khoảng cho phép (pH=4.2 < 5.5)',
      run: async () =>
        evaluateQcvnSampleWithDb(
          {
            qcvnId: 'qcvn40_b_low',
            receivingWaterConfirmed: true,
            measuredValues: {
              Temp: 30,
              pH: 4.2,
              Color: 50,
              BOD5: 25,
              COD: 70,
              TSS: 50,
              NH4N: 5.0,
              TotalN: 20,
              TotalP: 4.0,
              Coliform: 3000,
            },
          },
          { db }
        ),
      expectedPreliminary: 'FAIL',
      expectedDbStatus: 'vuot_nguong',
    },
    {
      id: 'TC-QC-04',
      title: 'Mẫu nước thải thiếu thông số bắt buộc (chỉ nhập pH và COD) -> Chặn kết luận Đạt (INCOMPLETE)',
      run: async () =>
        evaluateQcvnSampleWithDb(
          {
            qcvnId: 'qcvn40_a_f1',
            receivingWaterConfirmed: true,
            measuredValues: {
              pH: 7.1,
              COD: 30,
            },
          },
          { db }
        ),
      expectedPreliminary: 'INCOMPLETE',
      expectedDbStatus: 'chua_du_thong_so',
    },
    {
      id: 'TC-QC-05',
      title: 'Chọn QCVN nước thải công nghiệp nhưng không nhập lưu lượng xả thải F -> Yêu cầu rà soát (MISSING_FLOW_RATE)',
      run: async () =>
        selectApplicableQcvnWithDb(
          {
            sourceType: 'nuoc_thai_cn',
            receivingWaterClass: 'A',
            receivingWaterConfirmed: true,
            flowRate: null,
          },
          { db }
        ),
      expectedPreliminary: 'NEEDS_REVIEW',
      expectedDbStatus: 'MISSING_FLOW_RATE',
    },
    {
      id: 'TC-QC-06',
      title: 'Không khí xung quanh QCVN 05:2023 (24h) — Sai chu kỳ lấy mẫu SO2 (đo 1h thay vì 24h) -> PERIOD_MISMATCH',
      run: async () =>
        evaluateQcvnSampleWithDb(
          {
            qcvnId: 'qcvn05_24h',
            measuredValues: {
              SO2: 80,
              NO2: 60,
              TSP: 120,
              PM10: 60,
              PM25: 25,
            },
            samplingPeriods: { SO2: '1h' },
          },
          { db }
        ),
      expectedPreliminary: 'NEEDS_REVIEW',
      expectedDbStatus: 'PERIOD_MISMATCH',
    },
  ];

  const qcvnResults = [];
  for (const qc of qcvnCases) {
    const res = await qc.run();
    const actualPrimary = res.preliminaryStatus || res.status || res.overallStatus;
    const actualDetail = res.reason || res.trang_thai_tong_quat || '—';
    const pass =
      actualPrimary === qc.expectedPreliminary &&
      (res.trang_thai_tong_quat === qc.expectedDbStatus || res.reason === qc.expectedDbStatus);
    qcvnResults.push({
      id: qc.id,
      title: qc.title,
      expectedStatus: `${qc.expectedPreliminary} (${qc.expectedDbStatus})`,
      actualStatus: `${actualPrimary} (${actualDetail})`,
      passed: pass,
    });
  }

  // 4. Thực nghiệm Không gian GIS & Nhắc hạn nghĩa vụ
  const gisNearCanGio = await analyzeSpatialContextWithDb(10.5214, 106.8856, { db });
  const gisInHcmKcn = await analyzeSpatialContextWithDb(10.7540, 106.7420, { db });
  const reminderOverdue = computeDeadlineStatus(
    { due_date: '2026-01-01', warning_days: 15, status: 'chua_hoan_thanh' },
    new Date('2026-06-01')
  );
  const reminderNextPeriod = computeNextDueDate('2026-06-30', 'hang_quy');

  const gisAndReminderResults = [
    {
      id: 'TC-GIS-01',
      title: 'Phân tích tọa độ nằm trong vùng lõi Khu Dự trữ Sinh quyển Cần Giờ (10.5214, 106.8856)',
      expected: 'Phát hiện vùng nhạy cảm môi trường (bao_ton = true)',
      actual:
        gisNearCanGio.detectedSensitiveZones?.length > 0
          ? `Phát hiện ${gisNearCanGio.detectedSensitiveZones[0].name} (cách tâm ${gisNearCanGio.detectedSensitiveZones[0].distanceKm} km, bao_ton=${Boolean(gisNearCanGio.autoFlags?.bao_ton)})`
          : 'Không phát hiện',
      passed: Boolean(gisNearCanGio.autoFlags?.bao_ton && gisNearCanGio.detectedSensitiveZones?.length > 0),
    },
    {
      id: 'TC-GIS-02',
      title: 'Phân tích tọa độ tại KCN Tân Thuận, TP.HCM (10.7540, 106.7420) kèm tính khoảng cách đường bờ biển/biên giới',
      expected: 'Trả kết quả phân tích không gian hợp lệ từ CSDL (gisSource = DATABASE)',
      actual: `gisSource=${gisInHcmKcn.gisSource}, cách biên giới ${gisInHcmKcn.borderDistanceKm} km, cách bờ biển ${gisInHcmKcn.coastDistanceKm} km`,
      passed: gisInHcmKcn.gisSource === 'DATABASE' && Number.isFinite(gisInHcmKcn.borderDistanceKm),
    },
    {
      id: 'TC-RM-01',
      title: 'Phân loại trạng thái cảnh báo nghĩa vụ đã quá hạn nộp báo cáo (hạn 2026-01-01, đối chiếu 2026-06-01)',
      expected: 'muc_canh_bao = qua_han',
      actual: `muc_canh_bao = ${reminderOverdue.muc_canh_bao} (${reminderOverdue.nhan_trang_thai})`,
      passed: reminderOverdue.muc_canh_bao === 'qua_han',
    },
    {
      id: 'TC-RM-02',
      title: 'Tự động tính ngày đến hạn kỳ tiếp theo cho chu kỳ hằng quý (từ 2026-06-30)',
      expected: '2026-09-30',
      actual: reminderNextPeriod,
      passed: reminderNextPeriod === '2026-09-30',
    },
  ];

  // 5. Khởi chạy Express Server tạm thời để đo Hiệu năng (Benchmark) & Kiểm thử Bảo mật (Security)
  const app = createTestExpressApp();
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const adminToken = jwt.sign(
    { id: 1, username: 'admin', fullName: 'Quản trị viên', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const staffToken = jwt.sign(
    { id: 2, username: 'staff', fullName: 'Chuyên viên', role: 'staff' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const adminHeaders = { Cookie: `${COOKIE_NAME}=${adminToken}`, 'Content-Type': 'application/json' };
  const staffHeaders = { Cookie: `${COOKIE_NAME}=${staffToken}`, 'Content-Type': 'application/json' };

  const benchmarks = [];
  const securityResults = [];

  try {
    // 5A. Đo hiệu năng 8 API trọng tâm (20 lần gọi liên tiếp mỗi API)
    benchmarks.push(
      await measureEndpoint('GET /api/laws/active-basis (Chuẩn pháp lý động)', 'GET', `${baseUrl}/api/laws/active-basis`, {}, 20)
    );
    benchmarks.push(
      await measureEndpoint('GET /api/laws (Danh sách 140 văn bản pháp luật)', 'GET', `${baseUrl}/api/laws`, {}, 20)
    );
    benchmarks.push(
      await measureEndpoint(
        'GET /api/classification/metadata (Danh mục 39 ngành & ngưỡng)',
        'GET',
        `${baseUrl}/api/classification/metadata`,
        {},
        20
      )
    );
    benchmarks.push(
      await measureEndpoint(
        'POST /api/classification/evaluate (Suy diễn phân loại hồ sơ)',
        'POST',
        `${baseUrl}/api/classification/evaluate`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nganh: 'det_nhuom', processStage: 'dyeing_washing', capacity: 60 }),
        },
        20
      )
    );
    benchmarks.push(
      await measureEndpoint(
        'POST /api/qcvns/evaluate (Đối chiếu mẫu quan trắc QCVN)',
        'POST',
        `${baseUrl}/api/qcvns/evaluate`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qcvnId: 'qcvn40_a_f1',
            receivingWaterConfirmed: true,
            measuredValues: {
              Temp: 30,
              pH: 7.2,
              Color: 25,
              BOD5: 18,
              COD: 45,
              TSS: 30,
              NH4N: 2.5,
              TotalN: 12,
              TotalP: 2.5,
              Coliform: 1500,
            },
          }),
        },
        20
      )
    );
    benchmarks.push(
      await measureEndpoint(
        'POST /api/classification/spatial-check (Phân tích bán kính GIS 15 km)',
        'POST',
        `${baseUrl}/api/classification/spatial-check`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ latitude: 10.7769, longitude: 106.7009 }),
        },
        20
      )
    );
    benchmarks.push(
      await measureEndpoint(
        'GET /api/dashboard/stats (Tổng hợp thống kê Dashboard)',
        'GET',
        `${baseUrl}/api/dashboard/stats`,
        { headers: adminHeaders },
        20
      )
    );
    benchmarks.push(
      await measureEndpoint(
        'GET /api/admin/audit-logs (Truy vết nhật ký kiểm toán)',
        'GET',
        `${baseUrl}/api/admin/audit-logs`,
        { headers: adminHeaders },
        20
      )
    );

    // 5B. Thực nghiệm 6 kịch bản Bảo mật & Phân quyền
    const sec1Res = await fetch(`${baseUrl}/api/projects`);
    securityResults.push({
      id: 'TC-SEC-01',
      title: 'Truy cập API quản lý dự án khi chưa đăng nhập (không có JWT Cookie)',
      expected: 'HTTP 401 Unauthorized',
      actual: `HTTP ${sec1Res.status}`,
      passed: sec1Res.status === 401,
    });

    const sec2Res = await fetch(`${baseUrl}/api/admin/users`, { headers: staffHeaders });
    securityResults.push({
      id: 'TC-SEC-02',
      title: 'Tài khoản Nhân viên (staff) truy cập trái phép API Quản trị viên (/api/admin/users)',
      expected: 'HTTP 403 Forbidden',
      actual: `HTTP ${sec2Res.status}`,
      passed: sec2Res.status === 403,
    });

    const sec3Res = await fetch(`${baseUrl}/api/admin/audit-logs`, { headers: staffHeaders });
    securityResults.push({
      id: 'TC-SEC-03',
      title: 'Tài khoản Nhân viên (staff) truy cập nhật ký kiểm toán hệ thống (/api/admin/audit-logs)',
      expected: 'HTTP 403 Forbidden',
      actual: `HTTP ${sec3Res.status}`,
      passed: sec3Res.status === 403,
    });

    const sec4Res = await fetch(`${baseUrl}/api/classification/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nganh: 'che_bien_go',
        capacity: 60000,
        bao_ton: true,
        sensitiveCriteriaVerified: true, // Client cố tình giả mạo cờ đã xác minh
      }),
    });
    const sec4Body = await sec4Res.json();
    const sec4Data = sec4Body.result || sec4Body;
    securityResults.push({
      id: 'TC-SEC-04',
      title: 'Chống giả mạo cờ xác minh vùng nhạy cảm từ phía trình duyệt (Client Spoofing)',
      expected: 'Không tự động nâng lên Nhóm I & giữ trạng thái chờ xác minh máy chủ (PENDING_SERVER_VERIFICATION)',
      actual: `nhom=${sec4Data.nhom}, sensitiveVerificationStatus=${sec4Data.sensitiveVerificationStatus}, isOfficial=${sec4Data.isOfficialConclusion}`,
      passed:
        sec4Data.nhom === 'Nhóm II' &&
        sec4Data.sensitiveVerificationStatus === 'PENDING_SERVER_VERIFICATION' &&
        sec4Data.isOfficialConclusion === false,
    });

    const sec5Res = await fetch(`${baseUrl}/api/crawler/run`, { method: 'POST', headers: staffHeaders });
    securityResults.push({
      id: 'TC-SEC-05',
      title: 'Chặn tài khoản không phải Quản trị viên kích hoạt tiến trình Web Crawler (/api/crawler/run)',
      expected: 'HTTP 403 Forbidden',
      actual: `HTTP ${sec5Res.status}`,
      passed: sec5Res.status === 403,
    });

    const sec6Res = await fetch(`${baseUrl}/api/admin/audit-logs?scope=legal`, { headers: adminHeaders });
    const sec6Data = await sec6Res.json();
    securityResults.push({
      id: 'TC-SEC-06',
      title: 'Kiểm chứng tính năng Truy vết lịch sử thao tác văn bản pháp lý (/api/admin/audit-logs?scope=legal)',
      expected: 'HTTP 200 & trả về danh sách bản ghi truy vết hợp lệ',
      actual: `HTTP ${sec6Res.status} (${Array.isArray(sec6Data.logs) ? sec6Data.logs.length : 0} bản ghi truy vết)`,
      passed: sec6Res.status === 200 && Array.isArray(sec6Data.logs),
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  // 6. Thực nghiệm 6 kịch bản Biên & Cổng an toàn pháp lý (Boundary & Fail-Closed)
  const boundaryCases = [
    {
      id: 'TC-BD-01',
      input: 'Mã ngành không tồn tại trong CSDL (dien_hat_nhan)',
      run: async () => evaluateClassificationWithDb({ nganh: 'dien_hat_nhan', capacity: 100 }, { db }),
      check: r => r.conclusionStatus === 'NEEDS_REVIEW' && r.hs === null && r.nhom === null && r.errorCode === 'UNKNOWN_INDUSTRY',
      actualText: r => `conclusionStatus=${r.conclusionStatus}, hs=${r.hs}, errorCode=${r.errorCode}`,
    },
    {
      id: 'TC-BD-02',
      input: 'Công suất nhập giá trị âm (capacity = -50)',
      run: async () => evaluateClassificationWithDb({ nganh: 'che_bien_go', capacity: -50 }, { db }),
      check: r => r.conclusionStatus === 'NEEDS_REVIEW' && r.errorCode === 'INVALID_CAPACITY',
      actualText: r => `conclusionStatus=${r.conclusionStatus}, errorCode=${r.errorCode}`,
    },
    {
      id: 'TC-BD-03',
      input: 'Công suất nhập chuỗi không hợp lệ (capacity = "abc")',
      run: async () => evaluateClassificationWithDb({ nganh: 'che_bien_go', capacity: 'abc' }, { db }),
      check: r => r.conclusionStatus === 'NEEDS_REVIEW' && r.errorCode === 'INVALID_CAPACITY',
      actualText: r => `conclusionStatus=${r.conclusionStatus}, errorCode=${r.errorCode}`,
    },
    {
      id: 'TC-BD-04',
      input: 'Ngành có phân nhánh công đoạn nhưng truyền sai mã công đoạn (cong_doan_ao)',
      run: async () => evaluateClassificationWithDb({ nganh: 'thep', processStage: 'cong_doan_ao', capacity: 0.5 }, { db }),
      check: r => r.conclusionStatus === 'NEEDS_REVIEW' && r.errorCode === 'INVALID_PROCESS_STAGE',
      actualText: r => `conclusionStatus=${r.conclusionStatus}, errorCode=${r.errorCode}`,
    },
    {
      id: 'TC-BD-05',
      input: 'Đối chiếu nước thải nhưng chưa xác nhận nguồn tiếp nhận (receivingWaterConfirmed = false)',
      run: async () =>
        evaluateQcvnSampleWithDb(
          { qcvnId: 'qcvn40_b_low', receivingWaterConfirmed: false, measuredValues: { pH: 7 } },
          { db }
        ),
      check: r => r.overallStatus === 'NEEDS_REVIEW' && r.reason === 'MISSING_RECEIVING_SOURCE',
      actualText: r => `overallStatus=${r.overallStatus}, reason=${r.reason}`,
    },
    {
      id: 'TC-BD-06',
      input: 'Cơ sở chuyển tiếp áp dụng QCVN 40:2011 chưa có bảng giới hạn xác minh trong CSDL',
      run: async () =>
        selectApplicableQcvnWithDb(
          {
            sourceType: 'nuoc_thai_cn',
            receivingWaterClass: 'A',
            receivingWaterConfirmed: true,
            flowRate: 50,
            isExistingFacility: true,
            evaluationDate: '2026-06-01',
          },
          { db }
        ),
      check: r => r.status === 'NEEDS_REVIEW' && r.reason === 'TRANSITION_TABLE_NOT_AVAILABLE',
      actualText: r => `status=${r.status}, reason=${r.reason}`,
    },
  ];

  const boundaryResults = [];
  for (const bc of boundaryCases) {
    const r = await bc.run();
    const ok = bc.check(r);
    boundaryResults.push({
      id: bc.id,
      input: bc.input,
      expected: 'Chặn kết luận tự động & chuyển trạng thái Cần rà soát (NEEDS_REVIEW)',
      actual: bc.actualText(r),
      passed: ok,
    });
  }

  const summary = {
    environment: envInfo,
    databaseTables: tableCounts,
    functionalClassification: classificationResults,
    functionalQcvn: qcvnResults,
    functionalGisAndReminder: gisAndReminderResults,
    performanceBenchmarks: benchmarks,
    securityTests: securityResults,
    boundaryTests: boundaryResults,
  };

  const jsonPath = path.join(EVIDENCE_DIR, 'chapter3-empirical-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(`✔ Đã lưu dữ liệu thực nghiệm JSON: ${jsonPath}`);

  const allCases = [
    ...classificationResults,
    ...qcvnResults,
    ...gisAndReminderResults,
    ...securityResults,
    ...boundaryResults,
  ];
  const passedCount = allCases.filter(c => c.passed).length;
  console.log(`✔ Tổng kết kịch bản thực nghiệm: ${passedCount}/${allCases.length} đạt (PASS)`);

  await db.pool.end();
}

runEvaluation().catch(err => {
  console.error('Lỗi thực nghiệm Chương 3:', err);
  process.exit(1);
});
