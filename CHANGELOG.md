# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **i18n classifier aliases** — the app-type classifier now matches French, Spanish, German, Portuguese (BR/PT), and Italian equivalents for every English signature token. Non-English apps (e.g. a French SaaS on `/fr/tableau-de-bord`, `/fr/parametres`, `/fr/facturation`) classify correctly instead of returning `blank`. Alias map in `src/discovery/classifier/signatures/i18n.ts`; matched aliases surface in evidence with an `(i18n: <alias>)` suffix. Covers route tokens (single-word) and element phrases (multi-word).
- **Classification breakdown** — `sniff discover` (and the `sniff_discover` MCP tool) now returns a `classificationBreakdown` with the top-3 app-type candidates (type, confidence, raw score) and every matched signal grouped by dimension (routes, elements, deps, schema) with the app type that scored it. Useful for debugging why an app classified the way it did, especially the "100% blank with no context" case.
- **`--verbose` flag** on `sniff` and `sniff discover` — pretty-prints the classification breakdown to the terminal (top 3 guesses + first 8 matched signals per dimension).
- **`scoreAllSignatures` / `buildClassificationBreakdown` exports** from `src/discovery/classifier/index.ts` for downstream tooling.
- **`forceAppType`** parameter — bypasses the classifier and generates scenarios for a chosen app type even when classification returned `blank`. Available as `--force-app-type <type>` on the CLI and `forceAppType: string` on the `sniff_discover` MCP tool. Fixes the case where a non-English SaaS classified as blank and `--app-type saas` produced zero scenarios.

### Changed

- **`--app-type` is now a filter, not a force.** The existing CLI flag and MCP `appType` param filter classifier guesses down to the listed types — they do NOT bypass classification. The internal option is renamed from `forceAppTypes` → `filterAppTypes` on `generateScenarios`; old name kept as a deprecated alias for one release.
### Changed

- **Dev-server detection hardened.** Removed ports `5000`, `8000`, and `8080` from the conservative probe fallback — these collide with macOS AirPlay Receiver, `python -m http.server`, and every Java/Tomcat/Jenkins default, and previously caused sniff to false-positive on unrelated services. Probe fallback now requires a framework marker (Next.js `__NEXT_DATA__`, Vite `/@vite/client`, Nuxt `__NUXT__`, Astro islands, SvelteKit, Angular, Remix) to accept a port as a dev server. Added parsing of `vite.config.{ts,js,mjs,cjs}`, `nuxt.config.{ts,js,mjs}`, `astro.config.{mjs,ts,js}`, and `angular.json` for explicit port overrides. Added auto-increment probe (defaultPort+1..+20) so sniff finds Next.js / Vite dev servers that rolled forward after a port-busy collision. `DetectionResult` now includes a `candidates` array for callers (CLI, MCP) to show or pick from.

### Migration note

If you were relying on sniff probing `:5000` / `:8000` / `:8080`, set `SNIFF_URL=http://localhost:<port>` or add the port to your dev script (`"dev": "vite --port 8080"`) and sniff will pick it up via `package.json`.

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
