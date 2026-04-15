import fg from 'fast-glob';
import { readFile, access } from 'node:fs/promises';
import { join, relative, posix } from 'node:path';
import type { FrameworkInfo, RouteInfo } from './types.js';

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract dynamic param names from a route path.
 * Handles both [param] (Next.js/SvelteKit) and :param (React/Vue Router) styles.
 */
function extractParams(routePath: string): string[] {
  const params: string[] = [];
  // [param] style (Next.js, SvelteKit)
  const bracketMatches = routePath.matchAll(/\[([^\]]+)\]/g);
  for (const m of bracketMatches) {
    params.push(m[1]);
  }
  // :param style (React Router, Vue Router)
  const colonMatches = routePath.matchAll(/:([^/]+)/g);
  for (const m of colonMatches) {
    params.push(m[1]);
  }
  return params;
}

/**
 * Check if a route path has dynamic segments.
 */
function isDynamic(routePath: string): boolean {
  return /\[.+\]/.test(routePath) || /:\w+/.test(routePath);
}

/**
 * Convert a file path to a normalized route path for Next.js App Router.
 * Strips the app directory prefix, /page.tsx suffix, and route groups (parenthesized).
 */
function appRouterPathToRoute(filePath: string, appDir: string): string {
  // Get the path relative to the app directory
  let route = relative(appDir, filePath);
  // Remove the page.{tsx,jsx,ts,js} filename (may or may not have leading /)
  route = route.replace(/\/?page\.(tsx|jsx|ts|js)$/, '');
  // Strip route groups like (marketing)
  route = route.replace(/\([^)]+\)\/?/g, '');
  // Normalize separators to posix
  route = route.split(/[\\/]/).filter(Boolean).join('/');
  // Prefix with /
  return route ? `/${route}` : '/';
}

/**
 * Convert a file path to a route path for Next.js Pages Router.
 */
function pagesRouterPathToRoute(filePath: string, pagesDir: string): string {
  let route = relative(pagesDir, filePath);
  // Remove extension
  route = route.replace(/\.(tsx|jsx|ts|js)$/, '');
  // Normalize separators
  route = route.split(/[\\/]/).filter(Boolean).join('/');
  // index -> /
  if (route === 'index') return '/';
  // dir/index -> /dir
  route = route.replace(/\/index$/, '');
  return `/${route}`;
}

/**
 * Convert a SvelteKit file path to a route path.
 */
function svelteKitPathToRoute(filePath: string, routesDir: string): string {
  let route = relative(routesDir, filePath);
  // Remove +page.svelte
  route = route.replace(/\/?\+page\.svelte$/, '');
  // Strip route groups
  route = route.replace(/\([^)]+\)\/?/g, '');
  // Normalize
  route = route.split(/[\\/]/).filter(Boolean).join('/');
  return route ? `/${route}` : '/';
}

// ── Next.js App Router ────────────────────────────────────────────

async function discoverNextjsAppRoutes(rootDir: string): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  // Check both app/ and src/app/
  for (const base of ['app', join('src', 'app')]) {
    const appDir = join(rootDir, base);
    if (!(await dirExists(appDir))) continue;

    const files = await fg('**/page.{tsx,jsx,ts,js}', {
      cwd: appDir,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    for (const file of files) {
      const routePath = appRouterPathToRoute(file, '');
      const params = extractParams(routePath);
      routes.push({
        path: routePath,
        filePath: relative(rootDir, join(appDir, file)),
        framework: 'nextjs-app',
        dynamic: isDynamic(routePath),
        ...(params.length > 0 ? { params } : {}),
      });
    }
  }

  return routes;
}

// ── Next.js Pages Router ──────────────────────────────────────────

async function discoverNextjsPagesRoutes(rootDir: string): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  for (const base of ['pages', join('src', 'pages')]) {
    const pagesDir = join(rootDir, base);
    if (!(await dirExists(pagesDir))) continue;

    const files = await fg('**/*.{tsx,jsx,ts,js}', {
      cwd: pagesDir,
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'api/**'],
    });

    for (const file of files) {
      // Skip Next.js special files
      const basename = file.split(/[\\/]/).pop() ?? '';
      if (basename.startsWith('_')) continue;

      const routePath = pagesRouterPathToRoute(file, '');
      const params = extractParams(routePath);
      routes.push({
        path: routePath,
        filePath: relative(rootDir, join(pagesDir, file)),
        framework: 'nextjs-pages',
        dynamic: isDynamic(routePath),
        ...(params.length > 0 ? { params } : {}),
      });
    }
  }

  return routes;
}

