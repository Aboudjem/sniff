# Requirements: Sniff

**Defined:** 2026-04-15
**Core Value:** One command finds bugs across every dimension before users do — no manual test writing, ever.

## v1 Requirements

Requirements for initial release (v0.1 through v0.3). Each maps to roadmap phases.

### CLI

- [ ] **CLI-01**: User can run `sniff init` to generate a config file for their project
- [ ] **CLI-02**: User can run `sniff scan` to perform source-code-only scanning (no browser)
- [ ] **CLI-03**: User can run `sniff run` to execute a full multi-dimensional test suite
- [ ] **CLI-04**: User can run `sniff report` to view the last generated report
- [ ] **CLI-05**: CLI provides colored, severity-based terminal output with progress indicators
- [ ] **CLI-06**: CLI exits with code 0 on pass, non-zero on failure (CI-compatible)
- [ ] **CLI-07**: User can configure severity threshold for failure via `--fail-on critical,high`

### Repo Analysis

- [ ] **REPO-01**: Analyzer detects the project framework (Next.js, React, Vue, Svelte, etc.)
- [ ] **REPO-02**: Analyzer discovers all routes/pages from source code
- [ ] **REPO-03**: Analyzer identifies interactive elements (forms, buttons, links, inputs)
- [ ] **REPO-04**: Analyzer extracts component structure and relationships
- [ ] **REPO-05**: Analysis output is structured JSON consumed by downstream scanners

### AI Test Generation

- [ ] **AIGEN-01**: AI generates test scenarios from analyzer output without manual test writing
- [ ] **AIGEN-02**: Default AI provider is Claude Code (no API key required)
- [ ] **AIGEN-03**: Optional Anthropic API provider for CI/batch/unattended runs
- [ ] **AIGEN-04**: AI provider abstraction allows swapping between Claude Code and API mode
- [ ] **AIGEN-05**: Generated tests are standard Playwright `.spec.ts` files (no vendor lock-in)
- [ ] **AIGEN-06**: AI traces its reasoning for each generated scenario (transparent, not opaque)

### Source Scanning

- [ ] **SRC-01**: Scanner detects placeholder text (lorem ipsum, "TODO", "FIXME", "TBD")
- [ ] **SRC-02**: Scanner detects hardcoded strings that shouldn't ship (debug logs, test data)
- [ ] **SRC-03**: Scanner detects broken internal links and unused imports
- [ ] **SRC-04**: Source scanning runs without a browser (fast, lightweight)

### Browser Testing

- [ ] **E2E-01**: Playwright runs generated tests in Chromium by default
- [ ] **E2E-02**: Tests run across multiple viewports (desktop 1280x720, mobile 375x667, tablet 768x1024)
- [ ] **E2E-03**: Screenshot captured automatically on test failure
- [ ] **E2E-04**: Console errors (uncaught exceptions, console.error) monitored during runs
- [ ] **E2E-05**: Network failures (4xx, 5xx, broken assets) detected during runs
- [ ] **E2E-06**: Auto-discovery of clickable elements and form fields on each page

### Accessibility

- [ ] **A11Y-01**: axe-core integration scans every visited page for WCAG 2.1 AA violations
- [ ] **A11Y-02**: Touch target size validation for mobile viewports
- [ ] **A11Y-03**: Color contrast violations reported with specific elements and fix suggestions

### Visual Regression

- [ ] **VIS-01**: Pixel-diff comparison against stored baselines (no paid vendor required)
- [ ] **VIS-02**: User can update baselines via `sniff update-baselines`
- [ ] **VIS-03**: Smart diff thresholds ignore sub-pixel/anti-aliasing noise

### Performance

- [ ] **PERF-01**: Lighthouse performance scores collected during test runs
- [ ] **PERF-02**: User can set performance budgets in config (LCP, FCP, TTI thresholds)
- [ ] **PERF-03**: Budget violations reported as findings with severity

### Reporting

- [ ] **RPT-01**: HTML report generated with all findings, screenshots, and severity scores
- [ ] **RPT-02**: Each finding has severity (critical, high, medium, low, info)
- [ ] **RPT-03**: Findings include fix suggestions where possible
- [ ] **RPT-04**: JUnit XML output for CI integration
- [ ] **RPT-05**: JSON output for programmatic consumption
- [ ] **RPT-06**: Report uses "brutal honesty" tone — direct, opinionated, no sugar-coating

### Exploration

- [ ] **EXPLR-01**: AI-driven chaos monkey mode autonomously navigates the app
- [ ] **EXPLR-02**: Chaos monkey clicks every clickable, fills forms with edge-case data
- [ ] **EXPLR-03**: Exploration findings reported with full trace of AI decisions

### CI Integration

