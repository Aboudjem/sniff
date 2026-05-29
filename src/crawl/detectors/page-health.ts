import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';

const STACK_TRACE_RE =
  /(\bat\s+\w[\w.]*\s*\(.*:\d+:\d+\)|Cannot read propert(y|ies) of (undefined|null)|\bTypeError:|\bReferenceError:|Unhandled (Runtime )?Error|Application error: a (server|client)-side exception|Internal Server Error|Traceback \(most recent call last\))/;

/**
 * Class 1 — broken pages/routes. Three signals:
 *  - the navigation returned a 4xx/5xx
 *  - a 2xx page rendered (almost) nothing (blank/white screen)
 *  - the visible content is a raw stack trace / crash screen
 */
export const pageHealthDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  const findings: RawFinding[] = [];

  if (ctx.navStatus !== null && ctx.navStatus >= 400) {
    const isServer = ctx.navStatus >= 500;
    findings.push({
      ruleId: 'route/broken-page',
      issueClass: 1,
      title: `Page returns HTTP ${ctx.navStatus}`,
      severity: isServer ? 'critical' : 'high',
      confidence: 'confirmed',
      steps: [`Navigate to ${ctx.route}`, `Server responded with HTTP ${ctx.navStatus}`],
      suggestedFix: isServer
        ? 'The route throws server-side. Check the server logs/handler for this path and return a valid page or a proper error page.'
        : 'The route is not found. Fix the link that points here, add the missing route, or return a helpful 404 page.',
    });
  }

  // DOM-level signals only make sense if we actually rendered something.
  const dom = await ctx.page
    .evaluate(() => {
      const body = document.body;
      const text = (body?.innerText || '').trim();
      const main = document.querySelector('main, [role="main"], #root, #app, #__next');
      const mainText = (main?.textContent || '').trim();
      const interactive = document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]').length;
      return { textLen: text.length, sample: text.slice(0, 400), mainText: mainText.length, interactive };
    })
    .catch(() => null);

  if (dom && (ctx.navStatus === null || ctx.navStatus < 400)) {
    // Crash screen: a raw stack trace / framework error is visible to the user.
    if (STACK_TRACE_RE.test(dom.sample)) {
      findings.push({
        ruleId: 'route/crash-screen',
        issueClass: 1,
        title: 'Raw error / stack trace shown to the user',
        severity: 'high',
        confidence: 'confirmed',
        steps: [`Navigate to ${ctx.route}`, 'The page renders a raw stack trace / crash screen'],
        suggestedFix: 'Catch the error and render a friendly error state; never expose stack traces to users.',
        dedupeKey: 'crash',
      });
    } else if (dom.textLen < 12 && dom.interactive === 0) {
      // Blank render: a 200 that shows essentially nothing and offers no controls.
      findings.push({
        ruleId: 'route/blank-render',
        issueClass: 1,
        title: 'Page renders blank (no visible content or controls)',
        severity: 'high',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, 'The page loaded (HTTP 2xx) but rendered no visible content'],
        suggestedFix: 'A 200 response rendered an empty document — likely a client-side render crash or missing data. Check the console for errors and verify the page mounts.',
        dedupeKey: 'blank',
      });
    }
  }

  return findings;
};
