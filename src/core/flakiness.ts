import type { Finding, BrowserFinding, FlakinessHistory, TestRunRecord } from './types.js';
import type { ScanResult } from '../scanners/types.js';

/**
 * Build a deterministic test ID from a scanner name and finding.
 * Format: "${scanner}::${ruleId}::${url}" for browser findings,
 *         "${scanner}::${ruleId}::${filePath}" for source findings.
 *
 * Including scanner ensures two different scanners with the same ruleId
 * on the same file do not share a history ID.
 * Does NOT use finding.message (too variable across runs).
 */
export function buildTestId(scanner: string, finding: Finding | BrowserFinding): string {
  const isBrowser = 'url' in finding && typeof (finding as BrowserFinding).url === 'string';
  const location = isBrowser ? (finding as BrowserFinding).url : finding.filePath;
  return `${scanner}::${finding.ruleId}::${location}`;
}

/**
 * Convert scan results into TestRunRecord entries.
 * Each finding becomes a record with passed=false (findings represent failures).
 *
 * Limitation: We have no positive signal for passing tests in the current
 * architecture -- only failures (findings) are recorded. A test that stops
 * appearing in findings is assumed to have passed, but we cannot create
 * explicit pass records without a test manifest.
 */
export function buildTestRunRecords(results: ScanResult[], runId: string): TestRunRecord[] {
  const timestamp = new Date().toISOString();
  const records: TestRunRecord[] = [];

  for (const result of results) {
    for (const finding of result.findings) {
      const testId = buildTestId(result.scanner, finding);
      const isBrowser = 'url' in finding && typeof (finding as BrowserFinding).url === 'string';
      const record: TestRunRecord = {
        runId,
        timestamp,
        testId,
        passed: false,
        duration: result.duration,
      };
      if (isBrowser && 'viewport' in finding) {
        record.viewport = (finding as BrowserFinding).viewport;
      }
      records.push(record);
    }
  }

  return records;
}

/**
 * Compute whether a test is flaky based on its recent history.
 *
 * Defaults: windowSize=5 (look at last 5 runs), threshold=3 (3+ failures = flaky).
 * If fewer than windowSize records exist, returns isFlaky: false (not enough data).
 * This ensures newly-failing tests always block until sufficient history accumulates (T-04-04).
 */
export function computeFlakeStatus(
  history: FlakinessHistory,
  testId: string,
  windowSize = 5,
  threshold = 3,
): { isFlaky: boolean; failureCount: number; runCount: number } {
  const testRuns = history.runs.filter((r) => r.testId === testId);
  const window = testRuns.slice(-windowSize);
  const runCount = window.length;

  if (runCount < windowSize) {
    return { isFlaky: false, failureCount: 0, runCount };
  }

  const failureCount = window.filter((r) => !r.passed).length;
  return {
    isFlaky: failureCount >= threshold,
    failureCount,
    runCount,
  };
}
