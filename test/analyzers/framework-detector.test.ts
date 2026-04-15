import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectFrameworks } from '../../src/analyzers/framework-detector.js';
import type { FrameworkInfo } from '../../src/analyzers/types.js';

describe('detectFrameworks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-fw-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns nextjs when package.json has "next" in dependencies and next.config.js exists', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0' },
      }),
    );
    await writeFile(join(tmpDir, 'next.config.js'), 'module.exports = {};');

    const result = await detectFrameworks(tmpDir);

    expect(result).toEqual([
      expect.objectContaining({
        name: 'nextjs',
        version: '14.x',
        configFiles: ['next.config.js'],
      }),
    ]);
  });

  it('returns react when package.json has "react" but NOT "next" in dependencies', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
      }),
    );

    const result = await detectFrameworks(tmpDir);

    expect(result).toEqual([
      expect.objectContaining({
        name: 'react',
        version: '18.x',
      }),
    ]);
  });

  it('returns vue when package.json has "vue" in dependencies', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.4.0' },
      }),
    );

    const result = await detectFrameworks(tmpDir);

    expect(result).toEqual([
      expect.objectContaining({
        name: 'vue',
        version: '3.x',
      }),
    ]);
  });

  it('returns svelte when package.json has "svelte" in dependencies and svelte.config.js exists', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { svelte: '^4.2.0' },
      }),
    );
    await writeFile(join(tmpDir, 'svelte.config.js'), 'export default {};');

    const result = await detectFrameworks(tmpDir);

    expect(result).toEqual([
      expect.objectContaining({
        name: 'svelte',
        configFiles: ['svelte.config.js'],
      }),
    ]);
  });

  it('returns empty array for a project with no recognized framework', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { express: '^4.18.0' },
      }),
    );

    const result = await detectFrameworks(tmpDir);

    expect(result).toEqual([]);
  });

  it('checks Next.js BEFORE generic React (Next.js projects also have react as a dep)', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '^14.0.0', react: '^18.0.0', 'react-dom': '^18.0.0' },
      }),
    );
    await writeFile(join(tmpDir, 'next.config.mjs'), 'export default {};');

    const result = await detectFrameworks(tmpDir);

    // Should detect nextjs but NOT react separately
    const names = result.map((f: FrameworkInfo) => f.name);
    expect(names).toContain('nextjs');
    expect(names).not.toContain('react');
  });

  it('returns multiple frameworks for monorepo-style package.json with both vue and react', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.4.0', react: '^18.2.0' },
      }),
    );

    const result = await detectFrameworks(tmpDir);

    const names = result.map((f: FrameworkInfo) => f.name);
    expect(names).toContain('react');
    expect(names).toContain('vue');
    expect(result.length).toBe(2);
  });

  it('returns empty array when package.json does not exist', async () => {
    // No package.json written to tmpDir
    const result = await detectFrameworks(tmpDir);
    expect(result).toEqual([]);
  });

  it('extracts version correctly from various semver formats', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        dependencies: { next: '~14.1.3', react: '18.2.0' },
      }),
    );
    await writeFile(join(tmpDir, 'next.config.js'), '');

    const result = await detectFrameworks(tmpDir);

    const nextFw = result.find((f: FrameworkInfo) => f.name === 'nextjs');
    expect(nextFw?.version).toBe('14.x');
  });

  it('detects frameworks from devDependencies as well', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        devDependencies: { svelte: '^4.0.0' },
      }),
    );
    await writeFile(join(tmpDir, 'svelte.config.js'), '');

    const result = await detectFrameworks(tmpDir);

    expect(result).toEqual([
      expect.objectContaining({
        name: 'svelte',
      }),
    ]);
  });
});
