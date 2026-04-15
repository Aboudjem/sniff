import type { Finding, Severity, BrowserFinding } from '../core/types.js';
import type { SniffReport, ReportMetadata, ReportSummary, Screenshot } from './types.js';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const SCANNER_PREFIXES: Array<{ prefix: string; name: string; displayName: string }> = [
  { prefix: 'e2e/', name: 'e2e', displayName: 'Browser Tests' },
  { prefix: 'a11y/', name: 'accessibility', displayName: 'Accessibility' },
  { prefix: 'visual/', name: 'visual', displayName: 'Visual Regression' },
  { prefix: 'perf/', name: 'performance', displayName: 'Performance' },
  { prefix: 'source/', name: 'source', displayName: 'Source Code' },
];

const SCANNER_DISPLAY_NAMES: Record<string, string> = {
  source: 'Source Code',
  accessibility: 'Accessibility',
  visual: 'Visual Regression',
  performance: 'Performance',
  e2e: 'Browser Tests',
};

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isBrowserFinding(f: Finding): f is BrowserFinding {
  return 'url' in f && 'viewport' in f;
}

function getStyles(): string {
  return `
    :root {
      --bg-primary: #FFFFFF;
      --bg-secondary: #F6F8FA;
      --accent: #2F81F7;
      --text-primary: #1C2128;
      --text-secondary: #57606A;
      --severity-critical: #DA3633;
      --severity-high: #DA3633;
      --severity-medium: #D29922;
      --severity-low: #3FB950;
      --severity-info: #8B949E;
      --font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #0D1117;
        --bg-secondary: #161B22;
        --text-primary: #E6EDF3;
        --text-secondary: #8B949E;
      }
    }

    html {
      scroll-behavior: smooth;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-body);
      font-size: 14px;
      font-weight: 400;
      line-height: 1.5;
      background: var(--bg-primary);
      color: var(--text-primary);
      max-width: 1200px;
      margin: 0 auto;
      padding: 64px 16px;
    }

    h1 {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.2;
      margin-bottom: 8px;
    }

    h2 {
      font-size: 20px;
      font-weight: 600;
      line-height: 1.2;
      margin-bottom: 16px;
    }

    h3 {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      margin-bottom: 8px;
      margin-top: 24px;
    }

    .subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }

    .badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .badge-critical {
      background: var(--severity-critical);
      color: #FFFFFF;
    }

    .badge-high {
      background: var(--severity-high);
      color: #FFFFFF;
    }

    .badge-medium {
      background: var(--severity-medium);
      color: #1C2128;
    }

    .badge-low {
      background: var(--severity-low);
      color: #1C2128;
    }

    .badge-info {
      background: var(--severity-info);
      color: #1C2128;
    }

    nav {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 16px 0;
      border-bottom: 1px solid var(--bg-secondary);
      margin-bottom: 32px;
    }

    nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: var(--accent);
      border-radius: 4px;
      font-size: 14px;
      font-weight: 600;
    }

    nav a:hover {
      background: var(--bg-secondary);
    }

    section {
      margin-bottom: 48px;
    }

    .card {
      border-left: 4px solid;
      background: var(--bg-secondary);
      padding: 16px;
      margin-bottom: 8px;
      border-radius: 4px;
    }

    .card-critical {
      border-left-color: var(--severity-critical);
    }

    .card-high {
      border-left-color: var(--severity-high);
    }

    .card-medium {
      border-left-color: var(--severity-medium);
    }

    .card-low {
      border-left-color: var(--severity-low);
    }

    .card-info {
      border-left-color: var(--severity-info);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      background: var(--bg-primary);
      color: var(--text-secondary);
    }

    .card-body {
      margin-bottom: 8px;
    }

    .card-url {
      font-size: 12px;
      color: var(--text-secondary);
      font-family: var(--font-mono);
    }

    .fix {
      font-size: 14px;
      margin-top: 8px;
      padding: 8px;
      background: var(--bg-primary);
      border-radius: 4px;
    }

    .fix strong {
      color: var(--accent);
    }

    pre {
      background: var(--bg-primary);
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin-top: 8px;
    }

    pre code {
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.6;
    }

    details summary {
      cursor: pointer;
      color: var(--accent);
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }

    details img {
      max-width: 100%;
      margin-top: 8px;
      border-radius: 4px;
    }

    .diff-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
    }

    .diff-grid img {
      max-width: 100%;
      border-radius: 4px;
    }

    .diff-label {
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .diff-stats {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 8px;
    }

    @media (max-width: 768px) {
      .diff-grid {
        grid-template-columns: 1fr;
      }
    }

    .perf-table-wrapper {
      overflow-x: auto;
      margin-top: 16px;
    }

    .perf-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .perf-table th,
    .perf-table td {
      padding: 8px 16px;
      text-align: left;
      border-bottom: 1px solid var(--bg-secondary);
    }

    .perf-table th {
      font-weight: 600;
      font-size: 12px;
      color: var(--text-secondary);
      text-transform: uppercase;
    }

    .over-budget {
      background: #DA363310;
    }

    .status-pass {
      color: var(--severity-low);
    }

    .status-fail {
      color: var(--severity-critical);
    }

    .clean-state {
      text-align: center;
      padding: 48px 16px;
    }

    .clean-state h2 {
      font-size: 28px;
      margin-bottom: 16px;
    }

    footer {
      margin-top: 64px;
      padding-top: 24px;
      border-top: 1px solid var(--bg-secondary);
      text-align: center;
      font-size: 12px;
      color: var(--text-secondary);
    }

    @media print {
      nav {
        display: none;
      }
      details[open] summary ~ * {
        display: block;
      }
      .card {
        break-inside: avoid;
      }
      body {
        max-width: 100%;
      }
    }
  `;
}

