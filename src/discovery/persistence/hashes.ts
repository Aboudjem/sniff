import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface HashEntry {
  hash: string;
  userOwned?: boolean;
}

export type HashMap = Record<string, HashEntry>;

export function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export async function loadHashes(generatedDir: string): Promise<HashMap> {
  const path = join(generatedDir, '.hashes.json');
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as HashMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function saveHashes(generatedDir: string, hashes: HashMap): Promise<void> {
  const path = join(generatedDir, '.hashes.json');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(hashes, null, 2), 'utf-8');
}

export async function currentFileHash(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return hashContent(raw);
  } catch {
    return null;
  }
}
