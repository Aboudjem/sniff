<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/logo-light.svg">
  <img alt="Sniff - open source AI-powered QA testing tool with source scanning, accessibility audits, visual regression, performance budgets, and AI exploration" src=".github/assets/logo-light.svg" width="100%">
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
  <sub>Source bugs, dead links, API endpoints, accessibility, visual regression, performance, AI exploration, and cross-referencing. All in one pass.</sub>
</p>

---

<br/>

## What is this?

You ship features. But did you actually *test* them?

**sniff** is an AI-powered QA tool that scans your project for real problems: leftover debugger statements, dead links, API endpoint issues, accessibility violations, visual regressions, performance budget breaches, and adversarial edge cases. It runs eight checks in a single command and cross-references source code with browser behavior for high-confidence findings.

```bash
npx sniff-qa
```

That's it. No config files. No signup. No API keys. It just works.

<br/>

### Key facts

- **What:** Open source AI-powered QA testing tool that runs 8 checks in a single command: source scanning (6 rule categories + dead links + API endpoint discovery), accessibility audits, visual regression, performance budgets, AI-driven exploration, and source/browser cross-referencing
- **Who it's for:** Frontend and full-stack developers who want automated QA without configuring multiple tools
- **How it works:** Uses Playwright for browser automation, axe-core for WCAG accessibility, Lighthouse for performance, pixelmatch for visual diffs, and Anthropic Claude for adversarial AI exploration
- **Install:** `npx sniff-qa` (zero config, no signup, no API keys required for base checks)
- **Comparable to:** Combines Lighthouse CI + Pa11y + BackstopJS into one tool, plus source code scanning and AI-driven edge case discovery that no other tool offers
- **Unique:** First QA tool with native MCP (Model Context Protocol) integration. Flakiness quarantine system isolates non-deterministic test results automatically

<br/>

## Quick start

| Step | Action |
|:----:|:-------|
| **1** | Run a source scan: `npx sniff-qa` |
| **2** | Run the full audit: `npx sniff-qa --url http://localhost:3000` |
| **3** | Read the report and fix what matters |

The source scan finishes in seconds. The full audit adds accessibility, visual regression, performance, and AI exploration on top of it.

> [!TIP]
> Drop your URL in `sniff.config.ts` once and you can just run `sniff` for the full audit every time.

<br/>

## The three modes

```mermaid
graph LR
    A["🔍 Quick Scan<br/><sub>npx sniff-qa</sub>"] --> B["Source bugs only<br/><sub>No browser needed</sub>"]
    C["🛡️ Full Audit<br/><sub>npx sniff-qa --url URL</sub>"] --> D["All 8 checks<br/><sub>Source + Browser + Xref</sub>"]
    E["🏗️ CI Mode<br/><sub>npx sniff-qa --url URL --ci</sub>"] --> F["Deterministic<br/><sub>Skips AI explorer</sub>"]

    style A fill:#fef2f2,stroke:#ef4444,color:#7f1d1d
    style B fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    style C fill:#fef2f2,stroke:#ef4444,color:#7f1d1d
    style D fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    style E fill:#fef2f2,stroke:#ef4444,color:#7f1d1d
    style F fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
```

```bash
npx sniff-qa                                   # quick scan (no browser)
npx sniff-qa --url http://localhost:3000       # full audit (everything)
npx sniff-qa --url http://localhost:3000 --ci  # ci mode (skips AI explorer)
```

CI mode auto-skips the AI explorer because it is non-deterministic. Everything else runs exactly the same.

<br/>

## What it checks

