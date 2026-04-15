# Project Research Summary

**Project:** Sniff
**Domain:** AI-powered autonomous QA testing framework (CLI)
**Researched:** 2026-04-15
**Confidence:** HIGH

## Executive Summary

Sniff is an AI-powered QA CLI that reads a codebase, generates test scenarios autonomously, and runs multi-dimensional scans (E2E, accessibility, visual regression, performance, source code) in a single command. The market has no tool that combines all these dimensions without requiring paid subscriptions, API keys, or web dashboards. Experts build tools like this on top of Playwright as a library (not as a test runner), with a plugin/scanner architecture for extensibility, and a provider abstraction for AI integration. The locked stack -- TypeScript, Node.js 22+, Playwright, Claude Code as default AI -- is well-suited and aligns with the JS testing ecosystem.

The recommended approach is to build foundation-first: core types, config system, and CLI scaffold with lazy loading, then the repo analyzer and source scanner (which need no browser), then AI test generation, then the browser-based runner with E2E/console/network scanners, and finally reporting. This order respects the dependency chain (analysis feeds generation, generation feeds execution, execution feeds reporting) and delivers a working end-to-end demo as early as possible. The source scanner is a cheap early win -- regex-based, no browser needed, high user impact.

The top risks are: (1) AI-generated tests that validate nothing (coverage theater) -- mitigated by generating scenario descriptions before test code and requiring value-specific assertions; (2) hallucinated selectors from AI -- mitigated by mandatory element discovery before generation, never generating blind; (3) Claude Code as a single point of failure -- mitigated by the AIProvider abstraction with Anthropic API as first-class fallback; (4) slow CLI startup killing first impressions -- mitigated by lazy-loading heavy deps and compiling TS at publish time. These must be addressed in Phase 1 architecture, not retrofitted.

## Key Findings

### Recommended Stack

The stack is locked per PROJECT.md constraints. Architecture research confirms these choices and fills in supporting libraries.

**Core technologies:**
- **TypeScript + Node.js 22+**: Runtime and language -- ecosystem alignment with JS testing tools, modern features (native ESM, worker threads)
- **Playwright**: Browser automation as a library, not a test runner -- Sniff IS the runner. Multi-browser, strong parallelization, Microsoft-backed
- **Claude Code CLI**: Default AI provider via subprocess (`--print --output-format json`) -- zero API key, zero cost, zero signup
- **Anthropic SDK (@anthropic-ai/sdk)**: Alternative AI provider for CI/batch/headless -- requires `ANTHROPIC_API_KEY`
- **Commander.js**: CLI framework with lazy command loading for fast startup
- **Zod**: Schema validation for config, AI structured output, and MCP tool inputs
- **cosmiconfig**: Config file discovery (`sniff.config.ts`, `.sniffrc`, `package.json#sniff`)
- **tsup/esbuild**: Compile TS to JS at publish time -- never ship runtime-transpiled TypeScript
- **axe-core (@axe-core/playwright)**: Accessibility scanning (WCAG 2.1 AA) -- table stakes due to regulatory pressure
- **pixelmatch or odiff**: Local pixel-diff visual regression -- free, no vendor lock-in
- **@modelcontextprotocol/sdk**: MCP server for AI agent integration (Cursor, Windsurf, Claude Desktop)
- **ts-morph**: TypeScript AST analysis for route/component extraction (optional, regex fallback for non-TS)

### Expected Features

**Must have (table stakes):**
- Zero-config startup (`npx sniff`) with auto-detection of framework, routes, base URL
- E2E browser tests (Chromium minimum) with screenshot capture on failure
- Console error and network failure monitoring during test runs
- Accessibility scanning (axe-core, WCAG 2.1 AA)
- JUnit XML / JSON output for CI integration
- Proper exit codes, configurable severity thresholds
- Multi-viewport testing (desktop, mobile, tablet defaults)
- Colored, structured terminal output with `--help` / `--version`
- CI integration (GitHub Actions at minimum)

