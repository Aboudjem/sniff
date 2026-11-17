// A browser launch that fails because the browser files are not on disk.
//
// The setup check (./ensure-browsers.ts) catches the usual cases before a
// launch. When something slips past it (a download killed midway, a cache
// folder emptied by a cleanup tool), Playwright throws "Executable doesn't
// exist ... npx playwright install". That advice is wrong for sniff: the
// browser must come from sniff's own Playwright. So every launch site turns
// that error into a BrowserMissingError, which the CLI prints as the usual
// install hint and the MCP tools return as the usual `needsSetup` result.

import type { BrowserProject } from "../config/schema.js";
import { engineInstallCommand } from "./engine.js";

export class BrowserMissingError extends Error {
  readonly code = "SNIFF_BROWSER_MISSING";
  constructor(readonly projects: BrowserProject[]) {
    super(
      `The browser (${projects.join(", ")}) is not fully downloaded. An earlier download may have been interrupted. ` +
        `Run: ${engineInstallCommand(projects)}`,
    );
    this.name = "BrowserMissingError";
  }
}

const MISSING_EXECUTABLE =
  /Executable doesn't exist|executable doesn.t exist at|Please run the following command to download new browsers/i;

/** Which browser a Playwright error is about, from the path it names. */
function projectFromMessage(
  message: string,
  fallback: BrowserProject,
): BrowserProject {
  if (/[\\/]firefox-\d+/.test(message)) return "firefox";
  if (/[\\/]webkit-\d+/.test(message)) return "webkit";
  if (/[\\/]chromium(_headless_shell)?-\d+/.test(message)) return "chromium";
  return fallback;
}

/**
 * The BrowserMissingError inside `err`, if there is one: the error itself, a
 * `cause` of it, or a raw Playwright "Executable doesn't exist" error.
 */
export function findBrowserMissing(
  err: unknown,
  fallback: BrowserProject = "chromium",
): BrowserMissingError | null {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof BrowserMissingError) return current;
    const e = current as {
      code?: unknown;
      projects?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (e.code === "SNIFF_BROWSER_MISSING" && Array.isArray(e.projects)) {
      return new BrowserMissingError(e.projects as BrowserProject[]);
    }
    const message =
      typeof e.message === "string"
        ? e.message
        : typeof current === "string"
          ? current
          : "";
    if (MISSING_EXECUTABLE.test(message)) {
      return new BrowserMissingError([projectFromMessage(message, fallback)]);
    }
    current = e.cause;
  }
  return null;
}

/** For `launch().catch(...)`: a missing-browser error becomes BrowserMissingError, anything else is kept. */
export function asBrowserMissing(
  err: unknown,
  project: BrowserProject = "chromium",
): unknown {
  return findBrowserMissing(err, project) ?? err;
}
