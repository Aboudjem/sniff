import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseJsonFrontmatter,
  serializeJsonFrontmatter,
} from './frontmatter.js';
import {
  markdownToScenario,
  scenarioRelativePath,
  scenarioToMarkdown,
} from './scenario-file.js';
import { hashContent, loadHashes } from './hashes.js';
import { saveDiscoveryScenarios } from './writer.js';
import type { Scenario } from '../scenarios/types.js';
import type { DomainSnapshot } from '../types.js';
import type { AppTypeGuess } from '../classifier/types.js';

function makeScenario(id: string, appType: string = 'ecommerce', journey: string = 'browse-and-buy'): Scenario {
  return {
    id,
    name: 'Browse and buy',
    appType: appType as Scenario['appType'],
    journey,
    variant: 'happy',
    persona: 'casual-shopper',
    realism: 'casual-user',
    steps: [
      { n: 1, intent: 'Go to home', action: 'navigate', url: '/' },
      { n: 2, intent: 'Click a product', action: 'click' },
    ],
    goal: { kind: 'text', value: 'Order placed', description: 'Shopper completes a purchase' },
    validations: { perStep: [], perScenario: [] },
    tags: ['ecommerce', 'happy-path'],
    generatedFrom: { routes: ['/'], entities: ['Product'], forms: [], confidence: 0.9 },
  };
}

function makeSnapshot(): DomainSnapshot {
  return {
    project: { name: 'fixture', frameworks: [], rootDir: '/tmp/fixture' },
    routes: [],
    forms: [],
    entities: [],
    relations: [],
    apiEndpoints: [],
    vocabulary: { routes: [], elements: [], deps: [] },
    metadata: { analyzedAt: '2026-04-17T00:00:00.000Z', duration: 0 },
  };
}

describe('persistence: frontmatter', () => {
  it('round-trips a JSON payload', () => {
    const data = { id: 'x', n: 3, nested: { ok: true } };
    const body = '# Title\n\nbody text.';
    const text = serializeJsonFrontmatter(data, body);
    const parsed = parseJsonFrontmatter<typeof data>(text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.data).toEqual(data);
    expect(parsed.body.trim()).toBe(body);
  });

  it('reports missing opening marker', () => {
    const res = parseJsonFrontmatter('no frontmatter here');
    expect(res.error).toMatch(/opening/);
    expect(res.data).toBeNull();
  });

  it('reports invalid JSON inside frontmatter', () => {
    const broken = '---json\n{ not: "valid" }\n---\nbody';
    const res = parseJsonFrontmatter(broken);
    expect(res.error).toMatch(/invalid JSON/);
  });
});

describe('persistence: scenario file', () => {
  it('round-trips a Scenario through markdown', () => {
    const scenario = makeScenario('ecommerce.browse-and-buy.happy');
    const md = scenarioToMarkdown(scenario);
    const { scenario: parsed, error } = markdownToScenario(md);
    expect(error).toBeUndefined();
    expect(parsed).toEqual(scenario);
  });

  it('computes a sensible relative path', () => {
    const scenario = makeScenario('ecommerce.browse-and-buy.happy');
    expect(scenarioRelativePath(scenario)).toBe('ecommerce/browse-and-buy.happy.scenario.md');
  });

  it('rejects invalid frontmatter as a scenario', () => {
    const { scenario, error } = markdownToScenario('---json\n{}\n---\n');
    expect(scenario).toBeNull();
    expect(error).toMatch(/required/);
  });
});

