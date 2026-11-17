import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { Finding, BrowserFinding } from '../core/types.js';
import type { BrowserProject } from '../config/schema.js';

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
}

/** The hint every `needsSetup` result carries. */
export const SETUP_HINT =
  'Run the sniff_install MCP tool with the same projects if it is registered, otherwise run installCommand in a terminal, then retry.';

function jsonResult(value: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] };
}

/**
 * Run a browser tool. A launch that fails because the browser files are not
 * on disk (a download killed midway) returns the same `needsSetup` result as
 * the check before it, never Playwright's raw "npx playwright install" text.
 */
export async function withBrowserSetup(
  run: () => Promise<McpToolResult>,
  hint: string = SETUP_HINT,
): Promise<McpToolResult> {
  try {
    return await run();
  } catch (err) {
    const { needsSetupFromError } = await import('../core/ensure-browsers.js');
    const setup = needsSetupFromError(err, hint);
    if (setup) return jsonResult(setup);
    throw err;
  }
}

/**
 * Validate rootDir is absolute and exists on disk (T-04-15 mitigation).
 */
function validateRootDir(rootDir: string): string | null {
  const resolved = resolve(rootDir);
  if (resolved !== rootDir) {
    return `rootDir must be an absolute path, got: ${rootDir}`;
  }
  if (!existsSync(resolved)) {
    return `rootDir does not exist: ${resolved}`;
  }
  return null;
}

/**
 * Validate baseUrl is a valid http/https URL (T-04-16 mitigation).
 */
function validateBaseUrl(baseUrl: string): string | null {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `baseUrl must use http or https scheme, got: ${parsed.protocol}`;
    }
    return null;
  } catch {
    return `Invalid URL: ${baseUrl}`;
  }
}

export async function handleSniffScan(rootDir: string): Promise<McpToolResult> {
  const rootErr = validateRootDir(rootDir);
  if (rootErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: rootErr }) }] };
  }

  const { loadConfig } = await import('../config/loader.js');
  const { runSourceScan } = await import('../core/quality-run.js');
  const { saveResults } = await import('../core/persistence.js');

  await loadConfig(rootDir); // Preserve config validation errors in this path.
  const { results } = await runSourceScan(rootDir);
  await saveResults(rootDir, results);
  return {
    content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
  };
}

export async function handleSniffRun(
  rootDir: string,
  baseUrl: string,
  headless: boolean,
): Promise<McpToolResult> {
  return withBrowserSetup(() => sniffRun(rootDir, baseUrl, headless));
}

async function sniffRun(
  rootDir: string,
  baseUrl: string,
  headless: boolean,
): Promise<McpToolResult> {
  const rootErr = validateRootDir(rootDir);
  if (rootErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: rootErr }) }] };
  }

  const urlErr = validateBaseUrl(baseUrl);
  if (urlErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: urlErr }) }] };
  }

  const { runSourceScan, routesFromAnalysis, runBrowserAudit } = await import('../core/quality-run.js');
  const { saveResults } = await import('../core/persistence.js');

  const sourceRun = await runSourceScan(rootDir);
  const { checkPlaywrightBrowsers, needsSetupFromCheck } = await import('../core/ensure-browsers.js');
  const check = await checkPlaywrightBrowsers(sourceRun.config.browser?.projects, undefined, { headless });
  const setup = needsSetupFromCheck(check, sourceRun.config.browser?.projects, SETUP_HINT);
  if (setup) return jsonResult(setup);

  const browserRun = await runBrowserAudit({
    rootDir,
    config: sourceRun.config,
    baseUrl,
    routes: routesFromAnalysis(sourceRun.analysis),
    headless,
  });

  const results = [...sourceRun.results, ...browserRun.results];
  await saveResults(rootDir, results);

  const allFindings: Array<Finding | BrowserFinding> = results.flatMap((r) => r.findings);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            findings: allFindings,
            urls: browserRun.browserRun.urls,
            duration: browserRun.duration,
            scanners: results.map((r) => r.scanner),
            findingCount: allFindings.length,
          },
          null,
          2,
        ),
      },
    ],
  };
}

export interface SniffWalkOptions {
  rootDir: string;
  baseUrl?: string;
  headless?: boolean;
  maxPages?: number;
  mobile?: boolean;
  all?: boolean;
}

