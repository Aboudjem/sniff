import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendRunHistory, loadFlakinessHistory } from './persistence.js';
import type { TestRunRecord, FlakinessHistory } from './types.js';

function makeRecord(testId: string, passed: boolean, runId = 'run-1'): TestRunRecord {
  return {
    runId,
    timestamp: new Date().toISOString(),
    testId,
    passed,
    duration: 100,
  };
}

describe('persistence - flakiness history', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'sniff-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadFlakinessHistory', () => {
    it('returns null when file does not exist', async () => {
      const result = await loadFlakinessHistory(tempDir);
      expect(result).toBeNull();
    });

    it('returns parsed data when file exists', async () => {
      const history: FlakinessHistory = {
        version: 1,
        runs: [makeRecord('test-1', false)],
        flaky: [],
      };
      await mkdir(join(tempDir, '.sniff'), { recursive: true });
      await writeFile(
        join(tempDir, '.sniff', 'history.json'),
        JSON.stringify(history),
      );

      const result = await loadFlakinessHistory(tempDir);
      expect(result).not.toBeNull();
      expect(result!.version).toBe(1);
      expect(result!.runs).toHaveLength(1);
      expect(result!.runs[0].testId).toBe('test-1');
    });

    it('returns null for malformed JSON', async () => {
      await mkdir(join(tempDir, '.sniff'), { recursive: true });
      await writeFile(join(tempDir, '.sniff', 'history.json'), 'not json');

      const result = await loadFlakinessHistory(tempDir);
      expect(result).toBeNull();
    });

    it('returns null for valid JSON with wrong structure', async () => {
      await mkdir(join(tempDir, '.sniff'), { recursive: true });
      await writeFile(
        join(tempDir, '.sniff', 'history.json'),
        JSON.stringify({ version: 2, data: [] }),
      );

      const result = await loadFlakinessHistory(tempDir);
      expect(result).toBeNull();
    });
  });

  describe('appendRunHistory', () => {
    it('creates .sniff/history.json on first run', async () => {
      const records = [makeRecord('test-1', false)];
      await appendRunHistory(tempDir, records);

      const data = await readFile(join(tempDir, '.sniff', 'history.json'), 'utf-8');
      const history = JSON.parse(data) as FlakinessHistory;
      expect(history.version).toBe(1);
      expect(history.runs).toHaveLength(1);
      expect(history.runs[0].testId).toBe('test-1');
    });

    it('appends to existing history', async () => {
      await appendRunHistory(tempDir, [makeRecord('test-1', false, 'run-1')]);
      await appendRunHistory(tempDir, [makeRecord('test-1', false, 'run-2')]);

      const data = await readFile(join(tempDir, '.sniff', 'history.json'), 'utf-8');
      const history = JSON.parse(data) as FlakinessHistory;
      expect(history.runs).toHaveLength(2);
    });

    it('trims to MAX_HISTORY_PER_TEST (10) per testId', async () => {
      // Append 12 records for the same test
      for (let i = 0; i < 12; i++) {
        await appendRunHistory(tempDir, [makeRecord('test-1', false, `run-${i}`)]);
      }

      const data = await readFile(join(tempDir, '.sniff', 'history.json'), 'utf-8');
      const history = JSON.parse(data) as FlakinessHistory;
      const test1Runs = history.runs.filter((r) => r.testId === 'test-1');
      expect(test1Runs).toHaveLength(10);
      // Should keep the most recent 10 (run-2 through run-11)
      expect(test1Runs[0].runId).toBe('run-2');
      expect(test1Runs[9].runId).toBe('run-11');
    });

    it('recomputes flaky list after append', async () => {
      // Add 5 failures for the same test -> should become flaky (3/5 threshold)
      for (let i = 0; i < 5; i++) {
        await appendRunHistory(tempDir, [makeRecord('test-1', false, `run-${i}`)]);
      }

      const data = await readFile(join(tempDir, '.sniff', 'history.json'), 'utf-8');
      const history = JSON.parse(data) as FlakinessHistory;
      expect(history.flaky).toContain('test-1');
    });
  });
});
