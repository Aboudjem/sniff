# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-05-29

Portability and discoverability layer: a multi-CLI installer, auto-discovery manifests, a GitHub Pages demo, and localized READMEs, on top of the earlier documentation polish. No change to the scanner engine or its findings.

### Added

- Multi-CLI installer: `install.sh` and `install.ps1` symlink the `/sniff`, `/sniff-fix`, and `/sniff-report` skills into a target CLI's skills directory, with `--update` and `--uninstall` and a one-line curl install. The MCP server stays the universal fallback.
- Auto-discovery manifests: `.cursor-plugin/plugin.json` and `.copilot-plugin/plugin.json`, mirroring `.claude-plugin/plugin.json`.
- GitHub Pages demo: `site/index.html` plus `.github/workflows/deploy-pages.yml`, reusing the existing demo assets and a sample report.
- README: a language-switcher row, a multi-platform install matrix with a one-line curl, an npm downloads badge, and a Star History chart.
- Localized READMEs under `READMEs/` for zh-CN, ja, es, and fr (machine-assisted; English stays the source of truth).
- Demo video: `.github/assets/demo.gif` (hero) plus an `.mp4` and an embed guide.

### Changed

- Rebuilt the features and hero SVGs around the flow-walk model, and removed emoji from them.
- Named the slash commands and MCP tools in the README.

### Removed

- Stale pre-0.6.0 SVG assets and the internal rebuild docs.

### Fixed

- `.github/FUNDING.yml`: corrected the GitHub Sponsors handle to `Aboudjem` (the previous value did not resolve).
- Animated SVGs now respect `prefers-reduced-motion`.
- Removed sentence-break em-dashes from the docs.

## [0.6.1] - 2026-05-28

Alignment release: no behaviour changes. Fixes the release pipeline so future tags can publish to npm,
updates stale copy across assets and docs to reflect the v0.6.0 flow-walk model, and adds 10x
marketplace cross-links.

### Fixed

- `release.yml`: added `npx playwright install --with-deps chromium` before the Test step so the
  real-browser fixture gate no longer blocks the publish job (root cause of npm being stuck at 0.5.2).
- Logo SVGs (`logo-light.svg`, `logo-dark.svg`): replaced stale "eight checks" tagline with
  "walks your app · finds real bugs · zero config · no api key".
- `social-preview.svg`: updated from `v0.4.0` / "374 tests pass" / old multi-scanner copy to
  `v0.6.1` / "441 tests pass" / flow-walk description.
- `description.txt`: rewrote recommended GitHub About from old multi-scanner model to flow-walk model.
- Pipeline SVGs: updated title from "8 Checks in One Command" to "Autonomous Flow-Walk QA Pipeline".
- Report SVGs + HTML preview + `src/report/template.html`: updated version labels from `v0.2.0`/`v0.2.1`
  to `v0.6.1`; updated `[source]` labels to `[walk]`.
- Architecture SVGs: updated MCP tool names from `sniff_scan / sniff_run / sniff_report` to unified
  `sniff tool (mode: walk | scan | report)`; renamed "Source Scanner" block to "Flow-Walk Engine".
- `modes.svg`: updated "source scan" label to "sniff scan".
- `bug_report.yml`: updated version placeholder from `0.5.2` to `0.6.1`.
- `feature_request.yml`: replaced old scanner taxonomy with current flow-walk / sniff-scan options.
- `CLAUDE.md`: updated project description from old source-scan model to flow-walk model.
- `docs/VIDEO-PLAN.md`: replaced "Eight checks" script lines with flow-walk wording.
- `.claude/skills/sniff-scan.md`, `sniff-fix.md`, `sniff-report.md`: aligned to unified `sniff` tool
  (mode: walk/scan/report); legacy tool names kept as fallback references only.
- `llms.txt`: added 10x marketplace install path and "part of the 10x marketplace" line.
- `AGENTS.md`: added 10x marketplace section.

## [0.6.0] - 2026-05-29

This release rebuilds Sniff around an autonomous **flow-walk** engine that drives your running app in a real headless browser and reports what is actually broken, with reproduction proof on every finding. The flow-walk is now the default; the old source-code regex scan moves to an explicit `sniff scan` subcommand.

### Added

