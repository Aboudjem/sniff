---
phase: 02-repo-analyzer-ai-test-generation
plan: 03
subsystem: analyzers/scanners/config
tags: [element-extraction, ast-parsing, vue-sfc, repo-analyzer, config-schema]
dependency_graph:
  requires: [02-01]
  provides: [extractElements, RepoAnalyzer, analyzerConfigSchema, aiConfigSchema]
  affects: [src/config/schema.ts, src/analyzers/index.ts]
tech_stack:
  added: ["@babel/parser", "@babel/traverse", "@vue/compiler-sfc", "@types/babel__traverse"]
  patterns: [ast-visitor, batch-processing, lazy-import, scanner-plugin]
key_files:
  created:
    - src/analyzers/element-extractor.ts
    - src/scanners/repo-analyzer.ts
    - test/analyzers/element-extractor.test.ts
    - test/scanners/repo-analyzer.test.ts
  modified:
    - src/config/schema.ts
    - src/analyzers/index.ts
    - package.json
decisions:
  - "Used @babel/parser + @babel/traverse for JSX/TSX AST parsing (lightweight, ~5MB vs ts-morph ~50MB)"
  - "Used @vue/compiler-sfc parse() template AST for Vue SFC element extraction"
  - "maxConcurrency defaults to 5 for 50-route performance budget compliance"
  - "RepoAnalyzer lazy-imports all analyzer modules to keep CLI startup fast"
metrics:
  duration: "4m 6s"
  completed: "2026-04-15T12:31:47Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 24
  tests_passing: 24
---

# Phase 02 Plan 03: Element Extractor, RepoAnalyzer, Config Schema Summary

AST-based element extraction from JSX/TSX via @babel/parser and Vue SFC templates via @vue/compiler-sfc, wired into RepoAnalyzer scanner plugin that orchestrates the full analysis pipeline, with config schema extended for analyzer and AI settings.

## Task Completion

| Task | Name | Commit(s) | Status |
|------|------|-----------|--------|
| 1 | Element extractor with babel AST and Vue SFC support | 3f95cd4 (RED), 9c3932a (GREEN) | Done |
| 2 | RepoAnalyzer scanner plugin and config schema | 854fcae (RED), 7abc010 (GREEN) | Done |

## What Was Built

### Element Extractor (`src/analyzers/element-extractor.ts`)

- Parses JSX/TSX files using `@babel/parser` with TypeScript and JSX plugins
- Parses Vue `.vue` SFC templates using `@vue/compiler-sfc` template AST
- Extracts interactive elements: `form`, `button`, `a`, `input`, `select`, `textarea`
- Captures selector attributes: `data-testid`, `id`, `name`, `aria-label`, `role`, `type`, `href`, text content
- Records source line numbers for each element
- Builds `ComponentInfo` with export detection (default + named exports)
- Batch processes files in groups of 50 with graceful error handling (try/catch per file)
- Vue v-bind shorthand (`:href`) static string extraction supported

### RepoAnalyzer Scanner (`src/scanners/repo-analyzer.ts`)

- Implements `Scanner` interface following `SourceScanner` pattern exactly
- Orchestrates: framework detection -> route discovery -> element extraction
- Lazy-imports all analyzer modules for fast CLI startup
- Returns `findings: []` (analysis, not bug detection) with full `AnalysisResult` in `metadata`
- Filters route files to `.tsx`, `.jsx`, `.ts`, `.js`, `.vue` extensions

### Config Schema Extensions (`src/config/schema.ts`)

- `analyzerConfigSchema`: frameworks override, routePatterns, elementSelectors (defaults to 5 selector types)
- `aiConfigSchema`: provider (default `claude-code`), model, outputDir (default `sniff-tests`), maxConcurrency (default `5`)
- Scanners default updated from `['source']` to `['source', 'repo-analyzer']`
- Exported types: `AnalyzerConfig`, `AIConfig`

## Decisions Made

1. **@babel/parser over ts-morph** -- Only syntax-level analysis needed (finding elements), not type resolution. ~5MB vs ~50MB dependency footprint.
2. **maxConcurrency = 5** -- With 2-minute per-route AI timeouts, 5 concurrent routes keeps 50-route apps within the 10-minute performance budget.
3. **Lazy imports in RepoAnalyzer** -- Matches existing codebase pattern from scan.ts to keep CLI startup fast.

## Deviations from Plan

None -- plan executed exactly as written.

## TDD Gate Compliance

- Task 1: RED commit `3f95cd4` -> GREEN commit `9c3932a` (verified)
- Task 2: RED commit `854fcae` -> GREEN commit `7abc010` (verified)

Both tasks followed the mandatory RED/GREEN gate sequence.

## Test Coverage

- `test/analyzers/element-extractor.test.ts`: 13 tests (JSX/TSX extraction, Vue SFC, parse errors, ComponentInfo)
- `test/scanners/repo-analyzer.test.ts`: 11 tests (6 RepoAnalyzer + 5 config schema)
- Full suite: 64 tests across 6 files, all passing

## Self-Check: PASSED
