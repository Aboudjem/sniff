import type { RouteTestContext } from './types.js';

const SOURCE_CONTENT_MAX_LENGTH = 3000;

export function buildSystemPrompt(): string {
  return `You are a Playwright test generator. Generate a single .spec.ts file for the route provided.

Rules:
- Use ONLY the selectors provided in the analysis data — never invent selectors
- If no good selector exists for an element, skip that test scenario
- Add JSDoc comments explaining your reasoning above each test() block
- Use Playwright best practices: auto-waiting, web-first assertions, locator-based API
- Generate tests for: navigation, form submission, button clicks, link verification
- Each test should be independent and not depend on state from other tests
- Use \`test.describe\` to group related tests for the route

Output format:
- Respond with a single TypeScript code block containing the complete .spec.ts file
- The file must import { test, expect } from '@playwright/test'
- Do not include any explanation outside the code block`;
}

export function buildUserPrompt(context: RouteTestContext): string {
  const { route, elements, components, framework, sourceContent } = context;

  const parts: string[] = [
    `Generate Playwright tests for this route:`,
    ``,
    `Route: ${route.path}`,
    `File: ${route.filePath}`,
    `Framework: ${framework.name}`,
    `Dynamic: ${route.dynamic}`,
  ];

  if (route.params && route.params.length > 0) {
    parts.push(`Parameters: ${route.params.join(', ')}`);
  }

  parts.push(``);
  parts.push(`Interactive elements on this page:`);
  parts.push(JSON.stringify(elements, null, 2));

  parts.push(``);
  parts.push(`Component structure:`);
  parts.push(JSON.stringify(components, null, 2));

  if (sourceContent) {
    const truncated = sourceContent.length > SOURCE_CONTENT_MAX_LENGTH
      ? sourceContent.slice(0, SOURCE_CONTENT_MAX_LENGTH) + '\n... (truncated)'
      : sourceContent;
    parts.push(``);
    parts.push(`Source code for this route:`);
    parts.push('```');
    parts.push(truncated);
    parts.push('```');
  }

  return parts.join('\n');
}
