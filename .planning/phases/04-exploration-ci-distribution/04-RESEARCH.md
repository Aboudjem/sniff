# Phase 4: Exploration + CI + Distribution - Research

**Researched:** 2026-04-15
**Domain:** Autonomous browser exploration, CI workflow generation, MCP server, npm/plugin distribution
**Confidence:** HIGH (core architecture), MEDIUM (Claude Code plugin format — verified against live docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Intelligent crawling via existing route-discoverer + element-extractor (not random clicking)
- **D-02:** Built-in edge-case form fill: empty strings, XSS payloads, SQL injection strings, Unicode edge cases, max-length strings, negative numbers, special characters
- **D-03:** Structured JSON action log per exploration step (element targeted, action taken, AI reasoning, observation)
- **D-04:** Exploration reuses BrowserRunner + PageHookPipeline (console errors, network failures, screenshots)
- **D-05:** Flakiness history in `.sniff/history.json`; flake rate computed per test across last N runs
- **D-06:** Quarantine threshold: 3+ failures in last 5 runs; flaky tests run but don't block CI exit code; configurable
- **D-07:** Flakiness opt-in for `sniff run`, default-on for `sniff ci` mode
- **D-08:** Single opinionated GitHub Actions workflow from `sniff ci` command
- **D-09:** Cache: GitHub Actions cache for Playwright browsers + node_modules
- **D-10:** CI mode auto-enables headless, JUnit XML, non-zero exit on failure
- **D-11:** Three MCP tools: `sniff_scan`, `sniff_run`, `sniff_report`
- **D-12:** stdio transport
- **D-13:** Separate entry point `src/mcp/server.ts`, shares all core logic
- **D-14:** npm publish as primary distribution; needs `publishConfig`, `keywords`, `repository`, `license`
- **D-15:** Claude Code plugin uses plugin manifest format; installation via `claude plugin install`
- **D-16:** `npx sniff` must work for zero-install; handle Playwright browser install on first run

### Claude's Discretion

- Exploration step ordering (breadth-first vs depth-first)
- GitHub Actions runner OS and Node version matrix defaults
- MCP tool parameter naming and description text
- npm package keywords and README structure
- Whether to use `@modelcontextprotocol/sdk` or implement stdio protocol directly

### Deferred Ideas (OUT OF SCOPE)

None declared.
</user_constraints>

---

## Summary

Phase 4 completes the sniff product by adding three capabilities: an AI-driven chaos monkey exploration mode that reuses the existing BrowserRunner and element-extractor infrastructure, a CI integration layer with GitHub Actions workflow generation and flakiness detection backed by `.sniff/history.json`, and distribution packaging as an npm package, MCP server, and Claude Code plugin.

The largest implementation risk is the npm package name conflict: the name `sniff` is already claimed on npm (v0.2.0, "JS Type and Prototype Sniffing", last published 2022). The package must ship under a different name — `@sniff/cli`, `sniff-qa`, or a scoped variant — or the team must contact the current owner. All other research findings are clean and actionable.

The MCP SDK approach is strongly recommended over hand-rolling stdio: `@modelcontextprotocol/sdk` v1.29.0 provides `McpServer` + `StdioServerTransport` with Zod-validated tool registration, matching the project's existing Zod patterns exactly. The Claude Code plugin format is a directory-based system with an optional `.claude-plugin/plugin.json` manifest — the plugin wraps the sniff CLI via an MCP server config rather than "commands that invoke the CLI".

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Chaos monkey exploration | Browser / Playwright process | AI (decision layer) | All page interaction happens in browser; AI selects next action |
| Route + element discovery | Analyzer (source static analysis) | — | Existing route-discoverer + element-extractor run against source files |
| Exploration action logging | Core persistence | — | JSON action log written to `.sniff/` alongside existing results |
| Flakiness detection | Core persistence | CLI (run orchestration) | History read/write in persistence layer; CLI controls when to update |
| CI workflow generation | CLI command (`sniff ci`) | — | Pure string template written to `.github/workflows/sniff.yml` |
| MCP server | Separate entry point (`src/mcp/server.ts`) | Core (shared pipeline) | Interface layer only; all logic delegates to existing scan/run/report |
| npm distribution | Build / publish artifacts | — | `tsup` already configured; needs package.json metadata fixes |
| Claude Code plugin | Plugin directory structure | MCP server | Plugin exposes sniff MCP server; Claude Code auto-discovers tools |

---

## 1. Chaos Monkey Architecture

### How ExplorationRunner relates to BrowserRunner

`BrowserRunner` (src/browser/runner.ts) owns the Playwright browser lifecycle and iterates over a fixed URL list per viewport. For exploration, the URL list is dynamic — the runner must decide the next URL/element after each step based on AI input and observed state. The correct pattern is a new `ExplorationRunner` class that:

1. **Owns the browser lifecycle** the same way `BrowserRunner` does (launch, create context, register hooks)
2. **Delegates to existing hooks** via `PageHookPipeline` for passive monitoring (console errors, network failures, screenshots)
3. **Adds an action loop** between page navigations — after loading each URL, calls the AI provider to select the next action from available elements

`ExplorationRunner` should NOT extend `BrowserRunner` (the base class has no extension points). It should be a standalone class that imports `PageHookPipeline` directly, mirroring the same pattern.

```typescript
// [VERIFIED: src/browser/runner.ts + src/browser/page-hooks.ts patterns]
export class ExplorationRunner {
  constructor(
    private config: SniffConfig,
    private aiProvider: AIProvider,
  ) {}

  async explore(ctx: ExplorationContext): Promise<ExplorationResult> {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: ctx.headless });
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const page = await context.newPage();
      const pipeline = new PageHookPipeline();
      pipeline.register(new ConsoleErrorHook());
      pipeline.register(new NetworkFailureHook());
      pipeline.register(new ScreenshotHook());
      pipeline.setupAll(page, 'desktop');

      const log: ExplorationActionLog[] = [];
      // Main exploration loop — step count bounded by ctx.maxSteps
      for (let step = 0; step < ctx.maxSteps; step++) {
        const decision = await this.aiProvider.decideNextAction(page, log);
        // ... execute decision, record to log
      }
      return { log, findings: pipeline.collectAll() };
    } finally {
      await browser.close();
    }
  }
}
```

### AIProvider extension for exploration

The existing `AIProvider` interface (src/ai/types.ts) only defines `generateTests(context)`. Exploration requires a second method: deciding the next action given current page state and history. Options:

1. **Extend the interface** — add `decideNextAction(page, log): Promise<ExplorationDecision>` to `AIProvider`
2. **Separate interface** — define `ExplorationProvider` that `ClaudeCodeProvider` implements alongside `AIProvider`

Option 2 is lower risk (no breaking change to existing interface contract). `ClaudeCodeProvider` can implement both.

```typescript
// New interface in src/ai/types.ts
export interface ExplorationProvider {
  decideNextAction(
    pageState: PageState,
    history: ExplorationActionLog[],
  ): Promise<ExplorationDecision>;
}

export interface ExplorationDecision {
  action: 'click' | 'fill' | 'navigate' | 'done';
  selector?: string;
  value?: string;  // for fill actions
  url?: string;    // for navigate actions
  reasoning: string;
}
```

### Route + element discovery wiring

Existing tools slot in directly:

```typescript
// [VERIFIED: src/analyzers/route-discoverer.ts, element-extractor.ts]
import { discoverRoutes } from '../analyzers/route-discoverer.js';
import { extractElements } from '../analyzers/element-extractor.js';
import { detectFrameworks } from '../analyzers/framework-detector.js';

// In ExplorationRunner.explore():
const frameworks = await detectFrameworks(rootDir);
const routes = await discoverRoutes(rootDir, frameworks);
// routes gives the starting URL list
// extractElements gives the interactive element map per source file
```

The exploration loop uses `routes` as the initial URL queue, then uses Playwright's live DOM (not static analysis) for element selection during execution — since the page may render elements that aren't in the static source (dynamic content, lazy-loaded components).

### Structured JSON action log (D-03)

```typescript
// src/exploration/types.ts
export interface ExplorationActionLog {
  step: number;
  timestamp: string;
  url: string;
  action: 'click' | 'fill' | 'navigate' | 'done';
  target: {
    selector: string;
    text?: string;
    type?: string;  // input type for fill
  };
  value?: string;   // filled value
  reasoning: string;
  observation: {
    urlAfter: string;
    consoleErrors: number;
    networkFailures: number;
    screenshotPath?: string;
  };
}
```

Log file written to `.sniff/exploration-<timestamp>.json` after each run. This mirrors the existing `saveResults` pattern in `persistence.ts`.

### Edge-case data sets (D-02)

Hardcoded payloads, no external dependency:

```typescript
// src/exploration/edge-cases.ts
export const EDGE_CASE_PAYLOADS = {
  xss: [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    "javascript:alert(1)",
    '<svg/onload=alert(1)>',
  ],
  sqli: [
    "' OR '1'='1",
    "1; DROP TABLE users--",
    "' UNION SELECT NULL--",
    '" OR 1=1--',
  ],
  unicode: [
    '\u0000',           // null byte
    '\uFFFD',           // replacement character
    '日本語テスト',      // CJK characters
    'مرحبا بالعالم',   // Arabic RTL
    '\u202E',           // right-to-left override
    '🎉🔥💀',          // emoji
  ],
  boundary: [
    '',                 // empty string
    ' ',                // whitespace only
    'a'.repeat(10000),  // max-length (10k chars)
    '-1',               // negative number
    '0',
    '999999999999999',  // very large number
    '1.7976931348623157e+308', // float overflow
  ],
  specialChars: [
    '../../../etc/passwd',  // path traversal
    '%00',                  // URL encoded null
    '\\n\\r',               // CRLF injection
    '${7*7}',               // template injection probe
  ],
} as const;
```

### Step ordering (Claude's discretion)

**Recommendation: breadth-first with priority scoring.**

Rationale: depth-first risks getting stuck in a single form flow. Breadth-first with priority scoring (prefer forms > buttons > links > navigation) gives better coverage of bug surface area in bounded step counts. Priority:

1. Forms with `<input type="text/email/password">` — highest value for edge-case payloads
2. Buttons with `type="submit"` — form submission paths
3. `<a>` links not yet visited — route expansion
4. All other interactive elements

---

## 2. Flakiness Detection

### `.sniff/history.json` schema

Extends the existing `.sniff/` directory pattern from `persistence.ts`. The file stores per-test pass/fail history across the last N runs (default N=5).

```typescript
// src/core/types.ts (additions)
export interface TestRunRecord {
  runId: string;           // UUID or timestamp-based ID
  timestamp: string;       // ISO 8601
  testId: string;          // stable identifier: "${scanner}::${ruleId}::${url}"
  passed: boolean;
  duration: number;
  viewport?: string;
}

export interface FlakinessHistory {
  version: 1;
  runs: TestRunRecord[];   // append-only; trimmed to maxHistory per testId
  flaky: string[];         // testIds currently above quarantine threshold
}
```

**Key design choice:** `testId` must be deterministic across runs. Use `"${scanner}::${ruleId}::${url}"` — this is stable as long as the URL and scanner are the same. Do NOT use finding message text (too variable).

### Flake rate algorithm

```typescript
// src/core/flakiness.ts
export function computeFlakeStatus(
  history: FlakinessHistory,
  testId: string,
  windowSize: number = 5,
  threshold: number = 3,
): { isFlaky: boolean; failureCount: number; runCount: number } {
  // Get last windowSize records for this testId
  const records = history.runs
    .filter(r => r.testId === testId)
    .slice(-windowSize);

  const failureCount = records.filter(r => !r.passed).length;
  const isFlaky = records.length >= windowSize && failureCount >= threshold;
  return { isFlaky, failureCount, runCount: records.length };
}
```

**Edge cases to handle:**
- Fewer than `windowSize` runs: not enough data, mark as `unknown` (not flaky)
- New test with 0 history: always `unknown`
- Test that only appears in some runs (intermittent execution): treat missing runs as "not run", not "passed"

### Extending persistence.ts

Add two functions alongside existing `saveResults` / `loadLastResults`:

```typescript
// src/core/persistence.ts additions
const HISTORY_FILE = 'history.json';
const MAX_HISTORY_PER_TEST = 10; // keep 10 runs per test ID

export async function appendRunHistory(
  rootDir: string,
  records: TestRunRecord[],
): Promise<void> {
  const dir = join(rootDir, SNIFF_DIR);
  await mkdir(dir, { recursive: true });
  const historyPath = join(dir, HISTORY_FILE);

  let history: FlakinessHistory = { version: 1, runs: [], flaky: [] };
  try {
    const data = await readFile(historyPath, 'utf-8');
    history = JSON.parse(data) as FlakinessHistory;
  } catch { /* first run */ }

  // Append new records
  history.runs.push(...records);

  // Trim: keep only MAX_HISTORY_PER_TEST per testId
  const byTestId = new Map<string, TestRunRecord[]>();
  for (const r of history.runs) {
    const arr = byTestId.get(r.testId) ?? [];
    arr.push(r);
    byTestId.set(r.testId, arr);
  }
  history.runs = [];
  for (const [, arr] of byTestId) {
    history.runs.push(...arr.slice(-MAX_HISTORY_PER_TEST));
  }

  // Recompute flaky list
  history.flaky = [...byTestId.keys()].filter(id => {
    const { isFlaky } = computeFlakeStatus(history, id);
    return isFlaky;
  });

  await writeFile(historyPath, JSON.stringify(history, null, 2));
}

export async function loadFlakinessHistory(
  rootDir: string,
): Promise<FlakinessHistory | null> {
  try {
    const data = await readFile(join(rootDir, SNIFF_DIR, HISTORY_FILE), 'utf-8');
    return JSON.parse(data) as FlakinessHistory;
  } catch {
    return null;
  }
}
```

### Integration point (D-07)

After each `sniff run` execution, the CLI checks `--track-flakes` flag or `CI` env var:

```typescript
// In run command handler
const trackFlakes = options.trackFlakes || !!process.env.CI;
if (trackFlakes) {
  const records = buildTestRunRecords(runResult); // convert ScanResult[] -> TestRunRecord[]
  await appendRunHistory(rootDir, records);
}

// In CI mode exit code logic
const history = await loadFlakinessHistory(rootDir);
const flakyTestIds = new Set(history?.flaky ?? []);
const blockingFindings = findings.filter(f =>
  config.failOn.includes(f.severity) &&
  !flakyTestIds.has(buildTestId(f))  // quarantined flaky tests don't block
);
process.exit(blockingFindings.length > 0 ? 1 : 0);
```

---

## 3. CI Workflow Generation

### Canonical GitHub Actions workflow template

```typescript
// src/ci/workflow-template.ts
export function generateGitHubActionsWorkflow(options: CIWorkflowOptions): string {
  return `name: Sniff QA

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  sniff:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        id: playwright-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-\${{ runner.os }}-\${{ hashFiles('package-lock.json') }}
          restore-keys: |
            playwright-\${{ runner.os }}-

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium

      - name: Install Playwright deps (cached)
        if: steps.playwright-cache.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium

      - name: Run Sniff
        run: npx ${options.packageName ?? 'sniff-qa'} run --ci
        env:
          CI: true

      - name: Upload Sniff report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sniff-report
          path: sniff-reports/
          retention-days: 30
`;
}
```

**Key design decisions:**
- `ubuntu-latest` as default runner — cheapest, Playwright-compatible [VERIFIED: playwright.dev docs]
- `actions/cache@v4` (not v3) — v4 is current as of 2024 [VERIFIED: GitHub Actions marketplace]
- Playwright cache path `~/.cache/ms-playwright` — correct for Linux runners [VERIFIED: multiple community sources]
- `install --with-deps chromium` only on cache miss; `install-deps` on cache hit restores OS-level deps without re-downloading browser binary
- `if: always()` on artifact upload — reports are valuable even when sniff fails
- `timeout-minutes: 15` — guards against hung Playwright sessions
- `--ci` flag triggers D-10 behavior (headless, JUnit, non-zero exit)

### `sniff ci` command behavior

```
sniff ci [--output .github/workflows/sniff.yml] [--force]
```

1. Check if `.github/workflows/sniff.yml` already exists; prompt before overwrite unless `--force`
2. Write workflow template string to file
3. Print confirmation with path and a note about the package name

### Exit code handling (D-10)

CI mode is activated by `--ci` flag or `CI=true` environment variable (set automatically by GitHub Actions, CircleCI, Jenkins, and most CI platforms). In CI mode:
- Always headless
- Always emits JUnit XML (`sniff-reports/results.junit.xml`)
- Process exits non-zero if any finding at `failOn` severity level is found AND the test is not in the flaky quarantine list

---

## 4. MCP Server

### Use `@modelcontextprotocol/sdk` (Claude's discretion recommendation)

**Recommendation: use the SDK.** The `@modelcontextprotocol/sdk` v1.29.0 package:
- Provides `McpServer` and `StdioServerTransport` out of the box [VERIFIED: Context7 /modelcontextprotocol/typescript-sdk]
- Uses Zod for tool input schema validation — matches the project's existing Zod patterns exactly
- `registerTool(name, { description, inputSchema }, handler)` is a clean, typed API
- Maintained by Anthropic; handles protocol version negotiation, error framing, and stream management

Hand-rolling stdio would require implementing JSON-RPC 2.0 framing, MCP protocol versioning, and error handling that the SDK already provides. Not worth it for a v1.

**Installation:**
```bash
npm install @modelcontextprotocol/sdk
```

Note: `@modelcontextprotocol/sdk` has a peer dependency on `zod: "^3.25 || ^4.0"`. The project currently uses `zod@^4.3.6` — compatible. [VERIFIED: npm registry]

### Server entry point

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'sniff',
  version: '0.1.0',
});

