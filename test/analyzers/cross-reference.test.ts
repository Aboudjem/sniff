import { describe, it, expect } from 'vitest';
import { crossReference, crossReferenceSummary } from '../../src/analyzers/cross-reference.js';
import type { Finding, BrowserFinding } from '../../src/core/types.js';

function makeFinding(overrides: Partial<Finding>): Finding {
  return {
    ruleId: 'test-rule',
    severity: 'medium',
    message: 'Test finding',
    filePath: 'src/app.ts',
    line: 1,
    column: 1,
    snippet: '',
    ...overrides,
  };
}

function makeBrowserFinding(overrides: Partial<BrowserFinding>): BrowserFinding {
  return {
    ruleId: 'test-browser-rule',
    severity: 'medium',
    message: 'Browser finding',
    filePath: '',
    line: 0,
    column: 0,
    snippet: '',
    url: 'http://localhost:3000',
    viewport: 'desktop',
    ...overrides,
  };
}

describe('crossReference', () => {
  it('returns empty array when no source findings', () => {
    const result = crossReference([], [makeBrowserFinding({})]);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no browser findings', () => {
    const result = crossReference([makeFinding({})], []);
    expect(result).toHaveLength(0);
  });

  it('returns empty array when no correlations match', () => {
    const source = [makeFinding({ ruleId: 'some-unrelated-rule' })];
    const browser = [makeBrowserFinding({ ruleId: 'another-unrelated-rule' })];
    const result = crossReference(source, browser);
    expect(result).toHaveLength(0);
  });

  describe('broken import to 404 correlation', () => {
    it('correlates broken-import with browser 404', () => {
      const source = [makeFinding({
        ruleId: 'broken-import',
        message: 'Potentially broken relative import',
        snippet: 'import { foo } from "./utils/helper"',
        filePath: 'src/index.ts',
        line: 5,
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'network-error',
        message: '404 Not Found',
        snippet: 'utils/helper returned 404',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('corroborated-broken-resource');
      expect(result[0].corroboration.correlation).toBe('broken-import-to-404');
      expect(result[0].corroboration.confidence).toBe('high');
    });

    it('correlates dead-link-internal with browser 404', () => {
      const source = [makeFinding({
        ruleId: 'dead-link-internal',
        message: 'File not found: ./assets/logo.png',
        snippet: '![Logo](./assets/logo.png)',
        filePath: 'README.md',
        line: 10,
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'resource-error',
        message: 'Resource not found',
        snippet: 'assets/logo.png 404',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('corroborated-broken-resource');
    });

    it('bumps severity when corroborated', () => {
      const source = [makeFinding({
        ruleId: 'broken-import',
        severity: 'medium',
        snippet: 'import { x } from "./missing"',
      })];

      const browser = [makeBrowserFinding({
        message: '404: missing not found',
        snippet: 'missing returned 404',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe('high'); // bumped from medium
    });
  });

  describe('console.log to runtime correlation', () => {
    it('correlates debug-console-log with browser console output', () => {
      const source = [makeFinding({
        ruleId: 'debug-console-log',
        message: 'Console logging statement detected',
        snippet: 'console.log("debug data")',
        filePath: 'src/handler.ts',
        line: 42,
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'console-output',
        message: 'console.log captured: debug data',
        snippet: 'debug data',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('corroborated-debug-console');
      expect(result[0].corroboration.correlation).toBe('console-log-to-runtime');
      expect(result[0].corroboration.confidence).toBe('high');
    });

    it('uses medium confidence when log content cannot be matched', () => {
      const source = [makeFinding({
        ruleId: 'debug-console-log',
        message: 'Console logging statement detected',
        snippet: 'console.log(someVariable)',
        filePath: 'src/app.ts',
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'console-warning',
        message: 'console.warn output captured',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].corroboration.confidence).toBe('medium');
    });
  });

  describe('hardcoded URL to network correlation', () => {
    it('correlates hardcoded-localhost with browser network request', () => {
      const source = [makeFinding({
        ruleId: 'hardcoded-localhost',
        message: 'Hardcoded localhost URL detected',
        snippet: 'const url = "http://localhost:3001/api"',
        filePath: 'src/config.ts',
        line: 8,
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'network-request',
        message: 'Request to http://localhost:3001/api',
        snippet: 'http://localhost:3001/api',
        url: 'http://localhost:3000/dashboard',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('corroborated-hardcoded-url');
      expect(result[0].corroboration.correlation).toBe('hardcoded-url-to-network');
    });
  });

  describe('accessibility correlation', () => {
    it('correlates source a11y issues with axe-core violations', () => {
      const source = [makeFinding({
        ruleId: 'placeholder-lorem',
        message: 'Missing label attribute',
        snippet: '<input type="text" placeholder="Enter name">',
        filePath: 'src/Form.tsx',
        line: 15,
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'label-violation',
        message: 'Form input element must have a label',
        snippet: '<input> element missing label',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('corroborated-a11y-violation');
      expect(result[0].corroboration.correlation).toBe('source-a11y-to-axe');
    });
  });

  describe('placeholder correlation', () => {
    it('correlates placeholder-lorem with browser evidence', () => {
      const source = [makeFinding({
        ruleId: 'placeholder-lorem',
        severity: 'high',
        message: 'Lorem ipsum placeholder text detected',
        snippet: '<p>Lorem ipsum dolor sit amet</p>',
        filePath: 'src/Page.tsx',
        line: 20,
      })];

      const browser = [makeBrowserFinding({
        ruleId: 'visual-text',
        message: 'Lorem ipsum text visible on page',
        snippet: 'Lorem ipsum dolor sit amet',
      })];

      const result = crossReference(source, browser);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('corroborated-placeholder');
      expect(result[0].corroboration.correlation).toBe('placeholder-to-runtime');
      expect(result[0].severity).toBe('critical'); // bumped from high
    });
  });

  describe('deduplication', () => {
    it('deduplicates findings from the same source location', () => {
      const source = [makeFinding({
        ruleId: 'hardcoded-localhost',
        snippet: 'const api = "http://localhost:3000/test"',
        filePath: 'src/api.ts',
        line: 5,
      })];

      // Two browser findings that could both match
      const browser = [
        makeBrowserFinding({
          message: 'Request to http://localhost:3000/test',
          snippet: 'http://localhost:3000/test',
        }),
        makeBrowserFinding({
          message: 'Another request to http://localhost:3000/test',
          snippet: 'http://localhost:3000/test',
          url: 'http://localhost:3000/other',
        }),
      ];

      const result = crossReference(source, browser);

      // Should only produce one corroborated finding (deduped by source location)
      expect(result).toHaveLength(1);
    });
  });
});

describe('crossReferenceSummary', () => {
  it('returns null when no corroborated findings', () => {
    const result = crossReferenceSummary([]);
    expect(result).toBeNull();
  });

  it('produces info-level summary', () => {
    const source = [makeFinding({
      ruleId: 'debug-console-log',
      snippet: 'console.log("test")',
    })];

    const browser = [makeBrowserFinding({
      ruleId: 'console-output',
      message: 'console.log captured: test',
      snippet: 'test',
    })];

    const corroborated = crossReference(source, browser);
    const summary = crossReferenceSummary(corroborated);

    expect(summary).not.toBeNull();
    expect(summary!.ruleId).toBe('cross-reference-summary');
    expect(summary!.severity).toBe('info');
    expect(summary!.message).toContain('1 finding');
    expect(summary!.message).toContain('console-log-to-runtime');
  });
});
