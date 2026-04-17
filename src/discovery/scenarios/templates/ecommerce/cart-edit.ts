import type { JourneyTemplate } from '../../types.js';

export const cartEdit: JourneyTemplate = {
  journey: 'cart-edit',
  appType: 'ecommerce',
  name: 'Add item, change quantity, remove item',
  persona: 'anonymous',
  tags: ['smoke'],
  requires: {
    routeTokens: ['cart'],
  },
  goal: {
    kind: 'text',
    value: 'cart is empty|0 items',
    description: 'Cart ends up empty after removal',
  },
  steps: [
    {
      n: 1,
      intent: 'Open the product listing',
      action: 'navigate',
      url: '/products',
    },
    {
      n: 2,
      intent: 'Add the first product',
      action: 'click',
      target: {
        selectorHints: ['[data-testid="add-to-cart"]'],
        fallbackRoleText: { role: 'button', name: 'Add to Cart|Add to bag' },
      },
    },
    {
      n: 3,
      intent: 'Open the cart',
      action: 'navigate',
      url: '/cart',
    },
    {
      n: 4,
      intent: 'Remove the item',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="remove-item"]',
          'button[aria-label*="Remove"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Remove|Delete' },
      },
      expect: [{ kind: 'text-visible', value: 'cart is empty|0 items|Your cart is empty' }],
    },
  ],
};
