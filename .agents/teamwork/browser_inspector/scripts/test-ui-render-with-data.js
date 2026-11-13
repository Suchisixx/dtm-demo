const path = require('path');
const rootDir = process.cwd();
const backendDir = path.resolve(rootDir, 'backend');
const express = require(path.join(backendDir, 'node_modules/express'));
const cookieParser = require(path.join(backendDir, 'node_modules/cookie-parser'));
const jwt = require(path.join(backendDir, 'node_modules/jsonwebtoken'));
const { chromium } = require('playwright');
const fs = require('fs');

const JWT_SECRET = 'fd3f6ddc43d653c0518deb80938d694e9cf7349fc3eebe3bc72051d4ef11960d';
const PORT = 5035;
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

// Realistic Mock Datasets
const MOCK_PROJECTS = [
  {
    id: 1,
    name: 'Khu công nghiệp VSIP I Bình Dương',
    nganh: 'kcn',
    capacity: 500,
    unit: 'ha',
    nhom_du_an: 'Nhóm I',
    loai_ho_so: 'ĐTM',
    tham_quyen: 'cap_bo',
    tinh: 'Bình Dương',
    latitude: 10.931,
    longitude: 106.716,
    quan_trac_gan_nhat_trang_thai: 'dat',
    created_at: '2026-02-15T08:00:00Z'
  },
  {
    id: 2,
    name: 'Nhà máy Nhiệt điện Duyên Hải 1',
    nganh: 'nhiet_dien',
    processStage: 'than',
    capacity: 1200,
    unit: 'MW',
    nhom_du_an: 'Nhóm I',
    loai_ho_so: 'GPMT',
    tham_quyen: 'cap_bo',
    tinh: 'Trà Vinh',
    latitude: 9.612,
    longitude: 106.521,
    quan_trac_gan_nhat_trang_thai: 'vuot',
    created_at: '2026-03-01T09:30:00Z'
  },
  {
    id: 3,
    name: 'Nhà máy Thép Pomina 2',
    nganh: 'thep',
    processStage: 'luyen_thep',
    capacity: 500000,
    unit: 'tấn/năm',
    nhom_du_an: 'Nhóm II',
    loai_ho_so: 'GPMT',
    tham_quyen: 'cap_so',
    tinh: 'Bà Rịa - Vũng Tàu',
    latitude: 10.531,
    longitude: 107.031,
    quan_trac_gan_nhat_trang_thai: 'dat',
    created_at: '2026-03-10T14:15:00Z'
  }
];

const MOCK_DASHBOARD_STATS = {
  kpis: {
    totalProjects: 48,
    highRiskProjects: 14,
    gisMappedProjects: 45,
    monitoredProjects: 38,
    avgChecklistPercent: 88,
    completedChecklistProjects: 32,
    totalSamples: 156,
    linkedSamples: 142,
    passSamples: 128,
    warnSamples: 12,
    failSamples: 16,
    incompleteSamples: 0,
    needsReviewSamples: 0,
    needsReviewProjects: 3,
    unverifiedProjects: 0,
    complianceRate: 82.1,
    totalLaws: 124,
    validLaws: 110,
    amendedLaws: 14,
    quaHanCount: 3,
    sapDenHanCount: 5,
    trongHanCount: 28,
    daHoanThanhCount: 42
  },
  distributions: {
    byGroup: { 'Nhóm I': 14, 'Nhóm II': 18, 'Nhóm III': 12, 'Nhóm IV': 4, 'Cần rà soát': 0 },
    byDossier: { DTM: 22, GPMT: 18, DKMT: 8 },
    byAuthority: { cap_bo: 14, cap_so: 22, cap_xa: 8, cap_huyen: 4, chua_xac_dinh: 0 },
    byQcvnType: [
      { type: 'nuoc_mat', count: 45, label: 'Nước mặt' },
      { type: 'nuoc_thai_cn', count: 62, label: 'Nước thải CN' },
      { type: 'khi_thai_cn', count: 49, label: 'Khí thải CN' }
    ],
    topIndustries: [
      { name: 'Sản xuất thép', count: 12 },
      { name: 'Nhiệt điện than', count: 8 },
      { name: 'Dệt nhuộm', count: 7 },
      { name: 'Khu công nghiệp', count: 6 }
    ],
    topProvinces: [
      { province: 'TP. Hồ Chí Minh', count: 15 },
      { province: 'Bình Dương', count: 12 },
      { province: 'Đồng Nai', count: 9 },
      { province: 'Bà Rịa - Vũng Tàu', count: 6 }
    ]
  },
  environmentalLoad: {
    totalWastewater: 45000,
    totalAirEmission: 120000,
    projectsWithWastewater: 35,
    projectsWithAirEmission: 28,
    sensitiveCounts: {
      rung: 4,
      lua: 8,
      bg: 2,
      bao_ton: 3,
      di_san: 1,
      ven_bien: 6,
      nguon_nc: 5,
      dat_ngap: 2
    }
  }
};

