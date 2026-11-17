// Times how long a brand-new machine waits for the MCP server to answer
// `initialize`: `npx -y sniff-qa@<version> --mcp` with an empty npm cache, so
// npm downloads the package and its dependencies the way a first-time user's
// would. Claude Code gives a server 30 s to connect (MCP_TIMEOUT).
//
//   npm run cold-start                 # the version in package.json, 3 runs
//   npm run cold-start -- 0.9.0 5      # another version, 5 runs
//
// It needs the network and the version published on npm.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, "..", "package.json"), "utf8"));
const version = process.argv[2] || pkg.version;
const runs = Number(process.argv[3] || 3);
const LIMIT_S = 300;

function once() {
  const cache = mkdtempSync(join(tmpdir(), "sniff-cold-cache-"));
  const cwd = mkdtempSync(join(tmpdir(), "sniff-cold-cwd-"));
  return new Promise((resolve) => {
    const started = Date.now();
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(npx, ["-y", `sniff-qa@${version}`, "--mcp"], {
      cwd,
      env: { ...process.env, npm_config_cache: cache, npm_config_update_notifier: "false" },
      stdio: ["pipe", "pipe", "pipe"],
      shell: process.platform === "win32",
    });
    let out = "";
    const finish = (result) => {
      clearTimeout(timer);
      child.kill();
      rmSync(cache, { recursive: true, force: true });
      rmSync(cwd, { recursive: true, force: true });
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, secs: LIMIT_S }), LIMIT_S * 1000);
    child.stdout.on("data", (d) => {
      out += d;
      if (/"id":1\b/.test(out)) finish({ ok: true, secs: (Date.now() - started) / 1000 });
    });
    child.on("exit", () => finish({ ok: false, secs: (Date.now() - started) / 1000 }));
    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cold-start", version: "1" } },
      }) + "\n",
    );
  });
}

const times = [];
for (let i = 1; i <= runs; i++) {
  const r = await once();
  console.log(`run ${i}: ${r.ok ? `initialize answered in ${r.secs.toFixed(1)} s` : `no answer (${r.secs.toFixed(1)} s)`}`);
  if (r.ok) times.push(r.secs);
}
times.sort((a, b) => a - b);
const median = times.length ? times[Math.floor(times.length / 2)] : NaN;
console.log(
  `sniff-qa@${version} cold MCP start: median ${median.toFixed(1)} s, range ${times[0]?.toFixed(1)} to ${times.at(-1)?.toFixed(1)} s, ` +
    `${times.filter((t) => t < 30).length}/${runs} under the 30 s connect timeout`,
);
