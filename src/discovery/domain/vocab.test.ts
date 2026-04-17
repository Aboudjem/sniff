import { describe, it, expect } from 'vitest';
import {
  extractRouteVocabulary,
  extractElementVocabulary,
} from './vocab.js';
import type { RouteInfo, ElementInfo } from '../../analyzers/types.js';

function mkRoute(path: string): RouteInfo {
  return { path, filePath: 'a.tsx', framework: 'nextjs-app', dynamic: false };
}

function mkElement(partial: Partial<ElementInfo> & Pick<ElementInfo, 'tag'>): ElementInfo {
  return { filePath: 'x.tsx', line: 1, ...partial };
}

describe('extractRouteVocabulary', () => {
  it('tokenizes route paths and drops stopwords', () => {
    const tokens = extractRouteVocabulary([
      mkRoute('/products/[id]'),
      mkRoute('/cart'),
      mkRoute('/checkout'),
    ]);
    expect(tokens).toContain('products');
    expect(tokens).toContain('cart');
    expect(tokens).toContain('checkout');
    expect(tokens).not.toContain('');
    expect(tokens).not.toContain('id');
  });

  it('ranks frequent tokens first', () => {
    const tokens = extractRouteVocabulary([
      mkRoute('/orders'),
      mkRoute('/orders/new'),
      mkRoute('/orders/[id]'),
      mkRoute('/cart'),
    ]);
    expect(tokens[0]).toBe('orders');
  });
});

describe('extractElementVocabulary', () => {
  it('extracts tokens from text, ariaLabel, and name', () => {
    const tokens = extractElementVocabulary([
      mkElement({ tag: 'button', text: 'Add to cart' }),
      mkElement({ tag: 'button', text: 'Checkout now' }),
      mkElement({ tag: 'input', ariaLabel: 'Email address' }),
      mkElement({ tag: 'input', name: 'cardNumber' }),
    ]);
    expect(tokens).toContain('cart');
    expect(tokens).toContain('checkout');
    expect(tokens).toContain('email');
    expect(tokens).toContain('cardnumber');
  });

  it('strips stopwords and short tokens', () => {
    const tokens = extractElementVocabulary([
      mkElement({ tag: 'a', text: 'Go to the shop' }),
    ]);
    expect(tokens).toContain('shop');
    expect(tokens).not.toContain('to');
    expect(tokens).not.toContain('the');
  });
});
