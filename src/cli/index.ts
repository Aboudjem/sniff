#!/usr/bin/env node
import { Command } from 'commander';

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
  .action(async (options) => {
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

await program.parseAsync();
