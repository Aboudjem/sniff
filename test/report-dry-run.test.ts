import { describe, it, expect } from 'vitest';
import { buildReport } from '../src/report/model.js';
import { generateJsonReport } from '../src/report/json.js';
import { generateJunitReport } from '../src/report/junit.js';
import { generateHtmlReport } from '../src/report/html.js';
import type { ScanResult } from '../src/scanners/types.js';
import type { Finding } from '../src/core/types.js';
import type { Screenshot } from '../src/report/types.js';

const mockFindings: Finding[] = [
  {
    ruleId: 'a11y/color-contrast',
    severity: 'high',
    message: 'Elements must have sufficient color contrast',
    filePath: 'http://localhost:3000/',
    line: 0,
    column: 0,
    snippet: '<div style="color: #ccc; background: #fff">Low contrast</div>',
  },
  {
    ruleId: 'visual/regression',
    severity: 'medium',
    message: 'Visual difference detected: 2.3% pixel mismatch',
    filePath: 'http://localhost:3000/',
    line: 0,
    column: 0,
    snippet: 'Baseline: baseline.png\nCurrent: current.png\nDiff: diff.png',
  },
  {
    ruleId: 'perf/lcp',
    severity: 'high',
    message: 'LCP exceeds budget: 3200ms (budget: 2500ms)',
    filePath: 'http://localhost:3000/',
    line: 0,
    column: 0,
    snippet: '',
  },
  {
    ruleId: 'e2e/console-error',
    severity: 'critical',
    message: 'Uncaught TypeError: Cannot read properties of undefined',
    filePath: 'http://localhost:3000/dashboard',
    line: 0,
    column: 0,
    snippet: '',
  },
  {
    ruleId: 'source/todo',
    severity: 'low',
    message: 'TODO comment found: fix this later',
    filePath: 'src/app.ts',
    line: 42,
    column: 5,
    snippet: '// TODO: fix this later',
  },
];

const mockResults: ScanResult[] = [
  {
    scanner: 'accessibility',
    findings: [mockFindings[0]],
    duration: 150,
    metadata: {},
  },
  {
    scanner: 'visual',
    findings: [mockFindings[1]],
    duration: 200,
    metadata: {},
  },
  {
    scanner: 'performance',
    findings: [mockFindings[2]],
    duration: 5000,
    metadata: {
      metrics: {
        'http://localhost:3000/': {
          lcp: 3200,
          fcp: 1500,
          tti: 3000,
          score: 72,
        },
      },
    },
  },
  {
    scanner: 'e2e',
    findings: [mockFindings[3]],
    duration: 300,
    metadata: {},
  },
  {
    scanner: 'source',
    findings: [mockFindings[4]],
    duration: 50,
    metadata: {},
  },
];

const mockScreenshots: Screenshot[] = [];

describe('Report generators dry-run', () => {
  const report = buildReport(
    mockResults,
    {
      timestamp: '2026-04-15T12:00:00.000Z',
      duration: 5700,
      targetUrl: 'http://localhost:3000',
      viewports: [
        { name: 'desktop', width: 1280, height: 720 },
        { name: 'mobile', width: 375, height: 667 },
      ],
      commandUsed: 'sniff run',
    },
    mockScreenshots,
  );

  it('buildReport produces correct summary', () => {
    expect(report.summary.total).toBe(5);
    expect(report.summary.bySeverity.critical).toBe(1);
    expect(report.summary.bySeverity.high).toBe(2);
    expect(report.summary.bySeverity.medium).toBe(1);
    expect(report.summary.bySeverity.low).toBe(1);
    expect(report.summary.byScanner).toHaveProperty('accessibility');
    expect(report.summary.byScanner).toHaveProperty('performance');
    expect(report.findings).toHaveLength(5);
    expect(report.metadata.version).toBe('0.1.0');
  });

  it('generateJsonReport produces valid JSON', () => {
    const jsonOutput = generateJsonReport(report);
    expect(jsonOutput.length).toBeGreaterThan(0);
    const parsed = JSON.parse(jsonOutput);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.findings).toHaveLength(5);
  });

  it('generateJunitReport produces valid XML', () => {
    const xmlOutput = generateJunitReport(report);
    expect(xmlOutput.length).toBeGreaterThan(0);
    expect(xmlOutput).toContain('<?xml version');
    expect(xmlOutput).toContain('<testsuites');
    expect(xmlOutput).toContain('</testsuites>');
    expect(xmlOutput).toContain('name="sniff"');
  });

  it('generateHtmlReport produces valid HTML', () => {
    const htmlOutput = generateHtmlReport(report);
    expect(htmlOutput.length).toBeGreaterThan(0);
    expect(htmlOutput).toContain('<!DOCTYPE html>');
    expect(htmlOutput).toContain('Sniff QA Report');
    expect(htmlOutput).toContain('Accessibility');
    expect(htmlOutput).toContain('Visual Regression');
    expect(htmlOutput).toContain('Performance');
    expect(htmlOutput).toContain('prefers-color-scheme: dark');
    expect(htmlOutput).toContain('badge-critical');
    expect(htmlOutput).toContain('badge-high');
  });
});
