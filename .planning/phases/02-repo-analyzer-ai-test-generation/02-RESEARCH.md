# Phase 2: Repo Analyzer + AI Test Generation - Research

**Researched:** 2026-04-15
**Phase:** 02 - Repo Analyzer + AI Test Generation
**Requirements:** REPO-01, REPO-02, REPO-03, REPO-04, REPO-05, AIGEN-01, AIGEN-02, AIGEN-03, AIGEN-04, AIGEN-05, AIGEN-06

## RESEARCH COMPLETE

## 1. Framework Detection (REPO-01)

### Approach: Package.json + Config File Detection

Detection is lightweight — no AST needed:

| Framework | package.json key | Config file patterns |
|-----------|-----------------|---------------------|
| Next.js | `next` in dependencies | `next.config.{js,mjs,ts}` |
| React (CRA/Vite) | `react` in dependencies (no `next`) | `vite.config.{js,ts}`, `craco.config.js` |
| Vue | `vue` in dependencies | `vue.config.js`, `vite.config.{js,ts}` with `@vitejs/plugin-vue` |
| Svelte/SvelteKit | `svelte` in dependencies | `svelte.config.js`, `vite.config.{js,ts}` with `@sveltejs/kit` |

**Detection order matters:** Check Next.js before generic React (Next.js apps also have `react` in deps). Return an array — projects can use multiple frameworks (monorepos).

**Implementation:** Simple file-system checks with `fs.existsSync` and `JSON.parse` of package.json. No heavy dependencies needed.

## 2. Route Discovery (REPO-02)

### Next.js: File-System Routing (Deep Support)

- **App Router:** Scan `app/` directory for `page.{tsx,jsx,ts,js}` files. Directory structure = route structure. Handle:
  - `[param]` → dynamic routes
  - `(group)` → route groups (not in URL)
  - `@parallel` → parallel routes (skip)
  - `layout.tsx` → note for context but not a route
- **Pages Router:** Scan `pages/` directory for `*.{tsx,jsx,ts,js}` excluding `_app`, `_document`, `_error`.
- **Detection:** Check for `app/` vs `pages/` directory existence. Both can coexist.

### React Router: Config Parsing (Basic Support)

- Grep for `createBrowserRouter`, `<Route`, `<Routes>` patterns in source files
- Extract `path=` attributes from JSX or `path:` from route config objects
- Fragile with dynamic routes — flag as "discovered via static analysis, may be incomplete"

### Vue Router: Config Parsing (Basic Support)

- Look for `router/index.{ts,js}` or imports of `createRouter`
- Extract `path` from route config arrays
- Similar fragility caveats as React Router

### SvelteKit: File-System Routing (Deep Support)

- Similar to Next.js app router: scan `src/routes/` for `+page.svelte` files
- `[param]` for dynamic routes, `(group)` for groups

### Output Schema

```typescript
interface RouteInfo {
  path: string;           // e.g., "/dashboard/settings"
  filePath: string;       // e.g., "src/app/dashboard/settings/page.tsx"
  framework: string;      // e.g., "nextjs-app"
  dynamic: boolean;       // true if route has dynamic segments
  params?: string[];      // ["id"] for /users/[id]
}
```

## 3. Interactive Element Discovery (REPO-03, REPO-04)

### AST Tool Evaluation

**STATE.md flagged:** "ts-morph vs lighter alternatives for AST analysis"

| Tool | Install size | Parse speed | TypeScript support | Recommendation |
|------|-------------|-------------|-------------------|----------------|
| **ts-morph** | ~50MB (includes TS compiler) | Slower (full type checking) | Full type resolution | Overkill — we need syntax parsing, not type checking |
| **@swc/core** | ~30MB (native binary) | Very fast (Rust-based) | Syntax only | Good but SWC AST visitor API is low-level |
| **@babel/parser** + `@babel/traverse` | ~5MB | Fast enough | Via `@babel/plugin-transform-typescript` | Best fit — mature, well-documented, small, handles JSX/TSX natively |
| **TypeScript compiler API** | Already in devDeps | Medium | Full | Direct but verbose API |

**Recommendation: `@babel/parser` + `@babel/traverse`**
- Handles JSX, TSX, and TypeScript natively
- Small dependency footprint (~5MB)
- Well-documented AST visitor pattern
- We only need syntax-level analysis (finding elements), not type resolution
- For Vue SFC: use `@vue/compiler-sfc` to extract `<template>` then parse

