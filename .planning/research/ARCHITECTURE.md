# Architecture Research

**Domain:** AI-powered QA testing framework (CLI tool)
**Researched:** 2026-04-15
**Confidence:** HIGH

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLI Layer                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ sniff    │  │ sniff    │  │ sniff    │  │ sniff    │            │
│  │ init     │  │ scan     │  │ run      │  │ report   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
├───────┴──────────────┴──────────────┴──────────────┴────────────────┤
│                      Config Layer                                    │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │  ConfigLoader (cosmiconfig + defineConfig)                │       │
│  └──────────────────────────────────────────────────────────┘       │
├─────────────────────────────────────────────────────────────────────┤
│                      Core Pipeline                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Analyzer │→ │ AI Gen   │→ │ Runner   │→ │ Reporter │            │
│  │ Pipeline │  │ Engine   │  │ Engine   │  │ Engine   │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
├─────────────────────────────────────────────────────────────────────┤
│                      Scanner Registry (Plugin System)                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │  E2E   │ │ A11y   │ │ Visual │ │Console │ │Network │ │ Source ││
│  │Scanner │ │Scanner │ │  Reg   │ │Monitor │ │Monitor │ │Scanner ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘│
├─────────────────────────────────────────────────────────────────────┤
│                      Infrastructure                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Playwright   │  │  Worker Pool  │  │  MCP Server   │              │
│  │  (browsers)   │  │  (parallel)   │  │  (agents)     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| CLI Layer | Parse commands, validate args, orchestrate | Commander.js or yargs with subcommands |
| ConfigLoader | Find/load/validate `sniff.config.ts` or `.sniffrc` | cosmiconfig + Zod schema validation |
| Analyzer Pipeline | Parse source code, extract routes/components/forms | ts-morph for TS/JS, regex for framework-specific patterns |
| AI Generation Engine | Build prompts from analysis, generate test scenarios | Claude Code subprocess or Anthropic API, structured output |
| Runner Engine | Execute Playwright tests in parallel workers | Worker pool with Playwright Test runner internals |
| Reporter Engine | Aggregate results, output multiple formats | Plugin-based reporters (HTML, JSON, CI annotations) |
| Scanner Registry | Manage pluggable scanning dimensions | Interface-based registry pattern, each scanner self-contained |
| MCP Server | Expose sniff tools to AI agents | @modelcontextprotocol/sdk with Zod schemas |

## Recommended Project Structure

