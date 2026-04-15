import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteTestContext } from '../../src/ai/types.js';
import type { RouteInfo, ElementInfo, ComponentInfo, FrameworkInfo } from '../../src/analyzers/types.js';

// Mock node:util to control promisify(execFile)
const mockExecFile = vi.fn();
vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));
vi.mock('node:util', () => ({
  promisify: () => mockExecFile,
}));

// Mock prompt-builder
vi.mock('../../src/ai/prompt-builder.js', () => ({
  buildSystemPrompt: vi.fn(() => 'mock-system-prompt'),
  buildUserPrompt: vi.fn(() => 'mock-user-prompt'),
}));

// Mock response-parser
vi.mock('../../src/ai/response-parser.js', () => ({
  parseGeneratedTest: vi.fn((raw: string, route: string) => ({
    specContent: 'import { test, expect } from "@playwright/test";',
    reasoning: 'Test reasoning',
    route,
  })),
}));

function makeContext(): RouteTestContext {
  const route: RouteInfo = {
    path: '/dashboard',
    filePath: 'src/app/dashboard/page.tsx',
    framework: 'nextjs-app',
    dynamic: false,
  };

  const elements: ElementInfo[] = [
    { tag: 'button', testId: 'submit-btn', filePath: 'src/app/dashboard/page.tsx', line: 10 },
  ];

  const components: ComponentInfo[] = [];

  const framework: FrameworkInfo = {
    name: 'nextjs',
    configFiles: ['next.config.js'],
  };

  return { route, elements, components, framework };
}

describe('ClaudeCodeProvider', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('has name "claude-code"', async () => {
    const { ClaudeCodeProvider } = await import('../../src/ai/claude-code.js');
    const provider = new ClaudeCodeProvider();
    expect(provider.name).toBe('claude-code');
  });

  it('calls execFile with "claude" command and correct arguments', async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: '```typescript\nimport { test, expect } from "@playwright/test";\n```' }),
      stderr: '',
    });

    const { ClaudeCodeProvider } = await import('../../src/ai/claude-code.js');
    const provider = new ClaudeCodeProvider();
    await provider.generateTests(makeContext());

    expect(mockExecFile).toHaveBeenCalledOnce();
    const [cmd, args] = mockExecFile.mock.calls[0];
    expect(cmd).toBe('claude');
    expect(args).toContain('--print');
    expect(args).toContain('--output-format');
    expect(args).toContain('json');
  });

  it('passes system prompt via --system-prompt flag', async () => {
    mockExecFile.mockResolvedValueOnce({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'test code' }),
      stderr: '',
    });

    const { ClaudeCodeProvider } = await import('../../src/ai/claude-code.js');
    const provider = new ClaudeCodeProvider();
    await provider.generateTests(makeContext());

    const args = mockExecFile.mock.calls[0][1] as string[];
    expect(args).toContain('--system-prompt');
    const sysIdx = args.indexOf('--system-prompt');
    expect(args[sysIdx + 1]).toBe('mock-system-prompt');
  });

  it('parses JSON response and extracts result field', async () => {
    const { parseGeneratedTest } = await import('../../src/ai/response-parser.js');
    mockExecFile.mockResolvedValueOnce({
      stdout: JSON.stringify({ type: 'result', subtype: 'success', result: 'extracted-result-content' }),
      stderr: '',
    });

    const { ClaudeCodeProvider } = await import('../../src/ai/claude-code.js');
    const provider = new ClaudeCodeProvider();
    await provider.generateTests(makeContext());

    expect(parseGeneratedTest).toHaveBeenCalledWith('extracted-result-content', '/dashboard');
  });

  it('throws SniffError with code CLAUDE_CLI_ERROR when execFile fails', async () => {
    mockExecFile.mockRejectedValueOnce(new Error('Process exited with code 1'));

    const { ClaudeCodeProvider } = await import('../../src/ai/claude-code.js');
    const provider = new ClaudeCodeProvider();

    await expect(provider.generateTests(makeContext())).rejects.toThrow(
      expect.objectContaining({ code: 'CLAUDE_CLI_ERROR' }),
    );
  });

  it('throws SniffError with code CLAUDE_CLI_NOT_FOUND when claude binary not found', async () => {
    const enoentError = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
    mockExecFile.mockRejectedValueOnce(enoentError);

    const { ClaudeCodeProvider } = await import('../../src/ai/claude-code.js');
    const provider = new ClaudeCodeProvider();

    await expect(provider.generateTests(makeContext())).rejects.toThrow(
      expect.objectContaining({ code: 'CLAUDE_CLI_NOT_FOUND' }),
    );
  });
});
