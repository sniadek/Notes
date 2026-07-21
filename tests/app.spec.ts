import { test, expect } from './playwright-fixtures';

// Smoke test against the real app shell (Vite dev server, browser fallback — no Tauri host,
// so the app renders from its built-in seed data). playwright-fixtures runs Axe on every
// navigation automatically, so this also exercises the a11y check against real app markup
// instead of a placeholder page.
test('app: loads the shell and renders the sidebar', async ({ page }) => {
  await page.goto('/');
  // Must track the app name in app/index.html — this assertion silently went stale on the
  // rename from "Notes" to "Cyberdyne Systems", which failed every PR's CI.
  await expect(page).toHaveTitle(/Cyberdyne_Systems/);
  await expect(page.getByText('Tasks', { exact: true })).toBeVisible();
  await expect(page.getByText('Daily Note', { exact: true })).toBeVisible();
});
