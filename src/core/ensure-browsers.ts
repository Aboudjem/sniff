// Shared Playwright-browser bootstrap for CLI and MCP paths.
//
// CLI: runs `npx playwright install chromium` inline — users see progress
// and wait the 30-60s once. MCP: does NOT silently shell out, because MCP
// stdio transports commonly time out, leaving the agent stuck. Instead the
// MCP surface returns a structured `needsSetup` payload so the agent can
// ask the user to run `sniff install` explicitly.

import { existsSync } from 'node:fs';
import type { BrowserProject } from '../config/schema.js';

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
  return `npx playwright install ${projects.join(' ')}`;
}

/** What the check needs from the outside world. Injected in tests. */
export interface BrowserProbe {
  /** Where Playwright expects the browser binary. Throws when Playwright is absent. */
  executablePath(project: BrowserProject): Promise<string>;
  exists(path: string): boolean;
}

const defaultProbe: BrowserProbe = {
  async executablePath(project) {
    const playwright = await import('playwright');
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
      installSizeMb: missingProjects.reduce((sum, project) => sum + ESTIMATED_BROWSER_SIZE_MB[project], 0),
    };
  } catch {
    // Playwright itself is not installed, or the platform is unsupported.
    return {
      status: 'missing',
      projects: requestedProjects,
      missingProjects: requestedProjects,
      installCommand: installCommand(requestedProjects),
      installSizeMb: requestedProjects.reduce((sum, project) => sum + ESTIMATED_BROWSER_SIZE_MB[project], 0),
    };
  }
}

/**
 * CLI path. Installs inline if missing. Exits the process on failure.
 * Do NOT call from MCP handlers — use `checkPlaywrightBrowsers` instead.
 */
export async function ensurePlaywrightBrowsers(projects?: BrowserProject[]): Promise<void> {
  const requestedProjects = normalizeProjects(projects);
  const check = await checkPlaywrightBrowsers(requestedProjects);
  if (check.status === 'installed') return;

  const pc = (await import('picocolors')).default;
  const toInstall = check.status === 'missing' ? check.missingProjects : requestedProjects;
  const installSizeMb = toInstall.reduce((sum, project) => sum + ESTIMATED_BROWSER_SIZE_MB[project], 0);
  // stderr, so `--json` output on stdout stays parseable.
  console.error(pc.yellow(`\nBrowser not downloaded yet: ${toInstall.join(', ')}.`));
  console.error(pc.dim(`Downloading it once (about ${installSizeMb} MB). Later runs skip this step.\n`));

  const { execSync } = await import('node:child_process');
  try {
    execSync(installCommand(toInstall), { stdio: ['ignore', process.stderr, process.stderr] });
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

export async function installPlaywrightBrowserProjects(projects?: BrowserProject[]): Promise<
  | { status: 'ok'; projects: BrowserProject[] }
  | { status: 'failed'; projects: BrowserProject[]; error: string }
> {
  const requestedProjects = normalizeProjects(projects);
  const { execSync } = await import('node:child_process');
  try {
    execSync(installCommand(requestedProjects), { stdio: 'pipe' });
    return { status: 'ok', projects: requestedProjects };
  } catch (e) {
    return {
      status: 'failed',
      projects: requestedProjects,
      error: e instanceof Error ? e.message : 'unknown error',
    };
  }
}
