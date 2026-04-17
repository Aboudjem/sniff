import type { JourneyTemplate } from '../../types.js';

export const resetPassword: JourneyTemplate = {
  journey: 'reset-password',
  appType: 'auth-only',
  name: 'Request a password reset link',
  persona: 'returning-user',
  tags: ['auth'],
  requires: {
    routeTokens: ['forgot', 'reset'],
  },
  goal: {
    kind: 'text',
    value: 'check your email|link sent|reset link',
    description: 'Confirmation that a reset email was sent',
  },
  steps: [
    {
      n: 1,
      intent: 'Open the forgot-password page',
      action: 'navigate',
      url: '/forgot-password',
    },
    {
      n: 2,
      intent: 'Enter the email',
      action: 'fill',
      target: {
        selectorHints: ['input[type="email"]', 'input[name="email"]'],
      },
      payload: { kind: 'persona', value: 'email' },
    },
    {
      n: 3,
      intent: 'Submit',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Reset|Send' },
      },
      expect: [{ kind: 'text-visible', value: 'check your email|link sent|reset link' }],
    },
  ],
};
