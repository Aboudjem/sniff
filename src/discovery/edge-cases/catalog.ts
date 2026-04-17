import type { DomainSnapshot } from '../types.js';
import type { EdgeClassId, Scenario, ScenarioStep } from '../scenarios/types.js';

export interface EdgeClass {
  id: EdgeClassId;
  applies(scenario: Scenario, snapshot: DomainSnapshot): boolean;
  mutate(scenario: Scenario): Scenario;
  expectsFailureUx?: string;
}

function scenarioHasFillStep(scenario: Scenario): boolean {
  return scenario.steps.some((s) => s.action === 'fill' || s.action === 'fill-form');
}

function scenarioTouchesForm(scenario: Scenario, intent: string): boolean {
  return scenario.generatedFrom.forms.some((f) => f.length > 0) && scenarioHasFillStep(scenario)
    || scenario.steps.some((s) =>
      (s.payload?.kind === 'persona' && typeof s.payload.value === 'string') &&
      intent.length > 0,
    );
}

function snapshotHasEmailField(snapshot: DomainSnapshot): boolean {
  return snapshot.forms.some((f) => f.fields.some((fld) => fld.type === 'email' || fld.name.toLowerCase().includes('email')));
}

function snapshotHasNumericField(snapshot: DomainSnapshot): boolean {
  return snapshot.forms.some((f) => f.fields.some((fld) => fld.type === 'number' || fld.type === 'tel' || /quantity|amount|price|count/i.test(fld.name)));
}

function snapshotHasRequiredField(snapshot: DomainSnapshot): boolean {
  return snapshot.forms.some((f) => f.fields.some((fld) => fld.required));
}

function snapshotHasPayment(snapshot: DomainSnapshot): boolean {
  const deps = new Set(snapshot.vocabulary.deps);
  return deps.has('stripe') || deps.has('@stripe/stripe-js') || deps.has('@stripe/react-stripe-js');
}

function scenarioIsCheckoutish(scenario: Scenario): boolean {
  return scenario.journey.includes('purchase') ||
    scenario.journey.includes('checkout') ||
    scenario.journey.includes('pay') ||
    scenario.generatedFrom.routes.some((r) => /checkout|pay/.test(r));
}

function scenarioIsBrowseToPurchase(scenario: Scenario): boolean {
  return scenario.appType === 'ecommerce' && scenario.journey === 'browse-to-purchase';
}

function cloneScenario(base: Scenario, edge: EdgeClassId, suffix: string): Scenario {
  return {
    ...base,
    id: `${base.appType}.${base.journey}.edge:${suffix}`,
    variant: `edge:${suffix}`,
    name: `${base.name} (edge: ${suffix})`,
    tags: [...base.tags, 'edge-case', suffix],
    parentScenarioId: base.id,
    edgeClass: edge,
    steps: base.steps.map((s) => ({ ...s })),
  };
}

function mutateSteps(steps: ScenarioStep[], fn: (s: ScenarioStep) => ScenarioStep): ScenarioStep[] {
  return steps.map((s) => fn({ ...s }));
}

const invalidEmail: EdgeClass = {
  id: 'invalid-email',
  expectsFailureUx: 'inline error shown, form does not submit',
  applies(scenario, snapshot) {
    if (!scenarioHasFillStep(scenario)) return false;
    return snapshotHasEmailField(snapshot);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'invalid-email', 'invalid-email');
    variant.edgeOverrides = { ...(scenario.edgeOverrides ?? {}), emailValue: 'not-an-email' };
    return variant;
  },
};

const emptyInput: EdgeClass = {
  id: 'empty-input',
  expectsFailureUx: 'validation errors shown, no crash',
  applies(scenario) {
    return scenarioHasFillStep(scenario);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'empty-input', 'empty-input');
    variant.edgeOverrides = { ...(scenario.edgeOverrides ?? {}), emptyAll: true };
    return variant;
  },
};

