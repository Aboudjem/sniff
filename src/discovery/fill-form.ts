import type { Page, Locator } from 'playwright';
import type { Persona } from './scenarios/personas.js';
import type { EdgeOverrides } from './scenarios/types.js';

export interface FilledField {
  selector: string;
  value: string;
  kind: string;
}

interface FieldMetadata {
  name: string;
  type: string;
  placeholder: string;
  ariaLabel: string;
  tag: string;
  required: boolean;
}

async function getFieldMetadata(locator: Locator): Promise<FieldMetadata> {
  return await locator.evaluate((node) => {
    const e = node as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    return {
      name: e.getAttribute('name') ?? '',
      type: e.getAttribute('type') ?? e.tagName.toLowerCase(),
      placeholder: e.getAttribute('placeholder') ?? '',
      ariaLabel: e.getAttribute('aria-label') ?? '',
      tag: e.tagName.toLowerCase(),
      required: e.hasAttribute('required') || e.getAttribute('aria-required') === 'true',
    };
  });
}

function pickValueForField(
  meta: FieldMetadata,
  persona: Persona,
  overrides?: EdgeOverrides,
): { value: string; kind: string } | null {
  const hay = `${meta.name} ${meta.type} ${meta.placeholder} ${meta.ariaLabel}`.toLowerCase();
  const val = (k: string) => persona.values[k];
  const isCardField = /card ?number|cardnumber|ccnum|cc.?num/.test(hay);

  if (meta.type === 'email' || /email/.test(hay)) {
    const v = overrides?.emailValue ?? val('email');
    if (v !== undefined) return { value: v, kind: 'email' };
  }
  if (meta.type === 'password' || /password/.test(hay)) {
    const v = val('password');
    if (v) return { value: v, kind: 'password' };
  }
  if (meta.type === 'tel' || /phone|tel\b/.test(hay)) {
    const v = val('phone');
    if (v) return { value: v, kind: 'phone' };
  }
  if (isCardField) {
    const v = overrides?.cardNumber ?? val('card.number');
    if (v) return { value: v, kind: 'cardNumber' };
  }
  if (meta.type === 'number' || /quantity|amount|count/.test(hay)) {
    const v = overrides?.numericValue;
    if (v !== undefined) return { value: v, kind: 'numeric' };
  }
  if (/full ?name|your name|fullname/.test(hay) || (meta.name.toLowerCase() === 'name')) {
    const v = val('fullName');
    if (v) return { value: v, kind: 'fullName' };
  }
  if (/first ?name|firstname|given/.test(hay)) {
    const v = val('firstName');
    if (v) return { value: v, kind: 'firstName' };
  }
  if (/last ?name|lastname|surname|family/.test(hay)) {
    const v = val('lastName');
    if (v) return { value: v, kind: 'lastName' };
  }
  if (/address|street/.test(hay)) {
    const v = val('shipping.address');
    if (v) return { value: v, kind: 'address' };
  }
  if (/city/.test(hay)) {
    const v = val('shipping.city');
    if (v) return { value: v, kind: 'city' };
  }
  if (/state|region|province/.test(hay)) {
    const v = val('shipping.state');
    if (v) return { value: v, kind: 'state' };
  }
  if (/zip|postal|postcode/.test(hay)) {
    const v = val('shipping.zip');
    if (v) return { value: v, kind: 'zip' };
  }
  if (/country/.test(hay)) {
    const v = val('shipping.country');
    if (v) return { value: v, kind: 'country' };
  }
  if (/cvv|cvc|security code/.test(hay)) {
    const v = val('card.cvv');
    if (v) return { value: v, kind: 'cvv' };
  }
  if (/expiry|expir|exp.?month|exp.?year|mm.?yy/.test(hay)) {
    const v = val('card.exp');
    if (v) return { value: v, kind: 'expiry' };
  }
  if (/search|query|keywords?/.test(hay)) {
    const v = val('query');
    if (v) return { value: v, kind: 'query' };
  }

  if (overrides?.textValue !== undefined && (meta.tag === 'input' || meta.tag === 'textarea')) {
    return { value: overrides.textValue, kind: 'text-override' };
  }

  return null;
}

function shouldSkipField(meta: FieldMetadata, overrides?: EdgeOverrides): boolean {
  if (!overrides) return false;
  if (overrides.skipRequired && meta.required) return true;
  if (overrides.skipField && overrides.skipField === meta.name) return true;
  return false;
}

export async function fillFormWithPersona(
  page: Page,
  persona: Persona,
  overrides?: EdgeOverrides,
): Promise<FilledField[]> {
  const filled: FilledField[] = [];

  if (overrides?.emptyAll) {
    return filled;
  }

  const inputs = page.locator('input:not([type="submit"]):not([type="hidden"]):not([type="button"]), textarea');
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    const locator = inputs.nth(i);
    try {
      const visible = await locator.isVisible();
      if (!visible) continue;
      const meta = await getFieldMetadata(locator);
      if (shouldSkipField(meta, overrides)) continue;
      const pick = pickValueForField(meta, persona, overrides);
      if (!pick) continue;
      await locator.fill(pick.value, { timeout: 3000 });
      filled.push({
        selector: meta.name ? `[name="${meta.name}"]` : `input:nth(${i})`,
        value: pick.value,
        kind: pick.kind,
      });
    } catch {
      continue;
    }
  }

  return filled;
}
