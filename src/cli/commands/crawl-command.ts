import { join } from 'node:path';
import type { Severity } from '../../core/types.js';
import type { AssertConfig } from '../../config/schema.js';
import type { QaFinding as CrawlFinding } from '../../crawl/types.js';
import { evaluateSeverityBudget, printBudgetViolations } from '../../core/assert-budget.js';

export interface CrawlCommandOptions {
  rootDir: string;
  url: string;
  headless?: boolean;
  json?: boolean;
  /** Write a self-contained HTML report. */
  report?: boolean;
  /** Show low-confidence (uncertain) findings too. */
  all?: boolean;
  maxPages?: number;
  /** Include the mobile (375px) pass. Default true. */
  mobile?: boolean;
  failOn?: string;
  ci?: boolean;
  /** Playwright storage-state file, so the walk runs as a logged-in user. */
  storageState?: string;
  /** Assertion budgets from config, enforced on top of `failOn`. */
  assert?: AssertConfig;
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

/**
 * The exit decision for a walk, pulled out so it can be tested without a
 * browser. `failOn` and the assert budget are both evaluated over the SHOWN
 * findings, the same set the report displays, so a hidden low-confidence
 * finding can never fail CI on its own.
 */
export function decideCrawlExit(input: {
  findings: readonly CrawlFinding[];
  all?: boolean;
  failOn?: string;
  assert?: AssertConfig;
}): { exitCode: number; shown: CrawlFinding[]; violations: string[] } {
  const failOn = (input.failOn ?? 'critical,high')
    .split(',').map((s) => s.trim()).filter((s): s is Severity => VALID_SEVERITIES.has(s));
  const shown = input.findings.filter((f) => input.all || f.confidence !== 'uncertain');
  const failsOnSeverity = shown.some((f) => failOn.includes(f.severity));
  const budget = evaluateSeverityBudget(shown, input.assert);
  return {
    exitCode: failsOnSeverity || !budget.passed ? 1 : 0,
    shown,
    violations: budget.violations,
  };
}

/**
 * The default browser experience: drive a real browser, walk the app's flows,
 * and report real issues with proof. Returns the process exit code.
 */
export async function crawlCommand(opts: CrawlCommandOptions): Promise<number> {
  const pc = (await import('picocolors')).default;
  const { runCrawl, formatReportText } = await import('../../crawl/index.js');
  const { writeCrawlArtifacts } = await import('../../crawl/write-report.js');

  const reportDir = join(opts.rootDir, 'sniff-reports');
  const isCi = opts.ci || !!process.env.CI;

  if (!opts.json) {
    const { getVersion } = await import('../../version.js');
    console.log(`\n${pc.bold('sniff')} v${getVersion()}  ${pc.dim('walking')} ${pc.bold(opts.url)}\n`);
  }

  const report = await runCrawl({
    startUrl: opts.url,
    headless: opts.headless ?? true,
    includeMobile: opts.mobile ?? true,
    ...(opts.maxPages ? { maxPages: opts.maxPages } : {}),
    outputDir: join(reportDir, 'crawl'),
    ...(opts.storageState ? { storageState: opts.storageState } : {}),
    onProgress: opts.json ? undefined : (m) => process.stderr.write(`  ${pc.dim('·')} ${pc.dim(m)}\n`),
  });

  // Persist the machine-readable report so `sniff` integrates with CI/agents.
  // Both artifacts go through one writer, which redacts before rendering.
  const artifacts = await writeCrawlArtifacts({
    reportDir,
    report,
    html: opts.report === true,
    title: `sniff: ${new URL(opts.url).host}`,
  });

  if (opts.report && artifacts.htmlPath && !opts.json) {
    console.log(pc.dim(`  HTML report: ${artifacts.htmlPath}`));
  }

  // Exit code: fail on shown findings at the configured severities, or on a
  // breached assert budget.
  const decision = decideCrawlExit({
    findings: report.findings,
    ...(opts.all !== undefined ? { all: opts.all } : {}),
    ...(opts.failOn !== undefined ? { failOn: opts.failOn } : {}),
    ...(opts.assert !== undefined ? { assert: opts.assert } : {}),
  });
  const shown = decision.shown;
  printBudgetViolations({ passed: decision.violations.length === 0, violations: decision.violations });
  const hasFailure = decision.exitCode === 1;

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReportText(report, { all: opts.all }));
    // Make "ran fine, found bugs" unmistakable: a non-zero exit must not read
    // like a crash (first-time-user feedback).
    if (hasFailure) {
      console.log(pc.green('✓ Scan complete') + pc.dim(`: ${shown.length} issue(s) found. Exit code 1 so CI fails on bugs; pass `) + pc.bold('--fail-on none') + pc.dim(' to always exit 0.'));
    } else {
      console.log(pc.green('✓ Scan complete') + pc.dim(`: ${shown.length} issue(s) found.`));
    }
  }
  return hasFailure ? 1 : 0;
}
