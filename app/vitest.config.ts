import { defineConfig } from 'vitest/config';

// jsdom because htmlToMd walks real DOM nodes; everything else under test is pure.
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
