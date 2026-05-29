// Shared scoring logic for the planted-bug fixture. Used by the CLI scorer
// (score-fixture.mjs) and the vitest regression gate. Rule-id-centric matching:
// class-of-bug words match the finding's RULE ID; free text is reserved for
// genuine data literals only.

function collectFindings(node, out) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const x of node) collectFindings(x, out); return; }
  const rule = node.ruleId ?? node.id ?? node.rule ?? node.kind;
  const hasLoc = 'url' in node || 'route' in node || 'filePath' in node || 'reproduction' in node;
  if (typeof rule === 'string' && (hasLoc || 'message' in node || 'title' in node)) out.push(node);
  for (const k of Object.keys(node)) {
    if (typeof node[k] === 'object') collectFindings(node[k], out);
  }
}

function pathOf(u) {
  if (!u || typeof u !== 'string') return '';
  try { return new URL(u, 'http://localhost').pathname.replace(/\/+$/, '') || '/'; } catch { return u; }
}

function normalize(rawFindings) {
  const seen = new Set();
  const findings = [];
  for (const f of rawFindings) {
    const repro = f.reproduction && typeof f.reproduction === 'object' ? f.reproduction : {};
    const rule = String(f.ruleId ?? f.id ?? f.rule ?? f.kind ?? '');
    const url = String(f.url ?? f.route ?? repro.url ?? repro.route ?? f.filePath ?? '');
    const steps = Array.isArray(f.steps) ? f.steps : Array.isArray(repro.steps) ? repro.steps : [];
    const excerpt = [].concat(repro.consoleExcerpt ?? [], repro.networkExcerpt ?? [], f.networkExcerpt ?? [], f.consoleExcerpt ?? []);
    const msg = (String(f.message ?? f.title ?? '') + ' ' + String(f.snippet ?? f.evidence ?? '') + ' ' + steps.join(' ') + ' ' + excerpt.join(' ')).toLowerCase();
    const key = rule + '|' + url + '|' + msg.slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ rule, url, route: pathOf(url), msg, sev: String(f.severity ?? ''), confidence: f.confidence ?? null });
  }
  return findings;
}

const ruleHas = (f, s) => f.rule.toLowerCase().includes(s);
const msgHas = (f, s) => f.msg.includes(s);
function onRoute(f, r) {
  if (r === '/') return f.route === '/';
  return f.route === r || f.url.includes(r) || f.msg.includes(r);
}

