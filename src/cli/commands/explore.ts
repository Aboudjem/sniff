export async function exploreCommand(options: {
  baseUrl?: string;
  maxSteps?: string;
  headless?: boolean;
  json?: boolean;
}): Promise<void> {
  const pc = (await import('picocolors')).default;
  const { loadConfig } = await import('../../config/loader.js');
  const { ExplorationRunner } = await import('../../exploration/runner.js');
  const { ClaudeExplorationProvider } = await import('../../exploration/claude-exploration-provider.js');
  const { saveResults } = await import('../../core/persistence.js');

  const config = await loadConfig(process.cwd());
  const baseUrl = options.baseUrl ?? config.browser?.baseUrl;
  if (!baseUrl) {
    console.error(pc.red('No base URL. Set browser.baseUrl in config or pass --base-url.'));
    process.exit(1);
  }

  // Validate URL (same pattern as run command T-03-13)
  try {
    new URL(baseUrl);
  } catch {
    console.error(pc.red(`Invalid base URL: "${baseUrl}".`));
    process.exit(1);
  }

  const maxSteps = options.maxSteps ? parseInt(options.maxSteps, 10) : (config.exploration?.maxSteps ?? 50);
  const provider = new ClaudeExplorationProvider();
  const runner = new ExplorationRunner(config, provider);

  const { getVersion } = await import('../../version.js');
  console.log(`\nSniff v${getVersion()} - Chaos Monkey Exploration\n`);
  console.log(`  Target: ${baseUrl}`);
  console.log(`  Max steps: ${maxSteps}\n`);

  const result = await runner.explore({
    baseUrl,
    rootDir: process.cwd(),
    headless: options.headless ?? config.browser?.headless ?? true,
    maxSteps,
    timeout: config.exploration?.timeout ?? config.browser?.timeout ?? 30000,
    viewport: config.exploration?.viewport ?? { width: 1280, height: 720 },
  });

  // Save exploration log to .sniff/exploration-<timestamp>.json
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), '.sniff');
  await mkdir(dir, { recursive: true });
  const logPath = join(dir, `exploration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await writeFile(logPath, JSON.stringify({ actionLog: result.actionLog, findings: result.findings }, null, 2));

  // Convert findings to ScanResult format for persistence
  const scanResult = {
    scanner: 'exploration',
    findings: result.findings,
    duration: result.duration,
    metadata: { pagesVisited: result.pagesVisited, totalSteps: result.totalSteps },
  };
  await saveResults(process.cwd(), [scanResult]);

  // Terminal output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n  Steps completed: ${result.totalSteps}`);
    console.log(`  Pages visited: ${result.pagesVisited.length}`);
    console.log(`  Findings: ${result.findings.length}`);
    console.log(`  Action log: ${logPath}\n`);

    if (result.findings.length > 0) {
      const { formatBrowserFindings } = await import('../formatter.js');
      console.log(formatBrowserFindings(result.findings));
    }
  }
}
