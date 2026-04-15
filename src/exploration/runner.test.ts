import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExplorationProvider } from '../ai/types.js';
import type { ExplorationContext, ExplorationDecision, PageState } from './types.js';
import type { BrowserFinding } from '../core/types.js';

// Shared findings array the mock pipeline reads from — tests can push findings here
const sharedFindings: BrowserFinding[] = [];

// Mock playwright
vi.mock('playwright', () => {
  const mockPage = {
    url: vi.fn(() => 'http://localhost:3000'),
    title: vi.fn(async () => 'Test Page'),
    goto: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
    fill: vi.fn(async () => undefined),
    evaluate: vi.fn(async () => undefined),
    waitForTimeout: vi.fn(async () => undefined),
    on: vi.fn(),
    screenshot: vi.fn(async () => Buffer.from('')),
  };

  const mockContext = {
    newPage: vi.fn(async () => mockPage),
    close: vi.fn(async () => undefined),
  };

  const mockBrowser = {
    newContext: vi.fn(async () => mockContext),
    close: vi.fn(async () => undefined),
  };

  return {
    chromium: {
      launch: vi.fn(async () => mockBrowser),
    },
  };
});

// Mock page-state-extractor
vi.mock('./page-state-extractor.js', () => ({
  extractPageState: vi.fn(async (): Promise<PageState> => ({
    url: 'http://localhost:3000',
    title: 'Test Page',
    interactiveElements: [
      { selector: '#btn-1', tag: 'button', text: 'Submit', visited: false },
      { selector: 'a.link-1', tag: 'a', text: 'About', visited: false },
    ],
    formFields: [
      { selector: 'input[name="email"]', name: 'email', type: 'email', required: true },
    ],
  })),
}));

// Mock page-hooks using classes so `new` works
// The collectAll method reads from sharedFindings so tests can inject findings
vi.mock('../browser/page-hooks.js', async () => {
  // Import the sharedFindings reference via a dynamic trick — we close over the module-level variable
  class MockConsoleErrorHook {
    name = 'console-error';
    setup() {}
    collect() { return []; }
    reset() {}
  }
  class MockNetworkFailureHook {
    name = 'network-failure';
    setup() {}
    collect() { return []; }
    reset() {}
  }
  class MockScreenshotHook {
    name = 'screenshot';
    setup() {}
    collect() { return []; }
    reset() {}
    async captureFailure() { return '/tmp/screenshot.png'; }
  }
  class MockPageHookPipeline {
    register() {}
    setupAll() {}
    collectAll() {
      // Drain shared findings
      return sharedFindings.splice(0, sharedFindings.length);
    }
    resetAll() {}
    async captureScreenshot() { return undefined; }
  }
  return {
    ConsoleErrorHook: MockConsoleErrorHook,
    NetworkFailureHook: MockNetworkFailureHook,
    ScreenshotHook: MockScreenshotHook,
    PageHookPipeline: MockPageHookPipeline,
  };
});

// Mock analyzers
vi.mock('../analyzers/framework-detector.js', () => ({
  detectFrameworks: vi.fn(async () => []),
}));

vi.mock('../analyzers/route-discoverer.js', () => ({
  discoverRoutes: vi.fn(async () => []),
}));

function makeProvider(decisions: ExplorationDecision[]): ExplorationProvider {
  let callIndex = 0;
  const fallback: ExplorationDecision = { action: 'done', reasoning: 'No more decisions' };
  return {
    decideNextAction: vi.fn(async (): Promise<ExplorationDecision> => {
      if (callIndex < decisions.length) {
        return decisions[callIndex++];
      }
      return fallback;
    }),
  };
}

function makeContext(overrides?: Partial<ExplorationContext>): ExplorationContext {
  return {
    baseUrl: 'http://localhost:3000',
    rootDir: '/tmp/test-project',
    headless: true,
    maxSteps: 5,
    timeout: 5000,
    viewport: { width: 1280, height: 720 },
    ...overrides,
  };
}

const minimalConfig = {
  failOn: ['critical', 'high'] as const,
  exclude: [] as string[],
  include: [] as string[],
  rules: {},
  scanners: [] as string[],
  viewports: [] as { name: string; width: number; height: number }[],
};

