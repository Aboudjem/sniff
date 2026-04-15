# Phase 3: Browser Runner + Quality Scanners + Reporting - Context

**Gathered:** 2026-04-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the `sniff run` command that executes AI-generated Playwright tests across viewports, runs quality scanners (accessibility, visual regression, performance) on every visited page, and produces comprehensive reports in HTML, JSON, and JUnit XML formats. This is the largest phase (22 requirements) — it turns sniff from a source-only scanner into a full browser-based QA tool.

Scope: CLI-03, E2E-01 through E2E-06, A11Y-01 through A11Y-03, VIS-01 through VIS-03, PERF-01 through PERF-03, RPT-01 through RPT-06.

</domain>

<decisions>
## Implementation Decisions

### Browser Orchestration
- **D-01:** Use Playwright's programmatic API (not subprocess execution of .spec.ts files). `sniff run` launches browsers via `playwright.chromium.launch()`, navigates pages, and controls the test lifecycle directly. This gives full control over page events, allows injecting quality scanners mid-run, and avoids subprocess coordination complexity.
- **D-02:** Run tests across 3 viewport projects: desktop (1280x720), mobile (375x667), tablet (768x1024) as required by E2E-02. Chromium is the default browser (E2E-01).

### Scanner Integration Model
- **D-03:** Quality scanners (a11y, visual, perf) integrate as page-visit hooks — a pipeline that runs on every page visit during the browser session. Extend the existing `Scanner` interface with an optional browser context: scanners that need a browser page receive it, source-only scanners continue working as before.
- **D-04:** Scanner execution order per page: E2E assertions first (test the page works), then a11y scan, then visual snapshot, then performance measurement. Failures in one scanner don't block others — all run and report independently.

### Accessibility Scanning
- **D-05:** Use axe-core via `@axe-core/playwright` for WCAG 2.1 AA compliance scanning (A11Y-01). Run axe on every visited page after it reaches a stable state.
- **D-06:** Touch target size validation (A11Y-02) uses axe-core's `target-size` rule configured for mobile viewports. Color contrast violations (A11Y-03) use axe-core's built-in contrast rules with element-level reporting.

### Visual Regression
- **D-07:** Pixel-diff comparison using `pixelmatch` (lightweight, no vendor dependency). Baselines stored in a git-committed configurable directory (`sniff-baselines/` by default).
- **D-08:** `sniff update-baselines` command overwrites existing baselines with current screenshots. Smart diff threshold (VIS-03) uses a configurable pixel tolerance percentage to ignore sub-pixel/anti-aliasing noise (default: 0.1% threshold).

### Performance Measurement
- **D-09:** Use Lighthouse programmatic API (`lighthouse` npm package) to collect performance scores (LCP, FCP, TTI) as required by PERF-01. Run Lighthouse against each unique URL visited during the test run.
- **D-10:** Performance budgets configured in `sniff.config.ts` as thresholds (e.g., `{ lcp: 2500, fcp: 1800, tti: 3800 }`). Budget violations become findings with severity based on how far the metric exceeds the threshold (PERF-02, PERF-03).

### Reporting
- **D-11:** Single unified internal report model that aggregates findings from all scanners (E2E, a11y, visual, perf, source). Format adapters produce HTML, JSON, and JUnit XML from this model — matches the existing `Finding` type pattern.
- **D-12:** HTML report is a single self-contained file (inline CSS/JS, no external assets). Sections organized by severity, then by scanner type. Screenshots embedded as base64 data URIs.
- **D-13:** Report uses "brutally honest" tone as required by RPT-06 — direct, opinionated, no sugar-coating. Fix suggestions included where possible (RPT-03).
- **D-14:** JSON output is the raw report model for programmatic consumption (RPT-05). JUnit XML follows standard schema for CI tools (RPT-04).

