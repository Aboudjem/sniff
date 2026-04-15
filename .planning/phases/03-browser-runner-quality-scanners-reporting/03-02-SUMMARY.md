---
phase: 03-browser-runner-quality-scanners-reporting
plan: 02
subsystem: scanners
tags: [axe-core, accessibility, wcag, pixelmatch, visual-regression, baselines, a11y]

requires:
  - phase: 03-browser-runner-quality-scanners-reporting
    plan: 01
    provides: BrowserScanner interface, BrowserScanContext, BrowserFinding types, browser config schemas
  - phase: 01-cli-config-source-scanner
    provides: Core types (Finding, Severity), config schema (SniffConfig), scanner registry, CLI command pattern
provides:
  - AccessibilityScanner implementing BrowserScanner with axe-core WCAG 2.1 AA
  - VisualRegressionScanner implementing BrowserScanner with pixelmatch pixel-diff
  - updateBaselinesCommand CLI function for overwriting visual baselines
affects: [03-03, 03-04, 03-05, 03-06]

tech-stack:
  added: ["@axe-core/playwright", "pixelmatch", "pngjs", "@types/pngjs"]
  patterns: [lazy-import-heavy-deps, browser-scanner-pattern, baseline-management]

key-files:
  created:
    - src/scanners/accessibility/index.ts
    - src/scanners/visual/index.ts
    - src/cli/commands/update-baselines.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "Named import for AxeBuilder (not default export) from @axe-core/playwright"
  - "Corrupted baseline PNG handled gracefully with high-severity finding (T-03-06 mitigation)"
  - "Dimension mismatch treated as high-severity regression instead of crash"

patterns-established:
  - "BrowserScanner lazy-imports: heavy deps loaded inside scan() for fast startup"
  - "Severity scaling by diff percentage: >5% high, >1% medium, >0% low"
  - "Baseline auto-creation on first run as info-level finding"

requirements-completed: [A11Y-01, A11Y-02, A11Y-03, VIS-01, VIS-02, VIS-03]

duration: 2min
completed: 2026-04-15
---

# Phase 03 Plan 02: Accessibility + Visual Regression Scanners Summary

**axe-core WCAG 2.1 AA accessibility scanner with touch target and color contrast rules, plus pixelmatch visual regression scanner with baseline management and update-baselines CLI command**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-15T13:49:19Z
- **Completed:** 2026-04-15T13:51:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- AccessibilityScanner runs axe-core with WCAG 2.1 AA tags, maps violations to BrowserFinding with severity and fix suggestions
- Touch target-size rule explicitly enabled on mobile viewports (A11Y-02)
- Color contrast violations include expected vs actual contrast ratios in fix suggestions (A11Y-03)
- VisualRegressionScanner compares screenshots against stored baselines using pixelmatch with configurable threshold
- First run auto-creates baselines as info findings; corrupted baselines handled gracefully (T-03-06)
- update-baselines command with confirmation prompt and --yes flag for CI usage

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement AccessibilityScanner with axe-core integration** - `3c433e2` (feat)
2. **Task 2: Implement VisualRegressionScanner with pixelmatch and update-baselines command** - `4d57978` (feat)

## Files Created/Modified
- `src/scanners/accessibility/index.ts` - AccessibilityScanner with axe-core WCAG 2.1 AA, touch target, color contrast
- `src/scanners/visual/index.ts` - VisualRegressionScanner with pixelmatch pixel-diff and baseline management
- `src/cli/commands/update-baselines.ts` - CLI command to overwrite baselines from current screenshots
- `package.json` - Added @axe-core/playwright, pixelmatch, pngjs dependencies
- `package-lock.json` - Lock file updated

## Decisions Made
- Used named import `{ AxeBuilder }` instead of default import (axe-core/playwright export structure)
- Added corrupted baseline handling (T-03-06 threat mitigation) as Rule 2 auto-add
- Dimension mismatch between baseline and current screenshot treated as high-severity finding rather than throwing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AxeBuilder import pattern**
- **Found during:** Task 1 (AccessibilityScanner)
- **Issue:** Plan specified `(await import('@axe-core/playwright')).default` but AxeBuilder is a named export
- **Fix:** Changed to `const { AxeBuilder } = await import('@axe-core/playwright')`
- **Files modified:** src/scanners/accessibility/index.ts
- **Committed in:** 3c433e2

**2. [Rule 1 - Bug] Fixed mapAxeImpact type signature**
- **Found during:** Task 1 (AccessibilityScanner)
- **Issue:** axe-core's `ImpactValue` includes `null` which wasn't in `string | undefined`
- **Fix:** Changed parameter type to `string | null | undefined`
- **Files modified:** src/scanners/accessibility/index.ts
- **Committed in:** 3c433e2

**3. [Rule 2 - Missing Critical] Added corrupted baseline handling (T-03-06)**
- **Found during:** Task 2 (VisualRegressionScanner)
- **Issue:** Threat model T-03-06 requires graceful handling of corrupted PNG baselines
- **Fix:** Added try/catch around PNG.sync.read with high-severity finding on parse failure
- **Files modified:** src/scanners/visual/index.ts
- **Committed in:** 4d57978

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** All fixes necessary for correctness and threat mitigation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both browser scanners ready for integration with BrowserRunner pipeline
- update-baselines command ready for CLI registration in the main CLI entry point
- Performance scanner (Plan 03) can follow same BrowserScanner pattern

---
*Phase: 03-browser-runner-quality-scanners-reporting*
*Completed: 2026-04-15*
