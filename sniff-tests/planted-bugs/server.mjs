#!/usr/bin/env node
// Zero-dependency fixture server for the sniff planted-bug fixture.
// Serves a small multi-page app with 21 deliberately planted QA bugs spanning
// all 12 sniff issue classes, plus a clean control page. See MANIFEST.json.
//
// Usage: node server.mjs [port]   (default port 4321; pass 0 for a random port)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, 'public');
const PORT = process.argv[2] !== undefined ? Number(process.argv[2]) : 4321;

const PAGES = new Set([
  'index', 'orders', 'profile', 'signup', 'wizard',
  'dashboard', 'checkout', 'wide', 'clean',
]);

async function serveFile(res, name, type = 'text/html; charset=utf-8') {
  try {
    const body = await readFile(join(PUBLIC, name));
    res.writeHead(200, { 'content-type': type });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1>');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  let path = url.pathname.replace(/\/+$/, '') || '/';

  // ── Dynamic API endpoints ──────────────────────────────────────────
  if (path === '/api/stats') {
    // B06: failed network request — 500 (dashboard relies on this)
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal error' }));
    return;
  }
  if (path === '/api/hang') {
    // B13: hung request that never resolves (drives the infinite spinner).
    // Hold the socket; destroy after 25s so we don't leak during a scan.
    setTimeout(() => { try { res.destroy(); } catch {} }, 25000);
    return;
  }
  if (path === '/api/checkout' && req.method === 'POST') {
    // B15: succeeds on the wire, but the client never renders success → silent async.
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, orderId: 'ord_123' }));
    }, 300);
    return;
  }
  if (path === '/api/missing') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  // ── Pages ──────────────────────────────────────────────────────────
  if (path === '/') return serveFile(res, 'index.html');
  if (path === '/crash') {
    // B02: broken page — 500 with a raw stack trace shown to the user.
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<pre>Error: Cannot read properties of undefined (reading \'render\')\n    at CrashPage (/app/crash.js:42:18)\n    at renderRoot (/app/runtime.js:88:7)</pre>');
    return;
  }
  if (path === '/styles.css') return serveFile(res, 'styles.css', 'text/css; charset=utf-8');

  const name = path.slice(1);
  if (PAGES.has(name)) return serveFile(res, `${name}.html`);

  // Everything else (e.g. /missing, /dead) → 404 (planted broken routes/links).
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  res.end('<h1>404 Not Found</h1><p>No such page.</p>');
});

server.listen(PORT, () => {
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : PORT;
  // Machine-readable line for scripts to grab the port:
  console.log(`SNIFF_FIXTURE_LISTENING http://localhost:${port}`);
});

// Graceful shutdown so CI / scripts can kill it cleanly.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { server.close(() => process.exit(0)); });
}
