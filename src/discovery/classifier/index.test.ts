import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classifyApp, topAppType } from './index.js';
import { extractDomainSnapshot } from '../domain/index.js';
import type { DomainSnapshot } from '../types.js';
import type { AppType } from './types.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', '..', '..', 'sniff-tests', 'fixtures');

function makeSnapshot(partial: {
  routes?: string[];
  elements?: string[];
  deps?: string[];
  entities?: string[];
}): DomainSnapshot {
  return {
    project: { name: 'test', frameworks: [], rootDir: '/tmp/test' },
    routes: [],
    forms: [],
    entities: (partial.entities ?? []).map((name) => ({
      name,
      source: 'ts',
      filePath: 'types.ts',
      fields: [],
    })),
    relations: [],
    apiEndpoints: [],
    vocabulary: {
      routes: partial.routes ?? [],
      elements: partial.elements ?? [],
      deps: partial.deps ?? [],
    },
    metadata: { analyzedAt: new Date().toISOString(), duration: 0 },
  };
}

describe('classifyApp (synthetic snapshots)', () => {
  const cases: Array<{ label: string; expected: AppType; snapshot: DomainSnapshot }> = [
    {
      label: 'ecommerce',
      expected: 'ecommerce',
      snapshot: makeSnapshot({
        routes: ['cart', 'checkout', 'products', 'product', 'orders'],
        elements: ['add', 'cart', 'buy', 'checkout', 'price', 'quantity'],
        deps: ['stripe', '@stripe/stripe-js'],
        entities: ['Product', 'Order', 'OrderItem', 'Customer'],
      }),
    },
    {
      label: 'booking',
      expected: 'booking',
      snapshot: makeSnapshot({
        routes: ['listings', 'listing', 'booking', 'reserve', 'availability'],
        elements: ['book', 'reserve', 'confirm', 'booking', 'guests'],
        deps: ['mapbox-gl', '@fullcalendar/react', 'date-fns'],
        entities: ['Listing', 'Reservation', 'User'],
      }),
    },
    {
      label: 'social',
      expected: 'social',
      snapshot: makeSnapshot({
        routes: ['feed', 'profile', 'messages', 'followers', 'following', 'posts'],
        elements: ['like', 'comment', 'share', 'follow', 'post'],
        deps: ['stream-chat-react', 'socket.io-client'],
        entities: ['Post', 'Comment', 'Follow', 'Like'],
      }),
    },
    {
      label: 'saas',
      expected: 'saas',
      snapshot: makeSnapshot({
        routes: ['dashboard', 'settings', 'billing', 'workspace', 'team', 'integrations'],
        elements: ['workspace', 'invite', 'upgrade', 'plan', 'api', 'key'],
        deps: ['next-auth', '@clerk/nextjs', 'stripe', 'posthog-js'],
        entities: ['Workspace', 'Subscription', 'Plan', 'Membership', 'ApiKey'],
      }),
    },
    {
      label: 'content',
      expected: 'content',
      snapshot: makeSnapshot({
        routes: ['blog', 'articles', 'article', 'tag', 'author', 'rss'],
        elements: ['read', 'article', 'subscribe', 'newsletter', 'published'],
        deps: ['contentful', '@contentful/rich-text-react-renderer', 'gray-matter'],
        entities: ['Article', 'Author', 'Tag'],
      }),
    },
    {
      label: 'crm',
      expected: 'crm',
      snapshot: makeSnapshot({
        routes: ['contacts', 'leads', 'deals', 'pipeline', 'opportunities', 'accounts'],
        elements: ['assign', 'pipeline', 'deal', 'lead', 'follow'],
        deps: ['@hubspot/api-client', 'jsforce'],
        entities: ['Contact', 'Lead', 'Deal', 'Pipeline', 'Opportunity'],
      }),
    },
    {
      label: 'auth-only',
      expected: 'auth-only',
      snapshot: makeSnapshot({
        routes: ['login', 'signup', 'register', 'logout', 'forgot-password', 'verify'],
        elements: ['sign', 'create', 'account', 'password', 'reset', 'email'],
        deps: ['next-auth', 'lucia-auth'],
        entities: ['User', 'Session'],
      }),
    },
    {
      label: 'marketing',
      expected: 'marketing',
      snapshot: makeSnapshot({
        routes: ['pricing', 'features', 'about', 'contact', 'faq', 'testimonials'],
        elements: ['get', 'started', 'request', 'demo', 'pricing', 'testimonial'],
        deps: ['react-hubspot-form', 'intercom', 'calendly'],
        entities: [],
      }),
    },
    {
      label: 'admin',
      expected: 'admin',
      snapshot: makeSnapshot({
        routes: ['admin', 'users', 'roles', 'permissions', 'audit', 'logs'],
        elements: ['edit', 'delete', 'row', 'export', 'csv', 'bulk', 'assign', 'role'],
        deps: ['react-admin', '@refinedev/core', 'ag-grid-react'],
        entities: ['User', 'Role', 'Permission', 'AuditLog'],
      }),
    },
    {
      label: 'blank (no signals)',
      expected: 'blank',
      snapshot: makeSnapshot({
        routes: [],
        elements: [],
        deps: [],
        entities: [],
      }),
    },
  ];

  for (const { label, expected, snapshot } of cases) {
    it(`identifies ${label} as ${expected}`, () => {
      const top = topAppType(snapshot);
      expect(top).toBe(expected);
    });
  }

  it('returns guesses sorted by confidence desc', () => {
    const snapshot = makeSnapshot({
      routes: ['cart', 'checkout', 'products'],
      elements: ['add', 'cart', 'buy'],
      deps: ['stripe'],
      entities: ['Product', 'Order'],
    });
    const guesses = classifyApp(snapshot);
    for (let i = 1; i < guesses.length; i++) {
      expect(guesses[i - 1].confidence).toBeGreaterThanOrEqual(guesses[i].confidence);
    }
  });

  it('drops guesses below minimum confidence', () => {
    const snapshot = makeSnapshot({
      routes: ['cart', 'checkout', 'products'],
      elements: ['add', 'cart'],
      deps: ['stripe'],
      entities: ['Product', 'Order'],
    });
    const guesses = classifyApp(snapshot);
    for (const g of guesses) {
      expect(g.confidence).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('attaches evidence for matched signals', () => {
    const snapshot = makeSnapshot({
      routes: ['cart', 'checkout'],
      elements: ['add', 'cart'],
      deps: ['stripe'],
      entities: ['Product', 'Order'],
    });
    const guesses = classifyApp(snapshot);
    const top = guesses[0];
    expect(top.evidence.some((e) => e.signal === 'route' && e.value === 'checkout')).toBe(true);
    expect(top.evidence.some((e) => e.signal === 'dep' && e.value === 'stripe')).toBe(true);
    expect(top.evidence.some((e) => e.signal === 'schema' && e.value === 'product')).toBe(true);
  });
});

describe('classifyApp (real fixtures)', () => {
  it('ecommerce-prisma is classified as ecommerce', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'ecommerce-prisma'));
    const top = topAppType(snapshot);
    expect(top).toBe('ecommerce');
  }, 30000);

  it('saas-drizzle is classified as saas (or auth-only as second)', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'saas-drizzle'));
    const guesses = classifyApp(snapshot);
    const topTwo = guesses.slice(0, 2).map((g) => g.type);
    expect(topTwo).toContain('saas');
  }, 30000);

  it('booking-typeorm is classified as booking', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'booking-typeorm'));
    const top = topAppType(snapshot);
    expect(top).toBe('booking');
  }, 30000);
});