// ── SvelteKit ─────────────────────────────────────────────────────

async function discoverSvelteKitRoutes(rootDir: string): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];
  const routesDir = join(rootDir, 'src', 'routes');
  if (!(await dirExists(routesDir))) return routes;

  const files = await fg('**/ +page.svelte', {
    cwd: routesDir,
    ignore: ['node_modules/**'],
  });

  // fast-glob with space before +page.svelte may not work; use alternate pattern
  const filesAlt = await fg('**/+page.svelte', {
    cwd: routesDir,
    ignore: ['node_modules/**'],
  });

  const allFiles = [...new Set([...files, ...filesAlt])];

  for (const file of allFiles) {
    const routePath = svelteKitPathToRoute(file, '');
    const params = extractParams(routePath);
    routes.push({
      path: routePath,
      filePath: relative(rootDir, join(routesDir, file)),
      framework: 'sveltekit',
      dynamic: isDynamic(routePath),
      ...(params.length > 0 ? { params } : {}),
    });
  }

  return routes;
}

// ── React Router (basic config parsing) ───────────────────────────

async function discoverReactRouterRoutes(rootDir: string): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  const sourceFiles = await fg('**/*.{tsx,jsx,ts,js}', {
    cwd: rootDir,
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  // Process in batches of 50 to bound memory (per T-02-02)
  for (let i = 0; i < sourceFiles.length; i += 50) {
    const batch = sourceFiles.slice(i, i + 50);
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const fileRoutes: RouteInfo[] = [];
        try {
          const content = await readFile(join(rootDir, file), 'utf-8');
          // Only process files that reference routing
          if (
            !content.includes('createBrowserRouter') &&
            !content.includes('<Route') &&
            !content.includes('<Routes')
          ) {
            return fileRoutes;
          }

          // Extract path values from route config objects: path: '/about'
          const configPathRegex = /path:\s*['"]([^'"]+)['"]/g;
          let match: RegExpExecArray | null;
          while ((match = configPathRegex.exec(content)) !== null) {
            const routePath = match[1];
            const params = extractParams(routePath);
            fileRoutes.push({
              path: routePath,
              filePath: file,
              framework: 'react-router',
              dynamic: isDynamic(routePath),
              ...(params.length > 0 ? { params } : {}),
            });
          }

          // Extract path values from JSX: path="/about"
          const jsxPathRegex = /path=["']([^"']+)["']/g;
          while ((match = jsxPathRegex.exec(content)) !== null) {
            const routePath = match[1];
            // Avoid duplicates from config regex
            if (fileRoutes.some((r) => r.path === routePath)) continue;
            const params = extractParams(routePath);
            fileRoutes.push({
              path: routePath,
              filePath: file,
              framework: 'react-router',
              dynamic: isDynamic(routePath),
              ...(params.length > 0 ? { params } : {}),
            });
          }
        } catch {
          // Skip unreadable files
        }
        return fileRoutes;
      }),
    );
    for (const result of batchResults) {
      routes.push(...result);
    }
  }

  return routes;
}

// ── Vue Router (basic config parsing) ─────────────────────────────

async function discoverVueRouterRoutes(rootDir: string): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  // Look for common Vue router file locations
  const candidates = [
    'src/router/index.ts',
    'src/router/index.js',
    'src/router.ts',
    'src/router.js',
    'router/index.ts',
    'router/index.js',
  ];

  for (const candidate of candidates) {
    const filePath = join(rootDir, candidate);
    try {
      const content = await readFile(filePath, 'utf-8');
      const pathRegex = /path:\s*['"]([^'"]+)['"]/g;
      let match: RegExpExecArray | null;
      while ((match = pathRegex.exec(content)) !== null) {
        const routePath = match[1];
        const params = extractParams(routePath);
        routes.push({
          path: routePath,
          filePath: candidate,
          framework: 'vue-router',
          dynamic: isDynamic(routePath),
          ...(params.length > 0 ? { params } : {}),
        });
      }
    } catch {
      // File doesn't exist, skip
    }
  }

  return routes;
}

