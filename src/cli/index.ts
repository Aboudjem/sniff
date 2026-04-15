#!/usr/bin/env node

// Check for --mcp flag before Commander parses (MCP mode bypasses CLI)
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

  program
    .command('init')
    .description('Generate a sniff config file')
    .option('--force', 'Overwrite existing config')
    .action(async (options) => {
      const { initCommand } = await import('./commands/init.js');
      await initCommand(options);
    });

  program
    .command('scan')
    .description('Scan source code for problems')
    .option('--json', 'Output results as JSON')
    .option(
      '--fail-on <severities>',
      'Fail on these severities (comma-separated)',
      'critical,high',
    )
    .action(async (options) => {
      const { scanCommand } = await import('./commands/scan.js');
      await scanCommand(options);
    });

  program
    .command('run')
    .description('Run full quality scan with browser tests')
    .option('--no-headless', 'Run browser in headed mode')
    .option('--base-url <url>', 'Base URL of the app to test')
    .option('--format <formats>', 'Report formats (comma-separated: html,json,junit)')
    .option('--fail-on <severities>', 'Fail on these severities (comma-separated)', 'critical,high')
    .option('--json', 'Output results as JSON')
    .option('--track-flakes', 'Track test flakiness across runs')
    .option('--ci', 'CI mode: headless, JUnit XML, track flakes, non-zero exit on failure')
    .action(async (options) => {
      await ensurePlaywrightBrowsers();
      const { runCommand } = await import('./commands/run.js');
      await runCommand(options);
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
    .description('Update visual regression baselines with current screenshots')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (options) => {
      const { updateBaselinesCommand } = await import('./commands/update-baselines.js');
      await updateBaselinesCommand(options);
    });

  program
    .command('ci')
    .description('Generate a GitHub Actions workflow for running sniff in CI')
    .option('--output <path>', 'Output path for workflow file', '.github/workflows/sniff.yml')
    .option('--force', 'Overwrite existing workflow file')
    .option('--package-name <name>', 'npm package name for npx command', 'sniff-qa')
    .action(async (options) => {
      const { ciCommand } = await import('./commands/ci.js');
      await ciCommand(options);
    });

  program
    .command('explore')
    .description('Run AI-driven chaos monkey exploration')
    .option('--base-url <url>', 'Base URL of the app to explore')
    .option('--max-steps <n>', 'Maximum exploration steps', '50')
    .option('--no-headless', 'Run browser in headed mode')
    .option('--json', 'Output results as JSON')
    .action(async (options) => {
      await ensurePlaywrightBrowsers();
      const { exploreCommand } = await import('./commands/explore.js');
      await exploreCommand(options);
    });

  await program.parseAsync();
}
