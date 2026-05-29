import type { Page, APIRequestContext } from 'playwright';
import { normalizeUrl, sameOrigin, ASSET_EXT } from './noise.js';
import type { RawFinding } from './types.js';

export interface PageLinks {
  internal: string[];
  external: string[];
}

/** Extract absolute, de-duplicated anchor targets from the live DOM. */
export async function extractLinks(page: Page, baseOrigin: string): Promise<PageLinks> {
  const hrefs = await page
    .evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a as HTMLAnchorElement).href)
        .filter(Boolean),
    )
    .catch(() => [] as string[]);

  const internal = new Set<string>();
  const external = new Set<string>();
  for (const raw of hrefs) {
    if (/^(mailto:|tel:|javascript:|#)/i.test(raw)) continue;
    let abs: string;
    try { abs = new URL(raw, page.url()).toString(); } catch { continue; }
    if (!/^https?:/i.test(abs)) continue;
    const norm = normalizeUrl(abs);
    if (sameOrigin(abs, baseOrigin)) internal.add(norm);
    else external.add(norm);
  }
  return { internal: [...internal], external: [...external] };
}

/** Should this same-origin URL be crawled (visited with a browser)? */
export function isCrawlable(url: string, baseOrigin: string): boolean {
  if (!sameOrigin(url, baseOrigin)) return false;
  try {
    const path = new URL(url).pathname;
    if (ASSET_EXT.test(path)) return false;
    if (path.startsWith('/api/')) return false; // API endpoints aren't pages
  } catch { return false; }
  return true;
}

/**
 * Class 2 — broken links. Checks every discovered link with a real HTTP request
 * (internal: GET, sharing the browser context's cookies; external: HEAD with a
 * GET fallback). A link is broken if it errors or returns >=400. Each broken
 * link is attributed to the source route that referenced it.
 */
export async function checkLinks(
  request: APIRequestContext,
  links: Array<{ url: string; sourceRoute: string; external: boolean }>,
  opts: { timeout: number } = { timeout: 10000 },
): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const seen = new Set<string>();

  for (const link of links) {
    if (seen.has(link.url)) continue;
    seen.add(link.url);

    let status = 0;
    let errored = false;
    let errText = '';
    try {
      const res = link.external
        ? await request.fetch(link.url, { method: 'HEAD', timeout: opts.timeout, maxRedirects: 5 })
        : await request.get(link.url, { timeout: opts.timeout, maxRedirects: 5 });
      status = res.status();
      // Some servers reject HEAD; retry external with GET before trusting a 4xx/5xx.
      if (link.external && status >= 400 && status !== 404) {
        try {
          const res2 = await request.get(link.url, { timeout: opts.timeout, maxRedirects: 5 });
          status = res2.status();
        } catch { /* keep first status */ }
      }
    } catch (e) {
      errored = true;
      errText = e instanceof Error ? e.message : String(e);
    }

    if (errored || status >= 400) {
      const detail = errored ? `request failed (${errText.split('\n')[0]})` : `HTTP ${status}`;
      findings.push({
        ruleId: link.external ? 'links/broken-external' : 'links/broken-internal',
        issueClass: 2,
        title: `Broken ${link.external ? 'external' : 'internal'} link: ${link.url} (${detail})`,
        severity: link.external ? 'medium' : 'high',
        confidence: 'confirmed',
        steps: [`On ${link.sourceRoute}, the link to ${link.url} ${errored ? 'does not resolve' : `returns ${detail}`}`],
        networkExcerpt: [`${link.url} -> ${errored ? 'FAILED: ' + errText.split('\n')[0] : status}`],
        suggestedFix: link.external
          ? 'Update or remove the dead external link.'
          : 'Fix the href or add the missing route; this internal link leads nowhere.',
        dedupeKey: `link:${link.url}`,
      });
    }
  }
  return findings;
}