/**
 * The recommended action: drive a real browser, walk the app's user flows, and
 * return real issues with reproduction proof (route + steps + console/network),
 * severity, confidence, and a suggested fix. Auto-detects a running dev server
 * if baseUrl is omitted; falls back to a source scan when no app is running.
 */
export async function handleSniffWalk(options: SniffWalkOptions): Promise<McpToolResult> {
  return withBrowserSetup(() => sniffWalk(options));
}

async function sniffWalk(options: SniffWalkOptions): Promise<McpToolResult> {
  const rootErr = validateRootDir(options.rootDir);
  if (rootErr) return { content: [{ type: 'text', text: JSON.stringify({ error: rootErr }) }] };

  let url = options.baseUrl;
  if (!url) {
    const { detectDevServerUrl } = await import('../config/dev-server-detector.js');
    const detection = await detectDevServerUrl(options.rootDir);
    url = detection.url;
  }
  if (!url) {
    // No running app: degrade gracefully to a source scan so the agent still
    // gets something useful, and say so.
    const scan = await handleSniffScan(options.rootDir);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          note: 'No running app detected (no baseUrl, no dev server). Ran a source-only scan instead. Start your dev server or pass baseUrl to walk the live app and find runtime bugs.',
          sourceScan: JSON.parse(scan.content[0]!.text),
        }),
      }],
    };
  }

  const urlErr = validateBaseUrl(url);
  if (urlErr) return { content: [{ type: 'text', text: JSON.stringify({ error: urlErr }) }] };

  const { loadConfig } = await import('../config/loader.js');
  const config = await loadConfig(options.rootDir);
  const { checkPlaywrightBrowsers, needsSetupFromCheck } = await import('../core/ensure-browsers.js');
  const check = await checkPlaywrightBrowsers(config.browser?.projects, undefined, { headless: options.headless ?? true });
  const setup = needsSetupFromCheck(check, config.browser?.projects, SETUP_HINT);
  if (setup) return jsonResult(setup);

  const { join } = await import('node:path');
  const { runCrawl, isFailing, verdictLine, fixFirst, splitFindings, withVisibility } = await import('../crawl/index.js');
  const report = await runCrawl({
    startUrl: url,
    headless: options.headless ?? true,
    includeMobile: options.mobile ?? true,
    ...(options.maxPages ? { maxPages: options.maxPages } : {}),
    // Config parity with the CLI: an authenticated walk configured in
    // sniff.config works over MCP too, redaction included.
    ...(config.browser?.storageState ? { storageState: config.browser.storageState } : {}),
    outputDir: join(options.rootDir, 'sniff-reports', 'crawl'),
  });

  // The same split as the terminal, the HTML and the JSON report.
  const { shown, hidden } = splitFindings(report.findings, options.all === true);
  const visible = withVisibility(report, options.all === true);
  return {
    content: [{
      type: 'text',
      // Verdict first, so an agent reads the answer before the detail.
      text: JSON.stringify({
        verdict: isFailing(shown) ? 'fail' : 'pass',
        verdictLine: verdictLine(shown, undefined, hidden.length),
        shownCount: shown.length,
        hiddenLowConfidence: hidden.length,
        ...(hidden.length > 0 ? { hiddenNote: `${hidden.length} low-confidence finding${hidden.length === 1 ? ' is' : 's are'} left out of findings. Call again with all: true to include them.` } : {}),
        fixFirst: fixFirst(shown).map((f) => ({
          title: f.title,
          route: f.reproduction.route,
          severity: f.severity,
          suggestedFix: f.suggestedFix,
        })),
        stats: visible.stats,
        summary: visible.summary,
        findings: shown,
      }, null, 2),
    }],
  };
}

export interface SniffDiscoverOptions {
  rootDir: string;
  baseUrl?: string;
  headless?: boolean;
  maxScenarios?: number;
  maxVariantsPerScenario?: number;
  maxVariantsPerRun?: number;
  realism?: 'robot' | 'careful-user' | 'casual-user' | 'frustrated-user' | 'power-user';
  seed?: number;
  only?: string;
  appType?: string[];
  forceAppType?: string;
  dryRun?: boolean;
}

export async function handleSniffDiscover(options: SniffDiscoverOptions): Promise<McpToolResult> {
  return withBrowserSetup(() => sniffDiscover(options));
}

