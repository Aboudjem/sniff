import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiscoveryLLM, LLMCompleteRequest } from './types.js';

const execFile = promisify(execFileCb);

export interface ClaudeCodeLLMOptions {
  cliPath?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

export class ClaudeCodeLLM implements DiscoveryLLM {
  readonly name = 'claude-code-cli';
  private readonly cliPath: string;
  private readonly timeoutMs: number;
  private readonly maxBufferBytes: number;

  constructor(options: ClaudeCodeLLMOptions = {}) {
    this.cliPath = options.cliPath ?? 'claude';
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.maxBufferBytes = options.maxBufferBytes ?? 1024 * 1024 * 2;
  }

  async available(): Promise<boolean> {
    try {
      await execFile(this.cliPath, ['--version'], { timeout: 3_000, maxBuffer: 1024 * 64 });
      return true;
    } catch {
      return false;
    }
  }

  async complete(request: LLMCompleteRequest): Promise<string> {
    const { stdout } = await execFile(
      this.cliPath,
      [
        '--print',
        '--output-format',
        'json',
        '--system-prompt',
        request.system,
        request.user,
      ],
      { timeout: this.timeoutMs, maxBuffer: this.maxBufferBytes },
    );

    try {
      const parsed = JSON.parse(stdout) as { result?: string };
      return typeof parsed.result === 'string' ? parsed.result : stdout;
    } catch {
      return stdout;
    }
  }
}
