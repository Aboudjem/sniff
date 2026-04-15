# Phase 2: Repo Analyzer + AI Test Generation - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Codebase analysis that detects project frameworks, discovers routes/pages, identifies interactive elements (forms, buttons, links, inputs), and extracts component structure — then feeds that structured analysis to an AI provider that generates standard Playwright `.spec.ts` test files without manual test writing.

This phase does NOT include running the generated tests (Phase 3), reporting (Phase 3), or exploration mode (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Framework Detection
- **D-01:** Detect Next.js, React, Vue, and Svelte — all four listed in REPO-01. Detection is lightweight (package.json dependencies + config file presence like `next.config.*`, `vite.config.*`, `svelte.config.*`).
- **D-02:** Deep route discovery for Next.js (app/ and pages/ directory conventions). Basic entry-point detection for React Router, Vue Router, and SvelteKit — extensible but not deep in v1.
- **D-03:** Graceful degradation — if framework isn't detected, fall back to generic static analysis (find HTML files, scan for `<a>` tags, forms, etc.).

### Route & Element Discovery
- **D-04:** File-system first approach for route discovery. Next.js pages/app directories are scanned directly. Config-based routers (React Router, Vue Router) use AST fallback to parse route configuration files.
- **D-05:** Interactive element identification via AST analysis of JSX/TSX/Vue templates — extract `<form>`, `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>` and their props (data-testid, id, name, aria-label, role).
- **D-06:** AST tool choice deferred to researcher — STATE.md flags "ts-morph vs lighter alternatives" as an open evaluation. Researcher should compare ts-morph, @swc/core, and babel parser for this use case.

### AI Provider Interaction
- **D-07:** Claude Code CLI integration via shell exec of `claude` command with `--print` flag and structured output. This is the zero-API-key default path. Researcher must verify `--print --output-format json` stability.
- **D-08:** Anthropic API as optional provider — toggled by `ANTHROPIC_API_KEY` environment variable. When set, uses `@anthropic-ai/sdk` directly instead of CLI.
- **D-09:** Provider abstraction interface — both Claude Code CLI and Anthropic API implement the same interface. Clean boundary so swapping is a config change, not a code change.
- **D-10:** One prompt per route with full context — discovered elements, component structure, framework info, and the route's file content. Per-route prompts keep context focused and prevent hallucinated selectors.

### Test File Organization
- **D-11:** One `.spec.ts` file per discovered route, named by route path (e.g., `home.spec.ts`, `dashboard-settings.spec.ts`). Standard Playwright test format per AIGEN-05.
- **D-12:** Output directory is `sniff-tests/` at project root (configurable). Keeps generated tests separate from user's existing test suite.
- **D-13:** AI reasoning surfaced as JSDoc comments above each `test()` block — explains why the scenario was generated, what it covers, and what elements it targets. Satisfies AIGEN-06 transparency requirement.

### Claude's Discretion
- Analyzer output JSON schema shape — researcher/planner can design the intermediate format that bridges analysis to AI generation
- Prompt engineering details — specific system/user prompt content for test generation
- Error handling for AI provider failures (retries, fallback behavior)
- Concurrency model for multi-route generation (sequential vs parallel)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Codebase
- `src/scanners/types.ts` — Scanner plugin interface (Scanner, ScanContext, ScanResult) that the repo analyzer must implement
- `src/scanners/registry.ts` — ScannerRegistry with register/runAll pattern — analyzer registers here
- `src/core/types.ts` — Finding type used across all scanners
- `src/config/schema.ts` — Zod config schema — needs extension for analyzer/AI settings

### Project Docs
- `.planning/REQUIREMENTS.md` — REPO-01 through REPO-05 and AIGEN-01 through AIGEN-06 define exact acceptance criteria
- `.planning/ROADMAP.md` — Phase 2 success criteria (5 items)

### Prior Art
- `~/projects/shiftly-v2/apps/web/e2e/` — Adam's prior Playwright test setup (78 tests) as reference for generated test quality expectations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Scanner` interface — repo analyzer implements this, plugs into ScannerRegistry
- `ScanContext` — provides config + rootDir, already has what analyzer needs
- `ScanResult` — findings array + metadata, metadata can carry structured analysis output
- Zod config schema — extend with `analyzer` and `ai` config sections
- CLI command structure — `src/cli/commands/` for adding analyzer-specific commands if needed

### Established Patterns
- Plugin-based scanner architecture — register scanners, runAll executes enabled ones
- Lazy-load heavy modules in CLI handlers (Phase 1 decision D-03)
- Zod v4 with prettifyError() for config validation
- cosmiconfig for config file loading

### Integration Points
- `src/scanners/registry.ts` — register the new repo analyzer scanner
- `src/config/schema.ts` — extend config with analyzer options (framework hints, route patterns) and AI options (provider, model)
- `src/cli/commands/` — `scan` command already runs scanners, may need flags for analyzer-only mode
- New `src/analyzers/` directory for framework detection and route/element discovery
- New `src/ai/` directory for provider abstraction and test generation

</code_context>

<specifics>
## Specific Ideas

- Claude Code CLI `--print --output-format json` is the key integration point — must be verified for stability before building on it
- Generated tests must use real discovered selectors (data-testid, id, name, aria-label) — no hallucinated CSS selectors
- ts-morph vs lighter AST alternatives is an explicit open question from Phase 1 (see STATE.md blockers)
- Prior art at `~/projects/shiftly-v2/apps/web/e2e/` can inform what "good" generated tests look like

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-repo-analyzer-ai-test-generation*
*Context gathered: 2026-04-15*
