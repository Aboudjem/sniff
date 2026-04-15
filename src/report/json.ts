import type { SniffReport } from './types.js';

export function generateJsonReport(report: SniffReport): string {
  return JSON.stringify(report, null, 2);
}
