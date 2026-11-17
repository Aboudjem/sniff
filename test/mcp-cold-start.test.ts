// The MCP handshake must not need the browser engine. On a cold machine the
// engine is not installed yet (it is an optional peer, downloaded once by
// sniff_install), and a client gives a server about 30 s to connect.
import { describe, it, expect, vi } from "vitest";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// vi.mock is hoisted above every other statement, so each factory is inline.
vi.mock("playwright", () => {
  throw new Error("playwright was imported during the MCP handshake");
});
vi.mock("playwright-core", () => {
  throw new Error("playwright-core was imported during the MCP handshake");
});
vi.mock("@axe-core/playwright", () => {
  throw new Error("@axe-core/playwright was imported during the MCP handshake");
});
vi.mock("lighthouse", () => {
  throw new Error("lighthouse was imported during the MCP handshake");
});
vi.mock("chrome-launcher", () => {
  throw new Error("chrome-launcher was imported during the MCP handshake");
});

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BIN = join(ROOT, "dist", "cli", "index.js");

describe("MCP cold start", () => {
  it("answers initialize and tools/list without loading any engine package (in process)", async () => {
    const { Client } =
      await import("@modelcontextprotocol/sdk/client/index.js");
    const { InMemoryTransport } =
      await import("@modelcontextprotocol/sdk/inMemory.js");
    const { startMcpServer } = await import("../src/mcp/server.js");
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await startMcpServer(undefined, serverTransport);
    const client = new Client(
      { name: "cold-start", version: "0" },
      { capabilities: {} },
    );
    await client.connect(clientTransport);
    expect(client.getServerVersion()?.name).toBe("sniff");
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("sniff_install");
    await client.close();
  });

  // The built CLI is what `npx -y sniff-qa --mcp` runs. A module hook makes
  // every engine package unresolvable, as on a machine that never ran
  // sniff_install. CI builds before it tests; a bare local `npm test` without
  // a build skips this case with the reason.
  const built = existsSync(BIN);
  if (!built && process.env.CI)
    throw new Error(
      "dist/cli/index.js is missing: run `npm run build` before the tests in CI",
    );
  it.skipIf(!built)(
    "the built `sniff-qa --mcp` answers initialize with the engine unresolvable",
    async () => {
      const hook = [
        `const blocked = new Set(${JSON.stringify(["playwright", "playwright-core", "@axe-core/playwright", "lighthouse", "chrome-launcher"])});`,
        "export async function resolve(specifier, context, next) {",
        "  const base = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];",
        "  if (blocked.has(base)) { const e = new Error(`Cannot find package '${specifier}' (blocked by test)`); e.code = 'ERR_MODULE_NOT_FOUND'; throw e; }",
        "  return next(specifier, context);",
        "}",
      ].join("\n");
      const register = `import { register } from 'node:module'; register(${JSON.stringify("data:text/javascript," + encodeURIComponent(hook))});`;
      const child = spawn(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(register)}`,
          BIN,
          "--mcp",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            SNIFF_ENGINE_DIR: join(ROOT, "node_modules", ".no-such-engine"),
          },
        },
      );
      const started = Date.now();
      let out = "";
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      const responses: Array<{
        id?: number;
        result?: {
          serverInfo?: { name: string };
          tools?: Array<{ name: string }>;
        };
      }> = [];
      const done = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`no answer in 15 s. stderr: ${err}`)),
          15_000,
        );
        child.stdout.on("data", (d) => {
          out += d;
          const lines = out.split("\n");
          out = lines.pop() ?? "";
          for (const line of lines)
            if (line.trim()) responses.push(JSON.parse(line));
          if (responses.some((r) => r.id === 2)) {
            clearTimeout(timer);
            resolve();
          }
        });
        child.on("exit", (code) =>
          reject(new Error(`server exited (${code}). stderr: ${err}`)),
        );
      });
      const send = (msg: object) =>
        child.stdin.write(JSON.stringify(msg) + "\n");
      send({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "t", version: "0" },
        },
      });
      send({ jsonrpc: "2.0", method: "notifications/initialized" });
      send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      try {
        await done;
      } finally {
        child.kill();
      }
      expect(responses.find((r) => r.id === 1)?.result?.serverInfo?.name).toBe(
        "sniff",
      );
      expect(
        responses.find((r) => r.id === 2)?.result?.tools?.map((t) => t.name),
      ).toEqual([
        "sniff",
        "sniff_scan",
        "sniff_run",
        "sniff_discover",
        "sniff_install",
        "sniff_report",
      ]);
      expect(Date.now() - started).toBeLessThan(15_000);
    },
    20_000,
  );
});
