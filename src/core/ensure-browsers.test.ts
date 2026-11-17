import { describe, it, expect } from 'vitest';
import { checkPlaywrightBrowsers, type BrowserProbe } from './ensure-browsers.js';

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
      expect(result.installCommand).toBe('npx playwright install chromium');
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
      expect(result.installCommand).toBe(`npx playwright install ${result.missingProjects.join(' ')}`);
    }
  });

  // executablePath() returns a path even when nothing was downloaded, so the
  // check has to look at the disk. These cases pin that down with a fake disk.
  const ROOT = '/cache/ms-playwright';
  const paths = {
    chromium: `${ROOT}/chromium-1217/chrome-linux/chrome`,
    firefox: `${ROOT}/firefox-1509/firefox/firefox`,
    webkit: `${ROOT}/webkit-2248/pw_run.sh`,
  };
  const probeWith = (onDisk: string[]): BrowserProbe => ({
    executablePath: async (project) => paths[project],
    exists: (p) => onDisk.includes(p),
  });

  it('reports missing when the expected binary is not on disk', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith([]));
    expect(result).toEqual({
      status: 'missing',
      projects: ['chromium'],
      missingProjects: ['chromium'],
      installCommand: 'npx playwright install chromium',
      installSizeMb: 165,
    });
  });

  it('reports installed when the binary is on disk', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], probeWith([paths.chromium]));
    expect(result).toEqual({ status: 'installed', projects: ['chromium'] });
  });

  it('accepts the Chromium headless shell without the full browser', async () => {
    const result = await checkPlaywrightBrowsers(
      ['chromium'],
      probeWith([`${ROOT}/chromium_headless_shell-1217`]),
    );
    expect(result.status).toBe('installed');
  });

  it('does not accept a headless shell of another revision', async () => {
    const result = await checkPlaywrightBrowsers(
      ['chromium'],
      probeWith([`${ROOT}/chromium_headless_shell-1208`]),
    );
    expect(result.status).toBe('missing');
  });

  it('names only the browsers that are missing', async () => {
    const result = await checkPlaywrightBrowsers(['chromium', 'firefox'], probeWith([paths.chromium]));
    expect(result.status).toBe('missing');
    if (result.status === 'missing') {
      expect(result.missingProjects).toEqual(['firefox']);
      expect(result.installCommand).toBe('npx playwright install firefox');
      expect(result.installSizeMb).toBe(95);
    }
  });

  it('reports every browser missing when Playwright cannot be loaded', async () => {
    const result = await checkPlaywrightBrowsers(['chromium'], {
      executablePath: async () => { throw new Error('Cannot find package playwright'); },
      exists: () => true,
    });
    expect(result.status).toBe('missing');
    if (result.status === 'missing') expect(result.missingProjects).toEqual(['chromium']);
  });
});
