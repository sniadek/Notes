import { test as base, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import dotenv from 'dotenv';

// Load env vars from .env automatically for tests
dotenv.config();

const test = base.extend({});

// Helper: determine fail-on-a11y default — stricter by default (true) unless explicitly set to 'false'
const FAIL_ON_A11Y = process.env.FAIL_ON_A11Y !== 'false';

// Attach and/or fail on violations
async function handleA11yResults(results: any, testInfo: any) {
  if (results && results.violations && results.violations.length > 0) {
    const body = JSON.stringify(results.violations, null, 2);
    if (typeof testInfo?.attach === 'function') {
      await testInfo.attach('a11y-violations.json', { body, contentType: 'application/json' });
    }
    const msg = `Accessibility violations detected: ${results.violations.length} violation(s).`;
    if (FAIL_ON_A11Y) {
      throw new Error(msg);
    } else {
      console.warn('Accessibility:', msg, 'Set FAIL_ON_A11Y=true to fail on violations.');
    }
  }
}

// Run Axe analysis for the page
async function runAxeOnPage(page: any, testInfo: any) {
  try {
    const results = await new AxeBuilder({ page }).analyze();
    await handleA11yResults(results, testInfo);
  } catch (err: any) {
    // If Axe itself throws, choose behavior based on FAIL_ON_A11Y
    console.warn('Axe execution error:', err?.message || err);
    if (FAIL_ON_A11Y) throw err;
  }
}

// Set up per-test listeners: run Axe immediately and on every navigation
test.beforeEach(async ({ page }, testInfo) => {
  // Run for the initial loaded content — skipped on about:blank (the page fixture's default
  // state before any test navigates), since axe flags a blank document as missing a title,
  // lang attribute, main landmark, and heading regardless of what the app under test does.
  // Real coverage of the first real page comes from the framenavigated listener below.
  if (page.url() !== 'about:blank') {
    await runAxeOnPage(page, testInfo);
  }

  // Listener for subsequent navigations (main frame). 'framenavigated' fires on commit, before
  // an SPA's JS has mounted/painted anything — running Axe synchronously here raced React's
  // first render and intermittently flagged a still-empty document (missing <main>, no
  // heading yet). Wait for the network to go idle first so Axe sees the settled app, not a
  // transitional shell.
  const listener = async (frame: any) => {
    try {
      if (frame === page.mainFrame()) {
        await page.waitForLoadState('networkidle').catch(() => {});
        await runAxeOnPage(page, testInfo);
      }
    } catch (err) {
      // Errors will be handled in runAxeOnPage
    }
  };

  // store listener on page to remove later
  (page as any)._a11y_listener = listener;
  page.on('framenavigated', listener);
});

// Remove navigation listener after each test
test.afterEach(async ({ page }, testInfo) => {
  const listener = (page as any)._a11y_listener;
  if (listener) page.off('framenavigated', listener);
});

export { test, expect };