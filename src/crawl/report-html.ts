import type { CrawlReport, QaFinding } from './types.js';

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'] as const;
const SEV_COLOR: Record<string, string> = {
  critical: '#ff5c7a', high: '#ff8a5c', medium: '#ffd166', low: '#6ee7b7', info: '#8ab4ff',
};
const CONF_COLOR: Record<string, string> = {
  confirmed: '#34d399', likely: '#fbbf24', uncertain: '#94a3b8',
};

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function findingCard(f: QaFinding): string {
  const steps = f.reproduction.steps.map((s) => `<li>${esc(s)}</li>`).join('');
  const net = (f.reproduction.networkExcerpt ?? []).map((s) => `<code>${esc(s)}</code>`).join('');
  const con = (f.reproduction.consoleExcerpt ?? []).map((s) => `<code>${esc(s)}</code>`).join('');
  const shot = f.reproduction.screenshotPath
    ? `<a class="shot" href="${esc(f.reproduction.screenshotPath)}">screenshot</a>` : '';
  const oob = f.needsOutOfBandVerification
    ? `<p class="oob">⚠ Needs out-of-band verification (confirm the email/async job actually completed).</p>` : '';
  return `
  <article class="card" data-sev="${f.severity}">
    <header>
      <span class="sev" style="--c:${SEV_COLOR[f.severity] ?? '#888'}">${f.severity}</span>
      <span class="conf" style="--c:${CONF_COLOR[f.confidence] ?? '#888'}">${f.confidence}</span>
      <h3>${esc(f.title)}</h3>
    </header>
    <div class="meta"><span class="route">${esc(f.reproduction.route)}</span><span class="rule">${esc(f.ruleId)}</span></div>
    <details open><summary>Reproduction</summary><ol>${steps}</ol>${con ? `<div class="ex">${con}</div>` : ''}${net ? `<div class="ex">${net}</div>` : ''}${shot}</details>
    <p class="fix"><strong>Fix:</strong> ${esc(f.suggestedFix)}</p>
    ${oob}
  </article>`;
}

/** Render a self-contained (no external refs/scripts) dark-mode HTML report. */
export function renderHtmlReport(report: CrawlReport, opts: { title?: string } = {}): string {
  const title = opts.title ?? 'sniff report';
  const shown = report.findings;
  const counts = SEV_ORDER.map((s) => ({ s, n: report.summary.bySeverity[s] ?? 0 })).filter((x) => x.n > 0);
  const chips = counts.map((c) => `<span class="chip" style="--c:${SEV_COLOR[c.s]}">${c.n} ${c.s}</span>`).join('');
  const cards = shown.length
    ? SEV_ORDER.flatMap((sev) => shown.filter((f) => f.severity === sev)).map(findingCard).join('')
    : `<p class="empty">No issues found. ✓</p>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:#0b0e14;color:#e6e9ef;font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  .wrap{max-width:860px;margin:0 auto;padding:32px 20px 80px}
  h1{font-size:24px;margin:0 0 4px} .sub{color:#8b93a7;margin:0 0 20px}
  .chips{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 28px}
  .chip{font-size:13px;padding:4px 10px;border-radius:999px;border:1px solid color-mix(in srgb,var(--c) 50%,transparent);color:var(--c);background:color-mix(in srgb,var(--c) 12%,transparent)}
  .stat{display:inline-block;margin-right:18px;color:#8b93a7;font-size:13px}
  .card{background:#11151f;border:1px solid #1e2533;border-radius:12px;padding:16px 18px;margin:14px 0}
  .card header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .card h3{font-size:16px;margin:6px 0 0;flex-basis:100%}
  .sev,.conf{font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding:3px 8px;border-radius:6px;color:var(--c);border:1px solid color-mix(in srgb,var(--c) 45%,transparent)}
  .meta{display:flex;gap:12px;margin:8px 0;font-size:13px}
  .route{color:#8ab4ff;font-family:ui-monospace,Menlo,monospace}
  .rule{color:#6b7280;font-family:ui-monospace,Menlo,monospace}
  details{margin:8px 0;border-top:1px solid #1e2533;padding-top:8px}
  summary{cursor:pointer;color:#aab2c5;font-size:13px}
  ol{margin:8px 0;padding-left:20px;color:#c7cdda}
  .ex{margin:6px 0;display:flex;flex-direction:column;gap:4px}
  code{background:#0b0e14;border:1px solid #1e2533;border-radius:6px;padding:4px 8px;font-size:12px;color:#9fb6e0;overflow-x:auto}
  .fix{margin:10px 0 0;color:#cbd5e1;font-size:14px}
  .oob{color:#fbbf24;font-size:13px;margin:8px 0 0}
  .shot{display:inline-block;margin-top:8px;color:#34d399;font-size:13px}
  .empty{color:#34d399;font-size:18px;text-align:center;padding:40px}
  footer{margin-top:40px;color:#5b6275;font-size:12px;text-align:center}
</style></head>
<body><div class="wrap">
  <h1>${esc(title)}</h1>
  <p class="sub">Autonomous QA scan of <code>${esc(report.stats.startUrl)}</code></p>
  <div>
    <span class="stat">${report.stats.pagesVisited} pages</span>
    <span class="stat">${report.stats.linksChecked} links checked</span>
    <span class="stat">${shown.length} findings</span>
    <span class="stat">${(report.stats.durationMs / 1000).toFixed(1)}s</span>
  </div>
  <div class="chips">${chips || '<span class="chip" style="--c:#34d399">0 issues</span>'}</div>
  ${cards}
  <footer>Generated by sniff · ${esc(report.runAt)}</footer>
</div></body></html>`;
}
