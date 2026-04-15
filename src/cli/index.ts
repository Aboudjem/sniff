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
  .description('Run full test suite (coming soon)')
  .action(async () => {
    const { runCommand } = await import('./commands/run.js');
    await runCommand();
  });

program
  .command('report')
  .description('View last scan results')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const { reportCommand } = await import('./commands/report.js');
    await reportCommand(options);
  });

await program.parseAsync();
