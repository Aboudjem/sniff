import { describe, it, expect, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ENGINE_PACKAGES,
  EngineMissingError,
  engineDependencies,
  engineDir,
  engineInstallCommand,
  engineInstalledAt,
  engineStatus,
  findPackageDir,
  installEngine,
  loadEngine,
  npmChildEnv,
  playwrightCliPath,
  sweepStaleEngineTemps,
  isPidAlive,
  STALE_TEMP_MS,
  type NpmRunner,
} from "../src/core/engine.js";
import { utimesSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { getVersion } from "../src/version.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const temps: string[] = [];
function tempDir(): string {
  const d = mkdtempSync(join(tmpdir(), "sniff-engine-"));
  temps.push(d);
  return d;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop()!, { recursive: true, force: true });
});

/** A fake engine folder: load.mjs, a marker, and one ESM package per name. */
function fakeEngineDir(names: readonly string[], complete = true): string {
  const dir = tempDir();
  writeFileSync(
    join(dir, "load.mjs"),
    "export function load(name) { return import(name); }\n",
  );
  for (const name of names) {
    const p = join(dir, "node_modules", ...name.split("/"));
    mkdirSync(p, { recursive: true });
    writeFileSync(
      join(p, "package.json"),
      JSON.stringify({
        name,
        version: "0.0.0-fake",
        type: "module",
        main: "index.js",
        bin: { playwright: "cli.js" },
      }),
    );
    writeFileSync(
      join(p, "index.js"),
      `export const from = 'engine-dir'; export const name = ${JSON.stringify(name)};\n`,
    );
    writeFileSync(join(p, "cli.js"), "");
  }
  if (complete) writeFileSync(join(dir, ".sniff-engine-complete"), "test\n");
  return dir;
}

function notFound(name: string): Error {
  return Object.assign(
    new Error(`Cannot find package '${name}' imported from /x/dist/chunk.js`),
    {
      code: "ERR_MODULE_NOT_FOUND",
    },
  );
}

describe("engine packages stay out of the install that the MCP handshake needs", () => {
  it("every engine package is in engineDependencies and devDependencies with one range, never a dependency or peer", () => {
    for (const name of ENGINE_PACKAGES) {
      expect(
        pkg.dependencies?.[name],
        `${name} in dependencies`,
      ).toBeUndefined();
      // A peer, even an optional one, makes npm fetch its registry metadata
      // (about 26 MB for the five) on every cold `npx` install.
      expect(
        pkg.peerDependencies?.[name],
        `${name} in peerDependencies`,
      ).toBeUndefined();
      expect(
        pkg.optionalDependencies?.[name],
        `${name} in optionalDependencies`,
      ).toBeUndefined();
      expect(
        pkg.engineDependencies?.[name],
        `${name} in engineDependencies`,
      ).toBeTruthy();
      expect(pkg.devDependencies?.[name], `${name} in devDependencies`).toBe(
        pkg.engineDependencies[name],
      );
    }
    expect(Object.keys(pkg.engineDependencies).sort()).toEqual(
      [...ENGINE_PACKAGES].sort(),
    );
  });

  it("the npm package depends on zod alone; everything else is bundled into dist/", () => {
    // Each dependency costs a cold `npx -y sniff-qa --mcp` a registry round trip
    // and a download before the MCP handshake. zod stays a dependency because
    // the public config types in dist/index.d.ts import it.
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(["zod"]);
    expect(pkg.optionalDependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.files).toContain("THIRD-PARTY-NOTICES.md");
    expect(pkg.scripts.build).toContain("scripts/third-party-notices.mjs");
  });

  it("no shipped source file imports an engine package at load time", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".ts") && !p.endsWith(".test.ts")) {
          const lines = readFileSync(p, "utf8").split("\n");
          lines.forEach((line, i) => {
            for (const name of ENGINE_PACKAGES) {
              const esc = name.replace(/[/.]/g, (c) => `\\${c}`);
              const staticImport = new RegExp(
                `^\\s*import\\s+(?!type\\b)[^;]*from\\s+['"]${esc}['"]`,
              );
              const sideEffect = new RegExp(`^\\s*import\\s+['"]${esc}['"]`);
              if (staticImport.test(line) || sideEffect.test(line))
                offenders.push(`${p}:${i + 1}`);
            }
          });
        }
      }
    };
    walk(join(ROOT, "src"));
    expect(offenders).toEqual([]);
  });

  it("engineDependencies copies the peer ranges and fails loudly when one is missing", () => {
    expect(engineDependencies(pkg)).toEqual(pkg.engineDependencies);
    expect(() =>
      engineDependencies({ engineDependencies: { playwright: "1" } }),
    ).toThrow(/playwright-core/);
  });
});

