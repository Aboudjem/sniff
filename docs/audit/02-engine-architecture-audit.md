# Sniff Engine & Architecture Audit

**Audit date:** 2026-05-29
**Auditor role:** Engine & architecture (flow-discovery core)
**Verdict (lead):** **TUNE the discovery engine; REWRITE the flow-traversal/assertion layer inside it.** The codebase is well-factored and most plumbing is reusable, but the part that is supposed to deliver the vision — an autonomous flow-walker that asserts outcomes and diffs state — does not exist in a usable form. It is template replay with no goal assertion, plus a default command that never walks flows at all.

---

## 1. What actually exists: three overlapping engines

There are three distinct browser-driving code paths. They do not share a traversal core.

### Engine A — "unified" / default `sniff` (source scan + shallow page audit)
- Entry: `src/cli/commands/unified.ts`, driver `src/core/quality-run.ts:62` (`runBrowserAudit`) → `src/browser/runner.ts:62` (`BrowserRunner.run`).
- Behavior: for each statically-discovered route (`routesFromAnalysis`, `quality-run.ts:38`), `page.goto(url, { waitUntil: 'networkidle' })` then run axe / visual / performance scanners and collect console/network hooks (`browser/runner.ts:113-215`).
- **It never clicks, fills, or follows a link.** It is a multi-route *page visitor*, not a flow walker. `src/browser/discovery.ts` (`discoverElements`) exists but is **not called by the unified runner** — it is dead relative to this path.
- This is what runs by default (`cli/index.ts:94-136`). The vision's flow-walking is therefore *off by default*.

### Engine B — discovery `--discover` (template/scenario replay)
- Entry: `src/cli/commands/discover.ts` → `src/discovery/runner.ts:437` (`runScenarios`).
- Pipeline: extract domain snapshot from source (`discovery/domain/index.ts`) → classify app type by keyword signatures (`discovery/classifier/index.ts`) → pick matching hand-written journey templates (`discovery/scenarios/index.ts` + 14 templates in `templates/index.ts`) → mutate into edge variants (`discovery/edge-cases/`) → replay step lists in Playwright (`discovery/runner.ts`).
- This is the closest thing to a flow engine, but it is **scripted replay of 14 fixed templates**, not autonomous exploration. See §2.

### Engine C — exploration `--explore` ("chaos monkey")
- Entry: `src/exploration/runner.ts` (`ExplorationRunner.explore`), provider `src/exploration/claude-exploration-provider.ts`.
- This *is* an agentic loop: extract page state → ask Claude (or deterministic fallback) for next action → execute click/fill/navigate/scroll → observe console/network → repeat to `maxSteps`.
- But it has **no goal, no per-step assertions, and no state diffing**. It only records findings that the passive console/network hooks happen to emit (`exploration/runner.ts:151-174`). A button that silently does nothing produces zero findings. It is a crash-finder, not a flow-verifier.

**Architectural problem:** three engines, three notions of "a route," three notions of "an action," zero shared assertion library between B and C. The vision needs ONE engine that (a) walks like C, (b) asserts like B, against (c) a goal. None of the three is that.

---

## 2. (a) Agentic crawl, or template replay? → **Template replay (Engine B); shallow visit (Engine A); agentic-but-blind (Engine C)**

Engine B, the headline "autonomous E2E discovery," is **scenario replay**:

- Scenarios come from 14 static templates keyed by app type (`discovery/scenarios/templates/index.ts:17-32`). Example: `templates/ecommerce/browse-to-purchase.ts` is a hard-coded 8-step list with literal selector hints like `[data-testid="add-to-cart"]` and role fallbacks `Add to Cart|Add to bag|Add` (lines 59-65).
- Template selection is keyword classification, not understanding: `classifier/index.ts` scores route/element/dep/schema token overlap against per-type signature dictionaries. No crawl of the live app informs scenario choice.
- Edge "variants" are deterministic mutations of those same templates (`edge-cases/catalog.ts`): swap in `not-an-email`, `<script>alert(1)</script>`, `'a'.repeat(10000)`, toggle offline, etc.
- The runner executes the fixed step list in order and stops at the first failing step (`runner.ts:386` `if (record.status === 'fail') break;`).

