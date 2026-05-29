# Sniff rebuild — progress tracker

Durable phase tracker (survives compaction). Branch: `rebuild/qa-engine`.

## Phase status (12-phase template)
- [x] 1. Discovery & repo mapping — TS, ~21.7k LOC src, 427 tests green, typecheck clean, chromium installed. 3 engines mapped.
- [x] 2. Product audit — `docs/audit/01-product-audit.md`
- [~] 3. Technical audit / reproduce complaint — engine `02`, qa-gap `04` done; **RED baseline run in progress** (planted-bug fixture built: `sniff-tests/planted-bugs/`).
- [ ] 4. First-time-user simulation (fresh agent, README only) — RED
- [x] 5. Online research — `docs/audit/05-online-research.md`
- [x] 6. Competitive research — `docs/audit/06-competitive-research.md`
- [ ] 7. Plugin-vs-skill decision (Architect) — leaning plugin-primary (drives browser + long scan); hybrid thin skill for /sniff UX.
- [ ] 8. Improvement plan (ranked, evidence blocks) → `DECISIONS.md`
- [ ] 9. Safe implementation — engine rewrite of traversal/assertion core (gated by fixture + skeptical reviewer)
- [ ] 10. Testing — full suite incl. planted-bug regression gate → `TEST_REPORT.md`
- [ ] 11. Multi-agent verification — Skeptical Reviewer + GREEN first-time-user sim
- [ ] 12. Final report + next commands → `TOOLS_AUDIT_AND_REBUILD_REPORT.md`

## Note: missing artifact
- `docs/audit/03-dx-ux-audit.md` was NOT written (dx-ux agent failed to return structured output). DX concerns are covered by 01 (CLI overload, mis-default) + 04. Re-run if a standalone DX artifact is needed.

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
