import type { Detector, DetectorContext } from './context.js';
import type { RawFinding, Severity } from '../types.js';

function mapAxeImpact(impact: string | null | undefined): Severity {
  switch (impact) {
    case 'critical': return 'high';
    case 'serious': return 'high';
    case 'moderate': return 'medium';
    case 'minor': return 'low';
    default: return 'medium';
  }
}

// axe rule id -> our issue class. target-size is a responsive/touch concern (10).
function issueClassFor(axeId: string): number {
  return axeId === 'target-size' ? 10 : 11;
}

/**
 * Class 11 (accessibility) + the touch-target part of class 10, via axe-core.
 * axe is designed to emit zero false positives (uncertain checks are
 * "incomplete", which we drop), so every violation is reported as `confirmed`.
 * One finding per violation (not per node) to keep volume sane.
 */
export const a11yDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  let AxeBuilder: typeof import('@axe-core/playwright').AxeBuilder;
  try {
    ({ AxeBuilder } = await import('@axe-core/playwright'));
  } catch {
    return [];
  }

  let builder = new AxeBuilder({ page: ctx.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  if (ctx.viewport === 'mobile') {
    builder = builder.withRules(['target-size']);
  }

  let results;
  try {
    results = await builder.analyze();
  } catch {
    return [];
  }

  const findings: RawFinding[] = [];

  // Deterministic missing-label check (axe's `label` rule misses some cases).
  const unlabeled = await ctx.page
    .evaluate(() => {
      const TYPES = ['text', 'email', 'password', 'tel', 'search', 'number', 'url', ''];
      const controls = Array.from(document.querySelectorAll('input, select, textarea')) as HTMLInputElement[];
      const out: string[] = [];
      for (const c of controls) {
        const type = (c.getAttribute('type') || '').toLowerCase();
        if (c.tagName === 'INPUT' && !TYPES.includes(type)) continue; // skip submit/button/checkbox/radio/hidden
        const s = getComputedStyle(c);
        if (s.display === 'none' || s.visibility === 'hidden') continue;
        const hasAria = c.getAttribute('aria-label') || c.getAttribute('aria-labelledby') || c.getAttribute('title');
        const labelledBy = c.id ? document.querySelector(`label[for="${CSS.escape(c.id)}"]`) : null;
        const wrapping = c.closest('label');
        if (!hasAria && !labelledBy && !wrapping) {
          out.push((c.getAttribute('name') || c.getAttribute('placeholder') || type || 'field').slice(0, 30));
        }
      }
      return out;
    })
    .catch(() => [] as string[]);

  if (unlabeled.length > 0) {
    findings.push({
      ruleId: 'a11y/label-missing',
      issueClass: 11,
      title: `Form control${unlabeled.length > 1 ? 's' : ''} without an accessible label (${unlabeled.length})`,
      severity: 'medium',
      confidence: 'confirmed',
      steps: [`Navigate to ${ctx.route}`, `Found input(s) with no <label>, aria-label, or title: ${unlabeled.join(', ')}`],
      suggestedFix: 'Associate a <label for> (or aria-label) with every form control so screen readers and clicks on the label work.',
      dedupeKey: 'label-missing',
    });
  }

  for (const v of results.violations) {
    const nodeCount = v.nodes.length;
    const sampleHtml = v.nodes.slice(0, 2).map((n) => n.html.slice(0, 120));
    findings.push({
      ruleId: `a11y/${v.id}`,
      issueClass: issueClassFor(v.id),
      title: `${v.help}${nodeCount > 1 ? ` (${nodeCount} elements)` : ''}`,
      severity: mapAxeImpact(v.impact),
      confidence: 'confirmed',
      steps: [
        `Navigate to ${ctx.route}${ctx.viewport === 'mobile' ? ' (mobile viewport)' : ''}`,
        `axe-core WCAG check "${v.id}" failed: ${v.description}`,
        ...sampleHtml.map((h) => `element: ${h}`),
      ],
      suggestedFix: `${v.help}. See ${v.helpUrl}`,
      dedupeKey: `a11y:${v.id}`,
    });
  }
  return findings;
};