| | Check | Example finding | Details |
|:--|:------|:----------------|:--------|
| 📄 | **Source code** | `debugger` statement in `handler.ts:42` | Leftover debugger, placeholder text, hardcoded URLs, broken imports, TODO/FIXME |
| 🔗 | **Dead links** | Broken link `./guide.md` in `README.md:28` | Validates internal file refs, external URLs (HTTP HEAD with retry), and anchor links. Catches 404s before your users do |
| 🛣️ | **API endpoints** | `POST /users` has no input validation | Discovers routes from Express, Fastify, Hono, Next.js, SvelteKit, tRPC, and GraphQL. Flags missing error handling, auth, and hardcoded secrets |
| ♿ | **Accessibility** | Missing form label on `/login` | WCAG 2.x violations via [axe-core](https://github.com/dequelabs/axe-core) with exact fix guidance |
| 🖼 | **Visual regression** | `/pricing` changed 2.3% of pixels | Local pixel diffing via [pixelmatch](https://github.com/mapbox/pixelmatch). Commit baselines to track changes |
| ⚡ | **Performance** | LCP 4200ms on `/dashboard` (budget: 2500ms) | [Lighthouse](https://developer.chrome.com/docs/lighthouse) budgets for LCP, FCP, TTI |
| 🤖 | **AI explorer** | XSS in `/signup` email field crashes app | Roams your app, fills forms with adversarial inputs, reports crashes and console errors |
| 🔀 | **Cross-reference** | `console.log` in source confirmed at runtime | Correlates source findings with browser evidence. Corroborated issues get bumped severity and HIGH confidence tags |

<br/>

## How it works

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/pipeline-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/pipeline-light.svg">
  <img alt="Sniff pipeline showing 8 checks flowing through source scanner, browser runner, cross-reference engine, and report output" src=".github/assets/pipeline-light.svg" width="100%">
</picture>

Your code goes in. A report with actionable findings comes out. When you provide a URL, sniff also runs browser checks and cross-references source findings with runtime behavior for high-confidence results. You don't configure anything.

<br/>

## Compared to

| | **Sniff** | Lighthouse CI | Pa11y | BackstopJS |
|:--|:--:|:--:|:--:|:--:|
| Source scanning | ✅ | ❌ | ❌ | ❌ |
| Dead link checking | ✅ | ❌ | ❌ | ❌ |
| API endpoint discovery | ✅ | ❌ | ❌ | ❌ |
| Accessibility | ✅ | partial | ✅ | ❌ |
| Visual regression | ✅ | ❌ | ❌ | ✅ |
| Performance | ✅ | ✅ | ❌ | ❌ |
| AI exploration | ✅ | ❌ | ❌ | ❌ |
| Cross-reference engine | ✅ | ❌ | ❌ | ❌ |
| Flakiness quarantine | ✅ | ❌ | ❌ | ❌ |
| Single command | ✅ | ❌ | ❌ | ❌ |
| MCP server | ✅ | ❌ | ❌ | ❌ |
| Zero config | ✅ | ❌ | ❌ | ❌ |

> [!IMPORTANT]
> Sniff is the **first QA tool with native MCP integration**. Your AI editor can trigger scans, read results, and fix issues without you switching context.

<br/>

## Source scanning rules

Sniff ships 6 rule categories that run on every scan. No browser needed.

| Rule | ID | Severity | What it catches |
|:-----|:---|:---------|:----------------|
| Debug statements | `debug-console-log`, `debug-debugger` | medium / high | `console.log`, `console.debug`, `debugger` left in production code |
| Placeholder text | `placeholder-lorem`, `placeholder-todo`, `placeholder-fixme`, `placeholder-tbd` | high / medium | Lorem ipsum, TODO, FIXME, TBD markers |
| Hardcoded URLs | `hardcoded-localhost`, `hardcoded-127` | medium | `http://localhost:*` and `http://127.0.0.1:*` in non-test files |
| Broken imports | `broken-import` | medium | Relative imports that don't resolve to a file (with TS extension mapping) |
| Dead links | `dead-link-internal`, `dead-link-external`, `dead-link-anchor` | high / medium / low | Broken file references, 404 external URLs, missing anchor targets |
| API endpoints | `api-no-error-handling`, `api-no-validation`, `api-no-auth`, `api-hardcoded-secret` | critical / medium / low | Route handlers missing try/catch, input validation, auth, or containing hardcoded secrets |

### Dead link checker

Scans `.md`, `.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`, and `.astro` files for links and validates them:

- **Internal links:** Checks the target file exists (with extension resolution and index file fallback)
- **External links:** Sends HTTP HEAD requests with timeout, retry, and GET fallback for servers that reject HEAD
- **Anchor links:** Validates `#section` references against markdown headings and HTML `id`/`name` attributes
- **Smart skipping:** Ignores `mailto:`, `tel:`, `data:`, `javascript:`, and template variables

```
HIGH  README.md:28        Broken internal link: ./missing-guide.md
MED   docs/api.md:15      HTTP 404: https://example.com/old-endpoint
MED   CONTRIBUTING.md:8   Anchor #setup-guide not found in ./README.md
```

### API endpoint discovery

Automatically discovers API routes from 8 frameworks:

| Framework | Detection method |
|:----------|:----------------|
| Express | `app.get()`, `router.post()`, etc. |
| Fastify | `fastify.get()`, `fastify.post()`, etc. |
| Hono | `app.get()` with `new Hono()` detection |
| Next.js App Router | `app/**/route.ts` with exported `GET`/`POST` handlers |
| Next.js Pages Router | `pages/api/**/*.ts` |
| SvelteKit | `routes/**/+server.ts` |
| tRPC | `publicProcedure.query()` / `.mutation()` |
| GraphQL | `type Query { }` / `type Mutation { }` definitions |

For each endpoint, sniff checks for:
- Missing error handling (no try/catch or error middleware)
- Missing input validation on POST/PUT/PATCH routes (no zod, joi, yup, etc.)
- Missing auth middleware on non-public routes
- Hardcoded secrets (API keys, tokens, Stripe keys, GitHub tokens)

```
CRIT  src/routes.ts:12    Hardcoded Stripe key in POST /checkout handler
MED   src/api.ts:5        POST /users has no input validation
MED   src/api.ts:18       GET /admin/data has no error handling
LOW   src/api.ts:25       GET /admin/data has no visible auth middleware
INFO  Discovered 6 API endpoints (express: 4, nextjs-app: 2)
```

### Cross-reference engine

When you run sniff with `--url`, the cross-reference engine correlates source code findings with browser runtime behavior. Findings confirmed in both layers get bumped severity and a HIGH confidence tag.

**5 correlation strategies:**

| Source finding | Browser evidence | Correlation |
|:---------------|:-----------------|:------------|
| Broken import / dead link | 404 network request | `broken-import-to-404` |
| `console.log` statement | Console output captured | `console-log-to-runtime` |
| Hardcoded localhost URL | Network request to that URL | `hardcoded-url-to-network` |
| Missing label / a11y issue | axe-core violation | `source-a11y-to-axe` |
| Placeholder text in source | Text visible on page | `placeholder-to-runtime` |

```
CORROBORATED (source + browser evidence)
  src/handler.ts:42  console.log("debug data")
    Source: debug-console-log rule triggered
    Browser: console.log output captured at /dashboard
    Confidence: HIGH (confirmed in both layers)
```

<br/>

## Architecture

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/architecture-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/architecture-light.svg">
  <img alt="Sniff architecture showing source scanner, browser runner, cross-reference engine, and report engine" src=".github/assets/architecture-light.svg" width="100%">
</picture>

<br/>

## Example output

<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/assets/report-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset=".github/assets/report-light.svg">
  <img alt="Sniff terminal output showing source findings, browser results, and cross-referenced corroborated findings" src=".github/assets/report-light.svg" width="100%">
</picture>

<br/>

## Works with your stack

No config needed. Sniff auto-detects your framework from `package.json` and source files.

<table>
<tr>
<td align="center" width="16%"><b>⚛️ React</b></td>
<td align="center" width="16%"><b>▲ Next.js</b></td>
<td align="center" width="16%"><b>💚 Vue</b></td>
<td align="center" width="16%"><b>🔶 Svelte</b></td>
<td align="center" width="16%"><b>🅰️ Angular</b></td>
<td align="center" width="16%"><b>🌐 Vanilla</b></td>
</tr>
<tr>
<td align="center">JSX / TSX</td>
<td align="center">App Router</td>
<td align="center">SFC</td>
<td align="center">Components</td>
<td align="center">Templates</td>
<td align="center">HTML / CSS</td>
</tr>
</table>

<br/>

## 🔌 Use with your AI editor

Sniff ships an MCP server. Pick your tool and copy the snippet.

<details>
<summary><b>Claude Code</b></summary>

```bash
claude mcp add sniff-qa npx sniff-qa --mcp
```

Or `.mcp.json`:

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["sniff-qa", "--mcp"] }
  }
}
```

</details>

<details>
<summary><b>Cursor</b></summary>

`~/.cursor/mcp.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "sniff-qa": {
      "type": "stdio",
      "command": "npx",
      "args": ["sniff-qa", "--mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["sniff-qa", "--mcp"] }
  }
}
```

</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

Or add to `~/.codex/config.toml`:

```toml
[mcp_servers.sniff-qa]
command = "npx"
args = ["-y", "sniff-qa", "--mcp"]
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

