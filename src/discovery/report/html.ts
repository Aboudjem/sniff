import type { DiscoveryReport, ScenarioResult, StepRecord, ValidationOutcome } from '../run-types.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusBadge(status: ScenarioResult['status'] | StepRecord['status']): string {
  const cls = status === 'pass' ? 'badge pass' : status === 'skip' ? 'badge skip' : 'badge fail';
  return `<span class="${cls}">${status.toUpperCase()}</span>`;
}

function renderValidation(v: ValidationOutcome): string {
  const icon = v.passed ? '✓' : '✗';
  const cls = v.passed ? 'val pass' : 'val fail';
  const detail = v.detail ? ` <span class="detail">${escapeHtml(v.detail)}</span>` : '';
  return `<li class="${cls}">${icon} ${escapeHtml(v.name)}${detail}</li>`;
}

function renderStep(step: StepRecord): string {
  const validations = step.validations.map(renderValidation).join('');
  const obs = step.observation;
  const observations = [
    obs.responseTimeMs !== undefined ? `<span>response ${Math.round(obs.responseTimeMs)}ms</span>` : '',
    obs.consoleErrors > 0 ? `<span class="warn">${obs.consoleErrors} console error(s)</span>` : '',
    obs.networkFailures > 0 ? `<span class="warn">${obs.networkFailures} network failure(s)</span>` : '',
    obs.screenshotPath ? `<a href="${escapeHtml(obs.screenshotPath)}">screenshot</a>` : '',
  ].filter(Boolean).join(' · ');

  const selectorLine = step.resolvedSelector
    ? `<div class="selector">selector: <code>${escapeHtml(step.resolvedSelector)}</code></div>`
    : '';

  const failureLine = step.failureReason
    ? `<div class="failure">${escapeHtml(step.failureReason)}</div>`
    : '';

  return `
    <li class="step ${step.status}">
      <div class="step-header">
        <span class="step-n">${step.n}</span>
        <span class="step-action">${escapeHtml(step.action)}</span>
        ${statusBadge(step.status)}
      </div>
      <div class="step-intent">${escapeHtml(step.intent)}</div>
      ${selectorLine}
      ${failureLine}
      <div class="observations">${observations}</div>
      <ul class="validations">${validations}</ul>
    </li>`;
}

