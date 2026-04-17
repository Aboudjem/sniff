import type { DiscoveryReport } from '../run-types.js';

export function generateDiscoveryJsonReport(report: DiscoveryReport): string {
  return JSON.stringify(report, null, 2);
}
