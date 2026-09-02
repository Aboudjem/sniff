import type { Browser, BrowserContext, BrowserContextOptions, Page, APIRequestContext } from 'playwright';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { PageEvidence } from './evidence.js';
import { normalizeUrl, isEngineInducedFailure } from './noise.js';
import { extractLinks, isCrawlable, checkLinks } from './crawler.js';
import type { CrawlReport, QaFinding, RawFinding, Severity, Confidence } from './types.js';
import type { DetectorContext } from './detectors/context.js';
import { pageHealthDetector } from './detectors/page-health.js';
import { runtimeErrorDetector } from './detectors/runtime-errors.js';
import { contentDetector } from './detectors/content.js';
import { a11yDetector } from './detectors/a11y.js';
import { responsiveDetector } from './detectors/responsive.js';
import { formsDetector } from './detectors/forms.js';
import { loadingStateDetector } from './detectors/loading.js';
import { flowDetector } from './detectors/flow.js';
import { useStorageState, redactText, redactValue } from '../core/redaction.js';

export interface CrawlOptions {
  startUrl: string;
  maxPages?: number;
  headless?: boolean;
  includeMobile?: boolean;
  outputDir?: string;
  settleMs?: number;
  linkTimeoutMs?: number;
  onProgress?: (msg: string) => void;
  /**
   * Path to a Playwright storage-state JSON file, so the walk runs as a
   * logged-in user. Loading it also installs the report redactor, so the
   * credentials it holds never reach a written artifact or a progress line.
   */
  storageState?: string;
}

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 375, height: 812 };
const PASSIVE = [pageHealthDetector, runtimeErrorDetector, contentDetector];
const INTERACTION = [formsDetector, loadingStateDetector, flowDetector];

function routeOf(url: string): string {
  try { return new URL(url).pathname.replace(/\/+$/, '') || '/'; } catch { return url; }
}

function safeName(s: string): string {
  // Redact before building the name: a token in a path segment would otherwise
  // be burned into a screenshot filename on disk, where no later pass reaches.
  return redactText(s).replace(/[^a-zA-Z0-9]/g, '_').slice(0, 60) || 'root';
}

