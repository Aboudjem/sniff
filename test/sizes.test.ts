// One set of size figures everywhere. 0.9.2 said 365 MB in the MCP payload,
// "about 200 MB" and "about 165 MB" in doctor, and 720 MB in the README.
// The figures now live in src/core/sizes.ts; this test holds the docs and the
// code to them.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BROWSER_SIZE,
  ENGINE_SIZE,
  describeSize,
  setupSize,
} from "../src/core/sizes.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
  });
}

describe("download sizes", () => {
  const first = setupSize(["chromium"], true);

  it("the first-run total is the engine plus Chromium", () => {
    expect(first).toEqual({
      downloadMb: ENGINE_SIZE.downloadMb + BROWSER_SIZE.chromium.downloadMb,
      diskMb: ENGINE_SIZE.diskMb + BROWSER_SIZE.chromium.diskMb,
    });
    expect(describeSize(first)).toBe(
      `about ${first.downloadMb} MB to download, about ${first.diskMb} MB on disk`,
    );
  });

  it("no source file states a size of its own", () => {
    const offenders = sourceFiles(join(ROOT, "src"))
      .filter((p) => !p.endsWith(join("core", "sizes.ts")))
      .filter((p) => /about \d+ ?MB|installSizeMb: \d+|\b(165|365)\b.*MB/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("the README states the same labelled first-run figures", () => {
    const readme = read("README.md");
    expect(readme).toContain(
      `about ${first.downloadMb} MB to download and about ${first.diskMb} MB on disk`,
    );
    expect(readme).toContain(
      `about ${first.downloadMb} MB, then about ${first.diskMb} MB on disk`,
    );
    expect(readme).not.toMatch(/\b72[01] MB\b/);
  });

  it("the agent docs state the per-part figures", () => {
    for (const doc of ["AGENTS.md", "llms.txt", "docs/faq.md"]) {
      const text = read(doc).replace(/\s+/g, " ");
      expect(text, doc).toContain(`about ${ENGINE_SIZE.downloadMb} MB to download`);
      expect(text, doc).toContain(`about ${BROWSER_SIZE.chromium.downloadMb} MB to download`);
      expect(text, doc).toContain(`about ${BROWSER_SIZE.chromium.diskMb} MB on disk`);
      expect(text, doc).not.toMatch(/about 200 MB|about 165 MB|~200 MB|~165 MB/);
    }
  });
});
