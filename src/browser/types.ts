import type { BrowserFinding } from '../core/types.js';
import type { ScanResult } from '../scanners/types.js';
import type { BrowserProject } from '../config/schema.js';

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
  rootDir: string;
  projects: BrowserProject[];
}

export interface PageVisitResult {
  url: string;
  viewport: string;
  browser: BrowserProject;
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
