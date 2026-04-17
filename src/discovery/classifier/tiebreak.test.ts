import { describe, it, expect } from 'vitest';
import { needsTieBreak, tieBreakClassification } from './tiebreak.js';
import type { AppTypeGuess } from './types.js';
import type { DomainSnapshot } from '../types.js';
import type { DiscoveryLLM, LLMCompleteRequest } from '../llm/types.js';

function g(type: AppTypeGuess['type'], confidence: number): AppTypeGuess {
  return { type, confidence, evidence: [], rawScore: confidence * 10 };
}

function stubSnapshot(): DomainSnapshot {
  return {
    project: { name: 'x', frameworks: [], rootDir: '/tmp/x' },
    routes: [],
    forms: [],
    entities: [],
    relations: [],
    apiEndpoints: [],
    vocabulary: { routes: [], elements: [], deps: [] },
    metadata: { analyzedAt: '2026-04-17T00:00:00.000Z', duration: 0 },
  };
}

class StubLLM implements DiscoveryLLM {
  readonly name = 'stub';
  public lastRequest?: LLMCompleteRequest;
  constructor(private readonly response: string) {}
  async available(): Promise<boolean> { return true; }
  async complete(request: LLMCompleteRequest): Promise<string> {
    this.lastRequest = request;
    return this.response;
  }
}

describe('needsTieBreak', () => {
  it('is false with fewer than two guesses', () => {
    expect(needsTieBreak([])).toBe(false);
    expect(needsTieBreak([g('ecommerce', 0.8)])).toBe(false);
  });

  it('is true when the top two are within the threshold', () => {
    expect(needsTieBreak([g('ecommerce', 0.6), g('saas', 0.55)])).toBe(true);
  });

  it('is false when the top is well ahead', () => {
    expect(needsTieBreak([g('ecommerce', 0.8), g('saas', 0.5)])).toBe(false);
  });
});

describe('tieBreakClassification', () => {
  it('returns guesses unchanged when no tie-break is needed', async () => {
    const guesses = [g('ecommerce', 0.8), g('saas', 0.3)];
    const llm = new StubLLM('saas');
    const out = await tieBreakClassification(guesses, stubSnapshot(), llm);
    expect(out).toEqual(guesses);
    expect(llm.lastRequest).toBeUndefined();
  });

  it('promotes the LLM-chosen type to the front', async () => {
    const guesses = [g('ecommerce', 0.6), g('saas', 0.58), g('booking', 0.2)];
    const llm = new StubLLM('saas');
    const out = await tieBreakClassification(guesses, stubSnapshot(), llm);
    expect(out[0]?.type).toBe('saas');
    expect(out[1]?.type).toBe('ecommerce');
  });

  it('ignores responses outside the candidate set', async () => {
    const guesses = [g('ecommerce', 0.6), g('saas', 0.58)];
    const llm = new StubLLM('totally-made-up');
    const out = await tieBreakClassification(guesses, stubSnapshot(), llm);
    expect(out[0]?.type).toBe('ecommerce');
  });

  it('falls back silently when the LLM throws', async () => {
    const guesses = [g('ecommerce', 0.6), g('saas', 0.58)];
    const llm: DiscoveryLLM = {
      name: 'broken',
      available: async () => true,
      complete: async () => {
        throw new Error('boom');
      },
    };
    const out = await tieBreakClassification(guesses, stubSnapshot(), llm);
    expect(out).toEqual(guesses);
  });

  it('tolerates noisy LLM output (whitespace, punctuation)', async () => {
    const guesses = [g('ecommerce', 0.6), g('saas', 0.58)];
    const llm = new StubLLM('  saas.\n');
    const out = await tieBreakClassification(guesses, stubSnapshot(), llm);
    expect(out[0]?.type).toBe('saas');
  });
});
