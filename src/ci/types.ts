export interface CIWorkflowOptions {
  packageName: string;
  nodeVersion: string;
  branches: string[];
  timeoutMinutes: number;
  retentionDays: number;
  packageManager: 'npm' | 'pnpm' | 'yarn';
}
