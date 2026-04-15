import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RouteTestContext } from '../../src/ai/types.js';
import type { RouteInfo, ElementInfo, ComponentInfo, FrameworkInfo } from '../../src/analyzers/types.js';

// Mock @anthropic-ai/sdk
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    constructor(_opts: { apiKey: string }) {}
    messages = { create: mockCreate };
  },
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
    path: '/settings',
    filePath: 'src/app/settings/page.tsx',
    framework: 'nextjs-app',
    dynamic: false,
  };

  const elements: ElementInfo[] = [
    { tag: 'input', name: 'username', type: 'text', filePath: 'src/app/settings/page.tsx', line: 15 },
  ];

  const components: ComponentInfo[] = [];

  const framework: FrameworkInfo = {
    name: 'nextjs',
    configFiles: ['next.config.js'],
  };

  return { route, elements, components, framework };
}

describe('AnthropicAPIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has name "anthropic-api"', async () => {
    const { AnthropicAPIProvider } = await import('../../src/ai/anthropic-api.js');
    const provider = new AnthropicAPIProvider('test-api-key');
    expect(provider.name).toBe('anthropic-api');
  });

  it('calls Anthropic SDK messages.create with correct params', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '```typescript\nimport { test, expect } from "@playwright/test";\n```' }],
    });

    const { AnthropicAPIProvider } = await import('../../src/ai/anthropic-api.js');
    const provider = new AnthropicAPIProvider('test-api-key');
    await provider.generateTests(makeContext());

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe('mock-system-prompt');
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'mock-user-prompt' }]);
    expect(callArgs.max_tokens).toBe(4096);
    expect(callArgs.model).toContain('claude');
  });

  it('throws SniffError with code ANTHROPIC_API_ERROR on SDK failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const { AnthropicAPIProvider } = await import('../../src/ai/anthropic-api.js');
    const provider = new AnthropicAPIProvider('test-api-key');

    await expect(provider.generateTests(makeContext())).rejects.toThrow(
      expect.objectContaining({ code: 'ANTHROPIC_API_ERROR' }),
    );
  });
});
