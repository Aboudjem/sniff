import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { enumerateEdgeVariants, enumerateAllEdgeVariants, EDGE_CLASSES } from './index.js';
import { extractDomainSnapshot } from '../domain/index.js';
import { classifyApp } from '../classifier/index.js';
import { generateScenarios } from '../scenarios/index.js';
import type { Scenario, ScenarioStep } from '../scenarios/types.js';
import type { DomainSnapshot } from '../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', '..', '..', 'sniff-tests', 'fixtures');

function mkSnapshot(partial: Partial<DomainSnapshot> = {}): DomainSnapshot {
  return {
    project: { name: 'test', frameworks: [], rootDir: '/tmp/test' },
    routes: [],
    forms: [],
    entities: [],
    relations: [],
    apiEndpoints: [],
    vocabulary: { routes: [], elements: [], deps: [] },
    metadata: { analyzedAt: new Date().toISOString(), duration: 0 },
    ...partial,
  };
}

function mkStep(n: number, action: ScenarioStep['action'], extra: Partial<ScenarioStep> = {}): ScenarioStep {
  return { n, intent: `step ${n}`, action, ...extra };
}

function mkScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'ecommerce.browse-to-purchase.happy',
    name: 'Browse to purchase',
    appType: 'ecommerce',
    journey: 'browse-to-purchase',
    variant: 'happy',
    persona: 'new-customer',
    realism: 'casual-user',
    steps: [
      mkStep(1, 'navigate', { url: '/' }),
      mkStep(2, 'click', { intent: 'Add the product to cart', target: { selectorHints: ['[data-testid="add-to-cart"]'] } }),
      mkStep(3, 'navigate', { url: '/cart' }),
      mkStep(4, 'fill-form', { payload: { kind: 'persona', value: 'new-customer' } }),
      mkStep(5, 'click', { intent: 'Place order', target: { selectorHints: ['[data-testid="place-order"]'] } }),
    ],
    goal: { kind: 'url', value: 'confirmation', description: 'reach confirmation' },
    validations: { perStep: [], perScenario: [] },
    tags: ['smoke'],
    generatedFrom: { routes: ['/cart', '/checkout'], entities: ['Product', 'Order'], forms: ['/checkout'], confidence: 0.7 },
    ...overrides,
  };
}

describe('edge classes applicability', () => {
  it('invalid-email applies only when an email field exists', () => {
    const scenario = mkScenario();
    const noEmail = mkSnapshot({ forms: [] });
    const withEmail = mkSnapshot({
      forms: [{ route: '/checkout', filePath: 'x', intent: 'checkout', intentConfidence: 1,
        fields: [{ name: 'email', type: 'email', required: true }] }],
    });
    const cls = EDGE_CLASSES.find((c) => c.id === 'invalid-email')!;
    expect(cls.applies(scenario, noEmail)).toBe(false);
    expect(cls.applies(scenario, withEmail)).toBe(true);
  });

  it('empty-cart applies only to ecommerce browse-to-purchase', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'empty-cart')!;
    const ecom = mkScenario();
    const saas = mkScenario({ appType: 'saas', journey: 'sign-up-to-dashboard' });
    expect(cls.applies(ecom, mkSnapshot())).toBe(true);
    expect(cls.applies(saas, mkSnapshot())).toBe(false);
  });

  it('payment-declined applies only when stripe is in deps', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'payment-declined')!;
    const scenario = mkScenario();
    const noStripe = mkSnapshot();
    const withStripe = mkSnapshot({ vocabulary: { routes: [], elements: [], deps: ['stripe'] } });
    expect(cls.applies(scenario, noStripe)).toBe(false);
    expect(cls.applies(scenario, withStripe)).toBe(true);
  });

  it('slow-network always applies', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'slow-network')!;
    expect(cls.applies(mkScenario(), mkSnapshot())).toBe(true);
  });

  it('offline requires a scenario with at least 3 steps', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'offline')!;
    const short = mkScenario({ steps: [mkStep(1, 'navigate', { url: '/' })] });
    expect(cls.applies(short, mkSnapshot())).toBe(false);
    expect(cls.applies(mkScenario(), mkSnapshot())).toBe(true);
  });
});

