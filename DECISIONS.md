# DECISIONS

Major decisions for the sniff QA-engine rebuild. Each carries the standard evidence block
(Evidence · Confidence · Risk · Expected impact · Test plan · Rollback). Dated 2026-05-29.
Audit artifacts: `docs/audit/`. RED baseline: `docs/audit/red/`.

---

## D1 — Rewrite the flow-traversal/assertion core into one goal-directed walker; make it the default

**Decision:** Build a new `src/crawl/` engine that drives a real browser, crawls same-origin, and runs
high-precision detectors + interaction probes that **assert outcomes and diff state**, emitting findings
with reproduction proof + severity + confidence + fix. Make it the **default** `sniff <url>` (and when a
dev server is auto-detected). Demote the regex source scan to `sniff scan`. Keep the legacy
`discovery/`+`exploration/` engines in-tree (tests still pass) but no longer on the default path; deprecate.

- **Evidence:**
  - Honest RED baseline (shipped v0.5.2 vs the 21-bug fixture, `docs/audit/red/`): **recall 9/21 (43%)**,
    **precision proxy 13%** (125 candidate false positives), 1 hard FP on the clean control page. The 12
    misses are exactly the interaction/runtime classes (empty data, broken forms, state-loss, dead-end,
    spinner, missing-error, silent-async, responsive, missing label).
  - The flagship `discover` flow-walker **crashes at startup** with an explicit `--url` ("No URL
    available"), exit 1, zero output — reproduced twice (`docs/audit/red/discover-diag.txt`).
  - Engine audit (`docs/audit/02-engine-architecture-audit.md`): 3 overlapping engines; the default
    `sniff <url>` only `page.goto`+passive scanners (never clicks/fills); `discovery/runner.ts:386`
    aborts at first failing step; `scenario.goal` is defined but **never asserted** (only read at
    `report/html.ts:74`); no state diffing anywhere; `page-hooks.ts` flags every console.error (`high`)
    and every HTTP≥400/`requestfailed` (`high`/`critical`) with zero filtering.
  - QA capability matrix (`docs/audit/04-qa-capability-gap-matrix.md`): 0/12 classes fully covered;
    `reachability` validator is a declared type with no implementation.
- **Confidence:** `confirmed` (measured before/after-able; file:line + reproduced runs).
- **Risk:** A rewrite can regress existing behavior or introduce its own false positives. Mitigated by
  keeping legacy engines + their 427 tests intact, gating the new engine behind the planted-bug fixture
  (recall + precision thresholds) and an independent Skeptical Reviewer pass.
- **Expected impact:** Directly fixes the "testers couldn't find useful issues" complaint: lifts recall
  from 9/21 toward ≥18/21 with a precision proxy ≥70% and zero hard FPs on the clean page; makes the
  impressive behavior the default one-command run.
- **Test plan:** `sniff-tests/score-fixture.mjs` computes recall/precision against `MANIFEST.json`; a
  vitest regression gate asserts thresholds; unit tests per detector; CI runs the fixture scan.
- **Rollback:** The default path is a thin switch in the CLI; reverting to `unifiedCommand`'s static
  browser audit is a one-line change. Legacy engines remain shipped.

## D2 — Plugin (MCP server + CLI) primary, with a thin hybrid skill for the `/sniff` UX

**Decision:** sniff stays a **plugin** (npm CLI + MCP server) as the primary distribution, with a thin
skill that just invokes the MCP tool for the conversational `/sniff` UX. Rule used: *if the tool needs a
runtime/binary, a long-running process, or emits machine-consumed structured output, it's a plugin; a
skill is only prompt+instructions.*

- **Evidence:** sniff drives Playwright (a ~150 MB browser runtime), runs a multi-minute crawl, and emits
  structured findings consumed by agents and CI — none of which a pure skill can do. Reused research
  `02-plugin-spec.md` (single-plugin marketplace via github self-source; minimal manifest; skills
  auto-discovered). Existing `.claude-plugin/plugin.json` + `src/mcp/server.ts` already ship this shape.
- **Confidence:** `confirmed`.
- **Risk:** Low. Keeping the thin skill avoids forcing users to learn flags.
- **Expected impact:** Works first-class as MCP/CLI across Claude Code, Cursor, VS Code, Codex, Gemini,
  Windsurf, Continue; `/sniff` remains a one-liner.
- **Test plan:** Multi-editor MCP/CLI smoke (Claude Code + ≥1 more); MCP `sniff` tool returns findings.
- **Rollback:** n/a (no change in distribution model; this confirms the existing one with evidence).

## D3 — Collapse the default command surface; make `sniff` (no args) do the impressive thing

**Decision:** `sniff` with no args auto-detects the dev server and runs the flow-walk; `sniff <url>`
flow-walks a URL; `sniff scan` is the source-only regex scan. Trim the default command from 28 flags to
~6 (`--url`, `--mobile`, `--max-pages`, `--all`, `--json`, `--report`); move the rest behind subcommands.

- **Evidence:** Product audit (`01`): 28 flags on the default command, 61 total `.option()` calls, a
  duplicated `--discover` flag vs `discover` subcommand. DX friction is the second half of the complaint.
- **Confidence:** `confirmed`.
- **Risk:** Breaking existing flag users; mitigated by keeping legacy subcommands and aliases for a
  deprecation window, documented in CHANGELOG.
- **Expected impact:** First-run "time to first useful finding" drops; the README's promise matches the
  default behavior.
- **Test plan:** CLI tests for each documented command/flag; first-time-user simulation RED→GREEN.
- **Rollback:** Flags are additive; restore removed ones if needed.

## D4 — Trust mechanics: confidence gate, noise filter, proof on every finding

**Decision:** Every finding requires reproduction proof (route + ordered steps + screenshot and/or
console/network excerpt). Findings carry `confidence` (`confirmed`/`likely`/`uncertain`); `uncertain` is
suppressed from the default report (shown with `--all`). Network/console hooks are filtered (first-party
origin only; drop favicon/analytics/sourcemap/HMR; downgrade expected 401/403; ignore engine-induced
aborts). axe violations are reported as `confirmed` (axe is zero-false-positive by design).

- **Evidence:** Online research (`05`): the #1 reason QA tools are abandoned is unreproducible findings
  / alert fatigue (static analyzers hit >95% FPR; SonarQube reaches 3.2% via "only report what can
  actually happen"; axe emits zero FPs by design; QA Wolf requires steps+screenshot+logs). RED precision
  proxy of 13% with favicon-404 noise is the live proof of the problem.
- **Confidence:** `confirmed`.
- **Risk:** Over-suppression could hide real issues; mitigated by `--all` and by classifying, not
  dropping, uncertain findings.
- **Expected impact:** Precision proxy from 13% → ≥70%; zero hard FPs on the clean control page.
- **Test plan:** Fixture scorer asserts precision + zero `/clean` findings; unit tests for the noise filter.
- **Rollback:** Confidence/notice fields are additive; the filter can be disabled per-rule via config.
