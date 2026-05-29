# Sniff rebuild — progress tracker

Durable phase tracker (survives compaction). Branch: `rebuild/qa-engine`.

## Phase status (12-phase template)
- [x] 1. Discovery & repo mapping — TS, ~21.7k LOC src, 427 tests green, typecheck clean, chromium installed. 3 engines mapped.
- [x] 2. Product audit — `docs/audit/01-product-audit.md`
- [x] 3. Technical audit / reproduce complaint — engine `02`, qa-gap `04`; **RED baseline measured**: 9/21 recall, 13% precision, discover crashes. `docs/audit/red/`.
- [x] 4. First-time-user sim (DX): re-running dx-ux agent → `docs/audit/03-dx-ux-audit.md`. Fresh-agent README sim pending GREEN CLI.
- [x] 5. Online research — `docs/audit/05-online-research.md`
- [x] 6. Competitive research — `docs/audit/06-competitive-research.md`
- [x] 7. Plugin-vs-skill decision — plugin (MCP+CLI) primary + thin skill. `DECISIONS.md` D2.
- [x] 8. Improvement plan (ranked, evidence blocks) → `DECISIONS.md` (D1-D4).
- [x] 9. Safe implementation — NEW ENGINE (`src/crawl/`): GREEN 21/21 recall, 100% precision, 0 FP.
      WIRED: default `sniff [--url]` → flow-walk (real CLI smoke 21/21); `sniff scan` = source-only;
      no-app guidance added; legacy `discover --url` crash fixed; MCP `sniff` tool gains `walk` mode
      (recommended) + HTML report (`--report`).
- [x] 10. Testing — 441 tests pass incl. fixture regression gate; CLI smoke (flow-walk/report/scan/
      discover) + MCP stdio smoke (mode:walk, 20 findings/6 pages) ✓.
- [x] 11. Multi-agent verification — Skeptical Reviewer CONFIRMED (GREEN, incl. clean-site 0-findings
      anti-overfit + exact RED reproduction); first-time-user sim MIXED → 2 friction points fixed
      (CLI '✓ Scan complete'/exit-code line + README). Artifacts: SKEPTIC-REVIEW.md, FIRST-TIME-USER-SIM.md.
- [x] 12. /repo-polish (README, llms.txt, AGENTS.md, how-it-works.svg, demo.svg, CHANGELOG 0.6.0, CI,
      skill) + TOOLS_AUDIT_AND_REBUILD_REPORT.md + RELEASED: bumped 0.6.0, merged main, tagged v0.6.0,
      pushed (commit a0ac124). About description updated. ci.yml running on the release commit.

## Remaining (left to the user — deliberately not done autonomously)
- npm publish of 0.6.0 (irreversible/broad) — release.yml needs a chromium step + trusted-publishing
  confirmation; documented in the final report's "next commands".
- Manual upload of .github/assets/social-preview.png via repo Settings (no API).

## New engine (`src/crawl/`) — shipped modules
types, noise (filter), evidence (per-page console/network), crawler (BFS + link-check),
detectors/{page-health, runtime-errors, content, a11y, responsive, forms, loading, flow}, engine, index.
Exported from `src/index.ts` (`runCrawl`, `formatReportText`). Dev harness: `sniff-tests/run-crawl.mjs`.

## RED→GREEN (planted-bug fixture)
| | RED v0.5.2 | GREEN new engine |
|---|---|---|
| recall | 9/21 | 21/21 |
| precision proxy | 13% | 100% |
| FPs | 125 + 1 hard | 0 + 0 |

## Consolidated verdict (from audit)
TUNE the system + REWRITE the flow-traversal/assertion core into ONE goal-directed walker:
discover flows (live DOM + optional Claude CLI ranker) → act → **assert outcome + diff state** →
deterministically reproduce → emit finding with proof (steps + screenshot + console/network) +
severity + confidence + fix. Make the flow-walk the DEFAULT. Add noise filtering + confidence gate +
baseline diffing. Add detectors for the 5 missing classes (empty/fake data, state-loss,
flow-regression, broken-async, unclear-flow) + blank-render + responsive overflow.

## Success criteria (must ALL hold to finish)
1. Fixture: finds real issues w/ proof+severity+confidence+fix at low FP; before/after measured.
2. One-command run w/ auto-detect; first-time-user sim RED→GREEN.
3. plugin/skill/hybrid decided w/ rule+evidence; multi-editor (MCP/CLI) tested.
4. Full test suite green incl. planted-bug regression gate; Skeptical Reviewer signed off.
5. /repo-polish: SVG hero, dead-simple README, llms.txt, AGENTS.md, CONTRIBUTING, CoC, SECURITY, CHANGELOG, demo, CI green.
6. Deliverables written; released (bump+tag+CHANGELOG+push).
