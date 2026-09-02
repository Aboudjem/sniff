import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectStorageStateSecrets,
  createRedactor,
  redactDeep,
  installRedactor,
  clearRedactor,
  isRedactorInstalled,
  redactText,
  redactValue,
  loadStorageState,
  useStorageState,
  REDACTED,
  MIN_SECRET_LENGTH,
} from '../core/redaction.js';
import { writeCrawlArtifacts } from './write-report.js';
import type { CrawlReport } from './types.js';

/** A storage state shaped like one Playwright would write. */
const COOKIE_TOKEN = 'sess_9f2c41ab7de84c0fa1b6e5d3c8074219';
const NESTED_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.nested-access-token.sig';
const IDB_TOKEN = 'idb_refresh_6d1e0f4a9b2c';
const ENCODABLE_COOKIE = 'a/b+c=d e';

function storageStateFixture(): Record<string, unknown> {
  return {
    cookies: [
      { name: 'session', value: COOKIE_TOKEN, domain: 'app.example.test', path: '/' },
      { name: 'legacy', value: ENCODABLE_COOKIE, domain: 'app.example.test', path: '/' },
      { name: 'tiny', value: 'ab', domain: 'app.example.test', path: '/' },
    ],
    origins: [
      {
        origin: 'https://app.example.test',
        localStorage: [
          { name: 'auth', value: JSON.stringify({ accessToken: NESTED_TOKEN, expiresIn: 3600 }) },
        ],
        indexedDB: [
          { name: 'kv', stores: [{ records: [{ key: 'refresh', value: IDB_TOKEN }] }] },
        ],
      },
    ],
  };
}

/** A report carrying the planted token in every string position that matters. */
function reportWithSecrets(): CrawlReport {
  return {
    findings: [
      {
        ruleId: 'route/broken-page',
        issueClass: 1,
        title: `Request to /api/me?token=${COOKIE_TOKEN} returned 500`,
        severity: 'critical',
        confidence: 'confirmed',
        suggestedFix: `Stop echoing ${NESTED_TOKEN} in the error body.`,
        reproduction: {
          url: `https://app.example.test/dash?session=${COOKIE_TOKEN}`,
          route: `/dash/${IDB_TOKEN}`,
          steps: [`Open /dash with cookie session=${COOKIE_TOKEN}`],
          screenshotPath: `sniff-reports/crawl/_dash_${IDB_TOKEN}-desktop.png`,
          consoleExcerpt: [`Failed: Authorization: Bearer ${NESTED_TOKEN}`],
          networkExcerpt: [`GET /api/me?t=${encodeURIComponent(ENCODABLE_COOKIE)} 401`],
        },
      },
    ],
    stats: { pagesVisited: 1, linksChecked: 0, durationMs: 12, startUrl: 'https://app.example.test' },
    routes: ['/dash'],
    runAt: '2026-09-02T00:00:00.000Z',
    summary: {
      total: 1,
      bySeverity: { critical: 1 },
      byConfidence: { confirmed: 1 },
      byIssueClass: { '1': 1 },
    },
  };
}

