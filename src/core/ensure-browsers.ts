// Shared Playwright-browser bootstrap for CLI and MCP paths.
//
// Two downloads happen once per machine: the browser engine (Playwright,
// axe-core, Lighthouse; see ./engine.ts) and the Chromium build itself.
// CLI: downloads both inline, so users see progress and wait once.
// MCP: does NOT silently shell out from a scan tool. The scan tools return a
// structured `needsSetup` payload, and the sniff_install tool (or
// `sniff install` in a terminal) does the download explicitly.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrowserProject } from '../config/schema.js';
import { engineInstallCommand, enginePackageDir, engineStatus, installEngine, loadEngine, playwrightCliPath } from './engine.js';
import { ENGINE_SIZE, SIZE_MEASURED_ON, describeSize, setupSize } from './sizes.js';
import { findBrowserMissing } from './browser-missing.js';

export type BrowserCheckStatus =
  | { status: 'installed'; projects: BrowserProject[] }
  | {
      status: 'missing';
      projects: BrowserProject[];
      missingProjects: BrowserProject[];
      installCommand: string;
      /** Same as downloadSizeMb. Kept for clients that read it. */
      installSizeMb: number;
      downloadSizeMb: number;
      diskSizeMb: number;
    }
  | { status: 'error'; error: string };

function normalizeProjects(projects?: BrowserProject[]): BrowserProject[] {
  return projects && projects.length > 0 ? [...new Set(projects)] : ['chromium'];
}

function installCommand(projects: BrowserProject[]): string {
  return engineInstallCommand(projects);
}

/** What is still to download: the browsers, plus the engine when it is missing. */
function missingSize(projects: BrowserProject[]) {
  return setupSize(projects, engineStatus() === 'missing');
}

/**
 * Runs the Playwright CLI that matches the Playwright sniff loads, so the
 * downloaded browser is the build it expects. `npx playwright` could fetch a
 * different Playwright when sniff's copy lives in its engine folder.
 */
async function runPlaywrightCli(
  args: string[],
  stdio: 'pipe' | 'inherit-stderr',
  onLine?: (line: string) => void,
): Promise<void> {
  const cli = playwrightCliPath();
  if (!cli) throw new Error('Playwright is not installed. Run: ' + engineInstallCommand());
  const { spawn } = await import('node:child_process');
  // Async, so the MCP server keeps answering (and can send progress) while
  // the browser downloads.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      stdio: stdio === 'pipe' ? ['ignore', 'pipe', 'pipe'] : ['ignore', process.stderr, process.stderr],
    });
    let tail = '';
    const onData = (chunk: Buffer): void => {
      const text = chunk.toString();
      tail = (tail + text).slice(-4000);
      if (onLine) for (const line of text.split(/\r?\n/)) if (line.trim()) onLine(line.trim());
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`playwright ${args.join(' ')} exited with code ${code}\n${tail.trim()}`));
    });
  });
}

/** One file a browser launch runs, and the folder Playwright unpacked it into. */
export interface BrowserExecutable {
  path: string;
  /** Playwright writes INSTALLATION_COMPLETE here once the unpack finished. */
  dir: string;
}

/** What the check needs from the outside world. Injected in tests. */
export interface BrowserProbe {
  /**
   * Every executable a launch of `project` needs. A headless Chromium launch
   * runs the headless shell; a headed one runs the full browser. Throws when
   * Playwright is absent.
   */
  executables(project: BrowserProject, headless: boolean): Promise<BrowserExecutable[]>;
  exists(path: string): boolean;
}

/** Playwright's registry, the module that knows where each executable lives. */
interface PlaywrightRegistry {
  findExecutable(name: string): { executablePath(): string | undefined; directory: string | undefined } | undefined;
}

async function loadRegistry(): Promise<PlaywrightRegistry | null> {
  const dir = enginePackageDir('playwright-core');
  if (!dir) return null;
  try {
    const mod = (await import(
      /* @vite-ignore */ pathToFileURL(join(dir, 'lib', 'server', 'registry', 'index.js')).href
    )) as { registry?: PlaywrightRegistry; default?: { registry?: PlaywrightRegistry } };
    return mod.registry ?? mod.default?.registry ?? null;
  } catch {
    return null;
  }
}

/** Playwright's registry names for what a launch runs. */
function registryNames(project: BrowserProject, headless: boolean): string[] {
  if (project === 'chromium') return [headless ? 'chromium-headless-shell' : 'chromium'];
  return [project];
}

/** The `<name>-<revision>` folder that holds `path`, from Playwright's layout. */
function browserDirOf(path: string): string {
  const m = path.match(/^(.*?[\\/](?:chromium|chromium_headless_shell|firefox|webkit)-\d+)(?:[\\/]|$)/);
  return m ? m[1]! : path;
}

export const defaultProbe: BrowserProbe = {
  async executables(project, headless) {
    const registry = await loadRegistry();
    if (registry) {
      const found = registryNames(project, headless).map((name) => registry.findExecutable(name));
      if (found.every((e) => e?.executablePath() && e.directory)) {
        return found.map((e) => ({ path: e!.executablePath()!, dir: e!.directory! }));
      }
    }
    // The registry is internal to Playwright. If a release moves it, fall
    // back to the public path and Playwright's folder naming.
    const playwright = await loadEngine('playwright', () => import('playwright'));
    const path = playwright[project].executablePath();
    const dir = browserDirOf(path);
    if (project === 'chromium' && headless) {
      const shellDir = dir.replace(/chromium-(\d+)$/, 'chromium_headless_shell-$1');
      return [{ path: shellDir, dir: shellDir }];
    }
    return [{ path, dir }];
  },
  exists: existsSync,
};

