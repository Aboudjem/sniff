import type { Page, ConsoleMessage, Response, Request } from 'playwright';
import type { BrowserFinding } from '../core/types.js';
import { join } from 'node:path';

export interface PageHook {
  name: string;
  setup(page: Page, viewport: string): void;
  collect(): BrowserFinding[];
  reset(): void;
}

export class ConsoleErrorHook implements PageHook {
  readonly name = 'console-error';
  private findings: BrowserFinding[] = [];
  private currentViewport = '';

  setup(page: Page, viewport: string): void {
    this.currentViewport = viewport;

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        this.findings.push({
          ruleId: 'e2e/console-error',
          severity: 'high',
          message: `Console error: ${msg.text()}`,
          filePath: '',
          line: 0,
          column: 0,
          snippet: msg.text(),
          url: msg.location().url || page.url(),
          viewport: this.currentViewport,
          fixSuggestion: 'Check browser console for stack trace details.',
        });
      }
    });

    page.on('pageerror', (err: Error) => {
      this.findings.push({
        ruleId: 'e2e/console-error',
        severity: 'high',
        message: `Uncaught exception: ${err.message}`,
        filePath: '',
        line: 0,
        column: 0,
        snippet: err.stack ?? err.message,
        url: page.url(),
        viewport: this.currentViewport,
        fixSuggestion: 'Check browser console for stack trace details.',
      });
    });
  }

  collect(): BrowserFinding[] {
    return [...this.findings];
  }

  reset(): void {
    this.findings = [];
  }
}

export class NetworkFailureHook implements PageHook {
  readonly name = 'network-failure';
  private findings: BrowserFinding[] = [];
  private currentViewport = '';

  setup(page: Page, viewport: string): void {
    this.currentViewport = viewport;

    page.on('response', (res: Response) => {
      const status = res.status();
      if (status >= 400) {
        const severity = status >= 500 ? 'high' as const : 'medium' as const;
        this.findings.push({
          ruleId: 'e2e/network-failure',
          severity,
          message: `HTTP ${status} for ${res.url()}`,
          filePath: '',
          line: 0,
          column: 0,
          snippet: `${res.request().method()} ${res.url()} -> ${status}`,
          url: res.url(),
          viewport: this.currentViewport,
          fixSuggestion: 'Verify the resource URL is correct and the server is responding.',
        });
      }
    });

    page.on('requestfailed', (req: Request) => {
      this.findings.push({
        ruleId: 'e2e/network-failure',
        severity: 'critical',
        message: `Request failed: ${req.url()} (${req.failure()?.errorText ?? 'unknown error'})`,
        filePath: '',
        line: 0,
        column: 0,
        snippet: `${req.method()} ${req.url()} -> FAILED: ${req.failure()?.errorText ?? 'unknown'}`,
        url: req.url(),
        viewport: this.currentViewport,
        fixSuggestion: 'Verify the resource URL is correct and the server is responding.',
      });
    });
  }

  collect(): BrowserFinding[] {
    return [...this.findings];
  }

  reset(): void {
    this.findings = [];
  }
}

export class ScreenshotHook implements PageHook {
  readonly name = 'screenshot';

  setup(_page: Page, _viewport: string): void {
    // ScreenshotHook does not listen to events; it is called on demand.
  }

  collect(): BrowserFinding[] {
    return [];
  }

  reset(): void {
    // No state to reset.
  }

  async captureFailure(page: Page, name: string, outputDir: string): Promise<string> {
    const screenshotPath = join(outputDir, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    return screenshotPath;
  }
}

export class PageHookPipeline {
  private hooks: PageHook[] = [];
  private screenshotHook: ScreenshotHook | null = null;

  register(hook: PageHook): void {
    this.hooks.push(hook);
    if (hook instanceof ScreenshotHook) {
      this.screenshotHook = hook;
    }
  }

  setupAll(page: Page, viewport: string): void {
    for (const hook of this.hooks) {
      try {
        hook.setup(page, viewport);
      } catch {
        // Error isolation: if one hook fails setup, others still run.
      }
    }
  }

  collectAll(): BrowserFinding[] {
    const findings: BrowserFinding[] = [];
    for (const hook of this.hooks) {
      try {
        findings.push(...hook.collect());
      } catch {
        // Error isolation: if one hook fails collection, others still run.
      }
    }
    return findings;
  }

  resetAll(): void {
    for (const hook of this.hooks) {
      try {
        hook.reset();
      } catch {
        // Error isolation: if one hook fails reset, others still run.
      }
    }
  }

  async captureScreenshot(page: Page, name: string, outputDir: string): Promise<string | undefined> {
    if (this.screenshotHook) {
      return this.screenshotHook.captureFailure(page, name, outputDir);
    }
    return undefined;
  }
}
