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
  // `sniff`           → source scan
  // `sniff --url ...` → source scan + browser tests
  // `sniff --explore` → source scan + browser tests + chaos monkey
  program
    .argument('[target]', 'Project directory to scan (defaults to current directory)')
    .option('--url <url>', 'Target URL for browser tests (enables accessibility, visual, performance)')
    .option('--explore', 'Include AI chaos monkey exploration')
    .option('--max-steps <n>', 'Max exploration steps (default: 50)')
    .option('--source-only', 'Skip browser tests even if --url is set')
    .option('--no-headless', 'Show the browser window')
    .option('--format <formats>', 'Report formats: html, json, junit (comma-separated)')
    .option('--fail-on <severities>', 'Exit non-zero on these severities (comma-separated)', 'critical,high')
    .option('--json', 'Output results as JSON')
    .option('--ci', 'CI mode: headless, JUnit output, flakiness tracking')
    .option('--track-flakes', 'Track test flakiness across runs')
    .action(async (target, options) => {
      const { unifiedCommand } = await import('./commands/unified.js');

      // Resolve URL from --url flag, config, or CI env
      const { loadConfig } = await import('../config/loader.js');
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
      const config = await loadConfig(rootDir);
      const url = options.url ?? config.browser?.baseUrl;
      const wantsBrowser = !!url && !options.sourceOnly;

      if (wantsBrowser || options.explore) {
        await ensurePlaywrightBrowsers();
      }

      await unifiedCommand({
        rootDir,
        url: wantsBrowser ? url : undefined,
        explore: options.explore ?? false,
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
