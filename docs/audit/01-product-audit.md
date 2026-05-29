# Sniff — Product Audit (Promise vs. Delivery)

**Auditor role:** Product auditor. Question answered: *Is sniff useful? Who is it for? What is the job-to-be-done, and where does it fail that promise?*
**Date:** 2026-05-29
**Version audited:** `sniff-qa@0.5.2` (package.json:3), built `dist/` present.
**Method:** Read README, PROJECT-BRIEF, CLAUDE.md, package.json, CLI entrypoints, the source scanner, the browser runner, the discovery (flow-walker) runner, the chaos-monkey exploration provider, the finding model, and the MCP server. Ran the built CLI against a throwaway fixture to observe the real default experience.

---

## 1. The promise (the bar)

Per the VISION: *point sniff at a running app, it AUTONOMOUSLY WALKS the real user flows and reports what's actually broken WITH PROOF — like a tireless QA tester, not a static linter. Every finding ships proof (route/steps + screenshot/console/network log), severity, confidence, suggested fix. A finding without reproduction proof is NOT a finding. Must be dead-simple: one command, auto-detect, no keys, clear progress, readable report.*

The repo's own docs make the same promise even louder:
- PROJECT-BRIEF.md:18 — "Explores like a chaos monkey: clicks every clickable, fills every form, navigates every link, then verifies nothing broke."
- PROJECT-BRIEF.md:3 — "Reads your repo, builds the test plan, runs everything (clicks, screenshots, a11y, perf, console errors, network failures), and ships a brutal report."
- README.md:35 — "You ship a feature. A user finds the bug before you do. Sniff is the opposite of that."

## 2. What sniff actually does by default (delivery)

I ran the built default command against a fixture app (a React component with `test@test.com`, a `console.log`, a `TODO`, lorem ipsum, and a `.map()` with no `key`). Output:

```
sniff v0.5.2
[source] Scanning source code...
[source] 3 issues (1 high, 2 medium/low)
! HIGH (1)   src/App.tsx:5 Lorem ipsum placeholder text detected
~ MEDIUM (2) src/App.tsx:2 TODO comment found
             src/App.tsx:4 Console logging statement detected
Found 3 issues: 1 high, 2 medium
```

**The default `sniff` run is a regex source linter.** `src/scanners/source/index.ts:190-222` reads files line-by-line and `RegExp.exec`s a fixed rule list. The entire default rule set is: lorem/TODO/FIXME/TBD (placeholder.ts), console.log/debugger (debug.ts), hardcoded localhost/127.0.0.1 (hardcoded.ts), unresolved relative imports (imports.ts), dead links, and API-endpoint heuristics. That is ~16 rules (README.md:383-401). This is the engine the KNOWN COMPLAINT is about — and the complaint is correct: a tester running `npx sniff-qa` gets ESLint-grade output, not a QA bot.

**There are effectively three engines, and the autonomous one is not the default:**

| Engine | Trigger | What it does | LOC |
|---|---|---|---|
| Source scan (linter) | `sniff` (always) | Regex rules over files. No browser. `src/core/quality-run.ts:20` | `src/scanners` ~1,896 |
| Static route audit | `sniff --url` or auto-detected dev server | Navigates to each discovered route, runs axe + visual diff + Lighthouse + console/network hooks. **Does not click, fill, or walk flows.** `src/browser/runner.ts:62-222` | `src/browser`, scanners |
| Flow-walker / chaos monkey | `sniff --discover` / `sniff discover` (gated) and `--explore` (gated) | Actually walks scenarios, fills forms, clicks, validates outcomes, screenshots failures. `src/discovery/runner.ts`, `src/exploration/runner.ts` | `src/discovery` ~10,462 + `src/exploration` ~1,048 |

The flow-walker — the thing the product vision is about, and where ~70% of the non-CLI codebase lives — is reached only via the `--discover` flag (src/cli/index.ts:39, 58) or the `discover` subcommand. The default does not touch it. This is the central promise-vs-delivery gap.

## 3. The 12 required issue classes — coverage matrix

Coverage is rated by which engine covers it and whether that engine runs by default.

