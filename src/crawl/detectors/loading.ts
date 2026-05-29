import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';

const ERROR_TEXT_RE = /(error|failed|failure|something went wrong|went wrong|try again|couldn'?t|could not|unable to|problem loading|retry)/i;

/**
 * Class 8 — loading / error states.
 *  - stuck spinner: a loading indicator is still visible after the page has
 *    had ample time to settle (e.g. a request that never resolves).
 *  - missing error state: a first-party API call failed but the page shows no
 *    error affordance at all (the failure is swallowed).
 */
export const loadingStateDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  const findings: RawFinding[] = [];

  const spinnerSel =
    '[class*="spin" i],[class*="loading" i],[class*="loader" i],[class*="skeleton" i],[role="progressbar"],[aria-busy="true"]';

  const stillSpinning = async (): Promise<boolean> =>
    ctx.page
      .evaluate((sel) => {
        const els = Array.from(document.querySelectorAll(sel));
        return els.some((el) => {
          const s = getComputedStyle(el as HTMLElement);
          const r = (el as HTMLElement).getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
        });
      }, spinnerSel)
      .catch(() => false);

  if (await stillSpinning()) {
    // Confirm it is genuinely stuck (still there after a further wait).
    await ctx.page.waitForTimeout(2500);
    if (await stillSpinning()) {
      findings.push({
        ruleId: 'loading/stuck-spinner',
        issueClass: 8,
        title: 'Loading spinner never resolves',
        severity: 'medium',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, 'A loading indicator is still spinning after the page has had ample time to settle', 'A request likely hung and the UI is stuck loading'],
        suggestedFix: 'Add a timeout/fallback for the pending request and resolve the loading state (render data, an empty state, or an error).',
        networkExcerpt: ctx.evidence.networkExcerpt(),
        dedupeKey: 'stuck-spinner',
      });
    }
  }

  // Missing error state: a first-party call failed but nothing tells the user.
  const apiFailures = ctx.evidence.firstPartyApiFailures();
  if (apiFailures.length > 0) {
    const hasErrorUi = await ctx.page
      .evaluate((src) => {
        const re = new RegExp(src, 'i');
        const hasAlert = document.querySelector('[role="alert"]') !== null;
        return hasAlert || re.test(document.body?.innerText || '');
      }, ERROR_TEXT_RE.source)
      .catch(() => true);
    if (!hasErrorUi) {
      const f = apiFailures[0]!;
      findings.push({
        ruleId: 'state/missing-error-state',
        issueClass: 8,
        title: 'Failed request shows no error state to the user',
        severity: 'medium',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, `A request failed (${f.method} ${f.url} → ${f.status})`, 'The page shows no error message, retry, or fallback — the failure is silent'],
        suggestedFix: 'Render a visible error state when a request fails (message + retry), instead of swallowing the error.',
        networkExcerpt: ctx.evidence.networkExcerpt(),
        dedupeKey: 'missing-error-state',
      });
    }
  }

  return findings;
};
