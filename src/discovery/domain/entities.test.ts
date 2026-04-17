import { describe, it, expect } from 'vitest';
import { parsePrismaContent } from './prisma.js';
import { parseDrizzleContent } from './drizzle.js';
import { parseTypeOrmContent } from './typeorm.js';
import { parseZodContent } from './zod.js';
import { parseTsTypesContent } from './ts-types.js';
import { parseGraphQlContent } from './graphql.js';
import { parseOpenApiDocument } from './openapi.js';

describe('parsePrismaContent', () => {
  it('extracts models, fields, identifiers, and relations', () => {
    const schema = `
      model User {
        id    String  @id @default(uuid())
        email String  @unique
        name  String?
        posts Post[]
      }
      model Post {
        id       String @id @default(uuid())
        title    String
        authorId String
        author   User   @relation(fields: [authorId], references: [id])
      }
    `;

    const { entities, relations } = parsePrismaContent(schema, 'schema.prisma');
    expect(entities.map((e) => e.name).sort()).toEqual(['Post', 'User']);

    const user = entities.find((e) => e.name === 'User')!;
    expect(user.source).toBe('prisma');
    expect(user.identifiers).toEqual(['id']);
    const emailField = user.fields.find((f) => f.name === 'email')!;
    expect(emailField.type).toBe('string');
    expect(emailField.format).toBe('email');
    expect(emailField.required).toBe(true);
    const nameField = user.fields.find((f) => f.name === 'name')!;
    expect(nameField.required).toBe(false);
    const postsField = user.fields.find((f) => f.name === 'posts')!;
    expect(postsField.type).toBe('ref');
    expect(postsField.refTo).toBe('Post');

    expect(relations.some((r) => r.from === 'User' && r.to === 'Post' && r.cardinality === '1:N')).toBe(true);
    expect(relations.some((r) => r.from === 'Post' && r.to === 'User' && r.cardinality === '1:1')).toBe(true);
  });

  it('handles enums', () => {
    const schema = `
      enum Status {
        ACTIVE
        INACTIVE
      }
      model Account {
        id     String @id
        status Status
      }
    `;
    const { entities } = parsePrismaContent(schema, 'schema.prisma');
    const account = entities.find((e) => e.name === 'Account')!;
    const statusField = account.fields.find((f) => f.name === 'status')!;
    expect(statusField.type).toBe('enum');
    expect(statusField.enum).toEqual(['ACTIVE', 'INACTIVE']);
  });

  it('returns empty on malformed content', () => {
    const result = parsePrismaContent('this is not prisma', 'schema.prisma');
    expect(result.entities).toEqual([]);
    expect(result.relations).toEqual([]);
  });
});

describe('parseDrizzleContent', () => {
  it('extracts pgTable entities with fields and relations', () => {
    const schema = `
      import { pgTable, serial, text, integer, boolean, uuid, timestamp } from 'drizzle-orm/pg-core';
      export const users = pgTable('users', {
        id: uuid('id').primaryKey(),
        email: text('email').notNull().unique(),
        name: text('name').notNull(),
        createdAt: timestamp('created_at').notNull(),
      });
      export const posts = pgTable('posts', {
        id: uuid('id').primaryKey(),
        authorId: uuid('author_id').notNull().references(() => users.id),
        title: text('title').notNull(),
      });
    `;
    const { entities, relations } = parseDrizzleContent(schema, 'schema.ts');
    expect(entities.map((e) => e.name).sort()).toEqual(['Post', 'User']);

    const user = entities.find((e) => e.name === 'User')!;
    expect(user.source).toBe('drizzle');
    expect(user.identifiers).toEqual(['id']);
    const email = user.fields.find((f) => f.name === 'email')!;
    expect(email.type).toBe('string');
    expect(email.format).toBe('email');
    expect(email.required).toBe(true);

    const post = entities.find((e) => e.name === 'Post')!;
    const authorRef = post.fields.find((f) => f.name === 'authorId')!;
    expect(authorRef.type).toBe('ref');
    expect(authorRef.refTo).toBe('User');
    expect(relations.some((r) => r.from === 'Post' && r.to === 'User')).toBe(true);
  });

  it('skips files without pgTable/mysqlTable/sqliteTable', () => {
    const { entities } = parseDrizzleContent(`export const x = 1;`, 'x.ts');
    expect(entities).toEqual([]);
  });
});

describe('parseTypeOrmContent', () => {
  it('extracts entities with @Entity decorator', () => {
    const source = `
      import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
      import { Post } from './Post';

      @Entity()
      export class User {
        @PrimaryGeneratedColumn('uuid')
        id!: string;

        @Column({ type: 'varchar', length: 255, unique: true })
        email!: string;

        @Column({ type: 'varchar', nullable: true })
        name?: string;

        @OneToMany(() => Post, (post) => post.author)
        posts!: Post[];
      }
    `;
    const { entities, relations } = parseTypeOrmContent(source, 'User.ts');
    expect(entities).toHaveLength(1);
    const user = entities[0];
    expect(user.name).toBe('User');
    expect(user.source).toBe('typeorm');
    expect(user.identifiers).toEqual(['id']);
    const email = user.fields.find((f) => f.name === 'email')!;
    expect(email.type).toBe('string');
    expect(email.format).toBe('email');
    expect(email.required).toBe(true);
    const name = user.fields.find((f) => f.name === 'name')!;
    expect(name.required).toBe(false);
    const posts = user.fields.find((f) => f.name === 'posts')!;
    expect(posts.type).toBe('ref');
    expect(posts.refTo).toBe('Post');
    expect(relations.some((r) => r.from === 'User' && r.to === 'Post' && r.cardinality === '1:N')).toBe(true);
  });

  it('ignores classes without @Entity', () => {
    const source = `export class Plain { x: number = 1; }`;
    const { entities } = parseTypeOrmContent(source, 'Plain.ts');
    expect(entities).toEqual([]);
  });
});

