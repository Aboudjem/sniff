# Phase 1: Foundation + Source Scanner - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can install sniff, initialize a project config, and scan source code for problems (placeholder text, TODOs, hardcoded strings, broken imports) without any browser dependency. This phase delivers the CLI scaffold, config system, and source scanner — the foundation everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### CLI Framework
- **D-01:** Use Commander.js for CLI scaffolding — most popular, well-documented, used by Playwright and Vitest
- **D-02:** Top-level subcommands: `sniff init`, `sniff scan`, `sniff run` (stub), `sniff report`
- **D-03:** Lazy-load heavy modules to keep startup under 5 seconds for `sniff scan`
- **D-04:** Use picocolors for terminal coloring (smaller than chalk, no dependencies)

### Config System
- **D-05:** Use cosmiconfig for config file discovery — supports `sniff.config.ts`, `.sniffrc.json`, `package.json#sniff`
- **D-06:** Provide `defineConfig()` helper (Vite-style) for TypeScript autocomplete in `sniff.config.ts`
- **D-07:** Validate config with Zod schemas — helpful error messages on invalid config
- **D-08:** `sniff init` generates a `sniff.config.ts` with commented defaults

### Scanner Output Format
- **D-09:** Group findings by severity (critical/high/medium/low/info) with colored indicators (red/yellow/green)
- **D-10:** Each finding shows file path with line number (`src/app/page.tsx:42`) for direct navigation
- **D-11:** Summary line at bottom: counts by severity + total issues found
- **D-12:** `--json` flag outputs structured JSON for programmatic consumption
- **D-13:** Exit code based on `--fail-on` threshold (default: `critical,high`)

### Scanner Rule Design
- **D-14:** Built-in rules with regex patterns, extensible via config `rules` section
- **D-15:** Default rule categories: placeholder text (lorem ipsum, "TODO", "FIXME", "TBD"), debug artifacts (console.log, debugger), hardcoded strings (test data, temp URLs), broken imports
- **D-16:** Each rule has: id, severity, pattern (regex), description, file globs (include/exclude)
- **D-17:** Users can disable rules via config: `rules: { 'placeholder-text': 'off' }`
- **D-18:** Rules are organized as a scanner plugin interface from day one — same interface browser scanners will use later

### Claude's Discretion
- Exact Commander.js command structure and option naming
- cosmiconfig search paths and precedence
- Zod schema structure for config validation
- Rule regex patterns and edge case handling
- Progress indicator implementation during scanning
- Temp file and cache directory structure (`.sniff/`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (CLI-01 through CLI-07, SRC-01 through SRC-04, DIST-04).

### Project context
- `.planning/PROJECT.md` — Project vision, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full v1 requirement list with IDs
- `.planning/research/ARCHITECTURE.md` — System architecture, component boundaries, scanner plugin interface design
- `.planning/research/PITFALLS.md` — Critical pitfalls including lazy-loading CLI architecture, Claude Code provider abstraction

### Research
- `.planning/research/FEATURES.md` — Feature landscape, table stakes, anti-features to avoid

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project

### Established Patterns
- None yet — this phase establishes the foundational patterns

### Integration Points
- Scanner plugin interface established here will be used by all future scanners (E2E, a11y, visual, perf)
- Config schema established here will be extended by future phases
- CLI command structure established here will be extended with `sniff run` behavior in Phase 3
- Report output format established here will be consumed by HTML reporter in Phase 3

</code_context>

<specifics>
## Specific Ideas

- CLI should feel like Vitest/Biome — fast, clean, modern terminal output
- "Brutal honesty" tone starts in the scanner output — findings should be direct and actionable
- `npx sniff scan` should work on any JS/TS project with zero config as a first demo experience
- Prior art available in `~/projects/shiftly-v2/apps/web/e2e/` for Playwright patterns (relevant in later phases)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-source-scanner*
*Context gathered: 2026-04-15*
