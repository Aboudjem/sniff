import { join } from 'node:path';
import type { Severity } from '../../core/types.js';

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
}

const VALID_SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

/**
 * The default browser experience: drive a real browser, walk the app's flows,
 * and report real issues with proof. Returns the process exit code.
 */
export async function crawlCommand(opts: CrawlCommandOptions): Promise<number> {
  const pc = (await import('picocolors')).default;
  const { runCrawl, formatReportText, renderHtmlReport } = await import('../../crawl/index.js');
  const { writeFile, mkdir } = await import('node:fs/promises');

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
    onProgress: opts.json ? undefined : (m) => process.stderr.write(`  ${pc.dim('·')} ${pc.dim(m)}\n`),
  });

  // Persist the machine-readable report so `sniff` integrates with CI/agents.
  await mkdir(reportDir, { recursive: true }).catch(() => {});
  await writeFile(join(reportDir, 'sniff-crawl.json'), JSON.stringify(report, null, 2)).catch(() => {});

  if (opts.report) {
    const html = renderHtmlReport(report, { title: `sniff — ${new URL(opts.url).host}` });
    const htmlPath = join(reportDir, 'sniff-report.html');
    await writeFile(htmlPath, html).catch(() => {});
    if (!opts.json) console.log(pc.dim(`  HTML report: ${htmlPath}`));
  }

  // Exit code: fail on shown findings at/above the configured severities.
  const failOn = (opts.failOn ?? 'critical,high')
    .split(',').map((s) => s.trim()).filter((s): s is Severity => VALID_SEVERITIES.has(s));
  const shown = report.findings.filter((f) => opts.all || f.confidence !== 'uncertain');
  const hasFailure = shown.some((f) => failOn.includes(f.severity));

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatReportText(report, { all: opts.all }));
    // Make "ran fine, found bugs" unmistakable — a non-zero exit must not read
    // like a crash (first-time-user feedback).
    if (hasFailure) {
      console.log(pc.green('✓ Scan complete') + pc.dim(` — ${shown.length} issue(s) found. Exit code 1 so CI fails on bugs; pass `) + pc.bold('--fail-on none') + pc.dim(' to always exit 0.'));
    } else {
      console.log(pc.green('✓ Scan complete') + pc.dim(` — ${shown.length} issue(s) found.`));
    }
  }
  return hasFailure ? 1 : 0;
}
