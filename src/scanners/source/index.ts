import fg from 'fast-glob';
import { readFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';

import type { Scanner, ScanContext, ScanResult } from '../types.js';
import type { Finding } from '../../core/types.js';
import { allRules, type SourceRule, scanFileForDeadLinks, defaultDeadLinkConfig, scanForApiEndpoints, defaultApiEndpointsConfig } from './rules/index.js';
import type { DeadLinkConfig } from './rules/index.js';
import type { ApiEndpointsConfig } from './rules/index.js';

const IMPORT_PATH_RE = /from\s+['"](\.\.?\/[^'"]+)['"]/;

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const INDEX_FILES = RESOLVE_EXTENSIONS.map((ext) => `index${ext}`);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveImportExists(
  importPath: string,
  fromDir: string,
): Promise<boolean> {
  const resolved = join(fromDir, importPath);

  // Try exact path
  if (await fileExists(resolved)) return true;

  // Handle TypeScript ESM convention: import './foo.js' resolves to './foo.ts'
  if (resolved.endsWith('.js') || resolved.endsWith('.jsx')) {
    const withoutExt = resolved.replace(/\.jsx?$/, '');
    for (const ext of RESOLVE_EXTENSIONS) {
      if (await fileExists(withoutExt + ext)) return true;
    }
  }

  // Try with extensions (for extensionless imports)
  for (const ext of RESOLVE_EXTENSIONS) {
    if (await fileExists(resolved + ext)) return true;
  }

  // Try as directory with index file
  for (const indexFile of INDEX_FILES) {
    if (await fileExists(join(resolved, indexFile))) return true;
  }

  return false;
}

export class SourceScanner implements Scanner {
  name = 'source';

  async scan(ctx: ScanContext): Promise<ScanResult> {
    const start = performance.now();
    const enabledRules = this.resolveRules(ctx);

    // Collect unique include globs from enabled rules, fall back to config
    const includePatterns = new Set<string>();
    for (const rule of enabledRules) {
      if (rule.include) {
        for (const pattern of rule.include) {
          includePatterns.add(pattern);
        }
      }
    }
    const globs =
      includePatterns.size > 0
        ? [...includePatterns]
        : ctx.config.include;

    const files = await fg(globs, {
      cwd: ctx.rootDir,
      ignore: ctx.config.exclude,
      absolute: true,
    });

    const findings: Finding[] = [];

    // Process files in batches of 50
    for (let i = 0; i < files.length; i += 50) {
      const batch = files.slice(i, i + 50);
      const batchResults = await Promise.all(
        batch.map((filePath) =>
          this.scanFile(filePath, enabledRules, ctx.rootDir),
        ),
      );
      for (const result of batchResults) {
        findings.push(...result);
      }
    }

    // Dead link checking (runs separately from regex rules)
    const deadLinksEnabled = ctx.config.rules['dead-link-internal'] !== 'off'
      && ctx.config.rules['dead-link-internal'] !== false;

    if (deadLinksEnabled) {
      const dlConfig: DeadLinkConfig = {
        ...defaultDeadLinkConfig,
        ...ctx.config.deadLinks,
      };

      // Include link-containing file types
      const linkGlobs = ['**/*.{md,mdx,html,htm,jsx,tsx,js,ts,vue,svelte,astro}'];
      const linkFiles = await fg(linkGlobs, {
        cwd: ctx.rootDir,
        ignore: ctx.config.exclude,
        absolute: true,
      });

      for (let i = 0; i < linkFiles.length; i += 50) {
        const batch = linkFiles.slice(i, i + 50);
        const batchResults = await Promise.all(
          batch.map(async (filePath) => {
            const content = await readFile(filePath, 'utf-8');
            const relPath = relative(ctx.rootDir, filePath);
            return scanFileForDeadLinks(filePath, relPath, content, ctx.rootDir, dlConfig);
          }),
        );
        for (const result of batchResults) {
          findings.push(...result);
        }
      }
    }

    // API endpoint discovery
    const apiEnabled = ctx.config.rules['api-endpoints-discovered'] !== 'off'
      && ctx.config.rules['api-endpoints-discovered'] !== false;

    if (apiEnabled) {
      const apiConfig: ApiEndpointsConfig = {
        ...defaultApiEndpointsConfig,
        ...ctx.config.apiEndpoints,
      };

      if (apiConfig.enabled) {
        const { findings: apiFindings } = await scanForApiEndpoints(
          ctx.rootDir,
          apiConfig,
          ctx.config.exclude,
        );
        findings.push(...apiFindings);
      }
    }

    return {
      scanner: this.name,
      findings,
      duration: performance.now() - start,
    };
  }

  private resolveRules(ctx: ScanContext): SourceRule[] {
    return allRules.filter((rule) => {
      const config = ctx.config.rules[rule.id];
      return config !== 'off' && config !== false;
    });
  }

  private async scanFile(
    filePath: string,
    rules: SourceRule[],
    rootDir: string,
  ): Promise<Finding[]> {
    const findings: Finding[] = [];
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(rootDir, filePath);

    // Filter rules applicable to this file based on per-rule exclude patterns
    const applicableRules = rules.filter((rule) => {
      if (rule.exclude) {
        if (rule.exclude.some((pattern) => matchSimpleGlob(relPath, pattern))) {
          return false;
        }
      }
      return true;
    });

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];

      for (const rule of applicableRules) {
        // Create fresh regex to avoid stateful lastIndex issues
        const re = new RegExp(rule.pattern.source, rule.pattern.flags);
        const match = re.exec(line);

        if (!match) continue;

        // Special handling for broken-import rule
        if (rule.id === 'broken-import') {
          const importMatch = IMPORT_PATH_RE.exec(line);
          if (importMatch) {
            const importPath = importMatch[1];
            const fileDir = dirname(filePath);
            const exists = await resolveImportExists(importPath, fileDir);
            if (exists) continue; // Import resolves fine, skip
          } else {
            continue; // Could not extract import path, skip
          }
        }

        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.description,
          filePath: relPath,
          line: lineIdx + 1,
          column: (match.index ?? 0) + 1,
          snippet: line.trim(),
        });
      }
    }

    return findings;
  }
}

/**
 * Simple glob matching for per-rule exclude patterns.
 * Supports `**\/*.test.*` style patterns against relative paths.
 */
function matchSimpleGlob(filePath: string, pattern: string): boolean {
  // Convert glob pattern to regex
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*');
  return new RegExp(`^${regexStr}$`).test(filePath);
}
