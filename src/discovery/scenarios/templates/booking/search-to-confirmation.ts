import type { JourneyTemplate } from '../../types.js';

export const searchToConfirmation: JourneyTemplate = {
  journey: 'search-to-confirmation',
  appType: 'booking',
  name: 'Search availability, select option, confirm booking',
  persona: 'new-customer',
  tags: ['smoke', 'core-flow', 'revenue'],
  requires: {
    routeTokens: ['book'],
  },
  goal: {
    kind: 'url',
    value: 'confirmation|confirmed|booking/\\w',
    description: 'Reach a booking-confirmation page',
  },
  expectedDurationMs: 45000,
  steps: [
    {
      n: 1,
      intent: 'Open the home page',
      action: 'navigate',
      url: '/',
    },
    {
      n: 2,
      intent: 'Submit the availability search',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="search-submit"]',
          'button[type="submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Search|Find' },
      },
      optional: true,
    },
    {
      n: 3,
      intent: 'Open the first listing',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="listing-card"]',
          'article a',
          'a[href*="/listing"]',
        ],
        fallbackRoleText: { role: 'link', name: 'Book|View' },
      },
    },
    {
      n: 4,
      intent: 'Start the booking',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="book-now"]',
        ],
        fallbackRoleText: { role: 'link', name: 'Book now|Reserve' },
      },
    },
    {
      n: 5,
      intent: 'Fill the booking form',
      action: 'fill-form',
      payload: { kind: 'persona', value: 'new-customer' },
    },
    {
      n: 6,
      intent: 'Confirm and pay',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="confirm-booking"]',
          'button[type="submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Confirm|Pay|Book' },
      },
      expect: [{ kind: 'url-matches', value: 'confirmation|confirmed|booking' }],
    },
  ],
};
