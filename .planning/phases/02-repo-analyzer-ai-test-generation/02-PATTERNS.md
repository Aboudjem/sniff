# Phase 2: Repo Analyzer + AI Test Generation - Pattern Map

**Mapped:** 2026-04-15
**Files analyzed:** 14 new files + 2 modified files
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/analyzers/types.ts` | model | transform | `src/scanners/types.ts` | exact |
| `src/analyzers/index.ts` | utility (barrel) | N/A | `src/scanners/source/rules/index.ts` | exact |
| `src/analyzers/framework-detector.ts` | service | file-I/O | `src/scanners/source/index.ts` | role-match |
| `src/analyzers/route-discoverer.ts` | service | file-I/O | `src/scanners/source/index.ts` | role-match |
| `src/analyzers/element-extractor.ts` | service | transform | `src/scanners/source/index.ts` | role-match |
| `src/ai/types.ts` | model | N/A | `src/scanners/types.ts` | exact |
| `src/ai/index.ts` | utility (barrel) | N/A | `src/scanners/source/rules/index.ts` | exact |
| `src/ai/provider.ts` | service | request-response | `src/config/loader.ts` | partial |
| `src/ai/claude-code.ts` | service | request-response | No close analog (shell exec) | none |
| `src/ai/anthropic-api.ts` | service | request-response | No close analog (SDK client) | none |
| `src/ai/prompt-builder.ts` | utility | transform | `src/cli/formatter.ts` | partial |
| `src/ai/response-parser.ts` | utility | transform | `src/cli/formatter.ts` | partial |
| `src/scanners/repo-analyzer.ts` | controller (scanner plugin) | transform | `src/scanners/source/index.ts` | exact |
| `src/config/schema.ts` (modify) | config | N/A | self | exact |
| `src/cli/commands/scan.ts` (modify) | controller (CLI) | request-response | self | exact |
| `src/index.ts` (modify) | utility (barrel) | N/A | self | exact |

## Pattern Assignments

### `src/analyzers/types.ts` (model, transform)

**Analog:** `src/scanners/types.ts` (lines 1-21)

**Imports pattern** (lines 1-2):
```typescript
import type { SniffConfig } from '../config/schema.js';
import type { Finding } from '../core/types.js';
```

**Core pattern** — interface-only type file, no logic. Use `export interface` with JSDoc. Keep `.js` extensions on all imports (ESM Node16 resolution).

```typescript
// Entire file is pure type exports, example shape:
export interface ScanContext {
  config: SniffConfig;
  rootDir: string;
}

export interface ScanResult {
  scanner: string;
  findings: Finding[];
  duration: number;
  metadata?: Record<string, unknown>;
}
```

**Key convention:** Optional fields use `?` suffix. `Record<string, unknown>` for flexible metadata bags. No classes, only interfaces.

---

### `src/analyzers/index.ts` (barrel re-export)

**Analog:** `src/scanners/source/rules/index.ts` (lines 1-21)

**Core pattern** — barrel file that re-exports from siblings and aggregates collections:
```typescript
import type { Severity } from '../../../core/types.js';
import { placeholderRules } from './placeholder.js';
import { debugRules } from './debug.js';
import { hardcodedRules } from './hardcoded.js';
import { importRules } from './imports.js';

export interface SourceRule {
  id: string;
  severity: Severity;
  // ...
}

