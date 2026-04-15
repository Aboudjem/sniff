export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
}

export interface BrowserFinding extends Finding {
  url: string;
  viewport: string;
  screenshotPath?: string;
  fixSuggestion?: string;
}

export interface TestRunRecord {
  runId: string;
  timestamp: string;
  testId: string; // stable: "${scanner}::${ruleId}::${url|filePath}"
  passed: boolean;
  duration: number;
  viewport?: string;
}

export interface FlakinessHistory {
  version: 1;
  runs: TestRunRecord[];
  flaky: string[]; // testIds currently above quarantine threshold
}
