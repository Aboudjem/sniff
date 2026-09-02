import { describe, it, expect } from 'vitest';
import { productionUrlWarning } from './discover.js';

describe('discoverCommand helpers', () => {
  describe('productionUrlWarning', () => {
    it('is a no-op in json mode', async () => {
      const start = Date.now();
      await productionUrlWarning('https://example.com', { json: true, delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op in non-interactive mode', async () => {
      const start = Date.now();
      await productionUrlWarning('https://example.com', { nonInteractive: true, delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op for localhost', async () => {
      const start = Date.now();
      await productionUrlWarning('http://localhost:3000', { delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op for 127.0.0.1', async () => {
      const start = Date.now();
      await productionUrlWarning('http://127.0.0.1:5173', { delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op for private network IPs', async () => {
      const start = Date.now();
      await productionUrlWarning('http://192.168.1.20:3000', { delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('waits when the URL looks like production', async () => {
      const start = Date.now();
      await productionUrlWarning('https://example.com', { delayMs: 150 });
      expect(Date.now() - start).toBeGreaterThanOrEqual(120);
    });
  });
});

describe('budgetFindingsFor', () => {
  function scenario(opts: { quarantined?: boolean; severities: string[] }) {
    return {
      scenario: { id: 's', appType: 'saas', intent: 'x', steps: [] },
      status: 'fail',
      steps: [],
      findings: opts.severities.map((severity) => ({
        ruleId: 'r',
        severity,
        message: 'm',
        filePath: 'u',
        line: 0,
        column: 0,
        snippet: '',
        url: 'http://localhost/',
        viewport: 'desktop',
        browser: 'chromium',
      })),
      durationMs: 1,
      seed: 1,
      ...(opts.quarantined ? { quarantined: true } : {}),
    };
  }

  function report(scenarios: unknown[]) {
    return {
      appTypeGuesses: [],
      scenarios,
      stats: { total: scenarios.length, passed: 0, failed: 0, skipped: 0, quarantined: 0, durationMs: 0 },
      runAt: '2026-09-02T00:00:00.000Z',
    } as never;
  }

  it('flattens findings across scenarios', async () => {
    const { budgetFindingsFor } = await import('./discover.js');
    const out = budgetFindingsFor(report([
      scenario({ severities: ['critical'] }),
      scenario({ severities: ['high', 'low'] }),
    ]));
    expect(out).toHaveLength(3);
  });

  it('excludes quarantined scenarios, so a budget cannot re-block an excused failure', async () => {
    const { budgetFindingsFor } = await import('./discover.js');
    const out = budgetFindingsFor(report([
      scenario({ severities: ['critical'], quarantined: true }),
      scenario({ severities: ['low'] }),
    ]));
    expect(out).toHaveLength(1);
    expect(out[0]?.severity).toBe('low');
  });

  it('returns nothing for a run with no scenarios', async () => {
    const { budgetFindingsFor } = await import('./discover.js');
    expect(budgetFindingsFor(report([]))).toEqual([]);
  });

  it('feeds the shared evaluator, which fails when the budget is exceeded', async () => {
    const { budgetFindingsFor } = await import('./discover.js');
    const { evaluateSeverityBudget } = await import('../../core/assert-budget.js');
    const findings = budgetFindingsFor(report([
      scenario({ severities: ['high', 'high'] }),
      scenario({ severities: ['high'], quarantined: true }),
    ]));
    expect(evaluateSeverityBudget(findings, { maxHigh: 1 }).passed).toBe(false);
    expect(evaluateSeverityBudget(findings, { maxHigh: 2 }).passed).toBe(true);
  });
});
