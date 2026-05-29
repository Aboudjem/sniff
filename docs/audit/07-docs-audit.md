# Docs Audit — Sniff v0.5.2

**Auditor role:** Docs specialist  
**Date:** 2026-05-29  
**Files reviewed:** README.md, AGENTS.md, CONTRIBUTING.md, CHANGELOG.md, skills/sniff/SKILL.md, PROJECT-BRIEF.md, package.json, docs/VIDEO-PLAN.md, .github/assets/ (full inventory), .github/description.txt, smithery.yaml  
**Bar:** A stranger lands on GitHub → reads README → thinks "OMG I need this" → gets a useful result in under 5 minutes.

---

## Executive summary

The README is well-structured and visually rich, but it systematically over-promises the default `npx sniff-qa` experience. A first-time user who runs that command against a project with no running dev server will get a **source scan only** — no browser checks, no accessibility, no visual regression, no performance, no flow-walking. The marketing copy says "eight checks, every time" and "autonomous flow-walker," but those require a running server or the `--discover` flag respectively. This expectation gap is the single most damaging trust issue in the docs.

Secondary problems: no `llms.txt`, no animated hero (logo blinks but is not an animated demo GIF or video embed), AGENTS.md is a GSD project scaffold with no sniff-specific agent guidance, the SKILL.md description contradicts the README (calls it mode=run not mode=scan), and the "Autonomous discovery" section buries the fact that `sniff discover` is a separate subcommand — not the default run.

---

## Finding 1 — "Eight checks, every time" over-promise

**Severity:** critical  
**Confidence:** confirmed  
**Evidence:** README.md line 49: "Eight checks, every time. Accessibility + visual regression + performance + dead links + API contracts + source scanning + broken imports + browser runtime hooks — out of the box."  
README.md line 213–215: "**Source checks** run on every scan. **Browser checks** run automatically when sniff detects a running dev server, or when you pass `--url`."

These two statements contradict each other in the same document. The second is accurate; the first is marketing copy that will anger users when they run `npx sniff-qa` on a project with no server and receive only source findings.

**Fix:** Replace "Eight checks, every time" bullet with a two-tier description: "Source checks (always): dead links, broken imports, API contracts, source scanning. Browser checks (when a server is detected or `--url` is set): accessibility, visual regression, performance, runtime hooks." Add a one-liner callout immediately after the `npx sniff-qa` code block: "> Source checks always run. Browser checks run automatically if your dev server is already up."

---

## Finding 2 — Default run framed as "autonomous flow-walker"; it is not

**Severity:** high  
**Confidence:** confirmed  
**Evidence:** README.md line 16: "Sniff is a tiny CLI that reads your source, opens your app in a headless browser, and hunts down bugs…"  
README.md line 47: "`npx sniff-qa` auto-detects your framework, your dev server, your test scenarios."  
README.md line 37: "…hunts down bugs across **eight dimensions** — functional, visual, accessibility, performance, dead links, API endpoints, broken imports, and optional AI-assisted exploration."  
Actual behavior: `npx sniff-qa` with no running server = source scan only. Autonomous flow-walking = `sniff discover` (separate subcommand, requires a running server, gated behind `--explore` for AI). The word "optional" applies to AI exploration, but the rest of the copy implies a headless-browser walk happens on every default run.

**Fix:** The 30-second pitch needs a single sentence to set the two-tier expectation: "Source checks run in 30 seconds with no server. Point it at a running app and it adds browser checks. Add `--explore` for the AI flow-walker."

---

## Finding 3 — No "first-run experience" walkthrough

**Severity:** high  
**Confidence:** confirmed  
**Evidence:** "Get started" section (README.md lines 58–74) shows two commands but gives no sample output and no success/failure definition. A new user does not know what to expect: will it exit 0 silently? Print a table? Open a browser? The VIDEO-PLAN.md (line 30, docs/VIDEO-PLAN.md) acknowledges this gap — "make someone install sniff before the clip ends" — but the video has never been recorded.

**Fix:** Add a collapsible "What you'll see" block beneath the `npx sniff-qa` command. Embed the `report-light.svg` inline (it already exists at `.github/assets/report-light.svg`) and describe each section of the output (findings table, severity legend, file:line references). A 30-second asciinema cast embedded as a GIF would convert better than static SVGs.

