import { SniffError } from '../core/errors.js';
import type { GeneratedTest } from './types.js';

const CODE_BLOCK_REGEX = /```(?:typescript|ts)\n([\s\S]*?)```/;
const PLAYWRIGHT_IMPORT_REGEX = /import\s*\{[^}]*(?:test|expect)[^}]*\}/;
const JSDOC_REGEX = /\/\*\*\s*([\s\S]*?)\s*\*\//g;

export function parseGeneratedTest(rawOutput: string, routePath: string): GeneratedTest {
  let code: string | null = null;

  // Try to extract from fenced code block first
  const match = CODE_BLOCK_REGEX.exec(rawOutput);
  if (match) {
    code = match[1].trim();
  }

  // Fallback: if no fenced block but raw output contains Playwright imports, use entire output
  if (!code && PLAYWRIGHT_IMPORT_REGEX.test(rawOutput)) {
    code = rawOutput.trim();
  }

  // No code found at all
  if (!code) {
    throw new SniffError('PARSE_NO_CODE', 'AI response contained no TypeScript code block');
  }

  // Validate: must contain Playwright test imports
  if (!PLAYWRIGHT_IMPORT_REGEX.test(code)) {
    throw new SniffError('PARSE_INVALID_TEST', 'Generated code does not contain Playwright test imports');
  }

  // Extract reasoning from JSDoc comments
  const reasoning = extractReasoning(code);

  return {
    specContent: code,
    reasoning,
    route: routePath,
  };
}

function extractReasoning(code: string): string {
  const reasonings: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  JSDOC_REGEX.lastIndex = 0;

  while ((match = JSDOC_REGEX.exec(code)) !== null) {
    const content = match[1]
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => line.length > 0)
      .join(' ');

    if (content.length > 0) {
      reasonings.push(content);
    }
  }

  return reasonings.join('\n');
}