function renderHeader(metadata: ReportMetadata, summary: ReportSummary): string {
  const badges = SEVERITY_ORDER
    .filter(sev => summary.bySeverity[sev] > 0)
    .map(sev => `<span class="badge badge-${sev}">${summary.bySeverity[sev]} ${sev}</span>`)
    .join('\n        ');

  if (summary.total === 0) {
    return `
    <header>
      <h1>Sniff QA Report</h1>
      <p class="subtitle">Generated ${htmlEscape(metadata.timestamp)} | ${summary.pagesScanned} pages scanned | 0 issues found</p>
      <div class="clean-state">
        <h2>Clean Bill of Health</h2>
        <p>No issues found across ${summary.pagesScanned} pages. Either your app is flawless or sniff missed something. Run again with --verbose to be sure.</p>
      </div>
    </header>`;
  }

  return `
    <header>
      <h1>Sniff QA Report</h1>
      <p class="subtitle">Generated ${htmlEscape(metadata.timestamp)} | ${summary.pagesScanned} pages scanned | ${summary.total} issues found</p>
      <div class="badges">
        ${badges}
      </div>
    </header>`;
}

function renderNav(byScanner: Record<string, number>): string {
  const links: string[] = [];

  for (const { name, displayName } of SCANNER_PREFIXES) {
    if (byScanner[name] && byScanner[name] > 0) {
      links.push(`<a href="#section-${name}">${displayName}</a>`);
    }
  }

  if (links.length === 0) return '';

  return `
    <nav>
      ${links.join('\n      ')}
    </nav>`;
}

function groupFindingsByScanner(findings: Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();

  for (const finding of findings) {
    let matched = false;
    for (const { prefix, name } of SCANNER_PREFIXES) {
      if (finding.ruleId.startsWith(prefix)) {
        const existing = groups.get(name) ?? [];
        existing.push(finding);
        groups.set(name, existing);
        matched = true;
        break;
      }
    }
    if (!matched) {
      const existing = groups.get('other') ?? [];
      existing.push(finding);
      groups.set('other', existing);
    }
  }

  return groups;
}

function renderFindingCard(finding: Finding, report: SniffReport): string {
  const severity = finding.severity;
  const parts: string[] = [];

  // Header
  const headerTags: string[] = [
    `<span class="badge badge-${severity}">${severity}</span>`,
  ];

  // Scanner type tag
  for (const { prefix, displayName } of SCANNER_PREFIXES) {
    if (finding.ruleId.startsWith(prefix)) {
      headerTags.push(`<span class="tag">${displayName}</span>`);
      break;
    }
  }

  // Viewport tag and URL for browser findings
  if (isBrowserFinding(finding)) {
    if (finding.viewport) {
      headerTags.push(`<span class="tag">${htmlEscape(finding.viewport)}</span>`);
    }
    if (finding.url) {
      headerTags.push(`<span class="card-url">${htmlEscape(finding.url)}</span>`);
    }
  }

  parts.push(`<div class="card-header">${headerTags.join(' ')}</div>`);

  // Body
  parts.push(`<div class="card-body">${htmlEscape(finding.message)}</div>`);

  // Fix suggestion
  if (isBrowserFinding(finding) && finding.fixSuggestion) {
    parts.push(`<p class="fix"><strong>Fix:</strong> ${htmlEscape(finding.fixSuggestion)}</p>`);
  }

  // Code snippet
  if (finding.snippet && finding.snippet.trim().length > 0) {
    // Check if this is a visual regression with path info
    if (finding.ruleId.startsWith('visual/regression')) {
      parts.push(renderVisualDiff(finding, report));
    } else {
      parts.push(`<pre><code>${htmlEscape(finding.snippet)}</code></pre>`);
    }
  }

  // Screenshot
  if (isBrowserFinding(finding) && finding.screenshotPath) {
    const screenshot = report.screenshots.find(
      s => s.path === finding.screenshotPath && s.base64,
    );
    if (screenshot?.base64) {
      parts.push(`<details><summary>Screenshot</summary><img src="data:image/png;base64,${screenshot.base64}" alt="${htmlEscape(screenshot.caption)}" style="max-width:100%"></details>`);
    }
  }

  return `<div class="card card-${severity}">${parts.join('\n')}</div>`;
}

