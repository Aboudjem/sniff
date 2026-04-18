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

  const { getVersion } = await import('../version.js');

  const program = new Command();

  program
    .name('sniff')
    .description('AI-powered QA testing framework')
    .version(getVersion());

  // ── Default command: unified scan ──────────────────────────────
  // `sniff`               → source scan + auto-detect dev server
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
    .option('--discover', 'Run autonomous E2E discovery (scenarios + edge cases)')
    .option('--max-scenarios <n>', 'Cap total scenarios for discovery (default: 50)')
    .option('--max-variants-per-scenario <n>', 'Cap edge variants per scenario (default: 3)')
    .option('--max-variants-per-run <n>', 'Cap edge variants per run (default: 40)')
    .option('--realism <profile>', 'Discovery realism: robot, careful-user, casual-user, frustrated-user, power-user')
    .option('--seed <n>', 'Replay a specific random seed')
    .option('--only <filter>', 'Filter discovery scenarios by id substring or app type')
    .option('--app-type <types>', 'Force discovery app types (comma-separated)')
    .option('--no-llm', 'Disable LLM-backed discovery polish')
    .option('--non-interactive', 'Non-interactive mode for discovery (skips prompts and countdown)')
    .option('--regenerate', 'Regenerate sniff-scenarios/ before running (prompts on hand-edits)')
    .option('--regenerate-only', 'Regenerate sniff-scenarios/ and exit without running')
    .option('--force-regenerate', 'Regenerate sniff-scenarios/ and overwrite hand-edits')
    .action(async (target, options) => {
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();

      if (options.discover || options.regenerate || options.regenerateOnly || options.forceRegenerate) {
        if (!options.regenerateOnly) {
          await ensurePlaywrightBrowsers();
        }
        const { discoverCommand } = await import('./commands/discover.js');
        const appTypes = typeof options.appType === 'string'
          ? options.appType.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined;
        const result = await discoverCommand({
          rootDir,
          url: options.url,
          headless: options.headless,
          ci: options.ci,
          json: options.json,
          ...(options.maxScenarios ? { maxScenarios: parseInt(options.maxScenarios, 10) } : {}),
          ...(options.maxVariantsPerScenario ? { maxVariantsPerScenario: parseInt(options.maxVariantsPerScenario, 10) } : {}),
          ...(options.maxVariantsPerRun ? { maxVariantsPerRun: parseInt(options.maxVariantsPerRun, 10) } : {}),
          ...(options.realism ? { realism: options.realism } : {}),
          ...(options.seed ? { seed: parseInt(options.seed, 10) } : {}),
          ...(options.only ? { only: options.only } : {}),
          ...(appTypes ? { appType: appTypes } : {}),
          ...(options.llm === false ? { noLlm: true } : {}),
          ...(options.nonInteractive ? { nonInteractive: true } : {}),
          ...(options.format ? { format: options.format } : {}),
          ...(options.regenerate ? { regenerate: true } : {}),
          ...(options.regenerateOnly ? { regenerateOnly: true } : {}),
          ...(options.forceRegenerate ? { regenerate: true, forceRegenerate: true } : {}),
        });
        process.exit(result.exitCode);
      }

      const { unifiedCommand } = await import('./commands/unified.js');
      const { loadConfig } = await import('../config/loader.js');

      const config = await loadConfig(rootDir);

      // URL resolution: flag → config → auto-detect
      let url = options.url ?? config.browser?.baseUrl;

      if (!url && options.browser !== false) {
        const { detectDevServerUrl } = await import('../config/dev-server-detector.js');
        const detection = await detectDevServerUrl(rootDir);
        if (detection.url) {
          url = detection.url;
          if (!options.json) {
            const pc = (await import('picocolors')).default;
            console.log(`${pc.green('[auto]')} Found dev server at ${pc.bold(url)} (${detection.detail})\n`);
          }
        }
      }

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
    .description('Generate a sniff config file (auto-detects .ts vs .js based on project)')
    .option('--force', 'Overwrite existing config')
    .option('--ts', 'Force TypeScript config (sniff.config.ts)')
    .option('--js', 'Force JavaScript config (sniff.config.mjs if ESM, sniff.config.js if CJS)')
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

  program
    .command('discover')
    .description('Run autonomous E2E discovery (scenarios + edge cases)')
    .argument('[target]', 'Project directory (default: current directory)')
    .option('--url <url>', 'Target URL (default: auto-detect dev server)')
    .option('--ci', 'CI mode: headless, robot realism, no countdown, JUnit output')
    .option('--no-headless', 'Show the browser window')
    .option('--format <formats>', 'Report formats: html, json, junit (comma-separated)')
    .option('--json', 'Output results as JSON')
    .option('--max-scenarios <n>', 'Cap total scenarios (default: 50)')
    .option('--max-variants-per-scenario <n>', 'Cap edge variants per scenario (default: 3)')
    .option('--max-variants-per-run <n>', 'Cap edge variants per run (default: 40)')
    .option('--realism <profile>', 'Realism: robot, careful-user, casual-user, frustrated-user, power-user')
    .option('--seed <n>', 'Replay a specific random seed')
    .option('--only <filter>', 'Filter scenarios by id substring or app type')
    .option('--app-type <types>', 'Force app types (comma-separated)')
    .option('--no-llm', 'Disable LLM-backed polish')
    .option('--non-interactive', 'Skip prompts and the production-URL countdown')
    .option('--regenerate', 'Regenerate sniff-scenarios/ before running (prompts on hand-edits)')
    .option('--regenerate-only', 'Regenerate sniff-scenarios/ and exit without running')
    .option('--force-regenerate', 'Regenerate sniff-scenarios/ and overwrite hand-edits')
    .action(async (target, options) => {
      if (!options.regenerateOnly) {
        await ensurePlaywrightBrowsers();
      }
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
      const { discoverCommand } = await import('./commands/discover.js');
      const appTypes = typeof options.appType === 'string'
        ? options.appType.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;
      const result = await discoverCommand({
        rootDir,
        url: options.url,
        headless: options.headless,
        ci: options.ci,
        json: options.json,
        ...(options.maxScenarios ? { maxScenarios: parseInt(options.maxScenarios, 10) } : {}),
        ...(options.maxVariantsPerScenario ? { maxVariantsPerScenario: parseInt(options.maxVariantsPerScenario, 10) } : {}),
        ...(options.maxVariantsPerRun ? { maxVariantsPerRun: parseInt(options.maxVariantsPerRun, 10) } : {}),
        ...(options.realism ? { realism: options.realism } : {}),
        ...(options.seed ? { seed: parseInt(options.seed, 10) } : {}),
        ...(options.only ? { only: options.only } : {}),
        ...(appTypes ? { appType: appTypes } : {}),
        ...(options.llm === false ? { noLlm: true } : {}),
        ...(options.nonInteractive ? { nonInteractive: true } : {}),
        ...(options.format ? { format: options.format } : {}),
        ...(options.regenerate ? { regenerate: true } : {}),
        ...(options.regenerateOnly ? { regenerateOnly: true } : {}),
        ...(options.forceRegenerate ? { regenerate: true, forceRegenerate: true } : {}),
      });
      process.exit(result.exitCode);
    });

  program
    .command('fix')
    .description('Auto-fix safe issues (removes debugger, console.log/debug/info)')
    .argument('[target]', 'Project directory (default: current directory)')
    .option('--check', 'Dry run: show what would be fixed without changing files')
    .option('--json', 'Output results as JSON')
    .action(async (target, options) => {
      const { fixCommand } = await import('./commands/fix.js');
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
      await fixCommand({ rootDir, dryRun: !!options.check, json: !!options.json });
    });

  program
    .command('doctor')
    .description('Check your environment: Node.js, Playwright, config, dev server')
    .action(async () => {
      const pc = (await import('picocolors')).default;
      const rootDir = process.cwd();

      console.log(`\n${pc.bold('sniff doctor')}\n`);

      // Node.js
      const nodeVersion = process.version;
      const nodeMajor = parseInt(nodeVersion.slice(1), 10);
      const nodeOk = nodeMajor >= 22;
      console.log(`  ${nodeOk ? pc.green('OK') : pc.red('!!  ')} Node.js ${nodeVersion} ${nodeOk ? '' : '(need 22+)'}`);

      // Playwright
      let playwrightOk = false;
      try {
        const { chromium } = await import('playwright');
        chromium.executablePath();
        playwrightOk = true;
      } catch { /* not installed */ }
      console.log(`  ${playwrightOk ? pc.green('OK') : pc.yellow('--')} Playwright ${playwrightOk ? 'installed' : 'not installed (auto-installs on first browser scan)'}`);

      // Config file
      const { loadConfig } = await import('../config/loader.js');
      let hasConfig = false;
      try {
        const config = await loadConfig(rootDir);
        hasConfig = !!config.browser?.baseUrl;
        console.log(`  ${pc.green('OK')} Config loaded${hasConfig ? ` (baseUrl: ${config.browser?.baseUrl})` : ' (defaults)'}`);
      } catch {
        console.log(`  ${pc.green('OK')} No config file (using defaults)`);
      }

      // Dev server detection
      const { detectDevServerUrl, getDevCommand } = await import('../config/dev-server-detector.js');
      const detection = await detectDevServerUrl(rootDir);
      if (detection.url) {
        console.log(`  ${pc.green('OK')} Dev server found at ${pc.bold(detection.url)} (${detection.detail})`);
      } else {
        const devCmd = await getDevCommand(rootDir);
        console.log(`  ${pc.yellow('--')} No dev server running${devCmd ? ` (try: ${devCmd})` : ''}`);
      }

      // Package.json
      try {
        const { readFile } = await import('node:fs/promises');
        const { join } = await import('node:path');
        const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf-8'));
        console.log(`  ${pc.green('OK')} package.json found (${pkg.name ?? 'unnamed'})`);
      } catch {
        console.log(`  ${pc.yellow('--')} No package.json in current directory`);
      }

      // sniff-scenarios/ (discovery baselines)
      try {
        const { readdir, stat } = await import('node:fs/promises');
        const { join } = await import('node:path');
        const scenariosDir = join(rootDir, 'sniff-scenarios');
        const st = await stat(scenariosDir);
        if (st.isDirectory()) {
          const entries = await readdir(scenariosDir, { recursive: true });
          const count = entries.filter(
            (e) => typeof e === 'string' && e.endsWith('.scenario.md'),
          ).length;
          if (count > 0) {
            console.log(`  ${pc.green('OK')} sniff-scenarios/ found (${count} scenario${count === 1 ? '' : 's'})`);
          } else {
            console.log(`  ${pc.yellow('--')} sniff-scenarios/ exists but has no .scenario.md files`);
          }
        }
      } catch {
        console.log(`  ${pc.yellow('--')} No sniff-scenarios/ (run 'sniff discover' to generate)`);
      }

      console.log('');
    });

  await program.parseAsync();
}
