---
phase: 02-repo-analyzer-ai-test-generation
plan: 01
subsystem: analyzers
tags: [typescript, framework-detection, route-discovery, nextjs, react, vue, svelte, sveltekit, fast-glob, html-fallback]

# Dependency graph
requires:
  - phase: 01-cli-scaffold-source-scanner
    provides: Scanner interface, ScanContext, fast-glob dependency, project structure
provides:
  - FrameworkInfo, RouteInfo, ElementInfo, ComponentInfo, AnalysisResult type interfaces
  - detectFrameworks function (Next.js, React, Vue, Svelte detection)
  - discoverRoutes function (file-system + config-based + HTML fallback route discovery)
  - Barrel re-exports from src/analyzers/index.ts
affects: [02-02-ai-provider-test-generation, 02-03-repo-analyzer-scanner-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [TDD red-green for analyzer modules, mkdtemp-based file-system fixture testing]

key-files:
  created:
    - src/analyzers/types.ts
    - src/analyzers/framework-detector.ts
    - src/analyzers/route-discoverer.ts
    - src/analyzers/index.ts
    - test/analyzers/framework-detector.test.ts
    - test/analyzers/route-discoverer.test.ts
  modified: []

key-decisions:
  - "Next.js checked before generic React in detection order to avoid false positives (Next.js projects always have react as a dep)"
  - "Used startsWith('_') for Pages Router special file exclusion rather than hardcoded list, covers _app, _document, _error generically"
  - "HTML fallback extracts both file-path-based routes and link/form-action-based routes for maximum coverage on plain HTML sites"
  - "No new dependencies added -- uses existing fast-glob and node:fs/promises only"

patterns-established:
  - "Analyzer module pattern: async function taking rootDir, returning typed array, with try/catch graceful degradation"
  - "File-system fixture testing: mkdtemp + writeFile for isolated test dirs, rm in afterEach"
  - "Route path normalization: relative() + regex stripping for framework-specific conventions"

requirements-completed: [REPO-01, REPO-02, REPO-04, REPO-05]

# Metrics
duration: 4min
completed: 2026-04-15
---

# Phase 2 Plan 1: Analyzer Types + Framework Detection + Route Discovery Summary

**Framework detector identifying Next.js/React/Vue/Svelte from package.json + config files, and route discoverer with deep Next.js/SvelteKit support, basic React/Vue Router config parsing, and HTML fallback for unknown frameworks**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-15T10:50:57Z
- **Completed:** 2026-04-15T10:55:14Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Defined 5 core analysis interfaces (AnalysisResult, RouteInfo, ElementInfo, ComponentInfo, FrameworkInfo) as the typed data model for the entire analysis pipeline
- Framework detector identifies Next.js, React, Vue, and Svelte from package.json dependencies + config file presence, with correct priority ordering (Next.js before React)
- Route discoverer handles 5 routing patterns: Next.js App Router (with route groups, dynamic params), Next.js Pages Router, SvelteKit, React Router (config parsing), Vue Router (config parsing)
- HTML fallback (per D-03) scans *.html files and extracts routes from both file paths and <a href>/<form action> attributes
- 22 unit tests all passing with full TDD red-green cycle

## Task Commits

Each task was committed atomically:

1. **Task 1: Define analyzer types and implement framework detector** - `a1538e1` (feat)
2. **Task 2: Implement route discoverer with multi-framework support and HTML fallback** - `c63257a` (feat)

## Files Created/Modified
- `src/analyzers/types.ts` - Pure interface file: FrameworkInfo, RouteInfo, ElementInfo, ComponentInfo, AnalysisResult
- `src/analyzers/framework-detector.ts` - detectFrameworks function with 4-framework detection + graceful degradation
- `src/analyzers/route-discoverer.ts` - discoverRoutes function with 5 routing patterns + HTML fallback
- `src/analyzers/index.ts` - Barrel re-exports for all analyzer public APIs
- `test/analyzers/framework-detector.test.ts` - 10 unit tests for framework detection
- `test/analyzers/route-discoverer.test.ts` - 12 unit tests for route discovery

## Decisions Made
- Next.js checked before generic React in detection order (Next.js projects always have react dep)
- Used `startsWith('_')` for Pages Router special file exclusion rather than hardcoded filename list
- HTML fallback extracts routes from both file paths (index.html -> /) and link/form attributes
- No new dependencies required -- reused existing fast-glob and node:fs/promises

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed App Router root page path extraction**
- **Found during:** Task 2 (Route discoverer implementation)
- **Issue:** `appRouterPathToRoute` regex required leading `/` before `page.tsx`, but root-level `page.tsx` has no leading slash from `relative()`
- **Fix:** Changed regex from `/\/page\.(tsx|jsx|ts|js)$/` to `/\/?page\.(tsx|jsx|ts|js)$/` to make leading slash optional
- **Files modified:** src/analyzers/route-discoverer.ts
- **Verification:** Test "discovers app/page.tsx as route /" passes
- **Committed in:** c63257a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Minor regex fix for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed regex issue above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All analyzer types defined and exported, ready for downstream AI test generation (plan 02-02)
- detectFrameworks and discoverRoutes available via src/analyzers/index.ts barrel
- Route discoverer accepts FrameworkInfo[] from detectFrameworks, establishing the analysis pipeline chain
- Element extraction (plan 02-02 or later) can consume the ElementInfo/ComponentInfo interfaces already defined

## Self-Check: PASSED

- All 7 files found on disk
- Commit a1538e1 found in git log
- Commit c63257a found in git log
- 22/22 tests passing

---
*Phase: 02-repo-analyzer-ai-test-generation*
*Plan: 01*
*Completed: 2026-04-15*