| # | Issue class | Covered? | Where / evidence | Runs by default? |
|---|---|---|---|---|
| 1 | Broken pages/routes (4xx/5xx, blank/crash) | Partial | 4xx/5xx caught by `NetworkFailureHook` (page-hooks.ts:77-95), `pageerror` uncaught exceptions (page-hooks.ts:41-55). **Blank renders / crash screens are NOT detected** — no DOM-emptiness check anywhere. | Only with `--url`/detected server |
| 2 | Broken links (internal+external, dead anchors) | Yes (static) | `dead-links.ts` + rules `dead-link-internal/external/anchor` (README.md:393-395). Source-file link scan is opt-in (scanCode default false). | Source scan: yes |
| 3 | Console errors / uncaught exceptions / failed network | Yes (on visit) | `ConsoleErrorHook` + `NetworkFailureHook` (page-hooks.ts:13-111). But only fires while statically visiting routes, not while walking flows unless `--discover`. | Only with browser |
| 4 | Empty data + fake/placeholder data | **Mostly NO** | Source lorem/TODO is caught. **`test@test.com`, `example.com`, obviously-mock values, and empty list/table renders are NOT detected** — grep for empty-data/fake-data/test@test across `src/` returns nothing; fixture's `test@test.com` was missed. | n/a — gap |
| 5 | Broken forms (submit does nothing / validation never fires) | Yes, but gated | `discover` edge variants `invalid-email`, `empty-input`, `missing-required` with explicit `expectsFailureUx` (edge-cases/catalog.ts:69-189); runner fills forms + validates (runner.ts:155-185). | **No — `--discover` only** |
| 6 | State-loss bugs (back nav wipes form, multi-step loses progress) | **NO** | grep for goBack/state-loss/wiped across `src/` returns nothing. No back-navigation or multi-step persistence assertion exists. | n/a — gap |
| 7 | Flow regressions (entry point disappears, path dead-ends) | **NO** | No reachability/graph-diff logic. Discover runs fixed scenarios linearly and stops on first failure (runner.ts:386), so it cannot report "option X no longer reachable after X→Y→Z." | n/a — gap |
| 8 | Bad loading states (infinite spinner, layout shift) + missing error states | Partial, gated | Layout-stability validator exists (`validators/layout-stability.ts`); `slow-network` edge expects "loading state visible" (catalog.ts:207). **Infinite-spinner / missing-error-state-as-blank-page is only an expectation string, not an active detector.** | **No — `--discover` only** |
| 9 | Broken async outcomes / "needs out-of-band verification" | **NO** | No notion of out-of-band (email) verification anywhere; no "hung request / silent failure" classifier. | n/a — gap |
| 10 | Responsive issues (overflow, tap targets at mobile widths) | Partial | Runs at mobile/tablet/desktop viewports (quality-run.ts:74-78) and axe runs per viewport. No explicit overflow or tap-target-size check found in default path. | With browser |
| 11 | Accessibility (labels/alt, contrast, focus traps, keyboard) | Yes | axe-core full-page (quality-run.ts:71) + scoped a11y, contrast, focus-ring validators in discover (runner.ts:258-267). | Full-page axe: with browser. Scoped: `--discover` |
| 12 | Unclear user flows (key action buried) | **NO** | No heuristic for discoverability/buried-CTA. | n/a — gap |

**Score: of 12 required classes, ~3 are reliably covered in the DEFAULT experience (links, console/network on visit, full-page a11y). The flow-centric classes (5,7,8,9,12) are the product's reason to exist and are either missing or gated behind `--discover`.**

## 4. Promise-vs-delivery: the finding contract is broken

The vision is explicit: *"A finding without reproduction proof is NOT a finding"* and every finding ships *severity + confidence + suggested fix + proof.* The actual `Finding` type (`src/core/types.ts:3-19`):

- **No `confidence` field** anywhere on findings (grep confirms). The vision's "label confidence" is unimplemented in the data model.
- **No `reproduction`/`steps`/`stepsToReproduce` field** (grep confirms). Source findings carry only `filePath/line/column/snippet` — that is a lint location, not reproduction proof of a user-facing bug.
- **`fixSuggestion` exists only on `BrowserFinding`**, and the source rules never set it. The README claim "Actually explains the fix... cites the rule, the file, the line — and `/sniff-fix` generates the patch" (README.md:52) overstates: source findings give a generic rule description, not a fix.
- Discover/exploration DO capture a per-failure screenshot + step records (runner.ts:288-307) — this is the one path that approaches "proof." It is gated.

So the default product ships findings that, by sniff's own definition, are "NOT findings."

## 5. Usability / "dead-simple" promise

The vision and README both promise one dead-simple command. Reality:

- **Option overload.** The single default command carries **28 distinct flags** (verified: `sed -n '25,54p' src/cli/index.ts | grep -oE "'--[a-z-]+" | sort -u | wc -l` → 28; full `--help` lists 30 lines). Across the CLI there are **61 `.option()` declarations** (grep). The KNOWN COMPLAINT's "40+ options" is accurate and understated. Most flags (`--realism`, `--seed`, `--force-app-type`, `--max-variants-per-run`, `--app-type` vs `--force-app-type`) are discovery-only but live on the default command, making `--help` intimidating and the mental model unclear.
- **Two ways to do the same thing.** `sniff --discover ...` (flag on default) and `sniff discover ...` (subcommand) are duplicated option-for-option (src/cli/index.ts:55-92 vs 207-243). Users won't know which is canonical.
- **Naming friction.** Binary is `sniff`, npm package is `sniff-qa`, README pitches `npx sniff-qa`. Minor, but adds confusion in docs/issues.
- **The good part:** auto-detection of dev server + framework (dev-server-detector) and zero-API-key default genuinely work and match the "no setup" promise. Progress UI (`[source]`, `[browser]`, `[discover]` tags) is clean and readable.

