import type { SourceRule } from './index.js';

export const importRules: SourceRule[] = [
  {
    id: 'broken-import',
    severity: 'medium',
    description: 'Potentially broken relative import',
    pattern: /from\s+['"]\.\.?\//,
    include: ['**/*.{ts,tsx,js,jsx}'],
  },
];
