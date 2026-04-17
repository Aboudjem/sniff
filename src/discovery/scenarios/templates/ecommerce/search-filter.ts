import type { JourneyTemplate } from '../../types.js';

export const searchFilter: JourneyTemplate = {
  journey: 'search-filter',
  appType: 'ecommerce',
  name: 'Search for a product from the landing page',
  persona: 'anonymous',
  tags: ['smoke'],
  requires: {
    forms: ['search'],
  },
  goal: {
    kind: 'url',
    value: 'search|results|query',
    description: 'Reach a search-results view',
  },
  steps: [
    {
      n: 1,
      intent: 'Open the home page',
      action: 'navigate',
      url: '/',
    },
    {
      n: 2,
      intent: 'Type a query in the search input',
      action: 'fill',
      target: {
        selectorHints: [
          '[data-testid="search-input"]',
          'input[type="search"]',
          'input[name="q"]',
          'input[name="query"]',
        ],
      },
      payload: { kind: 'persona', value: 'query' },
    },
    {
      n: 3,
      intent: 'Submit the search',
      action: 'click',
      target: {
        selectorHints: [
          'button[type="submit"]',
          '[data-testid="search-submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Search|Find' },
      },
      expect: [{ kind: 'url-matches', value: 'search|results|query' }],
    },
  ],
};
