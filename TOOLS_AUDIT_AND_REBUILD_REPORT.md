# sniff — Audit & Rebuild Report

**Date:** 2026-05-29 · **Author:** Adam Boudjemaa (`Aboudjem`) · **Branch:** `rebuild/qa-engine`
**Scope:** Audit, rebuild, test, verify, polish, release `sniff` so it reliably DISCOVERS and reports
real, useful QA issues with proof — and is dead-simple to run.

Supporting artifacts: `docs/audit/` (audit + research), `docs/audit/red/` (RED baseline),
`DECISIONS.md` (evidence-blocked decisions), `TEST_REPORT.md` (full test matrix), `sniff-tests/`
(the planted-bug fixture + scorer).

---

## 1. The complaint, reproduced (RED baseline)

Users reported sniff was "hard to use, doesn't work well, testers couldn't make it find many useful
issues." We reproduced this on a purpose-built **planted-bug fixture** (`sniff-tests/planted-bugs/`):
a zero-dependency app with **21 deliberately planted bugs across all 12 target issue classes** plus a
clean control page. Scoring the *shipped* engine (v0.5.2) against it:

| Metric | Shipped v0.5.2 |
|---|---|
| Bugs found (recall) | **9 / 21 (43%)** — only page-load-observable ones |
| Precision proxy | **13%** (125 candidate false positives) |
| False positives on the clean page | 1 |
| The flagship `discover` flow-walker | **crashed at startup** with an explicit `--url` |

It only found things visible on page load (HTTP status, console errors, axe, source placeholders). Every
class needing *interaction or state assertion* — broken forms, state-loss, dead-ends, missing error
states, silent async, responsive overflow — was missed, and real findings were buried under favicon-404
and visual-baseline noise.

## 2. Root cause (technical audit)

The standard agent roster + scouts (fanned out via the Workflow tool; artifacts in `docs/audit/`) found:

- **The default `sniff` run was a regex source linter, not the flow-walker.** The autonomous engine was
  gated behind `--discover`, and its subcommand crashed (a commander 14 conflict dropped `--url`).
- **Three overlapping browser engines, none truly autonomous.** The headline engine replayed 14
  hand-written templates, aborted at the first selector miss, and **never asserted the scenario goal**;
  no engine diffed state, so 6+ issue classes were structurally undetectable.
- **No trust model.** Every `console.error` and every HTTP ≥ 400 (favicons, analytics, expected auth)
  was flagged high/critical; findings had no confidence and no reproduction field.

Full evidence with file:line in `docs/audit/01`–`07`. Verdict (DECISIONS D1): **rewrite the
flow-traversal/assertion core into one goal-directed walker, make it the default**, reuse the rest.

## 3. What was rebuilt

A new, dependency-light engine in **`src/crawl/`** that behaves like a tireless QA tester:

1. **Crawls** the app same-origin from the start URL (live-DOM link discovery, normalized, budgeted).
2. **Acts** — clicks and fills real forms and multi-step flows.
3. **Asserts outcomes and diffs state** — did submit do anything? did the wizard preserve state? did the
   spinner ever resolve? is there an error state when a request fails?
4. **Proves** — every finding carries the exact route + ordered steps + a screenshot + the relevant
   console/network excerpt, a severity, a **confidence** (`confirmed`/`likely`/`uncertain`), and a fix.
5. **Filters noise** — first-party-only console/network, favicons/analytics/HMR/expected-auth/engine-
   aborts dropped; `uncertain` findings hidden by default; broken pages reported once.

It covers all **12 issue classes** via 8 detectors (page-health, runtime-errors, content, a11y [axe],
responsive, forms, loading, flow) plus a live-DOM link checker. axe-core (zero-false-positive by design)
backs the accessibility findings.

**Integration:** `sniff` / `sniff --url` now runs the flow-walk by default (source scan demoted to
`sniff scan`); no running app prints clear guidance instead of going silent; the MCP `sniff` tool gains
a `walk` mode (recommended) so an agent's "scan this project" walks the live app; `--report` writes a
self-contained dark-mode HTML report. The legacy `discover --url` crash was fixed.

## 4. Evidence — before/after (the rewrite gate)

Same fixture, same scorer (`sniff-tests/score-fixture.mjs`, rule-id-centric, shared with the regression
test):

| Metric | RED (v0.5.2) | GREEN (new engine) |
|---|---|---|
| Recall | 9/21 (43%) | **21/21 (100%)** |
| Precision proxy | 13% | **100%** |
| Candidate false positives | 125 | **0** |
| False positives on the clean page | 1 | **0** |
| Flagship command | crashed | works, and is the default |

- **Confidence:** `confirmed` — measured before/after, reproduced via the real CLI and the MCP stdio
  server, and locked as a regression test (`test/crawl/fixture.test.ts`: recall ≥ 0.85, precision ≥ 0.8,
  zero findings on the clean page).
- **Test suite:** 441 tests pass (was 427; +14 new) including the fixture gate. CLI smoke: real
  `sniff --url` → 21/21. MCP smoke: `mode:walk` over stdio → 20 findings on 6 pages.

## 5. Decisions

See `DECISIONS.md` (each with the standard Evidence · Confidence · Risk · Impact · Test · Rollback
block): **D1** rewrite-the-core (gated); **D2** plugin (MCP+CLI) primary + thin skill; **D3** collapse
the default command + make `sniff` do the impressive thing; **D4** trust mechanics (confidence gate,
noise filter, proof on every finding).

## 6. Testing

See `TEST_REPORT.md` for the full matrix (smoke, CLI, docs-example, bad-input, output-quality,
regression, first-time-user, multi-editor, independent verification).

---

## 7. How to use it

```bash
npx sniff-qa                       # walks your running dev server (auto-detected)
npx sniff-qa --url http://localhost:3000
npx sniff-qa --url http://localhost:3000 --report   # + self-contained HTML report
npx sniff-qa scan                  # source-only (no browser)
```
In an AI editor (MCP): "walk my app and find bugs" → the `sniff` tool, `mode:"walk"`.

## 8. The 8 outputs (deliverables + next steps)

1. **`TOOLS_AUDIT_AND_REBUILD_REPORT.md`** (this file) — what was found, rebuilt, and proven.
2. **`DECISIONS.md`** — every major decision with evidence + confidence.
3. **`TEST_REPORT.md`** — what was tested, the RED→GREEN numbers, what remains.
4. **Updated `README.md` + examples + `llms.txt` + `AGENTS.md`** — dead-simple, accurate to the new default.
5. **The new engine + fixture** — `src/crawl/` and `sniff-tests/planted-bugs/` (+ scorer + regression gate).
6. **Before/after metrics** — 9/21 → 21/21 recall; 13% → 100% precision proxy; 126 → 0 false positives.
7. **Release artifacts** — version bump, CHANGELOG entry, tag, push _(pending — see below)_.
8. **Next commands for you** _(filled at release)_.

<!-- RELEASE STATUS: pending Skeptical Reviewer sign-off, first-time-user GREEN sim, polish merge, and release. -->
