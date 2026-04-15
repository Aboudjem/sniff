---
phase: 03-browser-runner-quality-scanners-reporting
verified: 2026-04-15T15:00:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run sniff run against a live local app"
    expected: "Terminal shows Playwright executing across desktop/mobile/tablet viewports, scanner progress, findings summary, and report file paths printed"
    why_human: "Cannot start a browser or local dev server in verifier. Plan 06 Task 2 human checkpoint was auto-approved without an actual app run."
  - test: "Open generated HTML report in browser"
    expected: "Report shows sections per scanner, finding cards with colored severity borders, dark mode via OS theme toggle, screenshots embedded as base64, brutal tone copy"
    why_human: "Visual correctness, dark mode rendering, and UX quality cannot be verified programmatically."
  - test: "Run sniff update-baselines after a run, then re-run"
    expected: "Confirmation prompt shown, baselines updated after 'y', re-run produces zero visual regression findings"
    why_human: "Requires interactive CLI session and filesystem state across two runs."
---

# Phase 3: Browser Runner + Quality Scanners + Reporting — Verification Report

**Phase Goal:** Users can run a single command that executes generated tests across viewports, scans for accessibility/visual/performance issues, and produces a comprehensive report
**Verified:** 2026-04-15T15:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can run `sniff run` and see Playwright execute tests in Chromium across desktop, mobile, and tablet viewports | VERIFIED | `BrowserRunner` in `src/browser/runner.ts` (179 lines): launches Chromium via `chromium.launch()`, iterates `config.viewports` (desktop 1280x720, mobile 375x667, tablet 768x1024), wired into `runCommand` in `src/cli/commands/run.ts` |
| 2 | Screenshots are captured automatically on any test failure | VERIFIED | `ScreenshotHook` in `src/browser/page-hooks.ts` implements `captureFailure()` calling `page.screenshot()`; runner captures on severe findings; `screenshotPath` propagated through `BrowserFinding` |
| 3 | Console errors and network failures (4xx, 5xx, broken assets) are detected and reported | VERIFIED | `ConsoleErrorHook` listens `page.on('console')` and `page.on('pageerror')` → `ruleId: 'e2e/console-error'`; `NetworkFailureHook` listens `page.on('response')` and `page.on('requestfailed')` → `ruleId: 'e2e/network-failure'` with severity grading |
| 4 | Every visited page scanned for WCAG 2.1 AA accessibility violations with fix suggestions | VERIFIED | `AccessibilityScanner` (107 lines) uses `@axe-core/playwright` with `.withTags(['wcag2a','wcag2aa','wcag21aa'])`, maps violations to `BrowserFinding` with `fixSuggestion`; touch target enabled on mobile; color-contrast violations include ratio detail |
| 5 | Visual regression detects pixel differences against baselines; `sniff update-baselines` resets them | VERIFIED | `VisualRegressionScanner` (150 lines) uses `pixelmatch` with configurable `threshold` and `includeAA`; auto-creates baselines on first run (info finding); `update-baselines` command registered in CLI with confirmation prompt and `--yes` flag |
| 6 | Performance budgets (LCP, FCP, TTI) configurable; violations appear as findings with severity | VERIFIED | `PerformanceScanner` (163 lines): collects URLs during browser run, runs Lighthouse separately after Playwright closes; compares LCP/FCP/TTI against configurable budgets; severity graded by overshoot percentage (>100% critical, >50% high, >25% medium) |
| 7 | HTML report generated with all findings, severity scores, screenshots, fix suggestions, brutally honest tone | VERIFIED | `generateHtmlReport` in `src/report/html.ts` (649 lines): `<!DOCTYPE html>` self-contained, all CSS inline, screenshots as base64, dark mode via `prefers-color-scheme`, 13/13 UI-SPEC patterns verified (severity colors, diff-grid, over-budget, scroll-behavior, print styles, htmlEscape) |
| 8 | JUnit XML and JSON outputs available for programmatic consumption | VERIFIED | `generateJunitReport` produces valid XML with `<testsuites>/<testsuite>/<testcase>/<failure>` and `xmlEscape`; `generateJsonReport` produces `JSON.stringify(report, null, 2)`; both verified by live execution against mock data |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/browser/types.ts` | ViewportConfig, BrowserRunContext, BrowserRunResult, PageVisitResult | VERIFIED | All 4 interfaces present |
| `src/browser/runner.ts` | BrowserRunner class with launch/run/close lifecycle | VERIFIED | 179 lines; `chromium.launch`, `browser.newContext`, `PageHookPipeline`, `performance.now` |
| `src/browser/page-hooks.ts` | PageHookPipeline for console/network/screenshot capture | VERIFIED | `PageHookPipeline` class; all 4 `page.on()` listeners; `page.screenshot`; both `ruleId` patterns |
| `src/browser/discovery.ts` | discoverElements function for runtime DOM inspection | VERIFIED | `discoverElements` async function, `DiscoveredElement` interface, `page.$$eval` |
| `src/core/types.ts` | BrowserFinding extending Finding | VERIFIED | `export interface BrowserFinding extends Finding` with url, viewport, screenshotPath, fixSuggestion |
| `src/scanners/types.ts` | BrowserScanContext and BrowserScanner interfaces | VERIFIED | Both interfaces present; `import type { Page } from 'playwright'` |
| `src/config/schema.ts` | Extended config with browser/viewports/a11y/visual/perf/report sections | VERIFIED | All 6 sub-schemas present; all 6 fields added to `sniffConfigSchema` |
| `src/config/defaults.ts` | DEFAULT_VIEWPORTS, DEFAULT_PERF_BUDGETS | VERIFIED | Both constants present |
| `src/scanners/accessibility/index.ts` | AccessibilityScanner implementing BrowserScanner | VERIFIED | 107 lines; `AxeBuilder`, `withTags`, `target-size`, `color-contrast`, `mapAxeImpact`, `fixSuggestion` |
| `src/scanners/visual/index.ts` | VisualRegressionScanner implementing BrowserScanner | VERIFIED | 150 lines; `pixelmatch`, `pngjs`, `ruleId: 'visual/new-baseline'`, `ruleId: 'visual/regression'`, `threshold`, `includeAA` |
| `src/scanners/performance/index.ts` | PerformanceScanner implementing BrowserScanner | VERIFIED | 163 lines; `lighthouse`, `chrome-launcher`, `measureAll()`, LCP/FCP/TTI metrics, `chrome.kill()` |
| `src/report/types.ts` | SniffReport, ReportMetadata, ReportSummary, Screenshot | VERIFIED | All 4 interfaces present |
| `src/report/model.ts` | buildReport and saveReport functions | VERIFIED | Both exported; `mkdir({ recursive: true })` |
| `src/report/json.ts` | generateJsonReport function | VERIFIED | Single export; `JSON.stringify(report, null, 2)` confirmed working |
| `src/report/junit.ts` | generateJunitReport function | VERIFIED | `<testsuites>/<testsuite>/<testcase>/<failure>`; `xmlEscape`; `&amp;`; confirmed working |
| `src/report/html.ts` | generateHtmlReport producing self-contained HTML | VERIFIED | 649 lines; all 13 UI-SPEC patterns; `export function generateHtmlReport` at line 631 |
| `src/cli/commands/run.ts` | Full runCommand replacing stub | VERIFIED | All 9 key patterns: BrowserRunner, AccessibilityScanner, VisualRegressionScanner, PerformanceScanner, measureAll, buildReport, saveReport, process.exit, playwright install message |
| `src/cli/commands/update-baselines.ts` | updateBaselinesCommand function | VERIFIED | Exported; confirmation prompt "overwrite … Continue? [y/N]" |
| `src/cli/index.ts` | Updated CLI with run options and update-baselines command | VERIFIED | `--base-url`, `--no-headless`, `update-baselines` command registered |
| `src/cli/formatter.ts` | Extended formatter with browser run output | VERIFIED | `formatBrowserFindings`, `formatFindings` (preserved), `pc.magenta`, `pc.blue`, `fixSuggestion`, `screenshotPath`, all scanner display names |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/browser/runner.ts` | playwright | lazy import `chromium.launch()` | WIRED | `chromium` imported lazily; `chromium.launch` on line 29 |
| `src/browser/runner.ts` | `src/browser/page-hooks.ts` | `PageHookPipeline` per page visit | WIRED | `PageHookPipeline` imported and instantiated in `run()` |
| `src/browser/page-hooks.ts` | `src/core/types.ts` | produces `BrowserFinding[]` | WIRED | `BrowserFinding` type used throughout hooks |
| `src/scanners/accessibility/index.ts` | `@axe-core/playwright` | lazy import `AxeBuilder` | WIRED | `{ AxeBuilder } = await import('@axe-core/playwright')` |
| `src/scanners/visual/index.ts` | `pixelmatch` | lazy import | WIRED | `pixelmatch = (await import('pixelmatch')).default` |
| `src/scanners/performance/index.ts` | `lighthouse` | lazy import | WIRED | `lighthouse = (await import('lighthouse')).default` |
| `src/report/model.ts` | `src/report/types.ts` | builds `SniffReport` from `ScanResult[]` | WIRED | `SniffReport` type used in `buildReport` signature |
| `src/cli/commands/run.ts` | `src/browser/runner.ts` | creates `BrowserRunner`, calls `run()` | WIRED | `BrowserRunner` imported and instantiated |
| `src/cli/commands/run.ts` | `src/report/model.ts` | calls `buildReport` and `saveReport` | WIRED | Both imported and called |
| `src/cli/commands/run.ts` | `src/scanners/performance/index.ts` | calls `performanceScanner.measureAll()` after browser closes | WIRED | `perfScanner.measureAll()` on line 153 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/browser/runner.ts` | `pageVisits`, `scanResults` | Playwright page visits + registered scanners | Yes — real browser navigation, hook findings, scanner results aggregated | FLOWING |
| `src/scanners/accessibility/index.ts` | `findings` | `builder.analyze()` from axe-core on live page | Yes — real DOM analysis via axe-core | FLOWING |
| `src/scanners/visual/index.ts` | `findings` | `pixelmatch()` comparing baseline vs current PNG | Yes — real pixel diff or baseline creation | FLOWING |
| `src/scanners/performance/index.ts` | `findings` | Lighthouse `result.lhr.audits` on measured URLs | Yes — real Lighthouse metrics compared to budgets | FLOWING |
| `src/report/html.ts` | `report` | `SniffReport` from `buildReport()` aggregating all ScanResults | Yes — all scanner findings passed through | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `sniff run --help` shows all options | `node dist/cli/index.js run --help` | Shows `--base-url`, `--no-headless`, `--format`, `--fail-on`, `--json` | PASS |
| `sniff update-baselines --help` shows `--yes` | `node dist/cli/index.js update-baselines --help` | Shows `--yes` option | PASS |
| All CLI commands registered | `node dist/cli/index.js --help` | Shows `init`, `scan`, `run`, `report`, `update-baselines` | PASS |
| JSON report produces valid JSON | `generateJsonReport(mockReport)` | `JSON.parse()` succeeds, 2 findings | PASS |
| JUnit report has correct structure | `generateJunitReport(mockReport)` | `<?xml`, `<testsuites>`, `<testsuite>`, `<testcase>`, `<failure>` all present | PASS |
| `sniff run` against live app | Requires live dev server | Cannot test in verifier | SKIP (human needed) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLI-03 | 03-01, 03-05 | User can run `sniff run` to execute full multi-dimensional test suite | SATISFIED | `runCommand` fully implemented; CLI registered with all options |
| E2E-01 | 03-01 | Playwright runs generated tests in Chromium | SATISFIED | `BrowserRunner` uses `chromium.launch()` |
| E2E-02 | 03-01 | Tests run across multiple viewports | SATISFIED | `viewports` array iterated in `BrowserRunner.run()` |
| E2E-03 | 03-01 | Screenshot captured automatically on test failure | SATISFIED | `ScreenshotHook.captureFailure()` called when severe findings detected |
| E2E-04 | 03-01 | Console errors monitored | SATISFIED | `ConsoleErrorHook` with `page.on('console')` and `page.on('pageerror')` |
| E2E-05 | 03-01 | Network failures detected | SATISFIED | `NetworkFailureHook` with `page.on('response')` and `page.on('requestfailed')` |
| E2E-06 | 03-01 | Auto-discovery of clickable elements and form fields | SATISFIED | `discoverElements()` using `page.$$eval` in `src/browser/discovery.ts` |
| A11Y-01 | 03-02 | axe-core scans every visited page for WCAG 2.1 AA | SATISFIED | `AccessibilityScanner` with `.withTags(['wcag2a','wcag2aa','wcag21aa'])` |
| A11Y-02 | 03-02 | Touch target size validation for mobile | SATISFIED | `builder.withRules(['target-size'])` when `viewport.name === 'mobile'` |
| A11Y-03 | 03-02 | Color contrast violations with fix suggestions | SATISFIED | `buildFixSuggestion()` extracts contrast ratio from `node.any` for `color-contrast` violations |
| VIS-01 | 03-02 | Pixel-diff comparison against stored baselines | SATISFIED | `pixelmatch()` call comparing PNG buffers |
| VIS-02 | 03-02 | User can update baselines via `sniff update-baselines` | SATISFIED | Command registered in CLI; `updateBaselinesCommand` with confirmation prompt |
| VIS-03 | 03-02 | Smart diff thresholds ignore sub-pixel/anti-aliasing noise | SATISFIED | Configurable `threshold` and `includeAA` passed to `pixelmatch()` |
| PERF-01 | 03-03 | Lighthouse performance scores collected | SATISFIED | `PerformanceScanner.measureAll()` runs Lighthouse on collected URLs |
| PERF-02 | 03-03 | User can set performance budgets in config | SATISFIED | `performanceConfigSchema` with LCP/FCP/TTI defaults; budget comparison in `measureAll()` |
| PERF-03 | 03-03 | Budget violations reported as findings with severity | SATISFIED | `ruleId: 'perf/${metricName}'` with severity graded by overshoot percentage |
| RPT-01 | 03-03, 03-04 | HTML report with findings, screenshots, severity | SATISFIED | `generateHtmlReport` produces self-contained HTML with all features |
| RPT-02 | 03-03 | Each finding has severity | SATISFIED | All findings carry `severity: Severity` field; `bySeverity` in ReportSummary |
| RPT-03 | 03-04 | Findings include fix suggestions where possible | SATISFIED | `fixSuggestion` rendered in finding cards in HTML report; `formatBrowserFindings` shows fix |
| RPT-04 | 03-03 | JUnit XML output for CI integration | SATISFIED | `generateJunitReport` produces valid JUnit XML with proper escaping |
| RPT-05 | 03-03 | JSON output for programmatic consumption | SATISFIED | `generateJsonReport` produces `JSON.stringify(report, null, 2)` |
| RPT-06 | 03-04 | "Brutal honesty" tone — direct, no sugar-coating | SATISFIED | "No sugar-coating, no excuses" in footer; "Clean Bill of Health" with "sniff missed something" caveat |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/browser/discovery.ts` | 46 | `'placeholder'` in attributes list | Info | DOM attribute name in array literal — NOT a stub; intentional extraction of HTML `placeholder` attribute |

