import type { Page } from 'playwright';
import type { BrowserFinding, Severity } from '../../core/types.js';
import type { ValidationOutcome } from '../run-types.js';

export interface AxeViolationNode {
  html: string;
  failureSummary?: string;
  target?: string[];
  any?: Array<{ id: string; data?: Record<string, unknown> }>;
}

export interface AxeViolation {
  id: string;
  impact?: 'critical' | 'serious' | 'moderate' | 'minor' | null;
  help: string;
  description: string;
  helpUrl: string;
  nodes: AxeViolationNode[];
}

export interface AxeRunResult {
  violations: AxeViolation[];
}

export interface ScopedA11yOptions {
  selector: string | null;
  includeRules?: string[];
  viewportName: string;
  url: string;
}

export type AxeRunner = (page: Page, opts: ScopedA11yOptions) => Promise<AxeRunResult>;

const CONTRAST_RULES = new Set(['color-contrast', 'color-contrast-enhanced']);
const LABEL_RULES = new Set([
  'label',
  'label-title-only',
  'form-field-multiple-labels',
  'aria-required-attr',
  'button-name',
  'link-name',
  'input-button-name',
  'select-name',
]);

function mapImpact(impact: AxeViolation['impact']): Severity {
  switch (impact) {
    case 'critical': return 'critical';
    case 'serious':  return 'high';
    case 'moderate': return 'medium';
    case 'minor':    return 'low';
    default:         return 'medium';
  }
}

export const defaultAxeRunner: AxeRunner = async (page, opts) => {
  const { AxeBuilder } = await import('@axe-core/playwright');
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']);
  if (opts.selector) {
    builder = builder.include(opts.selector);
  }
  if (opts.includeRules && opts.includeRules.length > 0) {
    builder = builder.withRules(opts.includeRules);
  }
  const results = await builder.analyze();
  return { violations: results.violations as AxeViolation[] };
};

function buildFinding(
  violation: AxeViolation,
  node: AxeViolationNode,
  opts: ScopedA11yOptions,
): BrowserFinding {
  const contrastNode = node.any?.find((c) => c.id === 'color-contrast');
  let fixSuggestion: string | undefined;
  if (contrastNode?.data) {
    const expected = contrastNode.data['expected'] as string | undefined;
    const actual = contrastNode.data['contrastRatio'] as number | undefined;
    if (expected && actual !== undefined) {
      fixSuggestion = `Expected contrast ratio of at least ${expected}:1, actual ${actual}:1. Increase foreground/background difference.`;
    }
  }
  if (!fixSuggestion && node.failureSummary) {
    fixSuggestion = node.failureSummary;
  }
  if (!fixSuggestion) {
    fixSuggestion = `See ${violation.helpUrl} for remediation.`;
  }

  return {
    ruleId: `a11y/${violation.id}`,
    severity: mapImpact(violation.impact),
    message: `${violation.help}. ${violation.description}`,
    filePath: opts.url,
    line: 0,
    column: 0,
    snippet: node.html,
    url: opts.url,
    viewport: opts.viewportName,
    fixSuggestion,
  };
}

function filterViolations(
  violations: AxeViolation[],
  wanted: Set<string>,
): AxeViolation[] {
  return violations.filter((v) => wanted.has(v.id));
}

async function runScopedAxe(
  page: Page,
  opts: ScopedA11yOptions,
  filter: Set<string>,
  axeRunner: AxeRunner,
): Promise<{ violations: AxeViolation[]; allCount: number }> {
  const result = await axeRunner(page, opts);
  return { violations: filterViolations(result.violations, filter), allCount: result.violations.length };
}

export async function validateContrast(
  page: Page,
  resolvedSelector: string | null,
  viewportName: string,
  axeRunner: AxeRunner = defaultAxeRunner,
): Promise<ValidationOutcome> {
  const opts: ScopedA11yOptions = {
    selector: resolvedSelector,
    includeRules: ['color-contrast'],
    viewportName,
    url: page.url(),
  };
  const { violations } = await runScopedAxe(page, opts, CONTRAST_RULES, axeRunner);
  const findings = violations.flatMap((v) => v.nodes.map((n) => buildFinding(v, n, opts)));
  const passed = findings.length === 0;
  return {
    kind: 'contrast-wcag-aa',
    name: 'target meets WCAG AA contrast',
    passed,
    ...(passed ? {} : { detail: `${findings.length} contrast violation(s) in region ${resolvedSelector ?? 'page'}` }),
    findings,
  };
}

export async function validateScopedLabels(
  page: Page,
  resolvedSelector: string | null,
  viewportName: string,
  axeRunner: AxeRunner = defaultAxeRunner,
): Promise<ValidationOutcome> {
  const opts: ScopedA11yOptions = {
    selector: resolvedSelector,
    viewportName,
    url: page.url(),
  };
  const { violations } = await runScopedAxe(page, opts, LABEL_RULES, axeRunner);
  const findings = violations.flatMap((v) => v.nodes.map((n) => buildFinding(v, n, opts)));
  const passed = findings.length === 0;
  return {
    kind: 'label-present',
    name: 'interactive target has an accessible name',
    passed,
    ...(passed ? {} : { detail: `${findings.length} label violation(s) in region ${resolvedSelector ?? 'page'}` }),
    findings,
  };
}

export async function validateFullPageAxe(
  page: Page,
  viewportName: string,
  axeRunner: AxeRunner = defaultAxeRunner,
): Promise<ValidationOutcome> {
  const opts: ScopedA11yOptions = {
    selector: null,
    viewportName,
    url: page.url(),
  };
  const result = await axeRunner(page, opts);
  const findings = result.violations.flatMap((v) => v.nodes.map((n) => buildFinding(v, n, opts)));
  const passed = findings.length === 0;
  return {
    kind: 'full-page-axe',
    name: 'full-page accessibility audit',
    passed,
    ...(passed ? {} : { detail: `${findings.length} violation(s) on ${page.url()}` }),
    findings,
  };
}