**Should have (differentiators):**
- Zero-test-writing AI generation from codebase analysis alone -- the core promise
- No API key required (Claude Code default) -- unique in market
- Multi-dimensional scanning in one command (5 tools in 1)
- Source code text scanning (lorem ipsum, TODO, placeholders, hardcoded secrets)
- Brutal honesty reporting with severity scoring -- personality as brand
- Local-only visual regression (no Percy/Applitools vendor lock-in)
- AI chaos monkey exploration mode
- MCP server for AI agent integration
- Flakiness detection with auto-quarantine

**Defer (v2+):**
- Performance budgets (Lighthouse + Web Vitals) -- specialized, additive
- Claude Code plugin -- depends on MCP server, distribution optimization
- Watch mode -- nice DX but not launch-critical
- Multi-browser (WebKit, Firefox) -- Chromium covers 90%
- Fix suggestion generation -- requires mature failure reporting first

### Architecture Approach

The architecture follows a pipeline pattern: CLI -> Config -> Analyzer -> AI Generator -> Runner -> Reporter, with a pluggable Scanner Registry for extensibility. Each scanning dimension (E2E, a11y, visual, console, network, source) implements a common `Scanner` interface. AI integration uses a provider adapter pattern (`AIProvider` with `ClaudeCodeProvider` and `AnthropicAPIProvider`). Reporters follow Playwright's multi-reporter pattern with lifecycle events. Worker threads handle parallel execution with message passing (no shared state). Config uses cosmiconfig with a `defineConfig` helper for TypeScript autocomplete.

**Major components:**
1. **CLI Layer** -- thin command parser, delegates to core modules, lazy-loads heavy deps
2. **Config System** -- cosmiconfig discovery + Zod validation + `defineConfig` helper
3. **Analyzer Pipeline** -- parse source, extract routes/components/forms, enrich with metadata
4. **AI Generation Engine** -- build prompts from analysis, generate structured test scenarios, validate output
5. **Scanner Registry** -- pluggable interface for scanning dimensions, manages lifecycle
6. **Runner Engine** -- worker pool with Playwright, orchestrates scanners per route
7. **Reporter Engine** -- multi-reporter events (HTML, JSON, CI annotations)
8. **MCP Server** -- expose scan/run/report as tools via stdio transport

### Critical Pitfalls

1. **Coverage theater (AI tests that validate nothing)** -- Generate scenario descriptions first, then test code. Require value-specific assertions. Include test quality scoring. Never surface coverage percentages as quality signals.
2. **Hallucinated selectors** -- Always discover real page elements before generating tests. Use Playwright resilient locators (`getByRole`, `getByText`), never raw CSS/XPath from AI. Validate selectors against live DOM.
3. **Claude Code as single point of failure** -- Build `AIProvider` abstraction from day one with two implementations. Detect availability gracefully. Ship API mode as first-class, not afterthought.
4. **Slow CLI startup** -- Lazy-load Playwright, axe-core, AI modules. Compile TS at publish time. Budget: `sniff --version` under 300ms. Show spinner immediately before heavy imports.
5. **Playwright browser download bloat** -- Default Chromium-only. Detect existing browsers. Show progress with ETA. Provide pre-built Docker image for CI.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation + CLI + Source Scanner
**Rationale:** Everything depends on core types, config, and CLI scaffold. Source scanner needs no browser -- fastest path to a working demo. Lazy loading must be established now or it becomes a painful retrofit. The AIProvider abstraction must exist from day one.
**Delivers:** Working `sniff init` and `sniff scan --source-only` commands. Users can scan for lorem ipsum, TODOs, placeholders, and hardcoded strings with zero browser dependency.
**Addresses:** Core types, config system (cosmiconfig + Zod), CLI skeleton (Commander.js with lazy loading), source code scanner, basic terminal output (colored, structured).
**Avoids:** Slow CLI startup (lazy loading from start), Claude Code single point of failure (AIProvider interface established).

### Phase 2: Repo Analyzer + AI Test Generation
**Rationale:** The analyzer is the foundation for all AI-driven features. It must exist before test generation can produce meaningful results. Element discovery before generation is non-negotiable -- generating blind produces hallucinated selectors.
**Delivers:** `sniff scan` analyzes codebase, discovers routes/components/forms, generates AI test scenarios as Playwright test files.
**Addresses:** Framework detection (Next.js, React Router, generic), route/component/form extraction, AI prompt templates with structured output, scenario generation with quality heuristics.
**Avoids:** Coverage theater (scenario-first generation, assertion quality checks), hallucinated selectors (element discovery before generation), prompt brittleness (structured output schemas, few-shot examples).

