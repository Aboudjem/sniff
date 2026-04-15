import type { BrowserFinding } from '../core/types.js';
import type { ScanResult } from '../scanners/types.js';

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export interface BrowserRunContext {
  baseUrl: string;
  testFiles: string[];
  viewports: ViewportConfig[];
  headless: boolean;
  slowMo: number;
  timeout: number;
}

export interface PageVisitResult {
  url: string;
  viewport: string;
  findings: BrowserFinding[];
  screenshotPath?: string;
  duration: number;
}

export interface BrowserRunResult {
  scanResults: ScanResult[];
  pageVisits: PageVisitResult[];
  duration: number;
  urls: string[];
}
