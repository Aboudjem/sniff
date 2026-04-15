import { z } from 'zod';
import { DEFAULT_EXCLUDE } from './defaults.js';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const ruleConfigSchema = z.union([
  z.literal('off'),
  z.literal(false),
  severitySchema,
]);

export const sniffConfigSchema = z.object({
  failOn: z.array(severitySchema).default(['critical', 'high']),
  exclude: z.array(z.string()).default(DEFAULT_EXCLUDE),
  include: z.array(z.string()).default(['**/*.{ts,tsx,js,jsx,html,css}']),
  rules: z.record(z.string(), ruleConfigSchema).default({}),
  scanners: z.array(z.string()).default(['source']),
});

export type SniffConfig = z.output<typeof sniffConfigSchema>;
export type SniffUserConfig = z.input<typeof sniffConfigSchema>;
