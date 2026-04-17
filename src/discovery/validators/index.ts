import type { Page } from 'playwright';
import type { BrowserFinding } from '../../core/types.js';
import type { ScenarioStep, StepExpectation } from '../scenarios/types.js';
import type { ValidationOutcome } from '../run-types.js';

export interface ValidationContext {
  page: Page;
  step: ScenarioStep;
  hookFindings: BrowserFinding[];
  responseTimeMs?: number;
}

export async function validateConsoleClean(ctx: ValidationContext): Promise<ValidationOutcome> {
  const errors = ctx.hookFindings.filter((f) => f.ruleId === 'e2e/console-error');
  return {
    kind: 'console-clean',
    name: 'no new console errors',
    passed: errors.length === 0,
    ...(errors.length > 0 ? { detail: `${errors.length} console error(s) on step ${ctx.step.n}` } : {}),
  };
}

export async function validateNetworkClean(ctx: ValidationContext): Promise<ValidationOutcome> {
  const failures = ctx.hookFindings.filter((f) => f.ruleId === 'e2e/network-failure');
  return {
    kind: 'network-clean',
    name: 'no 4xx/5xx network failures',
    passed: failures.length === 0,
    ...(failures.length > 0 ? { detail: `${failures.length} network failure(s)` } : {}),
  };
}

export async function validateResponseTime(
  ctx: ValidationContext,
  budgetMs: number,
): Promise<ValidationOutcome> {
  if (ctx.responseTimeMs === undefined) {
    return { kind: 'response-time', name: `response under ${budgetMs}ms`, passed: true };
  }
  const passed = ctx.responseTimeMs <= budgetMs;
  return {
    kind: 'response-time',
    name: `response under ${budgetMs}ms`,
    passed,
    ...(passed ? {} : { detail: `took ${Math.round(ctx.responseTimeMs)}ms (budget ${budgetMs}ms)` }),
  };
}

export async function validateVisibleTarget(
  ctx: ValidationContext,
  resolvedSelector: string | null,
): Promise<ValidationOutcome> {
  if (!resolvedSelector) {
    return { kind: 'visible-target', name: 'target is visible', passed: true };
  }
  try {
    const visible = await ctx.page.locator(resolvedSelector).first().isVisible();
    return {
      kind: 'visible-target',
      name: 'target is visible',
      passed: visible,
      ...(visible ? {} : { detail: `selector ${resolvedSelector} is not visible` }),
    };
  } catch (err) {
    return {
      kind: 'visible-target',
      name: 'target is visible',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function validateLabelPresent(
  ctx: ValidationContext,
  resolvedSelector: string | null,
): Promise<ValidationOutcome> {
  if (!resolvedSelector) {
    return { kind: 'label-present', name: 'interactive target has a label', passed: true };
  }
  try {
    const el = ctx.page.locator(resolvedSelector).first();
    const tag = await el.evaluate((node) => (node as Element).tagName.toLowerCase());
    if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
      return { kind: 'label-present', name: 'interactive target has a label', passed: true };
    }
    const hasLabel = await el.evaluate((node) => {
      const e = node as HTMLInputElement;
      if (e.getAttribute('aria-label')) return true;
      if (e.getAttribute('aria-labelledby')) return true;
      if (e.id) {
        const byFor = document.querySelector(`label[for="${e.id}"]`);
        if (byFor) return true;
      }
      const parentLabel = e.closest('label');
      if (parentLabel) return true;
      if (e.getAttribute('placeholder')) return true;
      return false;
    });
    return {
      kind: 'label-present',
      name: 'interactive target has a label',
      passed: hasLabel,
      ...(hasLabel ? {} : { detail: `${resolvedSelector} has no accessible label` }),
    };
  } catch (err) {
    return {
      kind: 'label-present',
      name: 'interactive target has a label',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function evaluateExpectation(
  ctx: ValidationContext,
  expectation: StepExpectation,
): Promise<ValidationOutcome> {
  switch (expectation.kind) {
    case 'url-matches': {
      const url = ctx.page.url();
      const passed = new RegExp(expectation.value).test(url);
      return {
        kind: 'expect',
        name: `url matches /${expectation.value}/`,
        passed,
        ...(passed ? {} : { detail: `url was ${url}` }),
      };
    }
    case 'text-visible': {
      try {
        const locator = ctx.page.getByText(new RegExp(expectation.value, 'i'));
        const count = await locator.count();
        const passed = count > 0 && (await locator.first().isVisible());
        return {
          kind: 'expect',
          name: `text visible: ${expectation.value}`,
          passed,
          ...(passed ? {} : { detail: `no visible text matching /${expectation.value}/i` }),
        };
      } catch (err) {
        return {
          kind: 'expect',
          name: `text visible: ${expectation.value}`,
          passed: false,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case 'selector-visible': {
      try {
        const locator = ctx.page.locator(expectation.value).first();
        const passed = await locator.isVisible();
        return {
          kind: 'expect',
          name: `selector visible: ${expectation.value}`,
          passed,
          ...(passed ? {} : { detail: `${expectation.value} is not visible` }),
        };
      } catch (err) {
        return {
          kind: 'expect',
          name: `selector visible: ${expectation.value}`,
          passed: false,
          detail: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case 'network-status':
      return { kind: 'expect', name: 'network status', passed: true };
    case 'console-clean':
      return validateConsoleClean(ctx);
  }
}