// ── HTML Fallback (per D-03) ──────────────────────────────────────

async function discoverHtmlRoutes(rootDir: string): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];
  const seenPaths = new Set<string>();

  const htmlFiles = await fg('**/*.html', {
    cwd: rootDir,
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  for (const file of htmlFiles) {
    // Convert HTML file path to route
    let routePath: string;
    if (file === 'index.html' || file.endsWith('/index.html')) {
      const dir = file.replace(/\/?index\.html$/, '');
      routePath = dir ? `/${dir}` : '/';
    } else {
      routePath = '/' + file.replace(/\.html$/, '');
    }

    if (!seenPaths.has(routePath)) {
      seenPaths.add(routePath);
      routes.push({
        path: routePath,
        filePath: file,
        framework: 'html-static',
        dynamic: false,
      });
    }

    // Extract routes from <a href> and <form action> attributes
    try {
      const content = await readFile(join(rootDir, file), 'utf-8');

      const hrefRegex = /<a\s[^>]*href=["']([^"'#][^"']*)["']/gi;
      let match: RegExpExecArray | null;
      while ((match = hrefRegex.exec(content)) !== null) {
        const href = match[1];
        // Only include local paths (starting with /)
        if (href.startsWith('/') && !seenPaths.has(href)) {
          seenPaths.add(href);
          routes.push({
            path: href,
            filePath: file,
            framework: 'html-static',
            dynamic: false,
          });
        }
      }

      const formRegex = /<form\s[^>]*action=["']([^"'#][^"']*)["']/gi;
      while ((match = formRegex.exec(content)) !== null) {
        const action = match[1];
        if (action.startsWith('/') && !seenPaths.has(action)) {
          seenPaths.add(action);
          routes.push({
            path: action,
            filePath: file,
            framework: 'html-static',
            dynamic: false,
          });
        }
      }
    } catch {
      // Skip unreadable files
    }
  }

  return routes;
}

// ── Main Entry Point ──────────────────────────────────────────────

/**
 * Discover routes in a project based on detected frameworks.
 *
 * For file-system routers (Next.js, SvelteKit), scans directory conventions.
 * For config-based routers (React Router, Vue Router), parses route configs via regex.
 * Falls back to HTML file scanning when no framework is detected (per D-03).
 *
 * @param rootDir - Project root directory
 * @param frameworks - Detected frameworks from detectFrameworks()
 * @returns Combined RouteInfo[] from all detected routing patterns
 */
export async function discoverRoutes(
  rootDir: string,
  frameworks: FrameworkInfo[],
): Promise<RouteInfo[]> {
  const routes: RouteInfo[] = [];

  // If no frameworks detected, fall back to HTML scanning
  if (frameworks.length === 0) {
    return discoverHtmlRoutes(rootDir);
  }

  for (const fw of frameworks) {
    switch (fw.name) {
      case 'nextjs': {
        const appRoutes = await discoverNextjsAppRoutes(rootDir);
        const pagesRoutes = await discoverNextjsPagesRoutes(rootDir);
        routes.push(...appRoutes, ...pagesRoutes);
        break;
      }
      case 'svelte': {
        const svelteRoutes = await discoverSvelteKitRoutes(rootDir);
        routes.push(...svelteRoutes);
        break;
      }
      case 'react': {
        const reactRoutes = await discoverReactRouterRoutes(rootDir);
        routes.push(...reactRoutes);
        break;
      }
      case 'vue': {
        const vueRoutes = await discoverVueRouterRoutes(rootDir);
        routes.push(...vueRoutes);
        break;
      }
      default:
        break;
    }
  }

  return routes;
}
