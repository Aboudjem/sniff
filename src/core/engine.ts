// The browser engine: Playwright, axe-core for Playwright, Lighthouse and
// chrome-launcher. Together they weigh about 200 MB on disk and take most of
// the install time, so they are not npm dependencies. package.json lists them
// under `engineDependencies` (and devDependencies, for this repo's tests).
// That keeps `npx -y sniff-qa --mcp` small enough to answer the MCP handshake
// within a client's connect timeout on a cold machine. They are not optional
// peerDependencies either: npm would still download their registry metadata,
// about 26 MB, on every cold install.
//
// Where the engine comes from, in order:
//   1. Normal module resolution (a project that installs playwright itself,
//      or a dev checkout of sniff where they are devDependencies).
//   2. sniff's own engine folder, filled once by `sniff install` (or by the
//      first walk in the CLI, or by the sniff_install MCP tool).

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { getPackageJson, getVersion } from "../version.js";

/** The packages that make up the engine. Kept in sync with package.json by a test. */
export const ENGINE_PACKAGES = [
  "playwright",
  "playwright-core",
  "@axe-core/playwright",
  "lighthouse",
  "chrome-launcher",
] as const;

export type EnginePackage = (typeof ENGINE_PACKAGES)[number];

/** Measured: `npm install` of the five packages above fills about 200 MB. */
export const ENGINE_SIZE_MB = 200;

/** Written last, so a half-finished install never counts as installed. */
const COMPLETE_MARKER = ".sniff-engine-complete";

/** The command a person runs to install the engine (and browsers) by hand. */
export function engineInstallCommand(projects: readonly string[] = []): string {
  const tail = projects.length > 0 ? ` ${projects.join(" ")}` : "";
  return `npx -y sniff-qa@${getVersion()} install${tail}`;
}

export class EngineMissingError extends Error {
  readonly code = "SNIFF_ENGINE_MISSING";
  constructor(readonly packageName: string) {
    super(
      `The browser engine (${packageName}) is not installed yet. ` +
        `sniff downloads it once, about ${ENGINE_SIZE_MB} MB. Run: ${engineInstallCommand()}`,
    );
    this.name = "EngineMissingError";
  }
}

/** Folder that holds sniff's own copy of the engine, one per sniff version. */
export function engineDir(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SNIFF_ENGINE_DIR) return env.SNIFF_ENGINE_DIR;
  const cacheRoot =
    env.XDG_CACHE_HOME ||
    (process.platform === "win32"
      ? env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
      : join(homedir(), ".cache"));
  return join(cacheRoot, "sniff-qa", "engine", getVersion());
}

export function engineInstalledAt(dir: string = engineDir()): boolean {
  return existsSync(join(dir, COMPLETE_MARKER));
}

/**
 * Directory of `name` as Node would resolve it from `fromDir`: walk up the
 * parent folders looking in each `node_modules`. Returns null when absent.
 */
export function findPackageDir(name: string, fromDir: string): string | null {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, "node_modules", ...name.split("/"));
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));

export type EngineSource = "resolved" | "engine-dir" | "missing";

/**
 * Where the engine would load from, without loading it. `resolved` means every
 * package resolves normally; `engine-dir` means sniff's own copy is complete.
 */
export function engineStatus(
  options: { fromDir?: string; dir?: string } = {},
): EngineSource {
  const fromDir = options.fromDir ?? HERE;
  if (ENGINE_PACKAGES.every((name) => findPackageDir(name, fromDir) !== null))
    return "resolved";
  return engineInstalledAt(options.dir ?? engineDir())
    ? "engine-dir"
    : "missing";
}

function isModuleNotFound(err: unknown, name: string): boolean {
  const e = err as { code?: unknown; message?: unknown } | null;
  if (
    !e ||
    (e.code !== "ERR_MODULE_NOT_FOUND" && e.code !== "MODULE_NOT_FOUND")
  )
    return false;
  return String(e.message ?? "").includes(name);
}

/** Import `name` from sniff's engine folder. */
export async function importFromEngineDir<T = unknown>(
  name: string,
  dir: string = engineDir(),
): Promise<T> {
  // load.mjs sits in the engine folder, so its import() resolves against the
  // node_modules installed next to it.
  const loader = (await import(
    /* @vite-ignore */ pathToFileURL(join(dir, "load.mjs")).href
  )) as {
    load: (n: string) => Promise<T>;
  };
  return loader.load(name);
}

/**
 * Load an engine package. `importer` is the literal `import('<name>')`, so the
 * bundler keeps it external and tests can mock it. When the package does not
 * resolve normally, the copy in sniff's engine folder is used. When that is
 * missing too, an EngineMissingError says which command installs it.
 */
export async function loadEngine<T>(
  name: EnginePackage,
  importer: () => Promise<T>,
  options: { dir?: string } = {},
): Promise<T> {
  try {
    return await importer();
  } catch (err) {
    if (!isModuleNotFound(err, name)) throw err;
    const dir = options.dir ?? engineDir();
    if (!engineInstalledAt(dir)) throw new EngineMissingError(name);
    return importFromEngineDir<T>(name, dir);
  }
}

/** Version ranges for the engine, read from sniff's own package.json. */
export function engineDependencies(
  pkg: { engineDependencies?: Record<string, string> } | null = getPackageJson(),
): Record<EnginePackage, string> {
  const peers = pkg?.engineDependencies ?? {};
  const out = {} as Record<EnginePackage, string>;
  for (const name of ENGINE_PACKAGES) {
    const range = peers[name];
    if (!range)
      throw new Error(
        `sniff's package.json does not list ${name} in peerDependencies`,
      );
    out[name] = range;
  }
  return out;
}

