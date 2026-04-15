# Roadmap: Sniff

## Overview

Sniff delivers an AI-powered QA CLI that scans codebases and runs multi-dimensional tests in a single command. The roadmap follows the natural pipeline dependency chain: foundation and source scanning first (no browser needed), then codebase analysis and AI test generation (the core differentiator), then the browser-based test runner with all quality scanners and reporting (the biggest phase, delivering the full test-and-report loop), and finally exploration mode, CI integration, and distribution packaging.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Source Scanner** - CLI scaffold, config system, and browserless source code scanning
- [ ] **Phase 2: Repo Analyzer + AI Test Generation** - Codebase analysis and AI-driven Playwright test generation
- [ ] **Phase 3: Browser Runner + Quality Scanners + Reporting** - E2E execution, accessibility, visual regression, performance, and multi-format reporting
- [ ] **Phase 4: Exploration + CI + Distribution** - Chaos monkey mode, CI integration, and npm/MCP/plugin distribution

## Phase Details

### Phase 1: Foundation + Source Scanner
**Goal**: Users can install sniff, initialize a project config, and scan source code for problems without any browser dependency
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-02, CLI-04, CLI-05, CLI-06, CLI-07, SRC-01, SRC-02, SRC-03, SRC-04, DIST-04
**Success Criteria** (what must be TRUE):
  1. User can run `npx sniff init` and get a valid config file generated for their project
  2. User can run `sniff scan` and see colored terminal output identifying placeholder text, TODOs, hardcoded strings, and broken links in their source code
  3. User can run `sniff report` to view the last scan results
  4. CLI exits with code 0 when no issues exceed the configured severity threshold, non-zero otherwise
  5. User can configure sniff via `sniff.config.ts`, `.sniffrc.json`, or `package.json#sniff`
**Plans:** 4 plans

Plans:
- [x] 01-01-PLAN.md — Project setup, core types, and config system (cosmiconfig + Zod + defineConfig)
- [x] 01-02-PLAN.md — Scanner plugin interface, registry, and source scanner with all rule categories
- [x] 01-03-PLAN.md — CLI commands (init, scan, run stub, report), formatter, and persistence
- [x] 01-04-PLAN.md — End-to-end verification and human checkpoint

### Phase 2: Repo Analyzer + AI Test Generation
**Goal**: Users can point sniff at a codebase and get AI-generated Playwright test files without writing a single test manually
**Depends on**: Phase 1
**Requirements**: REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, AIGEN-01, AIGEN-02, AIGEN-03, AIGEN-04, AIGEN-05, AIGEN-06
**Success Criteria** (what must be TRUE):
  1. User can run `sniff scan` on a Next.js/React/Vue project and see detected routes, components, forms, and interactive elements in structured output
  2. AI generates Playwright `.spec.ts` test files from the analysis output using Claude Code by default (no API key required)
  3. User can switch to Anthropic API mode for CI/batch runs by setting an environment variable
  4. Each generated test scenario includes the AI's reasoning for why it was created
  5. Generated tests use real discovered elements (no hallucinated selectors)
**Plans:** 5 plans

Plans:
- [ ] 02-01-PLAN.md — Analyzer types, framework detector, and route discoverer
- [ ] 02-02-PLAN.md — AI provider types, prompt builder, response parser, and provider resolver
- [ ] 02-03-PLAN.md — Element extractor (AST), RepoAnalyzer scanner plugin, and config schema extension
- [ ] 02-04-PLAN.md — Claude Code and Anthropic API providers, test generator, and scan command wiring
- [ ] 02-05-PLAN.md — Integration test and human verification of full pipeline

### Phase 3: Browser Runner + Quality Scanners + Reporting
**Goal**: Users can run a single command that executes generated tests across viewports, scans for accessibility/visual/performance issues, and produces a comprehensive report
**Depends on**: Phase 2
**Requirements**: CLI-03, E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06, A11Y-01, A11Y-02, A11Y-03, VIS-01, VIS-02, VIS-03, PERF-01, PERF-02, PERF-03, RPT-01, RPT-02, RPT-03, RPT-04, RPT-05, RPT-06
**Success Criteria** (what must be TRUE):
  1. User can run `sniff run` and see Playwright execute tests in Chromium across desktop, mobile, and tablet viewports
  2. Screenshots are captured automatically on any test failure
  3. Console errors and network failures (4xx, 5xx, broken assets) are detected and reported during test runs
  4. Every visited page is scanned for WCAG 2.1 AA accessibility violations with specific fix suggestions
  5. Visual regression detects pixel-level differences against stored baselines, with `sniff update-baselines` to reset them
  6. Performance budgets (LCP, FCP, TTI) can be configured and violations appear as findings with severity
  7. An HTML report is generated with all findings, severity scores, screenshots, and fix suggestions in a brutally honest tone
  8. JUnit XML and JSON outputs are available for programmatic consumption
**Plans:** 6 plans
**UI hint**: yes

Plans:
- [x] 03-01-PLAN.md — Browser types, config schema extensions, BrowserRunner, page hooks, and runtime discovery
- [x] 03-02-PLAN.md — Accessibility scanner (axe-core WCAG 2.1 AA) and visual regression scanner (pixelmatch)
- [ ] 03-03-PLAN.md — Performance scanner (Lighthouse LCP/FCP/TTI) and report model with JSON/JUnit formatters
- [ ] 03-04-PLAN.md — Self-contained HTML report generator with UI-SPEC compliance
- [ ] 03-05-PLAN.md — CLI wiring: sniff run command, update-baselines command, formatter and report extensions
- [ ] 03-06-PLAN.md — End-to-end verification and human checkpoint

### Phase 4: Exploration + CI + Distribution
**Goal**: Users can run autonomous exploration, integrate sniff into CI pipelines, and install it via npm/MCP/Claude Code plugin
**Depends on**: Phase 3
**Requirements**: EXPLR-01, EXPLR-02, EXPLR-03, CI-01, CI-02, CI-03, CI-04, DIST-01, DIST-02, DIST-03
**Success Criteria** (what must be TRUE):
  1. User can run chaos monkey mode that autonomously navigates the app, clicks elements, fills forms with edge-case data, and reports findings with full AI decision traces
  2. User can run `sniff ci` to generate a GitHub Actions workflow file that runs sniff headless with proper exit codes
  3. Flaky tests are detected across runs and auto-quarantined so they don't block the CI pipeline
  4. User can install sniff globally via `npx sniff` (npm published)
  5. MCP server exposes sniff scan/run/report as tools for AI agent integration (Cursor, Windsurf, Claude Desktop)
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Source Scanner | 4/4 | Complete | - |
| 2. Repo Analyzer + AI Test Generation | 0/5 | Planning complete | - |
| 3. Browser Runner + Quality Scanners + Reporting | 0/6 | Planning complete | - |
| 4. Exploration + CI + Distribution | 0/3 | Not started | - |
