import { describe, it, expect } from 'vitest';
import {
  generateDiscoveryJsonReport,
  generateDiscoveryJunitReport,
  generateDiscoveryHtmlReport,
} from './index.js';
import {
  buildScenarioTestId,
  buildScenarioTestRunRecords,
  markQuarantinedScenarios,
  shouldFailCi,
} from './flakiness.js';
import type { DiscoveryReport, ScenarioResult, StepRecord } from '../run-types.js';
import type { Scenario } from '../scenarios/types.js';
import type { FlakinessHistory, TestRunRecord } from '../../core/types.js';

function mkStep(partial: Partial<StepRecord> = {}): StepRecord {
  return {
    n: 1,
    intent: 'Open home',
    action: 'navigate',
    urlBefore: '/',
    urlAfter: '/',
    durationMs: 10,
    observation: { consoleErrors: 0, networkFailures: 0 },
    validations: [{ kind: 'expect', name: 'ok', passed: true }],
    status: 'pass',
    ...partial,
  };
}

function mkScenario(partial: Partial<Scenario> = {}): Scenario {
  return {
    id: 'ecommerce.browse-to-purchase.happy',
    name: 'Browse to purchase',
    appType: 'ecommerce',
    journey: 'browse-to-purchase',
    variant: 'happy',
    persona: 'new-customer',
    realism: 'casual-user',
    steps: [],
    goal: { kind: 'url', value: 'confirmation', description: 'buy a thing' },
    validations: { perStep: [], perScenario: [] },
    tags: ['smoke'],
    generatedFrom: { routes: [], entities: [], forms: [], confidence: 0.7 },
    ...partial,
  };
}

function mkResult(partial: Partial<ScenarioResult> = {}): ScenarioResult {
  return {
    scenario: mkScenario(),
    status: 'pass',
    steps: [mkStep()],
    findings: [],
    durationMs: 500,
    seed: 1,
    ...partial,
  };
}

function mkReport(partial: Partial<DiscoveryReport> = {}): DiscoveryReport {
  return {
    appTypeGuesses: [{ type: 'ecommerce', confidence: 0.8, evidence: [], rawScore: 10 }],
    scenarios: [mkResult()],
    stats: { total: 1, passed: 1, failed: 0, skipped: 0, quarantined: 0, durationMs: 500 },
    runAt: '2026-04-17T10:00:00.000Z',
    ...partial,
  };
}

describe('generateDiscoveryJsonReport', () => {
  it('returns valid JSON', () => {
    const s = generateDiscoveryJsonReport(mkReport());
    expect(() => JSON.parse(s)).not.toThrow();
    const parsed = JSON.parse(s);
    expect(parsed.stats.total).toBe(1);
  });
});

describe('generateDiscoveryJunitReport', () => {
  it('produces testsuites grouped by appType', () => {
    const xml = generateDiscoveryJunitReport(mkReport());
    expect(xml).toMatch(/<testsuites/);
    expect(xml).toMatch(/<testsuite name="ecommerce"/);
    expect(xml).toMatch(/<testcase name="browse-to-purchase \(happy\)"/);
    expect(xml).toMatch(/<system-out>/);
  });

  it('emits <failure> on failing scenarios', () => {
    const failingStep = mkStep({
      status: 'fail',
      failureReason: 'target not found',
      validations: [{ kind: 'expect', name: 'target resolved', passed: false, detail: 'no match' }],
    });
    const report = mkReport({
      scenarios: [mkResult({ status: 'fail', steps: [failingStep] })],
      stats: { total: 1, passed: 0, failed: 1, skipped: 0, quarantined: 0, durationMs: 500 },
    });
    const xml = generateDiscoveryJunitReport(report);
    expect(xml).toMatch(/<failure/);
    expect(xml).toMatch(/target not found/);
  });

  it('emits <skipped> on skipped scenarios', () => {
    const report = mkReport({
      scenarios: [mkResult({ status: 'skip', skippedReason: 'dev server unreachable' })],
      stats: { total: 1, passed: 0, failed: 0, skipped: 1, quarantined: 0, durationMs: 0 },
    });
    const xml = generateDiscoveryJunitReport(report);
    expect(xml).toMatch(/<skipped message="dev server unreachable"/);
  });

  it('escapes XML entities', () => {
    const report = mkReport({
      scenarios: [mkResult({
        scenario: mkScenario({ journey: '<weird> & "quoted"' }),
      })],
    });
    const xml = generateDiscoveryJunitReport(report);
    expect(xml).toContain('&lt;weird&gt;');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
  });
});

