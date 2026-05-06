import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserScanner, BrowserScanContext } from '../scanners/types.js';
import type { SniffConfig } from '../config/schema.js';

type Handler = (...args: unknown[]) => void;

class FakePage {
  currentUrl = 'about:blank';
  handlers = new Map<string, Handler[]>();

  on(event: string, handler: Handler): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  url(): string {
    return this.currentUrl;
  }

  async goto(url: string): Promise<void> {
    this.currentUrl = url;
    for (const handler of this.handlers.get('console') ?? []) {
      handler({
        type: () => 'error',
        text: () => 'boom from browser',
        location: () => ({ url }),
      });
    }
  }

  async screenshot(): Promise<Buffer> {
    return Buffer.from('png');
  }
}

const fakePage = new FakePage();
const launchMock = vi.fn(async () => ({
  newContext: vi.fn(async () => ({
    newPage: vi.fn(async () => fakePage),
    close: vi.fn(async () => {}),
  })),
  close: vi.fn(async () => {}),
}));

vi.mock('playwright', () => ({
  chromium: { launch: launchMock, executablePath: () => '/tmp/chromium' },
  firefox: { launch: launchMock, executablePath: () => '/tmp/firefox' },
  webkit: { launch: launchMock, executablePath: () => '/tmp/webkit' },
}));

function makeConfig(overrides?: Partial<SniffConfig>): SniffConfig {
  return {
    scanners: ['e2e', 'accessibility'],
    failOn: ['critical', 'high'],
    exclude: [],
    include: [],
    rules: {},
    viewports: [{ name: 'desktop', width: 1280, height: 720 }],
    ...overrides,
  } as SniffConfig;
}

describe('BrowserRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakePage.handlers.clear();
    fakePage.currentUrl = 'about:blank';
  });

  it('passes the target rootDir and browser project into browser scanners', async () => {
    const seen: Array<{ rootDir: string; browser: string }> = [];
    const scanner: BrowserScanner = {
      name: 'accessibility',
      async scan(ctx: BrowserScanContext) {
        seen.push({ rootDir: ctx.rootDir, browser: ctx.browser });
        return { scanner: 'accessibility', findings: [], duration: 1 };
      },
    };

    const { BrowserRunner } = await import('./runner.js');
    const runner = new BrowserRunner(makeConfig({ scanners: ['accessibility'] }));
    runner.registerScanner(scanner);

    await runner.run({
      baseUrl: 'http://localhost:3000',
      testFiles: ['/dashboard'],
      viewports: [{ name: 'desktop', width: 1280, height: 720 }],
      rootDir: '/tmp/sniff-target',
      projects: ['firefox'],
      headless: true,
      slowMo: 0,
      timeout: 1000,
    });

    expect(seen).toEqual([{ rootDir: '/tmp/sniff-target', browser: 'firefox' }]);
  });

  it('adds page-hook findings to scanResults so reports and exit codes can see them', async () => {
    const { BrowserRunner } = await import('./runner.js');
    const runner = new BrowserRunner(makeConfig({ scanners: ['e2e'] }));

    const result = await runner.run({
      baseUrl: 'http://localhost:3000',
      testFiles: ['/'],
      viewports: [{ name: 'desktop', width: 1280, height: 720 }],
      rootDir: '/tmp/sniff-target',
      projects: ['chromium'],
      headless: true,
      slowMo: 0,
      timeout: 1000,
    });

    const e2e = result.scanResults.find((scanResult) => scanResult.scanner === 'e2e');
    expect(e2e?.findings[0]).toMatchObject({
      ruleId: 'e2e/console-error',
      severity: 'high',
      browser: 'chromium',
      viewport: 'desktop',
    });
    expect(result.pageVisits[0].findings).toHaveLength(1);
  });
});
