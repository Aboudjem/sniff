import { CachedDiscoveryLLM } from './cached-provider.js';
import { ClaudeCodeLLM } from './claude-code.js';
import type { DiscoveryLLM } from './types.js';

export interface ResolveOptions {
  rootDir: string;
  cacheDir: string;
  cliPath?: string;
}

export async function resolveDiscoveryLLM(options: ResolveOptions): Promise<DiscoveryLLM | null> {
  const inner = new ClaudeCodeLLM(options.cliPath ? { cliPath: options.cliPath } : {});
  if (!(await inner.available())) return null;
  return new CachedDiscoveryLLM(inner, { rootDir: options.rootDir, cacheDir: options.cacheDir });
}

export { ClaudeCodeLLM } from './claude-code.js';
export { CachedDiscoveryLLM } from './cached-provider.js';
export { readLlmCache, writeLlmCache, cacheKeyFor } from './cache.js';
export type { DiscoveryLLM, LLMCompleteRequest } from './types.js';
