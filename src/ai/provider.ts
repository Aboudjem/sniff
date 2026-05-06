import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { AIConfig, AIProviderName } from '../config/schema.js';
import type { AIProvider, AIProviderResolution, GeneratedTest, RouteTestContext } from './types.js';

const execFile = promisify(execFileCb);

const PROVIDERS: AIProviderName[] = [
  'none',
  'codex-cli',
  'claude-code',
  'anthropic-api',
  'openai-api',
  'gemini-cli',
  'ollama',
];

function envProvider(): AIProviderName | undefined {
  const value = process.env.SNIFF_AI_PROVIDER as AIProviderName | undefined;
  return value && PROVIDERS.includes(value) ? value : undefined;
}

function envBackedConfig(config?: AIConfig): AIConfig {
  return {
    provider: envProvider() ?? config?.provider ?? 'none',
    model: process.env.SNIFF_AI_MODEL ?? config?.model,
    command: process.env.SNIFF_AI_COMMAND ?? config?.command,
    baseUrl: process.env.SNIFF_AI_BASE_URL ?? config?.baseUrl,
    outputDir: config?.outputDir ?? 'sniff-tests',
    maxConcurrency: config?.maxConcurrency ?? 5,
  };
}

async function commandExists(command: string): Promise<boolean> {
  const binary = command.split(/\s+/)[0];
  try {
    await execFile('which', [binary], { timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

class CliAIProvider implements AIProvider {
  readonly name: AIProviderName;
  private command: string;
  private model?: string;

  constructor(name: 'codex-cli' | 'gemini-cli', command: string, model?: string) {
    this.name = name;
    this.command = command;
    this.model = model;
  }

  async generateTests(context: RouteTestContext): Promise<GeneratedTest> {
    const { buildSystemPrompt, buildUserPrompt } = await import('./prompt-builder.js');
    const { parseGeneratedTest } = await import('./response-parser.js');
    const { SniffError } = await import('../core/errors.js');

    const prompt = `${buildSystemPrompt()}\n\n${buildUserPrompt(context)}`;
    const args = this.name === 'codex-cli'
      ? ['exec', ...(this.model ? ['--model', this.model] : []), prompt]
      : [...(this.model ? ['--model', this.model] : []), '--prompt', prompt];

    try {
      const { stdout } = await execFile(this.command, args, {
        timeout: 120_000,
        maxBuffer: 1024 * 1024 * 5,
      });
      return parseGeneratedTest(stdout, context.route.path);
    } catch (err) {
      throw new SniffError(
        'AI_CLI_ERROR',
        `${this.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

class OpenAIAPIProvider implements AIProvider {
  name = 'openai-api' as const;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model = 'gpt-4.1-mini', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async generateTests(context: RouteTestContext): Promise<GeneratedTest> {
    const { buildSystemPrompt, buildUserPrompt } = await import('./prompt-builder.js');
    const { parseGeneratedTest } = await import('./response-parser.js');
    const { SniffError } = await import('../core/errors.js');

    const response = await fetch(`${this.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(context) },
        ],
      }),
    });

    if (!response.ok) {
      throw new SniffError('OPENAI_API_ERROR', `OpenAI API failed: HTTP ${response.status}`);
    }

    const json = await response.json() as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const raw = json.output_text
      ?? json.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? '').join('\n')
      ?? '';
    return parseGeneratedTest(raw, context.route.path);
  }
}

class OllamaProvider implements AIProvider {
  name = 'ollama' as const;
  private model: string;
  private baseUrl: string;

  constructor(model = 'llama3.1', baseUrl = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async generateTests(context: RouteTestContext): Promise<GeneratedTest> {
    const { buildSystemPrompt, buildUserPrompt } = await import('./prompt-builder.js');
    const { parseGeneratedTest } = await import('./response-parser.js');
    const { SniffError } = await import('../core/errors.js');

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${buildSystemPrompt()}\n\n${buildUserPrompt(context)}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new SniffError('OLLAMA_ERROR', `Ollama failed: HTTP ${response.status}`);
    }

    const json = await response.json() as { response?: string };
    return parseGeneratedTest(json.response ?? '', context.route.path);
  }
}

export async function resolveProvider(config?: AIConfig): Promise<AIProviderResolution> {
  const ai = envBackedConfig(config);

  switch (ai.provider) {
    case 'none':
      return { provider: null, name: 'none', reason: 'ai.provider is "none"' };
    case 'claude-code': {
      const command = ai.command ?? 'claude';
      if (!(await commandExists(command))) {
        return { provider: null, name: 'claude-code', reason: `Command not found: ${command}` };
      }
      const { ClaudeCodeProvider } = await import('./claude-code.js');
      return { provider: new ClaudeCodeProvider(command), name: 'claude-code' };
    }
    case 'anthropic-api': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return { provider: null, name: 'anthropic-api', reason: 'ANTHROPIC_API_KEY is not set' };
      }
      const { AnthropicAPIProvider } = await import('./anthropic-api.js');
      return { provider: new AnthropicAPIProvider(apiKey, ai.model), name: 'anthropic-api' };
    }
    case 'openai-api': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return { provider: null, name: 'openai-api', reason: 'OPENAI_API_KEY is not set' };
      }
      return { provider: new OpenAIAPIProvider(apiKey, ai.model, ai.baseUrl), name: 'openai-api' };
    }
    case 'codex-cli': {
      const command = ai.command ?? 'codex';
      if (!(await commandExists(command))) {
        return { provider: null, name: 'codex-cli', reason: `Command not found: ${command}` };
      }
      return { provider: new CliAIProvider('codex-cli', command, ai.model), name: 'codex-cli' };
    }
    case 'gemini-cli': {
      const command = ai.command ?? 'gemini';
      if (!(await commandExists(command))) {
        return { provider: null, name: 'gemini-cli', reason: `Command not found: ${command}` };
      }
      return { provider: new CliAIProvider('gemini-cli', command, ai.model), name: 'gemini-cli' };
    }
    case 'ollama':
      return { provider: new OllamaProvider(ai.model, ai.baseUrl), name: 'ollama' };
  }
}