### Phase 3: Browser Runner + Core Scanners
**Rationale:** Browser-based execution depends on generated test files from Phase 2. Console and network monitors attach as listeners during navigation. All scanners run on the same page load (navigate once, scan concurrently).
**Delivers:** `sniff run` executes generated tests in Playwright, captures screenshots on failure, monitors console errors and network failures.
**Addresses:** Playwright runner engine, worker pool, E2E scanner, console monitor, network monitor, screenshot capture, multi-viewport execution.
**Avoids:** Memory exhaustion (context recycling per route, sequential browsers by default), browser download bloat (Chromium-only default, existing browser detection).

### Phase 4: Reporting + Accessibility
**Rationale:** Reporters consume results from Phase 3. axe-core integration is a well-documented path via @axe-core/playwright. HTML report with severity scoring delivers the "brutal honesty" brand promise.
**Delivers:** HTML report with severity scoring, JSON output, a11y scanning with WCAG 2.1 AA violations. The "brutal honesty" tone in reports.
**Addresses:** Reporter engine (HTML, JSON), accessibility scanner (axe-core), severity scoring and prioritization, JUnit XML for CI.
**Avoids:** Report generation failing on partial scan failures (always produce partial results).

### Phase 5: CI Mode + Visual Regression + Flakiness
**Rationale:** CI mode requires reporting and exit codes to be solid. Visual regression needs Docker-only recommendation from day one. Flakiness detection needs run history.
**Delivers:** `sniff ci` with GitHub Actions generator, visual regression with local pixel diff, flaky test detection and quarantine.
**Addresses:** CI integration (GitHub Actions workflow generation), visual regression (pixelmatch/odiff, Docker-based baselines), flakiness tracking (.sniff/history.json), configurable severity thresholds for CI gating.
**Avoids:** Visual regression false positive avalanche (Docker-only, similarity thresholds, dynamic content masking), flaky tests polluting CI results (auto-quarantine).

### Phase 6: MCP Server + Chaos Monkey + Advanced Features
**Rationale:** MCP server wraps the entire pipeline, so it must come last. Chaos monkey needs a solid E2E foundation. These are distribution and differentiation features, not core product.
**Delivers:** MCP server for AI agent integration, AI chaos monkey exploration, performance budgets.
**Addresses:** MCP server (stdio transport, scoped tools), chaos monkey (AI-driven autonomous exploration), performance scanning (Lighthouse/Web Vitals).
**Avoids:** MCP security exposure (stdio-only, input sanitization, no network exposure).

### Phase 7: Launch Prep + Distribution
**Rationale:** Community infrastructure and polish. Cannot create demo GIF until tool works end-to-end. README narrative: "one command finds bugs you didn't know existed."
**Delivers:** README with demo GIF, CONTRIBUTING.md, issue templates, CI pipeline, npm publish automation, Claude Code plugin.
**Addresses:** Open source launch checklist, Claude Code plugin (depends on MCP), Homebrew tap, curl installer.
**Avoids:** Launching without community infrastructure (all checklist items before v0.1.0 announcement).

### Phase Ordering Rationale

