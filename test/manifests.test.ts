import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCaps, resolveTools } from "../src/mcp/caps.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), "utf8"));
const text = (f: string) => readFileSync(join(ROOT, f), "utf8");

const VERSION: string = json("package.json").version;

describe("version parity", () => {
  it("every manifest carries the package.json version", () => {
    expect(json("package-lock.json").version).toBe(VERSION);
    expect(json("package-lock.json").packages[""].version).toBe(VERSION);
    expect(json("server.json").version).toBe(VERSION);
    expect(json("gemini-extension.json").version).toBe(VERSION);
    for (const f of [
      ".claude-plugin/plugin.json",
      ".cursor-plugin/plugin.json",
      ".copilot-plugin/plugin.json",
    ]) {
      expect(json(f).version, f).toBe(VERSION);
    }
  });

  it("the registry entry installs the same npm package and version", () => {
    const server = json("server.json");
    expect(server.name).toBe(json("package.json").mcpName);
    expect(server.packages).toEqual([
      expect.objectContaining({
        registryType: "npm",
        identifier: "sniff-qa",
        version: VERSION,
        transport: { type: "stdio" },
      }),
    ]);
    expect(server.description.length).toBeLessThanOrEqual(100);
  });

  it("every shipped MCP launcher pins the released package", () => {
    const pinned = ["-y", `sniff-qa@${VERSION}`, "--mcp"];
    expect(json(".mcp.json").mcpServers.sniff.args).toEqual(pinned);
    expect(json("gemini-extension.json").mcpServers.sniff.args).toEqual(pinned);
    expect(json(".cursor-plugin/plugin.json").mcp.args).toEqual(pinned);
    expect(json(".copilot-plugin/plugin.json").mcp.args).toEqual(pinned);
  });

  it("the CHANGELOG has an entry for this version", () => {
    expect(text("CHANGELOG.md")).toMatch(
      new RegExp(
        `^## \\[${VERSION.replace(/\./g, "\\.")}\\] - \\d{4}-\\d{2}-\\d{2}$`,
        "m",
      ),
    );
  });
});

describe("docs list the real MCP tools", () => {
  it("names every default MCP tool in the README", () => {
    const readme = text("README.md");
    for (const tool of resolveTools(parseCaps([])).tools) {
      expect(readme, tool).toContain(`\`${tool}\``);
    }
  });
});