No actual stubs, empty implementations, or placeholder returns found in Phase 3 files.

**Note on pre-existing TypeScript errors:** `npx tsc --noEmit` reports 11 errors in `src/ai/anthropic-api.ts` and `src/analyzers/element-extractor.ts`. These are from Phase 2 files (pre-existing before Phase 3) and are explicitly documented as out of scope in Plan 06 SUMMARY. Phase 3 files compile cleanly.

### Human Verification Required

#### 1. End-to-End sniff run against a live app

**Test:** Start a local development server (e.g., `npx serve .` or `npm run dev`), then run `npx sniff run --base-url http://localhost:PORT`
**Expected:**
- Terminal output shows "Sniff v0.1.0 — Running quality scan"
- Progress lines per page visit showing viewport and finding count
- `[perf]` Lighthouse measurement progress after browser closes
- Findings summary with severity colors and scanner groups
- Report file paths printed (e.g., `.sniff/reports/report-*.html`)
**Why human:** Cannot launch a browser or dev server in the verifier. The Plan 06 human checkpoint task was auto-approved without an actual `sniff run` execution against a real app.

#### 2. HTML report visual quality and dark mode

**Test:** Open the generated `.sniff/reports/report-*.html` in a browser. Toggle OS dark mode (System Preferences on macOS).
**Expected:**
- Sections for each scanner type (Accessibility, Visual Regression, Performance, Browser Tests)
- Finding cards have colored left borders by severity (red for critical/high, yellow for medium, green for low)
- Dark mode colors apply correctly via `prefers-color-scheme`
- Screenshots embedded directly in the report (no external requests)
- Brutal tone: direct language, "Fix this" not "Consider fixing"
**Why human:** Visual rendering, color correctness, dark mode appearance, and UX quality require a browser and human judgment.

#### 3. sniff update-baselines interactive flow

**Test:** After a `sniff run` that creates baselines, run `sniff update-baselines` (without `--yes`). Answer `y` at the prompt. Then run `sniff run` again.
**Expected:**
- Confirmation prompt shows: "This will overwrite N baseline images. Continue? [y/N]"
- After confirming, baselines are updated
- Second `sniff run` shows no visual regression findings (baselines now match current)
**Why human:** Requires interactive terminal session and stateful filesystem across two command runs.

### Gaps Summary

No gaps identified. All 8 ROADMAP success criteria are verified at the code level (exists, substantive, wired, data-flowing). All 22 requirement IDs from plans are satisfied by the implementation. The only blocking item is human verification of the live end-to-end experience, which was auto-approved in Plan 06 without actual execution.

---

_Verified: 2026-04-15T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
