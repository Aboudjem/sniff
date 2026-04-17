import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ElementInfo, RouteInfo } from '../../analyzers/types.js';
import type { DomainVocabulary } from '../types.js';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'with', 'to', 'in', 'of', 'on',
  'at', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'can',
  'could', 'may', 'might', 'this', 'that', 'these', 'those', 'we', 'you', 'your',
  'our', 'their', 'its', 'it', 'they', 'them', 'us', 'i', 'my', 'me',
  'src', 'app', 'page', 'index', 'pages', 'components', 'routes', 'route',
  'api', 'dist', 'build', 'public', 'static',
]);

function tokenize(source: string): string[] {
  return source
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

function dedupeAndRank(tokens: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);
}

function stripDynamicSegments(path: string): string {
  return path
    .replace(/\[[^\]]+\]/g, '')
    .replace(/:\w+/g, '');
}

export function extractRouteVocabulary(routes: RouteInfo[]): string[] {
  const tokens: string[] = [];
  for (const route of routes) {
    tokens.push(...tokenize(stripDynamicSegments(route.path)));
  }
  return dedupeAndRank(tokens);
}

export function extractElementVocabulary(elements: ElementInfo[]): string[] {
  const tokens: string[] = [];
  for (const element of elements) {
    if (element.text) tokens.push(...tokenize(element.text));
    if (element.ariaLabel) tokens.push(...tokenize(element.ariaLabel));
    if (element.name) tokens.push(...tokenize(element.name));
  }
  return dedupeAndRank(tokens);
}

export async function extractDependencyVocabulary(rootDir: string): Promise<string[]> {
  try {
    const pkgRaw = await readFile(join(rootDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    return Object.keys(deps).filter((name) => name.length > 0);
  } catch {
    return [];
  }
}

export async function buildVocabulary(
  routes: RouteInfo[],
  elements: ElementInfo[],
  rootDir: string,
): Promise<DomainVocabulary> {
  const [routeVocab, elementVocab, depVocab] = [
    extractRouteVocabulary(routes),
    extractElementVocabulary(elements),
    await extractDependencyVocabulary(rootDir),
  ];

  return {
    routes: routeVocab,
    elements: elementVocab,
    deps: depVocab,
  };
}
