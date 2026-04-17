import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readLlmCache, writeLlmCache, cacheKeyFor } from './cache.js';
import { CachedDiscoveryLLM } from './cached-provider.js';
import type { DiscoveryLLM, LLMCompleteRequest } from './types.js';

class StubLLM implements DiscoveryLLM {
  readonly name = 'stub';
  calls = 0;
  constructor(private readonly response: string) {}
  async available(): Promise<boolean> { return true; }
  async complete(_req: LLMCompleteRequest): Promise<string> {
    this.calls += 1;
    return this.response;
  }
}

describe('llm cache', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'sniff-llm-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('returns null when nothing is cached', async () => {
    const hit = await readLlmCache({
      rootDir: dir, cacheDir: 'cache', system: 's', user: 'u', purpose: 'p',
    });
    expect(hit).toBeNull();
  });

  it('writes and reads back the response', async () => {
    await writeLlmCache({ rootDir: dir, cacheDir: 'cache', system: 's', user: 'u', purpose: 'p' }, 'hello');
    const hit = await readLlmCache({ rootDir: dir, cacheDir: 'cache', system: 's', user: 'u', purpose: 'p' });
    expect(hit).toBe('hello');
  });

  it('produces distinct keys for different purposes', () => {
    expect(cacheKeyFor('s', 'u', 'p1')).not.toBe(cacheKeyFor('s', 'u', 'p2'));
    expect(cacheKeyFor('s', 'u', 'p1')).toBe(cacheKeyFor('s', 'u', 'p1'));
  });
});

describe('CachedDiscoveryLLM', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'sniff-llm-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('only calls inner LLM once for identical requests', async () => {
    const stub = new StubLLM('cached answer');
    const cached = new CachedDiscoveryLLM(stub, { rootDir: dir, cacheDir: 'cache' });
    const r1 = await cached.complete({ system: 's', user: 'u', purpose: 'p' });
    const r2 = await cached.complete({ system: 's', user: 'u', purpose: 'p' });
    expect(r1).toBe('cached answer');
    expect(r2).toBe('cached answer');
    expect(stub.calls).toBe(1);
  });

  it('calls inner LLM again when the purpose changes', async () => {
    const stub = new StubLLM('answer');
    const cached = new CachedDiscoveryLLM(stub, { rootDir: dir, cacheDir: 'cache' });
    await cached.complete({ system: 's', user: 'u', purpose: 'p1' });
    await cached.complete({ system: 's', user: 'u', purpose: 'p2' });
    expect(stub.calls).toBe(2);
  });
});
