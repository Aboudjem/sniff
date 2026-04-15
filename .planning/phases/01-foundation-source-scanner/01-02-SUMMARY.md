---
phase: 01-foundation-source-scanner
plan: 02
subsystem: scanning
tags: [fast-glob, regex, source-scanner, plugin-architecture]

# Dependency graph
requires:
  - phase: 01-foundation-source-scanner/01
    provides: "Core types (Finding, Severity), config schema (SniffConfig), defaults"
provides:
  - "Scanner plugin interface (Scanner, ScanContext, ScanResult)"
  - "ScannerRegistry for lifecycle management"
  - "SourceScanner with 10 built-in rules across 4 categories"
  - "Rule disabling via config"
affects: [01-foundation-source-scanner/03, 03-browser-scanners]

# Tech tracking
tech-stack:
  added: [fast-glob]
  patterns: [scanner-plugin-interface, rule-based-detection, batch-file-processing]

key-files:
  created:
    - src/scanners/types.ts
    - src/scanners/registry.ts
    - src/scanners/source/index.ts
    - src/scanners/source/rules/index.ts
    - src/scanners/source/rules/placeholder.ts
    - src/scanners/source/rules/debug.ts
    - src/scanners/source/rules/hardcoded.ts
    - src/scanners/source/rules/imports.ts
  modified: []

key-decisions:
  - "Simple glob matching for per-rule excludes instead of full fast-glob sync calls"
  - "Conservative broken-import detection: only relative imports, check .ts/.tsx/.js/.jsx + index variants"

patterns-established:
  - "Scanner plugin pattern: implement Scanner interface with name/setup/scan/teardown"
  - "Rule definition pattern: SourceRule with id/severity/description/pattern/include/exclude"
  - "Batch processing: 50 files at a time via Promise.all for DoS mitigation"

requirements-completed: [SRC-01, SRC-02, SRC-03, SRC-04]

# Metrics
duration: 2min
completed: 2026-04-15
---

# Phase 1 Plan 2: Scanner Plugin Interface + Source Scanner Summary

**Scanner plugin architecture with 10 regex-based rules detecting placeholders, debug artifacts, hardcoded URLs, and broken imports in JS/TS files**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-15T08:26:57Z
- **Completed:** 2026-04-15T08:29:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Scanner plugin interface (Scanner, ScanContext, ScanResult) enabling future browser scanners
- ScannerRegistry managing scanner lifecycle with error isolation per scanner
- SourceScanner with 10 rules: 4 placeholder, 2 debug, 2 hardcoded, 2 import rules
- Broken import detection with conservative filesystem resolution (tries extensions + index variants)
- Rule disabling via config (`rules: { "rule-id": "off" }`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Scanner plugin interface and registry** - `c23f577` (feat)
2. **Task 2: Source scanner rules and scanner implementation** - `97e116c` (feat)

## Files Created/Modified
- `src/scanners/types.ts` - Scanner, ScanContext, ScanResult interfaces
- `src/scanners/registry.ts` - ScannerRegistry with register/runAll lifecycle
- `src/scanners/source/index.ts` - SourceScanner implementing Scanner interface
- `src/scanners/source/rules/index.ts` - SourceRule type and allRules aggregation
- `src/scanners/source/rules/placeholder.ts` - Lorem ipsum, TODO, FIXME, TBD detection
- `src/scanners/source/rules/debug.ts` - console.log/debug/info, debugger detection
- `src/scanners/source/rules/hardcoded.ts` - localhost and 127.0.0.1 URL detection
- `src/scanners/source/rules/imports.ts` - Broken relative import detection

## Decisions Made
- Used simple glob-to-regex conversion for per-rule exclude matching instead of calling fast-glob sync per file (performance optimization)
- Conservative broken-import detection: only checks relative imports, resolves with .ts/.tsx/.js/.jsx extensions and index.* variants, no alias support

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dead code in exclude filtering**
- **Found during:** Task 2
- **Issue:** Initial exclude filtering had unused `fg.isDynamicPattern` + `fg.sync` code path alongside the simpler `matchSimpleGlob` check
- **Fix:** Removed dead code, kept only the `matchSimpleGlob` approach
- **Files modified:** src/scanners/source/index.ts
- **Committed in:** 97e116c (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cleanup only, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scanner plugin interface ready for browser scanners in Phase 3
- SourceScanner ready for integration with CLI `sniff scan` command in Plan 03
- ScannerRegistry ready to accept additional scanner registrations

---
*Phase: 01-foundation-source-scanner*
*Completed: 2026-04-15*
