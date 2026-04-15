import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIProvider, RouteTestContext, GeneratedTest } from './types.js';

const execFile = promisify(execFileCb);

export class ClaudeCodeProvider implements AIProvider {
  name = 'claude-code';

  async generateTests(context: RouteTestContext): Promise<GeneratedTest> {
    const { buildSystemPrompt, buildUserPrompt } = await import('./prompt-builder.js');
    const { parseGeneratedTest } = await import('./response-parser.js');

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(context);

    try {
      const { stdout } = await execFile('claude', [
        '--print',
        '--output-format', 'json',
        '--system-prompt', systemPrompt,
        userPrompt,
      ], {
        timeout: 120_000,  // 2 minute timeout per route
        maxBuffer: 1024 * 1024 * 5,  // 5MB buffer
      });

      // Parse Claude Code JSON response: {"type":"result","subtype":"success","result":"..."}
      const response = JSON.parse(stdout);
      const rawContent = response.result ?? stdout;

      return parseGeneratedTest(rawContent, context.route.path);
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        const { SniffError } = await import('../core/errors.js');
        throw new SniffError('CLAUDE_CLI_NOT_FOUND', 'Claude Code CLI not found. Install it from https://claude.ai/download or set ANTHROPIC_API_KEY for API mode.');
      }
      const { SniffError } = await import('../core/errors.js');
      throw new SniffError('CLAUDE_CLI_ERROR', `Claude Code CLI failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
