import pc from 'picocolors';
import type { Finding, Severity } from '../core/types.js';

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
