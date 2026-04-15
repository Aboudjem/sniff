---
phase: 03-browser-runner-quality-scanners-reporting
plan: 05
subsystem: cli
tags: [playwright, cli, browser-testing, reporting, accessibility, visual-regression, performance]

requires:
  - phase: 03-01
    provides: BrowserRunner class with viewport iteration and page hooks
  - phase: 03-02
    provides: AccessibilityScanner and VisualRegressionScanner implementations
  - phase: 03-03
    provides: PerformanceScanner with Lighthouse integration and report model
  - phase: 03-04
    provides: HTML report generator with dark/light theming
provides:
  - Full sniff run command wiring browser runner, all scanners, and report generation
  - Extended CLI with --base-url, --no-headless, --format, --fail-on, --json options
  - update-baselines command registration
  - Browser-aware formatter with scanner-grouped output
  - Report command with format regeneration capability
affects: [phase-04, cli-integration, e2e-testing]

tech-stack:
  added: []
  patterns: [lazy-import-pattern, scanner-registration, fallback-route-discovery]

key-files:
  created: []
  modified:
    - src/cli/commands/run.ts
    - src/cli/index.ts
    - src/cli/formatter.ts
    - src/cli/commands/report.ts

key-decisions:
  - "Routes discovered from last-results.json with fallback to root / when no prior analysis"
  - "URL validation via URL constructor for T-03-13 threat mitigation"
  - "formatBrowserFindings groups by scanner prefix then sorts by severity within groups"

patterns-established:
  - "Scanner prefix grouping: ruleId prefixes (e2e/, a11y/, visual/, perf/, source/) map to display names"
  - "Report regeneration: report command can rebuild from stored results in any format"

requirements-completed: [CLI-03, E2E-01, E2E-02, E2E-03, E2E-04, E2E-05]

duration: 4min
completed: 2026-04-15
---

# Phase 03 Plan 05: CLI Integration Summary

**Full sniff run command wiring BrowserRunner with a11y/visual/perf scanners, Lighthouse post-browser measurement, multi-format reporting, and scanner-grouped terminal output**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T14:02:10Z
- **Completed:** 2026-04-15T14:06:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Replaced sniff run stub with full implementation: browser launch, scanner orchestration, Lighthouse measurement, report generation
- Extended CLI with all run options (--base-url, --no-headless, --format, --fail-on, --json) and registered update-baselines command
- Added formatBrowserFindings with scanner-grouped output, viewport labels, screenshot paths, and fix suggestions
- Extended report command with --format option for regenerating reports from stored results

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement full sniff run command and extend CLI registration** - `38524a2` (feat)
2. **Task 2: Extend formatter and report command for browser results** - `d6e79cc` (feat)

## Files Created/Modified
- `src/cli/commands/run.ts` - Full run command: browser launch, scanner registration, Lighthouse post-measurement, report generation, exit codes
- `src/cli/index.ts` - Updated run command options, registered update-baselines command, added report format options
- `src/cli/formatter.ts` - Added formatBrowserFindings with scanner prefix grouping, viewport labels, screenshot paths, fix suggestions
- `src/cli/commands/report.ts` - Added format regeneration and browser-aware formatter selection

## Decisions Made
- Routes discovered from `.sniff/last-results.json` repo-analyzer output, with fallback to root `/` when no prior scan exists
- URL validation uses `new URL()` constructor to reject malformed URLs before passing to Playwright (T-03-13 mitigation)
- formatBrowserFindings groups findings by ruleId prefix (e2e/, a11y/, visual/, perf/, source/) for scanner-organized terminal output
- Browser results detection in report command checks scanner names against known browser scanner list

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added URL validation for baseUrl**
- **Found during:** Task 1
- **Issue:** T-03-13 threat requires validating baseUrl is well-formed before passing to Playwright
- **Fix:** Added URL constructor validation with user-friendly error message
- **Files modified:** src/cli/commands/run.ts
- **Committed in:** 38524a2

**2. [Rule 3 - Blocking] Used readdir recursive instead of glob**
- **Found during:** Task 1
- **Issue:** glob package not in dependencies; plan referenced it for test file discovery
- **Fix:** Used Node 22 native `readdir({ recursive: true })` with string filter instead
- **Files modified:** src/cli/commands/run.ts
- **Committed in:** 38524a2

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes necessary for security and avoiding unnecessary dependencies. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All browser scanners wired into CLI via sniff run command
- Report generation works in HTML, JSON, and JUnit formats
- Phase 03 Plan 06 (if any) or Phase 04 can proceed

---
*Phase: 03-browser-runner-quality-scanners-reporting*
*Completed: 2026-04-15*

## Self-Check: PASSED
