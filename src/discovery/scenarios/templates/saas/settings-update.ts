import type { JourneyTemplate } from '../../types.js';

export const settingsUpdate: JourneyTemplate = {
  journey: 'settings-update',
  appType: 'saas',
  name: 'Signed-in user updates their profile settings',
  persona: 'returning-user',
  tags: ['smoke'],
  requires: {
    routeTokens: ['settings'],
    forms: ['sign-in'],
  },
  goal: {
    kind: 'text',
    value: 'saved|updated|changes saved',
    description: 'Confirmation that settings were saved',
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
      intent: 'Sign in',
      action: 'fill-form',
      payload: { kind: 'persona', value: 'returning-user' },
    },
    {
      n: 3,
      intent: 'Submit sign-in',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Sign in|Log in' },
      },
    },
    {
      n: 4,
      intent: 'Open the settings page',
      action: 'navigate',
      url: '/settings',
    },
    {
      n: 5,
      intent: 'Submit the settings form',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Save|Update|Apply' },
      },
      expect: [{ kind: 'text-visible', value: 'saved|updated|changes saved' }],
    },
  ],
};
