export { runCrawl } from './engine.js';
export type { CrawlOptions } from './engine.js';
export type {
  QaFinding,
  RawFinding,
  CrawlReport,
  CrawlStats,
  Reproduction,
  Confidence,
  Severity,
} from './types.js';

import type { CrawlReport, QaFinding } from './types.js';

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;

/**
 * Render a CrawlReport as a readable CLI summary. By default `uncertain`
 * findings are hidden (shown with `all: true`).
 */
export function formatReportText(report: CrawlReport, opts: { all?: boolean } = {}): string {
  const shown = report.findings.filter((f) => opts.all || f.confidence !== 'uncertain');
  const hidden = report.findings.length - shown.length;
  const lines: string[] = [];

  lines.push('');
  lines.push(`  sniff crawl — ${report.stats.pagesVisited} pages, ${report.stats.linksChecked} links, ${(report.stats.durationMs / 1000).toFixed(1)}s`);
  lines.push(`  ${shown.length} finding${shown.length === 1 ? '' : 's'}${hidden > 0 ? ` (+${hidden} low-confidence hidden; use --all)` : ''}`);
  lines.push('');

  if (shown.length === 0) {
    lines.push('  No issues found. ✓');
    lines.push('');
    return lines.join('\n');
  }

  const bySev = new Map<string, QaFinding[]>();
  for (const f of shown) {
    const arr = bySev.get(f.severity) ?? [];
    arr.push(f);
    bySev.set(f.severity, arr);
  }

  for (const sev of SEV_ORDER) {
    const arr = bySev.get(sev);
    if (!arr || arr.length === 0) continue;
    lines.push(`  ${sev.toUpperCase()} (${arr.length})`);
    for (const f of arr) {
      lines.push(`    • [${f.confidence}] ${f.title}`);
      lines.push(`      ${f.reproduction.route}  (${f.ruleId})`);
      for (const s of f.reproduction.steps) lines.push(`        - ${s}`);
      lines.push(`      fix: ${f.suggestedFix}`);
      if (f.needsOutOfBandVerification) lines.push(`      note: needs out-of-band verification (e.g. confirm the email/job actually completed)`);
      if (f.reproduction.screenshotPath) lines.push(`      shot: ${f.reproduction.screenshotPath}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
