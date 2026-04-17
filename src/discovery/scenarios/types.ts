import type { AppType } from '../classifier/types.js';

export type ScenarioVariant = 'happy' | `edge:${string}` | `real:${string}`;

export type ScenarioAction =
  | 'navigate'
  | 'click'
  | 'fill'
  | 'fill-form'
  | 'select'
  | 'wait'
  | 'assert-url'
  | 'assert-text'
  | 'custom';

export type RealismProfile =
  | 'robot'
  | 'careful-user'
  | 'casual-user'
  | 'frustrated-user'
  | 'power-user';

export interface SelectorTarget {
  selectorHints: string[];
  fallbackRoleText?: { role: string; name: string };
}

export type StepPayload =
  | { kind: 'literal'; value: string }
  | { kind: 'persona'; value: string }
  | { kind: 'entity-field'; value: { entity: string; field: string } }
  | { kind: 'edge-case-value'; value: { category: string } };

export type StepExpectation =
  | { kind: 'url-matches'; value: string }
  | { kind: 'text-visible'; value: string }
  | { kind: 'selector-visible'; value: string }
  | { kind: 'network-status'; value: string }
  | { kind: 'console-clean'; value: string };

export interface ScenarioStep {
  n: number;
  intent: string;
  action: ScenarioAction;
  target?: SelectorTarget;
  payload?: StepPayload;
  expect?: StepExpectation[];
  optional?: boolean;
  url?: string;
}

export type StepValidationKind =
  | 'console-clean'
  | 'network-clean'
  | 'response-time'
  | 'visible-target'
  | 'visible-text'
  | 'focus-ring'
  | 'label-present'
  | 'contrast-wcag-aa'
  | 'reachability'
  | 'layout-stability'
  | 'full-page-axe';

export interface StepValidationSpec {
  kind: StepValidationKind;
  budgetMs?: number;
}

export interface ScenarioGoal {
  kind: 'url' | 'text' | 'selector' | 'api';
  value: string;
  description: string;
}

export type EdgeClassId =
  | 'invalid-email'
  | 'empty-input'
  | 'xss'
  | 'long-input'
  | 'boundary-number'
  | 'payment-declined'
  | 'empty-cart'
  | 'missing-required'
  | 'offline'
  | 'slow-network';

export interface EdgeOverrides {
  emailValue?: string;
  textValue?: string;
  numericValue?: string;
  cardNumber?: string;
  skipField?: string;
  skipRequired?: boolean;
  emptyAll?: boolean;
}

export type PreconditionAction =
  | { kind: 'clear-cookies' }
  | { kind: 'set-offline'; beforeStep: number }
  | { kind: 'route-abort'; urlPattern: string }
  | { kind: 'slow-network'; delayMs: number; urlPattern?: string };

export interface Scenario {
  id: string;
  name: string;
  appType: AppType;
  journey: string;
  variant: ScenarioVariant;
  persona?: string;
  realism: RealismProfile;
  steps: ScenarioStep[];
  goal: ScenarioGoal;
  validations: {
    perStep: StepValidationSpec[];
    perScenario: StepValidationSpec[];
  };
  tags: string[];
  generatedFrom: {
    routes: string[];
    entities: string[];
    forms: string[];
    confidence: number;
  };
  expectedDurationMs?: number;
  preconditions?: PreconditionAction[];
  edgeOverrides?: EdgeOverrides;
  edgeClass?: EdgeClassId;
  parentScenarioId?: string;
}

export interface TemplateRequires {
  entities?: string[];
  forms?: string[];
  routeTokens?: string[];
  depAny?: string[];
}

export interface JourneyTemplate {
  journey: string;
  appType: AppType;
  name: string;
  persona: string;
  tags: string[];
  requires?: TemplateRequires;
  goal: ScenarioGoal;
  steps: ScenarioStep[];
  expectedDurationMs?: number;
}