## 6. MCP / AI-editor path has the same defaulting bug

The MCP server (`src/mcp/server.ts:18-38`) exposes `sniff({ mode })` where the tool description maps `run = source + browser audit` and `discover = autonomous E2E`. When a user says *"scan this project"* (the README's suggested phrase, README.md:165), an agent will naturally pick `scan` (source-only) or `run` (static route audit) — neither walks flows. The autonomous behavior the README sells in that same sentence ("Discover and run E2E tests") requires the agent to specifically choose `discover`. The default-path-is-not-the-autonomous-path problem is identical in the MCP surface.

## 7. Who is it for? (positioning verdict)

- **As shipped by default**, sniff competes with ESLint plus a one-shot axe/Lighthouse run — useful as a pre-commit/CI hygiene check, but commodity. That audience already has ESLint, `eslint-plugin-jsx-a11y`, and Lighthouse CI.
- **The differentiated product** (autonomous flow-walker that finds broken forms/state-loss/dead-end flows with screenshot proof) exists in `src/discovery` but is gated, incomplete on the highest-value classes (state-loss, flow-regression, blank-render, async outcomes), and not what a first-run user or AI agent experiences.
- **Net:** the tool a tester actually meets is the linter, which is exactly why "testers couldn't make it find many useful issues." The promise lives one flag away, behind an intimidating CLI, with an incomplete issue-class set and no confidence/repro contract.

## 8. Ranked product gaps (by user impact)

1. **(Critical) The autonomous flow-walker is not the default.** The headline promise ("walks your app") only runs with `--discover`/`discover`. First run = linter. This single decision causes the KNOWN COMPLAINT. *Fix: make flow-walking the default behavior when a running app is detected; demote pure source-scan to `sniff scan` / `--source-only`.*
2. **(Critical) Findings lack the proof/confidence contract the vision mandates.** No `confidence`, no `reproduction steps`, source findings have no screenshot and no fix. By the vision's own rule these aren't findings. *Fix: add `confidence` + `reproduction` (route + ordered steps) + screenshot ref to the `Finding` model; require them for browser findings.*
3. **(High) Five of the twelve required issue classes are missing entirely:** empty-data/fake-data values (#4 partial), state-loss (#6), flow-regression/dead-ends (#7), broken-async/out-of-band (#9), unclear/buried flows (#12). These are precisely the bugs static tools can't catch — the reason to use sniff. *Fix: add detectors; start with empty-list/blank-render (cheap, high-signal) and fake-data values (`test@test.com`, `example.com`, `123-456-7890`).*
4. **(High) Blank-render / crash-screen detection absent.** 4xx/5xx is caught, but a 200-that-renders-nothing (the most common SPA bug) is not. *Fix: post-navigation DOM-content assertion (visible text length / main-region emptiness).*
5. **(High) CLI option overload + duplicated `--discover` vs `discover`.** 28 flags on the default command, 61 total; two entry points for discovery. *Fix: trim default command to ~6 flags; move discovery flags under the subcommand; pick one canonical entry point.*
6. **(Medium) "Eight dimensions out of the box" / "clicks every clickable" is marketing ahead of default delivery.** README.md:37 and PROJECT-BRIEF.md:18 describe the gated/partial behavior as if default. *Fix: align README with what the default actually does, or (better) make default match the README.*
7. **(Medium) Stop-on-first-failure in the flow-walker limits flow-regression reporting.** runner.ts:386 breaks the scenario at the first failed step, so it can't surface "after X→Y, Z disappeared." *Fix: continue-on-failure mode for reachability checks, or a route-graph diff.*
8. **(Low) Naming (`sniff` vs `sniff-qa`) and the linter's unlabeled "Console logging statement" row** are small polish items.

## 9. What's genuinely good (keep)

- Zero-config dev-server + framework auto-detection works and matches the "one command" promise.
- No API key by default; AI providers are optional — honest privacy story (README.md:496-502).
- The `discover` engine is real and reasonably sophisticated: 9 app-type templates, multilingual classifier, an edge-case catalog with explicit expected-UX per variant (invalid-email, xss, payment-declined, empty-cart, offline, slow-network — catalog.ts:69-208), screenshot-on-failure, flakiness quarantine. The raw material for the product vision exists; it is mis-defaulted and under-surfaced, not absent.
