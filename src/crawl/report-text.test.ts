import { describe, it, expect } from 'vitest';
import { formatReportText, renderHtmlReport, fixFirst, verdictLine, severityCounts, withVisibility } from './index.js';
import type { CrawlReport, QaFinding } from './types.js';

function finding(over: Partial<QaFinding> & { route?: string; shot?: string } = {}): QaFinding {
  const { route = '/', shot, ...rest } = over;
  return {
    ruleId: 'route/broken-page',
    issueClass: 1,
    title: 'Page returns HTTP 500',
    severity: 'critical',
    confidence: 'confirmed',
    suggestedFix: 'Check the server handler.',
    reproduction: {
      url: `http://localhost:3000${route}`,
      route,
      steps: [`Navigate to ${route}`],
      ...(shot ? { screenshotPath: shot } : {}),
    },
    ...rest,
  };
}

function report(findings: QaFinding[]): CrawlReport {
  return {
    findings,
    stats: { pagesVisited: 4, linksChecked: 9, durationMs: 12340, startUrl: 'http://localhost:3000' },
    routes: ['/'],
    runAt: '2026-11-17T10:00:00.000Z',
    summary: { total: findings.length, bySeverity: {}, byConfidence: {}, byIssueClass: {} },
  };
}

/** Lines that carry text, the way a reader (or the fleet check) sees the report. */
const textLines = (s: string) => s.split('\n').filter((l) => l.trim());

describe('verdict helpers', () => {
  it('counts by severity, worst first, and leaves out zero counts', () => {
    const fs = [finding({ severity: 'low' }), finding({ severity: 'critical' }), finding({ severity: 'low' })];
    expect(severityCounts(fs)).toBe('1 critical, 2 low');
  });

  it('passes with no findings', () => {
    expect(verdictLine([])).toBe('PASS: no findings');
  });

  it('fails on a critical or high finding by default', () => {
    expect(verdictLine([finding({ severity: 'high' })])).toBe('FAIL: 1 finding (1 high)');
  });

  it('passes on medium and low findings, and says why', () => {
    expect(verdictLine([finding({ severity: 'medium' }), finding({ severity: 'low' })])).toBe(
      'PASS: 2 findings (1 medium, 1 low), none at a failing severity',
    );
  });

  it('lets the caller override the verdict with the real exit decision', () => {
    // --fail-on none: a critical finding, yet the run exits 0.
    expect(verdictLine([finding()], false)).toMatch(/^PASS: 1 finding/);
    // An assert budget breached by medium findings: the run exits 1.
    expect(verdictLine([finding({ severity: 'medium' })], true)).toMatch(/^FAIL: 1 finding/);
  });

  it('picks the worst and most certain findings first, three at most', () => {
    const fs = [
      finding({ title: 'low one', severity: 'low' }),
      finding({ title: 'high likely', severity: 'high', confidence: 'likely' }),
      finding({ title: 'high confirmed', severity: 'high', confidence: 'confirmed' }),
      finding({ title: 'critical', severity: 'critical' }),
      finding({ title: 'medium', severity: 'medium' }),
    ];
    expect(fixFirst(fs).map((f) => f.title)).toEqual(['critical', 'high confirmed', 'high likely']);
    expect(fs[0]!.title).toBe('low one'); // the input is not reordered
  });
});