`~/.gemini/mcp_config.json`:

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["sniff-qa", "--mcp"] }
  }
}
```

</details>

<details>
<summary><b>Continue.dev</b></summary>

`.continue/mcpServers/sniff-qa.yaml`:

```yaml
mcpServers:
  sniff-qa:
    command: npx
    args: [sniff-qa, --mcp]
    type: stdio
```

</details>

<details>
<summary><b>VS Code + Copilot</b></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "sniff-qa": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "sniff-qa", "--mcp"]
    }
  }
}
```

</details>

<details>
<summary><b>OpenClaw</b></summary>

```bash
clawhub install sniff-qa
```

Or add to `~/.openclaw/openclaw.json`:

```json
{
  "mcpServers": {
    "sniff-qa": {
      "command": "npx",
      "args": ["-y", "sniff-qa", "--mcp"]
    }
  }
}
```

</details>

Once configured, ask: *"Scan this project for issues"* or *"Check accessibility on localhost:3000"*.

**MCP tools exposed:** `sniff_scan` (source), `sniff_run` (browser), `sniff_report` (last results).

<br/>

## Install

```bash
npm install -D sniff-qa
```

```json
{
  "scripts": {
    "qa": "sniff --url http://localhost:3000"
  }
}
```

Then run `npm run qa`. Requires Node.js 22+. Playwright browsers install automatically the first time.

