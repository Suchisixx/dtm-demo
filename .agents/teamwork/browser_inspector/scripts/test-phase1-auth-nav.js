const http = require('http');
const path = require('path');
const rootDir = process.cwd();
const backendDir = path.resolve(rootDir, 'backend');
const express = require(path.join(backendDir, 'node_modules/express'));
const cookieParser = require(path.join(backendDir, 'node_modules/cookie-parser'));
const jwt = require(path.join(backendDir, 'node_modules/jsonwebtoken'));
const { chromium } = require('playwright');

const JWT_SECRET = 'fd3f6ddc43d653c0518deb80938d694e9cf7349fc3eebe3bc72051d4ef11960d';
const PORT = 5020;

async function run() {
  console.log('=== TEST PHASE 1: Auth & Navigation Inspection ===');

  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Static files
  app.use(express.static(path.join(backendDir, 'public')));

  // Backend routes
  app.use('/api/auth', require(path.join(backendDir, 'routes/auth')));
  app.use('/api/classification', require(path.join(backendDir, 'routes/classification')));
  app.use('/api/industries', (req, res, next) => {
    req.url = '/industries' + (req.url === '/' ? '' : req.url);
    return require(path.join(backendDir, 'routes/classification'))(req, res, next);
  });
  app.use('/api/qcvns', require(path.join(backendDir, 'routes/qcvns')));

  // Wildcard fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(backendDir, 'public/index.html'));
  });

  const server = app.listen(PORT, '127.0.0.1');
  console.log(`Server listening on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];
  const networkFailures = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error') {
      console.log(`[BROWSER CONSOLE ERROR]: ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
    console.log(`[PAGE ERROR]: ${err.message}`);
  });

  page.on('requestfailed', req => {
    networkFailures.push({ url: req.url(), failure: req.failure()?.errorText });
    console.log(`[NETWORK FAILED]: ${req.url()} - ${req.failure()?.errorText}`);
  });

  try {
    // 1. Visit root (should land on laws or default)
    console.log('\n--- 1. Testing Default Navigation (Unauthenticated) ---');
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
    const currentUrl = page.url();
    console.log('Landing URL:', currentUrl);

    // Take screenshot of landing page
    await page.screenshot({ path: path.join(__dirname, '../screenshots/01_landing_unauth.png'), fullPage: true });

    // Check header / navigation bar
    const pageTitle = await page.title();
    console.log('Page Title:', pageTitle);

    // Try navigating to private tab (classify) without logging in
    console.log('\n--- 2. Clicking Private Tab without Auth (Classify) ---');
    const classifyNavBtn = page.locator('nav a, nav button, aside a, aside button').filter({ hasText: /phân loại/i }).first();
    if (await classifyNavBtn.count() > 0) {
      await classifyNavBtn.click();
      await page.waitForTimeout(1000);
      console.log('URL after clicking Classify without auth:', page.url());

      // Check if AuthModal is visible
      const authModal = page.locator('.auth-modal, .modal, [role="dialog"]').filter({ hasText: /đăng nhập/i });
      const isModalVisible = await authModal.count() > 0 && await authModal.first().isVisible();
      console.log('AuthModal visible on private tab click:', isModalVisible);
      if (isModalVisible) {
        await page.screenshot({ path: path.join(__dirname, '../screenshots/02_auth_modal.png') });
      }
    } else {
      console.log('Could not find classify navigation button in DOM');
    }

    // 3. Authenticate as Admin via JWT cookie
    console.log('\n--- 3. Injecting Admin JWT Auth Cookie ---');
    const adminToken = jwt.sign(
      { id: 1, username: 'admin', fullName: 'Quản trị viên', role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    await context.addCookies([
      {
        name: 'token',
        value: adminToken,
        domain: '127.0.0.1',
        path: '/'
      }
    ]);

    // Reload page
    await page.goto(`http://127.0.0.1:${PORT}/classify`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    console.log('URL after auth reload:', page.url());

    // Check if classify form is rendered
    const hasClassifyHeading = await page.locator('h1, h2, h3').filter({ hasText: /phân loại/i }).count() > 0;
    console.log('Classify heading found:', hasClassifyHeading);

    await page.screenshot({ path: path.join(__dirname, '../screenshots/03_classify_auth.png'), fullPage: true });

  } catch (err) {
    console.error('Test phase 1 failed:', err);
  } finally {
    await browser.close();
    server.close();
    console.log('\nConsole Errors count:', consoleLogs.filter(c => c.type === 'error').length);
    console.log('Page Errors count:', pageErrors.length);
    console.log('Network Failures count:', networkFailures.length);
    console.log('Phase 1 completed.\n');
  }
}

run();
