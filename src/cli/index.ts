#!/usr/bin/env node

// MCP server mode bypasses CLI entirely
if (process.argv.includes('--mcp')) {
  const { startMcpServer } = await import('../mcp/server.js');
  await startMcpServer();
} else {
  const { Command } = await import('commander');

  async function ensurePlaywrightBrowsers(): Promise<void> {
    try {
      const { chromium } = await import('playwright');
      chromium.executablePath();
    } catch {
      const pc = (await import('picocolors')).default;
      console.log(pc.yellow('\nPlaywright browsers not installed.'));
      console.log(pc.dim('Installing Chromium (required for browser testing)...\n'));
      const { execSync } = await import('node:child_process');
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        console.log('');
      } catch {
        console.error(pc.red('Failed to install Playwright browsers. Run manually: npx playwright install chromium'));
        process.exit(1);
      }
    }
  }

  const program = new Command();

  program
    .name('sniff')
    .description('AI-powered QA testing framework')
    .version('0.1.0');

  // ── Default command: unified scan ──────────────────────────────
  // `sniff`               → source scan only
  // `sniff --url <url>`   → everything (source + a11y + visual + perf + AI explore)
  // `sniff --url X --ci`  → everything except exploration (deterministic for CI)
  program
    .argument('[target]', 'Project directory to scan (default: current directory)')
    .option('--url <url>', 'Target URL — enables full audit (a11y, visual, perf, AI explorer)')
    .option('--ci', 'CI mode: headless, JUnit XML, flakiness tracking, no AI exploration')
    .option('--no-browser', 'Force source-only scan even if URL is configured')
    .option('--no-explore', 'Skip AI exploration (browser tests still run)')
    .option('--max-steps <n>', 'Cap AI exploration steps (default: 50)')
    .option('--no-headless', 'Show the browser window')
    .option('--format <formats>', 'Report formats: html, json, junit (comma-separated)')
    .option('--fail-on <severities>', 'Exit non-zero on these severities (default: critical,high)', 'critical,high')
    .option('--json', 'Output results as JSON')
    .option('--track-flakes', 'Track test flakiness across runs')
    .action(async (target, options) => {
      const { unifiedCommand } = await import('./commands/unified.js');
      const { loadConfig } = await import('../config/loader.js');

      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
      const config = await loadConfig(rootDir);

      // URL resolution: flag → config → none
      const url = options.url ?? config.browser?.baseUrl;
      const wantsBrowser = !!url && options.browser !== false;

      // Exploration is default-ON when browser tests run, default-OFF in CI
      const isCi = options.ci || !!process.env.CI;
      const wantsExplore = wantsBrowser && options.explore !== false && !isCi;

      if (wantsBrowser) {
        await ensurePlaywrightBrowsers();
      }

      await unifiedCommand({
        rootDir,
        url: wantsBrowser ? url : undefined,
        explore: wantsExplore,
        maxSteps: options.maxSteps,
        headless: options.headless,
        format: options.format,
        failOn: options.failOn,
        json: options.json,
        ci: options.ci,
        trackFlakes: options.trackFlakes,
      });
    });

  // ── Utility commands ───────────────────────────────────────────

  program
    .command('init')
    .description('Generate a sniff config file')
    .option('--force', 'Overwrite existing config')
    .action(async (options) => {
      const { initCommand } = await import('./commands/init.js');
      await initCommand(options);
    });

  program
    .command('ci')
    .description('Generate a GitHub Actions workflow')
    .option('--output <path>', 'Output path for workflow file', '.github/workflows/sniff.yml')
    .option('--force', 'Overwrite existing workflow file')
    .option('--package-name <name>', 'npm package name for npx command', 'sniff-qa')
    .action(async (options) => {
      const { ciCommand } = await import('./commands/ci.js');
      await ciCommand(options);
    });

  program
    .command('report')
    .description('View last scan results')
    .option('--json', 'Output as JSON')
    .option('--format <formats>', 'Regenerate report in specified formats (comma-separated: html,json,junit)')
    .option('--output <dir>', 'Output directory for regenerated reports')
    .action(async (options) => {
      const { reportCommand } = await import('./commands/report.js');
      await reportCommand(options);
    });

  program
    .command('update-baselines')
    .description('Update visual regression baselines')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      const { updateBaselinesCommand } = await import('./commands/update-baselines.js');
      await updateBaselinesCommand(options);
    });

  await program.parseAsync();
}
