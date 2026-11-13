const path = require('path');
const rootDir = process.cwd();
const backendDir = path.resolve(rootDir, 'backend');
const express = require(path.join(backendDir, 'node_modules/express'));
const cookieParser = require(path.join(backendDir, 'node_modules/cookie-parser'));
const jwt = require(path.join(backendDir, 'node_modules/jsonwebtoken'));
const { chromium } = require('playwright');
const fs = require('fs');

const JWT_SECRET = 'fd3f6ddc43d653c0518deb80938d694e9cf7349fc3eebe3bc72051d4ef11960d';
const PORT = 5026;
const SCREENSHOT_DIR = path.resolve(__dirname, '../screenshots');

async function testClassify() {
  console.log('=== TEST CLASSIFY TAB & SEARCHABLE SELECT ===');

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(express.static(path.join(backendDir, 'public')));

  app.use('/api/auth', require(path.join(backendDir, 'routes/auth')));
  app.use('/api/classification', require(path.join(backendDir, 'routes/classification')));
  app.use('/api/industries', (req, res, next) => {
    req.url = '/industries' + (req.url === '/' ? '' : req.url);
    return require(path.join(backendDir, 'routes/classification'))(req, res, next);
  });
  app.use('/api/qcvns', require(path.join(backendDir, 'routes/qcvns')));
  app.use('/api/dashboard', require(path.join(backendDir, 'routes/dashboard')));

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

  page.on('console', msg => {
    if (msg.type() === 'error') console.log('[CONSOLE ERROR]:', msg.text());
  });
  page.on('pageerror', err => {
    console.log('[PAGE ERROR]:', err.message);
  });

  try {
    await page.goto(`http://127.0.0.1:${PORT}/classify`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 1. Inspect SearchableSelect trigger for industry
    const selectTrigger = page.locator('.select-trigger').first();
    console.log('Select trigger count:', await selectTrigger.count());
    console.log('Select trigger text:', await selectTrigger.textContent());

    // Click trigger to open popover
    await selectTrigger.click();
    await page.waitForTimeout(500);

    const isPopoverOpen = await page.locator('.dropdown-popover').isVisible();
    console.log('Dropdown popover visible:', isPopoverOpen);

    // Check option items count
    const optionItems = page.locator('.option-item');
    const optCount = await optionItems.count();
    console.log(`Total options in dropdown: ${optCount}`);

    // Print first 8 option names
    for (let i = 0; i < Math.min(optCount, 8); i++) {
      console.log(`  Option ${i + 1}:`, (await optionItems.nth(i).textContent())?.trim());
    }

    // 2. Test searching for "thép" in the search box
    const searchInput = page.locator('.search-input').first();
    await searchInput.fill('thép');
    await page.waitForTimeout(400);

    const filteredOptions = page.locator('.dropdown-popover .option-item');
    const filteredCount = await filteredOptions.count();
    console.log(`Filtered options for "thép": ${filteredCount}`);
    for (let i = 0; i < filteredCount; i++) {
      console.log(`  Filtered match ${i + 1}:`, (await filteredOptions.nth(i).textContent())?.trim());
    }

    // Click the steel option
    await filteredOptions.first().click();
    await page.waitForTimeout(800);
    console.log('Clicked steel option.');
    console.log('Select trigger text now:', (await selectTrigger.textContent())?.trim());

    // 3. Check if Process Stage dropdown appeared!
    const processStageSelect = page.locator('select#processStage, select[name="processStage"], .process-stage-select, select').filter({ hasText: /luyện thép|cán thép/i }).first();
    const isStagePresent = await processStageSelect.count() > 0;
    console.log('Process stage select element found:', isStagePresent);
    if (isStagePresent) {
      const stageOptions = await processStageSelect.locator('option').allTextContents();
      console.log('Process stages available for Thép:', stageOptions.join(' | '));
      // Select "Luyện thép"
      await processStageSelect.selectOption({ index: 1 });
      await page.waitForTimeout(400);
    } else {
      // Look for all selects on page
      const allSelects = await page.locator('select').all();
      console.log('All select elements on page count:', allSelects.length);
      for (let s of allSelects) {
        console.log('  Select HTML:', await s.evaluate(el => el.outerHTML.slice(0, 100)));
      }
    }

    // 4. Fill Capacity
    const capInput = page.locator('input#capacity, input[type="number"]').first();
    if (await capInput.count() > 0) {
      console.log('Capacity input found. Current value:', await capInput.inputValue());
      await capInput.fill('600000');
      await page.waitForTimeout(400);
    }

    // 5. Click Classify button (btn-classify)
    const classifyButton = page.locator('button.btn-classify, button:has-text("Phân loại")').first();
    console.log('Classify button found:', await classifyButton.count() > 0);
    await classifyButton.click();
    await page.waitForTimeout(1200);

    // 6. Check results
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'classify_deep_result.png'), fullPage: true });

    // Look for group badge, dossier badge, authority badge
    const nhomBadge = page.locator('.nhom-badge, .badge-nhom, [style*="Nhóm"]').first();
    console.log('Group result badge:', await nhomBadge.textContent().catch(() => 'not found'));

    const authorityText = page.locator('.authority-badge, .tq-badge, .result-authority, div:has-text("Thẩm quyền:")').first();
    console.log('Authority text snippet:', await authorityText.textContent().catch(() => 'not found'));

    // Check legal notice / fail-closed badge
    const ruleSourceBadge = page.locator('.rule-source-badge, .badge-source, div:has-text("Nguồn quy tắc")').first();
    console.log('Rule source badge:', await ruleSourceBadge.textContent().catch(() => 'not found'));

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

testClassify();
