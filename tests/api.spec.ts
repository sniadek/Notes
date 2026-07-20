import { test, expect, request } from '@playwright/test';

// Plain API smoke test against an external placeholder API — deliberately imports from
// '@playwright/test' directly rather than './playwright-fixtures', since it needs no
// browser page and shouldn't pull in the per-navigation Axe check.
test('api: simple GET assertion', async () => {
  const base = process.env.API_BASE || 'https://jsonplaceholder.typicode.com';
  const req = await request.newContext();
  const resp = await req.get(`${base}/posts/1`);
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('id', 1);
});
