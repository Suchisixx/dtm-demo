const path = require('path');
const rootDir = process.cwd();
const backendDir = path.resolve(rootDir, 'backend');
const express = require(path.join(backendDir, 'node_modules/express'));
const cookieParser = require(path.join(backendDir, 'node_modules/cookie-parser'));
const jwt = require(path.join(backendDir, 'node_modules/jsonwebtoken'));
const { chromium } = require('playwright');
const fs = require('fs');

const JWT_SECRET = 'fd3f6ddc43d653c0518deb80938d694e9cf7349fc3eebe3bc72051d4ef11960d';
const PORT = 5025;
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

// Ensure screenshots dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const auditFindings = {
  consoleErrors: [],
  pageErrors: [],
  networkFailures: [],
  networkResponses: [],
  layoutIssues: [],
  interactionIssues: [],
  parityIssues: [],
  tabResults: {}
};

async function main() {
  console.log('=================================================================');
  console.log('   LEGALHUB BROWSER UI & E2E INTERACTION INSPECTION SUITE       ');
  console.log('=================================================================');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Static files from backend/public
  app.use(express.static(path.join(backendDir, 'public')));

  // Routes
  app.use('/api/auth', require(path.join(backendDir, 'routes/auth')));
  app.use('/api/projects', require(path.join(backendDir, 'routes/projects')));
  app.use('/api/classification', require(path.join(backendDir, 'routes/classification')));
  app.use('/api/industries', (req, res, next) => {
    req.url = '/industries' + (req.url === '/' ? '' : req.url);
    return require(path.join(backendDir, 'routes/classification'))(req, res, next);
  });
  app.use('/api/admin/rules', require(path.join(backendDir, 'routes/admin-rules')));
  app.use('/api/admin', require(path.join(backendDir, 'routes/admin')));
  app.use('/api/laws', require(path.join(backendDir, 'routes/laws')));
  app.use('/api/qcvns', require(path.join(backendDir, 'routes/qcvns')));
  app.use('/api/crawler', require(path.join(backendDir, 'routes/crawler')));
  app.use('/api/dashboard', require(path.join(backendDir, 'routes/dashboard')));
  app.use('/api/reminders', require(path.join(backendDir, 'routes/reminders')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(backendDir, 'public/index.html'));
  });

  const server = app.listen(PORT, '127.0.0.1');
  console.log(`[INFO] Test server running on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN'
  });

  const page = await context.newPage();

  // Listeners
  page.on('console', msg => {
    const item = { type: msg.type(), text: msg.text(), location: msg.location() };
    if (msg.type() === 'error') {
      auditFindings.consoleErrors.push(item);
      console.log(`[CONSOLE ERROR] [${msg.location()?.url}:${msg.location()?.lineNumber}]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    auditFindings.pageErrors.push({ message: err.message, stack: err.stack });
    console.log(`[PAGE UNCAUGHT ERROR]: ${err.message}`);
  });

  page.on('requestfailed', req => {
    auditFindings.networkFailures.push({
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText
    });
    console.log(`[NET FAILURE]: ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
  });

  page.on('response', resp => {
    const status = resp.status();
    const url = resp.url();
    if (status >= 400 && !url.includes('google') && !url.includes('unpkg') && !url.includes('jsdelivr')) {
      auditFindings.networkResponses.push({ url, status, statusText: resp.statusText() });
      console.log(`[NET ERROR RESPONSE]: ${status} ${url}`);
    }
  });

  try {
    // =========================================================================
    // STEP 1: Unauthenticated Navigation & AuthModal Inspection
    // =========================================================================
    console.log('\n>>> STEP 1: Inspecting Unauthenticated State & AuthModal...');
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1_landing_laws.png'), fullPage: true });

    // Click Classify link in sidebar
    const classifyLink = page.locator('a.sidebar-link[href="/classify"]');
    if (await classifyLink.count() > 0) {
      await classifyLink.click();
      await page.waitForTimeout(800);

      // Verify AuthModal
      const authModal = page.locator('.modal-overlay');
      const isModalVisible = await authModal.isVisible();
      console.log('   - AuthModal visible on private tab click:', isModalVisible);

      if (isModalVisible) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step1_auth_modal_open.png') });

        // Test empty login submit
        const submitBtn = authModal.locator('button[type="submit"]');
        await submitBtn.click();
        await page.waitForTimeout(500);

        const errorMsgEl = authModal.locator('.auth-error, [style*="color:#DC2626"], [style*="color: rgb(220, 38, 38)"], p:has-text("chính xác"), p:has-text("lỗi")');
        const errorText = await errorMsgEl.textContent().catch(() => '');
        console.log('   - Empty login validation message:', errorText || '(No error text element found)');

        // Test wrong credentials
        await authModal.locator('input[type="text"]').fill('wronguser');
        await authModal.locator('input[type="password"]').fill('wrongpassword');
        await submitBtn.click();
        await page.waitForTimeout(800);
        const wrongCredMsg = await authModal.locator('p, div, span').filter({ hasText: /không chính xác|không đúng|lỗi/i }).first().textContent().catch(() => '');
        console.log('   - Wrong credentials feedback:', wrongCredMsg);

        // Close modal
        const closeBtn = authModal.locator('button.modal-close, button:has-text("✕"), button[title="Đóng"]');
        if (await closeBtn.count() > 0) {
          await closeBtn.click();
        } else {
          // Click overlay backdrop to close
          await page.mouse.click(50, 50);
        }
        await page.waitForTimeout(500);
      } else {
        auditFindings.interactionIssues.push({
          step: 'Step 1 AuthModal',
          issue: 'Clicking private tab /classify did not open AuthModal overlay'
        });
      }
    }

    // =========================================================================
    // STEP 2: Authenticate as Admin & Verify Tab Navigation
    // =========================================================================
    console.log('\n>>> STEP 2: Authenticating as Admin & Testing Tab Switching...');
    const adminToken = jwt.sign(
      { id: 1, username: 'admin', fullName: 'Quản trị viên', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    await context.addCookies([
      { name: 'token', value: adminToken, domain: '127.0.0.1', path: '/' }
    ]);

    // Reload with auth
    await page.goto(`http://127.0.0.1:${PORT}/classify`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log('   - Logged-in URL:', page.url());

    // Verify user profile badge in header
    const userBadge = page.locator('.user-profile, .user-badge, .header-user, [title*="admin"], [title*="Quản trị"]');
    const badgeCount = await userBadge.count();
    console.log('   - User badge elements found in header:', badgeCount);

    // =========================================================================
    // STEP 3: ClassifyTab (Phân loại hồ sơ môi trường) Deep Inspection
    // =========================================================================
    console.log('\n>>> STEP 3: Inspecting ClassifyTab (Phân loại hồ sơ)...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_classify_initial.png'), fullPage: true });

    // 3.1 Industry Dropdown & Options
    console.log('   3.1 Inspecting Industry Selection...');
    const industrySelect = page.locator('select#nganh, select[name="nganh"], .custom-select, input[placeholder*="ngành"]').first();
    const isIndustryVisible = await industrySelect.isVisible();
    console.log('   - Industry input visible:', isIndustryVisible);

    // Inspect options inside industry select
    let options = [];
    if (await page.locator('select#nganh option, select[name="nganh"] option').count() > 0) {
      options = await page.locator('select#nganh option, select[name="nganh"] option').allTextContents();
      console.log(`   - Total industry options in <select>: ${options.length}`);
    } else {
      // Check if SearchableSelect is used
      const customSelectBtn = page.locator('.searchable-select, .select-trigger, button:has-text("Chọn ngành")').first();
      if (await customSelectBtn.count() > 0) {
        console.log('   - Custom SearchableSelect detected.');
        await customSelectBtn.click();
        await page.waitForTimeout(500);
        const listItems = await page.locator('.select-dropdown li, .select-options div').allTextContents();
        console.log(`   - Custom select options count: ${listItems.length}`);
        await customSelectBtn.click(); // close dropdown
      }
    }

    // 3.2 Testing Process Stages for 6 Specialized Industries
    console.log('   3.2 Testing Process Stages for 6 Specialized Industries...');
    const testIndustriesWithStages = [
      { code: 'thep', label: 'Thép', expectedStageSnippet: 'luyện' },
      { code: 'nhiet_dien', label: 'Nhiệt điện', expectedStageSnippet: 'than' },
      { code: 'hoa_chat', label: 'Hóa chất', expectedStageSnippet: 'cơ bản' },
      { code: 'giay_bot', label: 'Giấy', expectedStageSnippet: 'bột' },
      { code: 'det_nhuom', label: 'Dệt nhuộm', expectedStageSnippet: 'nhuộm' },
      { code: 'dien_tu', label: 'Điện tử', expectedStageSnippet: 'linh kiện' }
    ];

    for (const ind of testIndustriesWithStages) {
      // Try selecting via native select or SearchableSelect
      try {
        const selectEl = page.locator('select#nganh, select[name="nganh"]').first();
        if (await selectEl.count() > 0) {
          await selectEl.selectOption({ value: ind.code });
        } else {
          // Use SearchableSelect
          const trigger = page.locator('.searchable-select-trigger, .select-trigger, button[id*="nganh"]').first();
          if (await trigger.count() > 0) {
            await trigger.click();
            await page.waitForTimeout(300);
            const opt = page.locator('.select-option, li').filter({ hasText: new RegExp(ind.label, 'i') }).first();
            if (await opt.count() > 0) {
              await opt.click();
            }
          }
        }
        await page.waitForTimeout(500);

        // Check if processStage select appears
        const stageSelect = page.locator('select#processStage, select[name="processStage"], select:has-option("Luyện thép")').first();
        const stageVisible = await stageSelect.count() > 0 && await stageSelect.isVisible();
        console.log(`     * Industry '${ind.code}' -> Process stage select visible: ${stageVisible}`);
        if (stageVisible) {
          const stageOptions = await stageSelect.locator('option').allTextContents();
          console.log(`       Options for ${ind.code}:`, stageOptions.join(' | '));
        } else {
          auditFindings.interactionIssues.push({
            step: 'ClassifyTab ProcessStage',
            industry: ind.code,
            issue: `Process stage select did not appear when industry '${ind.code}' was selected.`
          });
        }
      } catch (e) {
        console.log(`     * Error testing industry ${ind.code}:`, e.message);
      }
    }

    // 3.3 Test Industry WITHOUT process stages
    console.log('   3.3 Testing Industry WITHOUT process stages (e.g. khai_khoang)...');
    try {
      const selectEl = page.locator('select#nganh, select[name="nganh"]').first();
      if (await selectEl.count() > 0) {
        await selectEl.selectOption({ value: 'khai_khoang' });
        await page.waitForTimeout(400);
        const stageSelect = page.locator('select#processStage, select[name="processStage"]').first();
        const isStageHidden = (await stageSelect.count() === 0) || !(await stageSelect.isVisible());
        console.log(`     * Industry 'khai_khoang' -> Process stage hidden: ${isStageHidden}`);
      }
    } catch (e) {
      console.log('     * Error:', e.message);
    }

    // 3.4 Form Submission & Fail-Closed Gate Checks
    console.log('   3.4 Testing Form Submission & Evaluation Result Display...');
    // Fill Project Name
    const nameInput = page.locator('input#ten_du_an, input[name="ten_du_an"], input[placeholder*="tên dự án"], input[placeholder*="Tên dự án"]').first();
    if (await nameInput.count() > 0) {
      await nameInput.fill('Nhà máy Thép Hòa Phát Dung Quất Mở Rộng');
    }

    // Select 'thep' and stage 'luyen_thep'
    const selectEl = page.locator('select#nganh, select[name="nganh"]').first();
    if (await selectEl.count() > 0) {
      await selectEl.selectOption({ value: 'thep' });
      await page.waitForTimeout(400);
      const stageSelect = page.locator('select#processStage, select[name="processStage"]').first();
      if (await stageSelect.count() > 0) {
        await stageSelect.selectOption({ index: 1 }); // first valid stage
      }
    }

    // Capacity input
    const capacityInput = page.locator('input#capacity, input[name="capacity"], input[type="number"]').first();
    if (await capacityInput.count() > 0) {
      // First test invalid capacity (negative)
      await capacityInput.fill('-100');
      await page.waitForTimeout(500);

      // Check if button is disabled or if evaluation shows INVALID_CAPACITY / warning
      const submitBtn = page.locator('button.btn-primary, button:has-text("Phân loại"), button:has-text("Đánh giá")').first();
      if (await submitBtn.count() > 0) {
        await submitBtn.click();
        await page.waitForTimeout(600);
        const warnCard = page.locator('.warning-card, .alert, .badge-danger, [style*="color:#DC2626"]').first();
        const hasWarning = await warnCard.count() > 0;
        console.log('     * Negative capacity (-100) -> Warning badge/card displayed:', hasWarning);
      }

      // Now set valid capacity: 500,000 tấn/năm
      await capacityInput.fill('500000');
      await page.waitForTimeout(500);
    }

    // Submit valid classification
    const classifyBtn = page.locator('button:has-text("Phân loại"), button:has-text("Xác định"), button.btn-primary').first();
    if (await classifyBtn.count() > 0) {
      await classifyBtn.click();
      await page.waitForTimeout(1000);
    }

    // Take screenshot of classification results
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_classify_result.png'), fullPage: true });

    // Inspect result cards
    const resultDossier = page.locator('.result-card, .conclusion-card, .dossier-badge, .nhom-badge, h2, h3').filter({ hasText: /ĐTM|GPMT|ĐKMT|Nhóm I|Nhóm II|Bộ TN&MT/i });
    const resultCount = await resultDossier.count();
    console.log(`   - Classification result elements found: ${resultCount}`);
    if (resultCount > 0) {
      const resultText = await resultDossier.first().textContent();
      console.log('   - Primary result text snippet:', resultText?.trim()?.slice(0, 120));
    }

    // 3.5 Sensitive Criteria Checkboxes Toggle
    console.log('   3.5 Testing Sensitive Zone Checkboxes Toggle...');
    const sensitiveCheckboxes = page.locator('input[type="checkbox"]');
    const cbCount = await sensitiveCheckboxes.count();
    console.log(`   - Sensitive criteria checkboxes count: ${cbCount}`);
    if (cbCount > 0) {
      // Check first two sensitive boxes (e.g. rừng, lúa)
      await sensitiveCheckboxes.nth(0).check();
      if (cbCount > 1) await sensitiveCheckboxes.nth(1).check();
      await page.waitForTimeout(600);

      // Check if sensitive warning notice or alert appears
      const sensitiveNotice = page.locator('.sensitive-notice, .alert-warning, [style*="FEF3C7"], [style*="border-color:#FDE68A"], [style*="border-color: rgb(253, 230, 138)"]');
      const noticeVisible = await sensitiveNotice.count() > 0;
      console.log('   - Sensitive warning notice rendered:', noticeVisible);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_classify_sensitive_active.png'), fullPage: true });
    }

    // 3.6 Check Saved Projects Drawer
    console.log('   3.6 Checking Saved Projects Drawer button...');
    const drawerBtn = page.locator('button:has-text("Hồ sơ đã lưu"), button:has-text("Dự án đã lưu"), button[title*="đã lưu"]').first();
    if (await drawerBtn.count() > 0) {
      console.log('   - Found saved projects drawer button. Clicking...');
      await drawerBtn.click();
      await page.waitForTimeout(800);
      const drawer = page.locator('.drawer, .saved-projects-drawer, aside.drawer-content');
      const drawerVisible = await drawer.count() > 0 && await drawer.isVisible();
      console.log('   - Saved projects drawer open:', drawerVisible);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step3_saved_projects_drawer.png') });

      // Close drawer
      const closeDrawerBtn = page.locator('button:has-text("✕"), .drawer-close, button[title="Đóng"]').first();
      if (await closeDrawerBtn.count() > 0) {
        await closeDrawerBtn.click();
      } else {
        await page.mouse.click(50, 200);
      }
      await page.waitForTimeout(500);
    }

    // =========================================================================
    // STEP 4: QCVNTab (Đối chiếu quy chuẩn kỹ thuật môi trường)
    // =========================================================================
    console.log('\n>>> STEP 4: Inspecting QCVNTab (Đối chiếu QCVN)...');
    const qcvnLink = page.locator('a.sidebar-link[href="/qcvn"]');
    await qcvnLink.click();
    await page.waitForTimeout(1500);
    console.log('   - URL:', page.url());
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4_qcvn_initial.png'), fullPage: true });

    // 4.1 Type and SubType Dropdown
    console.log('   4.1 Checking Standard Type and SubType selection...');
    const qcvnTypeSelect = page.locator('select#qcvn_type, select[name="type"], select').first();
    if (await qcvnTypeSelect.count() > 0) {
      const typeOptions = await qcvnTypeSelect.locator('option').allTextContents();
      console.log('   - QCVN standard types:', typeOptions.join(' | '));
    }

    // 4.2 Fail-Closed Gate 1: Missing Flow Rate & Unconfirmed Receiving Source
    console.log('   4.2 Testing Fail-Closed Gate: Missing Flow Rate & Unconfirmed Receiving Source...');
    // Check if warning badges for missing flow rate / unconfirmed source are present
    const warningBadges = page.locator('.badge, .tag, .alert, .status-chip').filter({ hasText: /lưu lượng|tiếp nhận|cần rà soát|chưa xác nhận/i });
    const warnCount = await warningBadges.count();
    console.log(`   - Initial QCVN warning badges count: ${warnCount}`);
    for (let i = 0; i < Math.min(warnCount, 3); i++) {
      console.log(`     * Badge ${i + 1}:`, (await warningBadges.nth(i).textContent())?.trim());
    }

    // 4.3 Input flow rate and toggle receiving water confirmation
    console.log('   4.3 Filling Flow Rate and toggling Receiving Source...');
    const flowInput = page.locator('input#flowRate, input[name="flowRate"], input[placeholder*="lưu lượng"], input[placeholder*="m3"]').first();
    if (await flowInput.count() > 0) {
      await flowInput.fill('150');
      await page.waitForTimeout(400);
      console.log('   - Filled flowRate = 150 m3/ngày');
    }

    const receivingToggle = page.locator('input[type="checkbox"]#receivingWaterConfirmed, input[type="checkbox"]:near(:text("tiếp nhận"))').first();
    if (await receivingToggle.count() > 0) {
      await receivingToggle.check();
      await page.waitForTimeout(400);
      console.log('   - Checked receivingWaterConfirmed');
    }

    // 4.4 Enter Measured Parameter Values
    console.log('   4.4 Entering Measured Parameters in comparison inputs...');
    const paramInputs = page.locator('input[placeholder*="kết quả"], input[placeholder*="đo đạc"], input[type="number"]');
    const paramCount = await paramInputs.count();
    console.log(`   - Parameter input fields found: ${paramCount}`);

    if (paramCount > 0) {
      // Enter values for first 3 parameters (e.g. pH = 7.2, BOD5 = 25, COD = 40)
      await paramInputs.nth(0).fill('7.2');
      if (paramCount > 1) await paramInputs.nth(1).fill('25');
      if (paramCount > 2) await paramInputs.nth(2).fill('40');
      await page.waitForTimeout(800);
    }

    // 4.5 Inspect Comparison Table
    console.log('   4.5 Inspecting Comparison Table...');
    const comparisonTable = page.locator('table, .qcvn-table, .comparison-grid').first();
    const tableVisible = await comparisonTable.count() > 0 && await comparisonTable.isVisible();
    console.log('   - Comparison table rendered:', tableVisible);

    if (tableVisible) {
      const rows = await comparisonTable.locator('tbody tr, tr').count();
      console.log(`   - Comparison table rows: ${rows}`);
      const badges = await comparisonTable.locator('.badge, .status-badge, .status-chip').allTextContents();
      console.log(`   - Parameter statuses in table (${badges.length}):`, badges.slice(0, 6).join(' | '));
    }

    // 4.6 Test Parameter Paste Area
    console.log('   4.6 Testing Parameter Quick-Paste Area...');
    const pasteTextarea = page.locator('textarea#pasteArea, textarea[placeholder*="dán"], textarea').first();
    if (await pasteTextarea.count() > 0 && await pasteTextarea.isVisible()) {
      const samplePaste = 'pH: 7.8\nBOD5: 28 mg/L\nCOD: 65 mg/L\nTSS: 45 mg/L';
      await pasteTextarea.fill(samplePaste);
      await page.waitForTimeout(500);

      const parseBtn = page.locator('button:has-text("Phân tích"), button:has-text("Nhận diện"), button:has-text("Áp dụng")').first();
      if (await parseBtn.count() > 0) {
        await parseBtn.click();
        await page.waitForTimeout(800);
        console.log('   - Paste button clicked. Parameters parsed.');
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step4_qcvn_evaluated.png'), fullPage: true });

    // =========================================================================
    // STEP 5: MapTab (Bản đồ dự án GIS)
    // =========================================================================
    console.log('\n>>> STEP 5: Inspecting MapTab (Bản đồ GIS)...');
    const mapLink = page.locator('a.sidebar-link[href="/map"]');
    await mapLink.click();
    await page.waitForTimeout(2000);
    console.log('   - URL:', page.url());

    // Check Map Container
    const mapContainer = page.locator('#map, .leaflet-container, .map-viewport').first();
    const isMapRendered = await mapContainer.count() > 0 && await mapContainer.isVisible();
    console.log('   - Map container rendered and visible:', isMapRendered);

    // Check for Map rendering errors
    const mapErrorAlert = page.locator('.map-error, .alert-danger, [style*="color:#DC2626"]').first();
    if (await mapErrorAlert.count() > 0 && await mapErrorAlert.isVisible()) {
      console.log('   - Map error banner:', await mapErrorAlert.textContent());
    }

    // Check Filter Controls
    const mapFilters = page.locator('.map-filters select, .filter-bar select');
    const filterCount = await mapFilters.count();
    console.log(`   - Map filter dropdowns found: ${filterCount}`);

    // Check Layer Toggles
    const layerToggles = page.locator('.layer-controls input[type="checkbox"], .map-controls input[type="checkbox"]');
    console.log(`   - Layer toggle switches found: ${await layerToggles.count()}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step5_map_tab.png'), fullPage: true });

    // =========================================================================
    // STEP 6: DashboardTab (Bảng điều khiển & Thống kê)
    // =========================================================================
    console.log('\n>>> STEP 6: Inspecting DashboardTab (Bảng điều khiển)...');
    const dashLink = page.locator('a.sidebar-link[href="/dashboard"]');
    await dashLink.click();
    await page.waitForTimeout(2000);
    console.log('   - URL:', page.url());

    // Check KPI cards
    const kpiCards = page.locator('.kpi-card, .metric-card, .stat-card');
    const kpiCount = await kpiCards.count();
    console.log(`   - KPI cards rendered: ${kpiCount}`);

    // Check Chart Containers
    const charts = page.locator('canvas, svg, .chart-container, .distribution-bar');
    const chartCount = await charts.count();
    console.log(`   - Charts / Distribution bars rendered: ${chartCount}`);

    // Check Compliance Reminders Section
    const reminderSection = page.locator('.reminders-section, .compliance-alerts, h2, h3').filter({ hasText: /nhắc hạn|nghĩa vụ|tuân thủ/i });
    console.log(`   - Compliance Reminders section visible: ${await reminderSection.count() > 0}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step6_dashboard.png'), fullPage: true });

    // =========================================================================
    // STEP 7: LawsTab & AdminTab (Crawler)
    // =========================================================================
    console.log('\n>>> STEP 7: Inspecting LawsTab & AdminTab (Crawler)...');
    // LawsTab
    const lawsLink = page.locator('a.sidebar-link[href="/laws"]');
    await lawsLink.click();
    await page.waitForTimeout(1500);
    console.log('   - LawsTab URL:', page.url());
    const lawCards = page.locator('.law-card, .law-item, tr.law-row');
    console.log(`   - Laws rendered count: ${await lawCards.count()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step7_laws_tab.png'), fullPage: true });

    // AdminTab
    const adminLink = page.locator('a.sidebar-link[href="/admin"]');
    if (await adminLink.count() > 0) {
      await adminLink.click();
      await page.waitForTimeout(1500);
      console.log('   - AdminTab URL:', page.url());

      // Switch to Crawler subpage
      const crawlerTabBtn = page.locator('button.admin-tab-btn').filter({ hasText: /crawler/i }).first();
      if (await crawlerTabBtn.count() > 0) {
        await crawlerTabBtn.click();
        await page.waitForTimeout(1000);
        console.log('   - Switched to Crawler subpage');

        // Check Crawler UI elements
        const runCrawlerBtn = page.locator('button:has-text("Chạy"), button:has-text("Crawl"), button.btn-primary').first();
        const hasRunBtn = await runCrawlerBtn.count() > 0;
        console.log('   - Manual crawler trigger button present:', hasRunBtn);

        const crawlerHistory = page.locator('table, .crawler-history, .history-card');
        console.log('   - Crawler history table present:', await crawlerHistory.count() > 0);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'step7_admin_crawler.png'), fullPage: true });
      } else {
        console.log('   - Crawler subpage button not found');
      }
    } else {
      console.log('   - Admin sidebar link not visible (check admin role)');
    }

    // =========================================================================
    // STEP 8: Inspecting Layout, CSS Overflows, Missing Elements Across Viewports
    // =========================================================================
    console.log('\n>>> STEP 8: Inspecting Responsive Layout & CSS Overflows...');
    const viewports = [
      { name: 'desktop_1440', width: 1440, height: 900 },
      { name: 'tablet_768', width: 768, height: 1024 },
      { name: 'mobile_375', width: 375, height: 667 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`http://127.0.0.1:${PORT}/classify`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);

      // Check horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      console.log(`   - Viewport ${vp.name} (${vp.width}x${vp.height}) -> Horizontal scroll overflow: ${hasHorizontalScroll}`);
      if (hasHorizontalScroll) {
        auditFindings.layoutIssues.push({
          viewport: vp.name,
          page: 'classify',
          issue: `Horizontal page overflow detected: scrollWidth (${await page.evaluate(() => document.documentElement.scrollWidth)}) > clientWidth (${vp.width})`
        });
      }
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `step8_responsive_${vp.name}.png`) });
    }

  } catch (err) {
    console.error('[FATAL AUDIT ERROR]:', err);
  } finally {
    await browser.close();
    server.close();
    console.log('\n=================================================================');
    console.log('   INSPECTION SUMMARY                                           ');
    console.log('=================================================================');
    console.log(`- Total Console Errors Captured: ${auditFindings.consoleErrors.length}`);
    console.log(`- Total Page Uncaught Errors: ${auditFindings.pageErrors.length}`);
    console.log(`- Total Network Request Failures: ${auditFindings.networkFailures.length}`);
    console.log(`- Total HTTP Error Responses (4xx/5xx): ${auditFindings.networkResponses.length}`);
    console.log(`- Total Layout Overflow Issues: ${auditFindings.layoutIssues.length}`);
    console.log(`- Total Interaction Issues: ${auditFindings.interactionIssues.length}`);

    // Write raw findings to JSON
    fs.writeFileSync(
      path.resolve(__dirname, '../findings_raw.json'),
      JSON.stringify(auditFindings, null, 2),
      'utf8'
    );
    console.log('Raw audit findings saved to .agents/teamwork/browser_inspector/findings_raw.json');
  }
}

main();
