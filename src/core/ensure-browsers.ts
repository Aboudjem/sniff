// Shared Playwright-browser bootstrap for CLI and MCP paths.
//
// Two downloads happen once per machine: the browser engine (Playwright,
// axe-core, Lighthouse; see ./engine.ts) and the Chromium build itself.
// CLI: downloads both inline, so users see progress and wait once.
// MCP: does NOT silently shell out from a scan tool. The scan tools return a
// structured `needsSetup` payload, and the sniff_install tool (or
// `sniff install` in a terminal) does the download explicitly.

import { existsSync } from 'node:fs';
import type { BrowserProject } from '../config/schema.js';
import { ENGINE_SIZE_MB, engineInstallCommand, engineStatus, installEngine, loadEngine, playwrightCliPath } from './engine.js';

export type BrowserCheckStatus =
  | { status: 'installed'; projects: BrowserProject[] }
  | { status: 'missing'; projects: BrowserProject[]; missingProjects: BrowserProject[]; installCommand: string; installSizeMb: number }
  | { status: 'error'; error: string };

const ESTIMATED_BROWSER_SIZE_MB: Record<BrowserProject, number> = {
  chromium: 165,
  firefox: 95,
  webkit: 120,
};

function normalizeProjects(projects?: BrowserProject[]): BrowserProject[] {
  return projects && projects.length > 0 ? [...new Set(projects)] : ['chromium'];
}

function installCommand(projects: BrowserProject[]): string {
  return engineInstallCommand(projects);
}

/** Size of what is still to download: the browsers, plus the engine when it is missing. */
function downloadSizeMb(projects: BrowserProject[]): number {
  const browsers = projects.reduce((sum, project) => sum + ESTIMATED_BROWSER_SIZE_MB[project], 0);
  return browsers + (engineStatus() === 'missing' ? ENGINE_SIZE_MB : 0);
}

/**
 * Runs the Playwright CLI that matches the Playwright sniff loads, so the
 * downloaded browser is the build it expects. `npx playwright` could fetch a
 * different Playwright when sniff's copy lives in its engine folder.
 */
async function runPlaywrightCli(args: string[], stdio: 'pipe' | 'inherit-stderr'): Promise<void> {
  const cli = playwrightCliPath();
  if (!cli) throw new Error('Playwright is not installed. Run: ' + engineInstallCommand());
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [cli, ...args], {
    stdio: stdio === 'pipe' ? 'pipe' : ['ignore', process.stderr, process.stderr],
  });
}

/** What the check needs from the outside world. Injected in tests. */
export interface BrowserProbe {
  /** Where Playwright expects the browser binary. Throws when Playwright is absent. */
  executablePath(project: BrowserProject): Promise<string>;
  exists(path: string): boolean;
}

const defaultProbe: BrowserProbe = {
  async executablePath(project) {
    const playwright = await loadEngine('playwright', () => import('playwright'));
    return playwright[project].executablePath();
  },
  exists: existsSync,
};

/**
 * True when the browser for `project` is on disk.
 *
 * `executablePath()` returns the expected path whether or not the file is
 * there, so the path must be tested. A headless walk runs on the Chromium
 * headless shell, which `playwright install --only-shell` downloads without
 * the full browser, so that build counts as installed too.
 */
function isBrowserOnDisk(project: BrowserProject, path: string, probe: BrowserProbe): boolean {
  if (!path) return false;
  if (probe.exists(path)) return true;
  if (project !== 'chromium') return false;
  const m = path.match(/^(.*[\\/])chromium-(\d+)[\\/]/);
  return m ? probe.exists(`${m[1]}chromium_headless_shell-${m[2]}`) : false;
}

/**
 * Non-invasive check. Does NOT install. Safe to call from MCP handlers.
 */
export async function checkPlaywrightBrowsers(
  projects?: BrowserProject[],
  probe: BrowserProbe = defaultProbe,
): Promise<BrowserCheckStatus> {
  const requestedProjects = normalizeProjects(projects);
  try {
    const missingProjects: BrowserProject[] = [];
    for (const project of requestedProjects) {
      const path = await probe.executablePath(project);
      if (!isBrowserOnDisk(project, path, probe)) missingProjects.push(project);
    }
    if (missingProjects.length === 0) {
      return { status: 'installed', projects: requestedProjects };
    }
    return {
      status: 'missing',
      projects: requestedProjects,
      missingProjects,
      installCommand: installCommand(missingProjects),
      installSizeMb: downloadSizeMb(missingProjects),
    };
  } catch {
    // Playwright itself is not installed, or the platform is unsupported.
    return {
      status: 'missing',
      projects: requestedProjects,
      missingProjects: requestedProjects,
      installCommand: installCommand(requestedProjects),
      installSizeMb: downloadSizeMb(requestedProjects),
    };
  }
}

