// Shared Playwright-browser bootstrap for CLI and MCP paths.
//
// CLI: runs `npx playwright install chromium` inline — users see progress
// and wait the 30-60s once. MCP: does NOT silently shell out, because MCP
// stdio transports commonly time out, leaving the agent stuck. Instead the
// MCP surface returns a structured `needsSetup` payload so the agent can
// ask the user to run `sniff install` explicitly.

export type BrowserCheckStatus =
  | { status: 'installed' }
  | { status: 'missing'; installCommand: string; installSizeMb: number }
  | { status: 'error'; error: string };

const CHROMIUM_INSTALL_SIZE_MB = 165;

/**
 * Non-invasive check. Does NOT install. Safe to call from MCP handlers.
 */
export async function checkPlaywrightBrowsers(): Promise<BrowserCheckStatus> {
  try {
    const { chromium } = await import('playwright');
    // executablePath throws if the binary isn't present.
    chromium.executablePath();
    return { status: 'installed' };
  } catch (e) {
    if (e instanceof Error && /Executable doesn't exist|browserType\.executablePath/i.test(e.message)) {
      return {
        status: 'missing',
        installCommand: 'npx playwright install chromium',
        installSizeMb: CHROMIUM_INSTALL_SIZE_MB,
      };
    }
    // playwright itself not installed, or something else — expose as missing
    return {
      status: 'missing',
      installCommand: 'npx playwright install chromium',
      installSizeMb: CHROMIUM_INSTALL_SIZE_MB,
    };
  }
}

/**
 * CLI path. Installs inline if missing. Exits the process on failure.
 * Do NOT call from MCP handlers — use `checkPlaywrightBrowsers` instead.
 */
export async function ensurePlaywrightBrowsers(): Promise<void> {
  const check = await checkPlaywrightBrowsers();
  if (check.status === 'installed') return;

  const pc = (await import('picocolors')).default;
  console.log(pc.yellow('\nPlaywright browsers not installed.'));
  console.log(pc.dim(`Installing Chromium (~${CHROMIUM_INSTALL_SIZE_MB}MB, one-time)...\n`));

  const { execSync } = await import('node:child_process');
  try {
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    console.log('');
  } catch {
    console.error(
      pc.red(
        'Failed to install Playwright browsers. Run manually: npx playwright install chromium',
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
  const { execSync } = await import('node:child_process');
  try {
    execSync('npx playwright install chromium', { stdio: 'pipe' });
    return { status: 'ok' };
  } catch (e) {
    return {
      status: 'failed',
      error: e instanceof Error ? e.message : 'unknown error',
    };
  }
}
