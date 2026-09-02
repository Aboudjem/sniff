import { describe, it, expect, vi, afterEach } from 'vitest';
import { evaluateSeverityBudget, printBudgetViolations } from './assert-budget.js';
import type { SeverityBearing } from './assert-budget.js';
import type { Severity } from './types.js';

function findings(spec: Partial<Record<Severity, number>>): SeverityBearing[] {
  const out: SeverityBearing[] = [];
  for (const [severity, n] of Object.entries(spec)) {
    for (let i = 0; i < (n as number); i += 1) out.push({ severity: severity as Severity });
  }
  return out;
}

describe('evaluateSeverityBudget', () => {
  describe('absent or empty block', () => {
    it('passes when there is no assert block at all', () => {
      const r = evaluateSeverityBudget(findings({ critical: 10 }), undefined);
      expect(r.passed).toBe(true);
      expect(r.violations).toEqual([]);
    });

    it('passes on an empty block, so a partially filled config never fails a run', () => {
      const r = evaluateSeverityBudget(findings({ critical: 10 }), {});
      expect(r.passed).toBe(true);
    });

    it('passes with no findings at all', () => {
      expect(evaluateSeverityBudget([], { maxCritical: 0, maxTotal: 0 }).passed).toBe(true);
    });
  });

  describe('per-severity budgets', () => {
    it('passes exactly at the budget', () => {
      expect(evaluateSeverityBudget(findings({ high: 3 }), { maxHigh: 3 }).passed).toBe(true);
    });

    it('passes under the budget', () => {
      expect(evaluateSeverityBudget(findings({ high: 2 }), { maxHigh: 3 }).passed).toBe(true);
    });

    it('fails one over the budget and names the key and both numbers', () => {
      const r = evaluateSeverityBudget(findings({ high: 4 }), { maxHigh: 3 });
      expect(r.passed).toBe(false);
      expect(r.violations).toEqual(['assert.maxHigh: 4 high findings, budget 3']);
    });

    it('supports a zero budget', () => {
      const r = evaluateSeverityBudget(findings({ critical: 1 }), { maxCritical: 0 });
      expect(r.passed).toBe(false);
      expect(r.violations[0]).toContain('1 critical finding,');
    });

    it('counts only the severity each key names', () => {
      const r = evaluateSeverityBudget(findings({ critical: 5, high: 1 }), { maxHigh: 3 });
      expect(r.passed).toBe(true);
    });

    it('covers every severity', () => {
      const r = evaluateSeverityBudget(
        findings({ critical: 1, high: 1, medium: 1, low: 1, info: 1 }),
        { maxCritical: 0, maxHigh: 0, maxMedium: 0, maxLow: 0, maxInfo: 0 },
      );
      expect(r.violations).toHaveLength(5);
    });

    it('reports violations in severity order', () => {
      const r = evaluateSeverityBudget(findings({ medium: 2, critical: 2 }), {
        maxCritical: 0,
        maxMedium: 0,
      });
      expect(r.violations[0]).toContain('maxCritical');
      expect(r.violations[1]).toContain('maxMedium');
    });
  });

  describe('maxTotal', () => {
    it('counts every finding regardless of severity', () => {
      const r = evaluateSeverityBudget(findings({ low: 10, info: 11 }), { maxTotal: 20 });
      expect(r.passed).toBe(false);
      expect(r.violations).toEqual(['assert.maxTotal: 21 findings, budget 20']);
    });

    it('passes exactly at the budget', () => {
      expect(evaluateSeverityBudget(findings({ low: 20 }), { maxTotal: 20 }).passed).toBe(true);
    });

    it('reports alongside a per-severity violation', () => {
      const r = evaluateSeverityBudget(findings({ critical: 2 }), { maxCritical: 1, maxTotal: 1 });
      expect(r.violations).toHaveLength(2);
    });

    it('uses the singular for one finding', () => {
      const r = evaluateSeverityBudget(findings({ low: 1 }), { maxTotal: 0 });
      expect(r.violations[0]).toBe('assert.maxTotal: 1 finding, budget 0');
    });
  });

  describe('printBudgetViolations', () => {
    afterEach(() => vi.restoreAllMocks());

    it('prints one stderr line per violation and reports a failure', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failed = printBudgetViolations(
        evaluateSeverityBudget(findings({ critical: 1, high: 2 }), { maxCritical: 0, maxHigh: 1 }),
      );
      expect(failed).toBe(true);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[0]?.[0]).toContain('Budget exceeded: assert.maxCritical');
    });

    it('prints nothing and reports no failure when the budget holds', () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(printBudgetViolations(evaluateSeverityBudget(findings({ high: 1 }), undefined))).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });
  });
});

describe('the assert config schema', () => {
  it('accepts an absent block, leaving config.assert undefined', async () => {
    const { sniffConfigSchema } = await import('../config/schema.js');
    expect(sniffConfigSchema.parse({}).assert).toBeUndefined();
  });

  it('accepts the documented keys', async () => {
    const { sniffConfigSchema } = await import('../config/schema.js');
    const parsed = sniffConfigSchema.parse({ assert: { maxCritical: 0, maxHigh: 3, maxTotal: 20 } });
    expect(parsed.assert).toEqual({ maxCritical: 0, maxHigh: 3, maxTotal: 20 });
  });

  it('rejects a negative or fractional budget', async () => {
    const { sniffConfigSchema } = await import('../config/schema.js');
    expect(() => sniffConfigSchema.parse({ assert: { maxHigh: -1 } })).toThrow();
    expect(() => sniffConfigSchema.parse({ assert: { maxHigh: 1.5 } })).toThrow();
  });
});
