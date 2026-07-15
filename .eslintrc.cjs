module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:playwright/playwright-test'
  ],
  plugins: ['playwright'],
  rules: {
    // project-specific adjustments
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
  }
};
