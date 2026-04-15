import type { SniffConfig } from '../config/schema.js';
import type { Finding } from '../core/types.js';

export interface ScanContext {
  config: SniffConfig;
  rootDir: string;
}

export interface ScanResult {
  scanner: string;
  findings: Finding[];
  duration: number;
  metadata?: Record<string, unknown>;
}

export interface Scanner {
  name: string;
  setup?(ctx: ScanContext): Promise<void>;
  scan(ctx: ScanContext): Promise<ScanResult>;
  teardown?(): Promise<void>;
}
