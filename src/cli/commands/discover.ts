import type { DiscoveryReport, DiscoveryRunContext } from '../../discovery/run-types.js';
import type { RealismProfile } from '../../discovery/scenarios/types.js';

export interface DiscoverOptions {
  rootDir: string;
  url?: string;
  headless?: boolean;
  ci?: boolean;
  json?: boolean;
  maxScenarios?: number;
  maxVariantsPerScenario?: number;
  maxVariantsPerRun?: number;
  realism?: RealismProfile;
  seed?: number;
  only?: string;
  appType?: string[];
  noLlm?: boolean;
  nonInteractive?: boolean;
  format?: string;
  regenerate?: boolean;
  regenerateOnly?: boolean;
  forceRegenerate?: boolean;
}

export interface DiscoverResult {
  report: DiscoveryReport;
  savedPaths: string[];
  baseUrl: string;
  exitCode: number;
}

const DEFAULT_STEP_TIMEOUT_MS = 10_000;
const DEFAULT_SCENARIO_TIMEOUT_MS = 90_000;
const PROD_WARNING_DELAY_MS = 5_000;

function isLocalhost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.localhost') ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return false;
  }
}

export async function productionUrlWarning(
  url: string,
  options: { json?: boolean; nonInteractive?: boolean; delayMs?: number } = {},
): Promise<void> {
  if (options.json || options.nonInteractive) return;
  if (isLocalhost(url)) return;

  const pc = (await import('picocolors')).default;
  const delay = options.delayMs ?? PROD_WARNING_DELAY_MS;
  const seconds = Math.max(1, Math.round(delay / 1000));

  console.log('');
  console.log(pc.yellow(pc.bold('WARNING: This URL looks like production.')));
  console.log(pc.yellow(`  ${url}`));
  console.log(pc.yellow('  Discovery scenarios will create real data (orders, accounts, etc.).'));
  console.log(pc.yellow(`  Press Ctrl+C in ${seconds}s to cancel, or wait to proceed.`));
  console.log('');

  await new Promise<void>((resolve) => setTimeout(resolve, delay));
}

