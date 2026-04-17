import type { JourneyTemplate } from '../../types.js';

export const browseToPurchase: JourneyTemplate = {
  journey: 'browse-to-purchase',
  appType: 'ecommerce',
  name: 'Browse products, add to cart, checkout',
  persona: 'new-customer',
  tags: ['smoke', 'core-flow', 'revenue'],
  requires: {
    forms: ['checkout'],
    routeTokens: ['cart', 'checkout'],
  },
  goal: {
    kind: 'url',
    value: 'confirmation|thank-you|order',
    description: 'Reach the order-confirmation page after a successful purchase',
  },
  expectedDurationMs: 45000,
  steps: [
    {
      n: 1,
      intent: 'Open the home page',
      action: 'navigate',
      url: '/',
      expect: [{ kind: 'text-visible', value: 'Shop|Products|Menu|Browse' }],
    },
    {
      n: 2,
      intent: 'Navigate to the product listing',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="nav-shop"]',
          'a[href*="/products"]',
          'a[href*="/shop"]',
        ],
        fallbackRoleText: { role: 'link', name: 'Shop|Products|Menu|Browse' },
      },
      expect: [{ kind: 'url-matches', value: 'products|shop|menu' }],
      optional: true,
    },
    {
      n: 3,
      intent: 'Select the first product',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="product-card"]',
          'article a[href*="/product"]',
          'a[href*="/product/"]',
        ],
        fallbackRoleText: { role: 'article', name: '' },
      },
    },
    {
      n: 4,
      intent: 'Add the product to the cart',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="add-to-cart"]',
          'button[data-action="add-to-cart"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Add to Cart|Add to bag|Add' },
      },
    },
    {
      n: 5,
      intent: 'Open the cart',
      action: 'navigate',
      url: '/cart',
    },
    {
      n: 6,
      intent: 'Proceed to checkout',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="checkout-button"]',
          '[data-testid="checkout-link"]',
          'a[href*="/checkout"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Checkout' },
      },
      expect: [{ kind: 'url-matches', value: 'checkout' }],
    },
    {
      n: 7,
      intent: 'Fill the checkout form',
      action: 'fill-form',
      payload: { kind: 'persona', value: 'new-customer' },
    },
    {
      n: 8,
      intent: 'Place the order',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="place-order"]',
          'button[type="submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Place order|Pay|Complete purchase' },
      },
      expect: [
        { kind: 'url-matches', value: 'confirmation|thank-you|order' },
      ],
    },
  ],
};