/** Runs `npm <args>` in `cwd`, streaming npm's output to `log`. */
export type NpmRunner = (
  args: string[],
  cwd: string,
  log: (line: string) => void,
) => Promise<void>;

/**
 * npm's own environment variables from an `npx` parent would leak into the
 * child (for example `npm_config_global`). Keep the user's cache and registry
 * settings, drop the ones that change where or how the install happens.
 */
export function npmChildEnv(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  const drop = new Set([
    "npm_config_global",
    "npm_config_location",
    "npm_config_prefix",
    "npm_config_package",
    "npm_config_call",
    "npm_config_yes",
    "npm_config_save",
    "npm_config_dry_run",
    "npm_config_omit",
    "npm_config_include",
    "npm_config_production",
    "npm_command",
    "npm_lifecycle_event",
    "npm_lifecycle_script",
  ]);
  for (const [k, v] of Object.entries(env)) {
    if (!drop.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

export const runNpm: NpmRunner = (args, cwd, log) =>
  new Promise((resolve, reject) => {
    // Under npx, npm_execpath points at npm's CLI script: run it with this
    // Node so the install does not depend on PATH.
    const execpath = process.env.npm_execpath;
    const viaNode = !!execpath && /npm-cli\.(c?js)$/.test(execpath);
    const child = spawn(
      viaNode ? process.execPath : "npm",
      viaNode ? [execpath!, ...args] : args,
      {
        cwd,
        env: npmChildEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        shell: !viaNode && process.platform === "win32",
      },
    );
    let tail = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      tail = (tail + text).slice(-4000);
      for (const line of text.split(/\r?\n/)) if (line.trim()) log(line);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(
          new Error(
            `npm ${args.join(" ")} exited with code ${code}\n${tail.trim()}`,
          ),
        );
    });
  });

const LOADER_SOURCE =
  "// Written by sniff-qa. Imports resolve against the node_modules next to this file.\n" +
  "export function load(name) {\n  return import(name);\n}\n";

/**
 * Install the engine into sniff's engine folder, once. Safe to call again:
 * returns at once when the folder is complete. The install happens in a
 * temporary sibling folder that is renamed into place only when npm succeeds,
 * so an interrupted download never leaves a folder that looks installed.
 */
export async function installEngine(
  options: { dir?: string; log?: (line: string) => void; run?: NpmRunner } = {},
): Promise<string> {
  const dir = options.dir ?? engineDir();
  if (engineInstalledAt(dir)) return dir;
  const log = options.log ?? (() => {});
  const run = options.run ?? runNpm;

  const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
  mkdirSync(tmp, { recursive: true });
  try {
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify(
        {
          name: "sniff-qa-engine",
          version: getVersion(),
          private: true,
          description:
            "Browser engine downloaded by sniff-qa. Safe to delete; sniff downloads it again when needed.",
          dependencies: engineDependencies(),
        },
        null,
        2,
      ) + "\n",
    );
    writeFileSync(join(tmp, "load.mjs"), LOADER_SOURCE);
    // None of the engine packages has an install script, so skip scripts.
    await run(
      [
        "install",
        "--prefix",
        tmp,
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--no-update-notifier",
        "--loglevel=error",
      ],
      tmp,
      log,
    );
    for (const name of ENGINE_PACKAGES) {
      if (
        !existsSync(
          join(tmp, "node_modules", ...name.split("/"), "package.json"),
        )
      ) {
        throw new Error(`npm finished but ${name} is missing from ${tmp}`);
      }
    }
    writeFileSync(join(tmp, COMPLETE_MARKER), new Date().toISOString() + "\n");
    mkdirSync(dirname(dir), { recursive: true });
    // A folder left by an older, interrupted attempt has no marker: replace it.
    if (existsSync(dir) && !engineInstalledAt(dir))
      rmSync(dir, { recursive: true, force: true });
    try {
      renameSync(tmp, dir);
    } catch (err) {
      // Another sniff process finished first. Keep its copy.
      if (!engineInstalledAt(dir)) throw err;
      rmSync(tmp, { recursive: true, force: true });
    }
    return dir;
  } catch (err) {
    rmSync(tmp, { recursive: true, force: true });
    throw err;
  }
}

/**
 * Make sure every engine package can load, installing sniff's copy when one is
 * missing. Returns where the engine loads from.
 */
export async function ensureEngine(
  options: {
    dir?: string;
    log?: (line: string) => void;
    run?: NpmRunner;
    fromDir?: string;
  } = {},
): Promise<Exclude<EngineSource, "missing">> {
  const status = engineStatus({ fromDir: options.fromDir, dir: options.dir });
  if (status !== "missing") return status;
  await installEngine(options);
  return "engine-dir";
}

/**
 * Path to the Playwright CLI that matches the Playwright sniff loads, so the
 * browser it downloads is the build that Playwright expects.
 */
export function playwrightCliPath(
  options: { fromDir?: string; dir?: string } = {},
): string | null {
  const local = findPackageDir("playwright", options.fromDir ?? HERE);
  const pkgDir =
    local ??
    (() => {
      const dir = options.dir ?? engineDir();
      const candidate = join(dir, "node_modules", "playwright");
      return engineInstalledAt(dir) &&
        existsSync(join(candidate, "package.json"))
        ? candidate
        : null;
    })();
  if (!pkgDir) return null;
  try {
    const pkg = JSON.parse(
      readFileSync(join(pkgDir, "package.json"), "utf-8"),
    ) as { bin?: Record<string, string> };
    const rel = pkg.bin?.playwright ?? "cli.js";
    const cli = join(pkgDir, rel);
    return existsSync(cli) ? cli : null;
  } catch {
    return null;
  }
}
