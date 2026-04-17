import { describe, it, expect, vi } from 'vitest';
import type { Browser } from 'playwright';
import type { SniffConfig } from '../config/schema.js';
import type { Scenario } from './scenarios/types.js';
import type { AppTypeGuess } from './classifier/types.js';
import type { DiscoveryRunContext } from './run-types.js';
import type { BrowserFinding } from '../core/types.js';
import { runScenarios } from './runner.js';

function makeFakeLocator(opts: { visible?: boolean; countValue?: number } = {}) {
  const locator: Record<string, unknown> = {
    first: vi.fn(() => locator),
    nth: vi.fn(() => locator),
    waitFor: vi.fn(async () => undefined),
    isVisible: vi.fn(async () => opts.visible !== false),
    click: vi.fn(async () => undefined),
    fill: vi.fn(async () => undefined),
    selectOption: vi.fn(async () => undefined),
    count: vi.fn(async () => opts.countValue ?? 1),
    evaluate: vi.fn(async () => ({})),
  };
  return locator;
}

interface FakePageOptions {
  initialUrl?: string;
  navigateTo?: Record<string, string>;
  visible?: boolean;
  count?: number;
  textMatch?: boolean;
}

function makeFakePage(opts: FakePageOptions = {}) {
  let currentUrl = opts.initialUrl ?? 'http://localhost:3000/';
  const locator = makeFakeLocator({ visible: opts.visible, countValue: opts.count });
  const page: Record<string, unknown> = {
    url: vi.fn(() => currentUrl),
    title: vi.fn(async () => 'Fixture'),
    goto: vi.fn(async (url: string) => {
      currentUrl = opts.navigateTo?.[url] ?? url;
      return undefined;
    }),
    locator: vi.fn(() => locator),
    getByRole: vi.fn(() => locator),
    getByText: vi.fn(() => makeFakeLocator({ visible: opts.textMatch !== false, countValue: opts.textMatch === false ? 0 : 1 })),
    waitForTimeout: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => undefined),
    on: vi.fn(),
    screenshot: vi.fn(async () => Buffer.from('')),
  };
  return page;
}

function makeFakeBrowser(page: ReturnType<typeof makeFakePage>): Browser {
  const context = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
  return {
    newContext: vi.fn(async () => context),
    close: vi.fn(async () => undefined),
  } as unknown as Browser;
}

function makeContext(): DiscoveryRunContext {
  return {
    baseUrl: 'http://localhost:3000',
    rootDir: '/tmp/test',
    headless: true,
    viewport: { width: 1280, height: 720 },
    stepTimeoutMs: 5000,
    scenarioTimeoutMs: 30000,
    reportDir: 'sniff-reports',
    seed: 42,
  };
}

function makeConfig(): SniffConfig {
  return {
    failOn: ['critical', 'high'],
    exclude: [],
    include: ['**/*.{ts,tsx,js,jsx,html,css}'],
    rules: {},
    scanners: ['source'],
    viewports: [{ name: 'desktop', width: 1280, height: 720 }],
  } as SniffConfig;
}

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'test.demo.happy',
    name: 'Demo scenario',
    appType: 'ecommerce',
    journey: 'demo',
    variant: 'happy',
    persona: 'anonymous',
    realism: 'robot',
    steps: [
      { n: 1, intent: 'Open home', action: 'navigate', url: '/' },
      {
        n: 2,
        intent: 'Click shop',
        action: 'click',
        target: { selectorHints: ['[data-testid="nav-shop"]'] },
      },
    ],
    goal: { kind: 'url', value: 'shop', description: 'reach shop' },
    validations: {
      perStep: [{ kind: 'console-clean' }, { kind: 'network-clean' }, { kind: 'visible-target' }],
      perScenario: [],
    },
    tags: ['smoke'],
    generatedFrom: { routes: [], entities: [], forms: [], confidence: 0.5 },
    ...overrides,
  };
}

function makeHookController(findings: BrowserFinding[] = []) {
  return {
    collect: () => findings,
    reset: () => {
      findings.length = 0;
    },
    screenshot: async () => 'shot.png',
  };
}

