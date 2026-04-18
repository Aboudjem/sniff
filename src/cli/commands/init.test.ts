import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectInitFlavor } from './init.js';

describe('detectInitFlavor', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-init-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns ts when tsconfig.json exists', async () => {
    await writeFile(join(tmpDir, 'tsconfig.json'), '{}');
    expect(await detectInitFlavor(tmpDir)).toBe('ts');
  });

  it('returns ts when typescript is a dependency', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ devDependencies: { typescript: '^5.0.0' } }),
    );
    expect(await detectInitFlavor(tmpDir)).toBe('ts');
  });

  it('returns esm for "type": "module" without TypeScript', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ type: 'module' }),
    );
    expect(await detectInitFlavor(tmpDir)).toBe('esm');
  });

  it('returns cjs for CommonJS project', async () => {
    await writeFile(join(tmpDir, 'package.json'), JSON.stringify({ name: 'plain' }));
    expect(await detectInitFlavor(tmpDir)).toBe('cjs');
  });

  it('returns cjs when no package.json exists', async () => {
    expect(await detectInitFlavor(tmpDir)).toBe('cjs');
  });

  it('prefers ts over esm when both signals are present', async () => {
    // Common case: an ESM TypeScript project.
    await writeFile(join(tmpDir, 'tsconfig.json'), '{}');
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ type: 'module' }),
    );
    expect(await detectInitFlavor(tmpDir)).toBe('ts');
  });
});
