import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { generateScenarios, serializeScenarios } from './index.js';
import { extractDomainSnapshot } from '../domain/index.js';
import { classifyApp } from '../classifier/index.js';
import type { AppTypeGuess } from '../classifier/types.js';
import type { DomainSnapshot } from '../types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', '..', '..', 'sniff-tests', 'fixtures');

function mkSnapshot(partial: Partial<DomainSnapshot>): DomainSnapshot {
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

function guess(type: AppTypeGuess['type'], confidence = 0.5): AppTypeGuess {
  return { type, confidence, evidence: [], rawScore: 0 };
}

describe('generateScenarios (synthetic)', () => {
  it('emits ecommerce browse-to-purchase when requires satisfied', () => {
    const snapshot = mkSnapshot({
      forms: [
        {
          route: '/checkout',
          filePath: 'x',
          intent: 'checkout',
          intentConfidence: 0.8,
          fields: [],
        },
      ],
      vocabulary: { routes: ['cart', 'checkout', 'products'], elements: [], deps: [] },
    });

    const scenarios = generateScenarios(snapshot, [guess('ecommerce')]);
    expect(scenarios.some((s) => s.journey === 'browse-to-purchase')).toBe(true);
  });

  it('skips scenarios when forms requirement missing', () => {
    const snapshot = mkSnapshot({
      vocabulary: { routes: ['cart', 'checkout'], elements: [], deps: [] },
    });
    const scenarios = generateScenarios(snapshot, [guess('ecommerce')]);
    expect(scenarios.some((s) => s.journey === 'browse-to-purchase')).toBe(false);
  });

  it('skips scenarios when app type is not in guesses', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/checkout', filePath: 'x', intent: 'checkout', intentConfidence: 1, fields: [] }],
      vocabulary: { routes: ['cart', 'checkout'], elements: [], deps: [] },
    });
    const scenarios = generateScenarios(snapshot, [guess('booking')]);
    expect(scenarios).toEqual([]);
  });

  it('reindexes step numbers sequentially', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/login', filePath: 'x', intent: 'sign-in', intentConfidence: 1, fields: [] }],
    });
    const scenarios = generateScenarios(snapshot, [guess('auth-only')]);
    const s = scenarios.find((sc) => sc.journey === 'sign-in')!;
    expect(s.steps.map((st) => st.n)).toEqual(Array.from({ length: s.steps.length }, (_, i) => i + 1));
  });

  it('attaches default validations', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/login', filePath: 'x', intent: 'sign-in', intentConfidence: 1, fields: [] }],
    });
    const scenarios = generateScenarios(snapshot, [guess('auth-only')]);
    const s = scenarios[0];
    expect(s.validations.perStep.length).toBeGreaterThan(0);
    expect(s.validations.perScenario.some((v) => v.kind === 'full-page-axe')).toBe(true);
  });

  it('defaults realism to casual-user', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/login', filePath: 'x', intent: 'sign-in', intentConfidence: 1, fields: [] }],
    });
    const scenarios = generateScenarios(snapshot, [guess('auth-only')]);
    expect(scenarios[0].realism).toBe('casual-user');
  });

  it('honors realism override', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/login', filePath: 'x', intent: 'sign-in', intentConfidence: 1, fields: [] }],
    });
    const scenarios = generateScenarios(snapshot, [guess('auth-only')], { realism: 'robot' });
    expect(scenarios[0].realism).toBe('robot');
  });

  it('gives each scenario a stable id', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/login', filePath: 'x', intent: 'sign-in', intentConfidence: 1, fields: [] }],
    });
    const scenarios = generateScenarios(snapshot, [guess('auth-only')]);
    expect(scenarios[0].id).toMatch(/^auth-only\.sign-in\.happy$/);
  });
});

describe('serializeScenarios', () => {
  it('returns valid JSON', () => {
    const snapshot = mkSnapshot({
      forms: [{ route: '/login', filePath: 'x', intent: 'sign-in', intentConfidence: 1, fields: [] }],
    });
    const scenarios = generateScenarios(snapshot, [guess('auth-only')]);
    const json = serializeScenarios(scenarios);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
  });
});

describe('generateScenarios (real fixtures)', () => {
  it('ecommerce-prisma produces a browse-to-purchase scenario', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'ecommerce-prisma'));
    const guesses = classifyApp(snapshot);
    const scenarios = generateScenarios(snapshot, guesses);
    expect(scenarios.some((s) => s.journey === 'browse-to-purchase')).toBe(true);
    const bp = scenarios.find((s) => s.journey === 'browse-to-purchase')!;
    expect(bp.steps.length).toBeGreaterThanOrEqual(5);
    expect(bp.goal.value).toMatch(/confirmation|thank-you|order/);
  }, 30000);

  it('saas-drizzle produces sign-up and sign-in scenarios', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'saas-drizzle'));
    const guesses = classifyApp(snapshot);
    const scenarios = generateScenarios(snapshot, guesses);
    const journeys = scenarios.map((s) => s.journey);
    expect(journeys).toContain('sign-in');
    expect(journeys).toContain('sign-up-to-dashboard');
  }, 30000);

  it('booking-typeorm produces a search-to-confirmation scenario', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'booking-typeorm'));
    const guesses = classifyApp(snapshot);
    const scenarios = generateScenarios(snapshot, guesses);
    expect(scenarios.some((s) => s.journey === 'search-to-confirmation')).toBe(true);
  }, 30000);
});
