import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../../src/ai/prompt-builder.js';
import type { RouteTestContext } from '../../src/ai/types.js';
import type { RouteInfo, ElementInfo, ComponentInfo, FrameworkInfo } from '../../src/analyzers/types.js';

function makeContext(overrides?: Partial<RouteTestContext>): RouteTestContext {
  const route: RouteInfo = {
    path: '/dashboard/settings',
    filePath: 'src/app/dashboard/settings/page.tsx',
    framework: 'nextjs-app',
    dynamic: false,
  };

  const elements: ElementInfo[] = [
    {
      tag: 'button',
      testId: 'save-btn',
      text: 'Save Settings',
      filePath: 'src/app/dashboard/settings/page.tsx',
      line: 42,
    },
    {
      tag: 'input',
      name: 'email',
      type: 'email',
      ariaLabel: 'Email address',
      filePath: 'src/app/dashboard/settings/page.tsx',
      line: 30,
    },
  ];

  const components: ComponentInfo[] = [
    {
      name: 'SettingsForm',
      filePath: 'src/components/SettingsForm.tsx',
      exports: ['SettingsForm'],
      hasDefaultExport: false,
      elements: [],
      routes: ['/dashboard/settings'],
    },
  ];

  const framework: FrameworkInfo = {
    name: 'nextjs',
    version: '14.2.0',
    configFiles: ['next.config.js'],
  };

  return {
    route,
    elements,
    components,
    framework,
    ...overrides,
  };
}

describe('buildSystemPrompt', () => {
  it('returns string containing "Playwright test generator"', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Playwright test generator');
  });

  it('returns string containing "Use ONLY the selectors provided"', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('ONLY the selectors provided');
  });

  it('returns string containing "JSDoc comments explaining your reasoning"', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('JSDoc');
  });
});

describe('buildUserPrompt', () => {
  it('includes the route path in output', () => {
    const ctx = makeContext();
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('/dashboard/settings');
  });

  it('includes JSON-serialized elements array in output', () => {
    const ctx = makeContext();
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('"save-btn"');
    expect(prompt).toContain('"email"');
  });

  it('includes JSON-serialized components array in output', () => {
    const ctx = makeContext();
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('"SettingsForm"');
  });

  it('includes framework name in output', () => {
    const ctx = makeContext();
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('nextjs');
  });

  it('for a route with no elements still produces valid prompt (empty array)', () => {
    const ctx = makeContext({ elements: [] });
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('/dashboard/settings');
    expect(prompt).toContain('[]');
  });

  it('includes sourceContent when provided', () => {
    const ctx = makeContext({ sourceContent: 'export default function Page() { return <div>Hello</div>; }' });
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('export default function Page()');
  });

  it('truncates sourceContent to 3000 chars', () => {
    const longContent = 'x'.repeat(5000);
    const ctx = makeContext({ sourceContent: longContent });
    const prompt = buildUserPrompt(ctx);
    // Should not contain the full 5000 chars
    expect(prompt).not.toContain('x'.repeat(5000));
    // Should contain truncated content (3000 chars)
    expect(prompt).toContain('x'.repeat(3000));
  });

  it('includes file path in output', () => {
    const ctx = makeContext();
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('src/app/dashboard/settings/page.tsx');
  });
});
