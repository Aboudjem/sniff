import { writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_TEMPLATE_TS = `import { defineConfig } from 'sniff-qa';

export default defineConfig({
  // Severity threshold for CLI exit code
  // failOn: ['critical', 'high'],

  // File patterns to exclude from scanning
  // exclude: ['node_modules/**', 'dist/**'],

  // Rule configuration
  // rules: {
  //   'placeholder-lorem': 'off',
  //   'placeholder-todo': 'medium',
  // },
});
`;

const CONFIG_TEMPLATE_ESM = `import { defineConfig } from 'sniff-qa';

export default defineConfig({
  // Severity threshold for CLI exit code
  // failOn: ['critical', 'high'],

  // File patterns to exclude from scanning
  // exclude: ['node_modules/**', 'dist/**'],

  // Rule configuration
  // rules: {
  //   'placeholder-lorem': 'off',
  //   'placeholder-todo': 'medium',
  // },
});
`;

const CONFIG_TEMPLATE_CJS = `const { defineConfig } = require('sniff-qa');

module.exports = defineConfig({
  // Severity threshold for CLI exit code
  // failOn: ['critical', 'high'],

  // File patterns to exclude from scanning
  // exclude: ['node_modules/**', 'dist/**'],

  // Rule configuration
  // rules: {
  //   'placeholder-lorem': 'off',
  //   'placeholder-todo': 'medium',
  // },
});
`;

export type InitFlavor = 'ts' | 'esm' | 'cjs';

/**
 * Detect which flavor to write based on the project.
 * - TypeScript project (tsconfig.json or typescript dep) → .ts
 * - ESM project (package.json "type": "module") → .js ESM
 * - Anything else → .js CJS
 */
export async function detectInitFlavor(cwd: string): Promise<InitFlavor> {
  const pkgPath = join(cwd, 'package.json');
  let pkg: Record<string, unknown> = {};
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  } catch {
    // no package.json — default to plain JS
  }

  const deps = { ...(pkg.dependencies as Record<string, string> ?? {}), ...(pkg.devDependencies as Record<string, string> ?? {}) };
  const hasTypescriptDep = 'typescript' in deps;

  let hasTsconfig = false;
  try {
    await access(join(cwd, 'tsconfig.json'));
    hasTsconfig = true;
  } catch {
    // ok
  }

  if (hasTypescriptDep || hasTsconfig) return 'ts';
  if (pkg.type === 'module') return 'esm';
  return 'cjs';
}

function templateFor(flavor: InitFlavor): string {
  switch (flavor) {
    case 'ts':
      return CONFIG_TEMPLATE_TS;
    case 'esm':
      return CONFIG_TEMPLATE_ESM;
    case 'cjs':
      return CONFIG_TEMPLATE_CJS;
  }
}

function filenameFor(flavor: InitFlavor): string {
  switch (flavor) {
    case 'ts':
      return 'sniff.config.ts';
    case 'esm':
      return 'sniff.config.mjs';
    case 'cjs':
      return 'sniff.config.js';
  }
}

export interface InitCommandOptions {
  force?: boolean;
  ts?: boolean;
  js?: boolean;
}

export async function initCommand(options: InitCommandOptions): Promise<void> {
  const { cosmiconfig } = await import('cosmiconfig');
  const cwd = process.cwd();

  // Check for existing config
  const explorer = cosmiconfig('sniff', {
    searchPlaces: [
      'package.json',
      '.sniffrc',
      '.sniffrc.json',
      '.sniffrc.yaml',
      '.sniffrc.yml',
      '.sniffrc.js',
      '.sniffrc.ts',
      '.sniffrc.cjs',
      '.sniffrc.mjs',
      'sniff.config.js',
      'sniff.config.ts',
      'sniff.config.cjs',
      'sniff.config.mjs',
    ],
  });

  const existing = await explorer.search(cwd);
  if (existing && !options.force) {
    console.log(
      `Config already exists at ${existing.filepath}. Use --force to overwrite.`,
    );
    return;
  }

  // Flag overrides auto-detect
  let flavor: InitFlavor;
  if (options.ts) {
    flavor = 'ts';
  } else if (options.js) {
    // --js respects the ESM/CJS shape
    const detected = await detectInitFlavor(cwd);
    flavor = detected === 'ts' ? 'esm' : detected;
  } else {
    flavor = await detectInitFlavor(cwd);
  }

  const filename = filenameFor(flavor);
  const configPath = join(cwd, filename);
  await writeFile(configPath, templateFor(flavor));
  console.log(`Created ${filename} (${flavor} flavor)`);

  // Handle .gitignore
  const gitignorePath = join(cwd, '.gitignore');
  try {
    await access(gitignorePath);
    const content = await readFile(gitignorePath, 'utf-8');
    if (!content.includes('.sniff')) {
      await writeFile(gitignorePath, content.trimEnd() + '\n.sniff/\n');
      console.log('Added .sniff/ to .gitignore');
    }
  } catch {
    await writeFile(gitignorePath, '.sniff/\n');
    console.log('Added .sniff/ to .gitignore');
  }
}