describe('ExplorationRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear shared findings between tests
    sharedFindings.length = 0;
  });

  it('terminates at maxSteps', async () => {
    const { ExplorationRunner } = await import('./runner.js');

    // Provider that always clicks (never returns done)
    const provider = makeProvider([
      { action: 'click', selector: '#btn-1', reasoning: 'click 1' },
      { action: 'click', selector: '#btn-1', reasoning: 'click 2' },
      { action: 'click', selector: '#btn-1', reasoning: 'click 3' },
      { action: 'click', selector: '#btn-1', reasoning: 'click 4' },
      { action: 'click', selector: '#btn-1', reasoning: 'click 5' },
      { action: 'click', selector: '#btn-1', reasoning: 'click 6' },
    ]);

    const runner = new ExplorationRunner(minimalConfig as any, provider);
    const result = await runner.explore(makeContext({ maxSteps: 3 }));

    // Should have at most 3 steps (bounded by maxSteps)
    expect(result.totalSteps).toBeLessThanOrEqual(3);
    expect(result.actionLog.length).toBeLessThanOrEqual(3);
  });

  it('terminates early when AI returns done', async () => {
    const { ExplorationRunner } = await import('./runner.js');

    const provider = makeProvider([
      { action: 'click', selector: '#btn-1', reasoning: 'exploring' },
      { action: 'done', reasoning: 'all done' },
    ]);

    const runner = new ExplorationRunner(minimalConfig as any, provider);
    const result = await runner.explore(makeContext({ maxSteps: 10 }));

    // Should stop after 2 steps (click + done), not run all 10
    expect(result.totalSteps).toBeLessThanOrEqual(2);
    const doneEntry = result.actionLog.find((e) => e.action === 'done');
    expect(doneEntry).toBeDefined();
  });

  it('collects findings from PageHookPipeline', async () => {
    // Push a finding into the shared array before running
    sharedFindings.push({
      ruleId: 'e2e/console-error',
      severity: 'high',
      message: 'Console error: test',
      filePath: '',
      line: 0,
      column: 0,
      snippet: 'test error',
      url: 'http://localhost:3000',
      viewport: '1280x720',
    });

    const { ExplorationRunner } = await import('./runner.js');

    const provider = makeProvider([
      { action: 'click', selector: '#btn-1', reasoning: 'testing' },
      { action: 'done', reasoning: 'done' },
    ]);

    const runner = new ExplorationRunner(minimalConfig as any, provider);
    const result = await runner.explore(makeContext());

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings[0].ruleId).toBe('e2e/console-error');
  });

  it('action log has correct step numbering and timestamps', async () => {
    const { ExplorationRunner } = await import('./runner.js');

    const provider = makeProvider([
      { action: 'click', selector: '#btn-1', reasoning: 'step 0' },
      { action: 'fill', selector: 'input[name="email"]', value: 'test', reasoning: 'step 1' },
      { action: 'done', reasoning: 'finished' },
    ]);

    const runner = new ExplorationRunner(minimalConfig as any, provider);
    const result = await runner.explore(makeContext());

    // Check step numbering is sequential
    for (let i = 0; i < result.actionLog.length; i++) {
      expect(result.actionLog[i].step).toBe(i);
    }

    // Check timestamps are valid ISO 8601
    for (const entry of result.actionLog) {
      expect(() => new Date(entry.timestamp)).not.toThrow();
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp);
    }
  });

  it('returns pagesVisited including baseUrl', async () => {
    const { ExplorationRunner } = await import('./runner.js');

    const provider = makeProvider([
      { action: 'done', reasoning: 'immediate done' },
    ]);

    const runner = new ExplorationRunner(minimalConfig as any, provider);
    const result = await runner.explore(makeContext());

    expect(result.pagesVisited).toContain('http://localhost:3000');
  });

  it('returns duration as a positive number', async () => {
    const { ExplorationRunner } = await import('./runner.js');

    const provider = makeProvider([
      { action: 'done', reasoning: 'quick exit' },
    ]);

    const runner = new ExplorationRunner(minimalConfig as any, provider);
    const result = await runner.explore(makeContext());

    expect(result.duration).toBeGreaterThan(0);
  });
});
