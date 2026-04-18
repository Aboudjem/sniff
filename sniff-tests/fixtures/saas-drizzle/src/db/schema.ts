import { pgTable, serial, text, integer, timestamp, boolean, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull(),
  createdAt: timestamp('created_at').notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  plan: text('plan').notNull(),
  status: text('status').notNull(),
  priceCents: integer('price_cents').notNull(),
  renewsAt: timestamp('renews_at'),
});
