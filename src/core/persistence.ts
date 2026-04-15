import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScanResult } from '../scanners/types.js';
import type { TestRunRecord, FlakinessHistory } from './types.js';
import { computeFlakeStatus } from './flakiness.js';

const SNIFF_DIR = '.sniff';
const RESULTS_FILE = 'last-results.json';
const HISTORY_FILE = 'history.json';
const MAX_HISTORY_PER_TEST = 10;

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

/**
 * Load flakiness history from .sniff/history.json.
 * Returns null on any error (file not found, parse error) -- graceful degradation (T-04-01).
 */
export async function loadFlakinessHistory(
  rootDir: string,
): Promise<FlakinessHistory | null> {
  try {
    const data = await readFile(
      join(rootDir, SNIFF_DIR, HISTORY_FILE),
      'utf-8',
    );
    const parsed = JSON.parse(data);
    // Validate structure minimally (T-04-01: do not execute, only deserialize)
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 1 &&
      Array.isArray(parsed.runs) &&
      Array.isArray(parsed.flaky)
    ) {
      return parsed as FlakinessHistory;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Append run records to .sniff/history.json, trim old entries, and recompute flaky list.
 * Enforces MAX_HISTORY_PER_TEST per testId to prevent unbounded growth (T-04-02).
 */
export async function appendRunHistory(
  rootDir: string,
  records: TestRunRecord[],
): Promise<void> {
  const dir = join(rootDir, SNIFF_DIR);
  await mkdir(dir, { recursive: true });

  // Load existing or start fresh
  const existing = await loadFlakinessHistory(rootDir);
  const history: FlakinessHistory = existing ?? { version: 1, runs: [], flaky: [] };

  // Append new records
  history.runs.push(...records);

  // Group by testId and trim to MAX_HISTORY_PER_TEST per test
  const grouped = new Map<string, TestRunRecord[]>();
  for (const run of history.runs) {
    const group = grouped.get(run.testId) ?? [];
    group.push(run);
    grouped.set(run.testId, group);
  }

  const trimmedRuns: TestRunRecord[] = [];
  for (const [, runs] of grouped) {
    trimmedRuns.push(...runs.slice(-MAX_HISTORY_PER_TEST));
  }
  history.runs = trimmedRuns;

  // Recompute flaky list
  const flakySet = new Set<string>();
  for (const testId of grouped.keys()) {
    const status = computeFlakeStatus(history, testId);
    if (status.isFlaky) {
      flakySet.add(testId);
    }
  }
  history.flaky = [...flakySet];

  await writeFile(
    join(dir, HISTORY_FILE),
    JSON.stringify(history, null, 2),
  );
}
