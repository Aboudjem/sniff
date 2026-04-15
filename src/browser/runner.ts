import type { BrowserRunContext, BrowserRunResult, PageVisitResult } from './types.js';
import type { BrowserScanContext, BrowserScanner, ScanResult } from '../scanners/types.js';
import type { BrowserFinding } from '../core/types.js';
import type { SniffConfig } from '../config/schema.js';
import { SniffError } from '../core/errors.js';
import { PageHookPipeline, ConsoleErrorHook, NetworkFailureHook, ScreenshotHook } from './page-hooks.js';

export class BrowserRunner {
  private config: SniffConfig;
  private scanners: BrowserScanner[] = [];

  constructor(config: SniffConfig) {
    this.config = config;
  }

  registerScanner(scanner: BrowserScanner): void {
    this.scanners.push(scanner);
  }

  async run(ctx: BrowserRunContext): Promise<BrowserRunResult> {
    const startTime = performance.now();
    const allScanResults: ScanResult[] = [];
    const allPageVisits: PageVisitResult[] = [];
    const allUrls = new Set<string>();

    let browser;
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({
        headless: ctx.headless,
        slowMo: ctx.slowMo,
      });
    } catch (err) {
      throw new SniffError(
        'BROWSER_LAUNCH_FAILED',
        `Failed to launch browser: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const reportDir = this.config.report?.outputDir ?? 'sniff-reports';

    try {
      for (const vp of ctx.viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
        });

        const page = await context.newPage();

        const pipeline = new PageHookPipeline();
        pipeline.register(new ConsoleErrorHook());
        pipeline.register(new NetworkFailureHook());
        pipeline.register(new ScreenshotHook());
        pipeline.setupAll(page, vp.name);

        const urls = ctx.testFiles.length > 0
          ? ctx.testFiles.map((route) => {
              // If route is already a full URL, use it directly
              if (route.startsWith('http://') || route.startsWith('https://')) {
                return route;
              }
              // Otherwise, combine with baseUrl
              const base = ctx.baseUrl.replace(/\/$/, '');
              const path = route.startsWith('/') ? route : `/${route}`;
              return `${base}${path}`;
            })
          : [ctx.baseUrl];

        for (const url of urls) {
          const pageStart = performance.now();
          allUrls.add(url);

          // Validate URL is within expected baseUrl origin (T-03-01 mitigation)
          const expectedOrigin = new URL(ctx.baseUrl).origin;
          const targetOrigin = new URL(url).origin;
          if (targetOrigin !== expectedOrigin) {
            continue; // Skip URLs outside expected origin
          }

          try {
            await page.goto(url, {
              waitUntil: 'networkidle',
              timeout: ctx.timeout,
            });
          } catch (err) {
            throw new SniffError(
              'URL_UNREACHABLE',
              `Failed to navigate to ${url}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }

          // Build BrowserScanContext for scanners
          const scanCtx: BrowserScanContext = {
            config: this.config,
            rootDir: process.cwd(),
            page,
            viewport: { name: vp.name, width: vp.width, height: vp.height },
            baseUrl: ctx.baseUrl,
          };

          // Run each registered scanner with error isolation
          for (const scanner of this.scanners) {
            try {
              if (scanner.setup) {
                await scanner.setup(scanCtx);
              }
              const result = await scanner.scan(scanCtx);
              allScanResults.push(result);
            } catch (err) {
              allScanResults.push({
                scanner: scanner.name,
                findings: [],
                duration: 0,
                metadata: {
                  error: err instanceof Error ? err.message : String(err),
                },
              });
            } finally {
              try {
                if (scanner.teardown) {
                  await scanner.teardown();
                }
              } catch {
                // teardown errors are silently ignored
              }
            }
          }

          // Collect hook findings
          const hookFindings: BrowserFinding[] = pipeline.collectAll();

          // If any finding is critical or high, capture a screenshot
          let screenshotPath: string | undefined;
          const hasSevereFindings = hookFindings.some(
            (f) => f.severity === 'critical' || f.severity === 'high',
          );
          if (hasSevereFindings) {
            const safeName = url.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
            screenshotPath = await pipeline.captureScreenshot(
              page,
              `${vp.name}-${safeName}`,
              reportDir,
            );
          }

          const pageDuration = performance.now() - pageStart;
          allPageVisits.push({
            url,
            viewport: vp.name,
            findings: hookFindings,
            screenshotPath,
            duration: pageDuration,
          });

          pipeline.resetAll();
        }

        await context.close();
      }
    } finally {
      await browser.close();
    }

    const totalDuration = performance.now() - startTime;

    return {
      scanResults: allScanResults,
      pageVisits: allPageVisits,
      duration: totalDuration,
      urls: [...allUrls],
    };
  }

  async close(): Promise<void> {
    // Cleanup: currently no persistent resources to close.
    // Browser is closed in the run() finally block.
    this.scanners = [];
  }
}
