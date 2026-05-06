import type { Severity } from '../../core/types.js';
import type { Screenshot } from '../../report/types.js';

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

export async function runCommand(options: {
  headless?: boolean;
  baseUrl?: string;
  format?: string;
  failOn?: string;
  json?: boolean;
  trackFlakes?: boolean;
  ci?: boolean;
}): Promise<void> {
  const pc = (await import('picocolors')).default;
  const { loadConfig } = await import('../../config/loader.js');
  const { buildReport, saveReport } = await import('../../report/model.js');
  const { formatBrowserFindings } = await import('../formatter.js');
  const { runSourceScan, routesFromAnalysis, runBrowserAudit } = await import('../../core/quality-run.js');

  const rootDir = process.cwd();
  const config = await loadConfig(rootDir);

  // CI mode (D-10): force headless and include JUnit XML format
  const isCi = options.ci || !!process.env.CI;
  if (isCi) {
    options.headless = true;
    // Ensure junit is in report formats
    if (options.format) {
      const fmts = options.format.split(',').map((f) => f.trim());
      if (!fmts.includes('junit')) {
        fmts.push('junit');
        options.format = fmts.join(',');
      }
    } else if (config.report?.formats) {
      const fmts = [...config.report.formats];
      if (!fmts.includes('junit')) {
        fmts.push('junit');
      }
      options.format = fmts.join(',');
    } else {
      options.format = 'html,json,junit';
    }
  }

  // Resolve baseUrl (T-03-13: validate URL is well-formed)
  const baseUrl = options.baseUrl ?? config.browser?.baseUrl;
  if (!baseUrl) {
    console.error(
      pc.red(
        'No base URL configured. Set browser.baseUrl in sniff.config.ts or pass --base-url.',
      ),
    );
    process.exit(1);
  }

  // Validate baseUrl is a well-formed URL (T-03-13 mitigation)
  try {
    new URL(baseUrl);
  } catch {
    console.error(
      pc.red(`Invalid base URL: "${baseUrl}". Provide a valid URL (e.g., http://localhost:3000).`),
    );
    process.exit(1);
  }

  const viewports = config.viewports ?? [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
  ];

  const { getVersion } = await import('../../version.js');
  console.log(`\nSniff v${getVersion()} - Running quality scan\n`);

  const sourceRun = await runSourceScan(rootDir);
  const routes = routesFromAnalysis(sourceRun.analysis);

  // Run browser tests (T-03-14: timeout enforced via context, browser closed in finally)
  let result;
  try {
    result = await runBrowserAudit({
      rootDir,
      config,
      baseUrl,
      routes,
      headless: options.headless ?? config.browser?.headless ?? true,
    });
  } catch (err) {
    const projects = config.browser?.projects?.join(' ') ?? 'chromium';
    console.error(
      pc.red(
        `Failed to launch browser. Ensure Playwright browsers are installed: npx playwright install ${projects}`,
      ),
    );
    process.exit(1);
  }

  // Print progress per page visit
  if (!options.json) {
    for (const visit of result.browserRun.pageVisits) {
      const count = visit.findings.length;
      const suffix =
        count === 0
          ? pc.green('0 findings')
          : pc.yellow(`${count} finding${count !== 1 ? 's' : ''}`);
      console.log(`  ${pc.dim(`${visit.browser}/${visit.viewport}`)} ${pc.dim(visit.url)}... done (${suffix})`);
    }
  }

  const perfResult = result.results.find((r) => r.scanner === 'performance' && !r.metadata?.urlsCollected);
  if (!options.json) {
    console.log(
      `${pc.blue(pc.bold('[perf]'))} done (${perfResult?.findings.length ?? 0} budget violation${perfResult?.findings.length !== 1 ? 's' : ''})`,
    );
  }

  // Combine all results
  const allResults = [...sourceRun.results, ...result.results];
  const allFindings = allResults.flatMap((r) => r.findings);

  // Collect screenshots from page visits
  const screenshots: Screenshot[] = result.screenshots;

  // Build report
  const report = buildReport(
    allResults,
    {
      timestamp: new Date().toISOString(),
      duration: result.duration,
      targetUrl: baseUrl,
      viewports,
      commandUsed: 'sniff run',
    },
    screenshots,
  );

  // Save reports in configured formats
  const formats = options.format
    ? options.format.split(',').map((f) => f.trim())
    : config.report?.formats ?? ['html', 'json'];
  const savedPaths = await saveReport(process.cwd(), report, formats);

  // Display terminal output
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`\n---\n`);
    console.log(formatBrowserFindings(allFindings));
    for (const p of savedPaths) {
      console.log(pc.dim(`Report saved to: ${p}`));
    }
  }

  // Post-run flakiness tracking (D-07: opt-in local, default-on in CI)
  const trackFlakes = options.trackFlakes || isCi;
  if (trackFlakes) {
    const { buildTestRunRecords } = await import('../../core/flakiness.js');
    const { appendRunHistory } = await import('../../core/persistence.js');
    const runId = new Date().toISOString();
    const records = buildTestRunRecords(allResults, runId);
    await appendRunHistory(process.cwd(), records);
  }

  // Exit code (same pattern as scanCommand)
  const failOnInput = options.failOn ?? 'critical,high';
  const failOnSeverities = failOnInput
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Severity => {
      if (!VALID_SEVERITIES.has(s)) {
        console.error(
          `Warning: Unknown severity "${s}" in --fail-on, ignoring.`,
        );
        return false;
      }
      return true;
    });

  // Load flakiness history and filter out quarantined tests (D-04/CI-04)
  const { loadFlakinessHistory } = await import('../../core/persistence.js');
  const history = await loadFlakinessHistory(process.cwd());
  const flakyTestIds = new Set(history?.flaky ?? []);
  const { buildTestId } = await import('../../core/flakiness.js');

  const hasFailure = allFindings.some((f) => {
    if (!failOnSeverities.includes(f.severity)) return false;
    // Determine scanner name from the result that contains this finding
    const parentResult = allResults.find((r) => r.findings.includes(f));
    const scanner = parentResult?.scanner ?? 'unknown';
    return !flakyTestIds.has(buildTestId(scanner, f));
  });

  if (flakyTestIds.size > 0 && !options.json) {
    console.log(pc.yellow(`\n  ${flakyTestIds.size} flaky test(s) quarantined (run but not blocking exit code)`));
  }

  process.exit(hasFailure ? 1 : 0);
}
