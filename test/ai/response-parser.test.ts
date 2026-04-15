import { describe, it, expect } from 'vitest';
import { parseGeneratedTest } from '../../src/ai/response-parser.js';

describe('parseGeneratedTest', () => {
  it('extracts TypeScript code from markdown code block with ```typescript fences', () => {
    const raw = `Here is the test file:

\`\`\`typescript
import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Home/);
});
\`\`\`

That should cover the main scenarios.`;

    const result = parseGeneratedTest(raw, '/');
    expect(result.specContent).toContain("import { test, expect } from '@playwright/test'");
    expect(result.specContent).toContain("test('homepage loads'");
    expect(result.route).toBe('/');
  });

  it('extracts code from ```ts fences (alternate syntax)', () => {
    const raw = `\`\`\`ts
import { test, expect } from '@playwright/test';

test('about page', async ({ page }) => {
  await page.goto('/about');
});
\`\`\``;

    const result = parseGeneratedTest(raw, '/about');
    expect(result.specContent).toContain("import { test, expect }");
    expect(result.route).toBe('/about');
  });

  it('validates presence of import { test, expect } pattern', () => {
    const raw = `\`\`\`typescript
import { test, expect } from '@playwright/test';

test('works', async ({ page }) => {
  await expect(page.locator('h1')).toBeVisible();
});
\`\`\``;

    const result = parseGeneratedTest(raw, '/test');
    expect(result.specContent).toContain('import { test');
  });

  it('extracts reasoning from JSDoc comments above test() calls', () => {
    const raw = `\`\`\`typescript
import { test, expect } from '@playwright/test';

/** Verify the navigation link works and leads to the correct page */
test('nav link works', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="nav-about"]');
  await expect(page).toHaveURL('/about');
});

/** Ensure the form submits with valid data */
test('form submits', async ({ page }) => {
  await page.goto('/contact');
});
\`\`\``;

    const result = parseGeneratedTest(raw, '/');
    expect(result.reasoning).toContain('navigation link works');
    expect(result.reasoning).toContain('form submits with valid data');
  });

  it('throws SniffError with code PARSE_NO_CODE when no code block found', () => {
    const raw = 'Sorry, I cannot generate tests for this route.';

    expect(() => parseGeneratedTest(raw, '/')).toThrow();
    try {
      parseGeneratedTest(raw, '/');
    } catch (err: unknown) {
      const error = err as { code: string; message: string };
      expect(error.code).toBe('PARSE_NO_CODE');
    }
  });

  it('throws SniffError with code PARSE_INVALID_TEST when code block lacks test/expect imports', () => {
    const raw = `\`\`\`typescript
console.log('hello world');
\`\`\``;

    expect(() => parseGeneratedTest(raw, '/')).toThrow();
    try {
      parseGeneratedTest(raw, '/');
    } catch (err: unknown) {
      const error = err as { code: string; message: string };
      expect(error.code).toBe('PARSE_INVALID_TEST');
    }
  });

  it('handles raw code without markdown fences (fallback)', () => {
    const raw = `import { test, expect } from '@playwright/test';

test('fallback test', async ({ page }) => {
  await page.goto('/fallback');
  await expect(page.locator('h1')).toBeVisible();
});`;

    const result = parseGeneratedTest(raw, '/fallback');
    expect(result.specContent).toContain("import { test, expect }");
    expect(result.specContent).toContain("test('fallback test'");
    expect(result.route).toBe('/fallback');
  });
});
