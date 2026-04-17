import type { JourneyTemplate } from '../../types.js';

export const signUpToDashboard: JourneyTemplate = {
  journey: 'sign-up-to-dashboard',
  appType: 'saas',
  name: 'New user signs up and reaches the dashboard',
  persona: 'new-customer',
  tags: ['smoke', 'core-flow', 'auth'],
  requires: {
    forms: ['sign-up'],
  },
  goal: {
    kind: 'url',
    value: 'dashboard|app|onboarding',
    description: 'User reaches the dashboard or onboarding',
  },
  expectedDurationMs: 45000,
  steps: [
    {
      n: 1,
      intent: 'Open the sign-up page',
      action: 'navigate',
      url: '/signup',
    },
    {
      n: 2,
      intent: 'Fill the sign-up form',
      action: 'fill-form',
      payload: { kind: 'persona', value: 'new-customer' },
    },
    {
      n: 3,
      intent: 'Submit',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="signup-submit"]',
          'button[type="submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Sign up|Create account|Register' },
      },
      expect: [{ kind: 'url-matches', value: 'dashboard|app|onboarding|welcome' }],
    },
  ],
};