export const allRules: SourceRule[] = [
  ...placeholderRules,
  ...debugRules,
  ...hardcodedRules,
  ...importRules,
];
```

**Key convention:** Barrel files can define shared interfaces AND aggregate from child modules.

---

### `src/analyzers/framework-detector.ts` (service, file-I/O)

**Analog:** `src/scanners/source/index.ts` (lines 1-44)

**Imports pattern** (lines 1-4):
```typescript
import fg from 'fast-glob';
import { readFile, access } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';
```

**File existence check pattern** (lines 15-22):
```typescript
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
```

**Core pattern** — export a class or async function that receives `rootDir: string`, reads package.json and checks for config file existence. Use `readFile` + `JSON.parse` for package.json, `access` for config file detection. Return typed result.

**Error handling** — wrap individual file checks in try/catch, return partial results rather than throwing.

---

### `src/analyzers/route-discoverer.ts` (service, file-I/O)

**Analog:** `src/scanners/source/index.ts` (lines 67-73)

**Glob scanning pattern** (lines 67-73):
```typescript
const files = await fg(globs, {
  cwd: ctx.rootDir,
  ignore: ctx.config.exclude,
  absolute: true,
});
```

**Batch processing pattern** (lines 76-85):
```typescript
// Process files in batches of 50
for (let i = 0; i < files.length; i += 50) {
  const batch = files.slice(i, i + 50);
  const batchResults = await Promise.all(
    batch.map((filePath) =>
      this.scanFile(filePath, enabledRules, ctx.rootDir),
    ),
  );
  for (const result of batchResults) {
    findings.push(...result);
  }
}
```

**Key convention:** Use `fast-glob` for directory scanning, respect `exclude` patterns, use batch `Promise.all` for parallel file processing.

---

### `src/analyzers/element-extractor.ts` (service, transform)

**Analog:** `src/scanners/source/index.ts` (lines 102-158)

**Per-file processing pattern** (lines 102-158):
```typescript
private async scanFile(
  filePath: string,
  rules: SourceRule[],
  rootDir: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const relPath = relative(rootDir, filePath);
  // ... process content, accumulate results ...
  return findings;
}
```

**Key convention:** Read file as utf-8, work with content, return typed array. Use `relative()` for display paths. This file will use `@babel/parser` + `@babel/traverse` instead of regex (new dependency not in existing codebase).

---

### `src/ai/types.ts` (model)

**Analog:** `src/scanners/types.ts` (lines 1-21)

Same pattern as `src/analyzers/types.ts` above. Pure interface exports. Define `AIProvider`, `RouteTestContext`, `GeneratedTest` interfaces.

---

### `src/ai/index.ts` (barrel)

**Analog:** `src/scanners/source/rules/index.ts`

Same barrel pattern. Re-export types and key functions from siblings.

---

### `src/ai/provider.ts` (service, request-response)

**Analog:** `src/config/loader.ts` (lines 1-34)

**Resolution/factory pattern** (lines 4-34):
```typescript
export async function loadConfig(searchFrom?: string): Promise<SniffConfig> {
  // ... detection logic ...
  const result = await explorer.search(searchFrom);
  const raw = result?.config ?? {};

  const parsed = sniffConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const { prettifyError } = await import('zod');
    const formatted = prettifyError(parsed.error);
    throw new Error(`Invalid sniff config:\n${formatted}`);
  }

  return parsed.data;
}
```

**Key convention:** Export a factory function that inspects environment/config and returns the correct implementation. Use `import()` for lazy-loading heavy dependencies. Throw descriptive errors on failure.

For `resolveProvider()`: check `process.env.ANTHROPIC_API_KEY`, return `AnthropicAPIProvider` or `ClaudeCodeProvider`.

---

### `src/ai/claude-code.ts` (service, request-response)

**No close analog.** This file shells out to `claude` CLI via `child_process`.

**Relevant patterns to follow from codebase:**
- Use `import { execFile } from 'node:child_process'` and `import { promisify } from 'node:util'`
- Implement the `AIProvider` interface from `src/ai/types.ts`
- Error handling: wrap in try/catch like `src/scanners/registry.ts` lines 17-31

**Registry error pattern** (registry.ts lines 22-31):
```typescript
} catch (err) {
  results.push({
    scanner: scanner.name,
    findings: [],
    duration: 0,
    metadata: {
      error: err instanceof Error ? err.message : String(err),
    },
  });
}
```

---

### `src/ai/anthropic-api.ts` (service, request-response)

**No close analog.** Uses `@anthropic-ai/sdk` (new dependency).

**Same patterns as `claude-code.ts`:** Implement `AIProvider` interface, follow error handling from registry.ts. Lazy-load the SDK via `await import('@anthropic-ai/sdk')` (matches the lazy-load convention from `src/cli/commands/scan.ts` lines 15-18).

**Lazy-load pattern** (scan.ts lines 15-18):
```typescript
const { loadConfig } = await import('../../config/loader.js');
const { ScannerRegistry } = await import('../../scanners/registry.js');
const { SourceScanner } = await import('../../scanners/source/index.js');
```

---

### `src/ai/prompt-builder.ts` (utility, transform)

**Analog (partial):** `src/cli/formatter.ts`

**Pattern:** Pure function that takes structured data in, returns string out. No side effects. Export named functions like `buildSystemPrompt(...)` and `buildUserPrompt(route, elements, components)`.

**Key convention:** Template literal strings for constructing output. Take typed inputs (from `src/ai/types.ts` and `src/analyzers/types.ts`), return `string`.

---

### `src/ai/response-parser.ts` (utility, transform)

**Analog (partial):** `src/cli/formatter.ts`

**Pattern:** Pure function that takes string in, returns structured data out. Export named function `parseGeneratedTest(rawOutput: string): GeneratedTest`.

**Key convention:** Extract code blocks via regex, validate presence of expected patterns (`import { test, expect }`). Return typed result.

---

### `src/scanners/repo-analyzer.ts` (scanner plugin, transform)

**Analog:** `src/scanners/source/index.ts` (lines 46-93) -- **exact match**

**Scanner class pattern** (lines 46-93):
```typescript
export class SourceScanner implements Scanner {
  name = 'source';

  async scan(ctx: ScanContext): Promise<ScanResult> {
    const start = performance.now();
    // ... do work ...
    return {
      scanner: this.name,
      findings,
      duration: performance.now() - start,
    };
  }