Consequence: if an app does not use the expected selectors/routes/vocabulary, templates either fail to generate (`requiresSatisfied`, `scenarios/index.ts:71-78`) or fail at step 1 on `resolveTarget`. The engine cannot adapt to the actual DOM it sees. **This is the root cause of "testers couldn't make it find many useful issues."**

## 3. (b) Does it ASSERT outcomes & diff state, or just visit? → **Mostly visit; assertions are shallow and the flow goal is never checked**

- **The scenario `goal` is decorative.** `scenario.goal` is defined on every template (e.g. "reach order-confirmation"), but is **only rendered in HTML** (`report/html.ts:74`) and is **never evaluated** in `runner.ts`. Grep confirms no read of `scenario.goal` in the runner. So "did the purchase actually complete" is never asserted unless a template author hand-added a final `expect: url-matches`.
- Per-step validations (`runner.ts:245-277`) are generic and selector-local: console-clean, network-clean, response-time<3s, target-visible, label-present, contrast, focus-ring, layout-stability. These check *hygiene around the element just touched*, not *did the intended state transition happen*.
- Outcome assertions exist only where a template hard-codes `step.expect` (`url-matches`, `text-visible`, `selector-visible`) — `validators/index.ts:116-175`. Templates use these sparsely (browse-to-purchase asserts URL on 4 of 8 steps).
- **No state diffing.** There is a `captureRegionSnapshot`/`compareSnapshots` (`validators/layout-stability.ts`) but it is a *pixel* diff of a clipped region for layout-shift, not a DOM/route/data-state diff. `getBoundingBox` (line 22) is a dead `return null` stub. There is no before/after comparison of list contents, form values, navigation reachability, etc. The vision's "fill form, navigate back, all wiped" (state-loss) and "after X→Y→Z a button disappears" (flow regression) classes are **structurally impossible** to detect with the current model.

## 4. (c) What does it require to run? → **No API key, no LLM required. Confirmed.**

- The default Claude integration is the **Claude Code CLI** invoked via `execFile('claude', ...)` (`discovery/llm/claude-code.ts:34`, `exploration/claude-exploration-provider.ts:75`). It uses `claude --print`, i.e. the user's existing CLI auth, never an API key in sniff. Matches CLAUDE.md "no API key."
- LLM is **optional everywhere**:
  - Discovery: LLM is only used for *classification tie-break*, and only when the top two app-type confidences are within 0.08 (`classifier/tiebreak.ts:36` `needsTieBreak`) AND `!--no-llm` AND `claude` is on PATH (`discover.ts:221-235`). If `claude` is absent, `resolveDiscoveryLLM` returns `null` and the run proceeds deterministically (`llm/index.ts:11-15`).
  - Exploration: `ClaudeExplorationProvider.decideNextAction` falls back to a deterministic heuristic on any error/ENOENT (`claude-exploration-provider.ts:20-34, 112-163`).
