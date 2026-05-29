import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
// @ts-expect-error — plain JS scoring lib shared with the CLI scorer
import { scoreReport } from '../../sniff-tests/score-lib.mjs';
import { runCrawl } from '../../src/crawl/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER = join(ROOT, 'sniff-tests', 'planted-bugs', 'server.mjs');
const MANIFEST = join(ROOT, 'sniff-tests', 'planted-bugs', 'MANIFEST.json');

let server: ChildProcess;
let baseUrl = '';

function startServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    server = spawn('node', [SERVER, '0'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const t = setTimeout(() => reject(new Error('fixture server did not start in time')), 10000);
    server.stdout!.on('data', (buf: Buffer) => {
      const m = buf.toString().match(/SNIFF_FIXTURE_LISTENING (\S+)/);
      if (m) { clearTimeout(t); resolve(m[1]); }
    });
    server.on('error', reject);
  });
}

describe('planted-bug fixture regression gate', () => {
  beforeAll(async () => { baseUrl = await startServer(); }, 15000);
  afterAll(() => { server?.kill('SIGTERM'); });

  it(
    'finds the planted bugs with high recall, low false positives, and nothing on the clean page',
    async () => {
      const report = await runCrawl({
        startUrl: baseUrl,
        maxPages: 25,
        headless: true,
        includeMobile: true,
        outputDir: join(tmpdir(), 'sniff-fixture-screens'),
      });
      const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
      const s = scoreReport(report, manifest);

      // Visibility on failure.
      if (s.recall < 0.85 || s.hardFalsePositivesOnCleanPage > 0 || s.precisionProxy < 0.8) {
        // eslint-disable-next-line no-console
        console.error('fixture score:', JSON.stringify(s, null, 2));
      }

      expect(s.recall).toBeGreaterThanOrEqual(0.85); // >= 18/21 planted bugs
      expect(s.precisionProxy).toBeGreaterThanOrEqual(0.8);
      expect(s.hardFalsePositivesOnCleanPage).toBe(0); // never flag the clean control page
    },
    180000,
  );
});
