import type { AIProvider } from './types.js';

export async function resolveProvider(): Promise<AIProvider> {
  if (process.env.ANTHROPIC_API_KEY) {
    const { AnthropicAPIProvider } = await import('./anthropic-api.js');
    return new AnthropicAPIProvider(process.env.ANTHROPIC_API_KEY);
  }

  const { ClaudeCodeProvider } = await import('./claude-code.js');
  return new ClaudeCodeProvider();
}
