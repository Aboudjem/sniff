import type { Finding, Severity } from '../core/types.js';

export interface Screenshot {
  path: string;
  url: string;
  viewport: string;
  caption: string;
  base64?: string;
}

export interface ReportMetadata {
  version: string;
  timestamp: string;
  duration: number;
  targetUrl: string;
  viewports: Array<{ name: string; width: number; height: number }>;
  commandUsed: string;
}

export interface ReportSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byScanner: Record<string, number>;
  passRate: number;
  pagesScanned: number;
}

export interface SniffReport {
  metadata: ReportMetadata;
  summary: ReportSummary;
  findings: Finding[];
  screenshots: Screenshot[];
  performanceMetrics?: Record<string, {
    lcp: number | null;
    fcp: number | null;
    tti: number | null;
    score: number | null;
  }>;
}
