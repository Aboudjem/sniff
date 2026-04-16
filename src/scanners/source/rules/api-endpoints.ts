import { readFile } from 'node:fs/promises';
import { basename, dirname, relative, extname } from 'node:path';
import fg from 'fast-glob';
import type { Finding, Severity } from '../../../core/types.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface ApiEndpointsConfig {
  enabled: boolean;
  checkErrorHandling: boolean;
  checkValidation: boolean;
  checkAuth: boolean;
  checkSecrets: boolean;
  frameworks: string[]; // empty = auto-detect all
}

export const defaultApiEndpointsConfig: ApiEndpointsConfig = {
  enabled: true,
  checkErrorHandling: true,
  checkValidation: true,
  checkAuth: true,
  checkSecrets: true,
  frameworks: [],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DiscoveredEndpoint {
  method: string;          // GET, POST, PUT, DELETE, PATCH, ALL, QUERY, MUTATION
  path: string;            // route path or handler name
  framework: string;       // express, fastify, hono, nextjs-app, nextjs-pages, sveltekit, trpc, graphql
  filePath: string;        // relative path
  line: number;
  snippet: string;
}

interface EndpointIssue {
  ruleId: string;
  severity: Severity;
  message: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
}

// ---------------------------------------------------------------------------
// Framework detection patterns
// ---------------------------------------------------------------------------

// Express / Fastify / Hono: app.get('/path', ...) or router.post('/path', ...)
const EXPRESS_ROUTE_RE = /\b(?:app|router|server|fastify)\.(get|post|put|delete|patch|all|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

// Hono-specific: app.route('/prefix', router) or new Hono()
const HONO_ROUTE_RE = /\bnew\s+Hono\b/;

// tRPC: .query() .mutation() inside router definitions
const TRPC_ROUTER_RE = /\b(\w+)\s*:\s*(?:publicProcedure|protectedProcedure|procedure)\s*\.\s*(query|mutation|subscription)\b/gi;

// GraphQL schema type definitions
const GRAPHQL_TYPE_RE = /\btype\s+(Query|Mutation|Subscription)\s*\{([^}]+)\}/gs;
const GRAPHQL_FIELD_RE = /^\s*(\w+)/gm;

// ---------------------------------------------------------------------------
// File-based route detection (Next.js, SvelteKit)
// ---------------------------------------------------------------------------

interface FileRoutePattern {
  framework: string;
  glob: string;
  extractRoute: (filePath: string, rootDir: string) => { method: string; path: string } | null;
}

const FILE_ROUTE_PATTERNS: FileRoutePattern[] = [
  // Next.js App Router: app/**/route.ts
  {
    framework: 'nextjs-app',
    glob: '**/app/**/route.{ts,tsx,js,jsx}',
    extractRoute: (filePath, rootDir) => {
      const rel = relative(rootDir, filePath);
      // Extract path from app/.../route.ts
      const match = rel.match(/app\/(.+)\/route\.\w+$/);
      if (!match) return null;
      const routePath = '/' + match[1]
        .replace(/\[\.{3}(\w+)\]/g, ':$1*')  // [...slug] -> :slug*
        .replace(/\[(\w+)\]/g, ':$1');         // [id] -> :id
      return { method: 'ALL', path: routePath };
    },
  },
  // Next.js Pages Router: pages/api/**/*.ts
  {
    framework: 'nextjs-pages',
    glob: '**/pages/api/**/*.{ts,tsx,js,jsx}',
    extractRoute: (filePath, rootDir) => {
      const rel = relative(rootDir, filePath);
      const match = rel.match(/pages\/api\/(.+)\.\w+$/);
      if (!match) return null;
      let routePath = '/api/' + match[1]
        .replace(/\[\.{3}(\w+)\]/g, ':$1*')
        .replace(/\[(\w+)\]/g, ':$1');
      if (routePath.endsWith('/index')) {
        routePath = routePath.replace(/\/index$/, '');
      }
      return { method: 'ALL', path: routePath || '/api' };
    },
  },
  // SvelteKit: routes/**/+server.ts
  {
    framework: 'sveltekit',
    glob: '**/routes/**/+server.{ts,js}',
    extractRoute: (filePath, rootDir) => {
      const rel = relative(rootDir, filePath);
      const match = rel.match(/routes\/(.+)\/\+server\.\w+$/);
      if (!match) return null;
      const routePath = '/' + match[1]
        .replace(/\[\.{3}(\w+)\]/g, ':$1*')
        .replace(/\[(\w+)\]/g, ':$1');
      return { method: 'ALL', path: routePath };
    },
  },
];

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

// Common validation libraries
const VALIDATION_PATTERNS = [
  /\bzod\b/, /\b(?:z\.object|z\.string|z\.number)\b/,
  /\bjoi\b/, /\bJoi\./,
  /\byup\b/, /\byup\./,
  /\bvalidate\b/i, /\bvalidator\b/i,
  /\bclass-validator\b/, /\bIsString\b/, /\bIsNumber\b/,
  /\bsuperStruct\b/, /\bvalibot\b/,
  /\bparsedBody\b/i, /\bparseBody\b/i,
];

// Auth middleware patterns
const AUTH_PATTERNS = [
  /\bauth\b/i, /\bauthenticate\b/i, /\bauthorize\b/i,
  /\bisAuthenticated\b/, /\brequireAuth\b/i,
  /\bpassport\b/i, /\bjwt\b/i, /\bbearer\b/i,
  /\bsession\b/i, /\bmiddleware\b/i,
  /\bprotectedProcedure\b/, /\bwithAuth\b/i,
  /\bgetServerSession\b/, /\buseSession\b/,
];

// Error handling patterns
const ERROR_HANDLING_PATTERNS = [
  /\btry\s*\{/, /\bcatch\s*\(/,
  /\.catch\(/, /\berrorHandler\b/i,
  /\bnext\s*\(\s*(?:err|error|new\s+Error)\b/,
  /\bthrow\b/,
];

// Secret patterns (hardcoded values that look like secrets)
const SECRET_PATTERNS = [
  { re: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i, label: 'API key' },
  { re: /(?:secret|password|passwd|pwd)\s*[:=]\s*['"`][^'"`]{8,}['"`]/i, label: 'secret/password' },
  { re: /(?:token)\s*[:=]\s*['"`][A-Za-z0-9_\-]{16,}['"`]/i, label: 'token' },
  { re: /(?:bearer)\s+[A-Za-z0-9_\-\.]{20,}/i, label: 'bearer token' },
  { re: /(?:sk_live|pk_live|sk_test|pk_test)_[A-Za-z0-9]{10,}/i, label: 'Stripe key' },
  { re: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}/i, label: 'GitHub token' },
];

function checkEndpointIssues(
  content: string,
  endpoint: DiscoveredEndpoint,
  config: ApiEndpointsConfig,
): EndpointIssue[] {
  const issues: EndpointIssue[] = [];
  const lines = content.split('\n');

  // For file-based routes, check the whole file
  // For inline routes, check a window around the route definition
  const startLine = Math.max(0, endpoint.line - 2);
  const endLine = Math.min(lines.length, endpoint.line + 50);
  const routeBlock = lines.slice(startLine, endLine).join('\n');

  // Check error handling
  if (config.checkErrorHandling) {
    const hasErrorHandling = ERROR_HANDLING_PATTERNS.some((p) => p.test(routeBlock));
    if (!hasErrorHandling) {
      issues.push({
        ruleId: 'api-no-error-handling',
        severity: 'medium',
        message: `Endpoint ${endpoint.method} ${endpoint.path} has no error handling (no try/catch or error middleware)`,
        filePath: endpoint.filePath,
        line: endpoint.line,
        column: 1,
        snippet: lines[endpoint.line - 1]?.trim() ?? '',
      });
    }
  }

  // Check validation (only for mutation methods)
  if (config.checkValidation) {
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'MUTATION', 'ALL'];
    if (mutationMethods.includes(endpoint.method.toUpperCase())) {
      const hasValidation = VALIDATION_PATTERNS.some((p) => p.test(routeBlock));
      if (!hasValidation) {
        issues.push({
          ruleId: 'api-no-validation',
          severity: 'medium',
          message: `Endpoint ${endpoint.method} ${endpoint.path} has no input validation`,
          filePath: endpoint.filePath,
          line: endpoint.line,
          column: 1,
          snippet: lines[endpoint.line - 1]?.trim() ?? '',
        });
      }
    }
  }

  // Check auth (skip public-ish routes)
  if (config.checkAuth) {
    const publicPaths = ['/health', '/ping', '/status', '/favicon', '/robots.txt', '/sitemap'];
    const isLikelyPublic = publicPaths.some((p) => endpoint.path.includes(p))
      || endpoint.path === '/'
      || endpoint.method === 'OPTIONS';

    if (!isLikelyPublic) {
      const hasAuth = AUTH_PATTERNS.some((p) => p.test(routeBlock));
      if (!hasAuth) {
        issues.push({
          ruleId: 'api-no-auth',
          severity: 'low',
          message: `Endpoint ${endpoint.method} ${endpoint.path} has no visible auth middleware`,
          filePath: endpoint.filePath,
          line: endpoint.line,
          column: 1,
          snippet: lines[endpoint.line - 1]?.trim() ?? '',
        });
      }
    }
  }

  // Check for hardcoded secrets
  if (config.checkSecrets) {
    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      for (const { re, label } of SECRET_PATTERNS) {
        if (re.test(line)) {
          issues.push({
            ruleId: 'api-hardcoded-secret',
            severity: 'critical',
            message: `Hardcoded ${label} detected in route handler for ${endpoint.method} ${endpoint.path}`,
            filePath: endpoint.filePath,
            line: i + 1,
            column: 1,
            snippet: line.trim(),
          });
        }
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Main scan functions
// ---------------------------------------------------------------------------

function extractInlineEndpoints(
  content: string,
  relPath: string,
): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];
  const lines = content.split('\n');

  // Express / Fastify / Hono routes
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const re = new RegExp(EXPRESS_ROUTE_RE.source, EXPRESS_ROUTE_RE.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];

      // Detect framework
      let framework = 'express';
      if (HONO_ROUTE_RE.test(content)) framework = 'hono';
      else if (/\bfastify\b/i.test(content)) framework = 'fastify';

      endpoints.push({
        method,
        path,
        framework,
        filePath: relPath,
        line: lineIdx + 1,
        snippet: line.trim(),
      });
    }
  }

  // tRPC procedures
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const re = new RegExp(TRPC_ROUTER_RE.source, TRPC_ROUTER_RE.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
      endpoints.push({
        method: match[2].toUpperCase(),
        path: match[1],
        framework: 'trpc',
        filePath: relPath,
        line: lineIdx + 1,
        snippet: line.trim(),
      });
    }
  }

  // GraphQL type definitions
  const gqlRe = new RegExp(GRAPHQL_TYPE_RE.source, GRAPHQL_TYPE_RE.flags);
  let gqlMatch: RegExpExecArray | null;

  while ((gqlMatch = gqlRe.exec(content)) !== null) {
    const typeName = gqlMatch[1]; // Query, Mutation, Subscription
    const body = gqlMatch[2];

    const fieldRe = new RegExp(GRAPHQL_FIELD_RE.source, GRAPHQL_FIELD_RE.flags);
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRe.exec(body)) !== null) {
      const fieldName = fieldMatch[1];
      if (!fieldName || fieldName.startsWith('#')) continue;

      // Find the line number
      const beforeField = content.indexOf(fieldName);
      const lineNum = beforeField >= 0
        ? content.slice(0, beforeField).split('\n').length
        : 1;

      endpoints.push({
        method: typeName.toUpperCase(),
        path: fieldName,
        framework: 'graphql',
        filePath: relPath,
        line: lineNum,
        snippet: fieldName,
      });
    }
  }

  return endpoints;
}

function extractExportedHandlers(
  content: string,
  relPath: string,
  framework: string,
): DiscoveredEndpoint[] {
  const endpoints: DiscoveredEndpoint[] = [];
  const lines = content.split('\n');

  // Next.js App Router / SvelteKit: export async function GET/POST/...
  const EXPORT_HANDLER_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/g;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const re = new RegExp(EXPORT_HANDLER_RE.source, EXPORT_HANDLER_RE.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
      endpoints.push({
        method: match[1],
        path: relPath,
        framework,
        filePath: relPath,
        line: lineIdx + 1,
        snippet: line.trim(),
      });
    }
  }

  // Also check: export const GET = ... or export const POST = ...
  const EXPORT_CONST_RE = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*=/g;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const re = new RegExp(EXPORT_CONST_RE.source, EXPORT_CONST_RE.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(line)) !== null) {
      endpoints.push({
        method: match[1],
        path: relPath,
        framework,
        filePath: relPath,
        line: lineIdx + 1,
        snippet: line.trim(),
      });
    }
  }

  return endpoints;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function scanForApiEndpoints(
  rootDir: string,
  config: ApiEndpointsConfig,
  exclude: string[],
): Promise<{ endpoints: DiscoveredEndpoint[]; findings: Finding[] }> {
  const allEndpoints: DiscoveredEndpoint[] = [];
  const allFindings: Finding[] = [];

  // 1. Scan file-based routes (Next.js, SvelteKit)
  for (const pattern of FILE_ROUTE_PATTERNS) {
    if (config.frameworks.length > 0 && !config.frameworks.includes(pattern.framework)) {
      continue;
    }

    const files = await fg(pattern.glob, {
      cwd: rootDir,
      ignore: exclude,
      absolute: true,
    });

    for (const filePath of files) {
      const routeInfo = pattern.extractRoute(filePath, rootDir);
      if (!routeInfo) continue;

      const content = await readFile(filePath, 'utf-8');
      const relPath = relative(rootDir, filePath);

      // Extract exported handlers (GET, POST, etc.) from file-based routes
      const handlers = extractExportedHandlers(content, relPath, pattern.framework);

      if (handlers.length > 0) {
        // Use actual exported methods with the route path
        for (const handler of handlers) {
          handler.path = routeInfo.path;
          allEndpoints.push(handler);

          const issues = checkEndpointIssues(content, handler, config);
          allFindings.push(...issues);
        }
      } else {
        // File exists but no explicit handlers -- default handler
        const endpoint: DiscoveredEndpoint = {
          method: routeInfo.method,
          path: routeInfo.path,
          framework: pattern.framework,
          filePath: relPath,
          line: 1,
          snippet: basename(filePath),
        };
        allEndpoints.push(endpoint);

        const issues = checkEndpointIssues(content, endpoint, config);
        allFindings.push(...issues);
      }
    }
  }

  // 2. Scan source files for inline route definitions
  const sourceGlobs = ['**/*.{ts,tsx,js,jsx}'];
  const sourceFiles = await fg(sourceGlobs, {
    cwd: rootDir,
    ignore: [...exclude, '**/node_modules/**', '**/*.test.*', '**/*.spec.*'],
    absolute: true,
  });

  for (const filePath of sourceFiles) {
    const content = await readFile(filePath, 'utf-8');
    const relPath = relative(rootDir, filePath);

    const endpoints = extractInlineEndpoints(content, relPath);

    for (const endpoint of endpoints) {
      if (config.frameworks.length > 0 && !config.frameworks.includes(endpoint.framework)) {
        continue;
      }

      allEndpoints.push(endpoint);
      const issues = checkEndpointIssues(content, endpoint, config);
      allFindings.push(...issues);
    }
  }

  // Add summary finding with endpoint count as metadata
  if (allEndpoints.length > 0) {
    const byFramework = new Map<string, number>();
    for (const ep of allEndpoints) {
      byFramework.set(ep.framework, (byFramework.get(ep.framework) ?? 0) + 1);
    }

    const summary = [...byFramework.entries()]
      .map(([fw, count]) => `${fw}: ${count}`)
      .join(', ');

    allFindings.push({
      ruleId: 'api-endpoints-discovered',
      severity: 'info',
      message: `Discovered ${allEndpoints.length} API endpoints (${summary})`,
      filePath: '',
      line: 0,
      column: 0,
      snippet: '',
    });
  }

  return { endpoints: allEndpoints, findings: allFindings };
}
