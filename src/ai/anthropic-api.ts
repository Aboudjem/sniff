import type { AIProvider, RouteTestContext, GeneratedTest } from './types.js';

export class AnthropicAPIProvider implements AIProvider {
  name = 'anthropic-api';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateTests(context: RouteTestContext): Promise<GeneratedTest> {
    const { buildSystemPrompt, buildUserPrompt } = await import('./prompt-builder.js');
    const { parseGeneratedTest } = await import('./response-parser.js');
    const { default: Anthropic } = await import('@anthropic-ai/sdk');

    const client = new Anthropic({ apiKey: this.apiKey });
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const rawContent = message.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return parseGeneratedTest(rawContent, context.route.path);
    } catch (err) {
      const { SniffError } = await import('../core/errors.js');
      throw new SniffError('ANTHROPIC_API_ERROR', `Anthropic API failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
