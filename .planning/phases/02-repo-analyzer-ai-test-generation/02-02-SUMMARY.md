---
phase: 02-repo-analyzer-ai-test-generation
plan: 02
subsystem: ai
tags: [ai-provider, prompt-builder, response-parser, types]
dependency_graph:
  requires: [analyzers/types.ts]
  provides: [ai/types.ts, ai/prompt-builder.ts, ai/response-parser.ts, ai/provider.ts, ai/index.ts]
  affects: [ai/claude-code.ts, ai/anthropic-api.ts]
tech_stack:
  added: []
  patterns: [pure-function-transform, lazy-dynamic-import, interface-contract, barrel-reexport]
key_files:
  created:
    - src/ai/types.ts
    - src/ai/prompt-builder.ts
    - src/ai/response-parser.ts
    - src/ai/provider.ts
    - src/ai/index.ts
    - test/ai/prompt-builder.test.ts
    - test/ai/response-parser.test.ts
  modified: []
decisions:
  - "Used pure functions for prompt builder and response parser (no classes) matching formatter.ts pattern"
  - "resolveProvider returns Promise<AIProvider> since both provider paths use dynamic import()"
  - "Response parser fallback: treats entire raw output as code when no fences found but Playwright imports detected"
  - "Source content truncated to 3000 chars in user prompts to prevent context window overflow"
metrics:
  duration: "2m 37s"
  completed: "2026-04-15T11:06:23Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 18
  files_created: 7
  files_modified: 0
---

# Phase 02 Plan 02: AI Provider Types, Prompt Builder, and Response Parser Summary

AI provider abstraction layer with type contracts, prompt construction from analysis data, response parsing with validation, and environment-based provider resolution using lazy imports.

## Task Results

| Task | Name | Commit(s) | Files | Tests |
|------|------|-----------|-------|-------|
| 1 | Define AI types and implement prompt builder | `2cac3be` (RED), `4490820` (GREEN) | src/ai/types.ts, src/ai/prompt-builder.ts, src/ai/index.ts, test/ai/prompt-builder.test.ts | 11 |
| 2 | Implement response parser and provider resolver | `ea049c9` (RED), `5d8f0d4` (GREEN) | src/ai/response-parser.ts, src/ai/provider.ts, test/ai/response-parser.test.ts | 7 |

## What Was Built

### src/ai/types.ts
Defines the three core interfaces for the AI subsystem:
- **AIProvider** -- contract for all providers (name + generateTests method)
- **RouteTestContext** -- input data shape carrying route, elements, components, framework, optional source
- **GeneratedTest** -- output shape with specContent, reasoning, route

### src/ai/prompt-builder.ts
Two pure functions:
- **buildSystemPrompt()** -- returns system prompt instructing AI to generate Playwright .spec.ts files with selector constraints, JSDoc reasoning requirements, and best practices
- **buildUserPrompt(context)** -- constructs per-route prompts with JSON-serialized elements/components, route metadata, and truncated source content (3000 char limit for T-02-05 mitigation)

### src/ai/response-parser.ts
- **parseGeneratedTest(rawOutput, routePath)** -- extracts TypeScript code from markdown fences (```typescript or ```ts), validates Playwright imports, extracts reasoning from JSDoc comments
- Fallback: if no fences found but raw output contains `import { test`, treats entire output as code
- Throws SniffError with `PARSE_NO_CODE` or `PARSE_INVALID_TEST` codes for invalid responses (T-02-04 mitigation)

### src/ai/provider.ts
- **resolveProvider()** -- async factory that checks `ANTHROPIC_API_KEY` env var, lazy-imports the appropriate provider class via `await import()`, returns `Promise<AIProvider>`
- Claude Code is default (no env var needed), Anthropic API activates when key is present

### src/ai/index.ts
Barrel re-exports all public APIs: types, prompt builder, response parser, provider resolver.

## Deviations from Plan

None -- plan executed exactly as written.

## TDD Gate Compliance

Both tasks followed RED/GREEN cycle:
- Task 1: `test(02-02)` commit `2cac3be` (RED) followed by `feat(02-02)` commit `4490820` (GREEN)
- Task 2: `test(02-02)` commit `ea049c9` (RED) followed by `feat(02-02)` commit `5d8f0d4` (GREEN)

All gates satisfied.

## Threat Mitigations Applied

| Threat ID | Status | Implementation |
|-----------|--------|----------------|
| T-02-04 (Tampering) | Mitigated | Response parser validates `import { test/expect }` pattern before accepting generated code |
| T-02-05 (Injection) | Mitigated | JSON.stringify for all user data in prompts; sourceContent truncated to 3000 chars |
| T-02-06 (Spoofing) | Accepted | ANTHROPIC_API_KEY read from env as designed |

## Known Stubs

None. All functions are fully implemented. The `resolveProvider` function references `./claude-code.js` and `./anthropic-api.js` via lazy imports -- these files will be created by Plan 02-04. The lazy import pattern means `provider.ts` compiles and only fails at runtime if called before Plan 04 executes.

## Verification

- `npx vitest run test/ai/` -- 18 tests pass (11 prompt-builder + 7 response-parser)
- All interfaces export correctly from types.ts
- All .js import extensions used consistently
- Barrel index.ts re-exports all public APIs

## Self-Check: PASSED

- All 7 files found on disk
- All 4 commits found in git log (2cac3be, 4490820, ea049c9, 5d8f0d4)
