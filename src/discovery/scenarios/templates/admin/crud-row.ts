import type { JourneyTemplate } from '../../types.js';

export const crudRow: JourneyTemplate = {
  journey: 'crud-row',
  appType: 'admin',
  name: 'Admin creates, edits, and deletes a row',
  persona: 'returning-user',
  tags: ['smoke', 'core-flow'],
  requires: {
    forms: ['sign-in'],
    routeTokens: ['admin'],
  },
  goal: {
    kind: 'text',
    value: 'deleted|removed',
    description: 'Row deleted successfully',
  },
  expectedDurationMs: 60000,
  steps: [
    {
      n: 1,
      intent: 'Sign in',
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
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Sign in|Log in' },
      },
    },
    {
      n: 4,
      intent: 'Open the admin area',
      action: 'navigate',
      url: '/admin',
    },
    {
      n: 5,
      intent: 'Open the create-row dialog',
      action: 'click',
      target: {
        selectorHints: ['[data-testid="create-row"]'],
        fallbackRoleText: { role: 'button', name: 'New|Create|Add' },
      },
    },
    {
      n: 6,
      intent: 'Fill the first text input',
      action: 'fill',
      target: {
        selectorHints: ['input[type="text"]:not([disabled])'],
      },
      payload: { kind: 'literal', value: 'Sniff QA test row' },
    },
    {
      n: 7,
      intent: 'Save the row',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Save|Create' },
      },
    },
    {
      n: 8,
      intent: 'Delete the row',
      action: 'click',
      target: {
        selectorHints: ['[data-testid="delete-row"]'],
        fallbackRoleText: { role: 'button', name: 'Delete|Remove' },
      },
      expect: [{ kind: 'text-visible', value: 'deleted|removed' }],
    },
  ],
};