- [ ] **CI-01**: `sniff ci` generates a GitHub Actions workflow file
- [ ] **CI-02**: CI mode runs headless with appropriate exit codes
- [ ] **CI-03**: Flakiness detection tracks test stability across runs
- [ ] **CI-04**: Flaky tests auto-quarantined (run but don't block pipeline)

### Distribution

- [ ] **DIST-01**: Published to npm (`npx sniff` works for zero-install usage)
- [ ] **DIST-02**: MCP server exposes `sniff scan`, `sniff run`, `sniff report` as MCP tools
- [ ] **DIST-03**: Claude Code plugin for one-line install (`claude plugin add sniff`)
- [ ] **DIST-04**: Configurable via `sniff.config.ts`, `.sniffrc.json`, or `package.json#sniff`

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Testing

- **ADV-01**: Cross-browser testing (WebKit, Firefox) in addition to Chromium
- **ADV-02**: Mobile device emulation matrix beyond basic viewports
- **ADV-03**: Watch mode for local dev (`sniff run --watch`)
- **ADV-04**: Self-learning from previous runs — prioritize flaky areas

### Integrations

- **INT-01**: PR comment bot (posts findings on GitHub pull requests)
- **INT-02**: Slack / Discord notifications on test failures
- **INT-03**: Cursor / Windsurf / OpenCode integrations via MCP

### Distribution

- **DIST2-01**: Homebrew tap for macOS installation
- **DIST2-02**: curl installer for quick setup

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Web dashboard / GUI | Anti-feature: developers live in terminals and IDEs, dashboards create friction |
| Account / signup requirement | Anti-feature: highest friction point for OSS adoption |
| Proprietary test format | Anti-feature: vendor lock-in, generates standard Playwright files instead |
| Recording mode | Fragile, produces unmaintainable tests, AI generation is better |
| BrowserStack / Sauce Labs | Adds complexity and cost, defer to v0.4+ |
| Synthetic user generator | Nice-to-have, not core to QA mission |
| i18n coverage checker | Specialized concern, not core |
| Dark mode visual regression | Subset of visual regression, handle as config option later |
| Sentry / DataDog integration | Monitoring, not testing |
| Mobile native app testing | Web-first, browser emulation covers mobile web |
| Telemetry / analytics | Anti-feature unless opt-in with clear disclosure |
| Plain English test writing | Anti-feature: breaks on complexity, generates real TypeScript instead |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | TBD | Pending |
| CLI-02 | TBD | Pending |
| CLI-03 | TBD | Pending |
| CLI-04 | TBD | Pending |
| CLI-05 | TBD | Pending |
| CLI-06 | TBD | Pending |
| CLI-07 | TBD | Pending |
| REPO-01 | TBD | Pending |
| REPO-02 | TBD | Pending |
| REPO-03 | TBD | Pending |
| REPO-04 | TBD | Pending |
| REPO-05 | TBD | Pending |
| AIGEN-01 | TBD | Pending |
| AIGEN-02 | TBD | Pending |
| AIGEN-03 | TBD | Pending |
| AIGEN-04 | TBD | Pending |
| AIGEN-05 | TBD | Pending |
| AIGEN-06 | TBD | Pending |
| SRC-01 | TBD | Pending |
| SRC-02 | TBD | Pending |
| SRC-03 | TBD | Pending |
| SRC-04 | TBD | Pending |
| E2E-01 | TBD | Pending |
| E2E-02 | TBD | Pending |
| E2E-03 | TBD | Pending |
| E2E-04 | TBD | Pending |
| E2E-05 | TBD | Pending |
| E2E-06 | TBD | Pending |
| A11Y-01 | TBD | Pending |
| A11Y-02 | TBD | Pending |
| A11Y-03 | TBD | Pending |
| VIS-01 | TBD | Pending |
| VIS-02 | TBD | Pending |
| VIS-03 | TBD | Pending |
| PERF-01 | TBD | Pending |
| PERF-02 | TBD | Pending |
| PERF-03 | TBD | Pending |
| RPT-01 | TBD | Pending |
| RPT-02 | TBD | Pending |
| RPT-03 | TBD | Pending |
| RPT-04 | TBD | Pending |
| RPT-05 | TBD | Pending |
| RPT-06 | TBD | Pending |
| EXPLR-01 | TBD | Pending |
| EXPLR-02 | TBD | Pending |
| EXPLR-03 | TBD | Pending |
| CI-01 | TBD | Pending |
| CI-02 | TBD | Pending |
| CI-03 | TBD | Pending |
| CI-04 | TBD | Pending |
| DIST-01 | TBD | Pending |
| DIST-02 | TBD | Pending |
| DIST-03 | TBD | Pending |
| DIST-04 | TBD | Pending |

**Coverage:**
- v1 requirements: 49 total
- Mapped to phases: 0
- Unmapped: 49

---
*Requirements defined: 2026-04-15*
*Last updated: 2026-04-15 after initial definition*