describe('persistence: writer', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sniff-persist-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('writes scenarios, snapshot, classification, hashes, and gitignore on first run', async () => {
    const scenario = makeScenario('ecommerce.browse-and-buy.happy');
    const snapshot = makeSnapshot();
    const guesses: AppTypeGuess[] = [{ type: 'ecommerce', confidence: 0.9, evidence: [], rawScore: 10 }];

    const result = await saveDiscoveryScenarios({
      rootDir: dir,
      snapshot,
      guesses,
      scenarios: [scenario],
    });

    expect(result.written).toHaveLength(1);
    expect(result.written[0]).toMatch(/ecommerce\/browse-and-buy\.happy\.scenario\.md$/);
    const gi = await readFile(join(dir, 'sniff-scenarios', '.gitignore'), 'utf-8');
    expect(gi).toMatch(/cache\//);
    expect(gi).toMatch(/runs\//);

    const snapshotRaw = await readFile(join(result.generatedDir, 'snapshot.json'), 'utf-8');
    expect(JSON.parse(snapshotRaw).project.name).toBe('fixture');

    const hashes = await loadHashes(result.generatedDir);
    expect(Object.keys(hashes)).toContain('ecommerce/browse-and-buy.happy.scenario.md');
  });

  it('keeps hand-edits by default in non-interactive mode', async () => {
    const scenario = makeScenario('ecommerce.browse-and-buy.happy');
    const snapshot = makeSnapshot();
    const guesses: AppTypeGuess[] = [{ type: 'ecommerce', confidence: 0.9, evidence: [], rawScore: 10 }];

    await saveDiscoveryScenarios({ rootDir: dir, snapshot, guesses, scenarios: [scenario] });

    const path = join(dir, 'sniff-scenarios', '_generated', 'ecommerce', 'browse-and-buy.happy.scenario.md');
    await writeFile(path, 'hand-edited content that differs', 'utf-8');

    const scenarioV2 = { ...scenario, name: 'Regenerated name' };
    const result = await saveDiscoveryScenarios({
      rootDir: dir,
      snapshot,
      guesses,
      scenarios: [scenarioV2],
      nonInteractive: true,
    });

    const text = await readFile(path, 'utf-8');
    expect(text).toBe('hand-edited content that differs');
    expect(result.skippedKept.length).toBeGreaterThan(0);

    const hashes = await loadHashes(result.generatedDir);
    expect(hashes['ecommerce/browse-and-buy.happy.scenario.md']?.userOwned).toBe(true);
  });

  it('overwrites hand-edits with forceRegenerate', async () => {
    const scenario = makeScenario('ecommerce.browse-and-buy.happy');
    const snapshot = makeSnapshot();
    const guesses: AppTypeGuess[] = [{ type: 'ecommerce', confidence: 0.9, evidence: [], rawScore: 10 }];

    await saveDiscoveryScenarios({ rootDir: dir, snapshot, guesses, scenarios: [scenario] });
    const path = join(dir, 'sniff-scenarios', '_generated', 'ecommerce', 'browse-and-buy.happy.scenario.md');
    await writeFile(path, 'hand-edited', 'utf-8');

    const scenarioV2 = { ...scenario, name: 'Regenerated name' };
    const result = await saveDiscoveryScenarios({
      rootDir: dir,
      snapshot,
      guesses,
      scenarios: [scenarioV2],
      forceRegenerate: true,
    });

    const text = await readFile(path, 'utf-8');
    expect(text).not.toBe('hand-edited');
    expect(text).toMatch(/Regenerated name/);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it('moves hand-edits to custom/ when the resolver requests it', async () => {
    const scenario = makeScenario('ecommerce.browse-and-buy.happy');
    const snapshot = makeSnapshot();
    const guesses: AppTypeGuess[] = [{ type: 'ecommerce', confidence: 0.9, evidence: [], rawScore: 10 }];

    await saveDiscoveryScenarios({ rootDir: dir, snapshot, guesses, scenarios: [scenario] });
    const genPath = join(dir, 'sniff-scenarios', '_generated', 'ecommerce', 'browse-and-buy.happy.scenario.md');
    await writeFile(genPath, 'hand-edited', 'utf-8');

    const result = await saveDiscoveryScenarios({
      rootDir: dir,
      snapshot,
      guesses,
      scenarios: [scenario],
      onConflict: async () => 'move-to-custom',
    });

    expect(result.movedToCustom.length).toBe(1);
    const customPath = join(dir, 'sniff-scenarios', 'custom', 'ecommerce', 'browse-and-buy.happy.scenario.md');
    const customContent = await readFile(customPath, 'utf-8');
    expect(customContent).toBe('hand-edited');
  });

  it('removes scenarios that are no longer generated', async () => {
    const s1 = makeScenario('ecommerce.browse-and-buy.happy', 'ecommerce', 'browse-and-buy');
    const s2 = makeScenario('ecommerce.wishlist.happy', 'ecommerce', 'wishlist');
    const snapshot = makeSnapshot();
    const guesses: AppTypeGuess[] = [{ type: 'ecommerce', confidence: 0.9, evidence: [], rawScore: 10 }];

    await saveDiscoveryScenarios({ rootDir: dir, snapshot, guesses, scenarios: [s1, s2] });
    const result = await saveDiscoveryScenarios({ rootDir: dir, snapshot, guesses, scenarios: [s1] });

    expect(result.removed.some((p) => p.endsWith('wishlist.happy.scenario.md'))).toBe(true);
    const hashes = await loadHashes(result.generatedDir);
    expect(hashes['ecommerce/wishlist.happy.scenario.md']).toBeUndefined();
  });
});

describe('persistence: hashes', () => {
  it('is stable for the same content', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'));
    expect(hashContent('hello')).not.toBe(hashContent('hello!'));
  });

  it('persists and reloads hash map', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sniff-hash-'));
    try {
      await mkdir(dir, { recursive: true });
      const map = { 'a.md': { hash: 'abc' } };
      const { saveHashes } = await import('./hashes.js');
      await saveHashes(dir, map);
      const reloaded = await loadHashes(dir);
      expect(reloaded).toEqual(map);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
