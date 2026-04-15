import type { SniffConfig } from '../config/schema.js';
import type { ExplorationProvider } from '../ai/types.js';
import type { BrowserFinding } from '../core/types.js';
import type {
  ExplorationContext,
  ExplorationResult,
  ExplorationActionLog,
  PageState,
} from './types.js';
import { selectPayload } from './edge-cases.js';

/**
 * ExplorationRunner drives an AI-powered chaos monkey exploration loop.
 * Mirrors BrowserRunner pattern: lazy playwright import, chromium.launch, try/finally browser.close.
 * Reuses PageHookPipeline with ConsoleErrorHook, NetworkFailureHook, ScreenshotHook.
 */
export class ExplorationRunner {
  private config: SniffConfig;
  private provider: ExplorationProvider;

  constructor(config: SniffConfig, provider: ExplorationProvider) {
    this.config = config;
    this.provider = provider;
  }

  async explore(ctx: ExplorationContext): Promise<ExplorationResult> {
    const startTime = performance.now();
    const actionLog: ExplorationActionLog[] = [];
    const allFindings: BrowserFinding[] = [];
    const pagesVisited = new Set<string>();

    // Lazy playwright import (mirrors BrowserRunner pattern)
    const { chromium } = await import('playwright');
    const {
      PageHookPipeline,
      ConsoleErrorHook,
      NetworkFailureHook,
      ScreenshotHook,
    } = await import('../browser/page-hooks.js');

    const browser = await chromium.launch({ headless: ctx.headless });

    try {
      const context = await browser.newContext({
        viewport: { width: ctx.viewport.width, height: ctx.viewport.height },
      });
      const page = await context.newPage();

      // Setup PageHookPipeline (same as BrowserRunner)
      const pipeline = new PageHookPipeline();
      pipeline.register(new ConsoleErrorHook());
      pipeline.register(new NetworkFailureHook());
      pipeline.register(new ScreenshotHook());
      pipeline.setupAll(page, `${ctx.viewport.width}x${ctx.viewport.height}`);

      // Route seeding (D-01): discover app routes for initial URL queue
      const pendingUrls = await this.buildUrlQueue(ctx);
      let currentUrlIndex = 0;

      // Navigate to first URL
      if (pendingUrls.length > 0) {
        const firstUrl = pendingUrls[0];
        try {
          await page.goto(firstUrl, {
            waitUntil: 'networkidle',
            timeout: ctx.timeout,
          });
          pagesVisited.add(firstUrl);
        } catch {
          // Navigation failure on first URL is not fatal; log and continue
        }
      }

      const reportDir = this.config.report?.outputDir ?? 'sniff-reports';

      // Main exploration loop — bounded by maxSteps (T-04-07)
      for (let step = 0; step < ctx.maxSteps; step++) {
        const urlBefore = page.url();

        // Extract current page state
        const { extractPageState } = await import('./page-state-extractor.js');
        const pageState = this.prioritizeElements(await extractPageState(page));

        // Ask AI for next action
        let decision;
        try {
          decision = await this.provider.decideNextAction(pageState, actionLog);
        } catch {
          decision = { action: 'done' as const, reasoning: 'Provider error' };
        }

        // Terminate on 'done'
        if (decision.action === 'done') {
          actionLog.push(this.buildLogEntry(step, urlBefore, decision, page.url(), 0, 0, pageState.interactiveElements.length));
          break;
        }

        // Execute the decision
        try {
          switch (decision.action) {
            case 'click':
              if (decision.selector) {
                await page.click(decision.selector, { timeout: 5000 });
              }
              break;

            case 'fill':
              if (decision.selector) {
                // Use AI-provided value, or fallback to selectPayload
                const fillValue = decision.value ?? selectPayload('text', step).value;
                await page.fill(decision.selector, fillValue, { timeout: 5000 });
              }
              break;

            case 'navigate':
              if (decision.url) {
                // T-04-06: Validate URL against baseUrl origin before navigating
                const baseOrigin = new URL(ctx.baseUrl).origin;
                const targetOrigin = new URL(decision.url, ctx.baseUrl).origin;
                if (targetOrigin !== baseOrigin) {
                  actionLog.push(this.buildLogEntry(
                    step, urlBefore,
                    { ...decision, reasoning: `Blocked cross-origin navigation to ${decision.url}` },
                    page.url(), 0, 0, 0,
                  ));
                  continue;
                }
                await page.goto(decision.url, {
                  waitUntil: 'networkidle',
                  timeout: ctx.timeout,
                });
              }
              break;

            case 'scroll':
              await page.evaluate(() => window.scrollBy(0, 500));
              break;
          }
        } catch {
          // Action failed (element gone, timeout, etc.) — log and continue
        }

        // Wait briefly for any async effects
        await page.waitForTimeout(300);

        const urlAfter = page.url();
        if (urlAfter !== urlBefore) {
          pagesVisited.add(urlAfter);
        }

        // Collect hook findings
        const hookFindings = pipeline.collectAll();
        const consoleErrors = hookFindings.filter(
          (f) => f.ruleId === 'e2e/console-error',
        ).length;
        const networkFailures = hookFindings.filter(
          (f) => f.ruleId === 'e2e/network-failure',
        ).length;

        // Capture screenshot on severe findings
        const hasSevere = hookFindings.some(
          (f) => f.severity === 'critical' || f.severity === 'high',
        );
        let screenshotPath: string | undefined;
        if (hasSevere) {
          const safeName = urlAfter.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 80);
          screenshotPath = await pipeline.captureScreenshot(
            page,
            `explore-${step}-${safeName}`,
            reportDir,
          );
        }

        allFindings.push(...hookFindings);

        // Build action log entry
        const newElements = pageState.interactiveElements.length;
        const logEntry = this.buildLogEntry(
          step, urlBefore, decision, urlAfter,
          consoleErrors, networkFailures, newElements, screenshotPath,
        );
        if (decision.action === 'fill' && decision.value) {
          logEntry.value = decision.value;
        }
        actionLog.push(logEntry);

        pipeline.resetAll();

        // Advance to next pending URL if we've been on this one long enough
        // or if there are no more interactive elements
        if (
          pageState.interactiveElements.length === 0 &&
          pageState.formFields.length === 0 &&
          currentUrlIndex < pendingUrls.length - 1
        ) {
          currentUrlIndex++;
          try {
            await page.goto(pendingUrls[currentUrlIndex], {
              waitUntil: 'networkidle',
              timeout: ctx.timeout,
            });
            pagesVisited.add(pendingUrls[currentUrlIndex]);
          } catch {
            // Skip unreachable URLs
          }
        }
      }

      await context.close();
    } finally {
      await browser.close();
    }

