import type { JourneyTemplate } from '../../types.js';

export const contactForm: JourneyTemplate = {
  journey: 'contact-form',
  appType: 'marketing',
  name: 'Visitor submits the contact form',
  persona: 'anonymous',
  tags: ['smoke', 'lead-gen'],
  requires: {
    forms: ['contact'],
  },
  goal: {
    kind: 'text',
    value: 'thank you|we received|message sent',
    description: 'Confirmation that the message was received',
  },
  steps: [
    {
      n: 1,
      intent: 'Open the contact page',
      action: 'navigate',
      url: '/contact',
    },
    {
      n: 2,
      intent: 'Fill the contact form',
      action: 'fill-form',
      payload: { kind: 'persona', value: 'anonymous' },
    },
    {
      n: 3,
      intent: 'Submit',
      action: 'click',
      target: {
        selectorHints: ['button[type="submit"]'],
        fallbackRoleText: { role: 'button', name: 'Send|Contact|Submit' },
      },
      expect: [{ kind: 'text-visible', value: 'thank you|we received|message sent' }],
    },
  ],
};