- **Flow-walk engine (now the default)**: `sniff` auto-detects your running dev server and walks its real user flows in a headless browser, falling back to a source scan with clear guidance when no app is running. Point it at any URL with `sniff --url <url>`.
- **12 issue classes detected during the walk**: broken pages/routes (4xx/5xx, blank renders, crash screens), broken links (internal + external), console errors / uncaught exceptions / failed network requests, empty data + placeholder/fake data, broken forms (dead submit buttons, validation that never fires), state-loss on back navigation, flow regressions / dead-ends, bad loading states + missing error states, broken async outcomes (flagged "needs out-of-band verification"), responsive issues (overflow, tiny tap targets), accessibility (via axe-core), and unclear/buried primary actions.
- **Reproduction proof on every finding**: exact route, ordered steps, a screenshot, and the console/network excerpt, plus a severity, a confidence level (confirmed / likely / uncertain), and a suggested fix. A finding without reproduction proof is not a finding.
- **`walk` MCP mode** on the unified `sniff` tool (recommended), alongside `scan` (source only) and `report` (last results). Auto-detects the dev server when `baseUrl` is omitted, so "scan this project for bugs" / "walk my app" works out of the box.
- **`sniff scan` subcommand**: source-only scan with no browser (placeholder/TODO/console.log/dead links and more).
- **Self-contained HTML report** via `--report`, written to `sniff-reports/sniff-report.html`.
- **`--all` flag** to surface low-confidence (uncertain) findings, which are hidden by default.
- **Planted-bug fixture + regression gate**: 21 planted bugs across all 12 issue classes plus a clean control page, with a scorer at `sniff-tests/`, locked in as a regression test.

### Changed

- **Default behavior**: `sniff` now performs the autonomous flow-walk instead of a source-code regex scan. The source scan is still available as `sniff scan`.
- **Responsive pass** runs a 375px mobile viewport by default; skip it with `--no-mobile`.
- **Noise filtering**: a first-party noise filter drops favicons, analytics, HMR, expected-auth, and engine-abort noise so the report stays high-signal; broken pages are reported once rather than re-flagged.
- **Confidence model**: uncertain findings are suppressed by default and axe-core (zero-false-positive by design) backs the accessibility findings.

### Fixed

- **`discover --url` crash**: the flow-walker entry point no longer crashes when given a URL; it is now the supported default path.

### Proof

- Measured on the planted-bug fixture (21 bugs across all 12 classes + a clean control page): the previous engine found 9/21 (43%) at ~13% precision with 125 false positives and its flagship command crashed. The new engine finds **21/21 (100%) at 100% precision with 0 false positives** and reports 0 findings on the clean page. The full suite is 441 tests.

## [0.5.2] - 2026-05-06

### Fixed

- Added a `sniff-qa` npm binary alias while keeping the installed `sniff` binary, so `npx sniff-qa` resolves correctly from the npm registry.

## [0.5.1] - 2026-05-06

### Added

- Agent-agnostic AI provider selection with deterministic `ai.provider: "none"` as the default and optional `codex-cli`, `claude-code`, `anthropic-api`, `openai-api`, `gemini-cli`, and `ollama` providers.
- Multi-browser config via `browser.projects` with Chromium as the default and Firefox/WebKit opt-in.
- `sniff_install` MCP support for requested Playwright browser projects.
- Test typechecking through `tsconfig.test.json`.

### Changed

- Browser runtime console/network hook findings now flow into normal results, reports, persistence, MCP responses, and exit codes.
- MCP `sniff({ mode: "run" })` now uses the shared source + browser path instead of a browser-only root route.
- Browser audits use the current repo analysis routes before falling back to `/`, avoiding stale `.sniff/last-results.json` route reuse.
- Scanner crashes now produce high-severity `scanner-error/*` findings instead of silent metadata-only errors.
- Dead-link scanning now ignores code files by default and requires `deadLinks.scanCode: true` for JSX/TSX/JS/TS extraction.
- `--explore` is now opt-in so default CLI scans remain deterministic and local.
- README assets now use absolute GitHub URLs so npm rendering works.

### Fixed

- `BrowserRunner` now receives the target `rootDir`, so reports and visual baselines are written for the scanned project instead of the caller process.
- Accessibility, visual, performance, and e2e scanners now honor `config.scanners` and their enabled flags consistently.
- CI workflow generation now uploads `.sniff/reports/` and uses `npx sniff-qa --ci --format html,json,junit`.

