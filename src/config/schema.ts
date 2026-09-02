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

export const aiProviderSchema = z.enum([
  'none',
  'codex-cli',
  'claude-code',
  'anthropic-api',
  'openai-api',
  'gemini-cli',
  'ollama',
]);

export const aiConfigSchema = z.object({
  provider: aiProviderSchema.default('none'),
  model: z.string().optional(),
  command: z.string().optional(),
  baseUrl: z.string().optional(),
  outputDir: z.string().default('sniff-tests'),
  maxConcurrency: z.number().default(5),
});

export const browserProjectSchema = z.enum(['chromium', 'firefox', 'webkit']);

export const browserConfigSchema = z.object({
  projects: z.array(browserProjectSchema).default(['chromium']),
  headless: z.boolean().default(true),
  slowMo: z.number().default(0),
  timeout: z.number().default(30000),
  baseUrl: z.string().optional(),
  /**
   * Path to a Playwright storage-state JSON file, so sniff walks the app as a
   * logged-in user. This is a path, not a credential, but the file it points at
   * holds live session cookies: keep that file out of version control. Values
   * loaded from it are redacted from every written report.
   */
  storageState: z.string().optional(),
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
  scanCode: z.boolean().default(false),
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

/**
 * Assertion budgets, in the spirit of Lighthouse CI's `ci.assert.assertions`:
 * express "no criticals, at most three highs, at most twenty findings" in
 * config rather than trying to squeeze it into `--fail-on`.
 *
 * Purely additive. Every key is optional, an absent block changes nothing, and
 * a breach can only turn a passing run into a failing one.
 */
export const assertConfigSchema = z.object({
  maxCritical: z.number().int().min(0).optional(),
  maxHigh: z.number().int().min(0).optional(),
  maxMedium: z.number().int().min(0).optional(),
  maxLow: z.number().int().min(0).optional(),
  maxInfo: z.number().int().min(0).optional(),
  maxTotal: z.number().int().min(0).optional(),
});

export const sniffConfigSchema = z.object({
  failOn: z.array(severitySchema).default(['critical', 'high']),
  assert: assertConfigSchema.optional(),
  exclude: z.array(z.string()).default(DEFAULT_EXCLUDE),
  include: z.array(z.string()).default(['**/*.{ts,tsx,js,jsx,html,css}']),
  rules: z.record(z.string(), ruleConfigSchema).default({}),
  scanners: z.array(z.string()).default(['source', 'repo-analyzer', 'e2e', 'accessibility', 'visual', 'performance']),
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
export type AssertConfig = z.output<typeof assertConfigSchema>;
export type ExplorationConfig = z.output<typeof explorationConfigSchema>;
export type AIProviderName = z.output<typeof aiProviderSchema>;
export type BrowserProject = z.output<typeof browserProjectSchema>;
