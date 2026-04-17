import type { FlakinessHistory, TestRunRecord } from '../../core/types.js';
import { computeFlakeStatus } from '../../core/flakiness.js';
import type { DiscoveryReport, ScenarioResult } from '../run-types.js';

export function buildScenarioTestId(scenarioId: string, baseUrl: string): string {
  return `discovery::${scenarioId}::${baseUrl}`;
}

export function buildScenarioTestRunRecords(
  report: DiscoveryReport,
  runId: string,
  baseUrl: string,
): TestRunRecord[] {
  const timestamp = new Date().toISOString();
  const records: TestRunRecord[] = [];

  for (const result of report.scenarios) {
    if (result.status === 'skip') continue;
    records.push({
      runId,
      timestamp,
      testId: buildScenarioTestId(result.scenario.id, baseUrl),
      passed: result.status === 'pass',
      duration: result.durationMs,
    });
  }

  return records;
}

export interface QuarantineOptions {
  windowSize?: number;
  threshold?: number;
}

export function markQuarantinedScenarios(
  report: DiscoveryReport,
  history: FlakinessHistory,
  baseUrl: string,
  options: QuarantineOptions = {},
): DiscoveryReport {
  const windowSize = options.windowSize ?? 5;
  const threshold = options.threshold ?? 3;

  const scenarios: ScenarioResult[] = report.scenarios.map((result) => {
    if (result.status !== 'fail') return result;
    const testId = buildScenarioTestId(result.scenario.id, baseUrl);
    const flake = computeFlakeStatus(history, testId, windowSize, threshold);
    if (!flake.isFlaky) return result;
    return {
      ...result,
      quarantined: true,
      quarantineReason: `quarantined: ${flake.failureCount}/${flake.runCount} recent runs failed`,
    };
  });

  const stats = {
    ...report.stats,
    quarantined: scenarios.filter((s) => s.quarantined === true).length,
  };

  return { ...report, scenarios, stats };
}

export function shouldFailCi(report: DiscoveryReport): boolean {
  return report.scenarios.some((s) => s.status === 'fail' && s.quarantined !== true);
}
