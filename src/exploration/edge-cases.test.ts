import { describe, it, expect } from 'vitest';
import { EDGE_CASE_PAYLOADS, selectPayload } from './edge-cases.js';
import type { PayloadCategory } from './edge-cases.js';

describe('EDGE_CASE_PAYLOADS', () => {
  it('has all 5 categories', () => {
    const categories = Object.keys(EDGE_CASE_PAYLOADS);
    expect(categories).toContain('xss');
    expect(categories).toContain('sqli');
    expect(categories).toContain('unicode');
    expect(categories).toContain('boundary');
    expect(categories).toContain('specialChars');
    expect(categories).toHaveLength(5);
  });

  it('each category has at least 4 payloads', () => {
    for (const [category, payloads] of Object.entries(EDGE_CASE_PAYLOADS)) {
      expect(payloads.length, `${category} should have at least 4 payloads`).toBeGreaterThanOrEqual(4);
    }
  });

  it('boundary category includes empty string', () => {
    expect(EDGE_CASE_PAYLOADS.boundary).toContain('');
  });

  it('boundary category includes max-length string', () => {
    const hasLongString = EDGE_CASE_PAYLOADS.boundary.some(
      (p) => p.length >= 10000,
    );
    expect(hasLongString).toBe(true);
  });

  it('xss category contains script tag payload', () => {
    const hasScript = EDGE_CASE_PAYLOADS.xss.some((p) =>
      p.includes('<script>'),
    );
    expect(hasScript).toBe(true);
  });

  it('sqli category contains OR injection', () => {
    const hasOr = EDGE_CASE_PAYLOADS.sqli.some((p) => p.includes('OR'));
    expect(hasOr).toBe(true);
  });
});

describe('selectPayload', () => {
  it('rotates through categories based on stepIndex', () => {
    const categories = Object.keys(EDGE_CASE_PAYLOADS) as PayloadCategory[];

    // Step 0 -> first category, step 1 -> second category, etc.
    for (let i = 0; i < categories.length; i++) {
      const result = selectPayload('text', i);
      expect(result.category).toBe(categories[i]);
    }
  });

  it('wraps around categories after exhausting all', () => {
    const categories = Object.keys(EDGE_CASE_PAYLOADS) as PayloadCategory[];
    const result = selectPayload('text', categories.length);
    expect(result.category).toBe(categories[0]);
  });

  it('returns valid value and category for stepIndex 0', () => {
    const result = selectPayload('text', 0);
    expect(result.value).toBeDefined();
    expect(typeof result.value).toBe('string');
    expect(result.category).toBeDefined();
  });

  it('returns valid value and category for stepIndex 1', () => {
    const result = selectPayload('email', 1);
    expect(result.value).toBeDefined();
    expect(typeof result.value).toBe('string');
    expect(result.category).toBeDefined();
  });

  it('returns valid value and category for large stepIndex 100', () => {
    const result = selectPayload('number', 100);
    expect(result.value).toBeDefined();
    expect(typeof result.value).toBe('string');
    expect(Object.keys(EDGE_CASE_PAYLOADS)).toContain(result.category);
  });

  it('returns valid value and category for large stepIndex 999', () => {
    const result = selectPayload('password', 999);
    expect(result.value).toBeDefined();
    expect(typeof result.value).toBe('string');
    expect(Object.keys(EDGE_CASE_PAYLOADS)).toContain(result.category);
  });

  it('cycles through payloads within a category', () => {
    const categories = Object.keys(EDGE_CASE_PAYLOADS) as PayloadCategory[];
    const categoryLen = categories.length;

    // Steps 0, 5, 10 should cycle through payloads in category 0
    const first = selectPayload('text', 0);
    const second = selectPayload('text', categoryLen);
    const third = selectPayload('text', categoryLen * 2);

    expect(first.category).toBe(second.category);
    expect(second.category).toBe(third.category);
    // Second should be a different payload than first (unless only 1 payload)
    if (EDGE_CASE_PAYLOADS[first.category].length > 1) {
      expect(second.value).not.toBe(first.value);
    }
  });
});
