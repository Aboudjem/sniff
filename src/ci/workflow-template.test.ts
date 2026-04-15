import { describe, it, expect } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateGitHubActionsWorkflow, detectPackageManager } from './workflow-template.js';
import type { CIWorkflowOptions } from './types.js';

function defaultOptions(overrides?: Partial<CIWorkflowOptions>): CIWorkflowOptions {
  return {
    packageName: 'sniff-qa',
    nodeVersion: '22',
    branches: ['main', 'master'],
    timeoutMinutes: 15,
    retentionDays: 30,
    packageManager: 'npm',
    ...overrides,
  };
}

describe('generateGitHubActionsWorkflow', () => {
  it('contains workflow name', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('name: Sniff QA');
  });

  it('contains actions/checkout@v4', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('actions/checkout@v4');
  });

  it('contains actions/setup-node@v4 with correct node version', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('actions/setup-node@v4');
    expect(yaml).toContain("node-version: '22'");
  });

  it('contains actions/cache@v4 with Playwright browser path', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('actions/cache@v4');
    expect(yaml).toContain('~/.cache/ms-playwright');
  });

  it('contains npx sniff-qa --ci by default', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('npx sniff-qa --ci');
  });

  it('contains if: always() on upload-artifact step', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('if: always()');
    expect(yaml).toContain('actions/upload-artifact@v4');
  });

  it('contains timeout-minutes: 15', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions());
    expect(yaml).toContain('timeout-minutes: 15');
  });

  it('uses custom package name in npx command', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions({ packageName: 'custom-name' }));
    expect(yaml).toContain('npx custom-name --ci');
    expect(yaml).not.toContain('npx sniff-qa --ci');
  });

  it('uses custom branches', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions({ branches: ['develop'] }));
    expect(yaml).toContain("branches: ['develop']");
    expect(yaml).not.toContain("'main'");
  });

  it('includes pnpm setup step for pnpm', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions({ packageManager: 'pnpm' }));
    expect(yaml).toContain('pnpm/action-setup@v4');
    expect(yaml).toContain('pnpm install');
  });

  it('uses yarn install --frozen-lockfile for yarn', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions({ packageManager: 'yarn' }));
    expect(yaml).toContain('yarn install --frozen-lockfile');
  });

  it('uses npm ci for npm', () => {
    const yaml = generateGitHubActionsWorkflow(defaultOptions({ packageManager: 'npm' }));
    expect(yaml).toContain('npm ci');
  });
});

describe('detectPackageManager', () => {
  let tempDir: string;

  async function createTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'sniff-ci-test-'));
    return dir;
  }

  it('detects pnpm from pnpm-lock.yaml', async () => {
    tempDir = await createTempDir();
    await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('pnpm');
    await rm(tempDir, { recursive: true });
  });

  it('detects yarn from yarn.lock', async () => {
    tempDir = await createTempDir();
    await writeFile(join(tempDir, 'yarn.lock'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('yarn');
    await rm(tempDir, { recursive: true });
  });

  it('detects npm from package-lock.json', async () => {
    tempDir = await createTempDir();
    await writeFile(join(tempDir, 'package-lock.json'), '');
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('npm');
    await rm(tempDir, { recursive: true });
  });

  it('defaults to npm when no lockfile present', async () => {
    tempDir = await createTempDir();
    const result = await detectPackageManager(tempDir);
    expect(result).toBe('npm');
    await rm(tempDir, { recursive: true });
  });
});