```
src/
├── cli/                    # CLI entry points and command definitions
│   ├── index.ts            # Main entry, command router
│   ├── commands/           # One file per command
│   │   ├── init.ts
│   │   ├── scan.ts
│   │   ├── run.ts
│   │   └── report.ts
│   └── utils.ts            # CLI-specific helpers (spinners, colors)
├── config/                 # Configuration loading and validation
│   ├── loader.ts           # cosmiconfig setup, file discovery
│   ├── schema.ts           # Zod schema for sniff.config.ts
│   └── defaults.ts         # Default configuration values
├── analyzer/               # Source code analysis pipeline
│   ├── index.ts            # Pipeline orchestrator
│   ├── parsers/            # Framework-specific parsers
│   │   ├── next.ts         # Next.js route/page extraction
│   │   ├── react-router.ts # React Router route extraction
│   │   ├── generic.ts      # Generic HTML/form/link extraction
│   │   └── types.ts        # Shared parser types
│   └── extractors/         # Cross-framework extractors
│       ├── routes.ts       # Route/page discovery
│       ├── components.ts   # Component tree extraction
│       └── forms.ts        # Form field extraction
├── ai/                     # AI test generation
│   ├── index.ts            # Generation orchestrator
│   ├── providers/          # AI provider adapters
│   │   ├── claude-code.ts  # Claude Code subprocess provider
│   │   └── anthropic-api.ts # Direct Anthropic API provider
│   ├── prompts/            # Prompt templates
│   │   ├── scenario.ts     # Test scenario generation prompts
│   │   ├── exploration.ts  # Chaos monkey prompts
│   │   └── context.ts      # Context builder (analysis → prompt)
│   └── types.ts            # AI module types
├── scanners/               # Pluggable scanning dimensions
│   ├── registry.ts         # Scanner registration and lifecycle
│   ├── types.ts            # Scanner interface definition
│   ├── e2e/                # E2E functional scanner
│   │   └── index.ts
│   ├── a11y/               # axe-core accessibility scanner
│   │   └── index.ts
│   ├── visual/             # Pixel diff visual regression
│   │   └── index.ts
│   ├── console/            # Console error monitor
│   │   └── index.ts
│   ├── network/            # Network failure monitor
│   │   └── index.ts
│   └── source/             # Source code text scanner
│       └── index.ts
├── runner/                 # Test execution engine
│   ├── index.ts            # Runner orchestrator
│   ├── worker.ts           # Worker thread entry point
│   ├── pool.ts             # Worker pool management
│   ├── playwright.ts       # Playwright config generation
│   └── types.ts            # Runner types
├── reporter/               # Report generation
│   ├── index.ts            # Reporter orchestrator
│   ├── types.ts            # Reporter interface
│   ├── html/               # HTML report generator
│   │   ├── index.ts
│   │   └── templates/      # HTML templates
│   ├── json/               # JSON report output
│   │   └── index.ts
│   └── ci/                 # CI-specific output (annotations, etc.)
│       └── index.ts
├── mcp/                    # MCP server for AI agent integration
│   ├── server.ts           # MCP server setup
│   ├── tools.ts            # Tool definitions (scan, run, report)
│   └── resources.ts        # Resource definitions (results, config)
├── core/                   # Shared types and utilities
│   ├── types.ts            # Core domain types (Finding, Severity, etc.)
│   ├── logger.ts           # Structured logging
│   ├── errors.ts           # Custom error types
│   └── events.ts           # EventEmitter-based internal bus
└── index.ts                # Public API exports
```

### Structure Rationale

- **cli/:** Thin layer. Commands parse args, load config, then delegate to core modules. Keeps CLI concerns (output formatting, progress bars) separate from logic.
- **scanners/:** Each scanner is a self-contained module implementing a common interface. The registry pattern means adding a new scanning dimension requires zero changes to core code.
- **ai/providers/:** Provider adapter pattern isolates AI integration. Claude Code (subprocess) and Anthropic API (HTTP) share the same interface, making the default-no-API-key experience seamless while allowing CI/batch mode.
- **analyzer/ vs scanners/:** Analyzer runs before tests (static analysis of source). Scanners run during/after tests (runtime checks). Different lifecycles, different modules.
- **reporter/:** Follows Playwright's pattern of multiple simultaneous reporters. Each reporter implements a common interface and receives the same result set.

## Architectural Patterns

### Pattern 1: Scanner Plugin Interface

**What:** Every scanning dimension (E2E, a11y, visual, console, network, source) implements a common `Scanner` interface. A registry manages discovery, initialization, and lifecycle.
**When to use:** Core pattern -- used for all scanning dimensions from day one.
**Trade-offs:** Slight indirection cost, but massive extensibility gain. Users and contributors can add scanners without touching core.

**Example:**
```typescript
// scanners/types.ts
export interface ScannerContext {
  page: Page;              // Playwright page
  config: SniffConfig;     // User config
  analysis: AnalysisResult; // Source analysis output
}

export interface ScannerResult {
  scanner: string;
  findings: Finding[];
  metadata: Record<string, unknown>;
}

export interface Scanner {
  name: string;
  /** Called once before any pages are scanned */
  setup?(ctx: ScannerContext): Promise<void>;
  /** Called for each page/route being tested */
  scan(ctx: ScannerContext): Promise<ScannerResult>;
  /** Called once after all pages are scanned */
  teardown?(): Promise<void>;
}

// scanners/registry.ts
export class ScannerRegistry {
  private scanners: Map<string, Scanner> = new Map();

  register(scanner: Scanner): void {
    this.scanners.set(scanner.name, scanner);
  }

  async runAll(ctx: ScannerContext): Promise<ScannerResult[]> {
    const results: ScannerResult[] = [];
    for (const scanner of this.scanners.values()) {
      await scanner.setup?.(ctx);
      results.push(await scanner.scan(ctx));
      await scanner.teardown?.();
    }
    return results;
  }
}
```

