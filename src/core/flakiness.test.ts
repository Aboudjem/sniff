import { describe, it, expect } from 'vitest';
import { computeFlakeStatus, buildTestId, buildTestRunRecords } from './flakiness.js';
import type { FlakinessHistory, Finding, BrowserFinding, TestRunRecord } from './types.js';
import type { ScanResult } from '../scanners/types.js';

function makeHistory(runs: TestRunRecord[]): FlakinessHistory {
  return { version: 1, runs, flaky: [] };
}

function makeRun(testId: string, passed: boolean, index = 0): TestRunRecord {
  return {
    runId: `run-${index}`,
    timestamp: new Date().toISOString(),
    testId,
    passed,
    duration: 100,
  };
}

describe('computeFlakeStatus', () => {
  it('returns not flaky when all 5 runs pass', () => {
    const runs = Array.from({ length: 5 }, (_, i) => makeRun('test-1', true, i));
    const result = computeFlakeStatus(makeHistory(runs), 'test-1');
    expect(result.isFlaky).toBe(false);
    expect(result.failureCount).toBe(0);
    expect(result.runCount).toBe(5);
  });

  it('returns flaky when 3 of 5 runs fail (threshold met)', () => {
    const runs = [
      makeRun('test-1', false, 0),
      makeRun('test-1', true, 1),
      makeRun('test-1', false, 2),
      makeRun('test-1', true, 3),
      makeRun('test-1', false, 4),
    ];
    const result = computeFlakeStatus(makeHistory(runs), 'test-1');
    expect(result.isFlaky).toBe(true);
    expect(result.failureCount).toBe(3);
    expect(result.runCount).toBe(5);
  });

  it('returns not flaky when 2 of 5 runs fail (below threshold)', () => {
    const runs = [
      makeRun('test-1', false, 0),
      makeRun('test-1', true, 1),
      makeRun('test-1', false, 2),
      makeRun('test-1', true, 3),
      makeRun('test-1', true, 4),
    ];
    const result = computeFlakeStatus(makeHistory(runs), 'test-1');
    expect(result.isFlaky).toBe(false);
    expect(result.failureCount).toBe(2);
    expect(result.runCount).toBe(5);
  });

  it('returns not flaky when fewer than windowSize records exist', () => {
    const runs = Array.from({ length: 3 }, (_, i) => makeRun('test-1', false, i));
    const result = computeFlakeStatus(makeHistory(runs), 'test-1');
    expect(result.isFlaky).toBe(false);
    expect(result.runCount).toBe(3);
  });

  it('respects custom windowSize and threshold', () => {
    const runs = [
      makeRun('test-1', false, 0),
      makeRun('test-1', true, 1),
      makeRun('test-1', false, 2),
    ];
    const result = computeFlakeStatus(makeHistory(runs), 'test-1', 3, 2);
    expect(result.isFlaky).toBe(true);
    expect(result.failureCount).toBe(2);
    expect(result.runCount).toBe(3);
  });

  it('returns not flaky for empty history', () => {
    const result = computeFlakeStatus(makeHistory([]), 'test-1');
    expect(result.isFlaky).toBe(false);
    expect(result.failureCount).toBe(0);
    expect(result.runCount).toBe(0);
  });
});

describe('buildTestId', () => {
  it('uses filePath for source findings (no url property)', () => {
    const finding: Finding = {
      ruleId: 'no-console',
      severity: 'low',
      message: 'Unexpected console statement',
      filePath: 'src/app.ts',
      line: 10,
      column: 1,
      snippet: 'console.log("hello")',
    };
    expect(buildTestId('source', finding)).toBe('source::no-console::src/app.ts');
  });

  it('uses url for browser findings', () => {
    const finding: BrowserFinding = {
      ruleId: 'color-contrast',
      severity: 'high',
      message: 'Insufficient contrast ratio',
      filePath: '',
      line: 0,
      column: 0,
      snippet: '',
      url: 'http://localhost:3000/about',
      viewport: 'desktop',
    };
    expect(buildTestId('accessibility', finding)).toBe(
      'accessibility::color-contrast::http://localhost:3000/about',
    );
  });
});

describe('buildTestRunRecords', () => {
  it('converts ScanResult[] into TestRunRecord[] with passed=false', () => {
    const results: ScanResult[] = [
      {
        scanner: 'source',
        duration: 200,
        findings: [
          {
            ruleId: 'no-console',
            severity: 'low',
            message: 'console.log found',
            filePath: 'src/app.ts',
            line: 10,
            column: 1,
            snippet: 'console.log("hi")',
          },
        ],
      },
      {
        scanner: 'accessibility',
        duration: 500,
        findings: [
          {
            ruleId: 'color-contrast',
            severity: 'high',
            message: 'Low contrast',
            filePath: '',
            line: 0,
            column: 0,
            snippet: '',
            url: 'http://localhost:3000/',
            viewport: 'desktop',
          } as BrowserFinding,
        ],
      },
    ];

    const records = buildTestRunRecords(results, 'run-1');
    expect(records).toHaveLength(2);

    expect(records[0].testId).toBe('source::no-console::src/app.ts');
    expect(records[0].passed).toBe(false);
    expect(records[0].runId).toBe('run-1');
    expect(records[0].duration).toBe(200);

    expect(records[1].testId).toBe('accessibility::color-contrast::http://localhost:3000/');
    expect(records[1].passed).toBe(false);
    expect(records[1].viewport).toBe('desktop');
  });

  it('returns empty array for results with no findings', () => {
    const results: ScanResult[] = [
      { scanner: 'source', duration: 100, findings: [] },
    ];
    expect(buildTestRunRecords(results, 'run-1')).toEqual([]);
  });
});
