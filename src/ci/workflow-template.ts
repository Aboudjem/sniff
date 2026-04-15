import { access } from 'node:fs/promises';
import { join } from 'node:path';
import type { CIWorkflowOptions } from './types.js';

export function generateGitHubActionsWorkflow(options: CIWorkflowOptions): string {
  const {
    packageName,
    nodeVersion,
    branches,
    timeoutMinutes,
    retentionDays,
    packageManager,
  } = options;

  const branchList = branches.map((b) => `'${b}'`).join(', ');

  const installCommand = getInstallCommand(packageManager);
  const lockfilePattern = getLockfilePattern(packageManager);
  const cacheType = packageManager === 'pnpm' ? 'pnpm' : packageManager === 'yarn' ? 'yarn' : 'npm';

  let pnpmSetupStep = '';
  if (packageManager === 'pnpm') {
    pnpmSetupStep = `
      - name: Setup pnpm
        uses: pnpm/action-setup@v4`;
  }

  return `name: Sniff QA

on:
  push:
    branches: [${branchList}]
  pull_request:
    branches: [${branchList}]

jobs:
  sniff:
    runs-on: ubuntu-latest
    timeout-minutes: ${timeoutMinutes}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
${pnpmSetupStep}
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: '${cacheType}'

      - name: Install dependencies
        run: ${installCommand}

      - name: Cache Playwright browsers
        id: playwright-cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: \${{ runner.os }}-playwright-\${{ hashFiles('${lockfilePattern}') }}

      - name: Install Playwright browsers (cache miss)
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium

      - name: Install Playwright dependencies (cache hit)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium

      - name: Run Sniff QA
        run: npx ${packageName} --ci
        env:
          CI: true

      - name: Upload Sniff reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sniff-reports
          path: sniff-reports/
          retention-days: ${retentionDays}
`;
}

function getInstallCommand(pm: CIWorkflowOptions['packageManager']): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm install';
    case 'yarn':
      return 'yarn install --frozen-lockfile';
    case 'npm':
    default:
      return 'npm ci';
  }
}

function getLockfilePattern(pm: CIWorkflowOptions['packageManager']): string {
  switch (pm) {
    case 'pnpm':
      return 'pnpm-lock.yaml';
    case 'yarn':
      return 'yarn.lock';
    case 'npm':
    default:
      return 'package-lock.json';
  }
}

export async function detectPackageManager(
  rootDir: string,
): Promise<'npm' | 'pnpm' | 'yarn'> {
  const checks: Array<{ file: string; result: CIWorkflowOptions['packageManager'] }> = [
    { file: 'pnpm-lock.yaml', result: 'pnpm' },
    { file: 'yarn.lock', result: 'yarn' },
    { file: 'package-lock.json', result: 'npm' },
  ];

  for (const check of checks) {
    try {
      await access(join(rootDir, check.file));
      return check.result;
    } catch {
      // file doesn't exist, continue
    }
  }

  return 'npm';
}
