import type { BrowserFinding } from '../core/types.js';
import type { AppTypeGuess } from './classifier/types.js';
import type { Scenario, StepValidationKind } from './scenarios/types.js';

export type ScenarioStatus = 'pass' | 'fail' | 'skip';

export interface ValidationOutcome {
  kind: StepValidationKind | 'expect';
  name: string;
  passed: boolean;
  detail?: string;
  findings?: BrowserFinding[];
}

export interface StepRecord {
  n: number;
  intent: string;
  action: string;
  resolvedSelector?: string;
  urlBefore: string;
  urlAfter: string;
  durationMs: number;
  observation: {
    consoleErrors: number;
    networkFailures: number;
    responseTimeMs?: number;
    screenshotPath?: string;
  };
  validations: ValidationOutcome[];
  status: ScenarioStatus;
  failureReason?: string;
}

export interface ScenarioResult {
  scenario: Scenario;
  status: ScenarioStatus;
  steps: StepRecord[];
  findings: BrowserFinding[];
  durationMs: number;
  seed: number;
  skippedReason?: string;
  quarantined?: boolean;
  quarantineReason?: string;
}

export interface DiscoveryReportStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  quarantined: number;
  durationMs: number;
}

export interface DiscoveryReport {
  appTypeGuesses: AppTypeGuess[];
  scenarios: ScenarioResult[];
  stats: DiscoveryReportStats;
  runAt: string;
}

export interface DiscoveryRunContext {
  baseUrl: string;
  rootDir: string;
  headless: boolean;
  viewport: { width: number; height: number };
  stepTimeoutMs: number;
  scenarioTimeoutMs: number;
  reportDir: string;
  seed?: number;
}
