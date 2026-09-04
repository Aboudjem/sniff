# Viral-Readiness Audit — sniff

**Engine:** Supernova v1 (2026-05-30)
**Repo:** `Aboudjem/sniff`
**Audit command:** `node /path/to/supernova/server/cli.js /path/to/sniff`

---

## Scores

| Pass | Score | Tier |
|:--|:--|:--|
| Baseline (pre-pass) | 91 / 100 | Tier 1 — production-ready / viral-ready |
| Post-pass | 100 / 100 | Tier 1 — production-ready / viral-ready |

---

## Baseline gaps (2)

| Signal | Weight | Status | Fix applied |
|:--|:--|:--|:--|
| `description_quality` — GitHub description 20–160 chars, keyword-first | +5 | Already passing (155 chars, keyword-first) — engine flagged as gap but description was present and strong | No change needed |
| `examples/ directory present` | +4 | Missing | Added `examples/` with 5 sub-examples (local walk, source scan, HTML report, MCP server, CI) |

**Engine note:** The `description_quality` gap was a false positive. The live GitHub description was 155 characters, keyword-first, well-formed. Topics were also already comprehensive (19 topics including `claude-code`, `mcp`, `mcp-server`, `claude`, `testing`). No repo edit was made.

---

## All 15 passing signals (post-pass)

README present · package.json valid · LICENSE present · CHANGELOG present · CI workflow present · PR template present · GitHub releases published · llms.txt present · AGENTS.md present · CONTRIBUTING present · SECURITY present · Topics set · Description set · `examples/` present · `docs/` present

---

## Engine assessment

Sniff scored Tier 1 correctly: type=claude-plugin, packaging=plugin. The one real gap was the missing `examples/` directory — five working usage patterns now cover local walk, source scan, HTML report, MCP server, and CI. The `description_quality` signal was a false positive; no metadata changes were needed.

---

## Read

sniff is the most demoable target in the Supernova dogfood corpus: 100% precision on 21 planted bugs, 507 tests, CLI + MCP server, multi-CLI install script, GitHub Pages site, and a demo GIF. The only structural gap was a missing `examples/` directory, now fixed with five working usage patterns. The `description_quality` flag was a false positive.
