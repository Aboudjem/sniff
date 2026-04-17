import { performance } from 'node:perf_hooks';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { BrowserFinding } from '../core/types.js';
import type { SniffConfig } from '../config/schema.js';
import type { AppTypeGuess } from './classifier/types.js';
import { PERSONAS } from './scenarios/personas.js';
import type {
  Scenario,
  ScenarioStep,
  StepValidationSpec,
} from './scenarios/types.js';
import type {
  DiscoveryReport,
  DiscoveryRunContext,
  ScenarioResult,
  ScenarioStatus,
  StepRecord,
  ValidationOutcome,
} from './run-types.js';
import { resolveTarget } from './selectors.js';
import {
  evaluateExpectation,
  validateConsoleClean,
  validateLabelPresent,
  validateNetworkClean,
  validateResponseTime,
  validateVisibleTarget,
} from './validators/index.js';
import {
  defaultAxeRunner,
  validateContrast,
  validateFullPageAxe,
  validateScopedLabels,
  type AxeRunner,
} from './validators/scoped-a11y.js';
import { validateFocusRing } from './validators/focus-ring.js';
import {
  captureRegionSnapshot,
  validateLayoutStability,
  type LayoutSnapshot,
} from './validators/layout-stability.js';
import { fillFormWithPersona } from './fill-form.js';

interface RunnerDeps {
  launchBrowser: () => Promise<Browser>;
  setupHooks: (page: Page, viewportName: string) => Promise<PageHookController>;
  axeRunner: AxeRunner;
  seed: number;
}

interface PageHookController {
  collect(): BrowserFinding[];
  reset(): void;
  screenshot(page: Page, name: string, reportDir: string): Promise<string | undefined>;
}

function hasValidation(specs: StepValidationSpec[], kind: StepValidationSpec['kind']): StepValidationSpec | undefined {
  return specs.find((s) => s.kind === kind);
}

async function applyStartupPreconditions(
  context: BrowserContext,
  page: Page,
  scenario: Scenario,
): Promise<void> {
  const preconditions = scenario.preconditions ?? [];
  for (const action of preconditions) {
    try {
      switch (action.kind) {
        case 'clear-cookies':
          await context.clearCookies();
          break;
        case 'route-abort':
          await page.route(action.urlPattern, (route) => route.abort());
          break;
        case 'slow-network': {
          const pattern = action.urlPattern ?? '**/*';
          const delay = action.delayMs;
          await page.route(pattern, async (route) => {
            await new Promise((r) => setTimeout(r, delay));
            await route.continue();
          });
          break;
        }
        case 'set-offline':
          break;
      }
    } catch {
      // precondition application is best-effort
    }
  }
}

async function maybeToggleOffline(
  context: BrowserContext,
  scenario: Scenario,
  stepN: number,
): Promise<void> {
  const preconditions = scenario.preconditions ?? [];
  for (const action of preconditions) {
    if (action.kind !== 'set-offline') continue;
    if (action.beforeStep !== stepN) continue;
    try {
      await context.setOffline(true);
    } catch {
      // ignore
    }
  }
}

function stepStatusFrom(validations: ValidationOutcome[]): ScenarioStatus {
  return validations.every((v) => v.passed) ? 'pass' : 'fail';
}

function failureReasonFrom(validations: ValidationOutcome[]): string | undefined {
  const failed = validations.find((v) => !v.passed);
  if (!failed) return undefined;
  return `${failed.name}${failed.detail ? `: ${failed.detail}` : ''}`;
}