    const duration = performance.now() - startTime;

    return {
      actionLog,
      findings: allFindings,
      pagesVisited: [...pagesVisited],
      totalSteps: actionLog.length,
      duration,
    };
  }

  /**
   * Build URL queue from route discovery + baseUrl.
   */
  private async buildUrlQueue(ctx: ExplorationContext): Promise<string[]> {
    const urls: string[] = [ctx.baseUrl];

    try {
      const { detectFrameworks } = await import('../analyzers/framework-detector.js');
      const { discoverRoutes } = await import('../analyzers/route-discoverer.js');

      const frameworks = await detectFrameworks(ctx.rootDir);
      const routes = await discoverRoutes(ctx.rootDir, frameworks);

      const base = ctx.baseUrl.replace(/\/$/, '');
      for (const route of routes) {
        // Skip dynamic routes (they need param values we don't have)
        if (route.dynamic) continue;
        const fullUrl = `${base}${route.path}`;
        if (!urls.includes(fullUrl)) {
          urls.push(fullUrl);
        }
      }
    } catch {
      // Route discovery failed — just use baseUrl
    }

    return urls;
  }

  /**
   * Breadth-first priority: forms first > submit buttons > unvisited links > other.
   */
  private prioritizeElements(pageState: PageState): PageState {
    const sorted = [...pageState.interactiveElements].sort((a, b) => {
      const priority = (el: typeof a): number => {
        if (el.type === 'submit') return 0;
        if (el.tag === 'button') return 1;
        if (el.tag === 'a' && !el.visited) return 2;
        return 3;
      };
      return priority(a) - priority(b);
    });

    return {
      ...pageState,
      interactiveElements: sorted,
    };
  }

  private buildLogEntry(
    step: number,
    urlBefore: string,
    decision: { action: string; selector?: string; value?: string; url?: string; reasoning: string },
    urlAfter: string,
    consoleErrors: number,
    networkFailures: number,
    newElementsFound: number,
    screenshotPath?: string,
  ): ExplorationActionLog {
    return {
      step,
      timestamp: new Date().toISOString(),
      url: urlBefore,
      action: decision.action as ExplorationActionLog['action'],
      target: {
        selector: decision.selector ?? decision.url ?? '',
        text: undefined,
        type: undefined,
      },
      value: decision.value,
      reasoning: decision.reasoning,
      observation: {
        urlAfter,
        consoleErrors,
        networkFailures,
        screenshotPath,
        newElementsFound,
      },
    };
  }
}