describe('formatReportText', () => {
  it('opens with the verdict, before any finding', () => {
    const lines = textLines(formatReportText(report([finding(), finding({ severity: 'low', title: 'Tiny tap target' })])));
    expect(lines[0]).toBe('  VERDICT  FAIL: 2 findings (1 critical, 1 low)');
    expect(lines[1]).toBe('  Walked 4 pages, checked 9 links, in 12.3s.');
  });

  it('lists what to fix first right under the verdict, then the detail', () => {
    const fs = [
      finding({ title: 'A', route: '/a', severity: 'low' }),
      finding({ title: 'B', route: '/b', severity: 'critical' }),
      finding({ title: 'C', route: '/c', severity: 'high' }),
      finding({ title: 'D', route: '/d', severity: 'medium' }),
    ];
    const out = formatReportText(report(fs));
    const lines = textLines(out);
    expect(lines.slice(2, 6)).toEqual([
      '  Fix these first:',
      '    1. B on /b  [critical]',
      '    2. C on /c  [high]',
      '    3. D on /d  [medium]',
    ]);
    expect(out.indexOf('Fix these first:')).toBeLessThan(out.indexOf('CRITICAL (1)'));
    // Every finding still appears in the detail, the low one included.
    expect(out).toContain('LOW (1)');
    expect(out).toContain('• [confirmed] A');
  });

  it('says "Fix these" when the list is the whole report', () => {
    expect(formatReportText(report([finding()]))).toContain('  Fix these:\n    1. Page returns HTTP 500 on /  [critical]');
  });

  it('prints a clean report as a pass with no finding list', () => {
    const lines = textLines(formatReportText(report([])));
    expect(lines).toEqual(['  VERDICT  PASS: no findings', '  Walked 4 pages, checked 9 links, in 12.3s.']);
  });

  it('hides uncertain findings, counts them, and shows them with all', () => {
    const fs = [finding({ severity: 'medium', confidence: 'uncertain', title: 'Maybe' })];
    const hidden = formatReportText(report(fs));
    expect(hidden).toContain('VERDICT  PASS: no findings, 1 low-confidence finding hidden');
    expect(hidden).toContain('--all shows the hidden one.');
    expect(hidden).not.toContain('Maybe');
    expect(formatReportText(report(fs), { all: true })).toContain('• [uncertain] Maybe');
  });

  it('uses the exit decision it is given', () => {
    expect(formatReportText(report([finding()]), { failed: false })).toContain('VERDICT  PASS: 1 finding (1 critical)');
  });

  it('prints a screenshot path relative to the working folder, and leaves others alone', () => {
    const inside = formatReportText(report([finding({ shot: '/work/app/sniff-reports/crawl/_crash-desktop.png' })]), { cwd: '/work/app' });
    expect(inside).toContain('shot: sniff-reports/crawl/_crash-desktop.png');
    const outside = formatReportText(report([finding({ shot: '/elsewhere/x.png' })]), { cwd: '/work/app' });
    expect(outside).toContain('shot: /elsewhere/x.png');
  });

  it('holds no em dash', () => {
    expect(formatReportText(report([finding()]))).not.toMatch(/—/);
  });
});

describe('renderHtmlReport', () => {
  it('puts the verdict and the fix-first list above the finding cards', () => {
    const html = renderHtmlReport(report([finding(), finding({ severity: 'low', title: 'Tiny tap target' })]));
    const verdict = html.indexOf('FAIL: 2 findings (1 critical, 1 low)');
    const first = html.indexOf('<h2>Fix these</h2>');
    const cards = html.indexOf('<article class="card"');
    expect(verdict).toBeGreaterThan(-1);
    expect(first).toBeGreaterThan(verdict);
    expect(cards).toBeGreaterThan(first);
  });

  it('shows a pass and no card for a clean walk', () => {
    const html = renderHtmlReport(report([]));
    expect(html).toContain('PASS: no findings');
    expect(html).not.toContain('<article class="card"');
  });
});

// Defect seen on 0.9.2: one walk said 26 findings in the terminal and 27 in
// the HTML verdict and the JSON summary, with no word about the hidden one.
describe('every output tells the same count', () => {
  const run = report([
    finding(),
    finding({ severity: 'high', title: 'Dead link' }),
    finding({ severity: 'medium', confidence: 'uncertain', title: 'Maybe slow' }),
  ]);

  it('terminal, HTML and JSON state 2 shown and 1 hidden', () => {
    const line = 'FAIL: 2 findings (1 critical, 1 high), 1 low-confidence finding hidden';
    expect(formatReportText(run)).toContain(`VERDICT  ${line}`);
    const html = renderHtmlReport(run);
    expect(html).toContain(line);
    expect(html).toContain('<span class="stat">2 findings</span>');
    // The hidden one is listed apart, after the main list, not in the verdict.
    expect(html.indexOf('Maybe slow')).toBeGreaterThan(html.indexOf('<details class="hidden">'));
    const json = withVisibility(run);
    expect(json.summary).toMatchObject({ total: 3, shown: 2, hiddenLowConfidence: 1 });
  });

  it('with --all, all three show everything and hide nothing', () => {
    const line = 'FAIL: 3 findings (1 critical, 1 high, 1 medium)';
    expect(formatReportText(run, { all: true })).toContain(`VERDICT  ${line}\n`);
    const html = renderHtmlReport(run, { all: true });
    expect(html).toContain(`${line}</p>`);
    expect(html).not.toContain('<details class="hidden">');
    expect(withVisibility(run, true).summary).toMatchObject({ total: 3, shown: 3, hiddenLowConfidence: 0 });
  });

  it('the HTML verdict follows the real exit decision', () => {
    expect(renderHtmlReport(run, { failed: false })).toContain('PASS: 2 findings (1 critical, 1 high), none at a failing severity');
  });
});