describe('runScenarios', () => {
  it('runs a happy-path scenario and marks it pass', async () => {
    const page = makeFakePage({ visible: true });
    const browser = makeFakeBrowser(page);
    const scenario = makeScenario();

    const report = await runScenarios(
      [scenario],
      [{ type: 'ecommerce', confidence: 0.8, evidence: [], rawScore: 0 }] as AppTypeGuess[],
      makeContext(),
      makeConfig(),
      {
        launchBrowser: async () => browser,
        setupHooks: async () => makeHookController(),
      },
    );

    expect(report.scenarios).toHaveLength(1);
    const result = report.scenarios[0];
    expect(result.status).toBe('pass');
    expect(result.steps).toHaveLength(2);
    expect(result.steps.every((s) => s.status === 'pass')).toBe(true);
    expect(report.stats.passed).toBe(1);
  });

  it('fails a step when the target cannot be resolved', async () => {
    const page = makeFakePage({ visible: false });
    const browser = makeFakeBrowser(page);
    const scenario = makeScenario({
      steps: [
        {
          n: 1,
          intent: 'Click missing',
          action: 'click',
          target: { selectorHints: ['[data-testid="missing"]'] },
        },
      ],
    });

    const report = await runScenarios(
      [scenario],
      [],
      makeContext(),
      makeConfig(),
      {
        launchBrowser: async () => browser,
        setupHooks: async () => makeHookController(),
      },
    );

    expect(report.scenarios[0].status).toBe('fail');
    expect(report.scenarios[0].steps[0].failureReason).toBeDefined();
    expect(report.stats.failed).toBe(1);
  });

  it('stops at the first failing step', async () => {
    const page = makeFakePage({ visible: false });
    const browser = makeFakeBrowser(page);
    const scenario = makeScenario({
      steps: [
        { n: 1, intent: 'Open', action: 'navigate', url: '/' },
        { n: 2, intent: 'Click missing', action: 'click', target: { selectorHints: ['[data-testid="missing"]'] } },
        { n: 3, intent: 'Never runs', action: 'navigate', url: '/never' },
      ],
    });

    const report = await runScenarios(
      [scenario],
      [],
      makeContext(),
      makeConfig(),
      {
        launchBrowser: async () => browser,
        setupHooks: async () => makeHookController(),
      },
    );

    const result = report.scenarios[0];
    expect(result.status).toBe('fail');
    expect(result.steps.length).toBe(2);
  });

  it('records console-clean failure when a console error occurs', async () => {
    const page = makeFakePage({ visible: true });
    const browser = makeFakeBrowser(page);
    const scenario = makeScenario({
      steps: [{ n: 1, intent: 'Open', action: 'navigate', url: '/' }],
      validations: {
        perStep: [{ kind: 'console-clean' }, { kind: 'visible-target' }],
        perScenario: [],
      },
    });

    const consoleFindings: BrowserFinding[] = [
      {
        ruleId: 'e2e/console-error',
        severity: 'high',
        message: 'TypeError: x is not a function',
        filePath: '',
        line: 0,
        column: 0,
        snippet: '',
        url: 'http://localhost:3000/',
        viewport: '1280x720',
      },
    ];

    const report = await runScenarios(
      [scenario],
      [],
      makeContext(),
      makeConfig(),
      {
        launchBrowser: async () => browser,
        setupHooks: async () => ({
          collect: () => consoleFindings,
          reset: () => undefined,
          screenshot: async () => undefined,
        }),
      },
    );

    const result = report.scenarios[0];
    expect(result.status).toBe('fail');
    const consoleValidation = result.steps[0].validations.find((v) => v.kind === 'console-clean');
    expect(consoleValidation?.passed).toBe(false);
  });

  it('skips scenarios whose baseUrl is unreachable', async () => {
    const page = makeFakePage({});
    page.goto = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const browser = makeFakeBrowser(page);
    const scenario = makeScenario();

    const report = await runScenarios(
      [scenario],
      [],
      makeContext(),
      makeConfig(),
      {
        launchBrowser: async () => browser,
        setupHooks: async () => makeHookController(),
      },
    );

    expect(report.scenarios[0].status).toBe('skip');
    expect(report.scenarios[0].skippedReason).toContain('could not reach baseUrl');
    expect(report.stats.skipped).toBe(1);
  });

  it('returns empty report when no scenarios provided', async () => {
    const report = await runScenarios([], [], makeContext(), makeConfig(), {
      launchBrowser: async () => makeFakeBrowser(makeFakePage()),
      setupHooks: async () => makeHookController(),
    });
    expect(report.stats.total).toBe(0);
    expect(report.scenarios).toEqual([]);
  });

  it('populates stats and runAt', async () => {
    const page = makeFakePage({ visible: true });
    const browser = makeFakeBrowser(page);
    const report = await runScenarios(
      [makeScenario()],
      [{ type: 'ecommerce', confidence: 0.8, evidence: [], rawScore: 0 }] as AppTypeGuess[],
      makeContext(),
      makeConfig(),
      {
        launchBrowser: async () => browser,
        setupHooks: async () => makeHookController(),
      },
    );
    expect(report.runAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.stats.total).toBe(1);
    expect(report.stats.passed + report.stats.failed + report.stats.skipped).toBe(1);
    expect(report.appTypeGuesses).toHaveLength(1);
  });
});
