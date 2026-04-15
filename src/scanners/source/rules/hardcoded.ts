import type { SourceRule } from './index.js';

export const hardcodedRules: SourceRule[] = [
  {
    id: 'hardcoded-localhost',
    severity: 'medium',
    description: 'Hardcoded localhost URL detected',
    pattern: /https?:\/\/localhost[:/]/,
    include: ['**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/*.test.*', '**/*.spec.*', '**/*.config.*'],
  },
  {
    id: 'hardcoded-127',
    severity: 'medium',
    description: 'Hardcoded 127.0.0.1 URL detected',
    pattern: /https?:\/\/127\.0\.0\.1[:/]/,
    include: ['**/*.{ts,tsx,js,jsx}'],
    exclude: ['**/*.test.*', '**/*.spec.*', '**/*.config.*'],
  },
];