### Element Extraction Strategy

Parse each component file's JSX/TSX and extract:

```typescript
interface ElementInfo {
  tag: string;          // "button", "input", "a", "form", "select", "textarea"
  testId?: string;      // data-testid attribute value
  id?: string;          // id attribute value  
  name?: string;        // name attribute value (forms)
  ariaLabel?: string;   // aria-label attribute value
  role?: string;        // role attribute value
  text?: string;        // static text content (for buttons/links)
  type?: string;        // input type (text, email, password, etc.)
  href?: string;        // link href (for <a> tags)
  filePath: string;     // source file
  line: number;         // line number
}
```

**Selector priority for generated tests:**
1. `data-testid` (most reliable)
2. `role` + accessible name
3. `aria-label`
4. `id`
5. `name` (form fields)
6. Text content (buttons/links — fragile but human-readable)

## 4. Analysis Output Format (REPO-05)

### Structured JSON Schema

The analyzer output bridges detection → AI generation:

```typescript
interface AnalysisResult {
  project: {
    name: string;
    framework: FrameworkInfo;
    rootDir: string;
  };
  routes: RouteInfo[];
  components: ComponentInfo[];
  elements: ElementInfo[];
  metadata: {
    analyzedAt: string;
    duration: number;
    fileCount: number;
    routeCount: number;
    elementCount: number;
  };
}

interface ComponentInfo {
  name: string;
  filePath: string;
  exports: string[];      // named exports
  hasDefaultExport: boolean;
  elements: ElementInfo[]; // interactive elements in this component
  routes: string[];        // routes that use this component (if detectable)
}
```

### Integration with Scanner Architecture

The analyzer registers as a scanner via the existing `Scanner` interface:

```typescript
// src/analyzers/repo-analyzer.ts implements Scanner
const repoAnalyzer: Scanner = {
  name: 'repo-analyzer',
  async scan(ctx: ScanContext): Promise<ScanResult> {
    // 1. Detect framework
    // 2. Discover routes
    // 3. Parse components for elements
    // 4. Return analysis as ScanResult.metadata
    return {
      scanner: 'repo-analyzer',
      findings: [], // No findings — this is analysis, not bug detection
      duration,
      metadata: { analysis: analysisResult }
    };
  }
};
```

**Key insight:** The analyzer doesn't produce `Finding` objects (it's not finding bugs). It produces structured analysis in `metadata`. The AI generator reads this metadata to create tests.

## 5. Claude Code CLI Integration (AIGEN-02)

### CLI Interface Research

Claude Code CLI (`claude`) supports:
- `claude --print "prompt"` — single-turn, prints response to stdout
- `claude --print --output-format json "prompt"` — returns JSON with `result` field
- `claude --print --output-format stream-json "prompt"` — streams JSON events

**Critical concern from STATE.md:** "Claude Code CLI interface stability not documented"

**Findings:**
- The `--print` flag is stable and documented in Claude Code help
- `--output-format json` wraps response in `{"type":"result","subtype":"success","result":"..."}` 
- The CLI respects system prompts via `--system-prompt`
- Max prompt length depends on user's model context window
- No official API stability guarantee — but `--print` is the primary non-interactive mode

### Prompt Design for Test Generation

Each route gets a self-contained prompt:

```
System: You are a Playwright test generator. Generate a single .spec.ts file.
Rules:
- Use ONLY the selectors provided in the analysis data
- Never invent selectors — if no good selector exists, skip the test
- Add JSDoc comments explaining your reasoning above each test()
- Use Playwright best practices (auto-waiting, web-first assertions)
- Generate tests for: navigation, form submission, button clicks, link verification

User: Generate Playwright tests for this route:

Route: {route.path}
File: {route.filePath}
Framework: {route.framework}

Interactive elements on this page:
{JSON.stringify(route.elements, null, 2)}

Component structure:
{JSON.stringify(route.components, null, 2)}
```

### Response Parsing

Parse Claude Code output to extract the TypeScript code block:
1. Run `claude --print --output-format json --system-prompt "..." "prompt"`
2. Parse JSON response, extract `result` field
3. Extract code between ` ```typescript ` and ` ``` ` markers
4. Write to `sniff-tests/{route-name}.spec.ts`
5. Validate: check for `import { test, expect }` and `test(` patterns

## 6. Anthropic API Provider (AIGEN-03, AIGEN-04)

### Provider Abstraction

