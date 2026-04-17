import { describe, it, expect } from 'vitest';
import { extractForms } from './forms.js';
import type { ComponentInfo, RouteInfo, ElementInfo } from '../../analyzers/types.js';

function mkElement(partial: Partial<ElementInfo> & Pick<ElementInfo, 'tag'>): ElementInfo {
  return {
    filePath: partial.filePath ?? 'comp.tsx',
    line: 1,
    ...partial,
  };
}

function mkComponent(name: string, filePath: string, elements: ElementInfo[]): ComponentInfo {
  return {
    name,
    filePath,
    exports: [],
    hasDefaultExport: true,
    elements,
    routes: [],
  };
}

function mkRoute(path: string, filePath: string): RouteInfo {
  return { path, filePath, framework: 'nextjs-app', dynamic: false };
}

describe('extractForms', () => {
  it('classifies a sign-in form', () => {
    const component = mkComponent('Login', 'app/login/page.tsx', [
      mkElement({ tag: 'input', name: 'email', type: 'email' }),
      mkElement({ tag: 'input', name: 'password', type: 'password' }),
      mkElement({ tag: 'button', text: 'Sign in', type: 'submit' }),
    ]);
    const routes = [mkRoute('/login', 'app/login/page.tsx')];

    const forms = extractForms([component], routes);
    expect(forms).toHaveLength(1);
    expect(forms[0].intent).toBe('sign-in');
    expect(forms[0].intentConfidence).toBeGreaterThan(0.3);
    expect(forms[0].route).toBe('/login');
  });

  it('classifies a sign-up form (email + password + name)', () => {
    const component = mkComponent('Signup', 'app/signup/page.tsx', [
      mkElement({ tag: 'input', name: 'name', type: 'text' }),
      mkElement({ tag: 'input', name: 'email', type: 'email' }),
      mkElement({ tag: 'input', name: 'password', type: 'password' }),
      mkElement({ tag: 'button', text: 'Create account', type: 'submit' }),
    ]);
    const routes = [mkRoute('/signup', 'app/signup/page.tsx')];

    const forms = extractForms([component], routes);
    expect(forms[0].intent).toBe('sign-up');
  });

  it('classifies a checkout form', () => {
    const component = mkComponent('Checkout', 'app/checkout/page.tsx', [
      mkElement({ tag: 'input', name: 'email', type: 'email' }),
      mkElement({ tag: 'input', name: 'fullName', type: 'text' }),
      mkElement({ tag: 'input', name: 'cardNumber', type: 'text' }),
      mkElement({ tag: 'input', name: 'cvv', type: 'text' }),
      mkElement({ tag: 'input', name: 'expiry', type: 'text' }),
      mkElement({ tag: 'button', text: 'Place order', type: 'submit' }),
    ]);
    const routes = [mkRoute('/checkout', 'app/checkout/page.tsx')];

    const forms = extractForms([component], routes);
    expect(forms[0].intent).toBe('checkout');
  });

  it('classifies a search form', () => {
    const component = mkComponent('Search', 'app/search/page.tsx', [
      mkElement({ tag: 'input', name: 'q', type: 'search' }),
      mkElement({ tag: 'button', text: 'Search', type: 'submit' }),
    ]);
    const routes = [mkRoute('/search', 'app/search/page.tsx')];

    const forms = extractForms([component], routes);
    expect(forms[0].intent).toBe('search');
  });

  it('classifies a contact form', () => {
    const component = mkComponent('Contact', 'app/contact/page.tsx', [
      mkElement({ tag: 'input', name: 'name', type: 'text' }),
      mkElement({ tag: 'input', name: 'email', type: 'email' }),
      mkElement({ tag: 'input', name: 'subject', type: 'text' }),
      mkElement({ tag: 'textarea', name: 'message' }),
      mkElement({ tag: 'button', text: 'Send message', type: 'submit' }),
    ]);
    const routes = [mkRoute('/contact', 'app/contact/page.tsx')];

    const forms = extractForms([component], routes);
    expect(forms[0].intent).toBe('contact');
  });

  it('returns unknown when no signals match', () => {
    const component = mkComponent('Weird', 'app/weird/page.tsx', [
      mkElement({ tag: 'input', name: 'xyz', type: 'text' }),
    ]);
    const forms = extractForms([component], []);
    expect(forms[0].intent).toBe('unknown');
  });

  it('skips components without input elements', () => {
    const component = mkComponent('Empty', 'app/empty/page.tsx', [
      mkElement({ tag: 'a', text: 'Click me' }),
    ]);
    const forms = extractForms([component], []);
    expect(forms).toEqual([]);
  });

  it('maps route when filePath matches directly', () => {
    const component = mkComponent('X', 'app/checkout/page.tsx', [
      mkElement({ tag: 'input', name: 'email', type: 'email' }),
    ]);
    const routes = [mkRoute('/checkout', 'app/checkout/page.tsx')];
    const forms = extractForms([component], routes);
    expect(forms[0].route).toBe('/checkout');
  });
});