/** The marker Playwright writes after a browser has been unpacked in full. */
const INSTALL_MARKER = 'INSTALLATION_COMPLETE';

/**
 * True when every executable a launch of `project` needs is on disk, and
 * each finished unpacking. A download killed midway leaves a folder with no
 * marker, or a Chromium folder with no headless shell next to it.
 */
async function isBrowserOnDisk(project: BrowserProject, headless: boolean, probe: BrowserProbe): Promise<boolean> {
  const executables = await probe.executables(project, headless);
  if (executables.length === 0) return false;
  return executables.every(
    (e) => !!e.path && probe.exists(e.path) && probe.exists(join(e.dir, INSTALL_MARKER)),
  );
}

/**
 * Non-invasive check. Does NOT install. Safe to call from MCP handlers.
 * `headless` (default true) picks which Chromium build the launch runs.
 */
export async function checkPlaywrightBrowsers(
  projects?: BrowserProject[],
  probe: BrowserProbe = defaultProbe,
  options: { headless?: boolean } = {},
): Promise<BrowserCheckStatus> {
  const requestedProjects = normalizeProjects(projects);
  const headless = options.headless ?? true;
  const missing = (missingProjects: BrowserProject[]): BrowserCheckStatus => {
    const size = missingSize(missingProjects);
    return {
      status: 'missing',
      projects: requestedProjects,
      missingProjects,
      installCommand: installCommand(missingProjects),
      installSizeMb: size.downloadMb,
      downloadSizeMb: size.downloadMb,
      diskSizeMb: size.diskMb,
    };
  };
  try {
    const missingProjects: BrowserProject[] = [];
    for (const project of requestedProjects) {
      if (!(await isBrowserOnDisk(project, headless, probe))) missingProjects.push(project);
    }
    if (missingProjects.length === 0) {
      return { status: 'installed', projects: requestedProjects };
    }
    return missing(missingProjects);
  } catch {
    // Playwright itself is not installed, or the platform is unsupported.
    return missing(requestedProjects);
  }
}

/**
 * The `needsSetup` payload every MCP browser tool returns, built in one
 * place so the tools cannot disagree. `projects` names what to install.
 */
export function needsSetupPayload(projects: BrowserProject[] | undefined, hint: string): Record<string, unknown> {
  const missingProjects = normalizeProjects(projects);
  const size = missingSize(missingProjects);
  return {
    needsSetup: 'playwright-browsers',
    projects: missingProjects,
    installCommand: installCommand(missingProjects),
    installSizeMb: size.downloadMb,
    downloadSizeMb: size.downloadMb,
    diskSizeMb: size.diskMb,
    sizeNote: `${describeSize(size)} (${SIZE_MEASURED_ON})`,
    hint,
  };
}

/** The payload for a failed check, or null when the browsers are installed. */
export function needsSetupFromCheck(
  check: BrowserCheckStatus,
  fallbackProjects: BrowserProject[] | undefined,
  hint: string,
): Record<string, unknown> | null {
  if (check.status === 'installed') return null;
  return needsSetupPayload(check.status === 'missing' ? check.missingProjects : fallbackProjects, hint);
}

/** The payload for a launch that failed because a browser is not on disk, else null. */
export function needsSetupFromError(err: unknown, hint: string): Record<string, unknown> | null {
  const missing = findBrowserMissing(err);
  return missing ? needsSetupPayload(missing.projects, hint) : null;
}

/** The CLI lines for a browser that is not fully on disk. Never names `npx playwright install`. */
export function browserMissingHint(projects: BrowserProject[]): string[] {
  const p = normalizeProjects(projects);
  return [
    `The browser is not fully downloaded: ${p.join(', ')}. An earlier download may have been interrupted.`,
    `Run this, then retry: ${installCommand(p)}`,
  ];
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
  console.error(pc.dim(`Downloading it once (${describeSize(ENGINE_SIZE)}). Later runs skip this step.\n`));
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
export async function ensurePlaywrightBrowsers(
  projects?: BrowserProject[],
  options: { headless?: boolean } = {},
): Promise<void> {
  const requestedProjects = normalizeProjects(projects);
  await ensureEngineForCli();
  const check = await checkPlaywrightBrowsers(requestedProjects, defaultProbe, options);
  if (check.status === 'installed') return;

  const pc = (await import('picocolors')).default;
  const toInstall = check.status === 'missing' ? check.missingProjects : requestedProjects;
  const size = setupSize(toInstall, false);
  // stderr, so `--json` output on stdout stays parseable.
  console.error(pc.yellow(`\nBrowser not downloaded yet: ${toInstall.join(', ')}.`));
  console.error(pc.dim(`Downloading it once (${describeSize(size)}). Later runs skip this step.\n`));

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
  const log = options.log ?? (() => {});
  try {
    const { ensureEngine } = await import('./engine.js');
    if (engineStatus() === 'missing') {
      log(`Downloading the browser engine (${describeSize(ENGINE_SIZE)})...`);
    }
    const engine = await ensureEngine({ log });
    log(`Downloading ${requestedProjects.join(', ')} (${describeSize(setupSize(requestedProjects, false))}), skipped when already on disk...`);
    await runPlaywrightCli(
      ['install', ...(options.withDeps ? ['--with-deps'] : []), ...requestedProjects],
      options.stdio ?? 'pipe',
      log,
    );
    log('Done.');
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
