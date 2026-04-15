import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { FrameworkInfo } from './types.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the major version from a semver-like dependency string.
 * E.g., "^14.0.0" -> "14.x", "~3.4.1" -> "3.x", "18.2.0" -> "18.x"
 */
function extractMajorVersion(versionStr: string): string | undefined {
  const match = /(\d+)/.exec(versionStr);
  return match ? `${match[1]}.x` : undefined;
}

/**
 * Find which config files exist for a given set of candidate filenames.
 */
async function findConfigFiles(
  rootDir: string,
  candidates: string[],
): Promise<string[]> {
  const found: string[] = [];
  for (const candidate of candidates) {
    if (await fileExists(join(rootDir, candidate))) {
      found.push(candidate);
    }
  }
  return found;
}

/**
 * Detect frameworks in a project by inspecting package.json dependencies
 * and checking for framework-specific config files.
 *
 * Detection order: Next.js first (has react too), then React (no next),
 * then Vue, then Svelte. Returns multiple for monorepo-style projects.
 *
 * Graceful degradation: returns [] on any failure (missing package.json, parse error, etc.)
 */
export async function detectFrameworks(
  rootDir: string,
): Promise<FrameworkInfo[]> {
  let pkg: Record<string, unknown>;

  try {
    const raw = await readFile(join(rootDir, 'package.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return [];
    }
    pkg = parsed as Record<string, unknown>;
  } catch {
    return [];
  }

  const deps: Record<string, string> = {
    ...((typeof pkg.dependencies === 'object' && pkg.dependencies !== null
      ? pkg.dependencies
      : {}) as Record<string, string>),
    ...((typeof pkg.devDependencies === 'object' && pkg.devDependencies !== null
      ? pkg.devDependencies
      : {}) as Record<string, string>),
  };

  const frameworks: FrameworkInfo[] = [];
  let hasNext = false;

  // 1. Next.js — check BEFORE React (Next.js projects also have react)
  if (deps['next']) {
    hasNext = true;
    const configFiles = await findConfigFiles(rootDir, [
      'next.config.js',
      'next.config.mjs',
      'next.config.ts',
    ]);
    frameworks.push({
      name: 'nextjs',
      version: extractMajorVersion(deps['next']),
      configFiles,
    });
  }

  // 2. React — only if NOT a Next.js project
  if (!hasNext && deps['react']) {
    const configFiles = await findConfigFiles(rootDir, [
      'vite.config.js',
      'vite.config.ts',
      'craco.config.js',
    ]);
    frameworks.push({
      name: 'react',
      version: extractMajorVersion(deps['react']),
      configFiles,
    });
  }

  // 3. Vue
  if (deps['vue']) {
    const candidates = ['vue.config.js'];
    // Only include vite config if @vitejs/plugin-vue is in deps
    if (deps['@vitejs/plugin-vue']) {
      candidates.push('vite.config.js', 'vite.config.ts');
    }
    const configFiles = await findConfigFiles(rootDir, candidates);
    frameworks.push({
      name: 'vue',
      version: extractMajorVersion(deps['vue']),
      configFiles,
    });
  }

  // 4. Svelte
  if (deps['svelte']) {
    const configFiles = await findConfigFiles(rootDir, [
      'svelte.config.js',
    ]);
    frameworks.push({
      name: 'svelte',
      version: extractMajorVersion(deps['svelte']),
      configFiles,
    });
  }

  return frameworks;
}
