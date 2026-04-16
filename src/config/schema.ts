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

export const browserConfigSchema = z.object({
  headless: z.boolean().default(true),
  slowMo: z.number().default(0),
  timeout: z.number().default(30000),
  baseUrl: z.string().optional(),
});

export const viewportConfigSchema = z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

export const accessibilityConfigSchema = z.object({
  enabled: z.boolean().default(true),
  standard: z.enum(['wcag2a', 'wcag2aa', 'wcag21aa']).default('wcag21aa'),
  rules: z.record(z.string(), z.boolean()).default({}),
});

export const visualConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baselineDir: z.string().default('sniff-baselines'),
  threshold: z.number().default(0.1),
  includeAA: z.boolean().default(false),
});

export const performanceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  budgets: z.object({
    lcp: z.number().default(2500),
    fcp: z.number().default(1800),
    tti: z.number().default(3800),
  }).optional(),
});

export const reportConfigSchema = z.object({
  outputDir: z.string().default('sniff-reports'),
  formats: z.array(z.enum(['html', 'json', 'junit'])).default(['html', 'json']),
  openAfter: z.boolean().default(false),
});

export const explorationConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxSteps: z.number().default(50),
  timeout: z.number().default(30000),
  viewport: viewportConfigSchema.default({ name: 'desktop', width: 1280, height: 720 }),
});

export const apiEndpointsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  checkErrorHandling: z.boolean().default(true),
  checkValidation: z.boolean().default(true),
  checkAuth: z.boolean().default(true),
  checkSecrets: z.boolean().default(true),
  frameworks: z.array(z.string()).default([]),
});

export const deadLinksConfigSchema = z.object({
  enabled: z.boolean().default(true),
  checkExternal: z.boolean().default(true),
  timeout: z.number().default(5000),
  retries: z.number().default(2),
  ignorePatterns: z.array(z.string()).default([]),
  followRedirects: z.boolean().default(true),
  maxConcurrent: z.number().default(10),
});

export const flakinessConfigSchema = z.object({
  enabled: z.boolean().default(false),
  windowSize: z.number().default(5),
  threshold: z.number().default(3),
  historyPath: z.string().default('.sniff/history.json'),
});

export const sniffConfigSchema = z.object({
  failOn: z.array(severitySchema).default(['critical', 'high']),
  exclude: z.array(z.string()).default(DEFAULT_EXCLUDE),
  include: z.array(z.string()).default(['**/*.{ts,tsx,js,jsx,html,css}']),
  rules: z.record(z.string(), ruleConfigSchema).default({}),
  scanners: z.array(z.string()).default(['source', 'repo-analyzer']),
  analyzer: analyzerConfigSchema.optional(),
  ai: aiConfigSchema.optional(),
  browser: browserConfigSchema.optional(),
  viewports: z.array(viewportConfigSchema).default([
    { name: 'desktop', width: 1280, height: 720 },
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
  ]),
  accessibility: accessibilityConfigSchema.optional(),
  visual: visualConfigSchema.optional(),
  performance: performanceConfigSchema.optional(),
  report: reportConfigSchema.optional(),
  apiEndpoints: apiEndpointsConfigSchema.optional(),
  deadLinks: deadLinksConfigSchema.optional(),
  flakiness: flakinessConfigSchema.optional(),
  exploration: explorationConfigSchema.optional(),
});

export type SniffConfig = z.output<typeof sniffConfigSchema>;
export type SniffUserConfig = z.input<typeof sniffConfigSchema>;
export type AnalyzerConfig = z.output<typeof analyzerConfigSchema>;
export type AIConfig = z.output<typeof aiConfigSchema>;
export type BrowserConfig = z.output<typeof browserConfigSchema>;
export type ViewportConfigSchema = z.output<typeof viewportConfigSchema>;
export type AccessibilityConfig = z.output<typeof accessibilityConfigSchema>;
export type VisualConfig = z.output<typeof visualConfigSchema>;
export type PerformanceConfig = z.output<typeof performanceConfigSchema>;
export type ReportConfig = z.output<typeof reportConfigSchema>;
export type ApiEndpointsConfig = z.output<typeof apiEndpointsConfigSchema>;
export type DeadLinksConfig = z.output<typeof deadLinksConfigSchema>;
export type FlakinessConfig = z.output<typeof flakinessConfigSchema>;
export type ExplorationConfig = z.output<typeof explorationConfigSchema>;
