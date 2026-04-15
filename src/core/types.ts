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
