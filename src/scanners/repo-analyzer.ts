import { basename, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Scanner, ScanContext, ScanResult } from './types.js';
import type { AnalysisResult } from '../analyzers/types.js';

export class RepoAnalyzer implements Scanner {
  name = 'repo-analyzer';

  async scan(ctx: ScanContext): Promise<ScanResult> {
    const start = performance.now();

    // Lazy-load analyzer modules
    const { detectFrameworks } = await import('../analyzers/framework-detector.js');
    const { discoverRoutes } = await import('../analyzers/route-discoverer.js');
    const { extractElements } = await import('../analyzers/element-extractor.js');

    // 1. Detect frameworks
    const frameworks = await detectFrameworks(ctx.rootDir);

    // 2. Discover routes
    const routes = await discoverRoutes(ctx.rootDir, frameworks);

    // 3. Extract elements from route files (include .vue files per D-05)
    const routeFilePaths = routes
      .map((r) => join(ctx.rootDir, r.filePath))
      .filter(
        (f) =>
          f.endsWith('.tsx') ||
          f.endsWith('.jsx') ||
          f.endsWith('.ts') ||
          f.endsWith('.js') ||
          f.endsWith('.vue'),
      );
    const { elements, components } = await extractElements(
      routeFilePaths,
      ctx.rootDir,
    );

    // 4. Build AnalysisResult
    const analysis: AnalysisResult = {
      project: {
        name: basename(ctx.rootDir),
        frameworks,
        rootDir: ctx.rootDir,
      },
      routes,
      components,
      elements,
      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: performance.now() - start,
        fileCount: routeFilePaths.length,
        routeCount: routes.length,
        elementCount: elements.length,
      },
    };

    return {
      scanner: this.name,
      findings: [], // Analyzer produces analysis, not findings
      duration: performance.now() - start,
      metadata: { analysis },
    };
  }
}
