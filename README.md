<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/logo-light.svg">
  <img alt="Sniff" src=".github/assets/logo-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?color=ef4444&logo=npm&label=npm&style=flat-square" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-ef4444?style=flat-square" alt="License"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node"></a>
  <a href="https://github.com/Aboudjem/sniff/stargazers"><img src="https://img.shields.io/github/stars/Aboudjem/sniff?style=flat-square&color=ef4444" alt="Stars"></a>
</p>

<p align="center">
  <b>One command. Eight checks. Zero config.</b><br/>
  <sub>Scan your source code, your live site, or both. Finds bugs before your users do.</sub>
</p>

---

## Table of contents

- [Install](#install)
- [Usage](#usage)
- [Commands](#commands)
- [What it checks](#what-it-checks)
- [Example output](#example-output)
- [Configuration](#configuration)
- [MCP server (AI editors)](#mcp-server)
- [CI integration](#ci-integration)
- [How it works](#how-it-works)
- [Compared to](#compared-to)
- [Trust and privacy](#trust-and-privacy)
- [Contributing](#contributing)

---

## Install

**Run without installing** (recommended to try it out):

```bash
npx sniff-qa
```

**Add to your project** (for regular use):

```bash
npm install -D sniff-qa
```

Then add to `package.json`:

```json
{
  "scripts": {
    "qa": "sniff",
    "qa:full": "sniff --url http://localhost:3000"
  }
}
```

Requires **Node.js 22+**. Playwright browsers install automatically the first time you use `--url`.

---

## Usage

### 1. Scan source code only

`cd` into your project and run sniff. It scans all files in the current directory for bugs.

```bash
cd ~/projects/my-app
npx sniff-qa
```

**What it finds:** debug statements, placeholder text (lorem ipsum, TODO, FIXME), dead links, hardcoded localhost URLs, broken imports, API endpoint issues (missing validation, auth, error handling, hardcoded secrets).

**No browser needed.** Works offline. Finishes in seconds.

```
sniff v0.2.0

[source] Scanning source code...
[source] 7 issues (2 high, 5 medium/low)

  HIGH  src/api/handler.ts:42       debugger statement detected
  HIGH  README.md:28                Broken internal link: ./missing-guide.md
  MED   src/config.ts:8             Hardcoded localhost URL detected
  MED   src/routes.ts:5             POST /users has no input validation
  MED   src/routes.ts:18            GET /admin has no visible auth middleware
  LOW   docs/api.md:15              HTTP 404: https://example.com/old-docs
  INFO  Discovered 4 API endpoints (express: 3, nextjs-app: 1)
```

### 2. Scan source code + live site

Start your dev server, then run sniff with `--url`. This scans your source code *and* opens a browser to test every route.

```bash
# Terminal 1: start your app
npm run dev

# Terminal 2: run sniff
npx sniff-qa --url http://localhost:3000
```

**What it adds on top of source scanning:** accessibility violations (WCAG via axe-core), visual regressions (pixel diffing), performance budget checks (LCP, FCP, TTI via Lighthouse), AI-driven exploration (fills forms with adversarial inputs), and cross-referencing between source and browser findings.

Works with any URL: `localhost`, staging, or production.

```
sniff v0.2.0

[source] Scanning source code...
[source] 7 issues (2 high, 5 medium/low)

[browser] Testing http://localhost:3000...
  /            clean
  /login       2 findings
  /dashboard   4 findings

[perf] 1 budget violation

[xref] 2 finding(s) corroborated by source + browser evidence
```

### 3. Scan a specific directory

Point sniff at any folder without `cd`-ing into it:

```bash
npx sniff-qa ~/projects/my-other-app
npx sniff-qa ~/projects/my-other-app --url https://staging.myapp.com
```

### 4. Scan in CI

```bash
npx sniff-qa --url http://localhost:3000 --ci
```

Same as full audit but skips the AI explorer (non-deterministic), outputs JUnit XML, and tracks flaky tests automatically.

---

## Commands

```
sniff                              Scan source code in current directory
sniff --url <url>                  Scan source + test live site (full audit)
sniff --url <url> --ci             Full audit for CI (deterministic, JUnit output)
sniff <path>                       Scan a specific directory
sniff <path> --url <url>           Scan specific directory + test live site

sniff init                         Create a sniff.config.ts in your project
sniff ci                           Generate .github/workflows/sniff.yml
sniff report                       Show results from last scan
sniff update-baselines             Accept current screenshots as visual baselines
```

### Flags

All flags are optional. Sniff works with zero flags and zero config.

| Flag | What it does |
|:-----|:-------------|
| `--url <url>` | Enable browser checks on this URL (accessibility, visual, performance, AI explorer) |
| `--ci` | CI mode: skip AI explorer, add JUnit output, track flaky tests |
| `--no-explore` | Run browser checks but skip the AI explorer |
| `--no-browser` | Skip browser checks even if `--url` is set |
| `--max-steps <n>` | Limit AI explorer to N steps (default: 50) |
| `--no-headless` | Show the browser window while testing |
| `--format html,json,junit` | Choose report formats (default: html,json) |
| `--fail-on critical,high` | Which severities cause a non-zero exit code (default: critical,high) |
| `--track-flakes` | Track test flakiness across runs |
| `--json` | Output results as JSON (for scripts and integrations) |

---

## What it checks

| Check | When it runs | Example finding |
|:------|:-------------|:----------------|
| **Debug statements** | Always | `debugger` in `handler.ts:42` |
| **Placeholder text** | Always | Lorem ipsum in `Page.tsx:15` |
| **Hardcoded URLs** | Always | `http://localhost:3001` in `config.ts:8` |
| **Broken imports** | Always | `./utils/helper` doesn't resolve in `index.ts:5` |
| **Dead links** | Always | `./guide.md` doesn't exist, `https://old-url.com` returns 404 |
| **API endpoints** | Always | `POST /users` has no validation, `GET /admin` has no auth |
| **Accessibility** | With `--url` | Missing form label on `/login` (WCAG 2.x via axe-core) |
| **Visual regression** | With `--url` | `/pricing` changed 2.3% of pixels since last run |
| **Performance** | With `--url` | LCP 4200ms on `/dashboard` (budget: 2500ms, via Lighthouse) |
| **AI explorer** | With `--url` | XSS payload in `/signup` email field crashes the app |
| **Cross-reference** | With `--url` | `console.log` in source confirmed in browser console at `/dashboard` |

> [!NOTE]
> The first 6 checks run on source code only. No browser, no URL, no API keys needed. The last 5 require `--url` pointing to a running site.

### Supported frameworks

Sniff auto-detects your framework. No config needed.

<table>
<tr>
<td align="center" width="16%"><b>React</b></td>
<td align="center" width="16%"><b>Next.js</b></td>
<td align="center" width="16%"><b>Vue</b></td>
<td align="center" width="16%"><b>Svelte</b></td>
<td align="center" width="16%"><b>Angular</b></td>
<td align="center" width="16%"><b>Vanilla</b></td>
</tr>
<tr>
<td align="center">JSX / TSX</td>
<td align="center">App + Pages Router</td>
<td align="center">SFC</td>
<td align="center">Components</td>
<td align="center">Templates</td>
<td align="center">HTML / CSS</td>
</tr>
</table>

API endpoint discovery also works with **Express**, **Fastify**, **Hono**, **tRPC**, and **GraphQL**.

---

## Example output

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/report-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/report-light.svg">
  <img alt="Sniff terminal output showing source findings, browser results, and cross-referenced findings" src=".github/assets/report-light.svg" width="100%">
</picture>

---

## Configuration

**Sniff works with zero config.** You only need a config file if you want to customize behavior.

Create one with:

```bash
npx sniff-qa init
```

Or manually create `sniff.config.ts` in your project root:

```typescript
import { defineConfig } from 'sniff-qa';

export default defineConfig({
  // Save your URL so you can just run `sniff` without flags
  browser: {
    baseUrl: 'http://localhost:3000',
  },

  // Test these viewport sizes
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 720 },
  ],

  // Performance budgets (ms)
  performance: {
    budgets: { lcp: 2500, fcp: 1800, tti: 3800 },
  },

  // Visual regression threshold (0-1, lower = stricter)
  visual: { threshold: 0.1 },

  // AI explorer settings
  exploration: { maxSteps: 50 },

  // Flakiness tracking
  flakiness: { windowSize: 5, threshold: 3 },

  // Dead link checker
  deadLinks: {
    checkExternal: true,      // validate external URLs via HTTP
    timeout: 5000,            // ms per request
    retries: 2,               // retry on failure
    ignorePatterns: [],       // regex patterns to skip
    maxConcurrent: 10,        // parallel HTTP requests
  },

  // API endpoint discovery
  apiEndpoints: {
    checkErrorHandling: true, // flag missing try/catch
    checkValidation: true,    // flag missing input validation
    checkAuth: true,          // flag missing auth middleware
    checkSecrets: true,       // flag hardcoded secrets
    frameworks: [],           // empty = auto-detect all
  },

  // Turn off specific rules
  rules: {
    'debug-console-log': 'off',  // allow console.log
  },
});
```

<details>
<summary><b>All rule IDs you can toggle</b></summary>
<br/>

| Rule ID | What it checks | Default severity |
|:--------|:---------------|:-----------------|
| `debug-console-log` | `console.log/debug/info` | medium |
| `debug-debugger` | `debugger` statements | high |
| `placeholder-lorem` | Lorem ipsum text | high |
| `placeholder-todo` | TODO comments | medium |
| `placeholder-fixme` | FIXME comments | high |
| `placeholder-tbd` | TBD markers | medium |
| `hardcoded-localhost` | `http://localhost:*` URLs | medium |
| `hardcoded-127` | `http://127.0.0.1:*` URLs | medium |
| `broken-import` | Unresolved relative imports | medium |
| `dead-link-internal` | Broken internal file links | high |
| `dead-link-external` | 404 external URLs | medium |
| `dead-link-anchor` | Missing `#anchor` targets | medium |
| `api-no-error-handling` | Routes without try/catch | medium |
| `api-no-validation` | POST/PUT/PATCH without validation | medium |
| `api-no-auth` | Non-public routes without auth | low |
| `api-hardcoded-secret` | Hardcoded API keys/tokens | critical |
| `api-endpoints-discovered` | Endpoint discovery summary | info |

Set any rule to `'off'` to disable it:

```typescript
rules: {
  'placeholder-todo': 'off',
  'dead-link-external': 'off',
}
```

</details>

---

<h2 id="mcp-server">MCP server</h2>

Sniff ships as an MCP server so your AI editor can scan, read results, and fix issues without you switching context.

```bash
npx sniff-qa --mcp
```

**3 tools exposed:**

| Tool | What it does |
|:-----|:-------------|
| `sniff_scan` | Run source code scan, returns findings |
| `sniff_run` | Run full browser audit on a URL |
| `sniff_report` | Get results from the last scan |

<details>
<summary><b>Setup for your editor</b></summary>
<br/>

**Claude Code**

```bash
claude mcp add sniff-qa npx sniff-qa --mcp
```

**Cursor** (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "sniff-qa": { "type": "stdio", "command": "npx", "args": ["sniff-qa", "--mcp"] }
  }
}
```

**VS Code + Copilot** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "sniff-qa": { "type": "stdio", "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] }
  }
}
```

**Windsurf** (`~/.codeium/windsurf/mcp_config.json`)

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["sniff-qa", "--mcp"] }
  }
}
```

**Codex CLI**

```bash
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

**Gemini CLI** (`~/.gemini/mcp_config.json`)

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["sniff-qa", "--mcp"] }
  }
}
```

**Continue.dev** (`.continue/mcpServers/sniff-qa.yaml`)

```yaml
mcpServers:
  sniff-qa:
    command: npx
    args: [sniff-qa, --mcp]
    type: stdio
```

**OpenClaw**

```bash
clawhub install sniff-qa
```

</details>

Once configured, ask your AI: *"Scan this project for issues"* or *"Check accessibility on localhost:3000"*.

---

## CI integration

Generate a GitHub Actions workflow:

```bash
npx sniff-qa ci
```

This creates `.github/workflows/sniff.yml` with Playwright caching, JUnit output, flakiness quarantine, and report artifacts.

**Flakiness quarantine:** Tests that fail 3 out of 5 runs get quarantined. They still run and appear in reports, but they won't block your pipeline.

---

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/pipeline-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/pipeline-light.svg">
  <img alt="Sniff pipeline" src=".github/assets/pipeline-light.svg" width="100%">
</picture>

1. **Source scanner** reads your files and runs regex + AST rules to find bugs
2. **Browser runner** (when you pass `--url`) opens Playwright, visits every route, and runs accessibility/visual/performance checks
3. **Cross-reference engine** compares what was found in source with what was seen in the browser. Findings confirmed in both get bumped severity and marked HIGH confidence
4. **Report engine** outputs HTML, JSON, or JUnit XML

<details>
<summary><b>Architecture diagram</b></summary>
<br/>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/architecture-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/architecture-light.svg">
  <img alt="Sniff architecture" src=".github/assets/architecture-light.svg" width="100%">
</picture>

</details>

---

## Compared to

| | **Sniff** | Lighthouse CI | Pa11y | BackstopJS |
|:--|:--:|:--:|:--:|:--:|
| Source scanning | yes | | | |
| Dead link checking | yes | | | |
| API endpoint discovery | yes | | | |
| Accessibility | yes | partial | yes | |
| Visual regression | yes | | | yes |
| Performance | yes | yes | | |
| AI exploration | yes | | | |
| Cross-referencing | yes | | | |
| Flakiness quarantine | yes | | | |
| Single command | yes | | | |
| MCP server | yes | | | |
| Zero config | yes | | | |

---

## Trust and privacy

- **No telemetry.** Sniff does not phone home. Ever.
- **No signup.** No accounts. No API keys for core functionality.
- **No data collection.** Your code stays on your machine.
- **Open source.** Read every line. [Apache 2.0](LICENSE).

> [!NOTE]
> The AI explorer requires an Anthropic API key. The other 7 checks work completely offline. The dead link scanner makes HTTP requests to validate external URLs but never sends your code.

---

## Contributing

Easiest way in: **add a source rule.** Each rule is a regex pattern with a severity level in `src/scanners/source/rules/`. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Good first contributions:**
- Add a new source scanning rule
- Report a false positive
- Improve documentation

---

## Built on

[Playwright](https://playwright.dev) · [axe-core](https://github.com/dequelabs/axe-core) · [Lighthouse](https://developer.chrome.com/docs/lighthouse) · [pixelmatch](https://github.com/mapbox/pixelmatch) · [Zod](https://zod.dev) · [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) · [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)

---

<p align="center">
  <a href="https://www.linkedin.com/in/adam-boudjemaa/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/AdamBoudj"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://adam-boudjemaa.com/"><img src="https://img.shields.io/badge/Website-ef4444?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
</p>

<p align="center">
  <sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a></sub>
</p>
