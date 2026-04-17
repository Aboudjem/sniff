import type { Page } from 'playwright';
import type { ValidationOutcome } from '../run-types.js';

interface FocusProbe {
  focusable: boolean;
  blurredOutlineWidth: string;
  blurredOutlineStyle: string;
  blurredBoxShadow: string;
  focusedOutlineWidth: string;
  focusedOutlineStyle: string;
  focusedBoxShadow: string;
}

function parseOutlinePx(value: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(value);
  return match ? parseFloat(match[1]) : 0;
}

function hasVisibleFocusIndicator(probe: FocusProbe): boolean {
  const widthPx = parseOutlinePx(probe.focusedOutlineWidth);
  const outlineVisible = widthPx > 0 && probe.focusedOutlineStyle !== 'none';
  const shadowChanged = probe.focusedBoxShadow !== probe.blurredBoxShadow && probe.focusedBoxShadow !== 'none';
  return outlineVisible || shadowChanged;
}

export async function validateFocusRing(
  page: Page,
  resolvedSelector: string | null,
): Promise<ValidationOutcome> {
  if (!resolvedSelector) {
    return { kind: 'focus-ring', name: 'target has a visible focus indicator', passed: true };
  }

  try {
    const probe = await page.locator(resolvedSelector).first().evaluate((node): FocusProbe => {
      const el = node as HTMLElement;
      const focusable = (
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.tagName === 'INPUT' ||
        el.tagName === 'SELECT' ||
        el.tagName === 'TEXTAREA' ||
        el.hasAttribute('tabindex')
      );
      if (!focusable) {
        return {
          focusable: false,
          blurredOutlineWidth: '',
          blurredOutlineStyle: '',
          blurredBoxShadow: '',
          focusedOutlineWidth: '',
          focusedOutlineStyle: '',
          focusedBoxShadow: '',
        };
      }
      el.blur();
      const blurred = getComputedStyle(el);
      const blurredOutlineWidth = blurred.outlineWidth;
      const blurredOutlineStyle = blurred.outlineStyle;
      const blurredBoxShadow = blurred.boxShadow;
      el.focus();
      const focused = getComputedStyle(el);
      return {
        focusable: true,
        blurredOutlineWidth,
        blurredOutlineStyle,
        blurredBoxShadow,
        focusedOutlineWidth: focused.outlineWidth,
        focusedOutlineStyle: focused.outlineStyle,
        focusedBoxShadow: focused.boxShadow,
      };
    });

    if (!probe.focusable) {
      return { kind: 'focus-ring', name: 'target has a visible focus indicator', passed: true };
    }

    const passed = hasVisibleFocusIndicator(probe);
    return {
      kind: 'focus-ring',
      name: 'target has a visible focus indicator',
      passed,
      ...(passed ? {} : { detail: `${resolvedSelector} has no visible focus state (outline ${probe.focusedOutlineStyle} ${probe.focusedOutlineWidth}, box-shadow ${probe.focusedBoxShadow})` }),
    };
  } catch (err) {
    return {
      kind: 'focus-ring',
      name: 'target has a visible focus indicator',
      passed: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

export { hasVisibleFocusIndicator };
export type { FocusProbe };