describe('parseZodContent', () => {
  it('extracts schemas and infers formats', () => {
    const source = `
      import { z } from 'zod';
      export const UserSchema = z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string().min(1),
        age: z.number().int().optional(),
        role: z.enum(['admin', 'user']),
      });
    `;
    const { entities } = parseZodContent(source, 'user.ts');
    expect(entities).toHaveLength(1);
    const entity = entities[0];
    expect(entity.name).toBe('User');
    expect(entity.source).toBe('zod');
    const id = entity.fields.find((f) => f.name === 'id')!;
    expect(id.type).toBe('string');
    expect(id.format).toBe('uuid');
    const age = entity.fields.find((f) => f.name === 'age')!;
    expect(age.required).toBe(false);
    const role = entity.fields.find((f) => f.name === 'role')!;
    expect(role.type).toBe('enum');
    expect(role.enum).toEqual(['admin', 'user']);
  });

  it('strips Schema suffix from entity name', () => {
    const source = `
      import { z } from 'zod';
      export const OrderDTO = z.object({ id: z.string() });
    `;
    const { entities } = parseZodContent(source, 'x.ts');
    expect(entities[0].name).toBe('Order');
  });
});

describe('parseTsTypesContent', () => {
  it('extracts interfaces and type aliases', () => {
    const source = `
      export interface User {
        id: string;
        email: string;
        name?: string;
      }
      export type Role = 'admin' | 'user' | 'guest';
      export type Order = {
        id: string;
        userId: string;
        total: number;
      };
    `;
    const { entities } = parseTsTypesContent(source, 'types.ts');
    const user = entities.find((e) => e.name === 'User')!;
    expect(user.source).toBe('ts');
    const name = user.fields.find((f) => f.name === 'name')!;
    expect(name.required).toBe(false);

    const order = entities.find((e) => e.name === 'Order')!;
    expect(order.fields.some((f) => f.name === 'total' && f.type === 'number')).toBe(true);
  });

  it('detects enum-like union of string literals', () => {
    const source = `
      export interface Thing {
        status: 'draft' | 'published' | 'archived';
      }
    `;
    const { entities } = parseTsTypesContent(source, 'types.ts');
    const status = entities[0].fields.find((f) => f.name === 'status')!;
    expect(status.type).toBe('enum');
    expect(status.enum).toEqual(['draft', 'published', 'archived']);
  });
});

describe('parseGraphQlContent', () => {
  it('extracts types, scalars, and relations', () => {
    const sdl = `
      type User {
        id: ID!
        email: String!
        name: String
        posts: [Post!]!
      }
      type Post {
        id: ID!
        title: String!
        author: User!
      }
      enum Role { ADMIN USER }
    `;
    const { entities, relations } = parseGraphQlContent(sdl, 'schema.graphql');
    const names = entities.map((e) => e.name).sort();
    expect(names).toEqual(['Post', 'User']);
    const user = entities.find((e) => e.name === 'User')!;
    expect(user.source).toBe('graphql');
    const email = user.fields.find((f) => f.name === 'email')!;
    expect(email.type).toBe('string');
    expect(email.format).toBe('email');
    expect(email.required).toBe(true);
    expect(relations.some((r) => r.from === 'User' && r.to === 'Post' && r.cardinality === '1:N')).toBe(true);
    expect(relations.some((r) => r.from === 'Post' && r.to === 'User')).toBe(true);
  });

  it('ignores Query and Mutation types', () => {
    const sdl = `
      type Query { users: [User!]! }
      type User { id: ID! }
    `;
    const { entities } = parseGraphQlContent(sdl, 's.graphql');
    expect(entities.map((e) => e.name)).toEqual(['User']);
  });
});

describe('parseOpenApiDocument', () => {
  it('extracts schemas and endpoints', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = {
      openapi: '3.0.0',
      security: [{ bearerAuth: [] }],
      paths: {
        '/users': {
          get: { responses: {} },
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/CreateUser' } },
              },
            },
          },
        },
        '/users/{id}': {
          get: { responses: {}, security: [] },
        },
      },
      components: {
        schemas: {
          User: {
            type: 'object',
            required: ['id', 'email'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              createdAt: { type: 'string', format: 'date-time' },
              role: { type: 'string', enum: ['admin', 'user'] },
            },
          },
          CreateUser: {
            type: 'object',
            required: ['email'],
            properties: {
              email: { type: 'string', format: 'email' },
            },
          },
        },
      },
    };
    const { entities, endpoints } = parseOpenApiDocument(doc, 'openapi.json');
    expect(entities.map((e) => e.name).sort()).toEqual(['CreateUser', 'User']);
    const user = entities.find((e) => e.name === 'User')!;
    const email = user.fields.find((f) => f.name === 'email')!;
    expect(email.format).toBe('email');
    expect(email.required).toBe(true);
    const role = user.fields.find((f) => f.name === 'role')!;
    expect(role.type).toBe('enum');

    expect(endpoints).toHaveLength(3);
    const post = endpoints.find((e) => e.method === 'POST' && e.path === '/users')!;
    expect(post.bodySchema).toBe('CreateUser');
    expect(post.auth).toBe(true);
    const byId = endpoints.find((e) => e.path === '/users/{id}')!;
    expect(byId.auth).toBe(false);
  });
});
