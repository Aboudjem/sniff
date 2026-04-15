import pc from 'picocolors';
import type { Finding, Severity, BrowserFinding } from '../core/types.js';

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

const severityColors: Record<Severity, (s: string) => string> = {
  critical: pc.red,
  high: pc.red,
  medium: pc.yellow,
  low: pc.cyan,
  info: pc.gray,
};

const severityIcons: Record<Severity, string> = {
  critical: 'X',
  high: '!',
  medium: '~',
  low: '-',
  info: 'i',
};

function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  const groups: Record<Severity, Finding[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: [],
  };

  for (const finding of findings) {
    groups[finding.severity].push(finding);
  }

  return groups;
}

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return pc.green('No issues found.');
  }

  const lines: string[] = [];
  const groups = groupBySeverity(findings);

  for (const severity of SEVERITY_ORDER) {
    const group = groups[severity];
    if (group.length === 0) continue;

    const color = severityColors[severity];
    const icon = severityIcons[severity];

    lines.push('');
    lines.push(color(`${icon} ${severity.toUpperCase()} (${group.length})`));

    for (const finding of group) {
      lines.push(
        `  ${pc.dim(finding.filePath)}:${pc.yellow(String(finding.line))} ${finding.message}`,
      );
      lines.push(`  ${pc.dim(finding.snippet)}`);
    }
  }

  // Summary line
  const parts: string[] = [];
  for (const severity of SEVERITY_ORDER) {
    const count = groups[severity].length;
    if (count > 0) {
      parts.push(severityColors[severity](`${count} ${severity}`));
    }
  }

  lines.push('');
  lines.push(`Found ${pc.bold(String(findings.length))} issues: ${parts.join(', ')}`);

  return lines.join('\n');
}

// Scanner display name mapping
const SCANNER_DISPLAY_NAMES: Record<string, string> = {
  'e2e/': 'Browser Tests',
  'a11y/': 'Accessibility',
  'visual/': 'Visual Regression',
  'perf/': 'Performance',
  'source/': 'Source Code',
};

function getScannerPrefix(ruleId: string): string {
  for (const prefix of Object.keys(SCANNER_DISPLAY_NAMES)) {
    if (ruleId.startsWith(prefix)) {
      return prefix;
    }
  }
  return 'other/';
}

function isBrowserFinding(finding: Finding): finding is BrowserFinding {
  return 'url' in finding && 'viewport' in finding;
}

export function formatBrowserFindings(findings: Finding[]): string {
  if (findings.length === 0) {
    return pc.green('No issues found.');
  }

  const lines: string[] = [];

  // Group findings by scanner prefix
  const scannerGroups = new Map<string, Finding[]>();
  for (const finding of findings) {
    const prefix = getScannerPrefix(finding.ruleId);
    if (!scannerGroups.has(prefix)) {
      scannerGroups.set(prefix, []);
    }
    scannerGroups.get(prefix)!.push(finding);
  }

  let scannerCount = 0;

  // Render each scanner group
  for (const [prefix, groupFindings] of scannerGroups) {
    scannerCount++;
    const displayName = SCANNER_DISPLAY_NAMES[prefix] ?? prefix.replace('/', '');

    lines.push('');
    lines.push(pc.blue(pc.bold(`[${displayName}]`)));

    // Sort by severity within group
    const sorted = [...groupFindings].sort(
      (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    );

    for (const finding of sorted) {
      const color = severityColors[finding.severity];
      const icon = severityIcons[finding.severity];

      // Viewport label for browser findings
      const vpLabel = isBrowserFinding(finding)
        ? ` ${pc.magenta(`[${finding.viewport}]`)}`
        : '';

      lines.push(
        `  ${color(`${icon}`)} ${color(finding.severity.toUpperCase())}${vpLabel} ${finding.message}`,
      );
      lines.push(
        `    ${pc.dim(finding.filePath)}:${pc.yellow(String(finding.line))}`,
      );

      if (finding.snippet) {
        lines.push(`    ${pc.dim(finding.snippet)}`);
      }

      // Screenshot path for browser findings
      if (isBrowserFinding(finding) && finding.screenshotPath) {
        lines.push(`    ${pc.dim(pc.underline(finding.screenshotPath))}`);
      }

      // Fix suggestion
      if (isBrowserFinding(finding) && finding.fixSuggestion) {
        lines.push(`    ${pc.green('Fix:')} ${finding.fixSuggestion}`);
      }
    }
  }

  // Summary line
  const parts: string[] = [];
  const groups = groupBySeverity(findings);
  for (const severity of SEVERITY_ORDER) {
    const count = groups[severity].length;
    if (count > 0) {
      parts.push(severityColors[severity](`${count} ${severity}`));
    }
  }

  lines.push('');
  lines.push(
    `Found ${pc.bold(String(findings.length))} issues across ${scannerCount} scanners: ${parts.join(', ')}`,
  );

  return lines.join('\n');
}

export function formatProgress(viewport: string, url: string, findingCount: number): string {
  const suffix =
    findingCount === 0
      ? pc.green('0 findings')
      : pc.yellow(`${findingCount} finding${findingCount !== 1 ? 's' : ''}`);
  return `  ${pc.dim(`[${viewport}]`)} ${pc.dim(url)}... done (${suffix})`;
}
