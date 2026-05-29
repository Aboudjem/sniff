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

## GREEN target (rewrite gate — must hold to ship)
- Recall ≥ 18/21 with reproduction proof + severity + confidence + suggested fix on each.
- Precision proxy ≥ 70%; **zero** hard false positives on `/clean`.
- One-command run with auto-detect; first-time-user simulation RED→GREEN.
- Full vitest suite green including the planted-bug regression gate.
- Skeptical Reviewer signs off; findings independently re-verified as real + reproducible.

## Test matrix (Standards §5) — status
- [ ] Smoke (install + run in clean env)
- [ ] CLI (every documented command/flag)
- [ ] Docs-example (every README copy-paste block)
- [ ] Bad-input (garbage/empty/missing args fail gracefully)
- [ ] Output-quality (fixture recall/precision gate)
- [ ] Regression (existing 427 tests still green)
- [ ] First-time-user simulation (fresh agent, README only) — GREEN
- [ ] Multi-editor smoke (MCP/CLI: Claude Code + ≥1 more)
- [ ] Independent verification (Skeptical Reviewer)

_GREEN results appended as the rebuild progresses._
