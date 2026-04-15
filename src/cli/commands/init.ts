import { writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_TEMPLATE = `import { defineConfig } from 'sniff';

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

export async function initCommand(options: {
  force?: boolean;
}): Promise<void> {
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

  // Write config file
  const configPath = join(cwd, 'sniff.config.ts');
  await writeFile(configPath, CONFIG_TEMPLATE);
  console.log('Created sniff.config.ts');

  // Handle .gitignore
  const gitignorePath = join(cwd, '.gitignore');
  try {
    await access(gitignorePath);
    // .gitignore exists, check if .sniff is already in it
    const content = await readFile(gitignorePath, 'utf-8');
    if (!content.includes('.sniff')) {
      await writeFile(gitignorePath, content.trimEnd() + '\n.sniff/\n');
      console.log('Added .sniff/ to .gitignore');
    }
  } catch {
    // .gitignore doesn't exist, create it
    await writeFile(gitignorePath, '.sniff/\n');
    console.log('Added .sniff/ to .gitignore');
  }
}
