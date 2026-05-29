import type { Page, ConsoleMessage, Response, Request } from 'playwright';
import {
  isIgnorableRequest,
  isExpectedAuthStatus,
  isEngineInducedFailure,
  isConsoleNoise,
  sameOrigin,
} from './noise.js';

export interface NetworkEvent {
  url: string;
  status: number;
  method: string;
  resourceType: string;
  firstParty: boolean;
  expectedAuth: boolean;
}

export interface FailedRequest {
  url: string;
  method: string;
  resourceType: string;
  errorText: string;
  firstParty: boolean;
}

export interface ConsoleError {
  text: string;
  location: string;
}

export interface PageError {
  message: string;
  stack?: string;
}

/**
 * Captures console errors, uncaught exceptions, and network failures for a
 * single page, applying the noise filter so only first-party, user-relevant
 * signal survives. Listeners are attached once; call `reset()` before each
 * navigation to scope events to the route being visited.
 */
export class PageEvidence {
  consoleErrors: ConsoleError[] = [];
  pageErrors: PageError[] = [];
  /** Filtered HTTP>=400 responses (favicons/analytics/HMR removed). */
  networkFailures: NetworkEvent[] = [];
  /** Filtered request failures (engine-induced aborts removed). */
  failedRequests: FailedRequest[] = [];
  /** All responses (used by detectors to reason about first-party fetches). */
  responses: NetworkEvent[] = [];

  private readonly baseOrigin: string;
  private attached = false;

  constructor(baseOrigin: string) {
    this.baseOrigin = baseOrigin;
  }

  attach(page: Page): void {
    if (this.attached) return;
    this.attached = true;

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (isConsoleNoise(text)) return;
      this.consoleErrors.push({ text, location: msg.location()?.url || page.url() });
    });

    page.on('pageerror', (err: Error) => {
      if (isConsoleNoise(err.message)) return;
      this.pageErrors.push({ message: err.message, ...(err.stack ? { stack: err.stack } : {}) });
    });

    page.on('response', (res: Response) => {
      const url = res.url();
      const status = res.status();
      const ev: NetworkEvent = {
        url,
        status,
        method: res.request().method(),
        resourceType: res.request().resourceType(),
        firstParty: sameOrigin(url, this.baseOrigin),
        expectedAuth: isExpectedAuthStatus(status),
      };
      this.responses.push(ev);
      if (status >= 400 && !isIgnorableRequest(url) && !ev.expectedAuth) {
        this.networkFailures.push(ev);
      }
    });

    page.on('requestfailed', (req: Request) => {
      const errorText = req.failure()?.errorText ?? 'unknown error';
      const url = req.url();
      if (isEngineInducedFailure(errorText) || isIgnorableRequest(url)) return;
      this.failedRequests.push({
        url,
        method: req.method(),
        resourceType: req.resourceType(),
        errorText,
        firstParty: sameOrigin(url, this.baseOrigin),
      });
    });
  }

  reset(): void {
    this.consoleErrors = [];
    this.pageErrors = [];
    this.networkFailures = [];
    this.failedRequests = [];
    this.responses = [];
  }

  /** First-party non-2xx XHR/fetch responses — the "failed API call" signal. */
  firstPartyApiFailures(): NetworkEvent[] {
    return this.networkFailures.filter(
      (e) => e.firstParty && (e.resourceType === 'xhr' || e.resourceType === 'fetch'),
    );
  }

  consoleExcerpt(limit = 5): string[] {
    return [
      ...this.pageErrors.map((e) => `Uncaught: ${e.message}`),
      ...this.consoleErrors.map((e) => `console.error: ${e.text}`),
    ].slice(0, limit);
  }

  networkExcerpt(limit = 5): string[] {
    return [
      ...this.networkFailures.map((e) => `${e.method} ${e.url} -> ${e.status}`),
      ...this.failedRequests.map((e) => `${e.method} ${e.url} -> FAILED (${e.errorText})`),
    ].slice(0, limit);
  }
}
