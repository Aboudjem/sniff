import type { Finding, BrowserFinding, Severity } from '../core/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CorrelationMatch {
  sourceRule: string;
  browserRule: string;
  description: string;
}

export interface CorroboratedFinding extends Finding {
  corroboration: {
    sourceEvidence: Finding;
    browserEvidence: Finding;
    correlation: string;
    confidence: 'high' | 'medium';
  };
}

// ---------------------------------------------------------------------------
// Severity bump logic
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

function bumpSeverity(current: Severity, steps: number = 1): Severity {
  const idx = SEVERITY_ORDER.indexOf(current);
  const newIdx = Math.min(idx + steps, SEVERITY_ORDER.length - 1);
  return SEVERITY_ORDER[newIdx];
}

// ---------------------------------------------------------------------------
// Correlation strategies
// ---------------------------------------------------------------------------

type CorrelationStrategy = (
  sourceFindings: Finding[],
  browserFindings: Finding[],
) => CorroboratedFinding[];

/**
 * Broken import in source -> 404 network request in browser
 * Source: broken-import or dead-link-internal rule
 * Browser: finding with "404" or "not found" in message/snippet
 */
const correlateImportsTo404s: CorrelationStrategy = (source, browser) => {
  const results: CorroboratedFinding[] = [];

  const importFindings = source.filter(
    (f) => f.ruleId === 'broken-import' || f.ruleId === 'dead-link-internal',
  );

  const notFoundFindings = browser.filter(
    (f) => /404|not\s*found/i.test(f.message) || /404|not\s*found/i.test(f.snippet),
  );

  for (const imp of importFindings) {
    // Extract the path/URL from the import finding
    // Try quoted strings first, then markdown link syntax, then the message
    const pathMatch = imp.snippet.match(/['"`]([^'"`]+)['"`]/)
      ?? imp.snippet.match(/\]\(([^)]+)\)/)
      ?? imp.message.match(/:\s*(.+)$/);
    const importPath = pathMatch?.[1]?.replace(/^\.\//, '') ?? '';

    for (const nf of notFoundFindings) {
      // Check if the browser 404 references a similar path
      const browserPath = nf.snippet || nf.message;
      if (importPath && browserPath.includes(importPath)) {
        results.push({
          ruleId: 'corroborated-broken-resource',
          severity: bumpSeverity(imp.severity),
          message: `Broken resource confirmed in both source and browser: ${importPath}`,
          filePath: imp.filePath,
          line: imp.line,
          column: imp.column,
          snippet: imp.snippet,
          corroboration: {
            sourceEvidence: imp,
            browserEvidence: nf,
            correlation: 'broken-import-to-404',
            confidence: 'high',
          },
        });
      }
    }
  }

  return results;
};

/**
 * Console.log in source -> console output captured in browser
 * Source: debug-console-log rule
 * Browser: finding with "console" in ruleId or message
 */
const correlateConsoleStatements: CorrelationStrategy = (source, browser) => {
  const results: CorroboratedFinding[] = [];

  const consoleLogs = source.filter(
    (f) => f.ruleId === 'debug-console-log',
  );

  const browserConsole = browser.filter(
    (f) => /console/i.test(f.ruleId) || /console\.\w+/i.test(f.message),
  );

  if (consoleLogs.length === 0 || browserConsole.length === 0) return results;

  // If both exist, correlate them (exact line matching is impractical
  // since browser captures runtime output, not source locations)
  for (const src of consoleLogs) {
    // Try to find a matching browser console entry
    const logContent = src.snippet.match(/console\.\w+\s*\(\s*['"`]([^'"`]*)['"`]/)?.[1];

    const match = logContent
      ? browserConsole.find((b) => b.message.includes(logContent) || b.snippet.includes(logContent))
      : browserConsole[0]; // Fall back to first browser console finding

    if (match) {
      results.push({
        ruleId: 'corroborated-debug-console',
        severity: bumpSeverity(src.severity),
        message: `Debug console.log confirmed at runtime: ${logContent ?? src.snippet}`,
        filePath: src.filePath,
        line: src.line,
        column: src.column,
        snippet: src.snippet,
        corroboration: {
          sourceEvidence: src,
          browserEvidence: match,
          correlation: 'console-log-to-runtime',
          confidence: logContent ? 'high' : 'medium',
        },
      });
    }
  }

  return results;
};

/**
 * Hardcoded URL in source -> that URL appearing in network log
 * Source: hardcoded-localhost or hardcoded-127 rule
 * Browser: any finding referencing the same URL pattern
 */
const correlateHardcodedUrls: CorrelationStrategy = (source, browser) => {
  const results: CorroboratedFinding[] = [];

  const hardcodedFindings = source.filter(
    (f) => f.ruleId.startsWith('hardcoded-'),
  );

  for (const hc of hardcodedFindings) {
    // Extract the URL from the snippet
    const urlMatch = hc.snippet.match(/https?:\/\/[^\s'"`,)]+/);
    if (!urlMatch) continue;
    const url = urlMatch[0];

    // Check if any browser finding references this URL
    const browserMatch = browser.find(
      (f) => f.message.includes(url) || f.snippet.includes(url)
        || ('url' in f && (f as BrowserFinding).url?.includes(url)),
    );

    if (browserMatch) {
      results.push({
        ruleId: 'corroborated-hardcoded-url',
        severity: bumpSeverity(hc.severity),
        message: `Hardcoded URL ${url} confirmed active at runtime`,
        filePath: hc.filePath,
        line: hc.line,
        column: hc.column,
        snippet: hc.snippet,
        corroboration: {
          sourceEvidence: hc,
          browserEvidence: browserMatch,
          correlation: 'hardcoded-url-to-network',
          confidence: 'high',
        },
      });
    }
  }

  return results;
};

/**
 * Missing form label in source (JSX without htmlFor) -> axe-core violation
 * Source: any finding about labels, htmlFor, or accessibility
 * Browser: axe-core violations (ruleId contains 'label' or 'aria')
 */
const correlateA11yViolations: CorrelationStrategy = (source, browser) => {
  const results: CorroboratedFinding[] = [];

  // Source findings about placeholder text, missing attributes
  const sourceA11y = source.filter(
    (f) => /label|aria|alt|role/i.test(f.message) || /placeholder/i.test(f.ruleId),
  );

  // Browser axe-core findings about labels
  const browserA11y = browser.filter(
    (f) => /label|aria|alt|role|form/i.test(f.ruleId) || /label|aria/i.test(f.message),
  );

  if (sourceA11y.length === 0 || browserA11y.length === 0) return results;

  // Try to match source file findings to browser accessibility violations
  for (const src of sourceA11y) {
    // Find browser findings that reference similar elements
    const match = browserA11y.find((b) => {
      // Match by element type or component name
      const srcElement = src.snippet.match(/<(\w+)/)?.[1]?.toLowerCase();
      return srcElement && (
        b.message.toLowerCase().includes(srcElement)
        || b.snippet.toLowerCase().includes(srcElement)
      );
    });

    if (match) {
      results.push({
        ruleId: 'corroborated-a11y-violation',
        severity: bumpSeverity(src.severity),
        message: `Accessibility issue confirmed by axe-core: ${src.message}`,
        filePath: src.filePath,
        line: src.line,
        column: src.column,
        snippet: src.snippet,
        corroboration: {
          sourceEvidence: src,
          browserEvidence: match,
          correlation: 'source-a11y-to-axe',
          confidence: 'medium',
        },
      });
    }
  }

  return results;
};

/**
 * Placeholder text in source -> visible in browser screenshot
 * Source: placeholder-lorem or placeholder-tbd
 * Browser: any finding that references similar text
 */
const correlatePlaceholders: CorrelationStrategy = (source, browser) => {
  const results: CorroboratedFinding[] = [];

  const placeholders = source.filter(
    (f) => f.ruleId.startsWith('placeholder-'),
  );

  for (const ph of placeholders) {
    // Extract the placeholder text
    const isLorem = ph.ruleId === 'placeholder-lorem';
    const searchTerm = isLorem ? 'lorem' : ph.ruleId.replace('placeholder-', '').toUpperCase();

    const match = browser.find(
      (f) => f.message.toLowerCase().includes(searchTerm.toLowerCase())
        || f.snippet.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (match) {
      results.push({
        ruleId: 'corroborated-placeholder',
        severity: bumpSeverity(ph.severity),
        message: `Placeholder text "${searchTerm}" visible at runtime`,
        filePath: ph.filePath,
        line: ph.line,
        column: ph.column,
        snippet: ph.snippet,
        corroboration: {
          sourceEvidence: ph,
          browserEvidence: match,
          correlation: 'placeholder-to-runtime',
          confidence: 'medium',
        },
      });
    }
  }

  return results;
};

// ---------------------------------------------------------------------------
// All strategies
// ---------------------------------------------------------------------------

const ALL_STRATEGIES: CorrelationStrategy[] = [
  correlateImportsTo404s,
  correlateConsoleStatements,
  correlateHardcodedUrls,
  correlateA11yViolations,
  correlatePlaceholders,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Cross-reference source scan findings with browser scan findings.
 * Produces corroborated findings with higher confidence and bumped severity.
 *
 * Call this after both source and browser scans have completed.
 */
export function crossReference(
  sourceFindings: Finding[],
  browserFindings: Finding[],
): CorroboratedFinding[] {
  if (sourceFindings.length === 0 || browserFindings.length === 0) return [];

  const allCorroborated: CorroboratedFinding[] = [];

  for (const strategy of ALL_STRATEGIES) {
    const matches = strategy(sourceFindings, browserFindings);
    allCorroborated.push(...matches);
  }

  // Deduplicate: same source finding should only be corroborated once
  const seen = new Set<string>();
  const deduped: CorroboratedFinding[] = [];

  for (const finding of allCorroborated) {
    const key = `${finding.corroboration.sourceEvidence.filePath}:${finding.corroboration.sourceEvidence.line}:${finding.corroboration.sourceEvidence.ruleId}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }

  return deduped;
}

/**
 * Returns a summary finding describing the cross-reference results.
 */
export function crossReferenceSummary(corroborated: CorroboratedFinding[]): Finding | null {
  if (corroborated.length === 0) return null;

  const byCorrelation = new Map<string, number>();
  for (const f of corroborated) {
    const key = f.corroboration.correlation;
    byCorrelation.set(key, (byCorrelation.get(key) ?? 0) + 1);
  }

  const details = [...byCorrelation.entries()]
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  return {
    ruleId: 'cross-reference-summary',
    severity: 'info',
    message: `Cross-referenced ${corroborated.length} finding(s) with both source and browser evidence (${details})`,
    filePath: '',
    line: 0,
    column: 0,
    snippet: '',
  };
}
