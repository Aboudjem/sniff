import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { RepoAnalyzer } from '../../src/scanners/repo-analyzer.js';
import { sniffConfigSchema } from '../../src/config/schema.js';
import type { ScanContext } from '../../src/scanners/types.js';

describe('RepoAnalyzer', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-ra-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function makeCtx(overrides?: Partial<ScanContext>): ScanContext {
    return {
      config: sniffConfigSchema.parse({}),
      rootDir: tmpDir,
      ...overrides,
    };
  }

  it('has name equal to repo-analyzer', () => {
    const analyzer = new RepoAnalyzer();
    expect(analyzer.name).toBe('repo-analyzer');
  });

  it('returns ScanResult with scanner=repo-analyzer and findings=[]', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: {} }),
    );

    const analyzer = new RepoAnalyzer();
    const result = await analyzer.scan(makeCtx());

    expect(result.scanner).toBe('repo-analyzer');
    expect(result.findings).toEqual([]);
  });

  it('returns ScanResult.metadata.analysis containing AnalysisResult shape', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: {} }),
    );

    const analyzer = new RepoAnalyzer();
    const result = await analyzer.scan(makeCtx());
    const analysis = result.metadata?.analysis as Record<string, unknown>;

    expect(analysis).toBeDefined();
    expect(analysis).toHaveProperty('project');
    expect(analysis).toHaveProperty('routes');
    expect(analysis).toHaveProperty('components');
    expect(analysis).toHaveProperty('elements');
    expect(analysis).toHaveProperty('metadata');
  });

  it('populates metadata.analysis.routes from route discovery', async () => {
    // Create a Next.js app router fixture
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }),
    );
    await writeFile(join(tmpDir, 'next.config.js'), 'module.exports = {};');
    await mkdir(join(tmpDir, 'app'), { recursive: true });
    await writeFile(
      join(tmpDir, 'app', 'page.tsx'),
      `export default function Home() {
  return <button data-testid="home-btn">Home</button>;
}`,
    );

    const analyzer = new RepoAnalyzer();
    const result = await analyzer.scan(makeCtx());
    const analysis = result.metadata?.analysis as {
      routes: Array<{ path: string }>;
    };

    expect(analysis.routes.length).toBeGreaterThanOrEqual(1);
    expect(analysis.routes[0]).toHaveProperty('path');
  });

  it('populates metadata.analysis.project.frameworks from framework detection', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: { next: '^14.0.0', react: '^18.0.0' } }),
    );
    await writeFile(join(tmpDir, 'next.config.js'), 'module.exports = {};');

    const analyzer = new RepoAnalyzer();
    const result = await analyzer.scan(makeCtx());
    const analysis = result.metadata?.analysis as {
      project: { frameworks: Array<{ name: string }> };
    };

    expect(analysis.project.frameworks.length).toBeGreaterThanOrEqual(1);
    expect(analysis.project.frameworks[0].name).toBe('nextjs');
  });

  it('includes duration > 0', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ dependencies: {} }),
    );

    const analyzer = new RepoAnalyzer();
    const result = await analyzer.scan(makeCtx());

    expect(result.duration).toBeGreaterThan(0);
  });
});

describe('Config schema extensions', () => {
  it('accepts analyzer and ai config sections', () => {
    const result = sniffConfigSchema.safeParse({
      analyzer: {
        frameworks: ['nextjs'],
        elementSelectors: ['data-testid', 'id'],
      },
      ai: {
        provider: 'claude-code',
        model: 'claude-sonnet-4-5-20250514',
        outputDir: 'my-tests',
        maxConcurrency: 10,
      },
    });

    expect(result.success).toBe(true);
  });

  it('defaults ai.provider to claude-code', () => {
    const result = sniffConfigSchema.parse({ ai: {} });
    expect(result.ai?.provider).toBe('claude-code');
  });

  it('defaults ai.outputDir to sniff-tests', () => {
    const result = sniffConfigSchema.parse({ ai: {} });
    expect(result.ai?.outputDir).toBe('sniff-tests');
  });

  it('defaults ai.maxConcurrency to 5', () => {
    const result = sniffConfigSchema.parse({ ai: {} });
    expect(result.ai?.maxConcurrency).toBe(5);
  });

  it('scanners default now includes repo-analyzer alongside source', () => {
    const result = sniffConfigSchema.parse({});
    expect(result.scanners).toContain('source');
    expect(result.scanners).toContain('repo-analyzer');
  });
});
