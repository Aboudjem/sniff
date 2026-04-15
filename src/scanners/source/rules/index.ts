import type { Severity } from '../../../core/types.js';
import { placeholderRules } from './placeholder.js';
import { debugRules } from './debug.js';
import { hardcodedRules } from './hardcoded.js';
import { importRules } from './imports.js';

export interface SourceRule {
  id: string;
  severity: Severity;
  description: string;
  pattern: RegExp;
  include?: string[];
  exclude?: string[];
}

export const allRules: SourceRule[] = [
  ...placeholderRules,
  ...debugRules,
  ...hardcodedRules,
  ...importRules,
];