- `@anthropic-ai/sdk` is a dependency but the audited engine paths use the CLI, not the SDK. (The SDK appears reserved for `src/ai/` test generation, outside this audit's scope.)

**Implication for the vision:** the "no key" promise is real, but it also means the autonomous decision-making in Engine C degrades to a dumb breadth-first clicker whenever the CLI isn't present, with no goal and no assertions — so the "no key" default is weak.

## 5. (d) Where it will produce FALSE POSITIVES

- **Console errors are unfiltered.** `ConsoleErrorHook` (`page-hooks.ts:23-39`) flags *every* `console.error` and `pageerror` as **severity high**, with no allowlist for third-party scripts, analytics, browser-extension noise, sourcemap warnings, or expected dev-mode React warnings. Confirmed: grep found no ignore/allowlist logic in `page-hooks.ts`. On any real app this floods high-severity findings. **This violates the vision's "a finding without reproduction proof is not a finding."**
- **Network 4xx are over-flagged.** `NetworkFailureHook` (`page-hooks.ts:77-95`) flags any response ≥400 — including expected 401/403 on auth probes, 404 favicons, conditional 304-adjacent flows, and third-party beacons — as medium/high. No origin filter on the *response* hook (only the unified runner filters *navigation* origin).
- **`requestfailed` = critical** (`page-hooks.ts:97-111`) fires on canceled/aborted requests too (user-cancelled prefetch, `route.abort()` from the engine's own slow-network/offline preconditions). The engine can trip its own critical findings.
- **Selector-not-found is reported as a product bug.** `runner.ts:206-227` returns a failing step "target not found" when a template's selector hints don't match. This is usually a *template/app mismatch*, not a defect, but it surfaces as a scenario failure. High false-positive rate on any app not built to the templates' conventions.
- **`full-page-axe` only runs when every step passed** (`runner.ts:401`), so on the apps that need it most (broken flows) the a11y audit is skipped — a false *negative* coupled to the false positives above.
- **Layout-stability pixel diff** (`layout-stability.ts:77-82`) does a raw byte compare of PNG buffers; any animation, cursor blink, or anti-aliasing difference in the 16px-padded region produces a "layout shift" failure. Fragile.

## 6. (d) Where it will MISS the 12 required issue classes

| # | Class | Status | Why |
|---|-------|--------|-----|
| 1 | Broken pages/routes (4xx/5xx, blank, crash) | **Partial** | 4xx/5xx caught by hooks; **blank render / crash screen not detected** — no "is there meaningful content" check. Only statically-discovered routes are visited (Engine A); routes reachable only by interaction are missed. |
| 2 | Broken links (internal+external, dead anchors) | **Source-only** | `scanners/source/rules/dead-links.ts` checks links *in source* (and `scanCode:false` by default). No live in-page anchor crawl. Dead anchors/JS-driven links missed. |
| 3 | Console errors / exceptions / failed requests during interaction | **Yes, but noisy** | Caught, but unfiltered → false positives (§5). And only Engine B/C interact; default Engine A only on page load. |
| 4 | Empty data + fake/placeholder data | **Source-only + weak** | `placeholder.ts` greps source for lorem/TODO/FIXME/TBD. No *runtime* check for empty lists/tables or rendered placeholder data (`test@test.com`, mock values) in the live DOM. |
| 5 | Broken forms (submit does nothing, validation never fires/clears, valid input rejected) | **Weak** | Engine B can fill+submit, but with no goal assertion it cannot tell "submit did nothing." Edge variants *send* bad input but only assert via generic hooks; the documented `expectsFailureUx` strings (`edge-cases/catalog.ts`) are **never asserted** — they're comments. |
| 6 | State-loss bugs (back button wipes form, multi-step loses progress) | **Missing** | No state capture/diff across navigation. Not expressible in current model. |
| 7 | Flow regressions (button/entry point disappears after X→Y→Z) | **Missing** | No reachability graph, no before/after option-set diff. |
| 8 | Bad loading states / missing error states | **Missing** | Slow-network/offline preconditions exist, but only assert generic hooks; no "is a spinner stuck" or "did an error state render" check. Raw-stack-trace detection absent. |
| 9 | Broken async outcomes (no success state, hung request, silent failure) | **Missing** | No success-state assertion; `goal` unused. "needs out-of-band verification" tagging absent. |
| 10 | Responsive issues (overflow, tap targets) | **Partial** | Multiple viewports visited (Engine A); axe runs; but no horizontal-overflow or tap-target-size check specifically. |
| 11 | Accessibility (labels/alt/contrast/focus traps/keyboard) | **Best-covered** | axe-core scoped + full-page, focus-ring, scoped labels. Focus traps / full keyboard traversal not done. |
| 12 | Unclear user flows (key action buried) | **Missing** | No heuristic for discoverability. |

Net: of 12 classes, ~2 are solid (a11y, console/network-on-load), ~4 partial, ~6 missing or source-only. The missing ones (5–9, 12) are exactly the "real QA tester" behaviors the vision is sold on.

---

## 7. Reusable assets (why this is TUNE, not full REWRITE)

These are good and should be kept:
- **Playwright plumbing & hooks** — `browser/page-hooks.ts`, `browser/runner.ts` lifecycle, context/viewport handling. Solid; just needs noise filtering + screenshot-as-proof on every finding.
- **Domain extraction** — `discovery/domain/*` (Prisma/Drizzle/TypeORM/Zod/GraphQL/OpenAPI/forms/vocab). Genuinely useful seed knowledge for an agent.
- **Validator library** — `discovery/validators/*` and `validators/index.ts` expectation evaluator. Reusable assertion primitives.
- **Edge-case catalog** — `edge-cases/catalog.ts` mutation ideas are sound; they just need real assertions wired to `expectsFailureUx`.
- **Report/persistence/flakiness** — `discovery/report/*`, `persistence/*`. Fine.
- **Dependency-injectable runner** — `runScenarios(..., deps?)` is testable (`runner.test.ts`).
- **No-key Claude CLI integration** — keep as the optional "smart" layer.

What is NOT reusable / should be replaced:
- The **template-replay traversal model** (Engine B's core loop): fixed step lists + first-failure-abort + no goal assertion.
- The **blind chaos loop** (Engine C): drives a browser but asserts nothing meaningful.
- The **default page-visitor** as the headline product (Engine A): should not be what `sniff` does by default if the product is a flow-walker.
- `browser/discovery.ts` `discoverElements` (orphaned) and `getBoundingBox` stub (dead).

---

## 8. TUNE vs REWRITE — recommendation

**Verdict: TUNE the surrounding system + REWRITE the flow-traversal/assertion core into a single engine. Do NOT rewrite the repo.**

Concretely, the smallest credible path to the vision:

**Phase 0 — make the flow-walker the default (small, high-leverage).**
1. Collapse the default `sniff <url>` to run a *single* flow engine, not the page-visitor. Hide `--discover`/`--explore` behind the default; drop the 40-option surface to ~5 (`--url`, `--ci`, `--headed`, `--max-steps`, `--json`). (`cli/index.ts`, `unified.ts`)
2. Add console/network **noise filtering**: allowlist by origin (first-party only by default), drop favicon/analytics/sourcemap, downgrade expected-auth 4xx, ignore engine-induced aborts. (`page-hooks.ts`)
3. Attach a screenshot + exact step trace to **every** finding (proof requirement). Hooks already capture screenshots on severe; make it universal and structured.

**Phase 1 — unify B+C into one goal-directed walker (the rewrite, scoped).**
4. Build one loop: seed from `domain` snapshot + live `discoverElements`, choose next action (deterministic planner first; Claude CLI as optional ranker), **assert after every action** using the existing validator library, and **diff state** (URL set, DOM landmark set, list/table row counts, form field values) before/after each step.
5. Make `scenario.goal` (and an explicit success state) a first-class assertion the loop drives toward and reports on — closing classes 5, 8, 9.
6. Add a reachability/option-set diff across steps to cover classes 6, 7, 12.
7. Add runtime content checks: empty list/table detection and placeholder-data detection in the live DOM (class 4), blank/crash-screen detection (class 1).

**Phase 2 — keep templates as optional "hints," not the engine.** Convert the 14 templates into *goal seeds* the autonomous walker can consult, instead of rigid scripts that abort on selector miss.

Rationale for not doing a clean rewrite: the I/O, domain knowledge, assertion primitives, reporting, and no-key Claude integration are all serviceable and represent the bulk of the line count. The defect is concentrated in the ~600 lines of traversal logic across `discovery/runner.ts` and `exploration/runner.ts` plus the un-asserted `goal`. Replacing that core while reusing everything else is far cheaper and lower-risk than a greenfield rewrite, and it directly converts the 6 missing issue classes from "impossible" to "expressible."

**Confidence:** high on the architecture facts and file:line evidence (all read directly); medium on effort sizing (no runtime benchmark performed in this pass).
