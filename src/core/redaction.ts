/**
 * Credential redaction for reports written after an authenticated walk.
 *
 * `--storage-state` loads a Playwright storage-state file so sniff can walk a
 * logged-in app. That file holds session cookies and bearer tokens, and sniff
 * writes HTML and JSON reports plus progress lines that quote captured URLs and
 * console text. Without this module a crawl of a logged-in app can serialize a
 * live credential into a file the user then commits.
 *
 * What this guarantees, exactly: every string of {@link MIN_SECRET_LENGTH} or
 * more characters found in the storage state (cookie values, localStorage
 * values, indexedDB values), every string leaf of any of those values that is
 * itself JSON, and the percent-encoded form of each, is replaced with
 * `[redacted]` in every text artifact sniff writes. Values shorter than the
 * floor are left alone, because replacing a two-character string would corrupt
 * unrelated report text.
 *
 * What it does not cover: screenshot pixels. A logged-in crawl renders session
 * UI into the PNGs under the report directory by design, and no string filter
 * can change that.
 */

import { readFile } from 'node:fs/promises';
import { SniffError } from './errors.js';

export const REDACTED = '[redacted]';

/** Shorter values are skipped: redacting them would mangle unrelated text. */
export const MIN_SECRET_LENGTH = 4;

/** Depth cap for unwrapping JSON nested inside a storage-state value. */
const MAX_JSON_DEPTH = 4;

/**
 * `Authorization: Bearer <token>` and its JSON form. Defence in depth for a
 * header echoed into console output, whose value never passed through the
 * storage-state file and so is not in the literal set.
 */
const AUTH_HEADER =
  /(\bauthorization\b["']?\s*[:=]\s*["']?)((?:bearer|basic|token|jwt)\s+)?([^\s"'`,;)\]}]+)/gi;

/** A parsed Playwright storage-state document. */
export interface StorageState {
  cookies?: unknown;
  origins?: unknown;
}

function collectStrings(value: unknown, out: Set<string>, depth: number): void {
  if (depth > MAX_JSON_DEPTH) return;
  if (typeof value === 'string') {
    addSecret(value, out, depth);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth);
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, out, depth);
    }
  }
}

function addSecret(value: string, out: Set<string>, depth: number): void {
  const v = value.trim();
  if (v.length < MIN_SECRET_LENGTH) return;
  out.add(v);

  const encoded = encodeURIComponent(v);
  if (encoded !== v && encoded.length >= MIN_SECRET_LENGTH) out.add(encoded);

  // A localStorage value is very often stringified JSON such as
  // {"accessToken":"..."}. The app reads the token out and uses it bare, so the
  // whole-value literal would never match what lands in a URL or a log line.
  if (depth >= MAX_JSON_DEPTH) return;
  const trimmed = v.trimStart();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return;
  try {
    collectStrings(JSON.parse(v), out, depth + 1);
  } catch {
    // Not JSON. The whole-value literal is already registered.
  }
}

/**
 * Gather every credential-bearing string from a parsed storage state.
 * Only value positions are read: cookie and origin *names*, domains and paths
 * are structural, and redacting them would mangle report text for no gain.
 */
export function collectStorageStateSecrets(state: unknown): string[] {
  const out = new Set<string>();
  if (!state || typeof state !== 'object') return [];
  const doc = state as StorageState;

  if (Array.isArray(doc.cookies)) {
    for (const cookie of doc.cookies) {
      if (cookie && typeof cookie === 'object') {
        addSecret(String((cookie as Record<string, unknown>).value ?? ''), out, 0);
      }
    }
  }

  if (Array.isArray(doc.origins)) {
    for (const origin of doc.origins) {
      if (!origin || typeof origin !== 'object') continue;
      const o = origin as Record<string, unknown>;
      if (Array.isArray(o.localStorage)) {
        for (const entry of o.localStorage) {
          if (entry && typeof entry === 'object') {
            addSecret(String((entry as Record<string, unknown>).value ?? ''), out, 0);
          }
        }
      }
      // Playwright can also persist indexedDB. Its shape is nested and
      // version-dependent, so walk it rather than naming fields.
      if (o.indexedDB !== undefined) collectStrings(o.indexedDB, out, 1);
    }
  }

  return [...out].filter((s) => s.length >= MIN_SECRET_LENGTH);
}

/**
 * Build a redactor over a secret list. Longer secrets are replaced first so a
 * value that contains another value cannot leave a fragment behind.
 */
export function createRedactor(secrets: readonly string[]): (text: string) => string {
  const ordered = [...new Set(secrets)]
    .filter((s) => s.length >= MIN_SECRET_LENGTH)
    .sort((a, b) => b.length - a.length);

  return (text: string): string => {
    if (typeof text !== 'string' || text.length === 0) return text;
    let out = text;
    for (const secret of ordered) {
      if (out.includes(secret)) out = out.split(secret).join(REDACTED);
    }
    return out.replace(AUTH_HEADER, (_m, prefix: string, scheme: string | undefined) =>
      `${prefix}${scheme ?? ''}${REDACTED}`);
  };
}

/** Deep-map every string in a JSON-shaped value through `redact`. */
export function redactDeep<T>(value: T, redact: (text: string) => string): T {
  if (typeof value === 'string') return redact(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, redact)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactDeep(v, redact);
    }
    return out as unknown as T;
  }
  return value;
}

// ── Process-level redactor ────────────────────────────────────────────────
// Installed once when a storage state is loaded, then consulted by every
// writer. A no-op until something is installed, so the default run is
// untouched.

let active: ((text: string) => string) | null = null;
const loaded = new Map<string, StorageState>();

export function installRedactor(secrets: readonly string[]): void {
  active = secrets.length > 0 ? createRedactor(secrets) : null;
}

/** Test helper: forget the installed redactor and any cached storage state. */
export function clearRedactor(): void {
  active = null;
  loaded.clear();
}

export function isRedactorInstalled(): boolean {
  return active !== null;
}

/** Redact a string. Returns it unchanged when no redactor is installed. */
export function redactText(text: string): string {
  return active ? active(text) : text;
}

/** Redact every string in a JSON-shaped value. No-op with no redactor. */
export function redactValue<T>(value: T): T {
  return active ? redactDeep(value, active) : value;
}

/**
 * Read and parse a Playwright storage-state file.
 *
 * Fails loudly on a missing or unparseable file: silently continuing would
 * produce an unauthenticated crawl that reports every page as a login wall.
 * It cannot tell an expired or wrong-domain session from a live one, and does
 * not claim to.
 */
export async function loadStorageState(path: string): Promise<StorageState> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new SniffError(
      'STORAGE_STATE_UNREADABLE',
      `Cannot read the storage state at ${path}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new SniffError(
      'STORAGE_STATE_INVALID',
      `The storage state at ${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}. ` +
        'Generate one with playwright: context.storageState({ path: "auth.json" }).',
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new SniffError(
      'STORAGE_STATE_INVALID',
      `The storage state at ${path} is not a Playwright storage-state object (expected { cookies, origins }).`,
    );
  }
  return parsed as StorageState;
}

/**
 * Load a storage state once per path, install the redactor from that same
 * parsed object, and return it. Parsing once and deriving both the browser
 * context state and the secret list from the same object avoids a second read
 * that could see different bytes.
 */
export async function useStorageState(path: string): Promise<StorageState> {
  const cached = loaded.get(path);
  if (cached) return cached;
  const state = await loadStorageState(path);
  loaded.set(path, state);
  installRedactor(collectStorageStateSecrets(state));
  return state;
}