### Pattern 2: Reporter Interface (Playwright-style)

**What:** Multiple reporters run simultaneously, each receiving the same lifecycle events. Follows Playwright's proven `Reporter` interface with `onBegin`, `onTestEnd`, `onEnd` hooks.
**When to use:** All report generation. HTML, JSON, and CI reporters run in parallel.
**Trade-offs:** Event-based means reporters cannot influence execution flow (by design).

**Example:**
```typescript
// reporter/types.ts
export interface SniffReporter {
  onScanBegin?(config: SniffConfig, scanPlan: ScanPlan): void;
  onRouteBegin?(route: RouteInfo): void;
  onFinding?(finding: Finding): void;
  onRouteEnd?(route: RouteInfo, results: ScannerResult[]): void;
  onScanEnd?(summary: ScanSummary): Promise<void>;
}

// Usage: multiple reporters receive same events
class ReporterEngine {
  private reporters: SniffReporter[] = [];

  use(reporter: SniffReporter): void {
    this.reporters.push(reporter);
  }

  async emitScanEnd(summary: ScanSummary): Promise<void> {
    await Promise.all(
      this.reporters.map(r => r.onScanEnd?.(summary))
    );
  }
}
```

### Pattern 3: AI Provider Adapter

**What:** Abstract AI interaction behind a provider interface. Default provider spawns Claude Code as a subprocess (no API key). Alternative provider calls Anthropic API directly for CI/batch use.
**When to use:** All AI-driven test generation and exploration.
**Trade-offs:** Claude Code subprocess is slower but zero-config. API mode is faster but requires a key. The adapter hides this completely from the generation engine.

**Example:**
```typescript
// ai/types.ts
export interface AIProvider {
  generate(prompt: string, options?: GenerateOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;
}

// ai/providers/claude-code.ts
export class ClaudeCodeProvider implements AIProvider {
  async generate(prompt: string): Promise<string> {
    // Spawn: claude --print --output-format json "prompt"
    const result = await execa('claude', [
      '--print', '--output-format', 'json', prompt
    ]);
    return JSON.parse(result.stdout).result;
  }
}

// ai/providers/anthropic-api.ts
export class AnthropicAPIProvider implements AIProvider {
  constructor(private apiKey: string) {}
  async generate(prompt: string): Promise<string> {
    // Direct API call to messages endpoint
  }
}
```

### Pattern 4: Analysis Pipeline (Parse-Extract-Enrich)

**What:** Three-stage pipeline for source code analysis. Parse (read files, build AST), Extract (pull routes/components/forms), Enrich (add metadata like complexity, interactivity hints).
**When to use:** `sniff scan` command, before AI generation.
**Trade-offs:** ts-morph adds ~15MB to install size but provides type-aware analysis that regex cannot match. Worth it for TypeScript projects; fall back to regex/glob for non-TS.

**Example:**
```typescript
// analyzer/index.ts
export async function analyzeProject(rootDir: string): Promise<AnalysisResult> {
  // Stage 1: Parse -- detect framework, find entry points
  const framework = await detectFramework(rootDir);
  const parser = getParser(framework); // next, react-router, generic

  // Stage 2: Extract -- pull structured data
  const routes = await parser.extractRoutes(rootDir);
  const components = await parser.extractComponents(rootDir);
  const forms = await parser.extractForms(rootDir);

  // Stage 3: Enrich -- add test-relevant metadata
  const enriched = await enrich({ routes, components, forms });

  return enriched;
}
```

