import type { AnalysisResult } from '../analyzers/types.js';
import type { SniffConfig, BrowserProject } from '../config/schema.js';
import type { BrowserRunResult } from '../browser/types.js';
import type { ScanResult } from '../scanners/types.js';
import type { Screenshot } from '../report/types.js';

export interface SourceScanRun {
  config: SniffConfig;
  results: ScanResult[];
  analysis?: AnalysisResult;
}

export interface BrowserAuditRun {
  browserRun: BrowserRunResult;
  results: ScanResult[];
  screenshots: Screenshot[];
  duration: number;
}

export async function runSourceScan(rootDir: string): Promise<SourceScanRun> {
  const { loadConfig } = await import('../config/loader.js');
  const { ScannerRegistry } = await import('../scanners/registry.js');
  const { SourceScanner } = await import('../scanners/source/index.js');
  const { RepoAnalyzer } = await import('../scanners/repo-analyzer.js');

  const config = await loadConfig(rootDir);
  const registry = new ScannerRegistry();
  registry.register(new SourceScanner());
  registry.register(new RepoAnalyzer());

  const results = await registry.runAll({ config, rootDir });
  const repoResult = results.find((r) => r.scanner === 'repo-analyzer');
  const analysis = repoResult?.metadata?.analysis as AnalysisResult | undefined;

  return { config, results, analysis };
}

export function routesFromAnalysis(analysis?: AnalysisResult): string[] {
  const routes = analysis?.routes
    ?.map((route) => route.path)
    .filter((route): route is string => typeof route === 'string' && route.length > 0);

  return routes && routes.length > 0 ? routes : ['/'];
}

export async function generateAiTestsIfEnabled(
  rootDir: string,
  config: SniffConfig,
  analysis?: AnalysisResult,
): Promise<void> {
  if (!analysis) return;

  const { generateTests } = await import('../ai/generator.js');
  await generateTests(analysis, {
    outputDir: config.ai?.outputDir ?? 'sniff-tests',
    maxConcurrency: config.ai?.maxConcurrency ?? 5,
    rootDir,
    ai: config.ai,
  });
}

export async function runBrowserAudit(options: {
  rootDir: string;
  config: SniffConfig;
  baseUrl: string;
  routes?: string[];
  headless: boolean;
}): Promise<BrowserAuditRun> {
  const { BrowserRunner } = await import('../browser/runner.js');
  const { AccessibilityScanner } = await import('../scanners/accessibility/index.js');
  const { VisualRegressionScanner } = await import('../scanners/visual/index.js');
  const { PerformanceScanner } = await import('../scanners/performance/index.js');

  const viewports = options.config.viewports ?? [
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
  ];
  const projects: BrowserProject[] = options.config.browser?.projects ?? ['chromium'];

  const runner = new BrowserRunner(options.config);
  const perfScanner = new PerformanceScanner();
  runner.registerScanner(new AccessibilityScanner());
  runner.registerScanner(new VisualRegressionScanner());
  runner.registerScanner(perfScanner);

  const browserRun = await runner.run({
    baseUrl: options.baseUrl,
    testFiles: options.routes && options.routes.length > 0 ? options.routes : ['/'],
    viewports,
    projects,
    rootDir: options.rootDir,
    headless: options.headless,
    slowMo: options.config.browser?.slowMo ?? 0,
    timeout: options.config.browser?.timeout ?? 30000,
  });

  const results = [...browserRun.scanResults];
  if (options.config.scanners.includes('performance')) {
    results.push(await perfScanner.measureAll());
  }

  const screenshots = browserRun.pageVisits
    .filter((visit) => visit.screenshotPath)
    .map((visit) => ({
      path: visit.screenshotPath!,
      url: visit.url,
      viewport: `${visit.browser}/${visit.viewport}`,
      caption: `${visit.browser} ${visit.viewport} - ${visit.url}`,
    }));

  return {
    browserRun,
    results,
    screenshots,
    duration: browserRun.duration,
  };
}
