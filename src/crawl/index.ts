export { runCrawl } from './engine.js';
export { renderHtmlReport } from './report-html.js';
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

import { relative, isAbsolute } from 'node:path';
import type { CrawlReport, QaFinding } from './types.js';
import { SEV_ORDER, fixFirst, verdictLine } from './verdict.js';

export { fixFirst, severityCounts, verdictLine, isFailing } from './verdict.js';

export interface ReportTextOptions {
  /** Show `uncertain` findings too. */
  all?: boolean;
  /**
   * The real exit decision, when the caller has it (`--fail-on` plus the
   * assert budget). Left out, the verdict fails on a critical or high finding.
   */
  failed?: boolean;
  /** Screenshot paths under this folder print relative to it. */
  cwd?: string;
}

/** A path under `cwd` prints relative, so a report line stays short. */
function displayPath(path: string, cwd: string | undefined): string {
  if (!cwd || !isAbsolute(path)) return path;
  const rel = relative(cwd, path);
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? rel : path;
}

/**
 * Render a CrawlReport for the terminal. The order is fixed: the verdict, the
 * findings to fix first, then every finding by severity. By default
 * `uncertain` findings are hidden (shown with `all: true`).
 */
export function formatReportText(report: CrawlReport, opts: ReportTextOptions = {}): string {
  const shown = report.findings.filter((f) => opts.all || f.confidence !== 'uncertain');
  const hidden = report.findings.length - shown.length;
  const { pagesVisited, linksChecked, durationMs } = report.stats;
  const lines: string[] = [];

  lines.push('');
  lines.push(`  VERDICT  ${verdictLine(shown, opts.failed)}`);
  lines.push(
    `  Walked ${pagesVisited} page${pagesVisited === 1 ? '' : 's'}, checked ${linksChecked} link${linksChecked === 1 ? '' : 's'}, in ${(durationMs / 1000).toFixed(1)}s.` +
      (hidden > 0 ? ` ${hidden} low-confidence finding${hidden === 1 ? '' : 's'} hidden, show with --all.` : ''),
  );
  lines.push('');

  if (shown.length === 0) return lines.join('\n');

  const first = fixFirst(shown);
  lines.push(first.length === shown.length ? '  Fix these:' : '  Fix these first:');
  first.forEach((f, i) => {
    lines.push(`    ${i + 1}. ${f.title} on ${f.reproduction.route}  [${f.severity}]`);
  });
  lines.push('');
  lines.push('  Every finding, with the steps that reproduce it:');
  lines.push('');

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
      if (f.reproduction.screenshotPath) lines.push(`      shot: ${displayPath(f.reproduction.screenshotPath, opts.cwd)}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}
