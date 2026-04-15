import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalysisResult } from '../analyzers/types.js';
import type { GeneratedTest, RouteTestContext } from './types.js';

export interface GenerateOptions {
  outputDir: string;       // default 'sniff-tests'
  maxConcurrency: number;  // default 5
  rootDir: string;
}

export async function generateTests(
  analysis: AnalysisResult,
  options: GenerateOptions,
): Promise<GeneratedTest[]> {
  const { resolveProvider } = await import('./provider.js');
  const provider = await resolveProvider();

  const outputDir = join(options.rootDir, options.outputDir);
  await mkdir(outputDir, { recursive: true });

  const results: GeneratedTest[] = [];
  const errors: Array<{ route: string; error: string }> = [];

  // Process routes with concurrency limit
  const routes = analysis.routes;
  const totalRoutes = routes.length;
  console.log(`Generating tests for ${totalRoutes} route(s) using ${provider.name}...`);

  for (let i = 0; i < routes.length; i += options.maxConcurrency) {
    const batch = routes.slice(i, i + options.maxConcurrency);
    const batchEnd = Math.min(i + options.maxConcurrency, totalRoutes);
    console.log(`  Generating tests: ${batchEnd}/${totalRoutes} routes...`);

    const batchResults = await Promise.allSettled(
      batch.map(async (route) => {
        // Build context for this route
        const routeElements = analysis.elements.filter(
          (el) => el.filePath === route.filePath,
        );
        const routeComponents = analysis.components.filter(
          (comp) => comp.filePath === route.filePath || comp.routes.includes(route.path),
        );
        const framework = analysis.project.frameworks[0] ?? { name: 'unknown' as const, configFiles: [] };

        // Read source content for context
        let sourceContent: string | undefined;
        try {
          sourceContent = await readFile(join(options.rootDir, route.filePath), 'utf-8');
        } catch { /* file might not be readable */ }

        const context: RouteTestContext = {
          route,
          elements: routeElements,
          components: routeComponents,
          framework,
          sourceContent,
        };

        const result = await provider.generateTests(context);

        // Write .spec.ts file
        const fileName = routePathToFileName(route.path);
        await writeFile(join(outputDir, fileName), result.specContent, 'utf-8');

        return result;
      }),
    );

    for (const [idx, result] of batchResults.entries()) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        errors.push({
          route: batch[idx].path,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      }
    }
  }

  if (errors.length > 0) {
    console.warn(`Warning: ${errors.length} route(s) failed AI generation:`);
    for (const err of errors) {
      console.warn(`  - ${err.route}: ${err.error}`);
    }
  }

  console.log(`Generated ${results.length} test file(s) in ${options.outputDir}/`);
  return results;
}

function routePathToFileName(routePath: string): string {
  if (routePath === '/') return 'home.spec.ts';
  return routePath
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/[^a-zA-Z0-9-]/g, '')
    + '.spec.ts';
}
