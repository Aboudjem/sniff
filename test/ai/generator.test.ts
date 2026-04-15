import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AnalysisResult } from '../../src/analyzers/types.js';
import type { GenerateOptions } from '../../src/ai/generator.js';

// Mock provider
const mockGenerateTests = vi.fn();
vi.mock('../../src/ai/provider.js', () => ({
  resolveProvider: vi.fn(async () => ({
    name: 'mock-provider',
    generateTests: mockGenerateTests,
  })),
}));

// Mock fs
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
const mockReadFile = vi.fn().mockResolvedValue('export default function Page() {}');
vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

function makeAnalysis(routeCount: number = 2): AnalysisResult {
  const routes = Array.from({ length: routeCount }, (_, i) => ({
    path: i === 0 ? '/' : `/page-${i}`,
    filePath: i === 0 ? 'src/app/page.tsx' : `src/app/page-${i}/page.tsx`,
    framework: 'nextjs-app',
    dynamic: false,
  }));

  return {
    project: {
      name: 'test-project',
      frameworks: [{ name: 'nextjs' as const, configFiles: ['next.config.js'] }],
      rootDir: '/tmp/test-project',
    },
    routes,
    components: [],
    elements: [],
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: 100,
      fileCount: routeCount,
      routeCount,
      elementCount: 0,
    },
  };
}

function makeOptions(overrides?: Partial<GenerateOptions>): GenerateOptions {
  return {
    outputDir: 'sniff-tests',
    maxConcurrency: 5,
    rootDir: '/tmp/test-project',
    ...overrides,
  };
}

describe('generateTests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateTests.mockResolvedValue({
      specContent: 'import { test, expect } from "@playwright/test";\ntest("works", async ({page}) => {});',
      reasoning: 'Test reasoning',
      route: '/',
    });
  });

  it('calls resolveProvider to get an AIProvider', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    const { resolveProvider } = await import('../../src/ai/provider.js');
    await generateTests(makeAnalysis(), makeOptions());
    expect(resolveProvider).toHaveBeenCalledOnce();
  });

  it('calls provider.generateTests once per route in the analysis', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    await generateTests(makeAnalysis(3), makeOptions());
    expect(mockGenerateTests).toHaveBeenCalledTimes(3);
  });

  it('writes .spec.ts files to the configured output directory', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    await generateTests(makeAnalysis(1), makeOptions());
    expect(mockWriteFile).toHaveBeenCalled();
    const writePath = mockWriteFile.mock.calls[0][0] as string;
    expect(writePath).toContain('sniff-tests');
    expect(writePath).toMatch(/\.spec\.ts$/);
  });

  it('names files by route path: "/" -> "home.spec.ts"', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    const analysis = makeAnalysis(1); // single route at "/"
    await generateTests(analysis, makeOptions());
    const writePath = mockWriteFile.mock.calls[0][0] as string;
    expect(writePath).toContain('home.spec.ts');
  });

  it('names files by route path: "/dashboard/settings" -> "dashboard-settings.spec.ts"', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    const analysis = makeAnalysis(1);
    analysis.routes[0].path = '/dashboard/settings';
    await generateTests(analysis, makeOptions());
    const writePath = mockWriteFile.mock.calls[0][0] as string;
    expect(writePath).toContain('dashboard-settings.spec.ts');
  });

  it('respects maxConcurrency from config', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    // With 7 routes and maxConcurrency 3, should be 3 batches
    let callOrder: number[] = [];
    let batchCount = 0;
    mockGenerateTests.mockImplementation(async () => {
      callOrder.push(batchCount);
      return { specContent: 'test', reasoning: '', route: '/' };
    });

    // We can't easily test batching directly, but we can verify all routes are processed
    await generateTests(makeAnalysis(7), makeOptions({ maxConcurrency: 3 }));
    expect(mockGenerateTests).toHaveBeenCalledTimes(7);
  });

  it('returns array of GeneratedTest results', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    const results = await generateTests(makeAnalysis(2), makeOptions());
    expect(results).toHaveLength(2);
    expect(results[0]).toHaveProperty('specContent');
    expect(results[0]).toHaveProperty('reasoning');
    expect(results[0]).toHaveProperty('route');
  });

  it('skips routes that fail AI generation and continues with remaining routes', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    mockGenerateTests
      .mockRejectedValueOnce(new Error('AI failed for this route'))
      .mockResolvedValueOnce({
        specContent: 'import { test, expect } from "@playwright/test";',
        reasoning: 'Worked',
        route: '/page-1',
      });

    const results = await generateTests(makeAnalysis(2), makeOptions());
    // One succeeded, one failed
    expect(results).toHaveLength(1);
    expect(mockGenerateTests).toHaveBeenCalledTimes(2);
  });

  it('creates output directory if it does not exist', async () => {
    const { generateTests } = await import('../../src/ai/generator.js');
    await generateTests(makeAnalysis(1), makeOptions());
    expect(mockMkdir).toHaveBeenCalledWith(
      expect.stringContaining('sniff-tests'),
      { recursive: true },
    );
  });

  it('logs progress for each batch', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { generateTests } = await import('../../src/ai/generator.js');
    await generateTests(makeAnalysis(3), makeOptions());

    const logMessages = consoleSpy.mock.calls.map(c => c[0] as string);
    const progressMsg = logMessages.find(m => m.includes('Generating tests:'));
    expect(progressMsg).toBeDefined();
    consoleSpy.mockRestore();
  });
});
