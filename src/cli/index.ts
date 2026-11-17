#!/usr/bin/env node

// MCP server mode bypasses CLI entirely
if (process.argv.includes('--mcp')) {
  const { parseCaps, CapsError } = await import('../mcp/caps.js');
  let caps;
  try {
    caps = parseCaps(process.argv);
  } catch (err) {
    // stdout is the MCP protocol channel, so a startup error goes to stderr.
    console.error(err instanceof CapsError ? err.message : String(err));
    process.exit(1);
  }
  const { startMcpServer } = await import('../mcp/server.js');
  await startMcpServer(caps);
} else {
  const { Command } = await import('commander');

  const { ensurePlaywrightBrowsers } = await import('../core/ensure-browsers.js');

  const { getVersion } = await import('../version.js');

  const program = new Command();

  program
    .name('sniff')
    .description(
      'Walks your running app in a real browser and reports what is broken, with the steps that reproduce it.\n' +
      'With no app running it reads your source instead. No API key, no account.',
    )
    .version(getVersion())
    .addHelpText('after', `
Start here:
  $ sniff --url http://localhost:3000     walk a running app and print the report
  $ sniff --url http://localhost:3000 --report
                                          also write sniff-reports/sniff-report.html
  $ sniff scan                            read the source only, no browser
  $ sniff doctor                          check Node, the browser and the dev server
  $ sniff install                         download the browser engine and Chromium now

Exit codes:
  0  no finding reached the --fail-on severities (default: critical,high)
  1  a finding reached them, an assert budget was breached, or sniff could not run

A walk clicks buttons and submits forms. Point it at a dev or staging app.
Docs: https://github.com/Aboudjem/sniff#readme`);

  // ── Default command: unified scan ──────────────────────────────
  // `sniff`               → source scan + auto-detect dev server
  // `sniff --url <url>`   → everything (source + a11y + visual + perf + AI explore)
  // `sniff --url X --ci`  → everything except exploration (deterministic for CI)
  program
    .argument('[target]', 'Project directory to scan (default: current directory)')
    .option('--url <url>', 'URL of the running app to walk (default: the dev server found on a common port)')
    .option('--ci', 'CI mode: headless and non-interactive')
    .option('--no-browser', 'Force source-only scan even if URL is configured')
    .option('--explore', 'Run optional AI exploration after browser checks', false)
    .option('--no-explore', 'Skip AI exploration (kept for compatibility; exploration is off by default)')
    .option('--max-steps <n>', 'Cap AI exploration steps when --explore is used (default: 50)')
    .option('--headed', 'Show the browser window (alias for --no-headless)')
    .option('--no-headless', 'Show the browser window')
    .option('--format <formats>', 'Report formats: html, json, junit (comma-separated)')
    .option('--fail-on <severities>', 'Exit non-zero on these severities', 'critical,high')
    .option('--json', 'Output results as JSON')
    .option('--report', 'Write a self-contained HTML report to sniff-reports/sniff-report.html')
    .option('--all', 'Show low-confidence findings too (hidden by default)')
    .option('--max-pages <n>', 'Max pages to crawl during the flow-walk (default: 25)')
    .option('--no-mobile', 'Skip the mobile (375px) responsive pass')
    .option('--storage-state <path>', 'Playwright storage-state JSON, so the walk runs as a logged-in user. Cookie and token values from it are redacted from every written report.')
    .option('--track-flakes', 'Track test flakiness across runs')
    .option('--discover', 'Run autonomous E2E discovery (scenarios + edge cases)')
    .option('--max-scenarios <n>', 'Cap total scenarios for discovery (default: 50)')
    .option('--max-variants-per-scenario <n>', 'Cap edge variants per scenario (default: 3)')
    .option('--max-variants-per-run <n>', 'Cap edge variants per run (default: 40)')
    .option('--realism <profile>', 'Discovery realism: robot, careful-user, casual-user, frustrated-user, power-user')
    .option('--seed <n>', 'Replay a specific random seed')
    .option('--only <filter>', 'Filter discovery scenarios by id substring or app type')
    .option('--app-type <types>', 'Filter discovery app types (comma-separated); only generates scenarios for these types if the classifier matches them')
    .option('--force-app-type <type>', 'Force a single app type, bypassing the classifier entirely (use when classification returns blank)')
    .option('--no-llm', 'Disable LLM-backed discovery polish')
    .option('--non-interactive', 'Non-interactive mode for discovery (skips prompts and countdown)')
    .option('--regenerate', 'Regenerate sniff-scenarios/ before running (prompts on hand-edits)')
    .option('--regenerate-only', 'Regenerate sniff-scenarios/ and exit without running')
    .option('--force-regenerate', 'Regenerate sniff-scenarios/ and overwrite hand-edits')
    .option('--verbose', 'Print classification breakdown (top 3 guesses + matched signals per dimension)')
    .option('--dry-run', 'Discover: generate scenarios + classify without running browser or writing reports')
    .action(async (target, options) => {
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();

      if (options.discover || options.regenerate || options.regenerateOnly || options.forceRegenerate || options.dryRun) {
        const { loadConfig } = await import('../config/loader.js');
        const config = await loadConfig(rootDir);
        if (!options.regenerateOnly && !options.dryRun) {
          await ensurePlaywrightBrowsers(config.browser?.projects);
        }
        const { discoverCommand } = await import('./commands/discover.js');
        const appTypes = typeof options.appType === 'string'
          ? options.appType.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined;
        const result = await discoverCommand({
          rootDir,
          url: options.url,
          headless: options.headed ? false : options.headless,
          ci: options.ci,
          json: options.json,
          ...(options.maxScenarios ? { maxScenarios: parseInt(options.maxScenarios, 10) } : {}),
          ...(options.maxVariantsPerScenario ? { maxVariantsPerScenario: parseInt(options.maxVariantsPerScenario, 10) } : {}),
          ...(options.maxVariantsPerRun ? { maxVariantsPerRun: parseInt(options.maxVariantsPerRun, 10) } : {}),
          ...(options.realism ? { realism: options.realism } : {}),
          ...(options.seed ? { seed: parseInt(options.seed, 10) } : {}),
          ...(options.only ? { only: options.only } : {}),
          ...(appTypes ? { appType: appTypes } : {}),
          ...(options.forceAppType ? { forceAppType: options.forceAppType } : {}),
          ...(options.llm === false ? { noLlm: true } : {}),
          ...(options.nonInteractive ? { nonInteractive: true } : {}),
          ...(options.format ? { format: options.format } : {}),
          ...(options.regenerate ? { regenerate: true } : {}),
          ...(options.regenerateOnly ? { regenerateOnly: true } : {}),
          ...(options.forceRegenerate ? { regenerate: true, forceRegenerate: true } : {}),
          ...(options.verbose ? { verbose: true } : {}),
          ...(options.dryRun ? { dryRun: true } : {}),
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
      const isCi = options.ci || !!process.env.CI;
      const pc = (await import('picocolors')).default;

      // Default experience: a running app → walk its real user flows.
      if (wantsBrowser) {
        await ensurePlaywrightBrowsers(config.browser?.projects);
        const { crawlCommand } = await import('./commands/crawl-command.js');
        // crawlCommand does not load config itself, so resolve the flag
        // against the config key here. The flag wins.
        const storageState = options.storageState
          ? (await import('node:path')).resolve(options.storageState)
          : config.browser?.storageState;
        const code = await crawlCommand({
          rootDir,
          url: url!,
          ...(storageState ? { storageState } : {}),
          ...(config.assert ? { assert: config.assert } : {}),
          headless: options.headed ? false : options.headless,
          json: options.json,
          report: options.report,
          all: options.all,
          ...(options.maxPages ? { maxPages: parseInt(options.maxPages, 10) } : {}),
          mobile: options.mobile !== false,
          failOn: options.failOn,
          ci: isCi,
        });
        process.exit(code);
      }

      // No running app → source-only scan, with clear guidance (don't go silent).
      if (!options.json) {
        const { getDevCommand } = await import('../config/dev-server-detector.js');
        const devCmd = await getDevCommand(rootDir).catch(() => null);
        console.log(`${pc.yellow('No running app detected')}: no --url and no dev server.`);
        console.log(pc.dim('Running a source-only scan. For the full flow-walk that finds real bugs,'));
        console.log(`${pc.dim(`start your app${devCmd ? ` (${devCmd})` : ''} then re-run, or pass`)} ${pc.bold('--url <url>')}${pc.dim('.')} ${pc.dim('See')} ${pc.bold('sniff doctor')}${pc.dim('.')}\n`);
      }

      await unifiedCommand({
        rootDir,
        url: undefined,
        explore: false,
        maxSteps: options.maxSteps,
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
    .command('scan')
    .description('Source-only scan (no browser): placeholder/TODO/console.log/dead links/etc.')
    .argument('[target]', 'Project directory (default: current directory)')
    .option('--json', 'Output results as JSON')
    .option('--fail-on <severities>', 'Exit non-zero on these severities', 'critical,high')
    .action(async (target, options) => {
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
      const { unifiedCommand } = await import('./commands/unified.js');
      await unifiedCommand({ rootDir, explore: false, json: options.json, failOn: options.failOn });
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
    .option('--headed', 'Show the browser window (alias for --no-headless)')
    .option('--no-headless', 'Show the browser window')
    .option('--format <formats>', 'Report formats: html, json, junit (comma-separated)')
    .option('--json', 'Output results as JSON')
    .option('--max-scenarios <n>', 'Cap total scenarios (default: 50)')
    .option('--max-variants-per-scenario <n>', 'Cap edge variants per scenario (default: 3)')
    .option('--max-variants-per-run <n>', 'Cap edge variants per run (default: 40)')
    .option('--realism <profile>', 'Realism: robot, careful-user, casual-user, frustrated-user, power-user')
    .option('--seed <n>', 'Replay a specific random seed')
    .option('--only <filter>', 'Filter scenarios by id substring or app type')
    .option('--app-type <types>', 'Filter discovery app types (comma-separated); only generates scenarios for these types if the classifier matches them')
    .option('--force-app-type <type>', 'Force a single app type, bypassing the classifier entirely (use when classification returns blank)')
    .option('--no-llm', 'Disable LLM-backed polish')
    .option('--non-interactive', 'Skip prompts and the production-URL countdown')
    .option('--regenerate', 'Regenerate sniff-scenarios/ before running (prompts on hand-edits)')
    .option('--regenerate-only', 'Regenerate sniff-scenarios/ and exit without running')
    .option('--force-regenerate', 'Regenerate sniff-scenarios/ and overwrite hand-edits')
    .option('--verbose', 'Print classification breakdown (top 3 guesses + matched signals per dimension)')
    .option('--dry-run', 'Generate scenarios + classify without running browser or writing reports')
    .action(async (target, options) => {
      if (!options.regenerateOnly && !options.dryRun) {
        const { loadConfig } = await import('../config/loader.js');
        const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
        const config = await loadConfig(rootDir);
        await ensurePlaywrightBrowsers(config.browser?.projects);
      }
      const rootDir = target ? (await import('node:path')).resolve(target) : process.cwd();
      const { discoverCommand } = await import('./commands/discover.js');
      const appTypes = typeof options.appType === 'string'
        ? options.appType.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;
      const result = await discoverCommand({
        rootDir,
        // commander 14 can route --url to the program (default command) opts when
        // both the default command and this subcommand declare it; fall back so
        // `sniff discover --url <url>` works.
        url: options.url ?? program.opts().url,
        headless: options.headed ? false : options.headless,
        ci: options.ci,
        json: options.json,
        ...(options.maxScenarios ? { maxScenarios: parseInt(options.maxScenarios, 10) } : {}),
        ...(options.maxVariantsPerScenario ? { maxVariantsPerScenario: parseInt(options.maxVariantsPerScenario, 10) } : {}),
        ...(options.maxVariantsPerRun ? { maxVariantsPerRun: parseInt(options.maxVariantsPerRun, 10) } : {}),
        ...(options.realism ? { realism: options.realism } : {}),
        ...(options.seed ? { seed: parseInt(options.seed, 10) } : {}),
        ...(options.only ? { only: options.only } : {}),
        ...(appTypes ? { appType: appTypes } : {}),
        ...(options.forceAppType ? { forceAppType: options.forceAppType } : {}),
        ...(options.llm === false ? { noLlm: true } : {}),
        ...(options.nonInteractive ? { nonInteractive: true } : {}),
        ...(options.format ? { format: options.format } : {}),
        ...(options.regenerate ? { regenerate: true } : {}),
        ...(options.regenerateOnly ? { regenerateOnly: true } : {}),
        ...(options.forceRegenerate ? { regenerate: true, forceRegenerate: true } : {}),
        ...(options.verbose ? { verbose: true } : {}),
        ...(options.dryRun ? { dryRun: true } : {}),
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
    .command('install')
    .description('Download the browser engine (Playwright, axe-core, Lighthouse) and browsers once, so the first walk starts at once')
    .argument('[browsers...]', 'Browsers to download: chromium, firefox, webkit (default: chromium)')
    .option('--with-deps', 'Also install the system libraries the browsers need (Linux CI, needs root)')
    .option('--deps-only', 'Only install the system libraries (skip downloads already cached)')
    .action(async (browsers: string[], options: { withDeps?: boolean; depsOnly?: boolean }) => {
      const pc = (await import('picocolors')).default;
      const allowed = ['chromium', 'firefox', 'webkit'];
      const bad = browsers.filter((b) => !allowed.includes(b));
      if (bad.length > 0) {
        console.error(pc.red(`Unknown browser: ${bad.join(', ')}. Use one of: ${allowed.join(', ')}.`));
        process.exit(1);
      }
      const projects = (browsers.length > 0 ? browsers : ['chromium']) as import('../config/schema.js').BrowserProject[];
      const { ensureEngineForCli, installPlaywrightBrowserProjects, installBrowserSystemDeps } = await import('../core/ensure-browsers.js');
      const started = Date.now();
      await ensureEngineForCli();
      if (options.depsOnly) {
        await installBrowserSystemDeps(projects);
      } else {
        console.error(pc.dim(`Downloading ${projects.join(', ')} (skipped when already on disk)...`));
        const result = await installPlaywrightBrowserProjects(projects, {
          withDeps: !!options.withDeps,
          stdio: 'inherit-stderr',
        });
        if (result.status === 'failed') {
          console.error(pc.red(`Could not download ${projects.join(', ')}: ${result.error}`));
          process.exit(1);
        }
      }
      const secs = Math.round((Date.now() - started) / 1000);
      console.log(`${pc.green('OK')} sniff is ready to walk an app (${secs} s). Next: ${pc.bold('sniff --url http://localhost:3000')}`);
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

      // Browser engine. Playwright, axe-core and Lighthouse are a one-time
      // download (see src/core/engine.ts), so say where they load from.
      const { engineStatus, engineDir, engineInstallCommand, ENGINE_SIZE_MB } = await import('../core/engine.js');
      const engine = engineStatus();
      if (engine === 'resolved') {
        console.log(`  ${pc.green('OK')} Browser engine installed next to sniff`);
      } else if (engine === 'engine-dir') {
        console.log(`  ${pc.green('OK')} Browser engine downloaded (${engineDir()})`);
      } else {
        console.log(`  ${pc.yellow('--')} Browser engine not downloaded yet (the first walk downloads it, about ${ENGINE_SIZE_MB} MB, or run: ${engineInstallCommand()})`);
      }

      // Browser. The Chromium build is a separate download, so test that it
      // is really on disk.
      const { checkPlaywrightBrowsers } = await import('../core/ensure-browsers.js');
      const browser = engine === 'missing' ? null : await checkPlaywrightBrowsers(['chromium']);
      if (browser?.status === 'installed') {
        console.log(`  ${pc.green('OK')} Chromium downloaded`);
      } else {
        console.log(`  ${pc.yellow('--')} Chromium not downloaded yet (the first walk downloads it, about 165 MB, or run: ${engineInstallCommand(['chromium'])})`);
      }

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
