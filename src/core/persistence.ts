import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScanResult } from '../scanners/types.js';

const SNIFF_DIR = '.sniff';
const RESULTS_FILE = 'last-results.json';

export async function saveResults(
  rootDir: string,
  results: ScanResult[],
): Promise<void> {
  const dir = join(rootDir, SNIFF_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, RESULTS_FILE),
    JSON.stringify(
      { timestamp: new Date().toISOString(), results },
      null,
      2,
    ),
  );
}

export async function loadLastResults(
  rootDir: string,
): Promise<{ timestamp: string; results: ScanResult[] } | null> {
  try {
    const data = await readFile(
      join(rootDir, SNIFF_DIR, RESULTS_FILE),
      'utf-8',
    );
    return JSON.parse(data) as { timestamp: string; results: ScanResult[] };
  } catch {
    return null;
  }
}