### Pattern 5: Config with defineConfig (Vite/Vitest pattern)

**What:** Use cosmiconfig for file discovery with a `defineConfig` helper for TypeScript type safety. Supports `sniff.config.ts`, `.sniffrc.json`, `.sniffrc.yaml`, and `package.json#sniff`.
**When to use:** All configuration loading.
**Trade-offs:** cosmiconfig handles the complex file-discovery logic. Adding the TypeScript loader adds a dependency but the DX improvement (autocomplete, validation) is significant.

**Example:**
```typescript
// config/schema.ts
import { z } from 'zod';

export const sniffConfigSchema = z.object({
  baseUrl: z.string().url(),
  scanners: z.array(z.string()).default(['e2e', 'a11y', 'visual', 'console', 'network', 'source']),
  viewports: z.array(z.object({
    name: z.string(),
    width: z.number(),
    height: z.number(),
  })).default([
    { name: 'mobile', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ]),
  ai: z.object({
    provider: z.enum(['claude-code', 'anthropic-api']).default('claude-code'),
    apiKey: z.string().optional(),
  }).default({}),
  reporters: z.array(z.string()).default(['html', 'json']),
  parallel: z.number().default(4),
  timeout: z.number().default(30000),
});

// Public helper for type-safe config files
export function defineConfig(config: SniffUserConfig): SniffUserConfig {
  return config;
}
```

## Data Flow

### Primary Scan Flow

```
sniff scan <target>
    |
    v
ConfigLoader ─── load sniff.config.ts / .sniffrc / defaults
    |
    v
Analyzer Pipeline
    |── detectFramework() ── Next.js? React Router? Plain HTML?
    |── extractRoutes()   ── /home, /dashboard, /settings, ...
    |── extractForms()    ── login form, signup form, search, ...
    |── extractComponents() ── interactive elements, modals, ...
    |
    v
AI Generation Engine
    |── buildContext()    ── analysis result → structured prompt context
    |── generateScenarios() ── prompt AI → test scenario list
    |── validateScenarios() ── Zod parse AI output, retry on failure
    |
    v
Runner Engine
    |── generatePlaywrightConfig() ── projects (browsers x viewports)
    |── spawnWorkers()    ── worker pool (N workers from config)
    |── per worker:
    |   |── for each route/scenario:
    |   |   |── navigate page
    |   |   |── run registered scanners (e2e, a11y, visual, console, network)
    |   |   |── collect ScannerResult[]
    |   |── return aggregated results to main thread
    |── aggregateResults() ── merge all worker results
    |
    v
Reporter Engine
    |── emit onScanBegin to all reporters
    |── emit onFinding for each finding
    |── emit onScanEnd with summary
    |── reporters write output (HTML file, JSON file, CI annotations)
    |
    v
Exit with code (0 = clean, 1 = findings above threshold)
```

### Source Scanner Flow (No Browser Needed)

```
sniff scan --source-only
    |
    v
ConfigLoader
    |
    v
Source Scanner (runs independently, no Playwright)
    |── glob for source files (*.ts, *.tsx, *.js, *.jsx, *.html)
    |── scan for: lorem ipsum, TODO/FIXME, hardcoded strings,
    |   placeholder text, console.log, debugger statements
    |── return Finding[] with file locations
    |
    v
Reporter Engine (same as above)
```

### MCP Server Flow

```
AI Agent (Cursor/Windsurf/Claude Code)
    |
    v (stdio transport)
MCP Server
    |── Tool: sniff_scan
    |   |── accepts: { target: string, scanners?: string[] }
    |   |── runs: scan pipeline
    |   |── returns: structured findings
    |── Tool: sniff_run
    |   |── accepts: { scenarioFile: string }
    |   |── runs: specific test scenarios
    |   |── returns: pass/fail results
    |── Resource: sniff://config
    |   |── returns: current configuration
    |── Resource: sniff://results/latest
    |   |── returns: most recent scan results
```