describe("engineDir and the install command", () => {
  it("honours SNIFF_ENGINE_DIR, then XDG_CACHE_HOME, and keys the folder by version", () => {
    expect(engineDir({ SNIFF_ENGINE_DIR: "/x/engine" })).toBe("/x/engine");
    if (process.platform !== "win32") {
      expect(engineDir({ XDG_CACHE_HOME: "/c" })).toBe(
        join("/c", "sniff-qa", "engine", getVersion()),
      );
    }
  });

  it("names a pinned, copy-pasteable command", () => {
    expect(engineInstallCommand()).toBe(
      `npx -y sniff-qa@${getVersion()} install`,
    );
    expect(engineInstallCommand(["chromium", "firefox"])).toBe(
      `npx -y sniff-qa@${getVersion()} install chromium firefox`,
    );
  });
});

describe("loadEngine", () => {
  it("uses normal resolution when it works", async () => {
    const mod = await loadEngine(
      "playwright",
      async () => ({ from: "resolved" }),
      { dir: tempDir() },
    );
    expect(mod).toEqual({ from: "resolved" });
  });

  it("falls back to the engine folder when the package does not resolve", async () => {
    const dir = fakeEngineDir(ENGINE_PACKAGES);
    const mod = await loadEngine<{ from: string; name: string }>(
      "@axe-core/playwright",
      async () => {
        throw notFound("@axe-core/playwright");
      },
      { dir },
    );
    expect(mod.from).toBe("engine-dir");
    expect(mod.name).toBe("@axe-core/playwright");
  });

  it("throws EngineMissingError with the install command when the engine folder is incomplete", async () => {
    const dir = fakeEngineDir(ENGINE_PACKAGES, false);
    const err = await loadEngine(
      "lighthouse",
      async () => {
        throw notFound("lighthouse");
      },
      { dir },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(EngineMissingError);
    expect(err.message).toContain(engineInstallCommand());
  });

  it("rethrows errors that are not a missing package", async () => {
    const boom = new Error("boom");
    await expect(
      loadEngine(
        "playwright",
        async () => {
          throw boom;
        },
        { dir: tempDir() },
      ),
    ).rejects.toBe(boom);
  });
});

describe("installEngine", () => {
  const fakeNpm =
    (calls: string[][]): NpmRunner =>
    async (args, cwd) => {
      calls.push(args);
      for (const name of ENGINE_PACKAGES) {
        const p = join(cwd, "node_modules", ...name.split("/"));
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, "package.json"), JSON.stringify({ name }));
      }
    };

  it("installs into a temp folder, then renames it into place with a completion marker", async () => {
    const dir = join(tempDir(), "engine", "1.2.3");
    const calls: string[][] = [];
    expect(await installEngine({ dir, run: fakeNpm(calls) })).toBe(dir);
    expect(engineInstalledAt(dir)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(
      expect.arrayContaining(["install", "--omit=dev", "--ignore-scripts"]),
    );
    const written = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    expect(written.dependencies).toEqual(pkg.engineDependencies);
    expect(existsSync(join(dir, "load.mjs"))).toBe(true);
    expect(readdirSync(dirname(dir))).toEqual(["1.2.3"]);
  });

  it("does nothing when the engine is already complete", async () => {
    const dir = fakeEngineDir(ENGINE_PACKAGES);
    const calls: string[][] = [];
    await installEngine({ dir, run: fakeNpm(calls) });
    expect(calls).toEqual([]);
  });

  it("leaves no folder behind when npm fails, so a killed download never looks installed", async () => {
    const parent = tempDir();
    const dir = join(parent, "engine");
    const failing: NpmRunner = async () => {
      throw new Error("network down");
    };
    await expect(installEngine({ dir, run: failing })).rejects.toThrow(
      "network down",
    );
    expect(readdirSync(parent)).toEqual([]);
    expect(engineInstalledAt(dir)).toBe(false);
  });

  it("refuses to mark the engine complete when npm leaves a package out", async () => {
    const parent = tempDir();
    const dir = join(parent, "engine");
    const partial: NpmRunner = async (_args, cwd) => {
      mkdirSync(join(cwd, "node_modules", "playwright"), { recursive: true });
      writeFileSync(
        join(cwd, "node_modules", "playwright", "package.json"),
        "{}",
      );
    };
    await expect(installEngine({ dir, run: partial })).rejects.toThrow(
      /missing/,
    );
    expect(readdirSync(parent)).toEqual([]);
  });

  it("replaces an incomplete folder left by an older attempt", async () => {
    const dir = fakeEngineDir(["playwright"], false);
    const calls: string[][] = [];
    await installEngine({ dir, run: fakeNpm(calls) });
    expect(calls).toHaveLength(1);
    expect(engineInstalledAt(dir)).toBe(true);
  });
});

