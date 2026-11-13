const path = require('path');
const rootDir = process.cwd();
const backendDir = path.resolve(rootDir, 'backend');
const express = require(path.join(backendDir, 'node_modules/express'));
const cookieParser = require(path.join(backendDir, 'node_modules/cookie-parser'));
const jwt = require(path.join(backendDir, 'node_modules/jsonwebtoken'));
const { chromium } = require('playwright');
const fs = require('fs');

const JWT_SECRET = 'fd3f6ddc43d653c0518deb80938d694e9cf7349fc3eebe3bc72051d4ef11960d';
const PORT = 5030;
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

async function testAllTabs() {
  console.log('=== COMPREHENSIVE MULTI-TAB DEEP INSPECTION ===');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
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

  const report = {
    alertsCaught: [],
    consoleErrors: [],
    networkFailures: [],
    tabObservations: {}
  };

  page.on('dialog', async dialog => {
    const msg = dialog.message();
    console.log(`[BROWSER DIALOG / ALERT]: "${msg}"`);
    report.alertsCaught.push(msg);
    await dialog.accept();
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      report.consoleErrors.push({ text: msg.text(), url: msg.location()?.url });
      console.log(`[CONSOLE ERROR]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR]: ${err.message}`);
  });

  page.on('requestfailed', req => {
    report.networkFailures.push({ url: req.url(), error: req.failure()?.errorText });
  });

  try {
    // -------------------------------------------------------------------------
    // TAB 1: CLASSIFY TAB INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Testing ClassifyTab ---');
    await page.goto(`http://127.0.0.1:${PORT}/classify`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Form inputs inspection
    const projectNameInput = page.locator('input[placeholder*="tên dự án"], input[placeholder*="Tên dự án"]').first();
    const hasProjectName = await projectNameInput.isVisible();
    console.log('   - Project name input visible:', hasProjectName);
    await projectNameInput.fill('Dự án Sản xuất Thép Xanh Dung Quất');

    // Industry trigger
    const indTrigger = page.locator('.select-trigger').first();
    await indTrigger.click();
    await page.waitForTimeout(400);

    // Filter "thép"
    const indSearch = page.locator('.search-input').first();
    await indSearch.fill('thép');
    await page.waitForTimeout(300);

    // Click first match
    const steelOpt = page.locator('.option-item').filter({ hasText: /thép/i }).first();
    await steelOpt.click();
    await page.waitForTimeout(500);

    // Process Stage Select
    const processStageSelect = page.locator('select').filter({ has: page.locator('option[value*="thep"], option:has-text("thép")') }).first();
    let stageCount = 0;
    if (await processStageSelect.count() > 0) {
      stageCount = await processStageSelect.locator('option').count();
      console.log(`   - Process stages count for 'thep': ${stageCount}`);
      await processStageSelect.selectOption({ index: 1 });
    } else {
      // Find any select with options
      const allSelects = await page.locator('select').all();
      for (const s of allSelects) {
        const text = await s.textContent();
        if (text.includes('công đoạn') || text.includes('nhiên liệu')) {
          const opts = await s.locator('option').allTextContents();
          console.log('   - Process stage options found:', opts.join(' | '));
          if (opts.length > 1) {
            await s.selectOption({ index: 1 });
          }
        }
      }
    }

    // Capacity
    const capInput = page.locator('input[type="number"]').first();
    await capInput.fill('400000');
    await page.waitForTimeout(300);

    // Province selection
    const provSelect = page.locator('select').filter({ has: page.locator('option:has-text("Hà Nội"), option:has-text("Hồ Chí Minh")') }).first();
    if (await provSelect.count() > 0) {
      await provSelect.selectOption({ index: 1 });
      await page.waitForTimeout(300);
      console.log('   - Selected province index 1');
    } else {
      // Check if SearchableSelect for province exists
      const triggers = page.locator('.select-trigger');
      if (await triggers.count() > 1) {
        console.log('   - Found secondary SearchableSelect (province/ward)');
        await triggers.nth(1).click();
        await page.waitForTimeout(300);
        const provOpts = page.locator('.dropdown-popover .option-item');
        if (await provOpts.count() > 0) {
          console.log('   - Province options count:', await provOpts.count());
          await provOpts.first().click();
        }
      }
    }

    // Check Classify Button
    const classifyBtn = page.locator('button.btn-classify').first();
    if (await classifyBtn.count() > 0) {
      await classifyBtn.click();
      await page.waitForTimeout(1000);
      console.log('   - Clicked Classify button');
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab1_classify_evaluated.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // TAB 2: QCVN TAB INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Testing QCVNTab ---');
    await page.goto(`http://127.0.0.1:${PORT}/qcvn`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // QCVN Type select
    const qcvnType = page.locator('select').first();
    if (await qcvnType.count() > 0) {
      const types = await qcvnType.locator('option').allTextContents();
      console.log('   - QCVN Types:', types.join(' | '));

      // Select Nước thải công nghiệp
      await qcvnType.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }

    // Check second select (SubType)
    const allQcvnSelects = await page.locator('select').all();
    console.log(`   - Total select dropdowns on QCVN tab: ${allQcvnSelects.length}`);
    if (allQcvnSelects.length > 1) {
      const subOpts = await allQcvnSelects[1].locator('option').allTextContents();
      console.log('   - SubTypes available:', subOpts.join(' | '));
    }

    // Flow rate input
    const flowInput = page.locator('input[type="number"]').first();
    if (await flowInput.count() > 0) {
      console.log('   - Flow rate input placeholder:', await flowInput.getAttribute('placeholder'));
      await flowInput.fill('250');
      await page.waitForTimeout(300);
    }

    // Receiving water checkbox
    const recvCheckbox = page.locator('input[type="checkbox"]').first();
    if (await recvCheckbox.count() > 0) {
      console.log('   - Found receiving water toggle checkbox');
      await recvCheckbox.check();
      await page.waitForTimeout(300);
    }

    // Parameter inputs
    const paramInputs = page.locator('table input, .param-row input');
    const pCount = await paramInputs.count();
    console.log(`   - Parameter measurement input count: ${pCount}`);
    if (pCount > 0) {
      await paramInputs.nth(0).fill('7.5');
      if (pCount > 1) await paramInputs.nth(1).fill('35');
      if (pCount > 2) await paramInputs.nth(2).fill('70');
      await page.waitForTimeout(500);
    }

    // Check table badges
    const statusBadges = page.locator('table .badge, table .status-chip, table [class*="badge"], table [class*="chip"]');
    const badgeCount = await statusBadges.count();
    console.log(`   - Table status badges count: ${badgeCount}`);
    for (let i = 0; i < Math.min(badgeCount, 5); i++) {
      console.log(`     * Badge ${i + 1}:`, (await statusBadges.nth(i).textContent())?.trim());
    }

    // Quick Paste Area
    const pasteBox = page.locator('textarea').first();
    if (await pasteBox.count() > 0) {
      console.log('   - Quick paste textarea found');
      await pasteBox.fill('pH: 6.8\nBOD5: 45 mg/L\nCOD: 110 mg/L\nTSS: 60 mg/L');
      await page.waitForTimeout(300);
      const applyBtn = page.locator('button').filter({ hasText: /áp dụng|phân tích|nhập nhanh/i }).first();
      if (await applyBtn.count() > 0) {
        await applyBtn.click();
        await page.waitForTimeout(600);
        console.log('   - Clicked Apply button for quick paste');
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab2_qcvn_evaluated.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // TAB 3: MAP TAB INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Testing MapTab ---');
    await page.goto(`http://127.0.0.1:${PORT}/map`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const mapElement = page.locator('#map, .map-container, .leaflet-container').first();
    const mapPresent = await mapElement.count() > 0;
    console.log('   - Map DOM element present:', mapPresent);
    if (mapPresent) {
      const box = await mapElement.boundingBox();
      console.log('   - Map bounding box:', box);
    }

    // Check if Leaflet object exists in browser window
    const leafletLoaded = await page.evaluate(() => typeof window.L !== 'undefined');
    console.log('   - Leaflet (window.L) available in browser:', leafletLoaded);

    const markerClusterLoaded = await page.evaluate(() => typeof window.L !== 'undefined' && typeof window.L.markerClusterGroup !== 'undefined');
    console.log('   - Leaflet.markerClusterGroup available in browser:', markerClusterLoaded);

    // Filter controls
    const mapSelects = await page.locator('.filter-bar select, .map-controls select, select').all();
    console.log(`   - Map filter select dropdowns count: ${mapSelects.length}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab3_map_rendered.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // TAB 4: DASHBOARD TAB INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Testing DashboardTab ---');
    await page.goto(`http://127.0.0.1:${PORT}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // KPI cards
    const kpiElements = page.locator('.kpi-card, .metric-card, .stat-box');
    const kpiCount = await kpiElements.count();
    console.log(`   - KPI cards count: ${kpiCount}`);
    for (let i = 0; i < Math.min(kpiCount, 6); i++) {
      const title = await kpiElements.nth(i).locator('.kpi-title, .metric-label, .title, span').first().textContent().catch(() => '');
      const val = await kpiElements.nth(i).locator('.kpi-value, .metric-value, .value, h2, h3').first().textContent().catch(() => '');
      console.log(`     * KPI ${i + 1}: ${title?.trim()} = ${val?.trim()}`);
    }

    // Error or loading banner
    const dashAlert = page.locator('.alert, .error-banner, [role="alert"]').first();
    if (await dashAlert.count() > 0 && await dashAlert.isVisible()) {
      console.log('   - Dashboard alert text:', (await dashAlert.textContent())?.trim());
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab4_dashboard_rendered.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // TAB 5: LAWS TAB INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Testing LawsTab ---');
    await page.goto(`http://127.0.0.1:${PORT}/laws`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    const lawSearchInput = page.locator('input[placeholder*="tìm kiếm"], input[placeholder*="văn bản"]').first();
    console.log('   - Law search input present:', await lawSearchInput.count() > 0);

    const lawItems = page.locator('.law-card, .law-item, tr.law-row, .card');
    console.log(`   - Law items displayed count: ${await lawItems.count()}`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab5_laws_rendered.png'), fullPage: true });

    // -------------------------------------------------------------------------
    // TAB 6: ADMIN TAB & CRAWLER INSPECTION
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Testing AdminTab & Crawler ---');
    await page.goto(`http://127.0.0.1:${PORT}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);

    // Subpage buttons
    const subpageBtns = page.locator('.admin-tab-btn, button[class*="admin-tab"]');
    const subCount = await subpageBtns.count();
    console.log(`   - Admin subpage tabs count: ${subCount}`);
    for (let i = 0; i < subCount; i++) {
      console.log(`     * Admin Tab ${i + 1}:`, (await subpageBtns.nth(i).textContent())?.trim());
    }

    // Switch to Crawler subpage
    const crawlerBtn = subpageBtns.filter({ hasText: /crawler/i }).first();
    if (await crawlerBtn.count() > 0) {
      await crawlerBtn.click();
      await page.waitForTimeout(800);
      console.log('   - Clicked Crawler subpage button');

      const runCrawlBtn = page.locator('button').filter({ hasText: /chạy|crawl|bắt đầu/i }).first();
      console.log('   - Manual crawl button visible:', await runCrawlBtn.count() > 0 && await runCrawlBtn.isVisible());

      const historyTable = page.locator('table').first();
      console.log('   - Crawler history table present:', await historyTable.count() > 0);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'tab6_admin_crawler.png'), fullPage: true });
    }

    // -------------------------------------------------------------------------
    // TAB 7: RESPONSIVE & LAYOUT INSPECTION (DESKTOP, TABLET, MOBILE)
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Testing Responsive Layouts across 3 viewports ---');
    const viewports = [
      { name: 'desktop_1440', w: 1440, h: 900 },
      { name: 'tablet_768', w: 768, h: 1024 },
      { name: 'mobile_375', w: 375, h: 667 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`http://127.0.0.1:${PORT}/classify`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);

      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
      });
      console.log(`   - Viewport ${vp.name} (${vp.w}x${vp.h}): scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}, overflow=${overflow.hasOverflow}`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `tab7_responsive_${vp.name}.png`) });
    }

  } catch (err) {
    console.error('Fatal inspection error:', err);
  } finally {
    await browser.close();
    server.close();

    console.log('\n=== FINAL SUMMARY OF FINDINGS ===');
    console.log(`- Alerts caught: ${report.alertsCaught.length}`);
    console.log(`- Console errors: ${report.consoleErrors.length}`);
    console.log(`- Network failures: ${report.networkFailures.length}`);

    fs.writeFileSync(
      path.resolve(__dirname, '../deep_inspection_report.json'),
      JSON.stringify(report, null, 2),
      'utf8'
    );
    console.log('Report written to deep_inspection_report.json');
  }
}

testAllTabs();
