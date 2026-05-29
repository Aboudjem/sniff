# AGENTS.md — sniff

Instructions for AI agents and coding assistants working in, or invoking, this repository. Plain Markdown, no required fields (per the AGENTS.md convention: the agent simply parses the text below). Human-facing docs live in `README.md`; this file holds the extra context an agent needs.

## What this repo is

sniff is an autonomous QA scanner: point it at a running web app and it walks the app's real user flows in a real (headless) browser and reports what's actually broken — with proof. It is not a static linter. npm package `sniff-qa` (binaries `sniff` and `sniff-qa`); ships as both a CLI and an MCP server (Claude Code plugin); Apache-2.0; Node >= 22; no API key required.

## How an agent should USE sniff

Prefer the MCP `sniff` tool over the CLI when running inside an agent host (Claude Code, Cursor, VS Code/Copilot, Codex, Gemini CLI, Windsurf, Continue.dev). There is **one unified `sniff` tool**; pass `{ mode, rootDir, baseUrl? }`.

- **`mode: "walk"` (RECOMMENDED, for a running app)** — drives a real browser, walks the app's user flows, and returns real bugs with reproduction proof. Pass `rootDir` (absolute project path) and, optionally, `baseUrl` (the running app's URL). If `baseUrl` is omitted, sniff auto-detects the local dev server. If no app is running, it degrades to a source scan and tells you so via a `note` field (start the dev server or pass `baseUrl` to get runtime bugs). Useful options: `maxPages` (default 25), `mobile` (default true — the 375px responsive pass), `all` (default false — include `uncertain` findings).
- **`mode: "scan"` (source-only, no browser)** — pass `rootDir` only. Finds placeholder/TODO/`console.log`/dead links/etc. by reading source. Works offline; no browser needed.
- **`mode: "report"`** — load the last results for `rootDir` (`format: "json" | "summary"`).
- **`mode: "run" / "discover"` are legacy** — prefer `walk`. `run` does a source+browser audit; `discover` does scenario-based E2E.

### Handling the Playwright setup gate

The first browser run needs a Chromium build (~165 MB). The MCP browser modes do **not** silently shell out to install it (the ~45s install can time out the stdio transport). Instead they return:

```json
{ "needsSetup": "playwright-browsers", "projects": ["chromium"],
  "installCommand": "npx playwright install chromium", "installSizeMb": 165,
  "hint": "Run the sniff_install MCP tool with the same projects, or run the install command manually, then retry." }
```

When you see `needsSetup: "playwright-browsers"`: call the **`sniff_install`** MCP tool with the same `projects`, then **retry** the original `sniff` call. Do not report this as a failure — it is expected on first use. Disclose the one-time ~165 MB download to the user honestly.

The narrow tools (`sniff_scan`, `sniff_run`, `sniff_discover`, `sniff_report`, `sniff_install`) remain registered for back-compat and scoped capabilities, but new work should go through the unified `sniff` tool.

## Finding output schema

Every finding is a `QaFinding` (see `src/crawl/types.ts`). **A finding without reproduction proof is not a finding** — the engine never emits one without at least a route and ordered steps.

```ts
interface QaFinding {
  ruleId: string;               // e.g. "route/broken-page"
  issueClass: number;           // 1–12, see the table below
  title: string;
  severity: Severity;           // critical | high | medium | low | info
  confidence: 'confirmed' | 'likely' | 'uncertain';
  reproduction: {
    url: string;                // full URL observed
    route: string;              // normalized pathname (grouping/scoring)
    steps: string[];            // ordered, human-readable actions
    screenshotPath?: string;    // screenshot captured at the finding
    consoleExcerpt?: string[];  // relevant console errors/warnings
    networkExcerpt?: string[];  // relevant failed/relevant network lines
  };
  suggestedFix: string;
  needsOutOfBandVerification?: boolean; // true when the real outcome can only
                                        // be confirmed outside the browser
}
```

Confidence semantics: `confirmed` = deterministically reproduced with proof (HTTP 500, axe violation, measured overflow); `likely` = a strong heuristic fired but a benign explanation is conceivable; `uncertain` = worth a look but easily a false positive — **suppressed by default**, surfaced only with `all: true` / `--all`. Why false positives stay low: a first-party noise filter drops favicons/analytics/HMR/expected-auth/engine-aborts, axe-core (zero-false-positive by design) backs the accessibility findings, and a broken page is reported once rather than re-flagged.

## The 12 issue classes (`issueClass`)

1. Broken pages/routes (4xx/5xx, blank renders, crash screens)
2. Broken links (internal + external)
3. Console errors / uncaught exceptions / failed network requests during interaction
4. Empty data + placeholder/fake data (lorem, TODO, `test@test.com`)
5. Broken forms (dead submit button, validation that never fires)
6. State-loss (fill a form, go back, it's wiped)
7. Flow regressions / dead-ends
8. Bad loading states (infinite spinner) + missing error states
9. Broken async outcomes (submitted but no success feedback — flagged `needsOutOfBandVerification`)
10. Responsive issues (overflow, tiny tap targets)
11. Accessibility (missing alt/labels, contrast, via axe-core)
12. Unclear/buried primary actions

## What the agent should NOT do

- **Do not claim a fix worked without re-running sniff.** A fix is verified by re-running `mode: "walk"` against the running app and confirming the finding is gone — not by reading the diff.
- **Do not treat `uncertain` findings as confirmed.** They are hidden by default for a reason; only escalate them after independent verification, and never present them as proven defects.
- **Do not run against production without care.** `walk` drives a real browser and submits forms / clicks buttons. Point it at a dev/staging server (or the auto-detected local dev server). Against any shared environment, get explicit user sign-off first; never run destructive flows against live data.
- **Do not invent findings, severities, or fixes.** Report only what sniff produced, with its reproduction proof attached. Do not fabricate routes, steps, or screenshots.

## Developing in this repo

- **Build:** `npm run build` (tsup → `dist/`). **Typecheck:** `npm run typecheck`.
- **Test:** `npx vitest run` (full suite). Co-located `*.test.ts` files live next to the source they cover (e.g. `src/mcp/server.test.ts`, `src/crawl/`, `src/discovery/`).
- **Regression fixture & scorer** (`sniff-tests/`): `planted-bugs/` is a deliberately broken app (21 planted bugs across all 12 issue classes plus a clean control page at `/clean`); `score-fixture.mjs` (using `score-lib.mjs`) scores a sniff JSON report against `planted-bugs/MANIFEST.json` for recall, precision proxy, and hard false positives on the clean page. The locked target is 21/21 found at 100% precision with 0 false positives. `run-crawl.mjs` drives a crawl against the fixture; `mcp-smoke.mjs` smoke-tests the MCP server.
- **MCP surface lives in `src/mcp/`** (`server.ts` registers tools; `handlers.ts` implements them). The flow-walk engine is in `src/crawl/`; the finding/report types are in `src/crawl/types.ts` and `src/core/types.ts`.
- Keep authoring and verification as separate passes. After any engine change, re-run the fixture scorer and the vitest suite; do not declare done until both pass.

## 10x marketplace

sniff is part of the 10x plugin marketplace — github.com/Aboudjem/10x. Install via:
`claude plugin marketplace add Aboudjem/10x` then `claude plugin install sniff@10x`.
