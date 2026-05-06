// Shared Playwright-browser bootstrap for CLI and MCP paths.
//
// CLI: runs `npx playwright install chromium` inline — users see progress
// and wait the 30-60s once. MCP: does NOT silently shell out, because MCP
// stdio transports commonly time out, leaving the agent stuck. Instead the
// MCP surface returns a structured `needsSetup` payload so the agent can
// ask the user to run `sniff install` explicitly.

import type { BrowserProject } from '../config/schema.js';

export type BrowserCheckStatus =
  | { status: 'installed'; projects: BrowserProject[] }
  | { status: 'missing'; projects: BrowserProject[]; missingProjects: BrowserProject[]; installCommand: string; installSizeMb: number }
  | { status: 'error'; error: string };

const CHROMIUM_INSTALL_SIZE_MB = 165;
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

/**
 * Non-invasive check. Does NOT install. Safe to call from MCP handlers.
 */
export async function checkPlaywrightBrowsers(projects?: BrowserProject[]): Promise<BrowserCheckStatus> {
  const requestedProjects = normalizeProjects(projects);
  try {
    const playwright = await import('playwright');
    const missingProjects: BrowserProject[] = [];
    for (const project of requestedProjects) {
      // executablePath throws if the binary isn't present.
      playwright[project].executablePath();
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
  } catch (e) {
    // playwright itself not installed, or something else — expose as missing
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
  console.log(pc.yellow('\nPlaywright browsers not installed.'));
  const installSizeMb = check.status === 'missing'
    ? check.installSizeMb
    : requestedProjects.reduce((sum, project) => sum + ESTIMATED_BROWSER_SIZE_MB[project], 0);
  console.log(pc.dim(`Installing ${requestedProjects.join(', ')} (~${installSizeMb}MB, one-time)...\n`));

  const { execSync } = await import('node:child_process');
  try {
    execSync(installCommand(requestedProjects), { stdio: 'inherit' });
    console.log('');
  } catch {
    console.error(
      pc.red(
        `Failed to install Playwright browsers. Run manually: ${installCommand(requestedProjects)}`,
      ),
    );
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