describe("temp folders left by an interrupted install", () => {
  /** A pid that is certainly not running: a child that already exited. */
  const deadPid = (): number => spawnSync(process.execPath, ["-e", ""]).pid!;

  function leftover(dir: string, pid: number, ageMs = 0): string {
    const path = `${dir}.tmp-${pid}-${Date.now() - ageMs}`;
    mkdirSync(join(path, "node_modules", "playwright"), { recursive: true });
    writeFileSync(join(path, "package.json"), "{}");
    if (ageMs > 0) {
      const t = (Date.now() - ageMs) / 1000;
      for (const p of [join(path, "node_modules", "playwright"), join(path, "node_modules"), join(path, "package.json"), path])
        utimesSync(p, t, t);
    }
    return path;
  }

  it("isPidAlive knows this process and a finished one", () => {
    expect(isPidAlive(process.pid)).toBe(true);
    expect(isPidAlive(deadPid())).toBe(false);
    expect(isPidAlive(0)).toBe(false);
  });

  it("removes a folder whose install process is gone", () => {
    const dir = join(tempDir(), "engine", "1.2.3");
    const gone = leftover(dir, deadPid());
    expect(sweepStaleEngineTemps(dir)).toEqual([gone]);
    expect(existsSync(gone)).toBe(false);
  });

  it("keeps a folder that a live install is still writing to", () => {
    const dir = join(tempDir(), "engine", "1.2.3");
    const live = leftover(dir, 424242);
    expect(sweepStaleEngineTemps(dir, { alive: () => true })).toEqual([]);
    expect(existsSync(live)).toBe(true);
  });

  it("removes a folder with no write for an hour, even when its pid was reused", () => {
    const dir = join(tempDir(), "engine", "1.2.3");
    const old = leftover(dir, 424242, STALE_TEMP_MS + 60_000);
    expect(sweepStaleEngineTemps(dir, { alive: () => true })).toEqual([old]);
  });

  it("never touches a folder of this process, nor other names", () => {
    const dir = join(tempDir(), "engine", "1.2.3");
    const mine = leftover(dir, process.pid, STALE_TEMP_MS + 60_000);
    const other = join(dirname(dir), "1.2.4.tmp-1-2");
    mkdirSync(other, { recursive: true });
    expect(sweepStaleEngineTemps(dir, { alive: () => false })).toEqual([]);
    expect(existsSync(mine) && existsSync(other)).toBe(true);
  });

  it("installEngine sweeps leftovers before it starts", async () => {
    const dir = join(tempDir(), "engine", "1.2.3");
    const gone = leftover(dir, deadPid());
    const lines: string[] = [];
    await installEngine({
      dir,
      log: (l) => lines.push(l),
      run: async (_args, cwd) => {
        for (const name of ENGINE_PACKAGES) {
          const p = join(cwd, "node_modules", ...name.split("/"));
          mkdirSync(p, { recursive: true });
          writeFileSync(join(p, "package.json"), JSON.stringify({ name }));
        }
      },
    });
    expect(existsSync(gone)).toBe(false);
    expect(readdirSync(dirname(dir))).toEqual(["1.2.3"]);
    expect(lines.join("\n")).toContain("Removed an interrupted download");
  });
});

describe("engineStatus, findPackageDir and playwrightCliPath", () => {
  it("reports resolved in a dev checkout, where the engine is a devDependency", () => {
    expect(engineStatus()).toBe("resolved");
    expect(findPackageDir("playwright", join(ROOT, "src", "core"))).toBe(
      join(ROOT, "node_modules", "playwright"),
    );
  });

  it("reports engine-dir or missing when the packages do not resolve", () => {
    const outside = tempDir();
    expect(
      engineStatus({ fromDir: outside, dir: fakeEngineDir(ENGINE_PACKAGES) }),
    ).toBe("engine-dir");
    expect(
      engineStatus({
        fromDir: outside,
        dir: fakeEngineDir(ENGINE_PACKAGES, false),
      }),
    ).toBe("missing");
  });

  it("finds the Playwright CLI next to the Playwright that loads", () => {
    expect(playwrightCliPath()).toBe(
      join(ROOT, "node_modules", "playwright", "cli.js"),
    );
    const dir = fakeEngineDir(ENGINE_PACKAGES);
    expect(playwrightCliPath({ fromDir: tempDir(), dir })).toBe(
      join(dir, "node_modules", "playwright", "cli.js"),
    );
    expect(
      playwrightCliPath({ fromDir: tempDir(), dir: tempDir() }),
    ).toBeNull();
  });
});

describe("npmChildEnv", () => {
  it("drops npx settings that would redirect the install, keeps cache and registry", () => {
    const env = npmChildEnv({
      npm_config_global: "true",
      npm_config_prefix: "/usr/local",
      npm_config_yes: "true",
      npm_config_cache: "/tmp/cache",
      npm_config_registry: "https://registry.npmjs.org/",
      PATH: "/bin",
    });
    expect(env).toEqual({
      npm_config_cache: "/tmp/cache",
      npm_config_registry: "https://registry.npmjs.org/",
      PATH: "/bin",
    });
  });
});
