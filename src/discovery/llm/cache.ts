import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function keyFor(system: string, user: string, purpose: string): string {
  return createHash('sha256').update(`${purpose}::${system}::${user}`, 'utf-8').digest('hex');
}

export interface CacheLookupInput {
  rootDir: string;
  cacheDir: string;
  system: string;
  user: string;
  purpose: string;
}

export async function readLlmCache(input: CacheLookupInput): Promise<string | null> {
  const key = keyFor(input.system, input.user, input.purpose);
  const path = join(input.rootDir, input.cacheDir, `${key}.json`);
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as { response?: string };
    return typeof parsed.response === 'string' ? parsed.response : null;
  } catch {
    return null;
  }
}

export async function writeLlmCache(input: CacheLookupInput, response: string): Promise<void> {
  const key = keyFor(input.system, input.user, input.purpose);
  const dir = join(input.rootDir, input.cacheDir);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${key}.json`);
  await writeFile(
    path,
    JSON.stringify({ purpose: input.purpose, response, cachedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  );
}

export { keyFor as cacheKeyFor };