### Console & Network Monitoring
- **D-15:** Console errors (E2E-04) captured via Playwright's `page.on('console')` listener — `console.error` and uncaught exceptions become findings.
- **D-16:** Network failures (E2E-05) captured via `page.on('response')` listener — 4xx, 5xx status codes and failed resource loads become findings with the URL and status code.

### Screenshot Capture
- **D-17:** Screenshots captured automatically on any test failure (E2E-03) via Playwright's `page.screenshot()`. Stored alongside the report and embedded in HTML output.

### Auto-Discovery
- **D-18:** Auto-discovery of clickable elements and form fields (E2E-06) reuses the element-extractor from Phase 2's analyzer output. Browser-side discovery supplements this with runtime DOM inspection for dynamically rendered elements.

### Claude's Discretion
- Internal report model schema design
- HTML report visual styling and layout details
- Error handling and retry strategies for flaky browser operations
- Parallelization strategy for multi-viewport runs
- Lighthouse configuration options beyond the required metrics

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Architecture
- `src/scanners/types.ts` — Scanner interface (name, setup, scan, teardown) that must be extended for browser context
- `src/scanners/registry.ts` — ScannerRegistry.runAll() pattern for orchestrating multiple scanners
- `src/core/types.ts` — Finding type (ruleId, severity, message, filePath, line, column, snippet) used across all scanners

### Existing Scanners
- `src/scanners/source/index.ts` — Source scanner implementation as reference for new scanner plugins
- `src/scanners/repo-analyzer.ts` — Repo analyzer scanner that produces analysis output consumed by this phase

### Configuration
- `src/config/schema.ts` — Zod config schema that needs extension for browser/a11y/visual/perf/report settings
- `src/config/defaults.ts` — Default config values

### CLI
- `src/cli/commands/run.ts` — Current stub that must be replaced with full browser runner implementation
- `src/cli/formatter.ts` — Terminal output formatter pattern for consistency

### AI Integration
- `src/ai/generator.ts` — Test generator that produces Playwright .spec.ts files consumed by the browser runner
- `src/analyzers/types.ts` — Analyzer output types (routes, elements) used for auto-discovery

### Requirements
- `.planning/REQUIREMENTS.md` — Full requirement definitions for E2E, A11Y, VIS, PERF, RPT sections

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Scanner interface** (`src/scanners/types.ts`): Scanner/ScanContext/ScanResult types can be extended with optional browser page context for browser-based scanners
- **ScannerRegistry** (`src/scanners/registry.ts`): runAll() pattern with setup/scan/teardown lifecycle — new scanners (a11y, visual, perf) register into this
- **Finding type** (`src/core/types.ts`): All scanner output uses this — may need extension for screenshot paths and browser-specific metadata
- **Formatter** (`src/cli/formatter.ts`): Severity-based colored output with grouping — reuse for `sniff run` terminal output
- **Element extractor** (`src/analyzers/element-extractor.ts`): AST-based element discovery — supplement with runtime DOM discovery for E2E-06
- **Config schema** (`src/config/schema.ts`): Zod-based config with extension points — add browser, a11y, visual, perf, report sections

### Established Patterns
- **Lazy imports**: CLI commands lazy-load heavy modules (e.g., `const pc = (await import('picocolors')).default`)
- **Scanner lifecycle**: setup → scan → teardown with error isolation per scanner
- **Zod validation**: All config uses Zod schemas with defaults
- **ESM-first**: Project uses `type: "module"` with `.js` import extensions

### Integration Points
- `src/cli/commands/run.ts` — stub to be replaced with full implementation
- `src/cli/commands/report.ts` — currently reads source scan results, needs to also read browser run results
- `src/scanners/registry.ts` — new browser-based scanners register here
- `src/config/schema.ts` — needs new config sections for browser/a11y/visual/perf settings

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: this is the largest phase (22 requirements) and should be planned as multiple focused plans rather than one monolithic plan.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-browser-runner-quality-scanners-reporting*
*Context gathered: 2026-04-15*