describe('storage-state redaction', () => {
  beforeEach(() => clearRedactor());
  afterEach(() => clearRedactor());

  describe('collectStorageStateSecrets', () => {
    it('collects cookie values', () => {
      const secrets = collectStorageStateSecrets(storageStateFixture());
      expect(secrets).toContain(COOKIE_TOKEN);
    });

    it('unwraps a token nested inside a JSON localStorage value', () => {
      const secrets = collectStorageStateSecrets(storageStateFixture());
      expect(secrets).toContain(NESTED_TOKEN);
    });

    it('walks indexedDB state', () => {
      const secrets = collectStorageStateSecrets(storageStateFixture());
      expect(secrets).toContain(IDB_TOKEN);
    });

    it('registers the percent-encoded form of a value with reserved characters', () => {
      const secrets = collectStorageStateSecrets(storageStateFixture());
      expect(secrets).toContain(ENCODABLE_COOKIE);
      expect(secrets).toContain(encodeURIComponent(ENCODABLE_COOKIE));
    });

    it(`skips values shorter than ${MIN_SECRET_LENGTH} characters`, () => {
      const secrets = collectStorageStateSecrets(storageStateFixture());
      expect(secrets).not.toContain('ab');
      expect(secrets.every((s) => s.length >= MIN_SECRET_LENGTH)).toBe(true);
    });

    it('returns nothing for a non-object', () => {
      expect(collectStorageStateSecrets(null)).toEqual([]);
      expect(collectStorageStateSecrets('nope')).toEqual([]);
    });

    it('ignores cookie names and domains, which are structural', () => {
      const secrets = collectStorageStateSecrets(storageStateFixture());
      expect(secrets).not.toContain('app.example.test');
      expect(secrets).not.toContain('session');
    });
  });

  describe('createRedactor', () => {
    it('replaces a literal occurrence', () => {
      const redact = createRedactor([COOKIE_TOKEN]);
      expect(redact(`cookie=${COOKIE_TOKEN};`)).toBe(`cookie=${REDACTED};`);
    });

    it('replaces the longest match first so no fragment survives', () => {
      const redact = createRedactor(['abcd', 'abcdefgh']);
      expect(redact('abcdefgh')).toBe(REDACTED);
    });

    it('redacts an Authorization header value it never saw in the file', () => {
      const redact = createRedactor(['unrelated-secret']);
      expect(redact('Authorization: Bearer surprise-token-value')).toBe(
        `Authorization: Bearer ${REDACTED}`,
      );
      expect(redact('"authorization": "Token abc123def"')).toContain(REDACTED);
    });

    it('leaves ordinary text alone', () => {
      const redact = createRedactor([COOKIE_TOKEN]);
      expect(redact('no issues found')).toBe('no issues found');
    });
  });

  describe('redactDeep', () => {
    it('maps every string in a nested structure', () => {
      const redact = createRedactor([COOKIE_TOKEN]);
      const out = redactDeep(
        { a: COOKIE_TOKEN, b: [{ c: `x${COOKIE_TOKEN}y` }], n: 3, t: true, z: null },
        redact,
      );
      expect(out).toEqual({ a: REDACTED, b: [{ c: `x${REDACTED}y` }], n: 3, t: true, z: null });
    });
  });

  describe('the process-level redactor', () => {
    it('is a no-op until something is installed', () => {
      expect(isRedactorInstalled()).toBe(false);
      expect(redactText(COOKIE_TOKEN)).toBe(COOKIE_TOKEN);
      expect(redactValue({ a: COOKIE_TOKEN })).toEqual({ a: COOKIE_TOKEN });
    });

    it('installs from a collected secret list', () => {
      installRedactor(collectStorageStateSecrets(storageStateFixture()));
      expect(isRedactorInstalled()).toBe(true);
      expect(redactText(`x ${COOKIE_TOKEN} y`)).toBe(`x ${REDACTED} y`);
    });

    it('stays a no-op when the secret list is empty', () => {
      installRedactor([]);
      expect(isRedactorInstalled()).toBe(false);
    });
  });

  describe('loadStorageState', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'sniff-storage-'));
    });
    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('fails loudly on a missing file rather than crawling logged out', async () => {
      await expect(loadStorageState(join(dir, 'nope.json'))).rejects.toThrow(/Cannot read the storage state/);
    });

    it('fails loudly on invalid JSON', async () => {
      const p = join(dir, 'bad.json');
      await writeFile(p, '{not json');
      await expect(loadStorageState(p)).rejects.toThrow(/not valid JSON/);
    });

    it('rejects a JSON array, which is not a storage state', async () => {
      const p = join(dir, 'arr.json');
      await writeFile(p, '[]');
      await expect(loadStorageState(p)).rejects.toThrow(/not a Playwright storage-state object/);
    });

    it('useStorageState parses once and installs the redactor from that object', async () => {
      const p = join(dir, 'auth.json');
      await writeFile(p, JSON.stringify(storageStateFixture()));
      const state = await useStorageState(p);
      expect(Array.isArray((state as { cookies: unknown[] }).cookies)).toBe(true);
      expect(isRedactorInstalled()).toBe(true);
      expect(redactText(COOKIE_TOKEN)).toBe(REDACTED);
    });
  });

  describe('written artifacts', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'sniff-report-'));
    });
    afterEach(async () => {
      await rm(dir, { recursive: true, force: true });
    });

    it('never writes a planted token into the JSON or the HTML report', async () => {
      const statePath = join(dir, 'auth.json');
      await writeFile(statePath, JSON.stringify(storageStateFixture()));
      await useStorageState(statePath);

      const { jsonPath, htmlPath } = await writeCrawlArtifacts({
        reportDir: join(dir, 'sniff-reports'),
        report: reportWithSecrets(),
        html: true,
        title: 'sniff: app.example.test',
      });

      const json = await readFile(jsonPath, 'utf8');
      const html = await readFile(htmlPath as string, 'utf8');

      for (const [label, token] of Object.entries({
        cookie: COOKIE_TOKEN,
        nestedJson: NESTED_TOKEN,
        indexedDb: IDB_TOKEN,
        encodedCookie: encodeURIComponent(ENCODABLE_COOKIE),
      })) {
        expect(json, `${label} leaked into the JSON report`).not.toContain(token);
        expect(html, `${label} leaked into the HTML report`).not.toContain(token);
      }

      // The reports were still written, and say what was removed.
      expect(json).toContain(REDACTED);
      expect(html).toContain(REDACTED);
      expect(JSON.parse(json).findings).toHaveLength(1);
      expect(html).toContain('returned 500');
    });

    it('writes the report unchanged when no storage state was loaded', async () => {
      const { jsonPath } = await writeCrawlArtifacts({
        reportDir: join(dir, 'sniff-reports'),
        report: reportWithSecrets(),
      });
      const json = await readFile(jsonPath, 'utf8');
      expect(json).toContain(COOKIE_TOKEN);
      expect(json).not.toContain(REDACTED);
    });
  });
});
