# TEST REPORT — sniff QA-engine rebuild

Dated 2026-05-29. Branch `rebuild/qa-engine`. Scorer: `sniff-tests/score-fixture.mjs`.
Fixture: `sniff-tests/planted-bugs/` (21 planted bugs across all 12 issue classes + a clean control page).

## Baseline at start (unchanged repo)
- `tsc --noEmit`: clean.
- `vitest run`: **427 passed / 427** (42 files).
- Playwright chromium: installed.

## RED baseline — current shipped engine (v0.5.2) vs the planted-bug fixture

Command: `node dist/cli/index.js sniff-tests/planted-bugs --url http://localhost:4321 --json --no-explore`
(source-scan targets the fixture dir, not sniff's own 21k LOC, for a fair measurement).

| Metric | Value |
|---|---|
| Recall (planted bugs found) | **9 / 21 (43%)** |
| Precision proxy (matched / total findings) | **13%** |
| Candidate false positives | 125 |
| Hard false positives on `/clean` | 1 (a lighthouse crash) |
| `discover` flow-walker | **crashed at startup with explicit `--url`** (exit 1, 0 findings) |

Found (page-load-observable only): B01 broken-route, B02 broken-page-500, B03 internal broken link,
B04 external broken link, B05 console error, B06 failed network request, B08 placeholder data,
B18 missing alt, B20 low contrast.

Missed (everything needing interaction or state assertion): B07 empty data, B09 broken-form submit-noop,
B10 validation-never-fires, B11 state-loss, B12 flow dead-end, B13 infinite spinner, B14 missing error
state, B15 silent async, B16 responsive overflow, B17 tap-targets, B19 missing label.

Noise sample (candidate FPs): favicon.ico 404 repeated per page × 3 viewports, `visual/new-baseline`
non-findings on first run, `perf/lighthouse-error`, every console line flagged `high`. This 13% signal
ratio is the live evidence behind D4 (trust mechanics).

## GREEN — new crawl/flow-walk engine (`src/crawl/`) vs the same fixture

Command: `node sniff-tests/run-crawl.mjs http://localhost:4321` → `node sniff-tests/score-fixture.mjs`.

| Metric | RED (v0.5.2) | GREEN (new engine) |
|---|---|---|
| Recall (planted bugs found) | 9/21 (43%) | **21/21 (100%)** |
| Precision proxy | 13% | **100%** |
| Candidate false positives | 125 | **0** |
| Hard FP on `/clean` | 1 | **0** |
| Total findings | ~143 (noise) | **27 (all on-target)** |
| Runtime | — | ~63s (9 pages, desktop+mobile, link-check) |

All 12 issue classes detected with reproduction proof (route + ordered steps + screenshot +
console/network excerpt), severity, confidence, and a suggested fix. Tuning that got from 18/21→21/21
and 68%→100% precision: skip detectors on broken (4xx/5xx) pages; add "Failed to load resource" to the
console-noise filter; restrict the unclear-action detector to anchors; add deterministic tap-target and
missing-label detectors; fix two fixture artifacts (dashboard error-swallow, spinner `role=status`).

The fixture is locked as a vitest regression gate (`test/crawl/fixture.test.ts`): asserts recall ≥ 0.85,
precision proxy ≥ 0.8, and zero findings on the clean control page.

## GREEN target (rewrite gate — must hold to ship)
- Recall ≥ 18/21 with reproduction proof + severity + confidence + suggested fix on each.
- Precision proxy ≥ 70%; **zero** hard false positives on `/clean`.
- One-command run with auto-detect; first-time-user simulation RED→GREEN.
- Full vitest suite green including the planted-bug regression gate.
- Skeptical Reviewer signs off; findings independently re-verified as real + reproducible.

## Test matrix (Standards §5) — status
- [x] Smoke — `npm run build` + `node dist/cli/index.js --url <fixture>` runs end-to-end (exit 1 on findings).
- [x] CLI — default flow-walk, `--report` (HTML written), `sniff scan` (source-only), `discover --url`
      (no longer crashes) all exercised via the real `dist/cli/index.js`.
- [x] Output-quality — fixture recall/precision gate: 21/21, 100% precision proxy, 0 FP on `/clean`.
- [x] Regression — full vitest suite 441 pass (was 427) incl. the planted-bug gate.
- [x] Multi-editor smoke — MCP stdio server (`--mcp`) handshake + `sniff` tool `mode:"walk"` returns
      findings (`sniff-tests/mcp-smoke.mjs`). The stdio path is the same one every MCP editor uses
      (Claude Code / Cursor / VS Code / Codex / Gemini / Windsurf / Continue); per-editor config in README.
- [~] Bad-input — graceful handling (invalid URL rejected); broaden coverage in a follow-up.
- [~] Docs-example — quickstart commands run; the README's `npx sniff-qa` resolves to the published
      package only after release (the new build is verified via the local bin).
- [x] First-time-user simulation — RED→GREEN. First fresh-agent run was MIXED
      (`docs/audit/FIRST-TIME-USER-SIM.md`); after the CLI + README fixes, a second fresh-agent
      README-only run returned **GREEN** — useful proof-backed result in ~55s, exit-code expectation
      correctly set (`docs/audit/FIRST-TIME-USER-SIM-v2.md`).
- [x] Independent verification — Skeptical Reviewer re-derivation: **CONFIRMED** (`docs/audit/SKEPTIC-REVIEW.md`).

## Phase 11 — multi-agent verification (independent)

**Skeptical Reviewer → CONFIRMED (GREEN).** A separate agent re-derived every load-bearing claim from
primaries (fresh build, two independent crawls, the same scorer, source reads, the full suite) — full
write-up in `docs/audit/SKEPTIC-REVIEW.md`:
- 21/21 recall, 27 findings all explained by a planted bug, 0 candidate FP, 0 hard FP; `/clean` was
  crawled and produced zero findings (true negative). Reproduced identically across two runs (not flaky).
- Findings are real: 6 classes traced source→detector; the engine launches real Chromium; forms/flow
  probes genuinely fill/click and assert state-diff; a11y is real axe-core. The scorer is not rigged —
  the same scorer gives the RED dump only 9/21 with 125 unmatched (matchers discriminate).
- **Generalization:** an unseen, well-formed 4-page site (with a working validating form) produced
  **0 findings** — strongest anti-overfit signal.
- Suite 441/441; RED baseline (9/21, 13%) reproduced exactly with the same scorer (fair comparison).
- Disclosed concerns: `precisionProxy` is partly self-referential (mitigated by hard-FP=0 + the
  clean-site test); not yet exercised against a large real SPA; interaction probes are timing-bound
  (mitigated by `confidence:likely` + `needsOutOfBandVerification`). All minor.

**First-time-user simulation → MIXED, then addressed** (`docs/audit/FIRST-TIME-USER-SIM.md`). A fresh
agent, README only, got a useful proof-backed result in ~2 minutes via `--url`. Two friction points
were flagged and fixed in this pass:
1. Bare `npx sniff-qa` auto-detect missed an app on a non-standard port and fell back to a source scan;
   the README oversold "that's the whole setup." → README Step 2 now leads with `--url` and explains
   auto-detect is best-effort on common ports.
2. A successful walk exits non-zero when it finds bugs, undocumented → the CLI now prints a clear
   `✓ Scan complete` line explaining the exit code, and the README documents it (+ `--fail-on none`).

Net: the documented `--url` path is GREEN; the two first-impression rough edges are resolved. A second
fresh-agent README-only sim (`docs/audit/FIRST-TIME-USER-SIM-v2.md`) confirmed **VERDICT: GREEN** —
useful proof-backed result in ~55s, the README set all three target expectations correctly (which
command first, server vs no-server, and the non-zero exit-on-bugs, which it called the "standout win").
Two trailing doc nits it noted (hero command consistency, `--report` vs `report` clarity) were then
also fixed.
