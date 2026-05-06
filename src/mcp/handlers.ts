import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { Finding, BrowserFinding } from '../core/types.js';
import type { BrowserProject } from '../config/schema.js';

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
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
  const { checkPlaywrightBrowsers } = await import('../core/ensure-browsers.js');
  const check = await checkPlaywrightBrowsers(sourceRun.config.browser?.projects);
  if (check.status !== 'installed') {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          needsSetup: 'playwright-browsers',
          projects: check.status === 'missing' ? check.missingProjects : sourceRun.config.browser?.projects ?? ['chromium'],
          installCommand: check.status === 'missing' ? check.installCommand : `npx playwright install ${(sourceRun.config.browser?.projects ?? ['chromium']).join(' ')}`,
          installSizeMb: check.status === 'missing' ? check.installSizeMb : 165,
          hint: 'Run the sniff_install MCP tool with the same projects, or run the install command manually, then retry.',
        }),
      }],
    };
  }

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

  // Gate on Playwright install — skip when dryRun since no browser runs.
  if (!options.dryRun) {
    const { loadConfig } = await import('../config/loader.js');
    const config = await loadConfig(options.rootDir);
    const { checkPlaywrightBrowsers } = await import('../core/ensure-browsers.js');
    const check = await checkPlaywrightBrowsers(config.browser?.projects);
    if (check.status !== 'installed') {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            needsSetup: 'playwright-browsers',
            projects: check.status === 'missing' ? check.missingProjects : config.browser?.projects ?? ['chromium'],
            installCommand: check.status === 'missing' ? check.installCommand : `npx playwright install ${(config.browser?.projects ?? ['chromium']).join(' ')}`,
            installSizeMb: check.status === 'missing' ? check.installSizeMb : 165,
            hint: 'Run the sniff_install MCP tool with the same projects, or run the install command manually, then retry.',
          }),
        }],
      };
    }
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
  mode: 'scan' | 'run' | 'discover' | 'report';
  rootDir: string;
  baseUrl?: string;
  headless?: boolean;
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
 * union input and calls through to the narrow handlers. No new capabilities —
 * this is a UX wrapper only, preserving the security pattern of scoped tools.
 */
export async function handleSniffUnified(options: SniffUnifiedOptions): Promise<McpToolResult> {
  switch (options.mode) {
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

export async function handleSniffInstall(projects?: BrowserProject[]): Promise<McpToolResult> {
  const { installPlaywrightBrowserProjects } = await import('../core/ensure-browsers.js');
  const requestedProjects: BrowserProject[] = projects && projects.length > 0 ? projects : ['chromium'];
  const result = await installPlaywrightBrowserProjects(requestedProjects);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(
        result.status === 'ok'
          ? { status: 'installed', projects: result.projects }
          : { status: 'failed', projects: result.projects, error: result.error, hint: `Run \`npx playwright install ${requestedProjects.join(' ')}\` manually for full error output.` },
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
