// Playwright Test configuration
const { devices } = require('@playwright/test');
require('dotenv').config();

const APP_PORT = 5199;
const APP_URL = process.env.BASE_URL || `http://localhost:${APP_PORT}`;

/** @type {import('@playwright/test').PlaywrightTestConfig} */
module.exports = {
  testDir: 'tests',
  timeout: 30 * 1000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  reporter: [ ['list'], ['allure-playwright'] ],
  use: {
    baseURL: APP_URL,
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 0,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
  // Boots the actual app's Vite dev server so tests exercise real app markup instead of a
  // placeholder page. Skipped when BASE_URL is set explicitly (e.g. pointing at a deployed
  // build) since Playwright then has nothing local to start.
  webServer: process.env.BASE_URL ? undefined : {
    command: `npm run dev --prefix app -- --port ${APP_PORT} --strictPort`,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
};
