// @ts-check
import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Kiểm tra tiêu đề có chứa một đoạn văn bản.
  await expect(page).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Bấm vào liên kết bắt đầu.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Kiểm tra trang có tiêu đề hướng dẫn cài đặt.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