---

## Finding 4 — `sniff discover` not positioned as the power feature

**Severity:** high  
**Confidence:** confirmed  
**Evidence:** "Autonomous discovery" is the fifth H2 section, appearing after CI integration (README.md line 429). The product vision (SNIFF PRODUCT VISION system prompt, confirmed in PROJECT-BRIEF.md lines 14–17) defines the core value as "AUTONOMOUSLY WALKS the app's real user flows." The CHANGELOG (line 45–53) shows `sniff discover` was the 0.4.0 headline feature. Yet the README buries it after CI and makes `sniff discover` look like an advanced/optional add-on.

**Fix:** Elevate `sniff discover` to a second top-level section right after "Get started." Add a usage card:
```bash
sniff discover          # walk every user flow, report what broke
sniff discover --dry-run # preview scenarios first
```
Clarify the relationship: "`sniff` (without discover) = fast source + runtime audit. `sniff discover` = full autonomous flow-walker."

---

## Finding 5 — No `llms.txt`

**Severity:** high  
**Confidence:** confirmed  
**Evidence:** `find /Users/adamboudj/projects/sniff -name "llms.txt"` returned no output. The sniff product is explicitly positioned for AI-editor users (MCP, Claude Code, Cursor). A `llms.txt` at the repo root (and optionally at a public URL) is standard for tooling that AI agents consume. Without it, agents crawling the repo have no machine-readable summary of what the tool does, its API surface, or its boundaries.

**Fix:** Create `llms.txt` at the repo root with: one-paragraph summary, the three operating modes (source scan / browser audit / discover), MCP tool signatures (`sniff({mode})`, `sniff_install`), config schema keys, all rule IDs, and a "what this tool does NOT do" section.

---

## Finding 6 — AGENTS.md contains no sniff-specific agent guidance

**Severity:** high  
**Confidence:** confirmed  
**Evidence:** AGENTS.md (reviewed in full) is a GSD project scaffold generated by the OMC workflow. It contains generic workflow enforcement boilerplate (lines 44–55: "Before using Edit, Write, or other file-changing tools, start work through a GSD command…"), stack/architecture/conventions stubs marked "not yet documented," and no content about how an AI agent should invoke sniff, what the MCP tools return, or how to interpret findings. Any AI that reads AGENTS.md gets no actionable information about sniff itself.

