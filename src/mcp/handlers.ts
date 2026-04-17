import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import type { Finding, BrowserFinding } from '../core/types.js';

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
  const { ScannerRegistry } = await import('../scanners/registry.js');
  const { SourceScanner } = await import('../scanners/source/index.js');

  const config = await loadConfig(rootDir);
  const registry = new ScannerRegistry();
  registry.register(new SourceScanner());

  const results = await registry.runAll({ config, rootDir });
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

  const { loadConfig } = await import('../config/loader.js');
  const { BrowserRunner } = await import('../browser/runner.js');
  const { AccessibilityScanner } = await import('../scanners/accessibility/index.js');
  const { VisualRegressionScanner } = await import('../scanners/visual/index.js');
  const { PerformanceScanner } = await import('../scanners/performance/index.js');

  const config = await loadConfig(rootDir);

  const runner = new BrowserRunner(config);
  runner.registerScanner(new AccessibilityScanner());
  runner.registerScanner(new VisualRegressionScanner());
  runner.registerScanner(new PerformanceScanner());

  const result = await runner.run({
    baseUrl,
    testFiles: ['/'],
    viewports: config.viewports ?? [{ name: 'desktop', width: 1280, height: 720 }],
    headless,
    slowMo: 0,
    timeout: config.browser?.timeout ?? 30000,
  });

  // Type both groups explicitly to avoid Finding vs BrowserFinding incompatibility
  const allFindings: Array<Finding | BrowserFinding> = [
    ...result.scanResults.flatMap((r) => r.findings),
    ...result.pageVisits.flatMap((v) => v.findings),
  ];

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            findings: allFindings,
            urls: result.urls,
            duration: result.duration,
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
}

export async function handleSniffDiscover(options: SniffDiscoverOptions): Promise<McpToolResult> {
  const rootErr = validateRootDir(options.rootDir);
  if (rootErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: rootErr }) }] };
  }

  if (!options.baseUrl) {
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

  const urlErr = validateBaseUrl(options.baseUrl);
  if (urlErr) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: urlErr }) }] };
  }

  const { discoverCommand } = await import('../cli/commands/discover.js');
  const result = await discoverCommand({
    rootDir: options.rootDir,
    url: options.baseUrl,
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
  });

  const summary = {
    baseUrl: result.baseUrl,
    stats: result.report.stats,
    topAppType: result.report.appTypeGuesses[0]?.type,
    topAppConfidence: result.report.appTypeGuesses[0]?.confidence,
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
          text: 'No previous sniff results found. Run sniff_scan or sniff_run first.',
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