<br/>

## 🏗️ CI integration

```bash
npx sniff-qa ci
```

Generates `.github/workflows/sniff.yml` with Playwright caching, JUnit output, flakiness quarantine, and report artifacts.

**Flakiness quarantine.** Tests that fail 3 of 5 runs get quarantined. They still run, still appear in reports, but won't block your pipeline.

<br/>

## All commands

<details>
<summary><b>📋 Full CLI reference</b></summary>
<br/>

```
sniff                       quick scan (source only)
sniff --url <url>           full audit (everything)
sniff --url <url> --ci      ci mode (no AI explorer)

sniff init                  scaffold sniff.config.ts
sniff ci                    generate .github/workflows/sniff.yml
sniff report                show last results
sniff update-baselines      accept current screenshots as baselines
```

### Flags (all optional)

| Flag | Effect |
|:--|:--|
| `--no-explore` | Skip AI explorer in full mode |
| `--no-browser` | Force source-only even when URL is set |
| `--max-steps <n>` | Cap exploration steps (default: 50) |
| `--no-headless` | Show the browser window |
| `--format html,json,junit` | Choose report formats |
| `--fail-on critical,high` | Severities that exit non-zero |
| `--track-flakes` | Enable flakiness detection |
| `--json` | Machine-readable output |

</details>

<br/>

## Configuration

<details>
<summary><b>⚙️ sniff.config.ts reference</b></summary>
<br/>

Optional. Drop `sniff.config.ts` in your project root:

```typescript
import { defineConfig } from 'sniff-qa';

export default defineConfig({
  browser: {
    baseUrl: 'http://localhost:3000',
  },
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 720 },
  ],
  performance: {
    budgets: { lcp: 2500, fcp: 1800, tti: 3800 },
  },
  visual: { threshold: 0.1 },
  exploration: { maxSteps: 50 },
  flakiness: { windowSize: 5, threshold: 3 },

  // Dead link checker (new in v0.2)
  deadLinks: {
    checkExternal: true,      // validate external URLs via HTTP
    timeout: 5000,            // ms per request
    retries: 2,               // retry failed requests
    ignorePatterns: [],       // regex patterns to skip
    maxConcurrent: 10,        // parallel HTTP requests
  },

  // API endpoint discovery (new in v0.2)
  apiEndpoints: {
    checkErrorHandling: true, // flag missing try/catch
    checkValidation: true,    // flag missing input validation
    checkAuth: true,          // flag missing auth middleware
    checkSecrets: true,       // flag hardcoded secrets
    frameworks: [],           // empty = auto-detect all
  },

  // Disable specific rules
  rules: {
    'debug-console-log': 'off',     // example: allow console.log
    'dead-link-internal': 'off',    // example: skip dead link checks
  },
});
```

</details>

<br/>

## 🔒 Trust and privacy

| | |
|:--|:--|
| 🚫 | **No telemetry.** Sniff does not phone home. Ever. |
| 🔑 | **No signup.** No accounts. No API keys for core functionality. |
| 📦 | **No data collection.** Your code stays on your machine. |
| 👁️ | **Open source.** Read every line. Apache 2.0. |

> [!NOTE]
> The AI explorer requires an Anthropic API key only if you want the chaos monkey feature. The other seven checks (source scanning, dead links, API endpoints, accessibility, visual regression, performance, cross-referencing) work completely offline with zero external calls. External link checking in the dead link scanner makes HTTP requests to validate URLs, but never sends your code.

<br/>

## Built on

[Playwright](https://playwright.dev) · [axe-core](https://github.com/dequelabs/axe-core) · [Lighthouse](https://developer.chrome.com/docs/lighthouse) · [pixelmatch](https://github.com/mapbox/pixelmatch) · [Zod](https://zod.dev) · [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) · [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)

<br/>

## Contributing

Easiest way in: **add a source rule.** Each rule is a regex pattern with a severity level in `src/scanners/source/rules/`. See [CONTRIBUTING.md](CONTRIBUTING.md).

**Good first contributions:**
- 🔧 Add a new source scanning rule
- 🐛 Report a false positive
- 📚 Improve documentation

<br/>

## License

[Apache 2.0](LICENSE)

---

<p align="center">
  <a href="https://www.linkedin.com/in/adam-boudjemaa/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/AdamBoudj"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://adam-boudjemaa.com/"><img src="https://img.shields.io/badge/Website-ef4444?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
</p>

<p align="center">
  <sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · Apache 2.0 · No telemetry · No data collection</sub>
</p>
