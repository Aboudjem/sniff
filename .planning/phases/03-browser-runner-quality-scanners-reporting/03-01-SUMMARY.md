---
phase: 03-browser-runner-quality-scanners-reporting
plan: 01
subsystem: browser
tags: [playwright, browser-runner, page-hooks, dom-discovery, e2e, viewports]

requires:
  - phase: 01-cli-config-source-scanner
    provides: Core types (Finding, Severity), config schema (SniffConfig), scanner registry pattern, SniffError
provides:
  - BrowserFinding type extending Finding with url, viewport, screenshotPath, fixSuggestion
  - BrowserScanContext and BrowserScanner interfaces for browser-based scanners
  - ViewportConfig, BrowserRunContext, BrowserRunResult, PageVisitResult types
  - BrowserRunner class with Playwright lifecycle (launch, viewport iteration, page visits)
  - PageHookPipeline with ConsoleErrorHook, NetworkFailureHook, ScreenshotHook
  - discoverElements utility for runtime DOM inspection
  - Extended config schema with browser, viewports, accessibility, visual, performance, report sections
  - Default constants for viewports, perf budgets, visual threshold, report/baseline dirs
affects: [accessibility-scanner, visual-scanner, performance-scanner, reporting, cli-run-command]

tech-stack:
  added: [playwright]
  patterns: [lazy-import for heavy deps, error-isolated hook pipeline, origin validation on navigation]

key-files:
  created:
    - src/browser/types.ts
    - src/browser/runner.ts
    - src/browser/page-hooks.ts
    - src/browser/discovery.ts
  modified:
    - src/core/types.ts
    - src/scanners/types.ts
    - src/config/schema.ts
    - src/config/defaults.ts
    - package.json

key-decisions:
  - "Playwright installed as full dependency (not peer) for simpler initial setup"
  - "Origin validation on URLs before navigation for T-03-01 threat mitigation"
  - "Error isolation in PageHookPipeline mirrors ScannerRegistry pattern"

patterns-established:
  - "Lazy import: heavy deps like playwright loaded via await import() at call site"
  - "Hook pipeline: register/setup/collect/reset lifecycle with error isolation per hook"
  - "Browser type extension: BrowserFinding extends Finding, BrowserScanContext extends ScanContext"

requirements-completed: [CLI-03, E2E-01, E2E-02, E2E-03, E2E-04, E2E-05, E2E-06]

duration: 3min
completed: 2026-04-15
---

# Phase 3 Plan 1: Browser Runner Foundation Summary

**Playwright-based BrowserRunner with viewport iteration, console/network hook pipeline, failure screenshots, and runtime DOM discovery**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-15T13:44:52Z
- **Completed:** 2026-04-15T13:47:36Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Browser type system fully defined: BrowserFinding, BrowserScanContext, BrowserScanner, ViewportConfig, BrowserRunContext, BrowserRunResult, PageVisitResult
- Config schema extended with 6 new optional sections (browser, viewports, accessibility, visual, performance, report) with sensible defaults
- BrowserRunner orchestrates Chromium launch, viewport iteration, page navigation, scanner pipeline execution, and hook finding collection
- PageHookPipeline captures console errors, network failures, and failure screenshots with error isolation
- Runtime DOM discovery extracts clickable elements, inputs, forms, and links with best-effort CSS selectors

## Task Commits

Each task was committed atomically:

1. **Task 1: Define all browser types, extend core types, and extend config schema** - `08ec213` (feat)
2. **Task 2: Implement BrowserRunner, PageHookPipeline, and runtime discovery** - `b125d86` (feat)

## Files Created/Modified
- `src/browser/types.ts` - ViewportConfig, BrowserRunContext, PageVisitResult, BrowserRunResult types
- `src/browser/runner.ts` - BrowserRunner class with Playwright lifecycle and scanner pipeline
- `src/browser/page-hooks.ts` - PageHookPipeline with ConsoleErrorHook, NetworkFailureHook, ScreenshotHook
- `src/browser/discovery.ts` - discoverElements function for runtime DOM inspection
- `src/core/types.ts` - Added BrowserFinding extending Finding
- `src/scanners/types.ts` - Added BrowserScanContext and BrowserScanner interfaces
- `src/config/schema.ts` - Extended with browser, viewports, a11y, visual, perf, report schemas
- `src/config/defaults.ts` - Added default constants for viewports, perf budgets, visual threshold
- `package.json` - Added playwright dependency

## Decisions Made
- Playwright installed as full dependency (not peer) for simpler initial setup; can be moved to peerDependencies later
- Origin validation on URLs before navigation implements T-03-01 threat mitigation
- Error isolation in PageHookPipeline mirrors the existing ScannerRegistry try/catch pattern from Phase 1
- ScreenshotHook is on-demand (not event-driven) -- called by runner only when severe findings detected

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed playwright dependency**
- **Found during:** Task 1 (pre-task setup)
- **Issue:** playwright not in package.json, needed for type imports in scanners/types.ts
- **Fix:** Ran npm install playwright --save
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript compiles, imports resolve
- **Committed in:** 08ec213 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential dependency installation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in src/ai/anthropic-api.ts and src/analyzers/element-extractor.ts (not related to this plan's changes, left untouched)

## User Setup Required
None - no external service configuration required. Users will need to run `npx playwright install chromium` before browser scanning, but that is handled by the CLI run command.

## Next Phase Readiness
- Browser runner foundation complete, ready for accessibility scanner (Plan 02), visual regression (Plan 03), and performance scanner (Plan 04)
- BrowserScanner interface and BrowserScanContext ready for scanner implementations to consume
- Config schema pre-wired for all scanner-specific configuration

---
*Phase: 03-browser-runner-quality-scanners-reporting*
*Completed: 2026-04-15*

## Self-Check: PASSED

All 8 files verified present. Both task commits (08ec213, b125d86) confirmed in git log.
