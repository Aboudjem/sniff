import { cosmiconfig } from 'cosmiconfig';
import { sniffConfigSchema, type SniffConfig } from './schema.js';

export async function loadConfig(searchFrom?: string): Promise<SniffConfig> {
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

  const result = await explorer.search(searchFrom);
  const raw = result?.config ?? {};

  const parsed = sniffConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const { prettifyError } = await import('zod');
    const formatted = prettifyError(parsed.error);
    throw new Error(`Invalid sniff config:\n${formatted}`);
  }

  return parsed.data;
}
