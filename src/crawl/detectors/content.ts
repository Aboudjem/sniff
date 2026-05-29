import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';
import { PLACEHOLDER_PATTERNS } from '../noise.js';

/**
 * Class 4 — empty data and placeholder/fake data. Both read only VISIBLE text
 * (innerText), never raw HTML/comments, to avoid false credit and to match what
 * a user actually sees.
 */
export const contentDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  const findings: RawFinding[] = [];

  const data = await ctx.page
    .evaluate(() => {
      const visibleText = (document.body?.innerText || '').trim();

      // Empty collections: a data table (thead + empty tbody) or a labelled
      // list/grid that renders zero items and shows no empty-state message.
      function isShown(el: Element): boolean {
        const s = getComputedStyle(el as HTMLElement);
        return s.display !== 'none' && s.visibility !== 'hidden';
      }
      function nearbyText(el: Element): string {
        const scope = el.closest('section, main, article, div, body') || el.parentElement || el;
        return (scope.textContent || '').toLowerCase();
      }
      const EMPTY_HINT = /(no |empty|nothing|0 results|no results|you (have|don'?t)|once you|get started|add your first|haven'?t)/i;

      const empties: Array<{ kind: string; label: string }> = [];

      // data tables
      for (const table of Array.from(document.querySelectorAll('table'))) {
        if (!isShown(table)) continue;
        const headCols = table.querySelectorAll('thead th, thead td').length;
        const bodyRows = table.querySelectorAll('tbody tr').length;
        if (headCols >= 2 && bodyRows === 0) {
          const heading = (table.closest('section, main, body')?.querySelector('h1,h2,h3')?.textContent || '').trim();
          if (!EMPTY_HINT.test(nearbyText(table))) {
            empties.push({ kind: 'table', label: heading || 'data table' });
          }
        }
      }
      // labelled lists/grids
      for (const list of Array.from(document.querySelectorAll('ul[aria-label], ol[aria-label], [role="list"], [data-testid*="list" i], [class*="results" i]'))) {
        if (!isShown(list)) continue;
        const items = list.querySelectorAll('li, [role="listitem"], [class*="item" i]').length;
        if (items === 0 && !EMPTY_HINT.test(nearbyText(list))) {
          const label = (list.getAttribute('aria-label') || '').trim();
          empties.push({ kind: 'list', label: label || 'list' });
        }
      }

      return { visibleText, empties };
    })
    .catch(() => null);

  if (!data) return findings;

  for (const e of data.empties) {
    findings.push({
      ruleId: 'data/empty-collection',
      issueClass: 4,
      title: `Empty ${e.kind} with no empty-state ("${e.label}")`,
      severity: 'medium',
      confidence: 'likely',
      steps: [`Navigate to ${ctx.route}`, `The "${e.label}" ${e.kind} rendered with zero rows/items and no empty-state message`],
      suggestedFix: 'Either load the data or render a clear empty-state ("You have no orders yet"). A silently empty table reads as a bug.',
      dedupeKey: `empty:${e.kind}:${e.label}`,
    });
  }

  // Placeholder / mock data left in the rendered page.
  for (const p of PLACEHOLDER_PATTERNS) {
    const m = data.visibleText.match(p.re);
    if (m) {
      findings.push({
        ruleId: 'data/placeholder-content',
        issueClass: 4,
        title: `${p.label} visible in the page`,
        severity: 'medium',
        confidence: 'confirmed',
        steps: [`Navigate to ${ctx.route}`, `Found placeholder/mock content: "${m[0]}"`],
        suggestedFix: 'Replace placeholder/mock data with real content (or guard it out of production builds).',
        dedupeKey: `placeholder:${p.id}`,
      });
    }
  }

  return findings;
};