describe('edge class mutation', () => {
  it('invalid-email sets emailValue override', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'invalid-email')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.variant).toBe('edge:invalid-email');
    expect(variant.edgeOverrides?.emailValue).toBe('not-an-email');
    expect(variant.parentScenarioId).toBe('ecommerce.browse-to-purchase.happy');
  });

  it('empty-input sets emptyAll override', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'empty-input')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.edgeOverrides?.emptyAll).toBe(true);
  });

  it('xss sets textValue override', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'xss')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.edgeOverrides?.textValue).toMatch(/<script>/);
  });

  it('long-input sets a 10k char textValue', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'long-input')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.edgeOverrides?.textValue?.length).toBe(10000);
  });

  it('boundary-number sets numericValue', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'boundary-number')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.edgeOverrides?.numericValue).toBe('999999999');
  });

  it('payment-declined uses Stripe test decline card', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'payment-declined')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.edgeOverrides?.cardNumber).toBe('4000000000000002');
  });

  it('empty-cart removes add-to-cart steps and reindexes', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'empty-cart')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.steps.some((s) => /add to cart|add the product/i.test(s.intent))).toBe(false);
    expect(variant.steps.map((s) => s.n)).toEqual(variant.steps.map((_, i) => i + 1));
  });

  it('missing-required sets skipRequired', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'missing-required')!;
    const variant = cls.mutate(mkScenario());
    expect(variant.edgeOverrides?.skipRequired).toBe(true);
  });

  it('offline adds a set-offline precondition before a mid-flow step', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'offline')!;
    const variant = cls.mutate(mkScenario());
    const offlinePre = variant.preconditions?.find((p) => p.kind === 'set-offline');
    expect(offlinePre).toBeDefined();
    if (offlinePre && offlinePre.kind === 'set-offline') {
      expect(offlinePre.beforeStep).toBeGreaterThan(1);
    }
  });

  it('slow-network adds a slow-network precondition', () => {
    const cls = EDGE_CLASSES.find((c) => c.id === 'slow-network')!;
    const variant = cls.mutate(mkScenario());
    const slowPre = variant.preconditions?.find((p) => p.kind === 'slow-network');
    expect(slowPre).toBeDefined();
  });
});

describe('enumerateEdgeVariants', () => {
  it('respects maxPerScenario cap', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/checkout', filePath: 'x', intent: 'checkout', intentConfidence: 1,
        fields: [{ name: 'email', type: 'email', required: true }, { name: 'quantity', type: 'number', required: true }] }],
      vocabulary: { routes: [], elements: [], deps: ['stripe'] },
    });
    const scenario = mkScenario();
    const variants = enumerateEdgeVariants(scenario, snapshot, { maxPerScenario: 3 });
    expect(variants.length).toBeLessThanOrEqual(3);
  });

  it('prioritizes app-type-relevant edges', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/checkout', filePath: 'x', intent: 'checkout', intentConfidence: 1,
        fields: [{ name: 'email', type: 'email', required: true }] }],
      vocabulary: { routes: [], elements: [], deps: ['stripe'] },
    });
    const scenario = mkScenario();
    const variants = enumerateEdgeVariants(scenario, snapshot, { maxPerScenario: 5 });
    const ids = variants.map((v) => v.edgeClass);
    expect(ids).toContain('empty-cart');
    expect(ids).toContain('payment-declined');
  });

  it('only filter limits variants to named classes', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/checkout', filePath: 'x', intent: 'checkout', intentConfidence: 1,
        fields: [{ name: 'email', type: 'email', required: true }] }],
    });
    const variants = enumerateEdgeVariants(mkScenario(), snapshot, {
      maxPerScenario: 5,
      only: ['invalid-email'],
    });
    expect(variants).toHaveLength(1);
    expect(variants[0].edgeClass).toBe('invalid-email');
  });

  it('enumerateAllEdgeVariants caps the run total', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/checkout', filePath: 'x', intent: 'checkout', intentConfidence: 1,
        fields: [{ name: 'email', type: 'email', required: true }] }],
      vocabulary: { routes: [], elements: [], deps: ['stripe'] },
    });
    const scenarios = [mkScenario(), mkScenario({ id: 'x2', journey: 'cart-edit' }), mkScenario({ id: 'x3', journey: 'search-filter' })];
    const all = enumerateAllEdgeVariants(scenarios, snapshot, { maxPerScenario: 3, maxPerRun: 4 });
    expect(all.length).toBeLessThanOrEqual(4);
  });

  it('skips scenarios that are not happy variants', () => {
    const snapshot = mkSnapshot();
    const happy = mkScenario();
    const edge = mkScenario({ id: 'x', variant: 'edge:invalid-email' });
    const all = enumerateAllEdgeVariants([happy, edge], snapshot, { maxPerScenario: 5 });
    const parents = new Set(all.map((a) => a.parentScenarioId));
    expect(parents).toEqual(new Set([happy.id]));
  });
});

describe('edge variants on real fixtures', () => {
  it('ecommerce-prisma produces at least 3 edge variants', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'ecommerce-prisma'));
    const guesses = classifyApp(snapshot);
    const happy = generateScenarios(snapshot, guesses);
    const edges = enumerateAllEdgeVariants(happy, snapshot, { maxPerScenario: 3, maxPerRun: 40 });
    expect(edges.length).toBeGreaterThanOrEqual(3);
    expect(edges.every((e) => e.variant !== 'happy')).toBe(true);
  }, 30000);

  it('saas-drizzle produces edge variants for the sign-in flow', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'saas-drizzle'));
    const guesses = classifyApp(snapshot);
    const happy = generateScenarios(snapshot, guesses);
    const edges = enumerateAllEdgeVariants(happy, snapshot, { maxPerScenario: 3 });
    expect(edges.length).toBeGreaterThan(0);
  }, 30000);
});