export async function runCrawl(opts: CrawlOptions): Promise<CrawlReport> {
  const maxPages = opts.maxPages ?? 25;
  const headless = opts.headless ?? true;
  const includeMobile = opts.includeMobile ?? true;
  const settleMs = opts.settleMs ?? 3500;
  const linkTimeoutMs = opts.linkTimeoutMs ?? 10000;
  const rawLog = opts.onProgress ?? (() => {});
  // Progress lines quote routes and reach stderr while the crawl is still
  // running, long before any report is assembled.
  const log = (msg: string): void => rawLog(redactText(msg));
  const startUrl = normalizeUrl(opts.startUrl);
  const baseOrigin = new URL(startUrl).origin;
  const startedAt = performance.now();

  const outputDir = opts.outputDir ?? join(process.cwd(), 'sniff-reports', 'crawl');
  await mkdir(outputDir, { recursive: true }).catch(() => {});

  // Parse the storage state once, then derive both the browser context state
  // and the redaction secret list from that same object.
  const storageState: BrowserContextOptions['storageState'] | undefined = opts.storageState
    ? ((await useStorageState(opts.storageState)) as BrowserContextOptions['storageState'])
    : undefined;
  const authOption: BrowserContextOptions = storageState ? { storageState } : {};

  const playwright = await import('playwright');
  const browser: Browser = await playwright.chromium.launch({ headless });

  const raw: Array<RawFinding & { url: string; route: string; viewport: 'desktop' | 'mobile'; screenshotPath?: string }> = [];
  const visited: string[] = [];
  const brokenRoutes = new Set<string>();
  const linkRegistry: Array<{ url: string; sourceRoute: string; external: boolean }> = [];
  const linkSeen = new Set<string>();
  let linksChecked = 0;

  try {
    const context: BrowserContext = await browser.newContext({ viewport: DESKTOP, ignoreHTTPSErrors: true, ...authOption });
    const page: Page = await context.newPage();
    page.setDefaultTimeout(8000);
    const evidence = new PageEvidence(baseOrigin);
    evidence.attach(page);

    async function navigateAndSettle(url: string): Promise<number | null> {
      evidence.reset();
      let status: number | null = null;
      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        status = resp ? resp.status() : null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!isEngineInducedFailure(msg)) status = null;
      }
      // bounded settle so a hung request (never-idle) doesn't stall the crawl
      await page.waitForLoadState('networkidle', { timeout: settleMs }).catch(() => {});
      return status;
    }

    const queue: string[] = [startUrl];
    while (queue.length > 0 && visited.length < maxPages) {
      const url = queue.shift()!;
      if (visited.includes(url)) continue;
      visited.push(url);
      const route = routeOf(url);
      log(`scan ${route}`);

      const navStatus = await navigateAndSettle(url);

      const ctx: DetectorContext = {
        page, url, route, viewport: 'desktop', navStatus, evidence, baseOrigin,
        freshNavigate: async () => { await navigateAndSettle(url); },
      };

      // Broken pages: emit only the broken-page finding and skip everything
      // else — running a11y/content/interaction on a 404/500 is noise.
      if (navStatus !== null && navStatus >= 400) {
        brokenRoutes.add(route);
        const bf = await pageHealthDetector(ctx).catch(() => [] as RawFinding[]);
        let bshot: string | undefined;
        if (bf.length > 0) {
          bshot = join(outputDir, `${safeName(route)}-desktop.png`);
          await page.screenshot({ path: bshot, fullPage: false }).catch(() => { bshot = undefined; });
        }
        for (const f of bf) raw.push({ ...f, url, route, viewport: 'desktop', ...(bshot ? { screenshotPath: bshot } : {}) });
        continue;
      }

      const pageFindings: RawFinding[] = [];
      for (const det of PASSIVE) {
        try { pageFindings.push(...(await det(ctx))); } catch { /* isolate */ }
      }
      try { pageFindings.push(...(await a11yDetector(ctx))); } catch { /* isolate */ }

      // Extract links before interaction probes navigate away.
      const links = await extractLinks(page, baseOrigin);
      for (const l of [...links.internal.map((u) => ({ u, ext: false })), ...links.external.map((u) => ({ u, ext: true }))]) {
        if (linkSeen.has(l.u)) continue;
        linkSeen.add(l.u);
        linkRegistry.push({ url: l.u, sourceRoute: route, external: l.ext });
      }
      for (const internal of links.internal) {
        if (!visited.includes(internal) && !queue.includes(internal) && isCrawlable(internal, baseOrigin)) {
          queue.push(internal);
        }
      }

      // Interaction probes (each re-navigates from a clean state).
      for (const det of INTERACTION) {
        try { pageFindings.push(...(await det(ctx))); } catch { /* isolate */ }
      }

      // One screenshot per route as shared proof; re-navigate for a clean shot.
      let shot: string | undefined;
      if (pageFindings.length > 0) {
        await navigateAndSettle(url);
        shot = join(outputDir, `${safeName(route)}-desktop.png`);
        await page.screenshot({ path: shot, fullPage: false }).catch(() => { shot = undefined; });
      }

      for (const f of pageFindings) {
        raw.push({ ...f, url, route, viewport: 'desktop', ...(shot ? { screenshotPath: shot } : {}) });
      }
    }

    // ── Broken-link checking (class 2) ───────────────────────────────────
    log(`checking ${linkRegistry.length} links`);
    const request: APIRequestContext = context.request;
    const linkFindings = await checkLinks(request, linkRegistry, { timeout: linkTimeoutMs });
    linksChecked = linkRegistry.length;
    for (const f of linkFindings) {
      const src = linkRegistry.find((l) => f.title.includes(l.url));
      const route = src?.sourceRoute ?? routeOf(startUrl);
      raw.push({ ...f, url: src?.url ?? startUrl, route, viewport: 'desktop' });
    }

    await context.close();

    // ── Mobile pass: a11y (target-size) + responsive overflow ────────────
    if (includeMobile && visited.length > 0) {
      const mctx: BrowserContext = await browser.newContext({ viewport: MOBILE, ignoreHTTPSErrors: true, ...authOption });
      const mpage: Page = await mctx.newPage();
      mpage.setDefaultTimeout(8000);
      const mevidence = new PageEvidence(baseOrigin);
      mevidence.attach(mpage);
      for (const url of visited) {
        const route = routeOf(url);
        if (brokenRoutes.has(route)) continue; // don't re-scan broken pages on mobile
        log(`mobile ${route}`);
        mevidence.reset();
        try { await mpage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch { /* skip */ }
        await mpage.waitForLoadState('networkidle', { timeout: settleMs }).catch(() => {});
        const mc: DetectorContext = {
          page: mpage, url, route, viewport: 'mobile', navStatus: null, evidence: mevidence, baseOrigin,
          freshNavigate: async () => { try { await mpage.goto(url, { waitUntil: 'domcontentloaded' }); } catch { /* */ } },
        };
        const mf: RawFinding[] = [];
        try { mf.push(...(await a11yDetector(mc))); } catch { /* */ }
        try { mf.push(...(await responsiveDetector(mc))); } catch { /* */ }
        let shot: string | undefined;
        if (mf.length > 0) {
          shot = join(outputDir, `${safeName(route)}-mobile.png`);
          await mpage.screenshot({ path: shot, fullPage: false }).catch(() => { shot = undefined; });
        }
        for (const f of mf) raw.push({ ...f, url, route, viewport: 'mobile', ...(shot ? { screenshotPath: shot } : {}) });
      }
      await mctx.close();
    }
  } finally {
    await browser.close();
  }

  // ── Dedupe + assemble QaFindings ───────────────────────────────────────
  const seen = new Set<string>();
  const findings: QaFinding[] = [];
  for (const r of raw) {
    const key = `${r.ruleId}|${r.route}|${r.dedupeKey ?? r.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      ruleId: r.ruleId,
      issueClass: r.issueClass,
      title: r.title,
      severity: r.severity,
      confidence: r.confidence,
      reproduction: {
        url: r.url,
        route: r.route,
        steps: r.steps ?? [`Navigate to ${r.route}`],
        ...(r.screenshotPath ? { screenshotPath: r.screenshotPath } : {}),
        ...(r.consoleExcerpt ? { consoleExcerpt: r.consoleExcerpt } : {}),
        ...(r.networkExcerpt ? { networkExcerpt: r.networkExcerpt } : {}),
      },
      suggestedFix: r.suggestedFix,
      ...(r.needsOutOfBandVerification ? { needsOutOfBandVerification: true } : {}),
    });
  }

  findings.sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || a.issueClass - b.issueClass);

  const bySeverity: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const byIssueClass: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byConfidence[f.confidence] = (byConfidence[f.confidence] ?? 0) + 1;
    byIssueClass[String(f.issueClass)] = (byIssueClass[String(f.issueClass)] ?? 0) + 1;
  }

  // Redact once, here, so every consumer of the report (the JSON and HTML
  // writers, stdout, the terminal summary, the MCP payload) receives the same
  // clean object. A no-op when no storage state was loaded.
  return redactValue({
    findings,
    stats: {
      pagesVisited: visited.length,
      linksChecked,
      durationMs: Math.round(performance.now() - startedAt),
      startUrl,
    },
    routes: visited.map(routeOf),
    runAt: new Date().toISOString(),
    summary: { total: findings.length, bySeverity, byConfidence, byIssueClass },
  });
}

function sevRank(s: Severity): number {
  return { critical: 5, high: 4, medium: 3, low: 2, info: 1 }[s] ?? 0;
}

export type { Confidence };
