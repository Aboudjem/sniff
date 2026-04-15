import { z } from 'zod';
import { DEFAULT_EXCLUDE } from './defaults.js';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

export const ruleConfigSchema = z.union([
  z.literal('off'),
  z.literal(false),
  severitySchema,
]);

export const analyzerConfigSchema = z.object({
  frameworks: z.array(z.enum(['nextjs', 'react', 'vue', 'svelte'])).optional(),
  routePatterns: z.array(z.string()).optional(),
  elementSelectors: z.array(z.string()).default(['data-testid', 'id', 'name', 'aria-label', 'role']),
});

export const aiConfigSchema = z.object({
  provider: z.enum(['claude-code', 'anthropic-api']).default('claude-code'),
  model: z.string().default('claude-sonnet-4-5-20250514'),
  outputDir: z.string().default('sniff-tests'),
  maxConcurrency: z.number().default(5),
});

export const sniffConfigSchema = z.object({
  failOn: z.array(severitySchema).default(['critical', 'high']),
  exclude: z.array(z.string()).default(DEFAULT_EXCLUDE),
  include: z.array(z.string()).default(['**/*.{ts,tsx,js,jsx,html,css}']),
  rules: z.record(z.string(), ruleConfigSchema).default({}),
  scanners: z.array(z.string()).default(['source', 'repo-analyzer']),
  analyzer: analyzerConfigSchema.optional(),
  ai: aiConfigSchema.optional(),
});

export type SniffConfig = z.output<typeof sniffConfigSchema>;
export type SniffUserConfig = z.input<typeof sniffConfigSchema>;
export type AnalyzerConfig = z.output<typeof analyzerConfigSchema>;
export type AIConfig = z.output<typeof aiConfigSchema>;