- Dependency chain dictates order: types -> config -> analyzer -> AI gen -> runner -> reporters -> MCP
- Source scanner in Phase 1 provides immediate value without browser complexity
- Analyzer before AI generation prevents the hallucinated selector pitfall entirely
- Browser runner after AI generation ensures there are test files to execute
- Reporting after runner ensures there are results to report
- CI mode after reporting ensures output formats are stable
- MCP server last because it wraps the entire pipeline

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Analyzer + AI Generation):** Framework detection heuristics for Next.js App Router vs Pages Router, React Router v6/v7, Remix, Astro. Prompt engineering for scenario quality. Structured output schema design.
- **Phase 3 (Browser Runner):** Worker pool memory management, context recycling strategies, Playwright library API (not test runner) usage patterns.
- **Phase 6 (MCP + Chaos Monkey):** MCP SDK patterns for tool registration, chaos monkey exploration strategies, performance budget integration with Lighthouse Node API.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented -- Commander.js, cosmiconfig, Zod, tsup are all mature with extensive docs.
- **Phase 4 (Reporting + A11y):** Well-documented -- @axe-core/playwright integration, HTML templating, JUnit XML format.
- **Phase 5 (CI + Visual Regression):** Well-documented -- GitHub Actions workflow syntax, pixelmatch API, CI exit code conventions.
- **Phase 7 (Launch Prep):** Standard open source launch patterns, npm publish automation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Locked decisions in PROJECT.md. Technologies are mature and well-documented. No STACK.md was produced but stack is fully defined across PROJECT.md and ARCHITECTURE.md. |
| Features | HIGH | Comprehensive competitive analysis with 18 sources. Clear table stakes vs differentiator separation. Anti-features well-identified. |
| Architecture | HIGH | Detailed component design with code examples. Pipeline pattern, scanner interface, provider adapter all well-established patterns. Build order dependency chain is clear. |
| Pitfalls | HIGH | 10 pitfalls documented with real-world evidence (GitHub issues, CVE references, production incidents). Prevention strategies are specific and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **STACK.md not produced:** Stack research agent did not generate output. Stack decisions are covered by PROJECT.md constraints and ARCHITECTURE.md recommendations, but specific version pinning guidance (Playwright version, Node.js minor version, axe-core version) was not researched independently. Validate versions during Phase 1 implementation.
- **Claude Code CLI stability:** No documentation of Claude Code's CLI interface stability or Anthropic's stance on automated subprocess usage. Need to verify `--print --output-format json` is a supported, stable interface. Monitor for terms-of-service considerations.
- **ts-morph vs lighter alternatives:** Architecture recommends ts-morph for AST analysis (~15MB install), but no comparative research on lighter alternatives (e.g., TypeScript compiler API directly, babel parser). Evaluate during Phase 2 planning.
- **Prompt engineering specifics:** Pitfalls research identifies prompt brittleness risk, but no research on specific prompt patterns for test scenario generation. Needs experimentation during Phase 2.
- **Monorepo support:** No research on how the analyzer handles monorepos (Nx, Turborepo, pnpm workspaces). Could be a significant gap for enterprise adoption. Address during Phase 2 planning.

## Sources

### Primary (HIGH confidence)
- [Playwright Documentation](https://playwright.dev/docs/) -- CLI, reporters, parallelism, Docker, CI
- [axe-core / @axe-core/playwright](https://github.com/dequelabs/axe-core) -- accessibility scanning integration
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- server implementation
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) -- protocol spec
- [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) -- config discovery patterns
- [Playwright Memory Issues #15400, #38489](https://github.com/microsoft/playwright/issues/15400) -- memory management evidence

### Secondary (MEDIUM confidence)
- [mabl AI capabilities](https://www.mabl.com/breakthrough-agentic-ai-capabilities-redefining-software-quality) -- competitive analysis
- [Stagehand v3](https://www.browserbase.com/blog/stagehand-v3) -- AI browser automation patterns
- [AI-Generated Tests False Confidence](https://codeintelligently.com/blog/ai-generated-tests-false-confidence) -- coverage theater evidence
- [MCP Security Survival Guide](https://towardsdatascience.com/the-mcp-security-survival-guide-best-practices-pitfalls-and-real-world-lessons/) -- security pitfalls
- [Visual Regression Best Practices](https://medium.com/@ss-tech/the-ui-visual-regression-testing-best-practices-playbook-dc27db61ebe0) -- false positive mitigation
- [2026 Guide to AI-Powered Test Automation](https://dev.to/matt_calder_e620d84cf0c14/the-2026-guide-to-ai-powered-test-automation-tools-5f24) -- market landscape

### Tertiary (LOW confidence)
- [ts-morph](https://github.com/dsherret/ts-morph) -- recommended but not validated against alternatives
- [pixelmatch](https://github.com/mapbox/pixelmatch) -- recommended but odiff (Rust-based) may be faster, needs benchmarking

---
*Research completed: 2026-04-15*
*Ready for roadmap: yes*
