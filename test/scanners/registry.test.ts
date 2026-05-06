import { describe, it, expect } from 'vitest';
import { ScannerRegistry } from '../../src/scanners/registry.js';
import type { SniffConfig } from '../../src/config/schema.js';

describe('ScannerRegistry', () => {
  it('turns scanner crashes into fail-able scanner-error findings', async () => {
    const registry = new ScannerRegistry();
    registry.register({
      name: 'source',
      async scan() {
        throw new Error('boom');
      },
    });

    const config = {
      scanners: ['source'],
      failOn: ['critical', 'high'],
      exclude: [],
      include: [],
      rules: {},
      viewports: [],
    } as unknown as SniffConfig;

    const results = await registry.runAll({ config, rootDir: '/tmp/project' });

    expect(results).toHaveLength(1);
    expect(results[0].findings).toHaveLength(1);
    expect(results[0].findings[0]).toMatchObject({
      ruleId: 'scanner-error/source',
      severity: 'high',
      filePath: '/tmp/project',
    });
  });
});
