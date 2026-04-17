import type { Page, Locator } from 'playwright';
import type { SelectorTarget } from './scenarios/types.js';

export interface ResolvedTarget {
  selector: string;
  locator: Locator;
}

const VISIBILITY_TIMEOUT_MS = 1500;

async function tryLocator(locator: Locator): Promise<boolean> {
  try {
    await locator.first().waitFor({ state: 'visible', timeout: VISIBILITY_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

function splitAlternatives(value: string): string[] {
  return value.split('|').map((s) => s.trim()).filter(Boolean);
}

export async function resolveTarget(
  page: Page,
  target: SelectorTarget,
): Promise<ResolvedTarget | null> {
  for (const hint of target.selectorHints) {
    const locator = page.locator(hint);
    if (await tryLocator(locator)) {
      return { selector: hint, locator };
    }
  }

  if (target.fallbackRoleText) {
    const { role, name } = target.fallbackRoleText;
    const alternatives = name ? splitAlternatives(name) : [''];
    for (const altName of alternatives) {
      const locator = altName
        ? page.getByRole(role as Parameters<typeof page.getByRole>[0], { name: new RegExp(altName, 'i') })
        : page.getByRole(role as Parameters<typeof page.getByRole>[0]);
      if (await tryLocator(locator)) {
        return {
          selector: altName ? `role=${role}[name=/${altName}/i]` : `role=${role}`,
          locator,
        };
      }
    }
  }

  return null;
}
