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
