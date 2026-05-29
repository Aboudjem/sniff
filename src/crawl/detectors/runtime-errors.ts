import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';

/**
 * Class 3 — console errors, uncaught exceptions, and failed first-party network
 * requests observed during the visit. Evidence is already noise-filtered
 * (favicons / analytics / HMR / expected-auth removed) in PageEvidence.
 */
export const runtimeErrorDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  const findings: RawFinding[] = [];
  const { evidence } = ctx;

  // Uncaught exceptions — always a real defect.
  const seenExc = new Set<string>();
  for (const err of evidence.pageErrors) {
    const key = err.message.slice(0, 120);
    if (seenExc.has(key)) continue;
    seenExc.add(key);
    findings.push({
      ruleId: 'js/uncaught-exception',
      issueClass: 3,
      title: `Uncaught exception: ${err.message.slice(0, 100)}`,
      severity: 'high',
      confidence: 'confirmed',
      steps: [`Navigate to ${ctx.route}`, `An uncaught exception was thrown: ${err.message}`],
      consoleExcerpt: [err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : err.message],
      suggestedFix: 'Fix the thrown error; an uncaught exception can halt the rest of the page script (other features silently stop working).',
      dedupeKey: key,
    });
  }

  // console.error — real, but a notch lower than a thrown exception.
  const seenCon = new Set<string>();
  for (const c of evidence.consoleErrors) {
    const key = c.text.slice(0, 120);
    if (seenCon.has(key)) continue;
    seenCon.add(key);
    findings.push({
      ruleId: 'console/error',
      issueClass: 3,
      title: `Console error: ${c.text.slice(0, 100)}`,
      severity: 'medium',
      confidence: 'likely',
      steps: [`Navigate to ${ctx.route}`, `console.error logged: ${c.text}`],
      consoleExcerpt: [c.text],
      suggestedFix: 'Investigate the logged error; console errors often mark a feature that failed silently.',
      dedupeKey: key,
    });
  }

  // Failed first-party API calls (xhr/fetch non-2xx).
  const seenNet = new Set<string>();
  for (const ev of evidence.firstPartyApiFailures()) {
    const key = `${ev.method} ${ev.url}`;
    if (seenNet.has(key)) continue;
    seenNet.add(key);
    const isServer = ev.status >= 500;
    findings.push({
      ruleId: 'network/failed-request',
      issueClass: 3,
      title: `Failed request: ${ev.method} ${shortPath(ev.url)} → ${ev.status}`,
      severity: isServer ? 'high' : 'medium',
      confidence: 'confirmed',
      steps: [`Navigate to ${ctx.route}`, `The page requested ${ev.method} ${ev.url} which returned HTTP ${ev.status}`],
      networkExcerpt: [`${ev.method} ${ev.url} -> ${ev.status}`],
      suggestedFix: isServer
        ? 'The API endpoint errors (5xx). Check the server handler; the page likely shows stale or missing data.'
        : 'The API call failed (4xx). Verify the endpoint URL and request shape.',
      dedupeKey: key,
    });
  }

  return findings;
};

function shortPath(u: string): string {
  try { return new URL(u).pathname; } catch { return u; }
}
