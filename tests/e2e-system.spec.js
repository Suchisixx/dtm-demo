// @ts-check
const path = require('path');
const http = require('http');
const { test, expect } = require('@playwright/test');

require('../backend/node_modules/dotenv').config({
  path: path.join(__dirname, '../backend/.env'),
});

const express = require('../backend/node_modules/express');
const cookieParser = require('../backend/node_modules/cookie-parser');
const jwt = require('../backend/node_modules/jsonwebtoken');
const db = require('../backend/config/db');
const { JWT_SECRET, COOKIE_NAME } = require('../backend/utils/constants');
const { ensureRuntimeDatabaseReady } = require('../backend/services/db-bootstrap');
const { installSandboxDbFallbackIfNeeded } = require('../backend/scripts/sandbox-db-adapter');

let server = null;
let baseUrl = '';

function createFullApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use('/api/auth', require('../backend/routes/auth'));
  app.use('/api/projects', require('../backend/routes/projects'));
  app.use('/api/classification', require('../backend/routes/classification'));
  app.use('/api/industries', require('../backend/routes/classification'));
  app.use('/api/admin/rules', require('../backend/routes/admin-rules'));
  app.use('/api/admin', require('../backend/routes/admin'));
  app.use('/api/laws', require('../backend/routes/laws'));
  app.use('/api/qcvns', require('../backend/routes/qcvns'));
  app.use('/api/crawler', require('../backend/routes/crawler'));
  app.use('/api/dashboard', require('../backend/routes/dashboard'));
  app.use('/api/reminders', require('../backend/routes/reminders'));

  const publicDir = path.join(__dirname, '../backend/public');
  app.use(express.static(publicDir));
  app.use((req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}

function createAuthCookie(user = { id: 1, username: 'admin', fullName: 'Quản trị viên Hệ thống', role: 'admin' }) {
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
  return {
    name: COOKIE_NAME,
    value: token,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
  };
}

test.describe('Kiểm thử hệ thống tự động đầu-cuối (E2E) — ETC LegalHub', () => {
  test.beforeAll(async () => {
    await installSandboxDbFallbackIfNeeded(db);
    await ensureRuntimeDatabaseReady(db);
    const app = createFullApp();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 3105;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  test.afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('E2E-01: Khách vãng lai tra cứu Thư viện văn bản pháp lý & hiển thị chuẩn pháp lý động từ CSDL', async ({ page }) => {
    await page.goto(`${baseUrl}/laws`);

    await expect(page.locator('.legal-version-pill')).toContainText('49/VBHN-BNNMT');
    await expect(page.locator('.legal-version-pill')).toContainText('55/VBHN-BNNMT');
    await expect(page.locator('.breadcrumb-current')).toContainText('Thư viện văn bản pháp lý');

    const vbhnFilterBtn = page.locator('button.filter-btn', { hasText: 'VBHN' });
    await expect(vbhnFilterBtn).toBeVisible();
    await vbhnFilterBtn.click();

    await expect(page.locator('body')).toContainText('55/VBHN-BNNMT');
    await expect(page.locator('body')).toContainText('49/VBHN-BNNMT');
  });

  test('E2E-02: Khách vãng lai bị chặn khi truy cập phân hệ nội bộ và tự động mở hộp thoại Đăng nhập', async ({ page }) => {
    await page.goto(`${baseUrl}/laws`);
    const classifyNav = page.locator('a.sidebar-link[href="/classify"]');
    await classifyNav.click();

    await expect(page.locator('body')).toContainText('Đăng nhập');
  });

  test('E2E-03: Chuyên viên / Quản trị viên truy cập Phân loại dự án & thực hiện đánh giá hồ sơ môi trường', async ({ context, page }) => {
    await context.addCookies([createAuthCookie()]);
    await page.goto(`${baseUrl}/classify`);

    await expect(page.locator('.breadcrumb-current')).toContainText('Phân loại & Xác định hồ sơ');
    await expect(page.locator('.user-info-name')).toContainText('Quản trị viên Hệ thống');
    await expect(page.locator('body')).toContainText('1. Thông tin định danh & Ngành nghề');
  });

  test('E2E-04: Truy cập phân hệ Đối chiếu quy chuẩn QCVN & hiển thị danh mục quy chuẩn từ CSDL', async ({ context, page }) => {
    await context.addCookies([createAuthCookie()]);
    await page.goto(`${baseUrl}/qcvn`);

    await expect(page.locator('.breadcrumb-current')).toContainText('Đối chiếu quy chuẩn QCVN');
    await expect(page.locator('body')).toContainText('QCVN');
  });

  test('E2E-05: Truy cập Bảng điều khiển thống kê & Bản đồ GIS dự án', async ({ context, page }) => {
    await context.addCookies([createAuthCookie()]);
    await page.goto(`${baseUrl}/dashboard`);

    await expect(page.locator('.breadcrumb-current')).toContainText('Bảng điều khiển & Thống kê');
    await expect(page.locator('body')).toContainText('Phân bố Nhóm Dự án');

    await page.goto(`${baseUrl}/map`);
    await expect(page.locator('.breadcrumb-current')).toContainText('Bản đồ GIS dự án');
  });

  test('E2E-06: Quản trị viên truy cập Quản trị hệ thống, Đồng bộ dữ liệu & Truy vết lịch sử thao tác', async ({ context, page }) => {
    await context.addCookies([createAuthCookie()]);
    await page.goto(`${baseUrl}/admin`);

    await expect(page.locator('.breadcrumb-current')).toContainText('Quản trị hệ thống');
    await expect(page.locator('body')).toContainText('Quản trị');
  });
});