function renderScenario(result: ScenarioResult): string {
  const steps = result.steps.map(renderStep).join('');
  const { scenario } = result;
  return `
    <details class="scenario ${result.status}" ${result.status === 'fail' ? 'open' : ''}>
      <summary>
        <span class="journey">${escapeHtml(scenario.journey)}</span>
        <span class="variant">${escapeHtml(scenario.variant)}</span>
        ${statusBadge(result.status)}
        <span class="duration">${(result.durationMs / 1000).toFixed(2)}s</span>
      </summary>
      <div class="scenario-body">
        <div class="scenario-meta">
          <div><strong>Name:</strong> ${escapeHtml(scenario.name)}</div>
          <div><strong>Persona:</strong> ${escapeHtml(scenario.persona ?? 'n/a')}</div>
          <div><strong>Realism:</strong> ${escapeHtml(scenario.realism)}</div>
          <div><strong>Seed:</strong> ${result.seed}</div>
          <div><strong>Goal:</strong> ${escapeHtml(scenario.goal.description)}</div>
          ${result.skippedReason ? `<div><strong>Skipped:</strong> ${escapeHtml(result.skippedReason)}</div>` : ''}
        </div>
        <ol class="steps">${steps}</ol>
      </div>
    </details>`;
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

function renderAppTypeSection(appType: string, scenarios: ScenarioResult[]): string {
  const passed = scenarios.filter((s) => s.status === 'pass').length;
  const failed = scenarios.filter((s) => s.status === 'fail').length;
  const skipped = scenarios.filter((s) => s.status === 'skip').length;
  return `
    <section class="app-type">
      <h2>${escapeHtml(appType)}</h2>
      <div class="app-stats">${passed} passed · ${failed} failed · ${skipped} skipped</div>
      <div class="scenarios">${scenarios.map(renderScenario).join('')}</div>
    </section>`;
}

const CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #fafafa; color: #1a1a1a; }
  header { padding: 2rem; background: #1a1a1a; color: #fff; }
  header h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
  .run-meta { opacity: 0.7; font-size: 0.9rem; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; padding: 1.5rem 2rem; background: #fff; border-bottom: 1px solid #eee; }
  .stat { padding: 1rem; border-radius: 8px; background: #f5f5f5; }
  .stat .label { font-size: 0.8rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat .value { font-size: 1.8rem; font-weight: 700; }
  .stat.pass .value { color: #0a7f3f; }
  .stat.fail .value { color: #c42d2d; }
  .stat.skip .value { color: #a07800; }
  main { padding: 1.5rem 2rem; }
  .app-type { margin-bottom: 2rem; }
  .app-type h2 { margin: 0 0 0.25rem; text-transform: capitalize; }
  .app-stats { font-size: 0.85rem; color: #666; margin-bottom: 1rem; }
  .scenario { background: #fff; border: 1px solid #eee; border-radius: 8px; margin-bottom: 0.75rem; overflow: hidden; }
  .scenario.fail { border-color: #f5c2c2; }
  .scenario.pass { border-color: #c8e6d0; }
  .scenario summary { padding: 0.75rem 1rem; cursor: pointer; display: flex; gap: 0.75rem; align-items: center; font-weight: 500; }
  .scenario summary::-webkit-details-marker { display: none; }
  .journey { flex: 1; }
  .variant { font-size: 0.8rem; color: #666; padding: 0.1rem 0.5rem; background: #f0f0f0; border-radius: 4px; }
  .duration { font-size: 0.8rem; color: #666; }
  .badge { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; font-weight: 700; letter-spacing: 0.03em; }
  .badge.pass { background: #dcf2e3; color: #0a7f3f; }
  .badge.fail { background: #f7d9d9; color: #c42d2d; }
  .badge.skip { background: #f7e9c3; color: #7a5c00; }
  .scenario-body { border-top: 1px solid #f0f0f0; padding: 1rem; }
  .scenario-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; font-size: 0.9rem; margin-bottom: 1rem; padding: 0.75rem; background: #fafafa; border-radius: 6px; }
  ol.steps { list-style: none; padding-left: 0; margin: 0; }
  .step { border-left: 3px solid #ddd; padding: 0.75rem 1rem; margin-bottom: 0.5rem; background: #fff; border-radius: 4px; }
  .step.pass { border-left-color: #3ec16a; }
  .step.fail { border-left-color: #c42d2d; }
  .step.skip { border-left-color: #a07800; }
  .step-header { display: flex; gap: 0.75rem; align-items: center; font-weight: 600; font-size: 0.95rem; }
  .step-n { display: inline-block; width: 1.5rem; height: 1.5rem; border-radius: 50%; background: #333; color: #fff; text-align: center; font-size: 0.75rem; line-height: 1.5rem; }
  .step-action { font-family: monospace; font-size: 0.85rem; color: #333; }
  .step-intent { margin: 0.25rem 0 0.5rem; }
  .selector { font-size: 0.8rem; color: #555; margin: 0.25rem 0; }
  .failure { color: #c42d2d; font-size: 0.85rem; margin: 0.25rem 0; }
  .observations { font-size: 0.8rem; color: #666; margin: 0.25rem 0; }
  .observations .warn { color: #b85c00; }
  .validations { list-style: none; padding-left: 0; margin: 0.5rem 0 0; }
  .val { font-size: 0.8rem; padding: 0.15rem 0; }
  .val.pass { color: #0a7f3f; }
  .val.fail { color: #c42d2d; }
  .val .detail { color: #666; font-size: 0.75rem; margin-left: 0.25rem; }
`;

export function generateDiscoveryHtmlReport(report: DiscoveryReport): string {
  const byType = groupByAppType(report.scenarios);
  const sections = [...byType.entries()].map(([t, s]) => renderAppTypeSection(t, s)).join('');
  const topGuesses = report.appTypeGuesses
    .slice(0, 3)
    .map((g) => `${g.type} (${(g.confidence * 100).toFixed(0)}%)`)
    .join(', ');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Sniff Discovery Report</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>Sniff Discovery Report</h1>
  <div class="run-meta">Ran at ${escapeHtml(report.runAt)} · App type guesses: ${escapeHtml(topGuesses || 'none')}</div>
</header>
<div class="stats">
  <div class="stat"><div class="label">Total</div><div class="value">${report.stats.total}</div></div>
  <div class="stat pass"><div class="label">Passed</div><div class="value">${report.stats.passed}</div></div>
  <div class="stat fail"><div class="label">Failed</div><div class="value">${report.stats.failed}</div></div>
  <div class="stat skip"><div class="label">Skipped</div><div class="value">${report.stats.skipped}</div></div>
</div>
<main>
  ${sections || '<p>No scenarios were produced.</p>'}
</main>
</body>
</html>`;
}
