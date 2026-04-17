import { describe, it, expect } from 'vitest';
import { productionUrlWarning } from './discover.js';

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
});
