import { readLlmCache, writeLlmCache } from './cache.js';
import type { DiscoveryLLM, LLMCompleteRequest } from './types.js';

export interface CachedProviderOptions {
  rootDir: string;
  cacheDir: string;
}

export class CachedDiscoveryLLM implements DiscoveryLLM {
  readonly name: string;

  constructor(private readonly inner: DiscoveryLLM, private readonly options: CachedProviderOptions) {
    this.name = `${inner.name}+cache`;
  }

  available(): Promise<boolean> {
    return this.inner.available();
  }

  async complete(request: LLMCompleteRequest): Promise<string> {
    const hit = await readLlmCache({
      rootDir: this.options.rootDir,
      cacheDir: this.options.cacheDir,
      system: request.system,
      user: request.user,
      purpose: request.purpose,
    });
    if (hit !== null) return hit;

    const fresh = await this.inner.complete(request);
    await writeLlmCache(
      {
        rootDir: this.options.rootDir,
        cacheDir: this.options.cacheDir,
        system: request.system,
        user: request.user,
        purpose: request.purpose,
      },
      fresh,
    );
    return fresh;
  }
}