```typescript
interface AIProvider {
  name: string;
  generateTests(context: RouteTestContext): Promise<GeneratedTest>;
}

interface RouteTestContext {
  route: RouteInfo;
  elements: ElementInfo[];
  components: ComponentInfo[];
  framework: FrameworkInfo;
}

interface GeneratedTest {
  specContent: string;    // The .spec.ts file content
  reasoning: string;      // AI's reasoning for the test scenarios
  route: string;          // Route path this covers
}
```

### Claude Code Provider

```typescript
class ClaudeCodeProvider implements AIProvider {
  name = 'claude-code';
  
  async generateTests(ctx: RouteTestContext): Promise<GeneratedTest> {
    // Shell exec: claude --print --output-format json --system-prompt "..." "prompt"
    // Parse response, extract code block
  }
}
```

### Anthropic API Provider

```typescript
class AnthropicAPIProvider implements AIProvider {
  name = 'anthropic-api';
  
  async generateTests(ctx: RouteTestContext): Promise<GeneratedTest> {
    // Use @anthropic-ai/sdk
    // Same prompt structure, different transport
    // Requires ANTHROPIC_API_KEY env var
  }
}
```

### Provider Selection

```typescript
function resolveProvider(): AIProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new AnthropicAPIProvider(process.env.ANTHROPIC_API_KEY);
  }
  return new ClaudeCodeProvider();
}
```

## 7. Config Schema Extension

The Zod config schema needs new sections:

```typescript
const analyzerConfigSchema = z.object({
  frameworks: z.array(z.enum(['nextjs', 'react', 'vue', 'svelte'])).optional(),
  routePatterns: z.array(z.string()).optional(), // additional route glob patterns
  elementSelectors: z.array(z.string()).default(['data-testid', 'id', 'name', 'aria-label', 'role']),
});

const aiConfigSchema = z.object({
  provider: z.enum(['claude-code', 'anthropic-api']).default('claude-code'),
  model: z.string().default('claude-sonnet-4-5-20250514'),
  outputDir: z.string().default('sniff-tests'),
  maxConcurrency: z.number().default(3),
});
```

## 8. File Organization

```
src/
  analyzers/
    index.ts              # Re-exports
    framework-detector.ts  # REPO-01: Detect frameworks
    route-discoverer.ts    # REPO-02: Discover routes  
    element-extractor.ts   # REPO-03, REPO-04: Parse elements from AST
    types.ts              # AnalysisResult, RouteInfo, ElementInfo, ComponentInfo
  ai/
    index.ts              # Re-exports
    types.ts              # AIProvider, RouteTestContext, GeneratedTest
    provider.ts           # resolveProvider()
    claude-code.ts        # ClaudeCodeProvider
    anthropic-api.ts      # AnthropicAPIProvider  
    prompt-builder.ts     # Build prompts from analysis data
    response-parser.ts    # Parse AI output, extract code blocks
  scanners/
    source/               # Existing (Phase 1)
    registry.ts           # Existing — register repo-analyzer here
```

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claude Code CLI changes `--print` output format | High | Pin to known format, add version detection, fail gracefully |
| AST parsing breaks on unusual JSX patterns | Medium | Catch parse errors per-file, report partial results |
| AI generates hallucinated selectors | High | Validate generated selectors against discovered elements |
| Large projects exceed Claude context window | Medium | Chunk by route (already planned), limit elements per prompt |
| `@anthropic-ai/sdk` version drift | Low | Pin version, use stable API surface |
| Dynamic routes can't be statically discovered | Medium | Flag as "partial discovery", document limitation |

## 10. Dependencies to Add

```json
{
  "dependencies": {
    "@babel/parser": "^7.x",
    "@babel/traverse": "^7.x",
    "@anthropic-ai/sdk": "^0.x"
  },
  "devDependencies": {
    "@types/babel__traverse": "^7.x"
  }
}
```

**Note:** `@anthropic-ai/sdk` should be a peer/optional dependency since it's only needed for API mode. Claude Code provider has zero additional deps (uses child_process).

## 11. Testing Strategy

- **Framework detection:** Unit tests with mock package.json and config files
- **Route discovery:** Unit tests with mock directory structures (use tmp dirs)
- **Element extraction:** Unit tests with sample JSX/TSX snippets → expected ElementInfo[]
- **AI provider:** Integration tests with mock CLI responses (don't call real Claude in CI)
- **End-to-end:** Test against a small fixture Next.js project in `test/fixtures/`

---

*Research completed: 2026-04-15*
