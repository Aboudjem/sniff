import type { JourneyTemplate } from '../../types.js';

export const signIn: JourneyTemplate = {
  journey: 'sign-in',
  appType: 'auth-only',
  name: 'Existing user signs in',
  persona: 'returning-user',
  tags: ['smoke', 'auth'],
  requires: {
    forms: ['sign-in'],
  },
  goal: {
    kind: 'url',
    value: 'dashboard|home|app|feed|/$',
    description: 'User reaches a landing target after successful sign in',
  },
  steps: [
    {
      n: 1,
      intent: 'Open the sign-in page',
      action: 'navigate',
      url: '/login',
    },
    {
      n: 2,
      intent: 'Fill the sign-in form',
      action: 'fill-form',
      payload: { kind: 'persona', value: 'returning-user' },
    },
    {
      n: 3,
      intent: 'Submit',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="login-submit"]',
          'button[type="submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Sign in|Log in' },
      },
    },
  ],
};
