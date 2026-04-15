import { performance as perf } from 'node:perf_hooks';

import type { BrowserScanner, BrowserScanContext, ScanResult } from '../types.js';
import type { BrowserFinding, Severity } from '../../core/types.js';
import type { SniffConfig } from '../../config/schema.js';

type MetricName = 'lcp' | 'fcp' | 'tti';

interface MetricDef {
  auditId: string;
  label: string;
}

const METRIC_DEFS: Record<MetricName, MetricDef> = {
  lcp: { auditId: 'largest-contentful-paint', label: 'Largest Contentful Paint (LCP)' },
  fcp: { auditId: 'first-contentful-paint', label: 'First Contentful Paint (FCP)' },
  tti: { auditId: 'interactive', label: 'Time to Interactive (TTI)' },
};

const DEFAULT_BUDGETS = { lcp: 2500, fcp: 1800, tti: 3800 };

function mapOvershootToSeverity(overshoot: number): Severity {
  if (overshoot > 100) return 'critical';
  if (overshoot > 50) return 'high';
  if (overshoot > 25) return 'medium';
  return 'low';
}

function buildPerfSuggestion(metric: MetricName, _value: number, _budget: number): string {
  switch (metric) {
    case 'lcp':
      return 'Optimize largest content element. Consider lazy-loading below-fold images, preloading critical resources, or reducing server response time.';
    case 'fcp':
      return 'Reduce time to first paint. Inline critical CSS, defer non-critical JavaScript, and minimize render-blocking resources.';
    case 'tti':
      return 'Reduce JavaScript execution time. Split large bundles, defer non-essential scripts, and reduce main-thread work.';
  }
}

export class PerformanceScanner implements BrowserScanner {
  name = 'performance';
  private urls: Set<string> = new Set();
  private config: SniffConfig | null = null;

  async scan(ctx: BrowserScanContext): Promise<ScanResult> {
    this.config = ctx.config;
    this.urls.add(ctx.page.url());
    return {
      scanner: this.name,
      findings: [],
      duration: 0,
      metadata: { urlsCollected: this.urls.size },
    };
  }

  async measureAll(): Promise<ScanResult> {
    const start = perf.now();
    const findings: BrowserFinding[] = [];
    const metricsMap: Record<string, { lcp: number | null; fcp: number | null; tti: number | null; score: number | null }> = {};

    if (this.config?.performance?.enabled === false) {
      return { scanner: this.name, findings: [], duration: perf.now() - start, metadata: { skipped: true } };
    }

    if (this.urls.size === 0) {
      return { scanner: this.name, findings: [], duration: perf.now() - start, metadata: { noUrls: true } };
    }

    const budgets = this.config?.performance?.budgets ?? DEFAULT_BUDGETS;

    // Lazy-import lighthouse and chrome-launcher
    const lighthouse = (await import('lighthouse')).default;
    const chromeLauncher = await import('chrome-launcher');

    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox'],
    });

    try {
      for (const url of this.urls) {
        try {
          const result = await lighthouse(url, {
            port: chrome.port,
            output: 'json',
            onlyCategories: ['performance'],
            formFactor: 'desktop',
          });

          if (!result?.lhr?.audits) {
            findings.push({
              ruleId: 'perf/lighthouse-error',
              severity: 'info',
              message: `Lighthouse returned no audit data for ${url}`,
              filePath: url,
              line: 0,
              column: 0,
              snippet: '',
              url,
              viewport: 'desktop',
            });
            continue;
          }

          const audits = result.lhr.audits;
          const lcp = audits['largest-contentful-paint']?.numericValue ?? null;
          const fcp = audits['first-contentful-paint']?.numericValue ?? null;
          const tti = audits['interactive']?.numericValue ?? null;
          const score = result.lhr.categories?.performance?.score ?? null;

          metricsMap[url] = { lcp, fcp, tti, score };

          const metricValues: Record<MetricName, number | null> = { lcp, fcp, tti };

          for (const [metricName, value] of Object.entries(metricValues) as Array<[MetricName, number | null]>) {
            if (value === null) continue;

            const budget = budgets[metricName];
            if (value <= budget) continue;

            const overshoot = ((value - budget) / budget) * 100;
            const severity = mapOvershootToSeverity(overshoot);
            const def = METRIC_DEFS[metricName];

            findings.push({
              ruleId: `perf/${metricName}`,
              severity,
              message: `${def.label} is ${Math.round(value)}ms, exceeds budget of ${budget}ms by ${Math.round(value - budget)}ms`,
              filePath: url,
              line: 0,
              column: 0,
              snippet: `${def.label}: ${Math.round(value)}ms (budget: ${budget}ms)`,
              url,
              viewport: 'desktop',
              fixSuggestion: buildPerfSuggestion(metricName, value, budget),
            });
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          findings.push({
            ruleId: 'perf/lighthouse-error',
            severity: 'info',
            message: `Lighthouse failed for ${url}: ${errorMessage}`,
            filePath: url,
            line: 0,
            column: 0,
            snippet: '',
            url,
            viewport: 'desktop',
          });
        }
      }
    } finally {
      await chrome.kill();
    }

    return {
      scanner: this.name,
      findings,
      duration: perf.now() - start,
      metadata: { metrics: metricsMap },
    };
  }
}
