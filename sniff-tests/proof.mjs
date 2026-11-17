#!/usr/bin/env node
// Re-prints the numbers the README quotes. Starts the planted-bug fixture app,
// walks it with the built CLI, then scores the report against MANIFEST.json.
// Usage: npm run build && npm run proof
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CLI = join(ROOT, "dist", "cli", "index.js");

function startServer() {
  return new Promise((resolve, reject) => {
    const srv = spawn(
      process.execPath,
      [join(HERE, "planted-bugs", "server.mjs"), "0"],
      {
        stdio: ["ignore", "pipe", "inherit"],
      },
    );
    const timer = setTimeout(
      () => reject(new Error("fixture server did not start in 10s")),
      10000,
    );
    srv.stdout.on("data", (buf) => {
      const m = String(buf).match(/SNIFF_FIXTURE_LISTENING (\S+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ srv, url: m[1] });
      }
    });
    srv.on("error", reject);
  });
}

const { srv, url } = await startServer();
const work = mkdtempSync(join(tmpdir(), "sniff-proof-"));
console.log(`Walking the planted-bug fixture at ${url} (about a minute)...`);
const walk = spawnSync(
  process.execPath,
  [CLI, "--url", url, "--json", "--all", "--fail-on", "none"],
  {
    cwd: work,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);
srv.kill("SIGTERM");
if (walk.status !== 0) {
  process.stderr.write(walk.stderr);
  console.error(`The walk exited ${walk.status}. Did you run npm run build?`);
  process.exit(1);
}
const reportPath = join(work, "report.json");
writeFileSync(reportPath, walk.stdout);
const score = spawnSync(
  process.execPath,
  [join(HERE, "score-fixture.mjs"), reportPath],
  { stdio: "inherit" },
);
process.exit(score.status ?? 1);
