import { describe, it, expect } from 'vitest';
import { decideCrawlExit } from './crawl-command.js';
import type { QaFinding } from '../../crawl/types.js';
import type { Severity, Confidence } from '../../crawl/types.js';

function finding(severity: Severity, confidence: Confidence = 'confirmed'): QaFinding {
  return {
    ruleId: 'test/rule',
    issueClass: 1,
    title: 'test',
    severity,
    confidence,
    suggestedFix: 'fix it',
    reproduction: { url: 'http://localhost/', route: '/', steps: ['open /'] },
  };
}

describe('decideCrawlExit', () => {
  describe('without an assert block', () => {
    it('behaves exactly as before: exit 0 on no matching severity', () => {
      const d = decideCrawlExit({ findings: [finding('low')] });
      expect(d.exitCode).toBe(0);
      expect(d.violations).toEqual([]);
    });

    it('exits 1 on a finding at a failOn severity', () => {
      expect(decideCrawlExit({ findings: [finding('critical')] }).exitCode).toBe(1);
    });

    it('honours a custom failOn list', () => {
      expect(decideCrawlExit({ findings: [finding('medium')], failOn: 'medium' }).exitCode).toBe(1);
      expect(decideCrawlExit({ findings: [finding('medium')], failOn: 'none' }).exitCode).toBe(0);
    });
  });

  describe('the uncertain filter', () => {
    it('hides uncertain findings from both gates by default', () => {
      const d = decideCrawlExit({
        findings: [finding('critical', 'uncertain')],
        assert: { maxTotal: 0 },
      });
      expect(d.shown).toHaveLength(0);
      expect(d.exitCode).toBe(0);
      expect(d.violations).toEqual([]);
    });

    it('counts them once --all is passed', () => {
      const d = decideCrawlExit({
        findings: [finding('critical', 'uncertain')],
        all: true,
        assert: { maxTotal: 0 },
      });
      expect(d.shown).toHaveLength(1);
      expect(d.exitCode).toBe(1);
    });
  });

  describe('with an assert block', () => {
    it('fails a run that failOn alone would have passed', () => {
      const d = decideCrawlExit({
        findings: [finding('medium'), finding('medium'), finding('medium')],
        assert: { maxMedium: 2 },
      });
      expect(d.exitCode).toBe(1);
      expect(d.violations).toEqual(['assert.maxMedium: 3 medium findings, budget 2']);
    });

    it('cannot rescue a run that failOn already failed', () => {
      const d = decideCrawlExit({
        findings: [finding('critical')],
        assert: { maxCritical: 5, maxTotal: 100 },
      });
      expect(d.exitCode).toBe(1);
      expect(d.violations).toEqual([]);
    });

    it('passes when the budget holds', () => {
      const d = decideCrawlExit({
        findings: [finding('low'), finding('low')],
        assert: { maxLow: 2, maxTotal: 5 },
      });
      expect(d.exitCode).toBe(0);
    });
  });
});