const MOCK_LAWS = [
  {
    id: 'luat_bvmt_2020',
    code: '72/2020/QH14',
    title: 'Luật Bảo vệ Môi trường 2020',
    type: 'luat',
    issue_date: '2020-11-17',
    effective_date: '2022-01-01',
    status: 'hieu_luc',
    signer: 'Nguyễn Thị Kim Ngân',
    organ: 'Quốc hội'
  },
  {
    id: 'nd_08_2022',
    code: '08/2022/NĐ-CP',
    title: 'Nghị định 08/2022/NĐ-CP Quy định chi tiết một số điều của Luật BVMT',
    type: 'nghi_dinh',
    issue_date: '2022-01-10',
    effective_date: '2022-01-10',
    status: 'hieu_luc',
    signer: 'Phạm Minh Chính',
    organ: 'Chính phủ'
  },
  {
    id: 'qcvn_40_2025',
    code: 'QCVN 40:2025/BTNMT',
    title: 'Quy chuẩn kỹ thuật quốc gia về nước thải công nghiệp',
    type: 'thong_tu',
    issue_date: '2025-06-30',
    effective_date: '2025-07-01',
    status: 'hieu_luc',
    signer: 'Bộ trưởng Bộ TN&MT',
    organ: 'Bộ Tài nguyên và Môi trường'
  }
];

const MOCK_CRAWLER_HISTORY = [
  {
    id: 1,
    start_time: '2026-11-01T00:00:00Z',
    end_time: '2026-11-01T00:05:22Z',
    status: 'SUCCESS',
    documents_scanned: 154,
    documents_updated: 3,
    documents_expired: 1,
    source: 'thuvienphapluat.vn',
    details: 'Đã quét đồng bộ tự động theo chu kỳ tháng 11/2026'
  },
  {
    id: 2,
    start_time: '2026-10-01T00:00:00Z',
    end_time: '2026-10-01T00:04:45Z',
    status: 'SUCCESS',
    documents_scanned: 148,
    documents_updated: 0,
    documents_expired: 0,
    source: 'thuvienphapluat.vn',
    details: 'Không có văn bản mới hoặc sửa đổi'
  }
];