function renderVisualDiff(finding: Finding, report: SniffReport): string {
  // Parse paths from snippet: "Baseline: path\nCurrent: path\nDiff: path"
  const lines = finding.snippet.split('\n');
  const paths: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^(Baseline|Current|Diff):\s*(.+)$/);
    if (match) {
      paths[match[1].toLowerCase()] = match[2].trim();
    }
  }

  const getBase64 = (path: string): string | undefined => {
    const screenshot = report.screenshots.find(s => s.path === path && s.base64);
    return screenshot?.base64;
  };

  const columns: string[] = [];
  for (const label of ['baseline', 'current', 'diff']) {
    const path = paths[label];
    const b64 = path ? getBase64(path) : undefined;
    if (b64) {
      columns.push(`<div><div class="diff-label">${label.charAt(0).toUpperCase() + label.slice(1)}</div><img src="data:image/png;base64,${b64}" alt="${htmlEscape(label)}"></div>`);
    } else {
      columns.push(`<div><div class="diff-label">${label.charAt(0).toUpperCase() + label.slice(1)}</div><p class="diff-stats">Image not available</p></div>`);
    }
  }

  return `<div class="diff-grid">${columns.join('')}</div><p class="diff-stats">${htmlEscape(finding.message)}</p>`;
}

function renderSeverityGroups(findings: Finding[], report: SniffReport): string {
  const parts: string[] = [];

  for (const severity of SEVERITY_ORDER) {
    const group = findings.filter(f => f.severity === severity);
    if (group.length === 0) continue;

    parts.push(`<h3>${severity.toUpperCase()}: ${group.length} issues</h3>`);
    for (const finding of group) {
      parts.push(renderFindingCard(finding, report));
    }
  }

  return parts.join('\n');
}

function renderPerfTable(report: SniffReport): string {
  if (!report.performanceMetrics) return '';

  const defaultBudgets = { lcp: 2500, fcp: 1800, tti: 3800 };
  const parts: string[] = [];

  for (const [url, metrics] of Object.entries(report.performanceMetrics)) {
    parts.push(`<h3>${htmlEscape(url)}</h3>`);
    parts.push('<div class="perf-table-wrapper"><table class="perf-table">');
    parts.push('<thead><tr><th>Metric</th><th>Value</th><th>Budget</th><th>Status</th></tr></thead>');
    parts.push('<tbody>');

    const rows: Array<{ name: string; value: number | null; budget: number }> = [
      { name: 'LCP', value: metrics.lcp, budget: defaultBudgets.lcp },
      { name: 'FCP', value: metrics.fcp, budget: defaultBudgets.fcp },
      { name: 'TTI', value: metrics.tti, budget: defaultBudgets.tti },
    ];

    for (const row of rows) {
      if (row.value === null) continue;
      const overBudget = row.value > row.budget;
      const rowClass = overBudget ? ' class="over-budget"' : '';
      const statusIcon = overBudget
        ? '<span class="status-fail">&#10007;</span>'
        : '<span class="status-pass">&#10003;</span>';
      parts.push(`<tr${rowClass}><td>${row.name}</td><td>${Math.round(row.value)}ms</td><td>${row.budget}ms</td><td>${statusIcon}</td></tr>`);
    }

    if (metrics.score !== null && metrics.score !== undefined) {
      parts.push(`<tr><td>Score</td><td>${Math.round(metrics.score)}</td><td>-</td><td>-</td></tr>`);
    }

    parts.push('</tbody></table></div>');
  }

  return parts.join('\n');
}

function renderSections(report: SniffReport): string {
  const scannerGroups = groupFindingsByScanner(report.findings);
  const parts: string[] = [];

  for (const { name, displayName } of SCANNER_PREFIXES) {
    const findings = scannerGroups.get(name);
    if (!findings || findings.length === 0) continue;

    parts.push(`<section id="section-${name}">`);
    parts.push(`<h2>${displayName}</h2>`);

    if (name === 'performance') {
      parts.push(renderSeverityGroups(findings, report));
      parts.push(renderPerfTable(report));
    } else {
      parts.push(renderSeverityGroups(findings, report));
    }

    parts.push('</section>');
  }

  // Handle unmatched findings
  const other = scannerGroups.get('other');
  if (other && other.length > 0) {
    parts.push('<section id="section-other">');
    parts.push('<h2>Other</h2>');
    parts.push(renderSeverityGroups(other, report));
    parts.push('</section>');
  }

  return parts.join('\n');
}

function renderFooter(version: string): string {
  return `
    <footer>
      <p>Generated by sniff v${htmlEscape(version)}. No sugar-coating, no excuses.</p>
    </footer>`;
}

export function generateHtmlReport(report: SniffReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sniff QA Report</title>
  <style>${getStyles()}</style>
</head>
<body>
  ${renderHeader(report.metadata, report.summary)}
  ${renderNav(report.summary.byScanner)}
  <main>
    ${renderSections(report)}
  </main>
  ${renderFooter(report.metadata.version)}
</body>
</html>`;
}