  private resolveRules(ctx: ScanContext): SourceRule[] {
    // ... private helper methods ...
  }
}
```

**Key convention:** Class implements `Scanner` interface. `name` as class property. `scan()` uses `performance.now()` for timing. Return `ScanResult` with `scanner`, `findings`, `duration`, `metadata`. Private helpers for sub-steps. The repo-analyzer returns `findings: []` and puts analysis in `metadata`.

---

### `src/config/schema.ts` (modify)

**Self-analog.** Extend existing Zod schema.

**Schema extension pattern** (lines 1-21):
```typescript
import { z } from 'zod';
import { DEFAULT_EXCLUDE } from './defaults.js';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

// Add new sub-schemas here following same pattern:
export const sniffConfigSchema = z.object({
  failOn: z.array(severitySchema).default(['critical', 'high']),
  exclude: z.array(z.string()).default(DEFAULT_EXCLUDE),
  include: z.array(z.string()).default(['**/*.{ts,tsx,js,jsx,html,css}']),
  rules: z.record(z.string(), ruleConfigSchema).default({}),
  scanners: z.array(z.string()).default(['source']),
  // ADD: analyzer: analyzerConfigSchema.optional(),
  // ADD: ai: aiConfigSchema.optional(),
});
```

**Key convention:** Define sub-schemas as named `const`, compose into main schema. Use `.default()` for all optional fields. Export both `z.output` and `z.input` types.

---

### `src/cli/commands/scan.ts` (modify)

**Self-analog.** Register new scanner in command handler.

**Scanner registration pattern** (lines 15-24):
```typescript
const { loadConfig } = await import('../../config/loader.js');
const { ScannerRegistry } = await import('../../scanners/registry.js');
const { SourceScanner } = await import('../../scanners/source/index.js');
const { saveResults } = await import('../../core/persistence.js');

const config = await loadConfig(process.cwd());
const registry = new ScannerRegistry();
registry.register(new SourceScanner());
// ADD: const { RepoAnalyzer } = await import('../../scanners/repo-analyzer.js');
// ADD: registry.register(new RepoAnalyzer());
```

**Key convention:** Lazy `import()` for all heavy modules. Register scanner instances on the registry before `runAll()`.

---

## Shared Patterns

### Import Style
**Apply to:** All new files
- ESM imports with `.js` extension on all local imports (Node16 module resolution)
- `import type` for type-only imports
- `node:` prefix for Node.js built-ins (`node:fs/promises`, `node:path`, `node:child_process`)
- Third-party imports have no prefix

### Error Handling
**Source:** `src/scanners/registry.ts` (lines 17-31)
**Apply to:** All service files (`framework-detector`, `route-discoverer`, `element-extractor`, `claude-code`, `anthropic-api`)
```typescript
try {
  // ... operation ...
} catch (err) {
  // Capture error as string, continue with degraded result
  metadata: {
    error: err instanceof Error ? err.message : String(err),
  }
}
```

### Custom Error Class
**Source:** `src/core/errors.ts` (lines 1-9)
**Apply to:** AI provider failures, parse failures
```typescript
export class SniffError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SniffError';
    this.code = code;
  }
}
```

### Lazy Import Pattern
**Source:** `src/cli/commands/scan.ts` (lines 15-18)
**Apply to:** CLI command handlers, optional dependency loading (`@anthropic-ai/sdk`)
```typescript
const { SomeModule } = await import('../../path/to/module.js');
```

### Performance Timing
**Source:** `src/scanners/source/index.ts` (lines 49-50, 88)
**Apply to:** All scanner/analyzer operations
```typescript
const start = performance.now();
// ... work ...
duration: performance.now() - start,
```

### File Globbing
**Source:** `src/scanners/source/index.ts` (lines 67-73)
**Apply to:** Route discovery, framework detection
```typescript
import fg from 'fast-glob';
const files = await fg(globs, {
  cwd: ctx.rootDir,
  ignore: ctx.config.exclude,
  absolute: true,
});
```

### Zod Schema Convention
**Source:** `src/config/schema.ts` (lines 1-21)
**Apply to:** Config schema extension
```typescript
import { z } from 'zod';
// Named sub-schema const
export const mySchema = z.object({
  field: z.string().default('value'),
});
// Type exports
export type MyType = z.output<typeof mySchema>;
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/ai/claude-code.ts` | service | request-response | No shell-exec pattern exists in codebase; uses `child_process.execFile` |
| `src/ai/anthropic-api.ts` | service | request-response | No external API SDK usage exists in codebase; uses `@anthropic-ai/sdk` |

**Guidance for planner:** These two files should follow the `AIProvider` interface (defined in `src/ai/types.ts`). Use RESEARCH.md Section 5 and 6 code examples as the primary reference. Apply shared error handling and lazy import patterns from above.

## Metadata

**Analog search scope:** `src/` directory (22 TypeScript files)
**Files scanned:** 22
**Pattern extraction date:** 2026-04-15