async function executeAction(
  page: Page,
  step: ScenarioStep,
  scenario: Scenario,
  context: DiscoveryRunContext,
  resolvedSelector: string | null,
): Promise<{ responseTimeMs?: number; error?: string }> {
  const start = performance.now();
  const personaName = scenario.persona;
  const overrides = scenario.edgeOverrides;

  try {
    switch (step.action) {
      case 'navigate': {
        const target = step.url ?? '';
        const absolute = target.startsWith('http') ? target : `${context.baseUrl.replace(/\/$/, '')}${target.startsWith('/') ? '' : '/'}${target}`;
        await page.goto(absolute, { waitUntil: 'networkidle', timeout: context.stepTimeoutMs });
        break;
      }
      case 'click': {
        if (!resolvedSelector) return { error: 'target not found' };
        await page.locator(resolvedSelector).first().click({ timeout: context.stepTimeoutMs });
        break;
      }
      case 'fill': {
        if (!resolvedSelector) return { error: 'target not found' };
        const value = step.payload?.kind === 'literal'
          ? step.payload.value
          : step.payload?.kind === 'persona' && personaName
            ? PERSONAS[personaName]?.values[step.payload.value] ?? ''
            : '';
        await page.locator(resolvedSelector).first().fill(value, { timeout: context.stepTimeoutMs });
        break;
      }
      case 'fill-form': {
        const effectivePersona = step.payload?.kind === 'persona' && typeof step.payload.value === 'string'
          ? step.payload.value
          : personaName;
        if (!effectivePersona) return { error: 'no persona for fill-form' };
        const persona = PERSONAS[effectivePersona];
        if (!persona) return { error: `unknown persona: ${effectivePersona}` };
        await fillFormWithPersona(page, persona, overrides);
        break;
      }
      case 'select': {
        if (!resolvedSelector) return { error: 'target not found' };
        const value = step.payload?.kind === 'literal' ? step.payload.value : '';
        await page.locator(resolvedSelector).first().selectOption(value, { timeout: context.stepTimeoutMs });
        break;
      }
      case 'wait': {
        await page.waitForTimeout(500);
        break;
      }
      case 'assert-url':
      case 'assert-text':
      case 'custom':
        break;
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  return { responseTimeMs: performance.now() - start };
}

async function runStep(
  page: Page,
  step: ScenarioStep,
  scenario: Scenario,
  context: DiscoveryRunContext,
  hookCtrl: PageHookController,
  axeRunner: AxeRunner,
  viewportName: string,
): Promise<StepRecord> {
  const started = performance.now();
  const urlBefore = page.url();
  hookCtrl.reset();

  let resolvedSelector: string | null = null;
  if (step.target) {
    const resolved = await resolveTarget(page, step.target);
    resolvedSelector = resolved?.selector ?? null;
  }

  if (!resolvedSelector && step.target && !step.optional && step.action !== 'navigate') {
    const durationMs = performance.now() - started;
    return {
      n: step.n,
      intent: step.intent,
      action: step.action,
      urlBefore,
      urlAfter: urlBefore,
      durationMs,
      observation: { consoleErrors: 0, networkFailures: 0 },
      validations: [
        {
          kind: 'expect',
          name: 'target resolved',
          passed: false,
          detail: `no selector matched: ${step.target.selectorHints.join(', ')}`,
        },
      ],
      status: 'fail',
      failureReason: 'target not found',
    };
  }

  let layoutBefore: LayoutSnapshot | null = null;
  if (hasValidation(scenario.validations.perStep, 'layout-stability') && resolvedSelector) {
    layoutBefore = await captureRegionSnapshot(page, resolvedSelector);
  }

  const actionResult = await executeAction(page, step, scenario, context, resolvedSelector);
  await page.waitForTimeout(200);

  const urlAfter = page.url();
  const hookFindings = hookCtrl.collect();
  const consoleErrors = hookFindings.filter((f) => f.ruleId === 'e2e/console-error').length;
  const networkFailures = hookFindings.filter((f) => f.ruleId === 'e2e/network-failure').length;

  const validations: ValidationOutcome[] = [];
  const ctx = { page, step, hookFindings, responseTimeMs: actionResult.responseTimeMs };

  if (hasValidation(scenario.validations.perStep, 'console-clean')) {
    validations.push(await validateConsoleClean(ctx));
  }
  if (hasValidation(scenario.validations.perStep, 'network-clean')) {
    validations.push(await validateNetworkClean(ctx));
  }
  const respSpec = hasValidation(scenario.validations.perStep, 'response-time');
  if (respSpec?.budgetMs) {
    validations.push(await validateResponseTime(ctx, respSpec.budgetMs));
  }
  if (hasValidation(scenario.validations.perStep, 'visible-target')) {
    validations.push(await validateVisibleTarget(ctx, resolvedSelector));
  }
  if (hasValidation(scenario.validations.perStep, 'label-present')) {
    validations.push(await validateLabelPresent(ctx, resolvedSelector));
    validations.push(await validateScopedLabels(page, resolvedSelector, viewportName, axeRunner));
  }
  if (hasValidation(scenario.validations.perStep, 'contrast-wcag-aa')) {
    validations.push(await validateContrast(page, resolvedSelector, viewportName, axeRunner));
  }
  if (hasValidation(scenario.validations.perStep, 'focus-ring')) {
    validations.push(await validateFocusRing(page, resolvedSelector));
  }
  if (hasValidation(scenario.validations.perStep, 'layout-stability')) {
    const layoutAfter = resolvedSelector ? await captureRegionSnapshot(page, resolvedSelector) : null;
    validations.push(await validateLayoutStability(layoutBefore, layoutAfter));
  }

  if (step.expect) {
    for (const expectation of step.expect) {
      validations.push(await evaluateExpectation(ctx, expectation));
    }
  }

  if (actionResult.error) {
    validations.push({
      kind: 'expect',
      name: 'action succeeded',
      passed: false,
      detail: actionResult.error,
    });
  }

  let screenshotPath: string | undefined;
  const status = stepStatusFrom(validations);
  if (status === 'fail') {
    const safeName = `${scenario.id}-step-${step.n}`;
    screenshotPath = await hookCtrl.screenshot(page, safeName, context.reportDir);
  }

  return {
    n: step.n,
    intent: step.intent,
    action: step.action,
    ...(resolvedSelector ? { resolvedSelector } : {}),
    urlBefore,
    urlAfter,
    durationMs: performance.now() - started,
    observation: {
      consoleErrors,
      networkFailures,
      ...(actionResult.responseTimeMs !== undefined ? { responseTimeMs: actionResult.responseTimeMs } : {}),
      ...(screenshotPath ? { screenshotPath } : {}),
    },
    validations,
    status,
    ...(status === 'fail' ? { failureReason: failureReasonFrom(validations) } : {}),
  };
}

async function runScenario(
  browser: Browser,
  scenario: Scenario,
  context: DiscoveryRunContext,
  setupHooks: RunnerDeps['setupHooks'],
  axeRunner: AxeRunner,
  seed: number,
): Promise<ScenarioResult> {
  const start = performance.now();
  const steps: StepRecord[] = [];
  const findings: BrowserFinding[] = [];
  let lastPage: Page | undefined;
  let lastViewportName = '';

  let browserContext: BrowserContext | undefined;
  try {
    browserContext = await browser.newContext({
      viewport: { width: context.viewport.width, height: context.viewport.height },
    });
    const page = await browserContext.newPage();
    const viewportName = `${context.viewport.width}x${context.viewport.height}`;
    const hookCtrl = await setupHooks(page, viewportName);
    lastPage = page;
    lastViewportName = viewportName;

    await applyStartupPreconditions(browserContext, page, scenario);

    try {
      await page.goto(context.baseUrl, {
        waitUntil: 'networkidle',
        timeout: context.stepTimeoutMs,
      });
    } catch {
      return {
        scenario,
        status: 'skip',
        steps: [],
        findings: [],
        durationMs: performance.now() - start,
        seed,
        skippedReason: `could not reach baseUrl ${context.baseUrl}`,
      };
    }

    const scenarioDeadline = start + (scenario.expectedDurationMs ?? context.scenarioTimeoutMs);

    for (const step of scenario.steps) {
      if (performance.now() > scenarioDeadline) {
        steps.push({
          n: step.n,
          intent: step.intent,
          action: step.action,
          urlBefore: page.url(),
          urlAfter: page.url(),
          durationMs: 0,
          observation: { consoleErrors: 0, networkFailures: 0 },
          validations: [{ kind: 'expect', name: 'scenario within budget', passed: false, detail: 'scenario timeout' }],
          status: 'fail',
          failureReason: 'scenario timeout',
        });
        break;
      }

      await maybeToggleOffline(browserContext, scenario, step.n);

      const record = await runStep(page, step, scenario, context, hookCtrl, axeRunner, viewportName);
      steps.push(record);
      findings.push(...hookCtrl.collect());
      for (const v of record.validations) {
        if (v.findings) findings.push(...v.findings);
      }
      if (record.status === 'fail') break;
    }
  } finally {
    if (browserContext) {
      try {
        await browserContext.close();
      } catch {
        // ignore
      }
    }
  }

  const allStepsPassed = steps.length === scenario.steps.length && steps.every((s) => s.status === 'pass');
  const perScenarioOutcomes: ValidationOutcome[] = [];

  if (allStepsPassed && lastPage) {
    for (const spec of scenario.validations.perScenario) {
      if (spec.kind === 'full-page-axe') {
        try {
          const outcome = await validateFullPageAxe(lastPage, lastViewportName, axeRunner);
          perScenarioOutcomes.push(outcome);
          if (outcome.findings) findings.push(...outcome.findings);
        } catch {
          // axe failed to run; skip
        }
      }
    }
  }

  const perScenarioPassed = perScenarioOutcomes.every((o) => o.passed);
  const status: ScenarioStatus = allStepsPassed && perScenarioPassed ? 'pass' : 'fail';

  return {
    scenario,
    status,
    steps,
    findings,
    durationMs: performance.now() - start,
    seed,
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export async function runScenarios(
  scenarios: Scenario[],
  guesses: AppTypeGuess[],
  context: DiscoveryRunContext,
  config: SniffConfig,
  deps?: Partial<RunnerDeps>,
): Promise<DiscoveryReport> {
  const start = performance.now();
  const runAt = new Date().toISOString();

  const launchBrowser = deps?.launchBrowser ?? (async () => {
    const { chromium } = await import('playwright');
    return chromium.launch({ headless: context.headless });
  });

  const defaultSetupHooks: RunnerDeps['setupHooks'] = async (page, viewportName) => {
    const {
      PageHookPipeline,
      ConsoleErrorHook,
      NetworkFailureHook,
      ScreenshotHook,
    } = await import('../browser/page-hooks.js');
    const pipeline = new PageHookPipeline();
    pipeline.register(new ConsoleErrorHook());
    pipeline.register(new NetworkFailureHook());
    pipeline.register(new ScreenshotHook());
    pipeline.setupAll(page, viewportName);
    return {
      collect: () => pipeline.collectAll(),
      reset: () => pipeline.resetAll(),
      screenshot: (p, name, dir) => pipeline.captureScreenshot(p, name, dir),
    };
  };
  const setupHooks = deps?.setupHooks ?? defaultSetupHooks;
  const axeRunner = deps?.axeRunner ?? defaultAxeRunner;

  const baseSeed = context.seed ?? seedFromString(runAt);
  const results: ScenarioResult[] = [];

  if (scenarios.length === 0) {
    void config;
    return {
      appTypeGuesses: guesses,
      scenarios: [],
      stats: { total: 0, passed: 0, failed: 0, skipped: 0, quarantined: 0, durationMs: 0 },
      runAt,
    };
  }

  const browser = await launchBrowser();
  try {
    for (const scenario of scenarios) {
      const seed = seedFromString(`${baseSeed}::${scenario.id}`);
      const result = await runScenario(browser, scenario, context, setupHooks, axeRunner, seed);
      results.push(result);
    }
  } finally {
    try {
      await browser.close();
    } catch {
      // ignore
    }
  }

  const stats = {
    total: results.length,
    passed: results.filter((r) => r.status === 'pass').length,
    failed: results.filter((r) => r.status === 'fail').length,
    skipped: results.filter((r) => r.status === 'skip').length,
    quarantined: results.filter((r) => r.quarantined === true).length,
    durationMs: performance.now() - start,
  };

  return {
    appTypeGuesses: guesses,
    scenarios: results,
    stats,
    runAt,
  };
}
