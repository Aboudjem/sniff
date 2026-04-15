import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolve } from 'node:path';

const FIXTURE_DIR = resolve(__dirname, '../fixtures/nextjs-app');

describe('Phase 2 Integration: Repo Analyzer + AI Test Generation', () => {

  describe('Analyzer Pipeline', () => {
    it('detects Next.js framework from fixture project', async () => {
      const { detectFrameworks } = await import('../../src/analyzers/framework-detector.js');
      const frameworks = await detectFrameworks(FIXTURE_DIR);
      expect(frameworks).toHaveLength(1);
      expect(frameworks[0].name).toBe('nextjs');
    });

    it('discovers routes from Next.js app directory', async () => {
      const { detectFrameworks } = await import('../../src/analyzers/framework-detector.js');
      const { discoverRoutes } = await import('../../src/analyzers/route-discoverer.js');
      const frameworks = await detectFrameworks(FIXTURE_DIR);
      const routes = await discoverRoutes(FIXTURE_DIR, frameworks);

      expect(routes.length).toBeGreaterThanOrEqual(3);
      const paths = routes.map(r => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/about');

      // Dynamic route detection
      const dynamicRoute = routes.find(r => r.dynamic);
      expect(dynamicRoute).toBeDefined();
      expect(dynamicRoute!.params).toContain('id');
    });

    it('extracts interactive elements from route files', async () => {
      const { extractElements } = await import('../../src/analyzers/element-extractor.js');
      const routeFiles = [
        resolve(FIXTURE_DIR, 'app/page.tsx'),
        resolve(FIXTURE_DIR, 'app/about/page.tsx'),
        resolve(FIXTURE_DIR, 'app/dashboard/[id]/page.tsx'),
      ];
      const { elements } = await extractElements(routeFiles, FIXTURE_DIR);

      // Should find buttons, inputs, links, forms, selects, textareas
      const tags = [...new Set(elements.map(e => e.tag))];
      expect(tags).toContain('button');
      expect(tags).toContain('input');
      expect(tags).toContain('a');
      expect(tags).toContain('form');
      expect(tags).toContain('select');
      expect(tags).toContain('textarea');

      // Should capture data-testid attributes
      const withTestId = elements.filter(e => e.testId);
      expect(withTestId.length).toBeGreaterThanOrEqual(5);
      expect(withTestId.map(e => e.testId)).toContain('search-btn');
      expect(withTestId.map(e => e.testId)).toContain('about-link');
    });

    it('RepoAnalyzer returns full AnalysisResult in metadata', async () => {
      const { RepoAnalyzer } = await import('../../src/scanners/repo-analyzer.js');
      const { sniffConfigSchema } = await import('../../src/config/schema.js');
      const config = sniffConfigSchema.parse({});
      const analyzer = new RepoAnalyzer();
      const result = await analyzer.scan({ config, rootDir: FIXTURE_DIR });

      expect(result.scanner).toBe('repo-analyzer');
      expect(result.findings).toHaveLength(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
      expect(result.metadata!.analysis).toBeDefined();

      const analysis = result.metadata!.analysis as Record<string, unknown>;
      const project = analysis.project as Record<string, unknown>;
      const frameworks = project.frameworks as Array<Record<string, unknown>>;
      expect(frameworks[0].name).toBe('nextjs');
      expect((analysis.routes as unknown[]).length).toBeGreaterThanOrEqual(3);
      expect((analysis.elements as unknown[]).length).toBeGreaterThanOrEqual(5);
      const metadata = analysis.metadata as Record<string, unknown>;
      expect(metadata.routeCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('AI Test Generation (mocked provider)', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('generates .spec.ts files from analysis using mock provider', async () => {
      // Mock the provider module to avoid calling real AI
      vi.doMock('../../src/ai/provider.js', () => ({
        resolveProvider: async () => ({
          name: 'mock-provider',
          generateTests: async (ctx: { route: { path: string }; elements: Array<{ testId?: string }> }) => ({
            specContent: [
              "import { test, expect } from '@playwright/test';",
              '',
              `/** Tests for ${ctx.route.path} -- verifies interactive elements are functional */`,
              `test('${ctx.route.path} loads correctly', async ({ page }) => {`,
              `  await page.goto('${ctx.route.path}');`,
              ctx.elements[0]?.testId
                ? `  await expect(page.getByTestId('${ctx.elements[0].testId}')).toBeVisible();`
                : `  await expect(page).toHaveURL('${ctx.route.path}');`,
              '});',
            ].join('\n'),
            reasoning: `Generated navigation and element visibility test for ${ctx.route.path}`,
            route: ctx.route.path,
          }),
        }),
      }));

      // Import AFTER mocking so the mock takes effect
      const { generateTests } = await import('../../src/ai/generator.js');
      const { RepoAnalyzer } = await import('../../src/scanners/repo-analyzer.js');
      const { sniffConfigSchema } = await import('../../src/config/schema.js');
      const { mkdtemp, readFile, readdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const os = await import('node:os');

      const config = sniffConfigSchema.parse({});
      const analyzer = new RepoAnalyzer();
      const result = await analyzer.scan({ config, rootDir: FIXTURE_DIR });
      const analysis = result.metadata!.analysis as import('../../src/analyzers/types.js').AnalysisResult;

      const tmpDir = await mkdtemp(join(os.tmpdir(), 'sniff-gen-'));
      const results = await generateTests(analysis, {
        outputDir: 'generated-tests',
        maxConcurrency: 5,
        rootDir: tmpDir,
      });

      // Should generate one test per route
      expect(results.length).toBeGreaterThanOrEqual(3);

      // Check files were written
      const outputDir = join(tmpDir, 'generated-tests');
      const files = await readdir(outputDir);
      expect(files.length).toBeGreaterThanOrEqual(3);
      expect(files).toContain('home.spec.ts');
      expect(files).toContain('about.spec.ts');

      // Verify file content is valid Playwright
      const homeContent = await readFile(join(outputDir, 'home.spec.ts'), 'utf-8');
      expect(homeContent).toContain("import { test, expect } from '@playwright/test'");
      expect(homeContent).toContain('test(');

      // Verify reasoning comments are included (JSDoc-style)
      expect(homeContent).toContain('/**');

      vi.doUnmock('../../src/ai/provider.js');
    });
  });
});
