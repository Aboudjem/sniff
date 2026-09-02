import type { Severity, Finding, BrowserFinding } from '../../core/types.js';
import type { ScanResult } from '../../scanners/types.js';

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'critical', 'high', 'medium', 'low', 'info',
]);

export interface UnifiedOptions {
  rootDir: string;
  url?: string;
  explore: boolean;
  maxSteps?: string;
  headless?: boolean;
  format?: string;
  failOn?: string;
  json?: boolean;
  ci?: boolean;
  trackFlakes?: boolean;
}

export async function unifiedCommand(options: UnifiedOptions): Promise<void> {
  const pc = (await import('picocolors')).default;
  const allResults: ScanResult[] = [];
  const isCi = options.ci || !!process.env.CI;

  // CI mode: force headless, ensure JUnit format
  if (isCi) {
    options.headless = true;
    if (options.format) {
      const fmts = options.format.split(',').map((f) => f.trim());
      if (!fmts.includes('junit')) fmts.push('junit');
      options.format = fmts.join(',');
    } else {
      options.format = 'html,json,junit';
    }
  }

  if (!options.json) {
    const { getVersion } = await import('../../version.js');
    console.log(`\n${pc.bold('sniff')} v${getVersion()}\n`);
  }

  // ── Phase 1: Source scan (always runs) ─────────────────────────

  if (!options.json) {
    console.log(`${pc.blue('[source]')} Scanning source code...`);
  }

  const { saveResults } = await import('../../core/persistence.js');
  const { runSourceScan, generateAiTestsIfEnabled } = await import('../../core/quality-run.js');

  const sourceRun = await runSourceScan(options.rootDir);
  const { config, results: sourceResults, analysis } = sourceRun;
  allResults.push(...sourceResults);

  const sourceFindings = sourceResults.flatMap((r) => r.findings);
  if (!options.json) {
    const high = sourceFindings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
    const med = sourceFindings.filter((f) => f.severity === 'medium' || f.severity === 'low').length;
    console.log(`${pc.blue('[source]')} ${sourceFindings.length} issues (${high} high, ${med} medium/low)`);
  }

  // Generate AI tests from analysis (only when running browser audit)
  if (options.url) {
    await generateAiTestsIfEnabled(options.rootDir, config, analysis);
  }

  // ── Phase 2: Browser tests (if URL provided) ──────────────────

  if (options.url) {
    // Validate URL
    try {
      new URL(options.url);
    } catch {
      console.error(pc.red(`Invalid URL: "${options.url}"`));
      process.exit(1);
    }

    if (!options.json) {
      console.log(`\n${pc.green('[browser]')} Testing ${options.url}...`);
    }

    const { routesFromAnalysis, runBrowserAudit } = await import('../../core/quality-run.js');

    const viewports = config.viewports ?? [
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
    ];

    const routes = routesFromAnalysis(analysis);
    let browserAudit;
    try {
      browserAudit = await runBrowserAudit({
        rootDir: options.rootDir,
        config,
        baseUrl: options.url,
        routes,
        headless: options.headless ?? config.browser?.headless ?? true,
      });
    } catch {
      const projects = config.browser?.projects?.join(' ') ?? 'chromium';
      console.error(pc.red(`Failed to launch browser. Run: npx playwright install ${projects}`));
      process.exit(1);
    }

    if (!options.json) {
      for (const visit of browserAudit.browserRun.pageVisits) {
        const count = visit.findings.length;
        const suffix = count === 0 ? pc.green('clean') : pc.yellow(`${count} finding${count !== 1 ? 's' : ''}`);
        console.log(`  ${pc.dim(`${visit.browser}/${visit.viewport}`)} ${pc.dim(visit.url)} ${suffix}`);
      }
    }

    const perfResult = browserAudit.results.find((r) => r.scanner === 'performance' && !r.metadata?.urlsCollected);
    if (perfResult && !options.json) {
      console.log(`${pc.green('[perf]')} ${perfResult.findings.length} budget violation${perfResult.findings.length !== 1 ? 's' : ''}`);
    }

    allResults.push(...browserAudit.results);

    // Build and save report
    const { buildReport, saveReport } = await import('../../report/model.js');
    const report = buildReport(
      allResults,
      {
        timestamp: new Date().toISOString(),
        duration: browserAudit.duration,
        targetUrl: options.url,
        viewports,
        commandUsed: 'sniff',
      },
      browserAudit.screenshots,
    );

    const formats = options.format
      ? options.format.split(',').map((f) => f.trim())
      : config.report?.formats ?? ['html', 'json'];
    const savedPaths = await saveReport(options.rootDir, report, formats);

    if (!options.json) {
      for (const p of savedPaths) {
        console.log(pc.dim(`  Report: ${p}`));
      }
    }
  }

  // ── Cross-reference: correlate source + browser findings ───────
  if (options.url) {
    const { crossReference, crossReferenceSummary } = await import('../../analyzers/cross-reference.js');
    const allFindingsSoFar = allResults.flatMap((r) => r.findings);
    const sourceFindingsForXref = allFindingsSoFar.filter((f) => !('url' in f));
    const browserFindingsForXref = allFindingsSoFar.filter((f) => 'url' in f);

    const corroborated = crossReference(sourceFindingsForXref, browserFindingsForXref);

    if (corroborated.length > 0) {
      const summary = crossReferenceSummary(corroborated);
      const xrefFindings = [...corroborated, ...(summary ? [summary] : [])];

      allResults.push({
        scanner: 'cross-reference',
        findings: xrefFindings,
        duration: 0,
      });

      if (!options.json) {
        console.log(`\n${pc.cyan('[xref]')} ${corroborated.length} finding(s) corroborated by source + browser evidence`);
      }
    }
  }

  // ── Phase 3: Chaos monkey exploration (if --explore) ───────────

  if (options.explore && options.url) {
    if (!options.json) {
      console.log(`\n${pc.magenta('[explore]')} Chaos monkey starting...`);
    }

    const { ExplorationRunner } = await import('../../exploration/runner.js');
    const { ClaudeExplorationProvider } = await import('../../exploration/claude-exploration-provider.js');

    const maxSteps = options.maxSteps ? parseInt(options.maxSteps, 10) : (config.exploration?.maxSteps ?? 50);
    const provider = new ClaudeExplorationProvider();
    const runner = new ExplorationRunner(config, provider);

    const result = await runner.explore({
      baseUrl: options.url,
      rootDir: options.rootDir,
      headless: options.headless ?? config.browser?.headless ?? true,
      maxSteps,
      timeout: config.exploration?.timeout ?? config.browser?.timeout ?? 30000,
      viewport: config.exploration?.viewport ?? { width: 1280, height: 720 },
    });

    // Save exploration log
    const { writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const dir = join(options.rootDir, '.sniff');
    await mkdir(dir, { recursive: true });
    const logPath = join(dir, `exploration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await writeFile(logPath, JSON.stringify({ actionLog: result.actionLog, findings: result.findings }, null, 2));

    const exploreResult: ScanResult = {
      scanner: 'exploration',
      findings: result.findings,
      duration: result.duration,
      metadata: { pagesVisited: result.pagesVisited, totalSteps: result.totalSteps },
    };
    allResults.push(exploreResult);

    if (!options.json) {
      console.log(`${pc.magenta('[explore]')} ${result.totalSteps} steps, ${result.pagesVisited.length} pages, ${result.findings.length} findings`);
    }
  } else if (options.explore && !options.url) {
    const pc = (await import('picocolors')).default;
    console.error(pc.red('--explore requires --url. Example: sniff --url http://localhost:3000 --explore'));
    process.exit(1);
  }

  // ── Results ────────────────────────────────────────────────────

  await saveResults(options.rootDir, allResults);

  const allFindings = allResults.flatMap((r) => r.findings);

  // Flakiness tracking
  const trackFlakes = options.trackFlakes || isCi;
  if (trackFlakes) {
    const { buildTestRunRecords } = await import('../../core/flakiness.js');
    const { appendRunHistory } = await import('../../core/persistence.js');
    const records = buildTestRunRecords(allResults, new Date().toISOString());
    await appendRunHistory(options.rootDir, records);
  }

  // Output
  if (options.json) {
    const bySeverity: Record<string, number> = {};
    for (const f of allFindings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }
    console.log(JSON.stringify({ findings: allFindings, summary: { total: allFindings.length, bySeverity } }, null, 2));
  } else if (!options.url) {
    // Source-only: show formatted findings
    const { formatFindings } = await import('../formatter.js');
    console.log(formatFindings(allFindings));
  } else {
    // Browser mode: show summary
    const { formatBrowserFindings } = await import('../formatter.js');
    const browserFindings = allFindings.filter((f): f is BrowserFinding => 'url' in f);
    const sourceFindings = allFindings.filter((f) => !('url' in f));
    if (sourceFindings.length > 0) {
      const { formatFindings } = await import('../formatter.js');
      console.log(formatFindings(sourceFindings));
    }
    if (browserFindings.length > 0) {
      console.log(formatBrowserFindings(browserFindings));
    }
  }

  // Flakiness quarantine
  const { loadFlakinessHistory } = await import('../../core/persistence.js');
  const history = await loadFlakinessHistory(options.rootDir);
  const flakyTestIds = new Set(history?.flaky ?? []);
  const { buildTestId } = await import('../../core/flakiness.js');

  if (flakyTestIds.size > 0 && !options.json) {
    const pc = (await import('picocolors')).default;
    console.log(pc.yellow(`\n  ${flakyTestIds.size} flaky test(s) quarantined (not blocking exit code)`));
  }

  // Exit code
  const failOnInput = options.failOn ?? 'critical,high';
  const failOnSeverities = failOnInput
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Severity => {
      if (!VALID_SEVERITIES.has(s)) {
        console.error(`Warning: Unknown severity "${s}" in --fail-on, ignoring.`);
        return false;
      }
      return true;
    });

  const failsOnSeverity = allFindings.some((f) => {
    if (!failOnSeverities.includes(f.severity)) return false;
    const parentResult = allResults.find((r) => r.findings.includes(f));
    const scanner = parentResult?.scanner ?? 'unknown';
    return !flakyTestIds.has(buildTestId(scanner, f));
  });

  // Assertion budgets from config, additive to --fail-on. This is the exit gate
  // the public `sniff scan` subcommand reaches, since scanCommand has no
  // callers today.
  const { evaluateSeverityBudget, printBudgetViolations } = await import('../../core/assert-budget.js');
  const failsOnBudget = printBudgetViolations(evaluateSeverityBudget(allFindings, config.assert));

  process.exit(failsOnSeverity || failsOnBudget ? 1 : 0);
}
