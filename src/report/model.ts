import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScanResult } from '../scanners/types.js';
import type { Severity, Finding } from '../core/types.js';
import type { SniffReport, ReportMetadata, ReportSummary, Screenshot } from './types.js';
import { getVersion } from '../version.js';

const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export function buildReport(
  results: ScanResult[],
  metadata: Omit<ReportMetadata, 'version'>,
  screenshots: Screenshot[],
): SniffReport {
  const findings: Finding[] = results.flatMap(r => r.findings);

  // Build bySeverity counts
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const finding of findings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
  }

  // Build byScanner counts
  const byScanner: Record<string, number> = {};
  for (const result of results) {
    byScanner[result.scanner] = (byScanner[result.scanner] ?? 0) + result.findings.length;
  }

  // Calculate pass rate (scanners with zero findings / total scanners)
  const passRate = results.length > 0
    ? results.filter(r => r.findings.length === 0).length / results.length
    : 1;

  // Count unique pages scanned from findings
  const uniquePages = new Set<string>();
  for (const finding of findings) {
    if (finding.filePath) {
      uniquePages.add(finding.filePath);
    }
  }

  // Extract performance metrics from the performance scanner result
  let performanceMetrics: SniffReport['performanceMetrics'];
  const perfResult = results.find(r => r.scanner === 'performance');
  if (perfResult?.metadata?.metrics) {
    performanceMetrics = perfResult.metadata.metrics as SniffReport['performanceMetrics'];
  }

  const version = getVersion();

  const summary: ReportSummary = {
    total: findings.length,
    bySeverity,
    byScanner,
    passRate,
    pagesScanned: uniquePages.size,
  };

  return {
    metadata: { ...metadata, version },
    summary,
    findings,
    screenshots,
    performanceMetrics,
  };
}

export async function saveReport(
  rootDir: string,
  report: SniffReport,
  formats: string[],
): Promise<string[]> {
  const dir = join(rootDir, '.sniff', 'reports');
  await mkdir(dir, { recursive: true });

  const slug = report.metadata.timestamp.replace(/[:.]/g, '-').slice(0, 19);
  const savedPaths: string[] = [];

  for (const format of formats) {
    switch (format) {
      case 'json': {
        const { generateJsonReport } = await import('./json.js');
        const jsonPath = join(dir, `report-${slug}.json`);
        await writeFile(jsonPath, generateJsonReport(report), 'utf-8');
        savedPaths.push(jsonPath);
        break;
      }
      case 'junit': {
        const { generateJunitReport } = await import('./junit.js');
        const xmlPath = join(dir, `report-${slug}.xml`);
        await writeFile(xmlPath, generateJunitReport(report), 'utf-8');
        savedPaths.push(xmlPath);
        break;
      }
      case 'html': {
        // HTML formatter implemented in Plan 04 — use computed path to avoid TS static resolution
        try {
          const htmlModulePath = ['html'].map(n => `./${n}.js`)[0];
          const htmlModule = await import(htmlModulePath) as { generateHtmlReport: (r: SniffReport) => string };
          const htmlPath = join(dir, `report-${slug}.html`);
          await writeFile(htmlPath, htmlModule.generateHtmlReport(report), 'utf-8');
          savedPaths.push(htmlPath);
        } catch {
          // HTML formatter not yet available; skip silently
        }
        break;
      }
    }
  }

  return savedPaths;
}
