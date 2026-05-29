#!/usr/bin/env node
// Minimal MCP stdio smoke: spawn the sniff MCP server, do the JSON-RPC
// handshake, call the unified `sniff` tool in mode:"walk" against a URL, and
// assert it returns findings. Proves the MCP/editor path works end-to-end.
// Usage: node mcp-smoke.mjs [url] [maxPages]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.argv[2] || 'http://localhost:4321';
const maxPages = Number(process.argv[3] || 6);

const srv = spawn('node', [join(ROOT, 'dist', 'cli', 'index.js'), '--mcp'], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map();
let nextId = 1;
let buf = '';

srv.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, resolve);
    srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout on ${method}`)); } }, 120000);
  });
}
function notify(method, params) {
  srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}

try {
  const init = await rpc('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'sniff-mcp-smoke', version: '0.0.0' },
  });
  if (!init.result?.serverInfo) throw new Error('initialize failed: ' + JSON.stringify(init));
  notify('notifications/initialized', {});

  const tools = await rpc('tools/list', {});
  const names = (tools.result?.tools ?? []).map((t) => t.name);
  if (!names.includes('sniff')) throw new Error('sniff tool not listed: ' + names.join(','));

  const res = await rpc('tools/call', {
    name: 'sniff',
    arguments: { mode: 'walk', rootDir: ROOT, baseUrl: url, maxPages, mobile: false },
  });
  const text = res.result?.content?.[0]?.text ?? '';
  const payload = JSON.parse(text);
  const findings = payload.findings ?? [];
  console.log(`MCP walk returned ${findings.length} findings across ${payload.stats?.pagesVisited} pages`);
  if (payload.needsSetup) throw new Error('needsSetup returned — install chromium first');
  if (findings.length < 4) throw new Error(`expected >=4 findings, got ${findings.length}`);
  console.log('MCP_SMOKE_OK tools=[' + names.join(', ') + ']');
  srv.kill('SIGTERM');
  process.exit(0);
} catch (e) {
  console.error('MCP_SMOKE_FAIL:', e.message);
  srv.kill('SIGTERM');
  process.exit(1);
}
