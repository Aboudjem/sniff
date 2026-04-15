---
phase: 01-foundation-source-scanner
plan: 01
subsystem: infra
tags: [typescript, tsup, zod, cosmiconfig, esm, node22]

requires: []
provides:
  - "Core types: Finding, Severity, SniffError"
  - "Config system: cosmiconfig loader + Zod validation + defineConfig helper"
  - "Build pipeline: tsup with ESM output and declaration files"
  - "Package scaffold: npm package with bin entry for CLI"
affects: [01-foundation-source-scanner, 02-cli-scanner-pipeline]

tech-stack:
  added: [typescript, tsup, vitest, zod, cosmiconfig, commander, picocolors, fast-glob]
  patterns: [esm-only, node16-module-resolution, zod-schema-validation, cosmiconfig-discovery]

key-files:
  created:
    - src/core/types.ts
    - src/core/errors.ts
    - src/config/schema.ts
    - src/config/loader.ts
    - src/config/define-config.ts
    - src/config/defaults.ts
    - src/index.ts
    - tsconfig.json
    - tsup.config.ts
    - package.json
  modified: []

key-decisions:
  - "Zod v4 with prettifyError() for config validation error messages"
  - "ESM-only output (no CJS dual build) targeting Node 22+"
  - "cosmiconfig with 14 search places for maximum config file flexibility"

patterns-established:
  - "ESM module system with .js extensions in imports"
  - "Zod safeParse for all external input validation"
  - "Type-safe config with inferred input/output types"

requirements-completed: [DIST-04, CLI-05]

duration: 2min
completed: 2026-04-15
---

# Phase 1 Plan 1: Project Scaffold + Config System Summary

**TypeScript ESM project with tsup build, Zod-validated config loading via cosmiconfig, and defineConfig helper for sniff.config.ts autocomplete**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-15T08:22:33Z
- **Completed:** 2026-04-15T08:25:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Initialized npm package with ESM, Node 22+ engine requirement, and tsup build pipeline
- Defined core types (Finding, Severity) and error class (SniffError) as the foundation for all scanners
- Built complete config system: cosmiconfig discovery across 14 file formats, Zod schema validation with defaults, and defineConfig() for TypeScript autocomplete

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project and core types** - `52f88ed` (feat)
2. **Task 2: Config system (cosmiconfig + Zod + defineConfig)** - `9935c2b` (feat)

## Files Created/Modified
- `package.json` - npm package with ESM config, bin entry, build scripts
- `tsconfig.json` - TypeScript config targeting ES2022 with Node16 module resolution
- `tsup.config.ts` - Build config for ESM output with dts and sourcemaps
- `.gitignore` - Excludes node_modules, dist, .sniff, tsbuildinfo
- `src/core/types.ts` - Finding and Severity type definitions
- `src/core/errors.ts` - SniffError class with code field
- `src/config/defaults.ts` - DEFAULT_EXCLUDE patterns and DEFAULT_FAIL_ON
- `src/config/schema.ts` - Zod schema for SniffConfig with all fields optional+defaulted
- `src/config/define-config.ts` - defineConfig() identity helper for TypeScript autocomplete
- `src/config/loader.ts` - cosmiconfig-based config discovery and Zod validation
- `src/index.ts` - Public API re-exports (defineConfig, type exports)

## Decisions Made
- Used Zod v4 (4.3.6) for prettifyError() API -- better error formatting for config validation
- ESM-only build output (no CJS) since Node 22+ is the minimum target
- cosmiconfig configured with 14 search places covering .rc, .config, and package.json formats

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Core types and config system ready for CLI commands (Plan 02) and scanner pipeline (Plan 03)
- All dependencies installed and TypeScript compiling cleanly
- defineConfig() and loadConfig() available for import by downstream modules

## Self-Check: PASSED

All 11 files verified present. Both task commits (52f88ed, 9935c2b) verified in git log.

---
*Phase: 01-foundation-source-scanner*
*Completed: 2026-04-15*