async function runDataInspection() {
  console.log('=== RUNNING UI INSPECTION WITH POPULATED DATA ===');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(path.join(backendDir, 'public')));

  // Auth mock
  app.use('/api/auth', require(path.join(backendDir, 'routes/auth')));

  // Populated mock endpoints
  app.get('/api/projects', (req, res) => {
    res.json({
      success: true,
      data: MOCK_PROJECTS,
      projects: MOCK_PROJECTS,
      total: MOCK_PROJECTS.length,
      page: 1,
      totalPages: 1
    });
  });

  app.get('/api/projects/geo', (req, res) => {
    res.json({
      success: true,
      data: MOCK_PROJECTS
    });
  });

  app.get('/api/dashboard/stats', (req, res) => {
    res.json({
      success: true,
      stats: MOCK_DASHBOARD_STATS,
      ...MOCK_DASHBOARD_STATS
    });
  });

  app.get('/api/laws', (req, res) => {
    res.json({
      success: true,
      data: MOCK_LAWS,
      laws: MOCK_LAWS,
      total: MOCK_LAWS.length
    });
  });

  app.get('/api/crawler/settings', (req, res) => {
    res.json({
      success: true,
      auto_crawl_enabled: true,
      schedule: '0 0 1 * *',
      last_run: '2026-11-01T00:00:00Z',
      next_run: '2026-12-01T00:00:00Z'
    });
  });

  app.get('/api/crawler/history', (req, res) => {
    res.json({
      success: true,
      data: MOCK_CRAWLER_HISTORY,
      history: MOCK_CRAWLER_HISTORY
    });
  });

  app.get('/api/reminders', (req, res) => {
    res.json({
      success: true,
      obligations: [
        {
          id: 1,
          project_id: 1,
          project_name: 'Khu công nghiệp VSIP I Bình Dương',
          title: 'Nộp báo cáo công tác bảo vệ môi trường định kỳ 2026',
          due_date: '2026-12-15',
          status: 'trong_han',
          deadline_status: 'trong_han',
          recurrence: 'hang_nam',
          legal_basis: 'Điều 119 Luật BVMT 2020'
        },
        {
          id: 2,
          project_id: 2,
          project_name: 'Nhà máy Nhiệt điện Duyên Hải 1',
          title: 'Quan trắc khí thải định kỳ Quý 4/2026',
          due_date: '2026-10-31',
          status: 'qua_han',
          deadline_status: 'qua_han',
          recurrence: 'hang_quy',
          legal_basis: 'Điều 97 Nghị định 08/2022/NĐ-CP'
        }
      ]
    });
  });

  // Standard routes for classification & qcvn
  app.use('/api/classification', require(path.join(backendDir, 'routes/classification')));
  app.use('/api/industries', (req, res, next) => {
    req.url = '/industries' + (req.url === '/' ? '' : req.url);
    return require(path.join(backendDir, 'routes/classification'))(req, res, next);
  });
  app.use('/api/qcvns', require(path.join(backendDir, 'routes/qcvns')));
  app.use('/api/admin', require(path.join(backendDir, 'routes/admin')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(backendDir, 'public/index.html'));
  });

  const server = app.listen(PORT, '127.0.0.1');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  const adminToken = jwt.sign(
    { id: 1, username: 'admin', fullName: 'Quản trị viên', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  await context.addCookies([
    { name: 'token', value: adminToken, domain: '127.0.0.1', path: '/' }
  ]);

  const page = await context.newPage();

  const findings = {
    dashboardVisuals: {},
    mapVisuals: {},
    crawlerVisuals: {},
    lawsVisuals: {},
    responsiveVisuals: {}
  };

  try {
    // 1. Dashboard with full data
    console.log('--- 1. Testing Dashboard with Full Data ---');
    await page.goto(`http://127.0.0.1:${PORT}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const kpiCards = page.locator('.kpi-card');
    const count = await kpiCards.count();
    console.log(`   - KPI Cards rendered: ${count}`);
    for (let i = 0; i < count; i++) {
      const text = await kpiCards.nth(i).innerText();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      console.log(`     * KPI ${i + 1}: ${lines.join(' | ')}`);
    }

    // Reminders
    const reminderItems = page.locator('.reminder-item, .obligation-row, tr:has-text("Khu công nghiệp")');
    console.log(`   - Compliance reminder rows rendered: ${await reminderItems.count()}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'populated_dashboard.png'), fullPage: true });

    // 2. Map with projects
    console.log('\n--- 2. Testing Map with 3 Geo Projects ---');
    await page.goto(`http://127.0.0.1:${PORT}/map`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const mapCards = page.locator('.project-card, .map-project-item, .list-item');
    console.log(`   - Projects listed in Map sidebar: ${await mapCards.count()}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'populated_map.png'), fullPage: true });

    // 3. Laws Tab with data
    console.log('\n--- 3. Testing Laws Tab with 3 Documents ---');
    await page.goto(`http://127.0.0.1:${PORT}/laws`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const lawsList = page.locator('.law-card, .law-row, tr:has-text("Luật")');
    console.log(`   - Laws rendered count: ${await lawsList.count()}`);

    // Test law search filter
    const searchInput = page.locator('input[type="text"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('08/2022');
      await page.waitForTimeout(500);
      const filteredLaws = page.locator('.law-card, .law-row, tr:has-text("Nghị định 08")');
      console.log(`   - Filtered laws for '08/2022': ${await filteredLaws.count()}`);
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'populated_laws.png'), fullPage: true });

    // 4. Admin Crawler with data
    console.log('\n--- 4. Testing Admin Crawler with History ---');
    await page.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const crawlerBtn = page.locator('button.admin-tab-btn').filter({ hasText: /crawler/i }).first();
    if (await crawlerBtn.count() > 0) {
      await crawlerBtn.click();
      await page.waitForTimeout(800);

      const historyRows = page.locator('table tbody tr');
      console.log(`   - Crawler history table rows rendered: ${await historyRows.count()}`);

      const autoCrawlSwitch = page.locator('input[type="checkbox"]#auto-crawl, .toggle-switch input');
      console.log('   - Auto crawl switch present:', await autoCrawlSwitch.count() > 0);
      if (await autoCrawlSwitch.count() > 0) {
        console.log('   - Auto crawl switch checked state:', await autoCrawlSwitch.isChecked());
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'populated_crawler.png'), fullPage: true });

    // 5. Test Responsive behavior across populated pages
    console.log('\n--- 5. Checking Responsive Layout on Populated Dashboard (Mobile 375px) ---');
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`http://127.0.0.1:${PORT}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const mobileOverflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }));
    console.log(`   - Dashboard Mobile 375px: scrollWidth=${mobileOverflow.scrollWidth}, clientWidth=${mobileOverflow.clientWidth}, overflow=${mobileOverflow.overflow}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'populated_dashboard_mobile_375.png') });

  } catch (err) {
    console.error('Data inspection error:', err);
  } finally {
    await browser.close();
    server.close();
    console.log('\n=== COMPLETED POPULATED DATA INSPECTION ===\n');
  }
}

runDataInspection();