### Key Data Flows

1. **Analysis to AI:** The analyzer produces a structured `AnalysisResult` (routes, components, forms) that the AI context builder transforms into prompt context. This is the critical bridge -- the quality of analysis directly determines the quality of generated tests.
2. **Scanner results to Reporter:** Each scanner produces `ScannerResult` with uniform `Finding[]` arrays. The reporter engine receives these as events, so reporters never need to know which scanner produced a finding.
3. **Config propagation:** Config loads once at startup and flows through every component via dependency injection (passed as constructor arg or context object), never imported as a global.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Small app (5-10 routes) | Single worker, sequential scanners, completes in seconds |
| Medium app (50 routes) | 4 workers (default), parallel by route, ~5 min target |
| Large app (200+ routes) | Configurable worker count, route sharding, incremental scanning (only changed routes) |

### Scaling Priorities

1. **First bottleneck -- AI generation:** AI calls are slow (2-5s each). Batch scenarios per route, cache generated scenarios to disk, skip regeneration for unchanged routes.
2. **Second bottleneck -- browser instances:** Each Playwright worker holds a browser. Memory scales linearly. Cap workers based on available RAM (~300MB per Chromium instance).
3. **Third bottleneck -- visual regression baselines:** Pixel diff comparisons are CPU-bound. Use worker threads for image comparison, keep I/O async.

## Anti-Patterns

### Anti-Pattern 1: God Scanner

**What people do:** Put all scanning logic (a11y, visual, console, network) into a single monolithic test file.
**Why it's wrong:** Impossible to run individual dimensions, debug failures in one dimension, or let users disable specific scanners. Also makes the codebase impenetrable for contributors.
**Do this instead:** One scanner per dimension, each implementing the `Scanner` interface. Users enable/disable via config.

### Anti-Pattern 2: Hardcoded AI Prompts

**What people do:** Inline prompt strings directly in the generation logic, mixing template construction with business logic.
**Why it's wrong:** Prompts need iteration independent of code logic. Hardcoded prompts cannot be versioned, A/B tested, or overridden by users.
**Do this instead:** Prompt templates in dedicated files (`ai/prompts/`). Context builder assembles final prompts from analysis results + templates. Users can override prompt templates via config.

### Anti-Pattern 3: Synchronous Scanner Execution

**What people do:** Run all scanners sequentially on each page -- navigate, run a11y, navigate again, run visual, navigate again...
**Why it's wrong:** Wastes time. Most scanners can run on the same page load. Navigation is expensive (network round-trip + rendering).
**Do this instead:** Navigate once, run all applicable scanners on the loaded page concurrently. Console and network monitors attach as listeners before navigation. A11y and visual run after page settles.

### Anti-Pattern 4: Global Mutable State for Results

**What people do:** Store scan results in a global array that workers push to.
**Why it's wrong:** Worker threads cannot share memory. Race conditions in aggregation. Impossible to attribute findings to specific routes/workers.
**Do this instead:** Each worker returns its `ScannerResult[]` via message passing. Main thread aggregates after all workers complete using structured merge.

### Anti-Pattern 5: Tight Coupling Between Analyzer and Framework