async function sniffDiscover(options: SniffDiscoverOptions): Promise<McpToolResult> {
  const rootErr = validateRootDir(options.rootDir);
  if (rootErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: rootErr }) }] };
  }

  if (!options.baseUrl && !options.dryRun) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: 'No baseUrl provided and no local dev server detected. Start your dev server or pass baseUrl.',
          }),
        },
      ],
    };
  }

  if (options.baseUrl) {
    const urlErr = validateBaseUrl(options.baseUrl);
    if (urlErr) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: urlErr }) }] };
    }
  }

  // Gate on Playwright install; skip when dryRun since no browser runs.
  if (!options.dryRun) {
    const { loadConfig } = await import('../config/loader.js');
    const config = await loadConfig(options.rootDir);
    const { checkPlaywrightBrowsers, needsSetupFromCheck } = await import('../core/ensure-browsers.js');
    const check = await checkPlaywrightBrowsers(config.browser?.projects, undefined, { headless: options.headless ?? true });
    const setup = needsSetupFromCheck(check, config.browser?.projects, SETUP_HINT);
    if (setup) return jsonResult(setup);
  }

  const { discoverCommand } = await import('../cli/commands/discover.js');
  const result = await discoverCommand({
    rootDir: options.rootDir,
    ...(options.baseUrl ? { url: options.baseUrl } : {}),
    headless: options.headless ?? true,
    nonInteractive: true,
    json: true,
    ...(options.maxScenarios !== undefined ? { maxScenarios: options.maxScenarios } : {}),
    ...(options.maxVariantsPerScenario !== undefined
      ? { maxVariantsPerScenario: options.maxVariantsPerScenario }
      : {}),
    ...(options.maxVariantsPerRun !== undefined ? { maxVariantsPerRun: options.maxVariantsPerRun } : {}),
    ...(options.realism !== undefined ? { realism: options.realism } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
    ...(options.only !== undefined ? { only: options.only } : {}),
    ...(options.appType !== undefined ? { appType: options.appType } : {}),
    ...(options.forceAppType !== undefined ? { forceAppType: options.forceAppType } : {}),
    ...(options.dryRun ? { dryRun: true } : {}),
  });

  const reports: { html?: string; json?: string; junit?: string } = {};
  for (const p of result.savedPaths) {
    if (p.endsWith('.html')) reports.html = p;
    else if (p.endsWith('.xml')) reports.junit = p;
    else if (p.endsWith('.json')) reports.json = p;
  }
  const summary = {
    baseUrl: result.baseUrl,
    detectedFrom: result.detectedFrom,
    stats: result.report.stats,
    topAppType: result.report.appTypeGuesses[0]?.type,
    topAppConfidence: result.report.appTypeGuesses[0]?.confidence,
    classificationBreakdown: result.report.classificationBreakdown,
    ...(result.dryRun ? { dryRun: result.dryRun } : {}),
    reports,
    savedPaths: result.savedPaths,
    failedScenarios: result.report.scenarios
      .filter((s) => s.status === 'fail' && s.quarantined !== true)
      .map((s) => ({
        id: s.scenario.id,
        name: s.scenario.name,
        failureReason: s.steps.find((step) => step.status === 'fail')?.failureReason,
      })),
    exitCode: result.exitCode,
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
  };
}

export interface SniffUnifiedOptions {
  mode: 'walk' | 'scan' | 'run' | 'discover' | 'report';
  rootDir: string;
  baseUrl?: string;
  headless?: boolean;
  maxPages?: number;
  mobile?: boolean;
  all?: boolean;
  format?: 'json' | 'summary';
  maxScenarios?: number;
  maxVariantsPerScenario?: number;
  maxVariantsPerRun?: number;
  realism?: 'robot' | 'careful-user' | 'casual-user' | 'frustrated-user' | 'power-user';
  seed?: number;
  only?: string;
  appType?: string[];
  forceAppType?: string;
  dryRun?: boolean;
}

/**
 * Dispatch for the unified `sniff` MCP tool. Normalizes the discriminated
 * union input and calls through to the narrow handlers. No new capabilities:
 * this is a UX wrapper only, preserving the security pattern of scoped tools.
 */
