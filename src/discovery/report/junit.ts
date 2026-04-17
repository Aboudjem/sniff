import type { DiscoveryReport, ScenarioResult } from '../run-types.js';

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function groupByAppType(scenarios: ScenarioResult[]): Map<string, ScenarioResult[]> {
  const map = new Map<string, ScenarioResult[]>();
  for (const s of scenarios) {
    const key = s.scenario.appType;
    const list = map.get(key) ?? [];
    list.push(s);
    map.set(key, list);
  }
  return map;
}

function renderSystemOut(result: ScenarioResult): string {
  const lines: string[] = [];
  lines.push(`seed: ${result.seed}`);
  lines.push(`scenario: ${result.scenario.id} (${result.scenario.variant})`);
  for (const step of result.steps) {
    const checks = step.validations.map((v) => `${v.passed ? 'OK' : 'FAIL'} ${v.name}`).join('; ');
    lines.push(`  step ${step.n} ${step.action} [${step.status}]: ${step.intent}`);
    if (step.resolvedSelector) lines.push(`    selector: ${step.resolvedSelector}`);
    if (checks) lines.push(`    ${checks}`);
    if (step.observation.screenshotPath) lines.push(`    screenshot: ${step.observation.screenshotPath}`);
  }
  return xmlEscape(lines.join('\n'));
}

function renderFailure(result: ScenarioResult): string | null {
  const failed = result.steps.find((s) => s.status === 'fail');
  if (!failed) return null;
  const msg = failed.failureReason ?? `step ${failed.n} failed`;
  const details = failed.validations.filter((v) => !v.passed).map((v) => `${v.name}${v.detail ? `: ${v.detail}` : ''}`);
  const body = [
    `Step ${failed.n}: ${failed.intent}`,
    ...details.map((d) => `  - ${d}`),
    failed.observation.screenshotPath ? `Screenshot: ${failed.observation.screenshotPath}` : '',
  ].filter(Boolean).join('\n');
  return `<failure message="${xmlEscape(msg)}" type="scenario-failure">${xmlEscape(body)}</failure>`;
}

export function generateDiscoveryJunitReport(report: DiscoveryReport): string {
  const durationSec = (report.stats.durationMs / 1000).toFixed(3);
  const byType = groupByAppType(report.scenarios);

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<testsuites name="sniff-discovery" tests="${report.stats.total}" failures="${report.stats.failed}" time="${durationSec}">`);

  for (const [appType, scenarios] of byType) {
    const failed = scenarios.filter((s) => s.status === 'fail').length;
    const skipped = scenarios.filter((s) => s.status === 'skip').length;
    const suiteDurationSec = (scenarios.reduce((sum, s) => sum + s.durationMs, 0) / 1000).toFixed(3);
    lines.push(`  <testsuite name="${xmlEscape(appType)}" tests="${scenarios.length}" failures="${failed}" skipped="${skipped}" time="${suiteDurationSec}">`);

    for (const result of scenarios) {
      const caseDuration = (result.durationMs / 1000).toFixed(3);
      const caseName = `${result.scenario.journey} (${result.scenario.variant})`;
      lines.push(`    <testcase name="${xmlEscape(caseName)}" classname="${xmlEscape(appType)}" time="${caseDuration}">`);
      if (result.status === 'fail') {
        const f = renderFailure(result);
        if (f) lines.push(`      ${f}`);
      }
      if (result.status === 'skip') {
        lines.push(`      <skipped message="${xmlEscape(result.skippedReason ?? 'skipped')}"/>`);
      }
      lines.push(`      <system-out>${renderSystemOut(result)}</system-out>`);
      lines.push('    </testcase>');
    }

    lines.push('  </testsuite>');
  }

  lines.push('</testsuites>');
  return lines.join('\n');
}
