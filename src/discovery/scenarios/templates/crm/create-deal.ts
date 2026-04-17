import type { JourneyTemplate } from '../../types.js';

export const createDeal: JourneyTemplate = {
  journey: 'create-deal',
  appType: 'crm',
  name: 'Signed-in user creates a new deal in the pipeline',
  persona: 'returning-user',
  tags: ['smoke', 'core-flow'],
  requires: {
    forms: ['sign-in'],
    routeTokens: ['deals', 'deal', 'pipeline'],
  },
  goal: {
    kind: 'text',
    value: 'deal created|added to pipeline',
    description: 'New deal appears in the pipeline',
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
      intent: 'Submit',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Sign in|Log in' },
      },
    },
    {
      n: 4,
      intent: 'Open the deals page',
      action: 'navigate',
      url: '/deals',
    },
    {
      n: 5,
      intent: 'Open the create-deal dialog',
      action: 'click',
      target: {
        selectorHints: ['[data-testid="create-deal"]'],
        fallbackRoleText: { role: 'button', name: 'New deal|Create deal|Add deal' },
      },
    },
    {
      n: 6,
      intent: 'Fill the deal title',
      action: 'fill',
      target: {
        selectorHints: ['input[name="title"]', 'input[name="name"]'],
      },
      payload: { kind: 'literal', value: 'Acme Corp Renewal' },
    },
    {
      n: 7,
      intent: 'Save the deal',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Save|Create' },
      },
      expect: [{ kind: 'text-visible', value: 'Acme Corp Renewal|deal created|added' }],
    },
  ],
};
