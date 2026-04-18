import type { AppTypeGuess } from '../classifier/types.js';
import type { DomainSnapshot } from '../types.js';
import type {
  JourneyTemplate,
  RealismProfile,
  Scenario,
  ScenarioStep,
  StepValidationSpec,
  TemplateRequires,
} from './types.js';
import { TEMPLATES } from './templates/index.js';

const DEFAULT_PER_STEP_VALIDATIONS: StepValidationSpec[] = [
  { kind: 'console-clean' },
  { kind: 'network-clean' },
  { kind: 'response-time', budgetMs: 3000 },
  { kind: 'visible-target' },
  { kind: 'label-present' },
];

const DEFAULT_PER_SCENARIO_VALIDATIONS: StepValidationSpec[] = [
  { kind: 'full-page-axe' },
  { kind: 'layout-stability' },
];

const DEFAULT_REALISM: RealismProfile = 'casual-user';

export interface GenerateScenariosOptions {
  realism?: RealismProfile;
  minConfidence?: number;
  /**
   * Filter classifier-provided guesses down to these app types. If the
   * classifier returns nothing matching (e.g. it picked `blank`), NO
   * scenarios are generated. This is the behavior previously called
   * `forceAppTypes` — it only filters, it does not force.
   */
  filterAppTypes?: string[];
  /**
   * Force a specific app type, bypassing the classifier entirely. Unlike
   * `filterAppTypes`, this works even when the classifier returned `blank`
   * — the signature's templates are instantiated at confidence 1.0.
   */
  forceAppType?: string;
  /**
   * @deprecated Renamed to `filterAppTypes`. Kept for one release so existing
   * callers don't break. Will be removed in v0.6.
   */
  forceAppTypes?: string[];
}

function hasAllEntities(snapshot: DomainSnapshot, required: string[]): boolean {
  const names = new Set(snapshot.entities.map((e) => e.name.toLowerCase()));
  return required.every((r) => names.has(r.toLowerCase()));
}

function hasAnyForm(snapshot: DomainSnapshot, intents: string[]): boolean {
  const found = new Set(snapshot.forms.map((f) => f.intent));
  return intents.every((intent) => found.has(intent as never));
}

function hasAnyRouteToken(snapshot: DomainSnapshot, tokens: string[]): boolean {
  const vocab = new Set(snapshot.vocabulary.routes);
  return tokens.some((t) => vocab.has(t));
}

function hasAnyDep(snapshot: DomainSnapshot, deps: string[]): boolean {
  const vocab = new Set(snapshot.vocabulary.deps);
  return deps.some((d) => vocab.has(d));
}

function requiresSatisfied(snapshot: DomainSnapshot, requires: TemplateRequires | undefined): boolean {
  if (!requires) return true;
  if (requires.entities && requires.entities.length > 0 && !hasAllEntities(snapshot, requires.entities)) return false;
  if (requires.forms && requires.forms.length > 0 && !hasAnyForm(snapshot, requires.forms)) return false;
  if (requires.routeTokens && requires.routeTokens.length > 0 && !hasAnyRouteToken(snapshot, requires.routeTokens)) return false;
  if (requires.depAny && requires.depAny.length > 0 && !hasAnyDep(snapshot, requires.depAny)) return false;
  return true;
}

function reindexSteps(steps: ScenarioStep[]): ScenarioStep[] {
  return steps.map((step, idx) => ({ ...step, n: idx + 1 }));
}

function generatedFromFor(
  snapshot: DomainSnapshot,
  template: JourneyTemplate,
  confidence: number,
): Scenario['generatedFrom'] {
  const routesInvolved = new Set<string>();
  for (const step of template.steps) {
    if (step.action === 'navigate' && step.url) routesInvolved.add(step.url);
  }
  const intentsInvolved = new Set(template.requires?.forms ?? []);
  const matchedForms = snapshot.forms
    .filter((f) => intentsInvolved.has(f.intent))
    .map((f) => f.route);

  const entityNames = new Set((template.requires?.entities ?? []).map((n) => n.toLowerCase()));
  const matchedEntities = snapshot.entities
    .filter((e) => entityNames.has(e.name.toLowerCase()))
    .map((e) => e.name);

  return {
    routes: [...routesInvolved, ...matchedForms],
    entities: matchedEntities,
    forms: matchedForms,
    confidence,
  };
}

function instantiate(
  template: JourneyTemplate,
  snapshot: DomainSnapshot,
  confidence: number,
  realism: RealismProfile,
): Scenario {
  return {
    id: `${template.appType}.${template.journey}.happy`,
    name: template.name,
    appType: template.appType,
    journey: template.journey,
    variant: 'happy',
    persona: template.persona,
    realism,
    steps: reindexSteps(template.steps),
    goal: template.goal,
    validations: {
      perStep: [...DEFAULT_PER_STEP_VALIDATIONS],
      perScenario: [...DEFAULT_PER_SCENARIO_VALIDATIONS],
    },
    tags: [...template.tags],
    generatedFrom: generatedFromFor(snapshot, template, confidence),
    ...(template.expectedDurationMs !== undefined
      ? { expectedDurationMs: template.expectedDurationMs }
      : {}),
  };
}

export function generateScenarios(
  snapshot: DomainSnapshot,
  guesses: AppTypeGuess[],
  options: GenerateScenariosOptions = {},
): Scenario[] {
  const minConfidence = options.minConfidence ?? 0.1;
  const realism = options.realism ?? DEFAULT_REALISM;

  const byType = new Map<string, number>();

  if (options.forceAppType) {
    // Bypass classifier entirely — pin the requested type at confidence 1.
    byType.set(options.forceAppType, 1);
  } else {
    // Back-compat: accept old `forceAppTypes` name as equivalent to `filterAppTypes`.
    const filterList = options.filterAppTypes ?? options.forceAppTypes;
    const filterSet = filterList && filterList.length > 0 ? new Set(filterList) : null;
    for (const guess of guesses) {
      if (guess.confidence < minConfidence) continue;
      if (filterSet && !filterSet.has(guess.type)) continue;
      byType.set(guess.type, guess.confidence);
    }
  }

  const scenarios: Scenario[] = [];
  for (const template of TEMPLATES) {
    const confidence = byType.get(template.appType);
    if (confidence === undefined) continue;
    if (!requiresSatisfied(snapshot, template.requires)) continue;
    scenarios.push(instantiate(template, snapshot, confidence, realism));
  }

  return scenarios;
}

export function serializeScenarios(scenarios: Scenario[]): string {
  return JSON.stringify(scenarios, null, 2);
}