**Fix:** Replace AGENTS.md with a sniff-specific agent guide covering: (1) available MCP tools and their mode options, (2) how to invoke `sniff_install` when setup is missing, (3) recommended workflow (scan → triage by severity → fix → re-scan), (4) output schema (finding shape: rule, file, line, severity, confidence, message), (5) deprecated tool names (`sniff_scan`, `sniff_run`, etc.), (6) what the agent should NOT do (e.g. don't pass `baseUrl` manually — let sniff auto-detect).

---

## Finding 7 — "No API keys" claim is misleading for browser checks

**Severity:** medium  
**Confidence:** confirmed  
**Evidence:** README.md line 75: "No API keys. No manual Playwright install." README.md line 185: "Browser checks auto-install the configured Playwright browser projects on first CLI run."  
The first claim is technically true (no AI API key), but Playwright browser binaries (~100–300 MB per browser) are downloaded silently on first run. For users behind corporate proxies or air-gapped environments this is a surprise "install." The MCP path is even more opaque: it returns `needsSetup` and asks the caller to run `sniff_install` separately (README.md line 167), but there is no explanation of what that download involves or how large it is.

**Fix:** Add a parenthetical to the "No manual Playwright install" claim: "Playwright browser binaries (~150 MB for Chromium) are downloaded automatically on first browser scan — no manual steps, but you'll need internet access the first time." In the MCP section, clarify that `sniff_install` downloads browser binaries, not sniff itself.

---

## Finding 8 — SKILL.md uses `mode: "run"` but README says default is source + auto-detect

**Severity:** medium  
**Confidence:** confirmed  
**Evidence:** skills/sniff/SKILL.md line 13: `mode`: `"run"` with instruction "Do NOT pass `baseUrl`". README.md line 192: `npx sniff-qa` = "scan source + auto-detect dev server". The `run` mode in MCP implies browser checks, while the README's default is source-first with browser as optional upgrade. The SKILL.md also references the deprecated `sniff_run` and `sniff_scan` tools (lines 17–18) as fallbacks without noting their removal timeline (v0.7 per README.md line 167).

**Fix:** Update SKILL.md to use `mode: "scan"` (unified entry point, per README.md line 167) and document the needsSetup fallback path. Remove `sniff_run`/`sniff_scan` from the example or mark them clearly deprecated with the v0.7 removal note.

---

## Finding 9 — `--explore` flag vs AI explorer description is confusing

**Severity:** medium  
**Confidence:** confirmed  
**Evidence:** README.md line 49: "…optional AI-assisted exploration" — framed as one of eight dimensions that is simply "optional." README.md line 269: "`--explore`: Opt into AI-assisted exploration after browser checks." README.md line 270: "`--no-explore`: Compatibility flag; exploration is off by default." The existence of `--no-explore` as a "compatibility flag" implies it was once on by default, which contradicts "off by default" and will confuse readers. CHANGELOG 0.5.1 line (README.md line 266 area) confirms "Explore is now opt-in."

**Fix:** Remove `--no-explore` from the flags table entirely (or move it to a "legacy/compatibility" note). Rename the dimension label in the "eight checks" list from "optional AI-assisted exploration" to "AI flow-walker (opt-in via `--explore`)" so the opt-in nature is clear at first mention.

---

## Finding 10 — No comparison table in README (promised in PROJECT-BRIEF.md)

**Severity:** medium  
**Confidence:** confirmed  
**Evidence:** PROJECT-BRIEF.md lines 23–34 contains a comparison table (Playwright, Cypress, mabl, Stagehand, etc.) and line 118: "**Comparison table:** Sniff vs mabl vs Cypress vs Playwright." CHANGELOG 0.2.0 line: "Comparison table expanded with dead link checking, API endpoint discovery, and cross-reference engine rows" — this references a table that appeared in a prior README version but is absent from the current README.md (confirmed by full read: no comparison table exists between lines 1–526).

**Fix:** Re-add the comparison table (5–6 rows: Playwright, Cypress, mabl, Stagehand/BrowserBase, Checkly, Sniff) under a "Why Sniff?" H2 or as a collapsed `<details>` block. This is the highest-converting README element for developer tools — "why trust it" is one of the five required polish-bar elements.

---

## Finding 11 — No animated SVG hero / no demo GIF or video embed

**Severity:** medium  
**Confidence:** confirmed  
**Evidence:** `grep -c "animate" /Users/adamboudj/projects/sniff/.github/assets/sniff-diagram.svg` = 5 (the diagram has animations). `grep -c "animate" /Users/adamboudj/projects/sniff/.github/assets/pipeline-light.svg` = 0. The logo SVG blinks (per docs/VIDEO-PLAN.md line 57). However, no demo GIF, no asciinema recording, no video embed, and no `user-attachments` video URL appears in README.md. VIDEO-PLAN.md (line 104) says "Ship Video 1 tonight" — this has not happened. The README links to `docs/VIDEO-PLAN.md` as "Demo videos" in the nav bar (README.md line 23), which leads to a planning doc rather than actual demos.

**Fix:** Record a 30-second asciinema cast of `npx sniff-qa` on a demo app (VIDEO-PLAN.md has the full script). Convert to GIF with `agg` and embed at the top of the README below the hero image. Update the "Demo videos" nav link to point to the actual YouTube URL once recorded. Until then, remove the nav link or change it to "Planned demos."

---

## Finding 12 — `sniff discover` flags table has `--verbose` listed twice

**Severity:** low  
**Confidence:** confirmed  
**Evidence:** README.md lines 451 and 466 both define `--verbose` in the `sniff discover` flags table: "Print classifier breakdown (top 3 guesses + matched signals per dimension)" and "Print classification breakdown (top 3 guesses + matched signals per dimension)." Same flag, near-identical description, appears twice in the same table.

**Fix:** Remove the duplicate row (line 466 version).

---

## Finding 13 — `sniff-qa` vs `sniff` binary naming inconsistency in docs

**Severity:** low  
**Confidence:** confirmed  
**Evidence:** README.md uses `npx sniff-qa` in most examples (lines 40, 42, 65, 68, 70, 309, 310, 418, 419) but the Commands section (lines 239–255) uses `sniff` without the `-qa` suffix throughout. CHANGELOG 0.5.2 line 14 explains: "`sniff-qa` is the npm alias; `sniff` is the installed binary." This distinction is not explained anywhere in the README. A user who runs `npx sniff` (package name is `sniff-qa`) will get a different package.

**Fix:** Add a one-line note in the "Get started" section: "The npm package name is `sniff-qa` (use with `npx sniff-qa` or `npm install -D sniff-qa`). Once installed, the local binary is named `sniff`."

---

## Finding 14 — Social preview exists but no "why trust it" / credibility section

**Severity:** low  
**Confidence:** confirmed  
**Evidence:** `.github/assets/social-preview.png` and `social-preview.svg` exist. README has no "trust signals" section: no download count mention, no "used by X projects," no testimonials, no case study link, no mention of the author's background (Shiftly v2 with 78 Playwright tests, as detailed in PROJECT-BRIEF.md line 126). The shields at the top provide version/CI/license signals but no adoption or credibility narrative.

**Fix:** Add a 2–3 sentence author context blurb and a "built on" badge section (already present at line 512–514). Move the "Built on Playwright · axe-core · Lighthouse…" footer to a more visible "Under the hood" section with logos. Add a downloads badge (`npm/dm/sniff-qa`) once the package has meaningful downloads.

---

## Finding 15 — CONTRIBUTING.md references `node dist/cli/index.js scan` but `scan` subcommand may not exist

**Severity:** low  
**Confidence:** uncertain  
**Evidence:** CONTRIBUTING.md line 22: `node dist/cli/index.js scan`. The Commands table in README.md (line 239–255) shows `sniff` (no subcommand) as the default, not `sniff scan`. The CLI structure likely has `scan` as an alias but this cannot be confirmed without running the binary. If `scan` is not a valid subcommand, the "Try the CLI locally" instruction in CONTRIBUTING.md will produce an error for new contributors.

**Fix:** Verify the CLI subcommand and update to the canonical form (likely `node dist/cli/index.js` with no subcommand, matching `npx sniff-qa`).

---

## Gap matrix: polish-bar checklist

| Element | Required by spec | Status |
|:--------|:-----------------|:-------|
| One-glance "what is this" | Yes | Partial — tagline exists but default behavior over-promised |
| 3-step "how to use" | Yes | Present but step 1 (source scan) vs step 2 (browser scan) not distinguished |
| Copy-paste commands | Yes | Present |
| FAQ / Q&A | Yes | Missing entirely |
| Comparison table | Yes | Removed from current README (was in earlier version per CHANGELOG) |
| "Why trust it" section | Yes | Missing — no credibility narrative, no downloads, no testimonials |
| `llms.txt` | Yes | Missing |
| Animated SVG hero | Yes | sniff-diagram.svg has 5 animate elements; logo blinks — but no demo GIF / video embed |
| Social preview | Yes | Present (social-preview.png exists) |
| AGENTS.md with agent guidance | Yes | Present but contains only GSD boilerplate, no sniff-specific content |

---

## Recommended fixes in priority order

1. **Fix the "eight checks, every time" over-promise** — add a clear two-tier callout immediately after the install command. This is the #1 trust damage item.
2. **Elevate `sniff discover`** — move "Autonomous discovery" to H2 position #2, right after "Get started," and add a usage card showing the two commands.
3. **Create `llms.txt`** — one-page machine-readable summary at repo root.
4. **Rewrite AGENTS.md** — sniff-specific agent guide: MCP tool signatures, output schema, deprecated tool names, recommended workflow.
5. **Record and embed a demo GIF** — 30-second asciinema cast per VIDEO-PLAN.md script. Until then, remove the "Demo videos" nav link or point it to a "coming soon" note.
6. **Re-add comparison table** — 5-row "Sniff vs. alternatives" in a `<details>` block.
7. **Add FAQ section** — at minimum answer: "Does it work without a dev server?", "Does it modify my code?", "What happens on first run (Playwright download)?", "How is `sniff` different from `sniff discover`?"
8. **Fix SKILL.md** — use `mode: "scan"`, remove deprecated fallback tools or mark them with v0.7 removal date.
9. **Add `sniff-qa` vs `sniff` naming note** in Get started.
10. **Remove duplicate `--verbose` row** from `sniff discover` flags table.
