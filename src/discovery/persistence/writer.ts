import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { AppTypeGuess } from '../classifier/types.js';
import type { Scenario } from '../scenarios/types.js';
import type { DomainSnapshot } from '../types.js';
import { scenarioRelativePath, scenarioToMarkdown } from './scenario-file.js';
import {
  currentFileHash,
  hashContent,
  loadHashes,
  saveHashes,
  type HashEntry,
  type HashMap,
} from './hashes.js';

export interface Conflict {
  path: string;
  relativePath: string;
  storedHash: string;
  currentHash: string;
  scenarioId: string;
}

export type ConflictAction = 'keep' | 'overwrite' | 'move-to-custom';

export interface ConflictResolver {
  (conflict: Conflict): Promise<ConflictAction>;
}

export interface SaveScenariosOptions {
  rootDir: string;
  snapshot: DomainSnapshot;
  guesses: AppTypeGuess[];
  scenarios: Scenario[];
  forceRegenerate?: boolean;
  nonInteractive?: boolean;
  onConflict?: ConflictResolver;
}

export interface SaveScenariosResult {
  scenariosDir: string;
  generatedDir: string;
  customDir: string;
  written: string[];
  skippedKept: string[];
  movedToCustom: string[];
  removed: string[];
  conflicts: Conflict[];
}

const GITIGNORE_CONTENTS = '# sniff discovery artifacts\ncache/\nruns/\n';

async function listGeneratedScenarioFiles(generatedDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs);
      } else if (entry.isFile() && entry.name.endsWith('.scenario.md')) {
        out.push(abs);
      }
    }
  }
  await walk(generatedDir);
  return out;
}

async function writeIfChanged(path: string, content: string): Promise<boolean> {
  await mkdir(dirname(path), { recursive: true });
  try {
    const existing = await readFile(path, 'utf-8');
    if (existing === content) return false;
  } catch {
    // doesn't exist yet
  }
  await writeFile(path, content, 'utf-8');
  return true;
}

async function ensureGitignore(scenariosDir: string): Promise<void> {
  const path = join(scenariosDir, '.gitignore');
  try {
    await stat(path);
    return;
  } catch {
    // missing; write default
  }
  await mkdir(scenariosDir, { recursive: true });
  await writeFile(path, GITIGNORE_CONTENTS, 'utf-8');
}

async function resolveConflict(
  conflict: Conflict,
  options: SaveScenariosOptions,
): Promise<ConflictAction> {
  if (options.forceRegenerate) return 'overwrite';
  if (options.nonInteractive) return 'keep';
  if (options.onConflict) return options.onConflict(conflict);
  return 'keep';
}

async function moveToCustom(
  generatedPath: string,
  customDir: string,
  generatedDir: string,
): Promise<string> {
  const rel = relative(generatedDir, generatedPath);
  const dest = join(customDir, rel);
  await mkdir(dirname(dest), { recursive: true });
  const content = await readFile(generatedPath, 'utf-8');
  await writeFile(dest, content, 'utf-8');
  return dest;
}

export async function saveDiscoveryScenarios(
  options: SaveScenariosOptions,
): Promise<SaveScenariosResult> {
  const scenariosDir = join(options.rootDir, 'sniff-scenarios');
  const generatedDir = join(scenariosDir, '_generated');
  const customDir = join(scenariosDir, 'custom');

  await mkdir(generatedDir, { recursive: true });
  await mkdir(customDir, { recursive: true });
  await ensureGitignore(scenariosDir);

  const hashes = await loadHashes(generatedDir);
  const nextHashes: HashMap = {};
  const result: SaveScenariosResult = {
    scenariosDir,
    generatedDir,
    customDir,
    written: [],
    skippedKept: [],
    movedToCustom: [],
    removed: [],
    conflicts: [],
  };

  const intendedPaths = new Set<string>();

  for (const scenario of options.scenarios) {
    const rel = scenarioRelativePath(scenario);
    const abs = join(generatedDir, rel);
    intendedPaths.add(abs);

    const content = scenarioToMarkdown(scenario);
    const newHash = hashContent(content);
    const stored = hashes[rel];
    const currentHash = await currentFileHash(abs);

    if (stored?.userOwned) {
      nextHashes[rel] = { hash: stored.hash, userOwned: true };
      result.skippedKept.push(abs);
      continue;
    }

    if (currentHash && stored && currentHash !== stored.hash) {
      const conflict: Conflict = {
        path: abs,
        relativePath: rel,
        storedHash: stored.hash,
        currentHash,
        scenarioId: scenario.id,
      };
      result.conflicts.push(conflict);
      const action = await resolveConflict(conflict, options);

      if (action === 'keep') {
        nextHashes[rel] = { hash: stored.hash, userOwned: true };
        result.skippedKept.push(abs);
        continue;
      }
      if (action === 'move-to-custom') {
        const moved = await moveToCustom(abs, customDir, generatedDir);
        result.movedToCustom.push(moved);
      }
    }

    const changed = await writeIfChanged(abs, content);
    if (changed) result.written.push(abs);
    nextHashes[rel] = { hash: newHash };
  }

  const existing = await listGeneratedScenarioFiles(generatedDir);
  for (const abs of existing) {
    if (intendedPaths.has(abs)) continue;
    const rel = relative(generatedDir, abs);
    const stored = hashes[rel];
    if (stored?.userOwned) continue;
    const currentHash = await currentFileHash(abs);
    if (currentHash && stored && currentHash !== stored.hash) {
      const conflict: Conflict = {
        path: abs,
        relativePath: rel,
        storedHash: stored.hash,
        currentHash,
        scenarioId: '(removed)',
      };
      result.conflicts.push(conflict);
      const action = await resolveConflict(conflict, options);
      if (action === 'keep') continue;
      if (action === 'move-to-custom') {
        const moved = await moveToCustom(abs, customDir, generatedDir);
        result.movedToCustom.push(moved);
      }
    }
    try {
      await rm(abs);
      result.removed.push(abs);
    } catch {
      // ignore
    }
  }

  const snapshotPath = join(generatedDir, 'snapshot.json');
  const classificationPath = join(generatedDir, 'classification.json');
  await writeIfChanged(snapshotPath, JSON.stringify(options.snapshot, null, 2));
  await writeIfChanged(classificationPath, JSON.stringify(options.guesses, null, 2));

  await saveHashes(generatedDir, nextHashes);
  return result;
}

export { loadHashes, saveHashes };
export type { HashEntry, HashMap };