// Tool: sniff_scan — static source analysis
server.registerTool(
  'sniff_scan',
  {
    description: 'Run static source analysis on a project and return findings',
    inputSchema: z.object({
      rootDir: z.string().describe('Absolute path to project root'),
      config: z.record(z.unknown()).optional().describe('Optional sniff config overrides'),
    }),
  },
  async ({ rootDir, config }) => {
    // Delegates to existing scan pipeline
    const result = await runScan(rootDir, config);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: sniff_run — browser E2E run
server.registerTool(
  'sniff_run',
  {
    description: 'Run browser E2E tests against a live URL and return findings',
    inputSchema: z.object({
      baseUrl: z.string().url().describe('Base URL of the running application'),
      rootDir: z.string().describe('Absolute path to project root'),
      headless: z.boolean().default(true),
    }),
  },
  async ({ baseUrl, rootDir, headless }) => {
    const result = await runBrowserTests(baseUrl, rootDir, { headless });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  },
);

// Tool: sniff_report — load and format last results
server.registerTool(
  'sniff_report',
  {
    description: 'Load the most recent sniff results and return a formatted report',
    inputSchema: z.object({
      rootDir: z.string().describe('Absolute path to project root'),
      format: z.enum(['json', 'summary']).default('summary'),
    }),
  },
  async ({ rootDir, format }) => {
    const results = await loadLastResults(rootDir);
    const output = format === 'summary' ? formatSummary(results) : JSON.stringify(results, null, 2);
    return {
      content: [{ type: 'text', text: output }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

[VERIFIED: Context7 /modelcontextprotocol/typescript-sdk — StdioServerTransport, McpServer, registerTool patterns]

### Package.json bin entry

```json
{
  "bin": {
    "sniff": "./dist/cli/index.js",
    "sniff-mcp": "./dist/mcp/server.js"
  }
}
```

The MCP server binary `sniff-mcp` is the entry point that Claude Desktop / Claude Code uses in its MCP server config:

```json
{
  "mcpServers": {
    "sniff": {
      "command": "npx",
      "args": ["sniff-qa", "--mcp"]
    }
  }
}
```

Alternatively, use a single CLI binary with a `--mcp` flag that switches to MCP mode — simpler distribution.

### tsup build configuration

The MCP server entry point needs to be added to tsup config:
```typescript
// tsup.config.ts (or tsup field in package.json)
entry: ['src/cli/index.ts', 'src/mcp/server.ts']
```

---

## 5. Distribution (npm + Claude Code Plugin)

### CRITICAL: Package name conflict

**The npm package name `sniff` is already taken.**

- Current owner: Damon Oehlman
- Current package: `sniff@0.2.0` — "JS Type and Prototype Sniffing"
- Last published: 2022-06-26
- This will block `npm publish` [VERIFIED: npm registry]

**Options (in priority order):**
1. **`sniff-qa`** — descriptive, available (not verified, check before publishing), aligns with "QA testing"
2. **`@sniff/cli`** — scoped package under an org; requires npm org creation
3. Contact the current `sniff` owner to transfer — unlikely/slow
4. **`sniffjs`** — less ideal branding

The `npx sniff` zero-install experience (D-16) is NOT possible unless the package is literally named `sniff`. With a renamed package, the command becomes `npx sniff-qa` or the user installs globally and aliases.

**Resolution required before `sniff ci` workflow generation** — the template must embed the correct package name.

### npm publish prerequisites

The current `package.json` is missing required publish fields. Required additions:

```json
{
  "name": "sniff-qa",
  "version": "0.1.0",
  "description": "AI-powered autonomous QA testing — scan, explore, and report bugs before users do",
  "keywords": [
    "testing", "qa", "playwright", "accessibility", "e2e",
    "ai", "claude", "visual-regression", "ci", "automation"
  ],
  "author": "Adam Boudj <adam@integralayer.com>",
  "license": "MIT",
  "homepage": "https://github.com/adamboudj/sniff#readme",
  "repository": {
    "type": "git",
    "url": "https://github.com/adamboudj/sniff.git"
  },
  "bugs": {
    "url": "https://github.com/adamboudj/sniff/issues"
  },
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist"]
}
```

**`files: ["dist"]` is correct** — the project already uses `tsup` for compilation and the `dist` directory contains compiled output. `node_modules`, `src`, `*.test.*` files are excluded by default.

**`.npmignore` vs `files`:** The `files` field in package.json is the modern, preferred approach. No `.npmignore` needed unless you have complex exclusion rules. [ASSUMED — standard npm guidance]

### First-run Playwright browser installation (D-16)

`npx sniff-qa` users won't have Playwright browsers. Options:

1. **Auto-install on first run** — detect missing browsers, run `npx playwright install chromium` automatically
2. **Prompt on first run** — ask user before installing (~150MB download)
3. **Document in README** — require manual `npx playwright install` before first use

**Recommendation: detect + prompt.** Check `playwright.chromium.executablePath()` existence at CLI startup. If missing, show a clear message and prompt to install. This respects user consent for the large download.

```typescript
// src/cli/index.ts startup check
async function ensurePlaywrightBrowsers(): Promise<void> {
  const { chromium } = await import('playwright');
  try {
    // executablePath() throws if browser is not installed
    chromium.executablePath();
  } catch {
    console.log('Playwright browsers not found. Running: npx playwright install chromium');
    const { execSync } = await import('child_process');
    execSync('npx playwright install chromium', { stdio: 'inherit' });
  }
}
```

### Claude Code plugin structure

Based on verified Claude Code plugin documentation [VERIFIED: code.claude.com/docs/en/plugins-reference], the sniff plugin is a directory with:

```
sniff-plugin/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── .mcp.json                # MCP server config (sniff MCP server)
└── README.md
```

The plugin exposes sniff's capabilities via the MCP server (D-13), not as slash commands invoking the CLI directly. This is the correct model: Claude Code auto-discovers MCP tools and makes them available as callable tools.

```json
// .claude-plugin/plugin.json
{
  "name": "sniff",
  "version": "0.1.0",
  "description": "AI-powered QA testing — scan, explore, and report bugs before users do",
  "author": {
    "name": "Adam Boudj",
    "url": "https://github.com/adamboudj/sniff"
  },
  "homepage": "https://github.com/adamboudj/sniff",
  "repository": "https://github.com/adamboudj/sniff",
  "license": "MIT",
  "keywords": ["testing", "qa", "playwright", "accessibility"]
}
```

```json
// .mcp.json (at plugin root)
{
  "mcpServers": {
    "sniff": {
      "command": "npx",
      "args": ["sniff-qa", "--mcp"],
      "env": {}
    }
  }
}
```

**Installation command (D-15):** The user installs via marketplace or local path:
```bash
claude plugin install sniff@marketplace-name
# or for local development:
claude --plugin-dir ./sniff-plugin
```

Note: `claude plugin add sniff` is NOT the correct command — the correct command is `claude plugin install`. [VERIFIED: code.claude.com/docs/en/plugins-reference CLI commands reference]

### Plugin vs standalone MCP server

Sniff should distribute both:
1. **`sniff-qa` npm package** — includes the MCP server binary; users can configure it directly in Claude Desktop `.mcp.json`
2. **Plugin directory** — bundles the `.mcp.json` config for one-step `claude plugin install`

The plugin directory can be a subdirectory in the npm package or a separate git repo. For v1, include it as `plugin/` in the repository with documentation.

---

## Implementation Risks

### Risk 1: npm package name `sniff` is taken (HIGH IMPACT, CERTAIN)
The name `sniff` is claimed on npm. This must be resolved before any publish step. The plan must include a task to select and verify an alternative name, then update all references (package.json, `bin` entries, CI workflow template, README, plugin MCP config).

### Risk 2: `npx sniff` zero-install promise (D-16) cannot be delivered with a renamed package (HIGH IMPACT)
If the package is `sniff-qa`, users type `npx sniff-qa run`, not `npx sniff run`. This is a product experience gap. Mitigation: global install instructions (`npm install -g sniff-qa`) which allow `sniff run`. Or: apply for the `sniff` npm package transfer.

### Risk 3: AIProvider interface extension may break Phase 1-3 implementations (MEDIUM IMPACT)
Adding `decideNextAction` to the `AIProvider` interface will require updating `ClaudeCodeProvider` and any test mocks. Use a separate `ExplorationProvider` interface to avoid breaking changes.

### Risk 4: testId stability for flakiness detection (MEDIUM IMPACT)
If scanner names, rule IDs, or URL structures change across runs, the history file accumulates orphaned entries. The ID scheme `"${scanner}::${ruleId}::${url}"` is stable within a project version but will fragment on URL-heavy apps with dynamic content. Document the limitation.

### Risk 5: MCP server Zod version peer dependency (LOW IMPACT)
`@modelcontextprotocol/sdk` declares `zod: "^3.25 || ^4.0"` as a peer dep. The project uses `zod@^4.3.6` — compatible. Watch for breakage if the SDK requires zod v3-specific APIs in future minor releases.

### Risk 6: Playwright browser weight in npx usage (LOW IMPACT)
`npx sniff-qa` without pre-installed browsers triggers a ~150MB chromium download. This is expected for E2E tools but should be clearly communicated in the README and handled gracefully in code (prompt, not silent auto-install).

---

## Recommended Plan Structure

Four plans covering the phase:

### Plan A: Chaos Monkey Exploration Mode
- New `ExplorationProvider` interface in `src/ai/types.ts`
- Edge-case payload constants in `src/exploration/edge-cases.ts`
- `ExplorationRunner` class in `src/exploration/runner.ts`
- `ExplorationActionLog` types in `src/exploration/types.ts`
- Claude Code provider implementation of `ExplorationProvider`
- `sniff explore` CLI command
- Config schema extension: `exploration` section
- Tests: unit tests for edge-case payloads, integration test for exploration loop

### Plan B: Flakiness Detection + CI Mode
- `TestRunRecord`, `FlakinessHistory` types in `src/core/types.ts`
- `appendRunHistory` and `loadFlakinessHistory` in `src/core/persistence.ts`
- `computeFlakeStatus` algorithm in `src/core/flakiness.ts`
- CLI: `--track-flakes` flag on `sniff run`, always-on in CI mode
- CI mode exit code logic (quarantine filter)
- Config schema extension: `flakiness` section (threshold, windowSize, historyPath)
- `sniff ci` command: writes GitHub Actions workflow template to `.github/workflows/sniff.yml`
- Tests: unit tests for flake rate algorithm, edge cases (< window size, all pass, all fail)

### Plan C: MCP Server
- Install `@modelcontextprotocol/sdk`
- `src/mcp/server.ts` entry point
- Three tool handlers delegating to existing scan/run/report pipeline
- `sniff-mcp` bin entry in package.json (or `--mcp` flag on main binary)
- tsup config update to include `src/mcp/server.ts`
- Manual smoke test: connect with MCP Inspector or Claude Desktop config
- Plugin directory: `plugin/.claude-plugin/plugin.json`, `plugin/.mcp.json`

### Plan D: Distribution Packaging
- Resolve package name (verify `sniff-qa` availability, update all references)
- Update `package.json` with all publish fields (`publishConfig`, `keywords`, `repository`, `license`, `description`, `homepage`, `bugs`)
- README.md for npm listing (install, usage, CLI reference, MCP config, CI setup)
- First-run browser check in CLI startup
- `npm pack` dry run to verify `files: ["dist"]` includes correct artifacts
- Plugin directory documentation
- `npm publish --dry-run` verification

---

## Standard Stack (Phase 4 additions)

| Package | Version | Purpose | Status |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.29.0` | MCP server + stdio transport | Add [VERIFIED: npm registry] |
| `playwright` | `^1.59.1` | Browser automation (existing) | Already present |
| `zod` | `^4.3.6` | Schema validation (existing + MCP tool schemas) | Already present |
| `commander` | `^14.0.3` | CLI commands (existing) | Already present |

No new runtime dependencies beyond `@modelcontextprotocol/sdk`. All other Phase 4 functionality (exploration, flakiness, CI template) is pure TypeScript logic.

---

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest (already configured) |
| Config file | none — default vitest config |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements Test Map
| Area | Behavior | Test Type | Command | File Exists? |
|---|---|---|---|---|
| Chaos monkey | Edge-case payloads are complete and valid | Unit | `npm test -- --run src/exploration/edge-cases.test.ts` | No — Wave 0 |
| Chaos monkey | ExplorationRunner loop terminates at maxSteps | Unit | `npm test -- --run src/exploration/runner.test.ts` | No — Wave 0 |
| Flakiness | computeFlakeStatus returns correct flake rate | Unit | `npm test -- --run src/core/flakiness.test.ts` | No — Wave 0 |
| Flakiness | appendRunHistory trims to MAX_HISTORY_PER_TEST | Unit | `npm test -- --run src/core/persistence.test.ts` | No — Wave 0 |
| CI template | Generated YAML is valid and contains required steps | Unit | `npm test -- --run src/ci/workflow-template.test.ts` | No — Wave 0 |
| MCP server | Three tools registered with correct schemas | Unit | `npm test -- --run src/mcp/server.test.ts` | No — Wave 0 |

### Wave 0 Gaps
- `src/exploration/edge-cases.test.ts` — validates payload categories
- `src/exploration/runner.test.ts` — exploration loop behavior
- `src/core/flakiness.test.ts` — flake rate algorithm
- `src/core/persistence.test.ts` — history append/trim
- `src/ci/workflow-template.test.ts` — YAML output correctness
- `src/mcp/server.test.ts` — tool registration smoke test

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `sniff-qa` is available on npm | Distribution | Must pick a different name; all docs/templates need updating |
| A2 | `files: ["dist"]` with tsup output is sufficient for npm publish | Distribution | Broken package if dist doesn't include all needed files |
| A3 | Claude Code plugin install is via `claude plugin install` (not `claude plugin add`) | Plugin | Wrong install instructions in README |
| A4 | Playwright's `executablePath()` throws when browser is not installed | First-run check | Browser check logic fails silently |
| A5 | Single `--mcp` flag on the main `sniff` binary is preferable to a separate `sniff-mcp` bin | MCP | Separate bin may be cleaner for MCP client configs |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: Context7 /modelcontextprotocol/typescript-sdk] — `McpServer`, `StdioServerTransport`, `registerTool` API patterns
- [VERIFIED: npm registry `@modelcontextprotocol/sdk`] — v1.29.0, Zod peer dependency `^3.25 || ^4.0`
- [VERIFIED: npm registry `sniff`] — name conflict, v0.2.0, last published 2022-06-26
- [VERIFIED: code.claude.com/docs/en/plugins-reference] — plugin.json schema, directory structure, `claude plugin install` command
- [VERIFIED: src/browser/runner.ts] — BrowserRunner class, PageHookPipeline integration pattern
- [VERIFIED: src/browser/page-hooks.ts] — PageHook interface, ConsoleErrorHook, NetworkFailureHook, ScreenshotHook
- [VERIFIED: src/core/persistence.ts] — `.sniff/` directory pattern, saveResults/loadLastResults pattern
- [VERIFIED: src/config/schema.ts] — Zod schema composition pattern for config extension
- [VERIFIED: src/ai/types.ts] — AIProvider interface definition
- [VERIFIED: src/analyzers/route-discoverer.ts] — discoverRoutes signature and framework dispatch
- [VERIFIED: src/analyzers/element-extractor.ts] — extractElements signature, INTERACTIVE_TAGS set
- [VERIFIED: npm registry `playwright`] — v1.59.1 (matches package.json)

### Secondary (MEDIUM confidence)
- GitHub Actions Playwright cache path `~/.cache/ms-playwright` — confirmed via multiple community sources and Playwright docs
- `actions/cache@v4`, `actions/checkout@v4`, `actions/setup-node@v4` — current versions per GitHub Actions marketplace

### Tertiary (LOW confidence)
- `sniff-qa` as alternative package name — not verified available on npm (Assumption A1)
- Playwright `executablePath()` throw behavior on missing browser (Assumption A4)

---

## RESEARCH COMPLETE

**Phase:** 04 - Exploration + CI + Distribution
**Overall Confidence:** HIGH for architecture and MCP; MEDIUM for distribution (blocked by name conflict)

**Top findings:**
1. `sniff` npm name is taken — must rename before any publish attempt
2. MCP SDK v1.29.0 is the right choice — `registerTool` API matches existing Zod patterns exactly
3. Claude Code plugin installs via `claude plugin install`, not `claude plugin add`; plugin structure is directory-based with optional `.claude-plugin/plugin.json`
4. All four exploration components (BrowserRunner reuse, route-discoverer, element-extractor, AIProvider extension) have clear, non-breaking integration points
5. Flakiness detection is straightforward persistence layer extension — `history.json` alongside existing `last-results.json`
