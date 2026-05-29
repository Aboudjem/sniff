import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';

/**
 * Class 10 — responsive layout. Horizontal overflow at mobile width is a
 * high-precision signal: if the document scrolls sideways on a phone, the
 * layout is broken. Run on the mobile pass only (tap-target size is handled by
 * axe's target-size rule in the a11y detector).
 */
export const responsiveDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  if (ctx.viewport !== 'mobile') return [];
  const findings: RawFinding[] = [];

  // ── Tap targets below the 24x24 WCAG 2.2 minimum (buttons/controls) ────
  const tiny = await ctx.page
    .evaluate(() => {
      const MIN = 24;
      const controls = Array.from(
        document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"], a.btn, a.button'),
      ) as HTMLElement[];
      const out: Array<{ label: string; w: number; h: number }> = [];
      for (const c of controls) {
        const s = getComputedStyle(c);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const r = c.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < MIN || r.height < MIN) {
          out.push({ label: (c.textContent || c.getAttribute('aria-label') || c.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) });
        }
      }
      return out;
    })
    .catch(() => [] as Array<{ label: string; w: number; h: number }>);

  if (tiny.length > 0) {
    const sample = tiny.slice(0, 4).map((t) => `"${t.label}" ${t.w}x${t.h}px`).join(', ');
    findings.push({
      ruleId: 'responsive/tap-target-too-small',
      issueClass: 10,
      title: `Tap target${tiny.length > 1 ? 's' : ''} below 24x24px (${tiny.length})`,
      severity: 'low',
      confidence: 'likely',
      steps: [`Navigate to ${ctx.route} at 375px (mobile) width`, `Found ${tiny.length} control(s) smaller than the 24x24px minimum: ${sample}`],
      suggestedFix: 'Give interactive controls at least a 24x24px (ideally 44x44px) touch area via padding/min-height.',
      dedupeKey: 'tap-target',
    });
  }

  const overflow = await ctx.page
    .evaluate(() => {
      const doc = document.documentElement;
      const slack = 4; // ignore sub-pixel rounding
      const scrollW = doc.scrollWidth;
      const clientW = doc.clientWidth;
      if (scrollW <= clientW + slack) return null;

      // find the widest element that exceeds the viewport, for the proof
      let worst: { tag: string; width: number; desc: string } | null = null;
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > clientW + slack && (!worst || r.width > worst.width)) {
          const cls = (el as HTMLElement).className && typeof (el as HTMLElement).className === 'string'
            ? '.' + (el as HTMLElement).className.trim().split(/\s+/).join('.')
            : '';
          worst = { tag: el.tagName.toLowerCase(), width: Math.round(r.width), desc: el.tagName.toLowerCase() + cls.slice(0, 60) };
        }
      }
      return { scrollW, clientW, worst };
    })
    .catch(() => null);

  if (!overflow) return findings;

  const culprit = overflow.worst ? ` Widest offender: <${overflow.worst.desc}> at ${overflow.worst.width}px.` : '';
  findings.push({
    ruleId: 'responsive/horizontal-overflow',
    issueClass: 10,
    title: 'Horizontal overflow at mobile width',
    severity: 'medium',
    confidence: 'confirmed',
    steps: [
      `Navigate to ${ctx.route} at 375px (mobile) width`,
      `The document scrolls horizontally: content is ${overflow.scrollW}px wide in a ${overflow.clientW}px viewport.${culprit}`,
    ],
    suggestedFix: 'Constrain fixed-width elements (use max-width:100%, overflow-x handling, or responsive units) so the page fits the viewport.',
    dedupeKey: 'overflow',
  });
  return findings;
};
