# Phase 3: Browser Runner + Quality Scanners + Reporting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 03-browser-runner-quality-scanners-reporting
**Areas discussed:** Browser orchestration, Scanner integration model, Accessibility scanning, Visual regression, Performance measurement, Reporting, Console & Network monitoring, Screenshot capture, Auto-discovery
**Mode:** --auto (all decisions auto-selected)

---

## Browser Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| Programmatic Playwright API | Launch browsers via playwright API, full control over page lifecycle, inject scanners mid-run | ✓ |
| Subprocess execution | Spawn Playwright test runner as child process on generated .spec.ts files | |
| Hybrid | Programmatic for quality scans, subprocess for E2E test execution | |

**User's choice:** Programmatic Playwright API (auto-selected, recommended)
**Notes:** More control over page events, enables scanner injection pipeline, avoids subprocess coordination complexity.

---

## Scanner Integration Model

| Option | Description | Selected |
|--------|-------------|----------|
| Page-visit hooks pipeline | Each page visit triggers all quality scanners in sequence, extends existing Scanner interface | ✓ |
| Separate passes | Run each scanner type as independent full passes over all pages | |
| Test-embedded | Inject scanner calls directly into generated test code | |

**User's choice:** Page-visit hooks pipeline (auto-selected, recommended)
**Notes:** Reuses existing Scanner interface pattern. Efficient — visits each page once. Scanners run independently (failures don't block others).

---

## Report Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Unified report model with format adapters | Single internal model, adapters for HTML/JSON/JUnit XML | ✓ |
| Separate report per scanner | Each scanner produces its own report files | |
| Template-based | HTML template engine with partials per scanner | |

**User's choice:** Unified report model with format adapters (auto-selected, recommended)
**Notes:** Matches existing Finding type pattern. Single source of truth for all output formats.

---

## Visual Regression Baselines

| Option | Description | Selected |
|--------|-------------|----------|
| Git-committed configurable directory | `sniff-baselines/` by default, version-controlled, `sniff update-baselines` to reset | ✓ |
| .gitignored with CI artifact storage | Baselines stored locally, synced via CI artifacts | |
| Hash-based deduplication | Content-addressed storage to minimize repo size | |

**User's choice:** Git-committed configurable directory (auto-selected, recommended)
**Notes:** Simplest approach, zero infrastructure cost, version-controlled diffs visible in PRs.

---

## Performance Measurement

| Option | Description | Selected |
|--------|-------------|----------|
| Lighthouse programmatic API | Comprehensive scores via lighthouse npm package | ✓ |
| Raw Web Vitals via Playwright | Collect CWV metrics directly via Performance Observer API | |
| Hybrid | Lighthouse for full audit, raw metrics for quick checks | |

**User's choice:** Lighthouse programmatic API (auto-selected, recommended)
**Notes:** Comprehensive, proven tooling. Directly satisfies PERF-01 requirement for Lighthouse scores.

---

## Report Tone & Format

| Option | Description | Selected |
|--------|-------------|----------|
| Single-page self-contained HTML with brutal honesty | Inline CSS/JS, base64 screenshots, severity-first organization, direct tone | ✓ |
| Multi-page HTML site | Index + detail pages per scanner type | |
| Markdown report | Simple, diff-friendly, but less visual | |

**User's choice:** Single-page self-contained HTML with brutal honesty (auto-selected, recommended)
**Notes:** Zero external dependencies, easy to share/archive, matches RPT-06 requirement.

---

## Claude's Discretion

- Internal report model schema design
- HTML report visual styling and layout details
- Error handling and retry strategies for flaky browser operations
- Parallelization strategy for multi-viewport runs
- Lighthouse configuration options beyond required metrics

## Deferred Ideas

None — discussion stayed within phase scope.
