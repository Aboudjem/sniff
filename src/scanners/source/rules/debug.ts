import type { SourceRule } from './index.js';

export const debugRules: SourceRule[] = [
  {
    id: 'debug-console-log',
    severity: 'medium',
    description: 'Console logging statement detected',
    pattern: /\bconsole\.(log|debug|info)\b/,
    include: ['**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/*.test.*', '**/*.spec.*'],
  },
  {
    id: 'debug-debugger',
    severity: 'high',
    description: 'Debugger statement detected',
    pattern: /\bdebugger\b/,
    include: ['**/*.{ts,tsx,js,jsx}'],
  },
];
