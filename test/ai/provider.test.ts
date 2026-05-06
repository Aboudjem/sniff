import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveProvider } from '../../src/ai/provider.js';

describe('resolveProvider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SNIFF_AI_PROVIDER;
    delete process.env.SNIFF_AI_MODEL;
    delete process.env.SNIFF_AI_COMMAND;
    delete process.env.SNIFF_AI_BASE_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to no provider', async () => {
    const result = await resolveProvider();

    expect(result.name).toBe('none');
    expect(result.provider).toBeNull();
    expect(result.reason).toContain('none');
  });

  it('uses SNIFF_AI_PROVIDER env override', async () => {
    process.env.SNIFF_AI_PROVIDER = 'anthropic-api';

    const result = await resolveProvider({ provider: 'none', outputDir: 'sniff-tests', maxConcurrency: 5 });

    expect(result.name).toBe('anthropic-api');
    expect(result.provider).toBeNull();
    expect(result.reason).toContain('ANTHROPIC_API_KEY');
  });

  it('falls back gracefully when a requested CLI command is missing', async () => {
    const result = await resolveProvider({
      provider: 'codex-cli',
      command: 'sniff-definitely-missing-cli',
      outputDir: 'sniff-tests',
      maxConcurrency: 5,
    });

    expect(result.name).toBe('codex-cli');
    expect(result.provider).toBeNull();
    expect(result.reason).toContain('Command not found');
  });

  it('requires API keys for API-backed providers', async () => {
    const anthropic = await resolveProvider({
      provider: 'anthropic-api',
      outputDir: 'sniff-tests',
      maxConcurrency: 5,
    });
    const openai = await resolveProvider({
      provider: 'openai-api',
      outputDir: 'sniff-tests',
      maxConcurrency: 5,
    });

    expect(anthropic.provider).toBeNull();
    expect(anthropic.reason).toContain('ANTHROPIC_API_KEY');
    expect(openai.provider).toBeNull();
    expect(openai.reason).toContain('OPENAI_API_KEY');
  });
});
