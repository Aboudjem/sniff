import { describe, it, expect, vi } from 'vitest';
import type { Page } from 'playwright';
import {
  validateContrast,
  validateFullPageAxe,
  validateScopedLabels,
  type AxeRunner,
  type AxeRunResult,
} from './scoped-a11y.js';

function makeFakePage(url = 'http://localhost:3000/checkout'): Page {
  return { url: () => url } as unknown as Page;
}

function mkAxeResult(overrides: Partial<AxeRunResult> = {}): AxeRunResult {
  return { violations: [], ...overrides };
}

describe('validateContrast', () => {
  it('passes when axe returns no violations', async () => {
    const axe: AxeRunner = vi.fn(async () => mkAxeResult());
    const outcome = await validateContrast(makeFakePage(), '[data-testid="cta"]', 'desktop', axe);
    expect(outcome.passed).toBe(true);
    expect(outcome.findings).toEqual([]);
  });

  it('fails and produces findings when contrast violations exist', async () => {
    const axe: AxeRunner = async () => mkAxeResult({
      violations: [{
        id: 'color-contrast',
        impact: 'serious',
        help: 'Elements must have sufficient color contrast',
        description: 'Ensures the contrast between foreground and background colors meets WCAG 2.1 AA',
        helpUrl: 'https://dequeuniversity.com/rules/axe/color-contrast',
        nodes: [{
          html: '<button>Buy</button>',
          failureSummary: 'Fix contrast between fg and bg',
          any: [{
            id: 'color-contrast',
            data: { contrastRatio: 2.8, expected: '4.5' },
          }],
        }],
      }],
    });
    const outcome = await validateContrast(makeFakePage(), '[data-testid="cta"]', 'desktop', axe);
    expect(outcome.passed).toBe(false);
    expect(outcome.findings).toHaveLength(1);
    const f = outcome.findings![0];
    expect(f.ruleId).toBe('a11y/color-contrast');
    expect(f.fixSuggestion).toMatch(/2.8/);
    expect(f.viewport).toBe('desktop');
  });

  it('filters out non-contrast violations', async () => {
    const axe: AxeRunner = async () => mkAxeResult({
      violations: [
        { id: 'label', impact: 'serious', help: '', description: '', helpUrl: '', nodes: [{ html: '<input/>' }] },
        { id: 'color-contrast', impact: 'minor', help: '', description: '', helpUrl: '', nodes: [{ html: '<span/>' }] },
      ],
    });
    const outcome = await validateContrast(makeFakePage(), null, 'desktop', axe);
    expect(outcome.findings).toHaveLength(1);
    expect(outcome.findings![0].ruleId).toBe('a11y/color-contrast');
  });
});

describe('validateScopedLabels', () => {
  it('surfaces label and button-name violations', async () => {
    const axe: AxeRunner = async () => mkAxeResult({
      violations: [
        { id: 'label', impact: 'critical', help: 'Form elements must have labels', description: '', helpUrl: 'x', nodes: [{ html: '<input/>' }] },
        { id: 'button-name', impact: 'serious', help: 'Buttons need names', description: '', helpUrl: 'x', nodes: [{ html: '<button></button>' }] },
        { id: 'color-contrast', impact: 'minor', help: '', description: '', helpUrl: 'x', nodes: [{ html: '' }] },
      ],
    });
    const outcome = await validateScopedLabels(makeFakePage(), 'form', 'desktop', axe);
    expect(outcome.passed).toBe(false);
    expect(outcome.findings).toHaveLength(2);
    expect(outcome.findings!.map((f) => f.ruleId)).toEqual(
      expect.arrayContaining(['a11y/label', 'a11y/button-name']),
    );
  });

  it('passes when no label violations are found', async () => {
    const axe: AxeRunner = async () => mkAxeResult();
    const outcome = await validateScopedLabels(makeFakePage(), 'form', 'desktop', axe);
    expect(outcome.passed).toBe(true);
  });
});

describe('validateFullPageAxe', () => {
  it('passes cleanly on no violations', async () => {
    const axe: AxeRunner = async () => mkAxeResult();
    const outcome = await validateFullPageAxe(makeFakePage(), 'desktop', axe);
    expect(outcome.passed).toBe(true);
    expect(outcome.kind).toBe('full-page-axe');
    expect(outcome.findings).toEqual([]);
  });

  it('emits all violation findings', async () => {
    const axe: AxeRunner = async () => mkAxeResult({
      violations: [
        { id: 'landmark-one-main', impact: 'moderate', help: '', description: '', helpUrl: '', nodes: [{ html: '<body/>' }] },
        { id: 'region', impact: 'moderate', help: '', description: '', helpUrl: '', nodes: [{ html: '<div/>' }, { html: '<nav/>' }] },
      ],
    });
    const outcome = await validateFullPageAxe(makeFakePage(), 'desktop', axe);
    expect(outcome.passed).toBe(false);
    expect(outcome.findings).toHaveLength(3);
  });
});
