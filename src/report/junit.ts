import type { SniffReport } from './types.js';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateJunitReport(report: SniffReport): string {
  const { findings, summary, metadata } = report;
  const durationSec = (metadata.duration / 1000).toFixed(3);

  // Group findings by scanner (extract from ruleId prefix e.g. "perf/lcp" -> "perf", "a11y/..." -> "a11y")
  const findingsByScanner = new Map<string, typeof findings>();
  const scannersWithFindings = new Set<string>();

  for (const finding of findings) {
    const scanner = finding.ruleId.split('/')[0] || 'unknown';
    scannersWithFindings.add(scanner);
    const list = findingsByScanner.get(scanner) ?? [];
    list.push(finding);
    findingsByScanner.set(scanner, list);
  }

  // Also include scanners from byScanner that had zero findings
  for (const scannerName of Object.keys(summary.byScanner)) {
    if (!findingsByScanner.has(scannerName)) {
      findingsByScanner.set(scannerName, []);
    }
  }

  // Calculate total tests: findings count + passing scanners (scanners with 0 findings get 1 passing test)
  const failureSeverities = new Set(['critical', 'high']);
  const totalFailures = findings.filter(f => failureSeverities.has(f.severity)).length;
  const totalErrors = 0; // reserved for scanner-level errors
  const totalTests = findings.length + [...findingsByScanner.entries()].filter(([, f]) => f.length === 0).length;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="sniff" tests="${totalTests}" failures="${totalFailures}" errors="${totalErrors}" time="${durationSec}">`);

  for (const [scannerName, scannerFindings] of findingsByScanner) {
    const suiteFailures = scannerFindings.filter(f => failureSeverities.has(f.severity)).length;

    if (scannerFindings.length === 0) {
      // Passing suite
      lines.push(`  <testsuite name="${xmlEscape(scannerName)}" tests="1" failures="0">`);
      lines.push(`    <testcase name="${xmlEscape(scannerName)} passed" classname="${xmlEscape(scannerName)}"/>`);
      lines.push('  </testsuite>');
    } else {
      lines.push(`  <testsuite name="${xmlEscape(scannerName)}" tests="${scannerFindings.length}" failures="${suiteFailures}">`);
      for (const finding of scannerFindings) {
        const caseName = `${finding.ruleId} on ${finding.filePath}`;
        lines.push(`    <testcase name="${xmlEscape(caseName)}" classname="${xmlEscape(scannerName)}">`);
        lines.push(`      <failure message="${xmlEscape(finding.message)}" type="${finding.severity}"/>`);
        lines.push('    </testcase>');
      }
      lines.push('  </testsuite>');
    }
  }

  lines.push('</testsuites>');
  return lines.join('\n');
}
