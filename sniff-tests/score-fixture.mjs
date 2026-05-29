#!/usr/bin/env node
// Score a sniff JSON report against the planted-bug fixture ground truth.
// Usage: node score-fixture.mjs <report.json> [--manifest <path>] [--json]
//
// Computes recall (planted bugs found / 21), a precision proxy, hard false
// positives (any finding on the clean control page), and a per-class table.
// Works on both the legacy unified report and the new engine report by
// normalizing every finding to { rule, sev, url, route, msg, confidence }.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const reportPath = args.find((a) => !a.startsWith('--'));
const manifestPath =
  (args.includes('--manifest') ? args[args.indexOf('--manifest') + 1] : null) ??
  join(__dirname, 'planted-bugs', 'MANIFEST.json');
const asJson = args.includes('--json');

if (!reportPath) {
  console.error('usage: node score-fixture.mjs <report.json> [--manifest <path>] [--json]');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(resolve(manifestPath), 'utf8'));
const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));

// ── Flatten every finding-like object anywhere in the report ──────────────
function collectFindings(node, out) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) { for (const x of node) collectFindings(x, out); return; }
  const rule = node.ruleId ?? node.id ?? node.rule ?? node.kind;
  const hasLoc = 'url' in node || 'route' in node || 'filePath' in node;
  if (typeof rule === 'string' && (hasLoc || 'message' in node || 'title' in node)) {
    out.push(node);
  }
  for (const k of Object.keys(node)) {
    // avoid recursing into obviously non-finding string blobs
    if (typeof node[k] === 'object') collectFindings(node[k], out);
  }
}

function pathOf(u) {
  if (!u || typeof u !== 'string') return '';
  try { return new URL(u, 'http://localhost').pathname.replace(/\/+$/, '') || '/'; }
  catch { return u; }
}

const rawFindings = [];
collectFindings(report.findings ?? report, rawFindings);

// de-dupe identical (rule+url+message) tuples so per-viewport duplication does
// not distort the precision proxy
const seen = new Set();
const findings = [];
for (const f of rawFindings) {
  const rule = String(f.ruleId ?? f.id ?? f.rule ?? f.kind ?? '');
  const url = String(f.url ?? f.route ?? f.filePath ?? '');
  const msg = String(f.message ?? f.title ?? '') + ' ' + String(f.snippet ?? f.evidence ?? '') +
              ' ' + (Array.isArray(f.steps) ? f.steps.join(' ') : '');
  const key = rule + '|' + url + '|' + msg.slice(0, 120);
  if (seen.has(key)) continue;
  seen.add(key);
  findings.push({
    rule, url, route: pathOf(url), msg: msg.toLowerCase(),
    sev: String(f.severity ?? ''), confidence: f.confidence ?? null, raw: f,
  });
}

// Rule-id-centric matching: class-of-bug words are matched against the
// finding's RULE ID (which the engine controls), never against free message
// text — that prevents false credit when an unrelated finding's message or
// snippet happens to echo a fixture identifier (e.g. axe's "non-empty title",
// a CSS class name, or an aria-label). `msgHas` is reserved for genuine data
// literals that only a correct detector would surface (test@test.com, the
// invalid external host, the thrown function name).
const ruleHas = (f, s) => f.rule.toLowerCase().includes(s);
const msgHas = (f, s) => f.msg.includes(s);
function onRoute(f, r) {
  if (r === '/') return f.route === '/'; // exact; every url "includes" '/'
  return f.route === r || f.url.includes(r) || f.msg.includes(r);
}

// ── Per-bug matchers (route + rule-id signal) ─────────────────────────────
const MATCHERS = {
  B01: (f) => onRoute(f, '/missing') && (ruleHas(f, 'network') || ruleHas(f, 'broken') || ruleHas(f, 'dead') || ruleHas(f, 'route') || ruleHas(f, 'http')),
  B02: (f) => onRoute(f, '/crash') && (ruleHas(f, 'network') || ruleHas(f, 'broken') || ruleHas(f, 'crash') || ruleHas(f, 'route') || ruleHas(f, 'http') || ruleHas(f, 'server-error')),
  B03: (f) => (onRoute(f, '/dead') || msgHas(f, '/dead')) && (ruleHas(f, 'dead') || ruleHas(f, 'link') || ruleHas(f, 'broken') || ruleHas(f, 'network')),
  B04: (f) => msgHas(f, 'nonexistent-sniff-test-xyz.invalid') || (ruleHas(f, 'link') && msgHas(f, 'invalid')),
  B05: (f) => (ruleHas(f, 'console') || ruleHas(f, 'exception') || ruleHas(f, 'pageerror') || ruleHas(f, 'uncaught') || ruleHas(f, 'js-error')) &&
              (msgHas(f, 'renderwelcomebanner') || onRoute(f, '/dashboard')),
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

const bugs = manifest.bugs;
const found = {};
const matchedFindingIdx = new Set();
for (const bug of bugs) {
  const matcher = MATCHERS[bug.id];
  let hit = false;
  findings.forEach((f, i) => {
    if (matcher && matcher(f)) { hit = true; matchedFindingIdx.add(i); }
  });
  found[bug.id] = hit;
}

const cleanRoutes = new Set(manifest.cleanRoutes ?? ['/clean']);
const hardFP = findings.filter((f) => cleanRoutes.has(f.route));
const tpFindings = [...matchedFindingIdx].length;
const candidateFP = findings.filter((_, i) => !matchedFindingIdx.has(i));

const tpBugs = bugs.filter((b) => found[b.id]);
const fnBugs = bugs.filter((b) => !found[b.id]);
const recall = tpBugs.length / bugs.length;
// precision proxy: how much of the output is on-target (matched a planted bug)
const precision = tpFindings + candidateFP.length === 0
  ? 0 : tpFindings / (tpFindings + candidateFP.length);

const summary = {
  report: reportPath,
  totalFindingsRaw: rawFindings.length,
  totalFindingsDeduped: findings.length,
  plantedBugs: bugs.length,
  found: tpBugs.length,
  missed: fnBugs.length,
  recall: Number(recall.toFixed(3)),
  matchedFindings: tpFindings,
  candidateFalsePositives: candidateFP.length,
  hardFalsePositivesOnCleanPage: hardFP.length,
  precisionProxy: Number(precision.toFixed(3)),
  missedBugIds: fnBugs.map((b) => b.id),
  foundBugIds: tpBugs.map((b) => b.id),
};

if (asJson) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }

console.log(`\n  Scoring ${reportPath} vs ${bugs.length} planted bugs\n`);
console.log(`  Recall:    ${tpBugs.length}/${bugs.length}  (${(recall * 100).toFixed(0)}%)`);
console.log(`  Findings:  ${findings.length} deduped (${rawFindings.length} raw)`);
console.log(`  Matched:   ${tpFindings}   Candidate FP: ${candidateFP.length}   Precision proxy: ${(precision * 100).toFixed(0)}%`);
console.log(`  Hard FP on clean page (/clean): ${hardFP.length}`);
console.log(`\n  Per-bug:`);
for (const b of bugs) {
  console.log(`    ${found[b.id] ? 'FOUND ' : 'MISS  '} ${b.id} [class ${b.issueClass}] ${b.name} (${b.route})`);
}
if (hardFP.length) {
  console.log(`\n  Hard false positives on /clean:`);
  for (const f of hardFP.slice(0, 15)) console.log(`    - ${f.rule}: ${f.msg.slice(0, 90)}`);
}
console.log('');
