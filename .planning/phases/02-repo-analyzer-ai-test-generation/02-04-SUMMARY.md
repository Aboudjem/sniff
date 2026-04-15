---
phase: 02-repo-analyzer-ai-test-generation
plan: 04
subsystem: ai-providers-generator-scan-wiring
tags: [ai, providers, generator, scan-command, claude-code, anthropic-api]
dependency_graph:
  requires: [02-02, 02-03]
  provides: [ClaudeCodeProvider, AnthropicAPIProvider, generateTests, scan-wiring]
  affects: [src/ai/, src/cli/commands/scan.ts, src/index.ts]
tech_stack:
  added: ["@anthropic-ai/sdk"]
  patterns: [shell-exec-provider, sdk-provider, batch-concurrency, route-to-filename]
key_files:
  created:
    - src/ai/claude-code.ts
    - src/ai/anthropic-api.ts
    - src/ai/generator.ts
    - test/ai/claude-code.test.ts
    - test/ai/anthropic-api.test.ts
    - test/ai/generator.test.ts
  modified:
    - src/ai/index.ts
    - src/cli/commands/scan.ts
    - src/index.ts
    - package.json
decisions:
  - "Used promisify(execFile) for ClaudeCodeProvider rather than raw callback to match async/await pattern"
  - "Anthropic SDK installed as direct dependency but lazy-loaded so non-API users never load it"
  - "routePathToFileName strips non-alphanumeric chars for path traversal prevention (T-02-12)"
metrics:
  duration: 256s
  completed: 2026-04-15
  tasks: 2
  files_created: 6
  files_modified: 4
  tests_added: 19
  tests_total_passing: 37
---

# Phase 02 Plan 04: AI Providers, Test Generator, and Scan Wiring Summary

ClaudeCodeProvider shells out to `claude --print --output-format json` with 2-minute timeout and 5MB buffer; AnthropicAPIProvider lazy-loads @anthropic-ai/sdk; generateTests orchestrates per-route AI calls with configurable concurrency writing .spec.ts files; scan command wires RepoAnalyzer registration and generateTests call after analysis.

## What Was Built

### Task 1: ClaudeCodeProvider and AnthropicAPIProvider (TDD)
- `ClaudeCodeProvider` implements `AIProvider` via `execFile('claude', ['--print', '--output-format', 'json', '--system-prompt', ...])` with 120s timeout and 5MB maxBuffer
- `AnthropicAPIProvider` implements `AIProvider` via lazy-loaded `@anthropic-ai/sdk` with `messages.create` call
- Both use `buildSystemPrompt()` and `buildUserPrompt()` from prompt-builder, and `parseGeneratedTest()` from response-parser
- Error handling with specific codes: `CLAUDE_CLI_NOT_FOUND` (ENOENT), `CLAUDE_CLI_ERROR` (general), `ANTHROPIC_API_ERROR`
- 9 unit tests covering both providers

### Task 2: Test Generator Orchestrator and Scan Command Wiring (TDD)
- `generateTests()` resolves provider, iterates routes in batches of `maxConcurrency` (default 5), builds `RouteTestContext` per route, writes `.spec.ts` files
- Route-to-filename: `/` -> `home.spec.ts`, `/dashboard/settings` -> `dashboard-settings.spec.ts`
- Uses `Promise.allSettled` for resilience: failed routes are skipped with warnings, remaining routes continue
- Logs progress per batch: `Generating tests: 5/50 routes...`
- Creates output directory recursively if missing
- **Scan command wiring**: registers `RepoAnalyzer`, extracts `analysis` from `repoResult.metadata`, calls `generateTests` with config-driven options
- `src/index.ts` exports `AnalysisResult`, `AIProvider`, `GeneratedTest` types and `generateTests` function
- 10 unit tests covering generator behavior

## Deviations from Plan

None - plan executed exactly as written.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-02-10 | Uses `execFile` (not `exec`) to avoid shell injection; prompt passed as positional arg; timeout 120s and maxBuffer 5MB set |
| T-02-11 | API key from env var only, never logged; SDK lazy-loaded via `await import()` so never bundled for non-API users |
| T-02-12 | `routePathToFileName` strips non-alphanumeric chars; files written only to configured outputDir |
| T-02-13 | `maxConcurrency` limits parallel AI calls (default 5); 2-minute timeout per route on Claude CLI |

## Known Stubs

None - all implementations are complete and wired end-to-end.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | db2037e | feat(02-04): implement ClaudeCodeProvider and AnthropicAPIProvider |
| 2 | 26f871a | feat(02-04): implement test generator orchestrator and wire scan command |

## Self-Check: PASSED

All 6 created files verified on disk. Both commit hashes (db2037e, 26f871a) verified in git log. 37/37 tests passing across 5 AI test files.
