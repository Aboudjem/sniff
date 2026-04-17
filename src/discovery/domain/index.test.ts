import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { extractDomainSnapshot } from './index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', '..', '..', 'sniff-tests', 'fixtures');

describe('extractDomainSnapshot - ecommerce-prisma fixture', () => {
  it('finds Prisma entities and checkout form', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'ecommerce-prisma'));

    expect(snapshot.project.frameworks.some((f) => f.name === 'nextjs')).toBe(true);

    const entityNames = snapshot.entities.map((e) => e.name).sort();
    expect(entityNames).toEqual(expect.arrayContaining(['Customer', 'Order', 'OrderItem', 'Product']));

    const product = snapshot.entities.find((e) => e.name === 'Product')!;
    expect(product.source).toBe('prisma');
    expect(product.fields.some((f) => f.name === 'sku')).toBe(true);

    expect(snapshot.relations.some((r) => r.from === 'Order' && r.to === 'Customer')).toBe(true);

    const checkoutForm = snapshot.forms.find((f) => f.intent === 'checkout');
    expect(checkoutForm).toBeDefined();
    expect(checkoutForm!.route).toBe('/checkout');

    expect(snapshot.vocabulary.routes).toContain('checkout');
    expect(snapshot.vocabulary.routes).toContain('cart');
    expect(snapshot.vocabulary.deps).toContain('stripe');
  }, 30000);
});

describe('extractDomainSnapshot - saas-drizzle fixture', () => {
  it('finds Drizzle entities, sign-in and sign-up forms', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'saas-drizzle'));

    const entityNames = snapshot.entities.map((e) => e.name).sort();
    expect(entityNames).toEqual(expect.arrayContaining(['Subscription', 'User', 'Workspace']));

    const user = snapshot.entities.find((e) => e.name === 'User')!;
    expect(user.source).toBe('drizzle');
    const emailField = user.fields.find((f) => f.name === 'email')!;
    expect(emailField.format).toBe('email');

    expect(snapshot.relations.some((r) => r.from === 'Workspace' && r.to === 'User')).toBe(true);

    const signInForm = snapshot.forms.find((f) => f.intent === 'sign-in');
    expect(signInForm).toBeDefined();
    const signUpForm = snapshot.forms.find((f) => f.intent === 'sign-up');
    expect(signUpForm).toBeDefined();

    expect(snapshot.vocabulary.deps).toContain('next-auth');
  }, 30000);
});

describe('extractDomainSnapshot - booking-typeorm fixture', () => {
  it('finds TypeORM entities and a search form', async () => {
    const snapshot = await extractDomainSnapshot(resolve(FIXTURES, 'booking-typeorm'));

    const entityNames = snapshot.entities.map((e) => e.name).sort();
    expect(entityNames).toEqual(expect.arrayContaining(['Listing', 'Reservation', 'User']));

    const listing = snapshot.entities.find((e) => e.name === 'Listing')!;
    expect(listing.source).toBe('typeorm');
    expect(listing.fields.some((f) => f.name === 'city')).toBe(true);

    expect(snapshot.relations.some((r) => r.from === 'Reservation' && r.to === 'User')).toBe(true);
    expect(snapshot.relations.some((r) => r.from === 'Reservation' && r.to === 'Listing')).toBe(true);

    expect(snapshot.vocabulary.deps).toContain('typeorm');
    expect(snapshot.vocabulary.deps).toContain('express');
  }, 30000);
});
