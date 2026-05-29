#!/usr/bin/env node
// Score a sniff JSON report against the planted-bug fixture ground truth.
// Usage: node score-fixture.mjs <report.json> [--manifest <path>] [--json]
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { scoreReport } from './score-lib.mjs';

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
const s = scoreReport(report, manifest);

if (asJson) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }

console.log(`\n  Scoring ${reportPath} vs ${s.plantedBugs} planted bugs\n`);
console.log(`  Recall:    ${s.found}/${s.plantedBugs}  (${(s.recall * 100).toFixed(0)}%)`);
console.log(`  Findings:  ${s.totalFindingsDeduped} deduped (${s.totalFindingsRaw} raw)`);
console.log(`  Matched:   ${s.matchedFindings}   Candidate FP: ${s.candidateFalsePositives}   Precision proxy: ${(s.precisionProxy * 100).toFixed(0)}%`);
console.log(`  Hard FP on clean page (/clean): ${s.hardFalsePositivesOnCleanPage}`);
console.log(`\n  Per-bug:`);
for (const b of s.perBug) {
  console.log(`    ${b.found ? 'FOUND ' : 'MISS  '} ${b.id} [class ${b.issueClass}] ${b.name} (${b.route})`);
}
if (s.hardFalsePositiveList.length) {
  console.log(`\n  Hard false positives on /clean:`);
  for (const f of s.hardFalsePositiveList.slice(0, 15)) console.log(`    - ${f.rule}: ${f.msg}`);
}
if (s.candidateFalsePositiveList.length) {
  console.log(`\n  Candidate false positives:`);
  for (const f of s.candidateFalsePositiveList.slice(0, 20)) console.log(`    - ${f.rule} @ ${f.route}: ${f.msg}`);
}
console.log('');
