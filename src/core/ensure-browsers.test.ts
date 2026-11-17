import { describe, it, expect } from 'vitest';
import {
  browserMissingHint,
  checkPlaywrightBrowsers,
  defaultProbe,
  needsSetupFromError,
  needsSetupPayload,
  type BrowserProbe,
} from './ensure-browsers.js';
import { BROWSER_SIZE } from './sizes.js';
import { getVersion } from '../version.js';

const SNIFF_INSTALL = `npx -y sniff-qa@${getVersion()} install`;

describe('checkPlaywrightBrowsers', () => {
  it('returns a structured status object', async () => {
    const result = await checkPlaywrightBrowsers();
    // The actual status depends on whether playwright's chromium is
    // installed in this environment. Both branches are valid. What we
    // care about is that the shape is stable and does NOT silently shell
    // out to `npx playwright install`.
    expect(['installed', 'missing', 'error']).toContain(result.status);
    if (result.status === 'installed') {
      expect(result.projects).toContain('chromium');
    }
    if (result.status === 'missing') {
      expect(result.installCommand).toBe(`${SNIFF_INSTALL} chromium`);
      expect(result.installSizeMb).toBeGreaterThan(0);
    }
  });

  it('builds install hints for multiple requested browser projects', async () => {
    const result = await checkPlaywrightBrowsers(['chromium', 'firefox']);
    expect(['installed', 'missing', 'error']).toContain(result.status);
    // Which browsers are on this machine varies, so assert the contract: the
    // hint names exactly the missing ones. The fake-disk cases below pin each
    // combination down.
    if (result.status === 'missing') {
      expect(result.missingProjects.length).toBeGreaterThan(0);
      expect(['chromium', 'firefox']).toEqual(expect.arrayContaining(result.missingProjects));
      expect(result.installCommand).toBe(`${SNIFF_INSTALL} ${result.missingProjects.join(' ')}`);
    }
  });

  // Playwright reports where each executable should be whether or not it was
  // downloaded, so the check has to look at the disk. These cases pin that
  // down with a fake disk laid out the way Playwright 1.59 lays it out.
  const ROOT = '/cache/ms-playwright';
  const dirs = {
    chromium: `${ROOT}/chromium-1217`,
    shell: `${ROOT}/chromium_headless_shell-1217`,
    firefox: `${ROOT}/firefox-1511`,
    webkit: `${ROOT}/webkit-2272`,
  };
  const exe = {
    chromium: `${dirs.chromium}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    shell: `${dirs.shell}/chrome-headless-shell-mac-arm64/chrome-headless-shell`,
    firefox: `${dirs.firefox}/firefox/Nightly.app/Contents/MacOS/firefox`,
    webkit: `${dirs.webkit}/pw_run.sh`,
  };
  const probeWith = (onDisk: string[]): BrowserProbe => ({
    executables: async (project, headless) => {
      if (project === 'chromium') {
        return headless ? [{ path: exe.shell, dir: dirs.shell }] : [{ path: exe.chromium, dir: dirs.chromium }];
      }
      return [{ path: exe[project], dir: dirs[project] }];
    },
    exists: (p) => onDisk.includes(p),
  });
  /** A browser unpacked in full: its executable and Playwright's marker. */
  const complete = (key: keyof typeof dirs): string[] => [exe[key], `${dirs[key]}/INSTALLATION_COMPLETE`];

  it('reports missing when the expected binary is not on disk', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith([]));
    expect(result).toEqual({
      status: 'missing',
      projects: ['chromium'],
      missingProjects: ['chromium'],
      installCommand: `${SNIFF_INSTALL} chromium`,
      installSizeMb: BROWSER_SIZE.chromium.downloadMb,
      downloadSizeMb: BROWSER_SIZE.chromium.downloadMb,
      diskSizeMb: BROWSER_SIZE.chromium.diskMb,
    });
  });

  it('reports installed when both Chromium builds are on disk', async () => {
    const onDisk = [...complete('chromium'), ...complete('shell')];
    expect(await checkPlaywrightBrowsers(['chromium'], probeWith(onDisk))).toEqual({ status: 'installed', projects: ['chromium'] });
    expect((await checkPlaywrightBrowsers(['chromium'], probeWith(onDisk), { headless: false })).status).toBe('installed');
  });

  it('accepts the Chromium headless shell without the full browser for a headless walk', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith(complete('shell')));
    expect(result.status).toBe('installed');
  });

  // Defect seen on 0.9.1: the download was killed after Chromium and before
  // the headless shell. The old check counted the Chromium folder, and the
  // walk then failed with Playwright's raw "Executable doesn't exist".
  it('reports missing when Chromium is on disk but the headless shell is not', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith(complete('chromium')));
    expect(result.status).toBe('missing');
    if (result.status === 'missing') expect(result.installCommand).toBe(`${SNIFF_INSTALL} chromium`);
  });

  it('reports missing for a headed walk when only the headless shell is on disk', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith(complete('shell')), { headless: false });
    expect(result.status).toBe('missing');
  });

  it('reports missing when the executable exists but the unpack never finished', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith([exe.shell]));
    expect(result.status).toBe('missing');
  });

  it('names only the browsers that are missing', async () => {
    const result = await checkPlaywrightBrowsers(['chromium', 'firefox'], probeWith(complete('shell')));
    expect(result.status).toBe('missing');
    if (result.status === 'missing') {
      expect(result.missingProjects).toEqual(['firefox']);
      expect(result.installCommand).toBe(`${SNIFF_INSTALL} firefox`);
      expect(result.installSizeMb).toBe(BROWSER_SIZE.firefox.downloadMb);
    }
  });

  it('reports every browser missing when Playwright cannot be loaded', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], {
      executables: async () => { throw new Error('Cannot find package playwright'); },
      exists: () => true,
    });
    expect(result.status).toBe('missing');
    if (result.status === 'missing') expect(result.missingProjects).toEqual(['chromium']);
  });

  it('the default probe asks for the headless shell on a headless walk', async () => {
    const found = await defaultProbe.executables('chromium', true).catch(() => null);
    // Without Playwright in this checkout there is nothing to assert.
    if (found) {
      expect(found).toHaveLength(1);
      expect(found[0]!.dir).toMatch(/chromium_headless_shell-\d+$/);
      const headed = await defaultProbe.executables('chromium', false);
      expect(headed[0]!.dir).toMatch(/chromium-\d+$/);
    }
  });
});

describe('needsSetup from a launch error', () => {
  const hint = 'Run sniff_install.';
  it('turns Playwright\'s "Executable doesn\'t exist" into the needsSetup payload', () => {
    const err = new Error(
      "browserType.launch: Executable doesn't exist at /cache/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell\n" +
        'Looks like Playwright Test or Playwright was just installed or updated.\nPlease run the following command to download new browsers:\n\n    npx playwright install',
    );
    const payload = needsSetupFromError(err, hint);
    expect(payload).toMatchObject({
      needsSetup: 'playwright-browsers',
      projects: ['chromium'],
      installCommand: `${SNIFF_INSTALL} chromium`,
      hint,
    });
    expect(JSON.stringify(payload)).not.toContain('npx playwright install');
  });

  it('finds the error behind a wrapper and keeps the browser it names', () => {
    const inner = new Error("browserType.launch: Executable doesn't exist at /x/ms-playwright/firefox-1511/firefox/firefox");
    const outer = new Error('Failed to launch firefox', { cause: inner });
    expect(needsSetupFromError(outer, hint)).toMatchObject({ projects: ['firefox'] });
  });

  it('leaves other launch errors alone', () => {
    expect(needsSetupFromError(new Error('net::ERR_CONNECTION_REFUSED'), hint)).toBeNull();
  });

  it('the CLI hint names sniff-qa install, never npx playwright install', () => {
    const lines = browserMissingHint(['chromium']).join('\n');
    expect(lines).toContain(`${SNIFF_INSTALL} chromium`);
    expect(lines).not.toContain('npx playwright');
  });

  it('every MCP payload carries the same labelled sizes', () => {
    const p = needsSetupPayload(['chromium'], hint) as Record<string, number | string>;
    expect(p.installSizeMb).toBe(p.downloadSizeMb);
    expect(String(p.sizeNote)).toContain(`about ${p.downloadSizeMb} MB to download`);
    expect(String(p.sizeNote)).toContain(`about ${p.diskSizeMb} MB on disk`);
  });
});
