import type { Severity } from './types.js';
import type { AssertConfig } from '../config/schema.js';

/** Anything with a severity: source findings, crawl findings, scenario findings. */
export interface SeverityBearing {
  severity: Severity;
}

export interface BudgetResult {
  passed: boolean;
  /** One human-readable line per breached budget, in severity order. */
  violations: string[];
}

const SEVERITY_KEYS: ReadonlyArray<readonly [Severity, keyof AssertConfig]> = [
  ['critical', 'maxCritical'],
  ['high', 'maxHigh'],
  ['medium', 'maxMedium'],
  ['low', 'maxLow'],
  ['info', 'maxInfo'],
];

const PASSED: BudgetResult = { passed: true, violations: [] };

/**
 * Check a set of findings against the optional `assert` block from config.
 *
 * The block is additive: it can only turn a passing run into a failing one, so
 * a project without an `assert` key behaves exactly as it did before. An empty
 * block is also a pass, which keeps a partially-filled config from failing a
 * run for a key nobody set.
 */
export function evaluateSeverityBudget(
  findings: readonly SeverityBearing[],
  budget: AssertConfig | undefined,
): BudgetResult {
  if (!budget) return PASSED;

  const counts: Partial<Record<Severity, number>> = {};
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  }

  const violations: string[] = [];

  for (const [severity, key] of SEVERITY_KEYS) {
    const limit = budget[key];
    if (limit === undefined) continue;
    const actual = counts[severity] ?? 0;
    if (actual > limit) {
      violations.push(
        `assert.${String(key)}: ${actual} ${severity} finding${actual === 1 ? '' : 's'}, budget ${limit}`,
      );
    }
  }

  if (budget.maxTotal !== undefined && findings.length > budget.maxTotal) {
    violations.push(
      `assert.maxTotal: ${findings.length} finding${findings.length === 1 ? '' : 's'}, budget ${budget.maxTotal}`,
    );
  }

  return violations.length === 0 ? PASSED : { passed: false, violations };
}

/**
 * Print each breached budget on its own line, so a CI log says exactly which
 * one blew. Returns whether anything was printed, which is the caller's cue to
 * fail the run.
 */
export function printBudgetViolations(result: BudgetResult): boolean {
  for (const line of result.violations) {
    console.error(`Budget exceeded: ${line}`);
  }
  return result.violations.length > 0;
}
