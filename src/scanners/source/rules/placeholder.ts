import type { SourceRule } from './index.js';

export const placeholderRules: SourceRule[] = [
  {
    id: 'placeholder-lorem',
    severity: 'high',
    description: 'Lorem ipsum placeholder text detected',
    pattern: /lorem\s+ipsum/i,
    include: ['**/*.{ts,tsx,js,jsx,html,css}'],
  },
  {
    id: 'placeholder-todo',
    severity: 'medium',
    description: 'TODO comment found',
    pattern: /\bTODO\b/,
    include: ['**/*.{ts,tsx,js,jsx}'],
  },
  {
    id: 'placeholder-fixme',
    severity: 'high',
    description: 'FIXME comment found',
    pattern: /\bFIXME\b/,
    include: ['**/*.{ts,tsx,js,jsx}'],
  },
  {
    id: 'placeholder-tbd',
    severity: 'medium',
    description: 'TBD placeholder found',
    pattern: /\bTBD\b/,
    include: ['**/*.{ts,tsx,js,jsx}'],
  },
];
