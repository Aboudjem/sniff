import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { classifyApp, topAppType, scoreAllSignatures, buildClassificationBreakdown } from './index.js';
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
    // i18n cases — same semantics as English counterparts above,
    // but with French / Spanish / German / Portuguese / Italian tokens.
    {
      label: 'saas (French)',
      expected: 'saas',
      snapshot: makeSnapshot({
        // Prevue-class: /fr/tableau-de-bord, /fr/parametres, /fr/facturation,
        // /fr/abonnement, /fr/equipe, /fr/integrations
        routes: ['fr', 'tableau', 'parametres', 'facturation', 'abonnement', 'equipe', 'integrations'],
        elements: ['inviter', 'equipe', 'creer', 'espace', 'cle', 'api', 'connexion'],
        deps: ['next-auth', '@clerk/nextjs', 'stripe'],
        entities: ['Workspace', 'Subscription', 'Plan', 'Membership', 'ApiKey'],
      }),
    },
    {
      label: 'saas (Spanish)',
      expected: 'saas',
      snapshot: makeSnapshot({
        routes: ['es', 'panel', 'ajustes', 'facturacion', 'suscripcion', 'equipo', 'integraciones'],
        elements: ['invitar', 'equipo', 'mejorar', 'plan', 'empezar', 'prueba'],
        deps: ['@clerk/nextjs', 'stripe', 'posthog-js'],
        entities: ['Workspace', 'Subscription', 'Plan', 'Membership'],
      }),
    },
    {
      label: 'saas (German)',
      expected: 'saas',
      snapshot: makeSnapshot({
        routes: ['de', 'dashboard', 'einstellungen', 'abrechnung', 'abonnement', 'team', 'integrationen'],
        elements: ['team', 'einladen', 'jetzt', 'kaufen', 'kostenlos', 'testen', 'anmelden'],
        deps: ['next-auth', 'stripe'],
        entities: ['Workspace', 'Subscription', 'Plan'],
      }),
    },
    {
      label: 'ecommerce (French)',
      expected: 'ecommerce',
      snapshot: makeSnapshot({
        routes: ['fr', 'panier', 'commander', 'produits', 'produit', 'commandes'],
        elements: ['ajouter', 'au', 'panier', 'acheter', 'maintenant', 'commander'],
        deps: ['stripe', '@stripe/stripe-js'],
        entities: ['Product', 'Order', 'OrderItem', 'Customer'],
      }),
    },
    {
      label: 'ecommerce (Spanish)',
      expected: 'ecommerce',
      snapshot: makeSnapshot({
        // ZARA-style checkout: /es/cesta, /es/finalizar-compra, /es/productos
        routes: ['es', 'cesta', 'finalizar', 'productos', 'pedidos'],
        elements: ['anadir', 'la', 'cesta', 'comprar', 'ahora'],
        deps: ['stripe', '@stripe/stripe-js'],
        entities: ['Product', 'Order', 'Customer'],
      }),
    },
    {
      label: 'booking (French)',
      expected: 'booking',
      snapshot: makeSnapshot({
        routes: ['fr', 'reservation', 'reserver', 'disponibilites', 'rendez', 'vous'],
        elements: ['reserver', 'maintenant', 'selectionner', 'les', 'dates', 'confirmer', 'reservation'],
        deps: ['@fullcalendar/react', 'date-fns'],
        entities: ['Reservation', 'Availability'],
      }),
    },
  ];

  for (const { label, expected, snapshot } of cases) {
    it(`identifies ${label} as ${expected}`, () => {
      const top = topAppType(snapshot);
      expect(top).toBe(expected);
    });
  }

  it('attaches i18n evidence tag when matched via alias', () => {
    const snapshot = makeSnapshot({
      routes: ['fr', 'tableau', 'parametres', 'facturation', 'abonnement', 'equipe', 'integrations'],
      elements: [],
      deps: ['stripe'],
      entities: ['Workspace', 'Subscription'],
    });
    const guesses = classifyApp(snapshot);
    const saas = guesses.find((g) => g.type === 'saas');
    expect(saas).toBeDefined();
    // At least one route evidence entry should indicate an i18n alias match.
    expect(saas?.evidence.some((e) => e.signal === 'route' && e.value.includes('i18n:'))).toBe(true);
  });

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

describe('scoreAllSignatures + buildClassificationBreakdown', () => {
  it('returns every signature regardless of confidence', () => {
    const empty = makeSnapshot({ routes: [], elements: [], deps: [], entities: [] });
    const all = scoreAllSignatures(empty);
    // 10 signatures shipped today (ecommerce, booking, social, saas, content,
    // crm, auth-only, marketing, admin, blank). Don't assert exact count so
    // adding new signatures doesn't churn this test.
    expect(all.length).toBeGreaterThanOrEqual(9);
    expect(all.every((g) => typeof g.rawScore === 'number')).toBe(true);
  });

  it('preserves near-miss evidence even when everything falls under threshold', () => {
    // Only 1 dep + 1 schema — below 0.1 confidence, so classifyApp collapses
    // to blank. scoreAllSignatures must still surface the matched signals.
    const snapshot = makeSnapshot({
      routes: [],
      elements: [],
      deps: ['stripe'],
      entities: ['Order'],
    });
    const all = scoreAllSignatures(snapshot);
    const ecommerce = all.find((g) => g.type === 'ecommerce');
    expect(ecommerce?.evidence.some((e) => e.signal === 'dep' && e.value === 'stripe')).toBe(true);
    expect(ecommerce?.evidence.some((e) => e.signal === 'schema' && e.value === 'order')).toBe(true);
  });

  it('buildClassificationBreakdown groups signals by dimension', () => {
    const snapshot = makeSnapshot({
      routes: ['cart', 'checkout', 'products'],
      elements: ['add', 'cart'],
      deps: ['stripe'],
      entities: ['Product', 'Order'],
    });
    const breakdown = buildClassificationBreakdown(scoreAllSignatures(snapshot));
    expect(breakdown.top3).toHaveLength(3);
    expect(breakdown.top3[0].type).toBe('ecommerce');
    expect(breakdown.matchedSignals.routes.some((r) => r.value === 'checkout')).toBe(true);
    expect(breakdown.matchedSignals.deps.some((d) => d.value === 'stripe')).toBe(true);
    expect(breakdown.matchedSignals.schema.some((s) => s.value === 'product')).toBe(true);
  });

  it('buildClassificationBreakdown excludes blank from matchedSignals', () => {
    const empty = makeSnapshot({ routes: [], elements: [], deps: [], entities: [] });
    const breakdown = buildClassificationBreakdown(scoreAllSignatures(empty));
    for (const bucket of Object.values(breakdown.matchedSignals)) {
      for (const entry of bucket) {
        expect(entry.appType).not.toBe('blank');
      }
    }
  });

  it('buildClassificationBreakdown top3 is sorted by rawScore desc', () => {
    const snapshot = makeSnapshot({
      routes: ['cart', 'checkout', 'products', 'dashboard', 'settings', 'billing'],
      elements: ['add', 'cart', 'workspace'],
      deps: ['stripe', 'next-auth'],
      entities: ['Workspace', 'Subscription', 'Product', 'Order'],
    });
    const breakdown = buildClassificationBreakdown(scoreAllSignatures(snapshot));
    for (let i = 1; i < breakdown.top3.length; i++) {
      expect(breakdown.top3[i - 1].rawScore).toBeGreaterThanOrEqual(breakdown.top3[i].rawScore);
    }
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