const xss: EdgeClass = {
  id: 'xss',
  expectsFailureUx: 'payload escaped, no script execution',
  applies(scenario) {
    return scenarioHasFillStep(scenario);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'xss', 'xss');
    variant.edgeOverrides = {
      ...(scenario.edgeOverrides ?? {}),
      textValue: '<script>alert(1)</script>',
    };
    return variant;
  },
};

const longInput: EdgeClass = {
  id: 'long-input',
  expectsFailureUx: 'truncation or validation, no crash',
  applies(scenario) {
    return scenarioHasFillStep(scenario);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'long-input', 'long-input');
    variant.edgeOverrides = {
      ...(scenario.edgeOverrides ?? {}),
      textValue: 'a'.repeat(10000),
    };
    return variant;
  },
};

const boundaryNumber: EdgeClass = {
  id: 'boundary-number',
  expectsFailureUx: 'clamp or validation error',
  applies(scenario, snapshot) {
    return scenarioHasFillStep(scenario) && snapshotHasNumericField(snapshot);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'boundary-number', 'boundary-number');
    variant.edgeOverrides = {
      ...(scenario.edgeOverrides ?? {}),
      numericValue: '999999999',
    };
    return variant;
  },
};

const paymentDeclined: EdgeClass = {
  id: 'payment-declined',
  expectsFailureUx: 'decline message shown, stays on checkout',
  applies(scenario, snapshot) {
    return scenarioIsCheckoutish(scenario) && snapshotHasPayment(snapshot);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'payment-declined', 'payment-declined');
    variant.edgeOverrides = {
      ...(scenario.edgeOverrides ?? {}),
      cardNumber: '4000000000000002',
    };
    return variant;
  },
};

const emptyCart: EdgeClass = {
  id: 'empty-cart',
  expectsFailureUx: 'empty-cart message, no crash',
  applies(scenario) {
    return scenarioIsBrowseToPurchase(scenario);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'empty-cart', 'empty-cart');
    variant.steps = variant.steps.filter((s) => !/add to cart|add the product/i.test(s.intent));
    variant.steps = variant.steps.map((s, i) => ({ ...s, n: i + 1 }));
    return variant;
  },
};

const missingRequired: EdgeClass = {
  id: 'missing-required',
  expectsFailureUx: 'required field error, form blocked',
  applies(scenario, snapshot) {
    return scenarioHasFillStep(scenario) && snapshotHasRequiredField(snapshot);
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'missing-required', 'missing-required');
    variant.edgeOverrides = {
      ...(scenario.edgeOverrides ?? {}),
      skipRequired: true,
    };
    return variant;
  },
};

const offline: EdgeClass = {
  id: 'offline',
  expectsFailureUx: 'offline banner or graceful error, no blank page',
  applies(scenario) {
    return scenario.steps.length >= 3;
  },
  mutate(scenario) {
    const mid = Math.max(2, Math.floor(scenario.steps.length / 2));
    const variant = cloneScenario(scenario, 'offline', 'offline');
    variant.preconditions = [
      ...(scenario.preconditions ?? []),
      { kind: 'set-offline', beforeStep: mid },
    ];
    return variant;
  },
};

const slowNetwork: EdgeClass = {
  id: 'slow-network',
  expectsFailureUx: 'loading state visible, no double submit',
  applies() {
    return true;
  },
  mutate(scenario) {
    const variant = cloneScenario(scenario, 'slow-network', 'slow-network');
    variant.preconditions = [
      ...(scenario.preconditions ?? []),
      { kind: 'slow-network', delayMs: 3000 },
    ];
    return variant;
  },
};

export const EDGE_CLASSES: EdgeClass[] = [
  invalidEmail,
  emptyInput,
  xss,
  longInput,
  boundaryNumber,
  paymentDeclined,
  emptyCart,
  missingRequired,
  offline,
  slowNetwork,
];

export {
  invalidEmail,
  emptyInput,
  xss,
  longInput,
  boundaryNumber,
  paymentDeclined,
  emptyCart,
  missingRequired,
  offline,
  slowNetwork,
  scenarioTouchesForm,
};
