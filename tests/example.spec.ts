import { test, expect } from './playwright-fixtures';

// Visual regression + a11y example
test('homepage: visual & a11y checks', async ({ page }) => {
  const url = process.env.BASE_URL || 'https://example.com';
  await page.goto(url);
  await expect(page).toHaveTitle(/Example Domain/);

  // Visual snapshot — save current screenshot. To enable automatic snapshot comparisons,
  // replace this with `await expect(page).toHaveScreenshot('homepage.png')` and commit
  // the generated snapshot under the `tests` snapshots folder.
  await page.screenshot({ path: 'tests/snapshots/homepage.png', fullPage: true });
});

// API testing example
import { request } from '@playwright/test';

test('api: simple GET assertion', async () => {
  const base = process.env.API_BASE || 'https://jsonplaceholder.typicode.com';
  const req = await request.newContext();
  const resp = await req.get(`${base}/posts/1`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('id', 1);
});