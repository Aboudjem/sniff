#!/usr/bin/env node
// Dev harness: run the new crawl engine against a URL, write the JSON report,
// and print the readable summary. Used during the rebuild to iterate against
// the planted-bug fixture. Usage: node run-crawl.mjs [url] [outPath]
import { runCrawl, formatReportText } from '../dist/index.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const url = process.argv[2] || 'http://localhost:4321';
const out = process.argv[3] || 'docs/audit/green/crawl.json';
mkdirSync(dirname(out), { recursive: true });

const report = await runCrawl({
  startUrl: url,
  maxPages: 25,
  headless: true,
  includeMobile: true,
  outputDir: 'docs/audit/green/screens',
  onProgress: (m) => process.stderr.write(`  · ${m}\n`),
});

writeFileSync(out, JSON.stringify(report, null, 2));
console.log(formatReportText(report, { all: true }));
console.error(`\nwrote ${out} (${report.findings.length} findings, ${report.stats.durationMs}ms)`);
