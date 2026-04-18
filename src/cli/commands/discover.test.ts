import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { discoverCommand, productionUrlWarning } from './discover.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(HERE, '..', '..', '..', 'sniff-tests', 'fixtures');

describe('discoverCommand helpers', () => {
  describe('productionUrlWarning', () => {
    it('is a no-op in json mode', async () => {
      const start = Date.now();
      await productionUrlWarning('https://example.com', { json: true, delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op in non-interactive mode', async () => {
      const start = Date.now();
      await productionUrlWarning('https://example.com', { nonInteractive: true, delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op for localhost', async () => {
      const start = Date.now();
      await productionUrlWarning('http://localhost:3000', { delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op for 127.0.0.1', async () => {
      const start = Date.now();
      await productionUrlWarning('http://127.0.0.1:5173', { delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('is a no-op for private network IPs', async () => {
      const start = Date.now();
      await productionUrlWarning('http://192.168.1.20:3000', { delayMs: 500 });
      expect(Date.now() - start).toBeLessThan(200);
    });

    it('waits when the URL looks like production', async () => {
      const start = Date.now();
      await productionUrlWarning('https://example.com', { delayMs: 150 });
      expect(Date.now() - start).toBeGreaterThanOrEqual(120);
    });
  });

  describe('dryRun (issue #10)', () => {
    it('returns scenarios without browser and without disk writes', async () => {
      const result = await discoverCommand({
        rootDir: resolve(FIXTURES, 'ecommerce-prisma'),
        dryRun: true,
        json: true,
        nonInteractive: true,
      });
      expect(result.exitCode).toBe(0);
      expect(result.savedPaths).toEqual([]);
      expect(result.dryRun).toBeDefined();
      expect(result.dryRun!.totalGenerated).toBeGreaterThan(0);
      expect(result.dryRun!.scenarios.length).toBeGreaterThan(0);
      for (const s of result.dryRun!.scenarios) {
        expect(s.id).toMatch(/^[\w-]+\.[\w-]+\.(happy|edge:)/);
        expect(s.stepCount).toBeGreaterThan(0);
        expect(s.steps.every((step) => typeof step === 'string')).toBe(true);
      }
      expect(result.dryRun!.estimatedDurationMs).toBeGreaterThan(0);
    }, 30000);

    it('caps scenario list at 50 but reports the true total', async () => {
      const result = await discoverCommand({
        rootDir: resolve(FIXTURES, 'ecommerce-prisma'),
        dryRun: true,
        json: true,
        nonInteractive: true,
        maxVariantsPerRun: 100,
        maxVariantsPerScenario: 10,
      });
      expect(result.dryRun!.scenarios.length).toBeLessThanOrEqual(50);
      expect(result.dryRun!.totalGenerated).toBeGreaterThanOrEqual(result.dryRun!.scenarios.length);
    }, 30000);

    it('does not require a URL (skips dev-server detection entirely)', async () => {
      // No dev server running in the fixture path — dryRun should still
      // succeed. Without the fix, classic sniff_discover would error out at
      // "no baseUrl provided and no local dev server detected."
      const result = await discoverCommand({
        rootDir: resolve(FIXTURES, 'saas-drizzle'),
        dryRun: true,
        json: true,
        nonInteractive: true,
      });
      expect(result.exitCode).toBe(0);
      expect(result.baseUrl).toBe('');
      expect(result.dryRun).toBeDefined();
    }, 30000);
  });
});
