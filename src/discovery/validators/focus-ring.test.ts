import { describe, it, expect, vi } from 'vitest';
import type { Page } from 'playwright';
import { hasVisibleFocusIndicator, validateFocusRing, type FocusProbe } from './focus-ring.js';

function probe(overrides: Partial<FocusProbe> = {}): FocusProbe {
  return {
    focusable: true,
    blurredOutlineWidth: '0px',
    blurredOutlineStyle: 'none',
    blurredBoxShadow: 'none',
    focusedOutlineWidth: '0px',
    focusedOutlineStyle: 'none',
    focusedBoxShadow: 'none',
    ...overrides,
  };
}

describe('hasVisibleFocusIndicator', () => {
  it('returns true when outline becomes visible on focus', () => {
    expect(hasVisibleFocusIndicator(probe({
      focusedOutlineWidth: '2px',
      focusedOutlineStyle: 'solid',
    }))).toBe(true);
  });

  it('returns true when box-shadow changes on focus', () => {
    expect(hasVisibleFocusIndicator(probe({
      blurredBoxShadow: 'none',
      focusedBoxShadow: '0 0 0 3px rgba(0,0,0,0.2)',
    }))).toBe(true);
  });

  it('returns false when focus state has no visible indicator', () => {
    expect(hasVisibleFocusIndicator(probe())).toBe(false);
  });

  it('returns false when outline is 0px even with solid style', () => {
    expect(hasVisibleFocusIndicator(probe({
      focusedOutlineWidth: '0px',
      focusedOutlineStyle: 'solid',
    }))).toBe(false);
  });

  it('returns false when box-shadow is unchanged', () => {
    expect(hasVisibleFocusIndicator(probe({
      blurredBoxShadow: 'inset 0 0 0 1px red',
      focusedBoxShadow: 'inset 0 0 0 1px red',
    }))).toBe(false);
  });
});

function makeLocatorWithProbe(result: FocusProbe | { focusable: false } | Error) {
  const locator = {
    first: () => locator,
    evaluate: vi.fn(async () => {
      if (result instanceof Error) throw result;
      return result;
    }),
  };
  return locator;
}

function makeFakePage(locator: ReturnType<typeof makeLocatorWithProbe>): Page {
  return { locator: vi.fn(() => locator) } as unknown as Page;
}

describe('validateFocusRing', () => {
  it('returns pass when resolvedSelector is null', async () => {
    const outcome = await validateFocusRing({} as Page, null);
    expect(outcome.passed).toBe(true);
    expect(outcome.kind).toBe('focus-ring');
  });

  it('returns pass when the element is not focusable', async () => {
    const locator = makeLocatorWithProbe({ focusable: false } as FocusProbe);
    const page = makeFakePage(locator);
    const outcome = await validateFocusRing(page, 'div');
    expect(outcome.passed).toBe(true);
  });

  it('returns pass when focus state reveals an outline', async () => {
    const locator = makeLocatorWithProbe(probe({
      focusedOutlineWidth: '2px',
      focusedOutlineStyle: 'solid',
    }));
    const outcome = await validateFocusRing(makeFakePage(locator), 'button');
    expect(outcome.passed).toBe(true);
  });

  it('returns fail when focus state has no visible indicator', async () => {
    const locator = makeLocatorWithProbe(probe());
    const outcome = await validateFocusRing(makeFakePage(locator), 'button');
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain('no visible focus state');
  });

  it('returns fail when evaluate throws', async () => {
    const locator = makeLocatorWithProbe(new Error('detached'));
    const outcome = await validateFocusRing(makeFakePage(locator), 'button');
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain('detached');
  });
});