export async function discoverCommand(options: DiscoverOptions): Promise<DiscoverResult> {
  const pc = (await import('picocolors')).default;
  const isCi = !!options.ci || !!process.env.CI;
  const nonInteractive = !!options.nonInteractive || isCi;
  const headless = options.headless ?? true;
  const realism: RealismProfile = options.realism ?? (isCi ? 'robot' : 'casual-user');
  const maxScenarios = options.maxScenarios ?? 50;
  const maxVariantsPerScenario = options.maxVariantsPerScenario ?? 3;
  const maxVariantsPerRun = options.maxVariantsPerRun ?? 40;

  const { loadConfig } = await import('../../config/loader.js');
  const config = await loadConfig(options.rootDir);

  const emptyReport = (): DiscoveryReport => ({
    appTypeGuesses: [],
    scenarios: [],
    stats: { total: 0, passed: 0, failed: 0, skipped: 0, quarantined: 0, durationMs: 0 },
    runAt: new Date().toISOString(),
  });

  let url: string | undefined;
  if (!options.regenerateOnly) {
    url = options.url ?? config.browser?.baseUrl;
    if (!url) {
      const { detectDevServerUrl } = await import('../../config/dev-server-detector.js');
      const detection = await detectDevServerUrl(options.rootDir);
      url = detection.url;
      if (url && !options.json) {
        console.log(`${pc.green('[auto]')} Found dev server at ${pc.bold(url)} (${detection.detail})\n`);
      }
    }

    if (!url) {
      console.error(pc.red('No URL available. Pass --url <url> or start your dev server.'));
      return { report: emptyReport(), savedPaths: [], baseUrl: '', exitCode: 1 };
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        console.error(pc.red(`URL must use http or https: ${url}`));
        return { report: emptyReport(), savedPaths: [], baseUrl: url, exitCode: 1 };
      }
    } catch {
      console.error(pc.red(`Invalid URL: ${url}`));
      return { report: emptyReport(), savedPaths: [], baseUrl: url, exitCode: 1 };
    }

    await productionUrlWarning(url, { json: options.json, nonInteractive });
  }

  if (!options.json) {
    console.log(`${pc.blue('[discover]')} Extracting domain snapshot...`);
  }
  const { extractDomainSnapshot } = await import('../../discovery/domain/index.js');
  const snapshot = await extractDomainSnapshot(options.rootDir);

  if (!options.json) {
    console.log(`${pc.blue('[discover]')} Classifying app type...`);
  }
  const { classifyApp } = await import('../../discovery/classifier/index.js');
  let guesses = classifyApp(snapshot);

  if (!options.noLlm) {
    const { needsTieBreak, tieBreakClassification } = await import('../../discovery/classifier/tiebreak.js');
    if (needsTieBreak(guesses)) {
      const { resolveDiscoveryLLM } = await import('../../discovery/llm/index.js');
      const llm = await resolveDiscoveryLLM({
        rootDir: options.rootDir,
        cacheDir: '.sniff/discover/cache',
      });
      if (llm) {
        if (!options.json) {
          console.log(pc.dim('  tie-break: asking Claude Code to break a close call...'));
        }
        guesses = await tieBreakClassification(guesses, snapshot, llm);
      }
    }
  }

  if (!options.json) {
    const top = guesses[0];
    if (top) {
      console.log(`  top guess: ${pc.bold(top.type)} (${Math.round(top.confidence * 100)}%)`);
    } else {
      console.log(pc.yellow('  no app type matched any signature'));
    }
  }

  if (!options.json) {
    console.log(`${pc.blue('[discover]')} Generating scenarios...`);
  }
  const { generateScenarios } = await import('../../discovery/scenarios/index.js');
  const happyScenarios = generateScenarios(snapshot, guesses, {
    realism,
    ...(options.appType && options.appType.length > 0 ? { forceAppTypes: options.appType } : {}),
  });

  const { enumerateAllEdgeVariants } = await import('../../discovery/edge-cases/index.js');
  const edgeScenarios = enumerateAllEdgeVariants(happyScenarios, snapshot, {
    maxPerScenario: maxVariantsPerScenario,
    maxPerRun: maxVariantsPerRun,
  });

  let allScenarios = [...happyScenarios, ...edgeScenarios];

  if (options.only) {
    const filter = options.only;
    allScenarios = allScenarios.filter((s) => s.id.includes(filter) || s.appType === filter);
  }

  if (allScenarios.length > maxScenarios) {
    allScenarios = allScenarios.slice(0, maxScenarios);
  }

  if (allScenarios.length === 0) {
    if (!options.json) {
      console.log(pc.yellow('  no scenarios generated for this project'));
    }
    const report: DiscoveryReport = { ...emptyReport(), appTypeGuesses: guesses };
    return { report, savedPaths: [], baseUrl: url ?? '', exitCode: 0 };
  }

  if (!options.json) {
    console.log(`  ${happyScenarios.length} happy + ${edgeScenarios.length} edge = ${allScenarios.length} total`);
  }

  if (options.regenerate || options.regenerateOnly) {
    const { saveDiscoveryScenarios } = await import('../../discovery/persistence/index.js');
    const saveResult = await saveDiscoveryScenarios({
      rootDir: options.rootDir,
      snapshot,
      guesses,
      scenarios: allScenarios,
      ...(options.forceRegenerate ? { forceRegenerate: true } : {}),
      ...(nonInteractive ? { nonInteractive: true } : {}),
    });
    if (!options.json) {
      console.log(`${pc.blue('[persist]')} scenarios written to ${pc.dim(saveResult.generatedDir)}`);
      if (saveResult.written.length > 0) {
        console.log(`  written:     ${saveResult.written.length}`);
      }
      if (saveResult.skippedKept.length > 0) {
        console.log(`  kept (hand-edited): ${saveResult.skippedKept.length}`);
      }
      if (saveResult.movedToCustom.length > 0) {
        console.log(`  moved to custom/: ${saveResult.movedToCustom.length}`);
      }
      if (saveResult.removed.length > 0) {
        console.log(`  removed:     ${saveResult.removed.length}`);
      }
    }
    if (options.regenerateOnly) {
      const report: DiscoveryReport = { ...emptyReport(), appTypeGuesses: guesses };
      return { report, savedPaths: [], baseUrl: url ?? '', exitCode: 0 };
    }
  }

  if (!url) {
    console.error(pc.red('Internal: URL missing after resolution. This should not happen.'));
    return { report: emptyReport(), savedPaths: [], baseUrl: '', exitCode: 1 };
  }
  const resolvedUrl: string = url;

  const { join } = await import('node:path');
  const reportDir = join(options.rootDir, 'sniff-reports', 'discovery');
  const viewport = { width: 1280, height: 720 };

  const runContext: DiscoveryRunContext = {
    baseUrl: resolvedUrl,
    rootDir: options.rootDir,
    headless,
    viewport,
    stepTimeoutMs: DEFAULT_STEP_TIMEOUT_MS,
    scenarioTimeoutMs: DEFAULT_SCENARIO_TIMEOUT_MS,
    reportDir,
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  };

  if (!options.json) {
    console.log(`${pc.green('[discover]')} Running ${allScenarios.length} scenarios against ${resolvedUrl}...`);
  }

  const { runScenarios } = await import('../../discovery/runner.js');
  let report = await runScenarios(allScenarios, guesses, runContext, config);

  const { markQuarantinedScenarios } = await import('../../discovery/report/flakiness.js');
  const { loadFlakinessHistory } = await import('../../core/persistence.js');
  const history = await loadFlakinessHistory(options.rootDir);
  if (history) {
    report = markQuarantinedScenarios(report, history, resolvedUrl);
  }

  const { saveDiscoveryReport } = await import('../../discovery/report/index.js');
  const formats: Array<'html' | 'json' | 'junit'> = options.format
    ? (options.format.split(',').map((f) => f.trim()) as Array<'html' | 'json' | 'junit'>)
    : (isCi ? ['html', 'json', 'junit'] : ['html', 'json']);
  const savedPaths = await saveDiscoveryReport({
    rootDir: options.rootDir,
    report,
    formats,
  });

  if (options.json) {
    console.log(JSON.stringify({ report, savedPaths }, null, 2));
  } else {
    console.log('');
    console.log(`  passed:      ${pc.green(report.stats.passed)}`);
    console.log(`  failed:      ${pc.red(report.stats.failed)}`);
    console.log(`  skipped:     ${pc.dim(report.stats.skipped)}`);
    if (report.stats.quarantined > 0) {
      console.log(`  quarantined: ${pc.yellow(report.stats.quarantined)}`);
    }
    console.log(`  duration:    ${Math.round(report.stats.durationMs)}ms`);
    console.log('');
    for (const p of savedPaths) {
      console.log(pc.dim(`  Report: ${p}`));
    }
  }

  const { shouldFailCi } = await import('../../discovery/report/flakiness.js');
  const exitCode = shouldFailCi(report) ? 1 : 0;
  return { report, savedPaths, baseUrl: resolvedUrl, exitCode };
}
