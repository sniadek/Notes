const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const appDir = path.resolve(__dirname, '..');
const resultsPath = path.join(appDir, 'vitest-results.json');
const reportDir = path.join(appDir, 'allure-report');
const reportPath = path.join(reportDir, 'index.html');

if (!fs.existsSync(resultsPath)) {
  execFileSync('npx', ['vitest', 'run', '--reporter=json', '--outputFile=vitest-results.json'], {
    cwd: appDir,
    stdio: 'inherit',
  });
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const suites = results.testResults
  .map((suite) => {
    const passed = suite.assertionResults.filter((t) => t.status === 'passed').length;
    const failed = suite.assertionResults.filter((t) => t.status === 'failed').length;
    const pending = suite.assertionResults.filter((t) => t.status === 'pending').length;
    const name = suite.assertionResults[0]?.ancestorTitles?.join(' > ') || 'Unnamed suite';
    return `<li><strong>${name}</strong> — ${passed} passed, ${failed} failed, ${pending} pending</li>`;
  })
  .join('');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Allure Report</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 2rem; color: #1f2937; }
      .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 1.25rem; max-width: 900px; }
      .pass { color: #2e7d32; font-weight: 600; }
      .fail { color: #c62828; font-weight: 600; }
      ul { padding-left: 1.2rem; }
      li { margin-bottom: 0.35rem; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Allure Report</h1>
      <p><strong>Status:</strong> ${results.success ? '<span class="pass">Passed</span>' : '<span class="fail">Failed</span>'}</p>
      <p><strong>Tests:</strong> ${results.numPassedTests}/${results.numTotalTests} passed</p>
      <p><strong>Suites:</strong> ${results.numPassedTestSuites}/${results.numTotalTestSuites} passed</p>
      <ul>${suites}</ul>
    </div>
  </body>
</html>`;

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, html);
console.log(`Allure report generated at ${reportPath}`);
