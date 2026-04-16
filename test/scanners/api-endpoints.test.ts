import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanForApiEndpoints, defaultApiEndpointsConfig } from '../../src/scanners/source/rules/api-endpoints.js';
import type { ApiEndpointsConfig } from '../../src/scanners/source/rules/api-endpoints.js';

function makeConfig(overrides?: Partial<ApiEndpointsConfig>): ApiEndpointsConfig {
  return { ...defaultApiEndpointsConfig, ...overrides };
}

describe('api-endpoints', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-api-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('Express route detection', () => {
    it('detects app.get/post/put/delete routes', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/users", (req, res) => { try { res.json([]) } catch(e) { res.status(500).send() } });',
        'app.post("/users", (req, res) => { try { res.json({}) } catch(e) { res.status(500).send() } });',
        'app.delete("/users/:id", (req, res) => { try { res.json({}) } catch(e) { res.status(500).send() } });',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(3);
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[0].path).toBe('/users');
      expect(endpoints[0].framework).toBe('express');
      expect(endpoints[1].method).toBe('POST');
      expect(endpoints[2].method).toBe('DELETE');
      expect(endpoints[2].path).toBe('/users/:id');
    });

    it('detects router.get/post routes', async () => {
      await writeFile(join(tmpDir, 'routes.ts'), [
        'import { Router } from "express";',
        'const router = Router();',
        'router.get("/health", (req, res) => { try { res.json({ ok: true }) } catch(e) { res.status(500).send() } });',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[0].path).toBe('/health');
    });
  });

  describe('Fastify detection', () => {
    it('detects fastify routes', async () => {
      await writeFile(join(tmpDir, 'app.ts'), [
        'import Fastify from "fastify";',
        'const fastify = Fastify();',
        'fastify.get("/ping", async () => { try { return { pong: true } } catch(e) { throw e } });',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].framework).toBe('fastify');
    });
  });

  describe('Hono detection', () => {
    it('detects Hono routes', async () => {
      await writeFile(join(tmpDir, 'app.ts'), [
        'import { Hono } from "hono";',
        'const app = new Hono();',
        'app.get("/api/hello", (c) => { try { return c.json({ msg: "hi" }) } catch(e) { throw e } });',
        'app.post("/api/data", (c) => { try { return c.json({}) } catch(e) { throw e } });',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].framework).toBe('hono');
      expect(endpoints[1].framework).toBe('hono');
    });
  });

  describe('Next.js App Router detection', () => {
    it('detects route.ts files with exported handlers', async () => {
      await mkdir(join(tmpDir, 'app', 'api', 'users'), { recursive: true });
      await writeFile(join(tmpDir, 'app', 'api', 'users', 'route.ts'), [
        'export async function GET(request: Request) {',
        '  try { return Response.json([]) } catch(e) { throw e }',
        '}',
        '',
        'export async function POST(request: Request) {',
        '  const body = z.object({ name: z.string() }).parse(await request.json());',
        '  try { return Response.json(body) } catch(e) { throw e }',
        '}',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].method).toBe('GET');
      expect(endpoints[0].path).toBe('/api/users');
      expect(endpoints[0].framework).toBe('nextjs-app');
      expect(endpoints[1].method).toBe('POST');
    });

    it('handles dynamic route segments', async () => {
      await mkdir(join(tmpDir, 'app', 'api', 'users', '[id]'), { recursive: true });
      await writeFile(join(tmpDir, 'app', 'api', 'users', '[id]', 'route.ts'), [
        'export async function GET(req: Request) {',
        '  try { return Response.json({}) } catch(e) { throw e }',
        '}',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].path).toBe('/api/users/:id');
    });
  });

  describe('Next.js Pages Router detection', () => {
    it('detects pages/api route files', async () => {
      await mkdir(join(tmpDir, 'pages', 'api'), { recursive: true });
      await writeFile(join(tmpDir, 'pages', 'api', 'hello.ts'), [
        'export default function handler(req, res) {',
        '  try { res.json({ hello: "world" }) } catch(e) { res.status(500).send() }',
        '}',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].path).toBe('/api/hello');
      expect(endpoints[0].framework).toBe('nextjs-pages');
    });
  });

  describe('SvelteKit detection', () => {
    it('detects +server.ts files', async () => {
      await mkdir(join(tmpDir, 'src', 'routes', 'api', 'items'), { recursive: true });
      await writeFile(join(tmpDir, 'src', 'routes', 'api', 'items', '+server.ts'), [
        'export async function GET({ url }) {',
        '  try { return new Response(JSON.stringify([])) } catch(e) { throw e }',
        '}',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].path).toBe('/api/items');
      expect(endpoints[0].framework).toBe('sveltekit');
    });
  });

  describe('tRPC detection', () => {
    it('detects tRPC procedures', async () => {
      await writeFile(join(tmpDir, 'router.ts'), [
        'import { router, publicProcedure } from "./trpc";',
        'export const appRouter = router({',
        '  getUsers: publicProcedure.query(async () => {',
        '    try { return [] } catch(e) { throw e }',
        '  }),',
        '  createUser: publicProcedure.mutation(async ({ input }) => {',
        '    const data = z.object({ name: z.string() }).parse(input);',
        '    try { return data } catch(e) { throw e }',
        '  }),',
        '});',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      expect(endpoints).toHaveLength(2);
      expect(endpoints[0].method).toBe('QUERY');
      expect(endpoints[0].path).toBe('getUsers');
      expect(endpoints[0].framework).toBe('trpc');
      expect(endpoints[1].method).toBe('MUTATION');
      expect(endpoints[1].path).toBe('createUser');
    });
  });

  describe('GraphQL detection', () => {
    it('detects GraphQL type definitions', async () => {
      await writeFile(join(tmpDir, 'schema.ts'), [
        'const typeDefs = `',
        'type Query {',
        '  users: [User]',
        '  user(id: ID!): User',
        '}',
        '',
        'type Mutation {',
        '  createUser(name: String!): User',
        '}',
        '`;',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const queryEndpoints = endpoints.filter((e) => e.method === 'QUERY');
      const mutationEndpoints = endpoints.filter((e) => e.method === 'MUTATION');

      expect(queryEndpoints).toHaveLength(2);
      expect(mutationEndpoints).toHaveLength(1);
      expect(queryEndpoints[0].path).toBe('users');
      expect(mutationEndpoints[0].path).toBe('createUser');
      expect(endpoints[0].framework).toBe('graphql');
    });
  });

  describe('issue detection', () => {
    it('flags missing error handling', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/data", (req, res) => {',
        '  res.json({ ok: true });',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const errorFindings = findings.filter((f) => f.ruleId === 'api-no-error-handling');
      expect(errorFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('flags missing validation on POST routes', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.post("/submit", (req, res) => {',
        '  try { res.json(req.body) } catch(e) { res.status(500).send() }',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const validationFindings = findings.filter((f) => f.ruleId === 'api-no-validation');
      expect(validationFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag validation when zod is present', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'import { z } from "zod";',
        'const app = express();',
        'app.post("/submit", (req, res) => {',
        '  const data = z.object({ name: z.string() }).parse(req.body);',
        '  try { res.json(data) } catch(e) { res.status(500).send() }',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const validationFindings = findings.filter((f) => f.ruleId === 'api-no-validation');
      expect(validationFindings).toHaveLength(0);
    });

    it('flags hardcoded secrets in route handlers', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/data", (req, res) => {',
        '  try {',
        '  const api_key = "sk_live_1234567890abcdefghij";',
        '  res.json({ ok: true });',
        '  } catch(e) { res.status(500).send() }',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const secretFindings = findings.filter((f) => f.ruleId === 'api-hardcoded-secret');
      expect(secretFindings.length).toBeGreaterThanOrEqual(1);
      expect(secretFindings[0].severity).toBe('critical');
    });

    it('flags missing auth on non-public routes', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/admin/users", (req, res) => {',
        '  try { res.json([]) } catch(e) { res.status(500).send() }',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const authFindings = findings.filter((f) => f.ruleId === 'api-no-auth');
      expect(authFindings.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag auth on health check routes', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/health", (req, res) => {',
        '  try { res.json({ ok: true }) } catch(e) { res.status(500).send() }',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const authFindings = findings.filter((f) => f.ruleId === 'api-no-auth');
      expect(authFindings).toHaveLength(0);
    });
  });

  describe('config options', () => {
    it('filters by framework when specified', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/users", (req, res) => { try { res.json([]) } catch(e) { throw e } });',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(
        tmpDir,
        makeConfig({ frameworks: ['hono'] }),
        [],
      );

      // Express endpoints filtered out because we only want hono
      expect(endpoints).toHaveLength(0);
    });

    it('disables specific checks', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.post("/submit", (req, res) => {',
        '  res.json(req.body);',
        '});',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(
        tmpDir,
        makeConfig({
          checkErrorHandling: false,
          checkValidation: false,
          checkAuth: false,
        }),
        [],
      );

      const issueFindings = findings.filter((f) => !f.ruleId.includes('discovered'));
      expect(issueFindings).toHaveLength(0);
    });

    it('respects exclude patterns', async () => {
      await mkdir(join(tmpDir, 'vendor'));
      await writeFile(join(tmpDir, 'vendor', 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/vendor", (req, res) => { res.json({}) });',
      ].join('\n'));

      const { endpoints } = await scanForApiEndpoints(
        tmpDir,
        makeConfig(),
        ['**/vendor/**'],
      );

      expect(endpoints).toHaveLength(0);
    });
  });

  describe('summary finding', () => {
    it('produces an info-level summary when endpoints are found', async () => {
      await writeFile(join(tmpDir, 'server.ts'), [
        'import express from "express";',
        'const app = express();',
        'app.get("/users", (req, res) => { try { res.json([]) } catch(e) { throw e } });',
      ].join('\n'));

      const { findings } = await scanForApiEndpoints(tmpDir, makeConfig(), []);

      const summary = findings.find((f) => f.ruleId === 'api-endpoints-discovered');
      expect(summary).toBeDefined();
      expect(summary!.severity).toBe('info');
      expect(summary!.message).toContain('1 API endpoints');
      expect(summary!.message).toContain('express');
    });
  });
});