export const MATCHERS = {
  B01: (f) => onRoute(f, '/missing') && (ruleHas(f, 'network') || ruleHas(f, 'broken') || ruleHas(f, 'dead') || ruleHas(f, 'route') || ruleHas(f, 'http')),
  B02: (f) => onRoute(f, '/crash') && (ruleHas(f, 'network') || ruleHas(f, 'broken') || ruleHas(f, 'crash') || ruleHas(f, 'route') || ruleHas(f, 'http') || ruleHas(f, 'server-error')),
  B03: (f) => (onRoute(f, '/dead') || msgHas(f, '/dead')) && (ruleHas(f, 'dead') || ruleHas(f, 'link') || ruleHas(f, 'broken') || ruleHas(f, 'network')),
  B04: (f) => msgHas(f, 'nonexistent-sniff-test-xyz.invalid') || (ruleHas(f, 'link') && msgHas(f, 'invalid')),
  B05: (f) => (ruleHas(f, 'console') || ruleHas(f, 'exception') || ruleHas(f, 'pageerror') || ruleHas(f, 'uncaught') || ruleHas(f, 'js-error')) && (msgHas(f, 'renderwelcomebanner') || onRoute(f, '/dashboard')),
  B06: (f) => onRoute(f, '/api/stats') || (onRoute(f, '/dashboard') && ruleHas(f, 'network') && msgHas(f, '500')),
  B07: (f) => onRoute(f, '/orders') && (ruleHas(f, 'empty') || ruleHas(f, 'no-data') || ruleHas(f, 'no-rows')),
  B08: (f) => msgHas(f, 'test@test.com') || (onRoute(f, '/profile') && (ruleHas(f, 'placeholder') || ruleHas(f, 'fake') || ruleHas(f, 'mock') || ruleHas(f, 'lorem'))),
  B09: (f) => onRoute(f, '/signup') && (ruleHas(f, 'submit') || ruleHas(f, 'noop') || ruleHas(f, 'no-op') || ruleHas(f, 'dead-button') || ruleHas(f, 'unresponsive') || ruleHas(f, 'form-broken') || ruleHas(f, 'inert')),
  B10: (f) => onRoute(f, '/signup') && (ruleHas(f, 'validation') || ruleHas(f, 'no-validation') || ruleHas(f, 'invalid-accepted')),
  B11: (f) => onRoute(f, '/wizard') && (ruleHas(f, 'state-loss') || ruleHas(f, 'state-lost') || ruleHas(f, 'not-preserved') || ruleHas(f, 'wiped')),
  B12: (f) => onRoute(f, '/wizard') && (ruleHas(f, 'dead-end') || ruleHas(f, 'regression') || ruleHas(f, 'stuck') || ruleHas(f, 'unreachable') || ruleHas(f, 'no-way-forward')),
  B13: (f) => onRoute(f, '/dashboard') && (ruleHas(f, 'spinner') || ruleHas(f, 'stuck-loading') || ruleHas(f, 'infinite-load') || ruleHas(f, 'hung') || ruleHas(f, 'hang') || ruleHas(f, 'loading')),
  B14: (f) => onRoute(f, '/dashboard') && (ruleHas(f, 'error-state') || ruleHas(f, 'missing-error') || ruleHas(f, 'silent-failure')),
  B15: (f) => onRoute(f, '/checkout') && (ruleHas(f, 'no-success') || ruleHas(f, 'no-feedback') || ruleHas(f, 'silent') || ruleHas(f, 'async-outcome') || ruleHas(f, 'no-confirmation')),
  B16: (f) => onRoute(f, '/wide') && (ruleHas(f, 'overflow') || ruleHas(f, 'responsive') || ruleHas(f, 'horizontal-scroll')),
  B17: (f) => onRoute(f, '/wide') && (ruleHas(f, 'target-size') || ruleHas(f, 'tap-target') || ruleHas(f, 'touch-target') || ruleHas(f, 'target_size')),
  B18: (f) => onRoute(f, '/') && (ruleHas(f, 'image-alt') || ruleHas(f, 'image_alt') || ruleHas(f, 'missing-alt')),
  B19: (f) => onRoute(f, '/signup') && (ruleHas(f, 'label') || ruleHas(f, 'aria-input-field-name') || ruleHas(f, 'accessible-name')),
  B20: (f) => onRoute(f, '/') && ruleHas(f, 'contrast'),
  B21: (f) => onRoute(f, '/') && (ruleHas(f, 'unclear') || ruleHas(f, 'buried') || ruleHas(f, 'prominence') || ruleHas(f, 'discoverab') || ruleHas(f, 'low-affordance')),
};

export function scoreReport(report, manifest) {
  const rawFindings = [];
  collectFindings(report.findings ?? report, rawFindings);
  const findings = normalize(rawFindings);

  const bugs = manifest.bugs;
  const found = {};
  const matchedIdx = new Set();
  for (const bug of bugs) {
    const matcher = MATCHERS[bug.id];
    let hit = false;
    findings.forEach((f, i) => { if (matcher && matcher(f)) { hit = true; matchedIdx.add(i); } });
    found[bug.id] = hit;
  }

  const cleanRoutes = new Set(manifest.cleanRoutes ?? ['/clean']);
  const hardFP = findings.filter((f) => cleanRoutes.has(f.route));
  const tpFindings = matchedIdx.size;
  const candidateFP = findings.filter((_, i) => !matchedIdx.has(i));
  const tpBugs = bugs.filter((b) => found[b.id]);
  const fnBugs = bugs.filter((b) => !found[b.id]);
  const recall = tpBugs.length / bugs.length;
  const precision = tpFindings + candidateFP.length === 0 ? 0 : tpFindings / (tpFindings + candidateFP.length);

  return {
    totalFindingsRaw: rawFindings.length,
    totalFindingsDeduped: findings.length,
    plantedBugs: bugs.length,
    found: tpBugs.length,
    missed: fnBugs.length,
    recall: Number(recall.toFixed(3)),
    matchedFindings: tpFindings,
    candidateFalsePositives: candidateFP.length,
    candidateFalsePositiveList: candidateFP.map((f) => ({ rule: f.rule, route: f.route, msg: f.msg.slice(0, 90) })),
    hardFalsePositivesOnCleanPage: hardFP.length,
    hardFalsePositiveList: hardFP.map((f) => ({ rule: f.rule, msg: f.msg.slice(0, 90) })),
    precisionProxy: Number(precision.toFixed(3)),
    missedBugIds: fnBugs.map((b) => b.id),
    foundBugIds: tpBugs.map((b) => b.id),
    perBug: bugs.map((b) => ({ id: b.id, issueClass: b.issueClass, name: b.name, route: b.route, found: found[b.id] })),
  };
}
