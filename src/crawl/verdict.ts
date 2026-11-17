import type { QaFinding } from './types.js';

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

/** One line a reader can act on: "FAIL: 26 findings (1 critical, 13 high)". */
export function verdictLine(findings: readonly QaFinding[], failed?: boolean): string {
  const n = findings.length;
  if (n === 0) return 'PASS: no findings';
  const word = isFailing(findings, failed) ? 'FAIL' : 'PASS';
  const gate = word === 'PASS' ? ', none at a failing severity' : '';
  return `${word}: ${n} finding${n === 1 ? '' : 's'} (${severityCounts(findings)})${gate}`;
}
