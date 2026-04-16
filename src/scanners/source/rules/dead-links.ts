import { readFile, access } from 'node:fs/promises';
import { dirname, join, resolve, extname } from 'node:path';
import type { Finding, Severity } from '../../../core/types.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface DeadLinkConfig {
  checkExternal: boolean;
  timeout: number;
  retries: number;
  ignorePatterns: string[];
  followRedirects: boolean;
  maxConcurrent: number;
}

export const defaultDeadLinkConfig: DeadLinkConfig = {
  checkExternal: true,
  timeout: 5000,
  retries: 2,
  ignorePatterns: [],
  followRedirects: true,
  maxConcurrent: 10,
};

// ---------------------------------------------------------------------------
// URL extraction patterns
// ---------------------------------------------------------------------------

interface ExtractedLink {
  url: string;
  line: number;
  column: number;
  snippet: string;
  type: 'internal' | 'external' | 'anchor';
}

// Markdown: [text](url) -- not images starting with !
const MD_LINK_RE = /(?<!!)\[(?:[^\]]*)\]\(([^)]+)\)/g;

// HTML href="..." and src="..."
const HTML_ATTR_RE = /(?:href|src|action)=["']([^"']+)["']/gi;

// JSX href={...} and src={...} with string literals
const JSX_ATTR_RE = /(?:href|src|action)=\{["'`]([^"'`]+)["'`]\}/gi;

// Plain URLs in markdown/text (http:// or https://)
const PLAIN_URL_RE = /https?:\/\/[^\s)"'`>\]]+/g;

const LINK_FILE_EXTENSIONS = new Set([
  '.md', '.mdx', '.html', '.htm',
  '.jsx', '.tsx', '.js', '.ts',
  '.vue', '.svelte', '.astro',
]);

// Patterns to skip (template variables, mailto, tel, javascript:)
const SKIP_PATTERNS = [
  /^\{\{/,           // template variables {{ }}
  /^\$\{/,           // template literals ${ }
  /^mailto:/i,
  /^tel:/i,
  /^javascript:/i,
  /^data:/i,
  /^#$/,             // bare hash
  /^\/\//,           // protocol-relative (ambiguous)
];

// ---------------------------------------------------------------------------
// Link classification
// ---------------------------------------------------------------------------

function classifyLink(url: string): 'internal' | 'external' | 'anchor' | 'skip' {
  if (SKIP_PATTERNS.some((p) => p.test(url))) return 'skip';
  if (url.startsWith('#')) return 'anchor';
  if (/^https?:\/\//i.test(url)) return 'external';
  return 'internal';
}

// ---------------------------------------------------------------------------
// URL extraction from a single file
// ---------------------------------------------------------------------------

function extractLinks(content: string, filePath: string): ExtractedLink[] {
  const ext = extname(filePath).toLowerCase();
  if (!LINK_FILE_EXTENSIONS.has(ext)) return [];

  const lines = content.split('\n');
  const links: ExtractedLink[] = [];
  const seen = new Set<string>(); // dedupe per file

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];

    const patterns: RegExp[] = [MD_LINK_RE, HTML_ATTR_RE, JSX_ATTR_RE, PLAIN_URL_RE];

    for (const pattern of patterns) {
      // Reset stateful regex
      const re = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = re.exec(line)) !== null) {
        // Group 1 for patterns with capture groups, group 0 for PLAIN_URL_RE
        const url = (match[1] ?? match[0]).trim();
        if (!url) continue;

        // Strip anchor from URL for dedup key but keep original
        const dedupeKey = `${lineIdx}:${url}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const type = classifyLink(url);
        if (type === 'skip') continue;

        links.push({
          url,
          line: lineIdx + 1,
          column: (match.index ?? 0) + 1,
          snippet: line.trim(),
          type,
        });
      }
    }
  }

  return links;
}

// ---------------------------------------------------------------------------
// Internal link validation
// ---------------------------------------------------------------------------

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateInternalLink(
  url: string,
  fromFile: string,
  rootDir: string,
): Promise<{ valid: boolean; reason?: string }> {
  // Split off anchor part
  const [pathPart, anchor] = url.split('#');
  if (!pathPart) {
    // Pure anchor link -- handled separately
    return { valid: true };
  }

  // Resolve relative to the file's directory, or root if starts with /
  const resolved = pathPart.startsWith('/')
    ? join(rootDir, pathPart)
    : resolve(dirname(fromFile), pathPart);

  if (await fileExists(resolved)) {
    // If there's an anchor, validate it exists in the target
    if (anchor) {
      return validateAnchor(resolved, anchor);
    }
    return { valid: true };
  }

  // Try common extensions
  const extensions = ['.md', '.mdx', '.html', '.htm', '.tsx', '.ts', '.jsx', '.js'];
  for (const ext of extensions) {
    if (await fileExists(resolved + ext)) return { valid: true };
  }

  // Try as directory with index
  for (const idx of ['index.md', 'index.html', 'index.tsx', 'index.ts', 'README.md']) {
    if (await fileExists(join(resolved, idx))) return { valid: true };
  }

  return { valid: false, reason: `File not found: ${pathPart}` };
}

async function validateAnchor(
  filePath: string,
  anchor: string,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const normalizedAnchor = anchor.toLowerCase();

    // Markdown headings: # Heading -> heading
    const headingRe = /^#{1,6}\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = headingRe.exec(content)) !== null) {
      const slug = match[1]
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      if (slug === normalizedAnchor) return { valid: true };
    }

    // HTML id="..." attributes
    const idRe = /id=["']([^"']+)["']/gi;
    while ((match = idRe.exec(content)) !== null) {
      if (match[1].toLowerCase() === normalizedAnchor) return { valid: true };
    }

    // HTML name="..." attributes (older anchor style)
    const nameRe = /name=["']([^"']+)["']/gi;
    while ((match = nameRe.exec(content)) !== null) {
      if (match[1].toLowerCase() === normalizedAnchor) return { valid: true };
    }

    return { valid: false, reason: `Anchor #${anchor} not found in ${filePath}` };
  } catch {
    return { valid: true }; // Can't read file, don't flag
  }
}

// ---------------------------------------------------------------------------
// External link validation
// ---------------------------------------------------------------------------

async function validateExternalLink(
  url: string,
  config: DeadLinkConfig,
): Promise<{ valid: boolean; status?: number; reason?: string; redirectCount?: number }> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: config.followRedirects ? 'follow' : 'manual',
        headers: {
          'User-Agent': 'sniff-qa (link-checker)',
        },
      });

      clearTimeout(timer);

      if (response.ok) {
        return { valid: true, status: response.status };
      }

      // Some servers reject HEAD, try GET
      if (response.status === 405 || response.status === 403) {
        const getController = new AbortController();
        const getTimer = setTimeout(() => getController.abort(), config.timeout);

        const getResponse = await fetch(url, {
          method: 'GET',
          signal: getController.signal,
          redirect: config.followRedirects ? 'follow' : 'manual',
          headers: {
            'User-Agent': 'sniff-qa (link-checker)',
          },
        });

        clearTimeout(getTimer);

        if (getResponse.ok) {
          return { valid: true, status: getResponse.status };
        }

        return {
          valid: false,
          status: getResponse.status,
          reason: `HTTP ${getResponse.status}`,
        };
      }

      return {
        valid: false,
        status: response.status,
        reason: `HTTP ${response.status}`,
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = `Timeout after ${config.timeout}ms`;
      } else if (err instanceof Error) {
        lastError = err.message;
      } else {
        lastError = 'Unknown error';
      }
    }
  }

  return { valid: false, reason: lastError ?? 'Request failed' };
}

