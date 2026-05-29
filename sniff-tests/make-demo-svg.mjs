#!/usr/bin/env node
// Render a captured terminal transcript into a self-contained, animated,
// GitHub-safe SVG "terminal cast" (no <script>, no external refs; SMIL reveal).
// Lines are revealed one at a time, then the frame holds. Real output only.
// Usage: node make-demo-svg.mjs <input.txt> <output.svg>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) { console.error('usage: make-demo-svg.mjs <input.txt> <output.svg>'); process.exit(2); }

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const raw = readFileSync(inPath, 'utf8').replace(/\r/g, '').split('\n');
const MAXW = 92;
const lines = raw.map((l) => (l.length > MAXW ? l.slice(0, MAXW - 1) + '…' : l));

const PAD = 22, TOP = 56, LH = 21, CW = 8.4, FS = 14.5;
const W = Math.min(980, Math.max(640, PAD * 2 + MAXW * CW));
const H = TOP + lines.length * LH + PAD;
const STEP = 0.22; // seconds between line reveals

// crude ANSI -> color (handles the few colors picocolors emits); strip the rest
function colorFor(line) {
  if (/CRITICAL|critical|✗|FAIL/.test(line)) return '#ff5c7a';
  if (/HIGH|high/.test(line)) return '#ff8a5c';
  if (/MEDIUM|medium/.test(line)) return '#ffd166';
  if (/LOW|low|uncertain/.test(line)) return '#94a3b8';
  if (/^\s*\$|sniff |walking|npx /.test(line)) return '#8ab4ff';
  if (/✓|FOUND|100%|21\/21|fix:/.test(line)) return '#34d399';
  if (/^\s*•|route|\/[a-z]/.test(line)) return '#cbd5e1';
  return '#aeb6c7';
}

const body = lines.map((l, i) => {
  const y = TOP + i * LH;
  const begin = (i * STEP).toFixed(2);
  return `  <text x="${PAD}" y="${y}" fill="${colorFor(l)}" opacity="0">${esc(l) || ' '}<animate attributeName="opacity" from="0" to="1" begin="${begin}s" dur="0.18s" fill="freeze"/></text>`;
}).join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${FS}">
  <rect x="0" y="0" width="${W}" height="${H}" rx="12" fill="#0b0e14"/>
  <rect x="0" y="0" width="${W}" height="34" rx="12" fill="#11151f"/>
  <rect x="0" y="22" width="${W}" height="12" fill="#11151f"/>
  <circle cx="20" cy="17" r="6" fill="#ff5f57"/><circle cx="40" cy="17" r="6" fill="#febc2e"/><circle cx="60" cy="17" r="6" fill="#28c840"/>
  <text x="${W / 2}" y="21" fill="#5b6275" text-anchor="middle" font-size="12">sniff — autonomous QA walk</text>
${body}
</svg>`;

writeFileSync(outPath, svg);
console.log(`wrote ${outPath} (${lines.length} lines, ${W}x${H})`);