## [0.4.0] - 2026-04-17

### Added

- **Autonomous E2E discovery** (`sniff discover`): scans source (Prisma, Drizzle, TypeORM, Zod, GraphQL, OpenAPI, TS types), classifies the app into one of 10 types, generates happy-path journeys with personas, enumerates edge variants (invalid email, XSS, payment declined, empty cart, offline, slow network, and more), drives them through Playwright, and writes HTML/JSON/JUnit reports
- **Scenario persistence** at `sniff-scenarios/_generated/<app-type>/<journey>.<variant>.scenario.md` with JSON frontmatter, hash-tracked to protect hand-edits; `custom/` directory for user-authored scenarios
- **Regenerate semantics**: `--regenerate`, `--regenerate-only`, `--force-regenerate` flags; non-interactive runs default to keeping hand-edits
- **Realism profiles** (`robot`, `careful-user`, `casual-user`, `frustrated-user`, `power-user`) with seeded RNG and `--seed <n>` for replay
- **Real-world variant caps** (3 per scenario, 40 per run, both configurable) surface the most informative edge variants first
- **Production-URL safety banner**: 5-second non-blocking countdown before running against a non-localhost URL
- **Flakiness quarantine** for discovery scenarios using the existing quarantine engine
- **LLM polish via Claude Code CLI**: optional tie-break for close-call app-type classifications, cached under `.sniff/discover/cache/`; falls back to deterministic classification if the CLI is unavailable or `--no-llm` is set
- **`sniff_discover` MCP tool**: returns compact summary (top app type, stats, failures) so AI editors can drive discovery
- **Doctor awareness** of `sniff-scenarios/` baselines

### Changed

- `sniff doctor` now also reports on discovery baselines

## [0.2.0] - 2026-04-16

### Added

- **Dead link checker** validates internal file references, external URLs (HTTP HEAD with retry/timeout), and anchor links across .md, .html, .jsx, .tsx, .vue, .svelte, and .astro files
- **API endpoint discovery** auto-detects routes from Express, Fastify, Hono, Next.js (App + Pages Router), SvelteKit, tRPC, and GraphQL schema definitions
- **API endpoint issue detection** flags missing error handling, input validation, auth middleware, and hardcoded secrets in route handlers
- **Cross-reference engine** correlates source code findings with browser runtime evidence (5 strategies: broken imports to 404s, console.log to runtime output, hardcoded URLs to network requests, a11y issues to axe violations, placeholders to visible text)
- **Corroborated findings** with bumped severity and confidence tags when issues are confirmed in both source and browser layers
- **Pipeline SVG diagrams** (light/dark) showing the full 8-check pipeline
- **Architecture SVG diagrams** (light/dark) showing all system components
- **Report example SVG** (light/dark) showing styled terminal output
- **Dead link config** section in `sniff.config.ts` (checkExternal, timeout, retries, ignorePatterns, maxConcurrent)
- **API endpoints config** section in `sniff.config.ts` (checkErrorHandling, checkValidation, checkAuth, checkSecrets, frameworks filter)

### Changed

- README updated to document all 8 checks with detailed examples, source rule reference table, cross-reference examples, and expanded config reference
- "Five checks" updated to "Eight checks" across all documentation
- Comparison table expanded with dead link checking, API endpoint discovery, and cross-reference engine rows

## [0.1.0] - 2026-04-16

### Added

- **Source scanner** with AST and regex rules for debugger statements, placeholder text, hardcoded URLs, broken imports, TODO/FIXME tags
- **Accessibility scanner** powered by axe-core for WCAG 2.x violations with fix guidance
- **Visual regression scanner** using pixelmatch for pixel level diffing with baseline tracking
- **Performance scanner** using Lighthouse for LCP, FCP, TTI budget enforcement
- **AI explorer** that roams your app, fills forms with adversarial inputs (XSS, SQL injection, Unicode), and reports crashes
- **Three modes**: quick scan (source only), full audit (all 5 checks), CI mode (deterministic)
- **MCP server** for native AI editor integration (Claude Code, Cursor, Windsurf, VS Code + Cline)
- **Flakiness quarantine** for stable CI pipelines
- **HTML, JSON, and JUnit report** generation
- **Zero config** operation with framework auto detection
- **CLI** with `npx sniff-qa` entry point