/**
 * CLI path: the engine. Installs sniff's copy inline when it is missing.
 * Exits the process on failure.
 */
export async function ensureEngineForCli(): Promise<void> {
  if (engineStatus() !== 'missing') return;
  const pc = (await import('picocolors')).default;
  // stderr, so `--json` output on stdout stays parseable.
  console.error(pc.yellow('\nBrowser engine not downloaded yet (Playwright, axe-core, Lighthouse).'));
  console.error(pc.dim(`Downloading it once (about ${ENGINE_SIZE_MB} MB). Later runs skip this step.\n`));
  try {
    await installEngine({ log: (line) => console.error(pc.dim(line)) });
  } catch (e) {
    console.error(pc.red(`Could not download the browser engine: ${e instanceof Error ? e.message : String(e)}`));
    console.error(pc.red(`Run this, then retry: ${engineInstallCommand()}`));
    console.error(pc.dim('No network? `sniff scan` reads your source and needs no browser.'));
    process.exit(1);
  }
}

/**
 * CLI path. Installs the engine and the browsers inline if missing. Exits the
 * process on failure. Do NOT call from MCP handlers; use
 * `checkPlaywrightBrowsers` instead.
 */
export async function ensurePlaywrightBrowsers(projects?: BrowserProject[]): Promise<void> {
  const requestedProjects = normalizeProjects(projects);
  await ensureEngineForCli();
  const check = await checkPlaywrightBrowsers(requestedProjects);
  if (check.status === 'installed') return;

  const pc = (await import('picocolors')).default;
  const toInstall = check.status === 'missing' ? check.missingProjects : requestedProjects;
  const installSizeMb = toInstall.reduce((sum, project) => sum + ESTIMATED_BROWSER_SIZE_MB[project], 0);
  // stderr, so `--json` output on stdout stays parseable.
  console.error(pc.yellow(`\nBrowser not downloaded yet: ${toInstall.join(', ')}.`));
  console.error(pc.dim(`Downloading it once (about ${installSizeMb} MB). Later runs skip this step.\n`));

  try {
    await runPlaywrightCli(['install', ...toInstall], 'inherit-stderr');
    console.error('');
  } catch {
    console.error(pc.red(`Could not download the browser. Run this, then retry: ${installCommand(toInstall)}`));
    console.error(pc.dim('No network? `sniff scan` reads your source and needs no browser.'));
    process.exit(1);
  }
}

/**
 * Install via the tool surface (used by the `sniff_install` MCP tool).
 * Returns a structured result so the MCP response can report status
 * without leaking raw stdio to the agent.
 */
export async function installPlaywrightBrowsers(): Promise<
  | { status: 'ok' }
  | { status: 'failed'; error: string }
> {
  return installPlaywrightBrowserProjects();
}

/**
 * Installs the engine when it is missing, then the requested browsers.
 * `withDeps` also installs the OS libraries the browsers need (Linux CI).
 * `log` receives npm's progress lines (stderr in the CLI and the MCP server).
 */
export async function installPlaywrightBrowserProjects(
  projects?: BrowserProject[],
  options: { withDeps?: boolean; log?: (line: string) => void; stdio?: 'pipe' | 'inherit-stderr' } = {},
): Promise<
  | { status: 'ok'; projects: BrowserProject[]; engine: 'resolved' | 'engine-dir' }
  | { status: 'failed'; projects: BrowserProject[]; error: string }
> {
  const requestedProjects = normalizeProjects(projects);
  try {
    const { ensureEngine } = await import('./engine.js');
    const engine = await ensureEngine({ log: options.log });
    await runPlaywrightCli(
      ['install', ...(options.withDeps ? ['--with-deps'] : []), ...requestedProjects],
      options.stdio ?? 'pipe',
    );
    return { status: 'ok', projects: requestedProjects, engine };
  } catch (e) {
    return {
      status: 'failed',
      projects: requestedProjects,
      error: e instanceof Error ? e.message : 'unknown error',
    };
  }
}

/** Installs only the OS libraries the browsers need (`playwright install-deps`). */
export async function installBrowserSystemDeps(projects?: BrowserProject[]): Promise<void> {
  await runPlaywrightCli(['install-deps', ...normalizeProjects(projects)], 'inherit-stderr');
}
