import type { JourneyTemplate } from '../../types.js';

export const subscribe: JourneyTemplate = {
  journey: 'subscribe',
  appType: 'content',
  name: 'Visitor subscribes to the newsletter',
  persona: 'anonymous',
  tags: ['smoke'],
  requires: {
    forms: ['subscribe'],
  },
  goal: {
    kind: 'text',
    value: 'subscribed|thank you|check your email',
    description: 'Confirmation that the subscription worked',
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
      intent: 'Type the email into the newsletter input',
      action: 'fill',
      target: {
        selectorHints: [
          '[data-testid="newsletter-email"]',
          'input[type="email"][name*="newsletter"]',
          'form[action*="subscribe"] input[type="email"]',
          'input[type="email"]',
        ],
      },
      payload: { kind: 'persona', value: 'email' },
    },
    {
      n: 3,
      intent: 'Submit',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Subscribe|Sign me up' },
      },
      expect: [{ kind: 'text-visible', value: 'subscribed|thank you|check your email' }],
    },
  ],
};
