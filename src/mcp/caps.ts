/**
 * Capability gating for the MCP server (`--caps`).
 *
 * This module is deliberately side-effect free. `src/cli/index.ts` runs the
 * whole commander CLI at import time, so the parser cannot live there: a test
 * importing it would execute the CLI. Both `src/cli/index.ts` and
 * `src/mcp/server.ts` import from here instead.
 */

/** Every capability name accepted by `--caps`. */
export const CAPABILITIES = ['scan', 'walk', 'discover', 'report', 'install'] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Modes accepted by the unified `sniff` tool, in the order the enum declares them. */
export const UNIFIED_MODES = ['walk', 'scan', 'run', 'discover', 'report'] as const;

export type UnifiedMode = (typeof UNIFIED_MODES)[number];

/**
 * The capability each unified mode needs. `run` is the legacy alias for a
 * browser audit, so it shares the `walk` capability: without it, neither the
 * unified `walk`/`run` modes nor the `sniff_run` tool are reachable.
 */
export const MODE_CAPABILITY: Readonly<Record<UnifiedMode, Capability>> = {
  walk: 'walk',
  scan: 'scan',
  run: 'walk',
  discover: 'discover',
  report: 'report',
};

/** The narrow tool each capability registers. */
export const CAPABILITY_TOOL: Readonly<Record<Capability, string>> = {
  scan: 'sniff_scan',
  walk: 'sniff_run',
  discover: 'sniff_discover',
  report: 'sniff_report',
  install: 'sniff_install',
};

/**
 * Registration order, matching what the server has always registered so the
 * default (no `--caps`) tool list stays byte-identical to earlier versions.
 */
const TOOL_ORDER: readonly string[] = [
  'sniff',
  'sniff_scan',
  'sniff_run',
  'sniff_discover',
  'sniff_install',
  'sniff_report',
];

/** Capabilities that make the unified `sniff` tool worth registering. */
const UNIFIED_CAPABILITIES: readonly Capability[] = ['scan', 'walk', 'discover', 'report'];

/**
 * Capabilities implied by another capability.
 *
 * `walk` implies `scan`: `handleSniffWalk` degrades to a source scan when no
 * dev server is reachable (`src/mcp/handlers.ts`), and the legacy `run` mode
 * does the same. Granting `walk` therefore already grants source-scan
 * authority, so the capability set says so rather than pretending otherwise.
 */
const IMPLIES: Readonly<Partial<Record<Capability, readonly Capability[]>>> = {
  walk: ['scan'],
};

/** Add every capability implied by the ones granted. */
export function expandCaps(caps: readonly Capability[]): Capability[] {
  const out: Capability[] = [];
  const add = (c: Capability): void => {
    if (out.includes(c)) return;
    out.push(c);
    for (const implied of IMPLIES[c] ?? []) add(implied);
  };
  for (const c of caps) add(c);
  return out;
}

/** Thrown for a malformed `--caps` value, so the server can exit loudly. */
export class CapsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapsError';
  }
}

function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Read `--caps` out of an argv array. Accepts `--caps a,b` and `--caps=a,b`.
 * Returns every capability when the flag is absent, so an existing MCP config
 * keeps the tool list it has today.
 *
 * Throws `CapsError` on an unknown name or an empty list: a typo in an MCP
 * config would otherwise silently grant nothing, which is worse than a crash.
 */
export function parseCaps(argv: readonly string[]): Capability[] {
  let raw: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg === '--caps') {
      raw = argv[i + 1];
      if (raw === undefined || raw.startsWith('-')) {
        throw new CapsError('--caps needs a comma-separated list, for example --caps scan,report');
      }
      break;
    }
    if (arg.startsWith('--caps=')) {
      raw = arg.slice('--caps='.length);
      break;
    }
  }

  if (raw === undefined) return [...CAPABILITIES];

  const names = raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (names.length === 0) {
    throw new CapsError('--caps was empty. Known capabilities: ' + CAPABILITIES.join(', '));
  }

  const unknown = names.filter((n) => !isCapability(n));
  if (unknown.length > 0) {
    throw new CapsError(
      `Unknown capability: ${unknown.join(', ')}. Known capabilities: ${CAPABILITIES.join(', ')}`,
    );
  }

  const granted: Capability[] = [];
  for (const n of names) {
    if (isCapability(n) && !granted.includes(n)) granted.push(n);
  }
  return granted;
}

/**
 * Turn a granted capability list into the tools to register and the modes the
 * unified `sniff` tool may accept.
 */
export function resolveTools(caps: readonly Capability[]): {
  tools: string[];
  modes: UnifiedMode[];
} {
  const expanded = expandCaps(caps);
  const granted = new Set(expanded);
  const modes = UNIFIED_MODES.filter((m) => granted.has(MODE_CAPABILITY[m]));
  const wantsUnified = UNIFIED_CAPABILITIES.some((c) => granted.has(c));

  const registered = new Set<string>();
  if (wantsUnified) registered.add('sniff');
  for (const cap of expanded) registered.add(CAPABILITY_TOOL[cap]);

  return {
    tools: TOOL_ORDER.filter((t) => registered.has(t)),
    modes: [...modes],
  };
}