// ---------------------------------------------------------------------------
// Severity mapping
// ---------------------------------------------------------------------------

function getSeverity(link: ExtractedLink, reason?: string): Severity {
  if (link.type === 'internal') return 'high';
  if (link.type === 'anchor') return 'medium';

  // External links
  if (reason?.includes('HTTP 404') || reason?.includes('HTTP 410')) return 'medium';
  if (reason?.includes('Timeout')) return 'low';
  return 'medium';
}

// ---------------------------------------------------------------------------
// Main scan function
// ---------------------------------------------------------------------------

export async function scanFileForDeadLinks(
  filePath: string,
  relPath: string,
  content: string,
  rootDir: string,
  config: DeadLinkConfig,
): Promise<Finding[]> {
  const links = extractLinks(content, filePath);
  if (links.length === 0) return [];

  const findings: Finding[] = [];

  // Check if URL matches ignore patterns
  const shouldIgnore = (url: string): boolean =>
    config.ignorePatterns.some((pattern) => {
      try {
        return new RegExp(pattern).test(url);
      } catch {
        return url.includes(pattern);
      }
    });

  // Process internal and anchor links (no concurrency limit needed)
  const internalLinks = links.filter((l) => l.type === 'internal' || l.type === 'anchor');
  for (const link of internalLinks) {
    if (shouldIgnore(link.url)) continue;

    if (link.type === 'anchor') {
      const result = await validateAnchor(filePath, link.url.slice(1));
      if (!result.valid) {
        findings.push({
          ruleId: 'dead-link-anchor',
          severity: getSeverity(link, result.reason),
          message: result.reason ?? `Broken anchor: ${link.url}`,
          filePath: relPath,
          line: link.line,
          column: link.column,
          snippet: link.snippet,
        });
      }
      continue;
    }

    const result = await validateInternalLink(link.url, filePath, rootDir);
    if (!result.valid) {
      findings.push({
        ruleId: 'dead-link-internal',
        severity: getSeverity(link, result.reason),
        message: result.reason ?? `Broken internal link: ${link.url}`,
        filePath: relPath,
        line: link.line,
        column: link.column,
        snippet: link.snippet,
      });
    }
  }

  // Process external links with concurrency limit
  if (config.checkExternal) {
    const externalLinks = links.filter((l) => l.type === 'external' && !shouldIgnore(l.url));

    // Dedupe by URL (same URL might appear multiple times)
    const uniqueUrls = new Map<string, ExtractedLink[]>();
    for (const link of externalLinks) {
      const existing = uniqueUrls.get(link.url);
      if (existing) {
        existing.push(link);
      } else {
        uniqueUrls.set(link.url, [link]);
      }
    }

    // Process in batches respecting maxConcurrent
    const entries = [...uniqueUrls.entries()];
    for (let i = 0; i < entries.length; i += config.maxConcurrent) {
      const batch = entries.slice(i, i + config.maxConcurrent);
      const results = await Promise.all(
        batch.map(async ([url, occurrences]) => {
          const result = await validateExternalLink(url, config);
          return { url, occurrences, result };
        }),
      );

      for (const { occurrences, result } of results) {
        if (!result.valid) {
          // Report first occurrence only
          const link = occurrences[0];
          findings.push({
            ruleId: 'dead-link-external',
            severity: getSeverity(link, result.reason),
            message: result.reason ?? `Broken external link: ${link.url}`,
            filePath: relPath,
            line: link.line,
            column: link.column,
            snippet: link.snippet,
          });
        }
      }
    }
  }

  return findings;
}
