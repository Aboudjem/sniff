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
    console.log(`\n${pc.bold('sniff')} v0.2.0\n`);
  }

  // ── Phase 1: Source scan (always runs) ─────────────────────────

  if (!options.json) {
    console.log(`${pc.blue('[source]')} Scanning source code...`);
  }

  const { loadConfig } = await import('../../config/loader.js');
  const { ScannerRegistry } = await import('../../scanners/registry.js');
  const { SourceScanner } = await import('../../scanners/source/index.js');
  const { RepoAnalyzer } = await import('../../scanners/repo-analyzer.js');
  const { saveResults } = await import('../../core/persistence.js');

  const config = await loadConfig(options.rootDir);
  const registry = new ScannerRegistry();
  registry.register(new SourceScanner());
  registry.register(new RepoAnalyzer());

  const ctx = { config, rootDir: options.rootDir };
  const sourceResults = await registry.runAll(ctx);
  allResults.push(...sourceResults);

  const sourceFindings = sourceResults.flatMap((r) => r.findings);
  if (!options.json) {
    const high = sourceFindings.filter((f) => f.severity === 'critical' || f.severity === 'high').length;
    const med = sourceFindings.filter((f) => f.severity === 'medium' || f.severity === 'low').length;
    console.log(`${pc.blue('[source]')} ${sourceFindings.length} issues (${high} high, ${med} medium/low)`);
  }

  // Generate AI tests from analysis (only when running browser audit)
  const repoResult = sourceResults.find((r) => r.scanner === 'repo-analyzer');
  if (options.url && repoResult?.metadata?.analysis) {
    const { generateTests } = await import('../../ai/generator.js');
    const analysis = repoResult.metadata.analysis as import('../../analyzers/types.js').AnalysisResult;
    const aiConfig = (config as Record<string, unknown>).ai as Record<string, unknown> | undefined;
    await generateTests(analysis, {
      outputDir: (aiConfig?.outputDir as string) ?? 'sniff-tests',
      maxConcurrency: (aiConfig?.maxConcurrency as number) ?? 5,
      rootDir: options.rootDir,
    });
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

    const { join } = await import('node:path');
    const { readdir } = await import('node:fs/promises');
    const { BrowserRunner } = await import('../../browser/runner.js');
    const { AccessibilityScanner } = await import('../../scanners/accessibility/index.js');
    const { VisualRegressionScanner } = await import('../../scanners/visual/index.js');
    const { PerformanceScanner } = await import('../../scanners/performance/index.js');

    const viewports = config.viewports ?? [
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'mobile', width: 375, height: 667 },
      { name: 'tablet', width: 768, height: 1024 },
    ];

    // Discover routes
    let routes: string[] = ['/'];
    try {
      const { readFile } = await import('node:fs/promises');
      const lastResults = JSON.parse(
        await readFile(join(options.rootDir, '.sniff', 'last-results.json'), 'utf-8'),
      );
      if (lastResults?.results) {
        const rr = lastResults.results.find((r: { scanner: string }) => r.scanner === 'repo-analyzer');
        if (rr?.metadata?.analysis?.routes?.length > 0) {
          routes = rr.metadata.analysis.routes.map((r: { path: string }) => r.path);
        }
      }
    } catch {
      // No previous analysis; use root route
    }

    const runner = new BrowserRunner(config);
    const a11yScanner = new AccessibilityScanner();
    const visualScanner = new VisualRegressionScanner();
    const perfScanner = new PerformanceScanner();
    runner.registerScanner(a11yScanner);
    runner.registerScanner(visualScanner);
    runner.registerScanner(perfScanner);

    let result;
    try {
      result = await runner.run({
        baseUrl: options.url,
        testFiles: routes,
        viewports,
        headless: options.headless ?? config.browser?.headless ?? true,
        slowMo: config.browser?.slowMo ?? 0,
        timeout: config.browser?.timeout ?? 30000,
      });
    } catch {
      console.error(pc.red('Failed to launch browser. Run: npx playwright install chromium'));
      process.exit(1);
    }

    if (!options.json) {
      for (const visit of result.pageVisits) {
        const count = visit.findings.length;
        const suffix = count === 0 ? pc.green('clean') : pc.yellow(`${count} finding${count !== 1 ? 's' : ''}`);
        console.log(`  ${pc.dim(visit.url)} ${suffix}`);
      }
    }

    // Lighthouse performance
    if (!options.json) {
      console.log(`${pc.green('[perf]')} Measuring performance...`);
    }
    const perfResult = await perfScanner.measureAll();
    if (!options.json) {
      console.log(`${pc.green('[perf]')} ${perfResult.findings.length} budget violation${perfResult.findings.length !== 1 ? 's' : ''}`);
    }

    allResults.push(...result.scanResults, perfResult);

    // Build and save report
    const { buildReport, saveReport } = await import('../../report/model.js');
    const screenshots = result.pageVisits
      .filter((v) => v.screenshotPath)
      .map((v) => ({
        path: v.screenshotPath!,
        url: v.url,
        viewport: v.viewport,
        caption: `${v.viewport} - ${v.url}`,
      }));

    const report = buildReport(
      allResults,
      {
        timestamp: new Date().toISOString(),
        duration: result.duration,
        targetUrl: options.url,
        viewports,
        commandUsed: 'sniff',
      },
      screenshots,
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

  const hasFailure = allFindings.some((f) => {
    if (!failOnSeverities.includes(f.severity)) return false;
    const parentResult = allResults.find((r) => r.findings.includes(f));
    const scanner = parentResult?.scanner ?? 'unknown';
    return !flakyTestIds.has(buildTestId(scanner, f));
  });

  process.exit(hasFailure ? 1 : 0);
}