**What people do:** Write analysis code that only works with Next.js file-based routing, then bolt on other frameworks later.
**Why it's wrong:** Creates an inconsistent, brittle codebase. Each framework addition requires touching core analysis logic.
**Do this instead:** Framework-specific parsers behind a `Parser` interface. Generic fallback parser that works with any web app (glob for HTML, scan for `<a>` tags, detect forms). Framework parsers are optional enhancers.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Code CLI | Subprocess via `execa` | Default AI provider. Requires Claude Code installed. Use `--print --output-format json` for programmatic access. |
| Anthropic API | HTTP via `@anthropic-ai/sdk` | Optional provider for CI/batch. Requires `ANTHROPIC_API_KEY`. |
| Playwright | Library API (not CLI) | Use `@playwright/test` as a library for browser management, not as a test runner. Sniff IS the runner. |
| axe-core | In-page injection via `@axe-core/playwright` | Inject into Playwright page, run checks, extract violations. |
| pixelmatch | Direct library call | Compare screenshots pixel-by-pixel. Pure JS, no external deps. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| CLI <-> Core Pipeline | Direct function calls | CLI is a thin wrapper. No IPC needed. |
| Main Thread <-> Workers | `worker_threads` message passing | Serialize `ScannerResult` as plain objects. No shared memory. |
| Runner <-> Scanners | Scanner interface method calls | Runner calls `scanner.scan(ctx)` with Playwright page in context. |
| Core <-> MCP Server | Shared module imports | MCP server imports core pipeline functions directly. Same process. |
| AI Engine <-> AI Provider | Provider interface | Engine calls `provider.generate()`. Provider handles transport (subprocess or HTTP). |

## Build Order (Dependency Chain)

The components have clear dependency ordering that dictates build phases:

```
Phase 1 (Foundation):
  core/types.ts          -- domain types used everywhere
  config/                -- everything depends on config
  cli/ (skeleton)        -- bare command structure

Phase 2 (Analysis):
  analyzer/              -- depends on: config, core types
  scanners/types.ts      -- scanner interface definition
  scanners/source/       -- source scanner (no browser needed, good first scanner)

Phase 3 (AI Generation):
  ai/providers/          -- depends on: config
  ai/prompts/            -- depends on: analyzer output types
  ai/index.ts            -- depends on: providers, prompts, analyzer types

Phase 4 (Execution):
  runner/                -- depends on: config, scanners, Playwright
  scanners/e2e/          -- depends on: runner context, Playwright
  scanners/console/      -- depends on: runner context, Playwright
  scanners/network/      -- depends on: runner context, Playwright

Phase 5 (Advanced Scanners):
  scanners/a11y/         -- depends on: runner context, axe-core
  scanners/visual/       -- depends on: runner context, pixelmatch

Phase 6 (Reporting):
  reporter/              -- depends on: core types (findings)
  reporter/html/         -- depends on: reporter interface
  reporter/json/         -- depends on: reporter interface

Phase 7 (Integration):
  mcp/                   -- depends on: entire core pipeline
  CI mode                -- depends on: reporter, config
```

**Why this order:**
- Config and types must exist before anything else can be built.
- Analyzer is independent of runtime (static analysis) so it can be built and tested early.
- Source scanner needs no browser -- fastest path to a working end-to-end demo.
- AI generation depends on analyzer output, so analyzer must come first.
- Browser-based scanners depend on the runner engine.
- Reporters are consumers of results -- they can be built whenever results exist.
- MCP server wraps the entire pipeline, so it comes last.

## Sources

- [Playwright CLI docs](https://playwright.dev/docs/test-cli) -- command structure, reporter config
- [Playwright Reporter API](https://playwright.dev/docs/api/class-reporter) -- onTestBegin, onTestEnd, onStepEnd interface
- [Playwright Parallelism](https://playwright.dev/docs/test-parallel) -- worker-based parallel execution model
- [Vitest Reporter docs](https://github.com/vitest-dev/vitest/blob/main/docs/guide/advanced/reporters.md) -- custom reporter implementation
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- server.registerTool, Zod schemas, transport
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) -- protocol spec
- [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig) -- config file discovery pattern
- [ts-morph](https://github.com/dsherret/ts-morph) -- TypeScript AST analysis wrapper
- [pixelmatch](https://github.com/mapbox/pixelmatch) -- pixel-level image comparison

---
*Architecture research for: Sniff -- AI-powered QA testing framework*
*Researched: 2026-04-15*