describe('generateDiscoveryHtmlReport', () => {
  it('includes top stats and at least one scenario summary', () => {
    const html = generateDiscoveryHtmlReport(mkReport());
    expect(html).toMatch(/<title>Sniff Discovery Report<\/title>/);
    expect(html).toMatch(/browse-to-purchase/);
    expect(html).toMatch(/class="badge pass"/);
  });

  it('opens failing scenarios by default', () => {
    const failingStep = mkStep({ status: 'fail', failureReason: 'boom' });
    const report = mkReport({
      scenarios: [mkResult({ status: 'fail', steps: [failingStep] })],
      stats: { total: 1, passed: 0, failed: 1, skipped: 0, quarantined: 0, durationMs: 500 },
    });
    const html = generateDiscoveryHtmlReport(report);
    expect(html).toMatch(/<details class="scenario fail" open/);
  });

  it('escapes user-provided strings', () => {
    const report = mkReport({
      scenarios: [mkResult({
        scenario: mkScenario({ name: '<img onerror=x>' }),
      })],
    });
    const html = generateDiscoveryHtmlReport(report);
    expect(html).not.toContain('<img onerror=x>');
    expect(html).toContain('&lt;img onerror=x&gt;');
  });

  it('renders an empty-state when no scenarios', () => {
    const html = generateDiscoveryHtmlReport(mkReport({
      scenarios: [],
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, quarantined: 0, durationMs: 0 },
    }));
    expect(html).toContain('No scenarios were produced.');
  });
});

describe('flakiness helpers', () => {
  const baseUrl = 'http://localhost:3000';

  it('builds a stable test id', () => {
    expect(buildScenarioTestId('a.b.c', baseUrl)).toBe(`discovery::a.b.c::${baseUrl}`);
  });

  it('records one run entry per non-skipped scenario', () => {
    const report = mkReport({
      scenarios: [
        mkResult({ status: 'pass' }),
        mkResult({ status: 'fail', scenario: mkScenario({ id: 'x.y.z' }) }),
        mkResult({ status: 'skip', scenario: mkScenario({ id: 's.k.p' }) }),
      ],
    });
    const records = buildScenarioTestRunRecords(report, 'run-1', baseUrl);
    expect(records).toHaveLength(2);
    expect(records[0].passed).toBe(true);
    expect(records[1].passed).toBe(false);
  });

  it('quarantines a scenario failing 3 of 5 recent runs', () => {
    const testId = buildScenarioTestId('a.b.c', baseUrl);
    const runs: TestRunRecord[] = [
      { runId: '1', timestamp: '', testId, passed: false, duration: 10 },
      { runId: '2', timestamp: '', testId, passed: true, duration: 10 },
      { runId: '3', timestamp: '', testId, passed: false, duration: 10 },
      { runId: '4', timestamp: '', testId, passed: true, duration: 10 },
      { runId: '5', timestamp: '', testId, passed: false, duration: 10 },
    ];
    const history: FlakinessHistory = { version: 1, runs, flaky: [] };
    const report = mkReport({
      scenarios: [mkResult({ status: 'fail', scenario: mkScenario({ id: 'a.b.c' }) })],
    });
    const marked = markQuarantinedScenarios(report, history, baseUrl);
    expect(marked.scenarios[0].quarantined).toBe(true);
    expect(marked.scenarios[0].quarantineReason).toMatch(/3\/5/);
    expect(marked.stats.quarantined).toBe(1);
  });

  it('does not quarantine passing scenarios', () => {
    const history: FlakinessHistory = { version: 1, runs: [], flaky: [] };
    const marked = markQuarantinedScenarios(mkReport(), history, baseUrl);
    expect(marked.scenarios[0].quarantined).toBeUndefined();
  });

  it('shouldFailCi returns true for non-quarantined failures', () => {
    const report = mkReport({
      scenarios: [mkResult({ status: 'fail' })],
    });
    expect(shouldFailCi(report)).toBe(true);
  });

  it('shouldFailCi returns false when all failures are quarantined', () => {
    const report = mkReport({
      scenarios: [mkResult({ status: 'fail', quarantined: true })],
    });
    expect(shouldFailCi(report)).toBe(false);
  });
});
