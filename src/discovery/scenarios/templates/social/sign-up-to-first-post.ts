import type { JourneyTemplate } from '../../types.js';

export const signUpToFirstPost: JourneyTemplate = {
  journey: 'sign-up-to-first-post',
  appType: 'social',
  name: 'New user signs up and creates their first post',
  persona: 'new-customer',
  tags: ['smoke', 'core-flow'],
  requires: {
    forms: ['sign-up'],
    routeTokens: ['feed', 'post', 'timeline'],
  },
  goal: {
    kind: 'text',
    value: 'posted|published',
    description: 'First post published',
  },
  expectedDurationMs: 60000,
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
      intent: 'Submit sign-up',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Sign up|Create account' },
      },
    },
    {
      n: 4,
      intent: 'Open the feed',
      action: 'navigate',
      url: '/feed',
    },
    {
      n: 5,
      intent: 'Open the compose post dialog',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="compose-post"]',
          'button[aria-label*="New post"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Post|New post|Compose' },
      },
    },
    {
      n: 6,
      intent: 'Type the post content',
      action: 'fill',
      target: {
        selectorHints: [
          '[data-testid="post-content"]',
          'textarea[name="content"]',
          'textarea',
        ],
      },
      payload: { kind: 'literal', value: 'Hello world, this is my first post.' },
    },
    {
      n: 7,
      intent: 'Publish the post',
      action: 'click',
      target: {
        selectorHints: [
          '[data-testid="publish-post"]',
          'button[type="submit"]',
        ],
        fallbackRoleText: { role: 'button', name: 'Post|Publish|Share' },
      },
      expect: [{ kind: 'text-visible', value: 'Hello world' }],
    },
  ],
};
