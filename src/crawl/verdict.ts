import type { CrawlReport, QaFinding } from './types.js';

export const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
const CONF_ORDER = ['confirmed', 'likely', 'uncertain'] as const;

/** Severities that fail a run when the caller does not say otherwise. */
const DEFAULT_FAIL_ON: readonly string[] = ['critical', 'high'];

function rank<T extends string>(order: readonly T[], value: string): number {
  const i = order.indexOf(value as T);
  return i === -1 ? order.length : i;
}

/** "1 critical, 13 high, 9 medium", in severity order, zero counts left out. */
export function severityCounts(findings: readonly QaFinding[]): string {
  const parts: string[] = [];
  for (const sev of SEV_ORDER) {
    const n = findings.filter((f) => f.severity === sev).length;
    if (n > 0) parts.push(`${n} ${sev}`);
  }
  return parts.join(', ');
}

/**
 * The findings to fix first: worst severity first, then the most certain.
 * The sort is stable, so equal findings keep the order the walk found them in.
 */
export function fixFirst(findings: readonly QaFinding[], limit = 3): QaFinding[] {
  return [...findings]
    .sort(
      (a, b) =>
        rank(SEV_ORDER, a.severity) - rank(SEV_ORDER, b.severity) ||
        rank(CONF_ORDER, a.confidence) - rank(CONF_ORDER, b.confidence),
    )
    .slice(0, limit);
}

/**
 * Whether the shown findings fail the run. Callers that know the real exit
 * decision (the `--fail-on` gate plus the assert budget) pass it in; everyone
 * else gets the default gate, critical or high.
 */
export function isFailing(findings: readonly QaFinding[], failed?: boolean): boolean {
  return failed ?? findings.some((f) => DEFAULT_FAIL_ON.includes(f.severity));
}

/**
 * The findings a report shows, and the low-confidence ones it hides. Every
 * output (terminal, HTML, JSON, MCP) splits a run this one way, so they all
 * tell the same count. `all` shows everything.
 */
export function splitFindings<T extends QaFinding>(
  findings: readonly T[],
  all = false,
): { shown: T[]; hidden: T[] } {
  if (all) return { shown: [...findings], hidden: [] };
  return {
    shown: findings.filter((f) => f.confidence !== 'uncertain'),
    hidden: findings.filter((f) => f.confidence === 'uncertain'),
  };
}

/** "1 low-confidence finding hidden", or '' when nothing is hidden. */
export function hiddenNote(hidden: number): string {
  return hidden > 0 ? `${hidden} low-confidence finding${hidden === 1 ? '' : 's'} hidden` : '';
}

/**
 * One line a reader can act on:
 * "FAIL: 26 findings (1 critical, 13 high), 1 low-confidence finding hidden".
 */
export function verdictLine(findings: readonly QaFinding[], failed?: boolean, hidden = 0): string {
  const n = findings.length;
  const tail = hidden > 0 ? `, ${hiddenNote(hidden)}` : '';
  if (n === 0) return `PASS: no findings${tail}`;
  const word = isFailing(findings, failed) ? 'FAIL' : 'PASS';
  const gate = word === 'PASS' ? ', none at a failing severity' : '';
  return `${word}: ${n} finding${n === 1 ? '' : 's'} (${severityCounts(findings)})${gate}${tail}`;
}

/**
 * The report with `summary.shown` and `summary.hiddenLowConfidence` set for
 * this view (`all` shows everything). `summary.total` keeps its meaning:
 * every finding of the run.
 */
export function withVisibility(report: CrawlReport, all = false): CrawlReport {
  const { shown, hidden } = splitFindings(report.findings, all);
  return {
    ...report,
    summary: { ...report.summary, total: report.findings.length, shown: shown.length, hiddenLowConfidence: hidden.length },
  };
}
