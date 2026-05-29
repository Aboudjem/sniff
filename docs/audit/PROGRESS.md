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
- [~] 9. Safe implementation — NEW ENGINE BUILT (`src/crawl/`): GREEN 21/21 recall, 100% precision, 0 FP.
      PENDING: wire as default CLI path + MCP tool; demote source scan to `sniff scan`.
- [~] 10. Testing — fixture regression gate written (`test/crawl/fixture.test.ts`) + unit tests; full suite running.
      PENDING: CLI/bad-input/docs-example/multi-editor smoke.
- [ ] 11. Multi-agent verification — Skeptical Reviewer + GREEN first-time-user sim
- [ ] 12. Final report + next commands → `TOOLS_AUDIT_AND_REBUILD_REPORT.md`

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