export async function handleSniffUnified(options: SniffUnifiedOptions): Promise<McpToolResult> {
  switch (options.mode) {
    case 'walk':
      return handleSniffWalk({
        rootDir: options.rootDir,
        ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
        headless: options.headless ?? true,
        ...(options.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
        ...(options.mobile !== undefined ? { mobile: options.mobile } : {}),
        ...(options.all !== undefined ? { all: options.all } : {}),
      });
    case 'scan':
      return handleSniffScan(options.rootDir);
    case 'run': {
      let url = options.baseUrl;
      if (!url) {
        const { detectDevServerUrl } = await import('../config/dev-server-detector.js');
        const detection = await detectDevServerUrl(options.rootDir);
        url = detection.url;
      }
      if (!url) return handleSniffScan(options.rootDir);
      return handleSniffRun(options.rootDir, url, options.headless ?? true);
    }
    case 'discover': {
      let url = options.baseUrl;
      if (!url && !options.dryRun) {
        const { detectDevServerUrl } = await import('../config/dev-server-detector.js');
        const detection = await detectDevServerUrl(options.rootDir);
        url = detection.url;
      }
      return handleSniffDiscover({
        rootDir: options.rootDir,
        ...(url ? { baseUrl: url } : {}),
        headless: options.headless ?? true,
        ...(options.maxScenarios !== undefined ? { maxScenarios: options.maxScenarios } : {}),
        ...(options.maxVariantsPerScenario !== undefined ? { maxVariantsPerScenario: options.maxVariantsPerScenario } : {}),
        ...(options.maxVariantsPerRun !== undefined ? { maxVariantsPerRun: options.maxVariantsPerRun } : {}),
        ...(options.realism !== undefined ? { realism: options.realism } : {}),
        ...(options.seed !== undefined ? { seed: options.seed } : {}),
        ...(options.only !== undefined ? { only: options.only } : {}),
        ...(options.appType !== undefined ? { appType: options.appType } : {}),
        ...(options.forceAppType !== undefined ? { forceAppType: options.forceAppType } : {}),
        ...(options.dryRun ? { dryRun: true } : {}),
      });
    }
    case 'report':
      return handleSniffReport(options.rootDir, options.format ?? 'summary');
  }
}

/**
 * `onProgress` receives each progress line (npm, then Playwright's download
 * percentages). The MCP server forwards them as progress notifications when
 * the client asked for them.
 */
export async function handleSniffInstall(
  projects?: BrowserProject[],
  onProgress?: (message: string) => void,
): Promise<McpToolResult> {
  const { installPlaywrightBrowserProjects } = await import('../core/ensure-browsers.js');
  const requestedProjects: BrowserProject[] = projects && projects.length > 0 ? projects : ['chromium'];
  const result = await installPlaywrightBrowserProjects(requestedProjects, {
    log: (line) => {
      // Progress goes to stderr: stdout is the MCP protocol channel.
      process.stderr.write(`[sniff install] ${line}\n`);
      onProgress?.(line);
    },
  });
  const { engineInstallCommand } = await import('../core/engine.js');
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(
        result.status === 'ok'
          ? { status: 'installed', projects: result.projects, engine: result.engine }
          : { status: 'failed', projects: result.projects, error: result.error, hint: `Run \`${engineInstallCommand(requestedProjects)}\` in a terminal for full error output.` },
      ),
    }],
  };
}

export async function handleSniffReport(
  rootDir: string,
  format: 'json' | 'summary',
): Promise<McpToolResult> {
  const rootErr = validateRootDir(rootDir);
  if (rootErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: rootErr }) }] };
  }

  const { loadLastResults } = await import('../core/persistence.js');
  const results = await loadLastResults(rootDir);

  if (!results) {
    return {
      content: [
        {
          type: 'text',
          text: 'No previous sniff results found. Run the unified sniff tool with mode "scan" or "run" first.',
        },
      ],
    };
  }

  if (format === 'json') {
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }

  // Summary format
  const totalFindings = results.results.reduce((sum, r) => sum + r.findings.length, 0);
  const bySeverity: Record<string, number> = {};
  for (const r of results.results) {
    for (const f of r.findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }
  }
  const scanners = results.results.map((r) => r.scanner).join(', ');
  const summary = [
    `Sniff Results (${results.timestamp})`,
    `Scanners: ${scanners}`,
    `Total findings: ${totalFindings}`,
    ...Object.entries(bySeverity).map(([sev, count]) => `  ${sev}: ${count}`),
  ].join('\n');

  return { content: [{ type: 'text', text: summary }] };
}
