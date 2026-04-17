import type { JourneyTemplate } from '../../types.js';

export const browseArticle: JourneyTemplate = {
  journey: 'browse-article',
  appType: 'content',
  name: 'Visitor browses to an article and reads it',
  persona: 'anonymous',
  tags: ['smoke'],
  requires: {
    routeTokens: ['blog', 'articles', 'article', 'post'],
  },
  goal: {
    kind: 'selector',
    value: 'article, main article, [role="article"]',
    description: 'An article is visible on the final page',
  },
  steps: [
    {
      n: 1,
      intent: 'Open the content index',
      action: 'navigate',
      url: '/blog',
    },
    {
      n: 2,
      intent: 'Open the first article',
      action: 'click',
      target: {
        selectorHints: [
          'article a',
          'a[href*="/blog/"]',
          'a[href*="/post/"]',
          'a[href*="/article/"]',
        ],
        fallbackRoleText: { role: 'link', name: 'Read|Continue reading' },
      },
      expect: [{ kind: 'selector-visible', value: 'article, main article' }],
    },
  ],
};
