<div align="center">

<br />

<pre>
        ╱|、
      (˚ˎ 。7
       |、˜〵
       じしˍ,)ノ

      <b>s n i f f</b>
</pre>

### One command. Five checks. Zero config.

Catches source bugs, accessibility violations, visual regressions, slow pages, and crash-on-input forms before your users do.

<br />

[![npm](https://img.shields.io/npm/v/sniff-qa?color=cb3837&logo=npm&label=npm)](https://www.npmjs.com/package/sniff-qa)
[![License](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-≥22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![CI](https://github.com/Aboudjem/sniff/actions/workflows/ci.yml/badge.svg)](https://github.com/Aboudjem/sniff/actions/workflows/ci.yml)

</div>

<br />

## Three modes. That's it.

<div align="center">

<img src="./.github/assets/modes.svg" alt="Sniff modes" width="100%">

</div>

| | When to use it | Run |
|:--|:--|:--|
| **Quick** | Save the file. Want to check it. | `npx sniff-qa` |
| **Full** | Pre-push. Pre-merge. Local audit. | `npx sniff-qa --url http://localhost:3000` |
| **CI** | GitHub Actions, GitLab CI, anything pipeline. | `npx sniff-qa --url http://localhost:3000 --ci` |

That's the whole CLI. No flags to memorize.

> [!TIP]
> The **full** mode runs everything Sniff knows how to do, including the AI explorer. **CI** mode skips exploration so your pipelines stay deterministic.

<br />

## Quickstart

```bash
# Source scan (no browser needed)
npx sniff-qa

# Full audit against your running app
npx sniff-qa --url http://localhost:3000
```

Requires **Node.js 22+**. Playwright browsers install automatically the first time you run a browser scan.

<br />

## What gets checked

<div align="center">

<img src="./.github/assets/architecture.svg" alt="Sniff architecture" width="100%">

</div>

<table>
<tr>
<td width="50%" valign="top">

### 📄 Source code

```
! HIGH (3)
  src/api/handler.ts:42    Debugger statement
  src/components/Hero.tsx:8 Lorem ipsum text
  src/utils/auth.ts:15     FIXME comment
```

Catches what code review misses: leftover `debugger`, placeholder text, hardcoded URLs, broken imports, TODO/FIXME tags.

</td>
<td width="50%" valign="top">

### ♿ Accessibility

```
! CRITICAL
  /login  Missing form label
  /login  Color contrast 2.1:1 (needs 4.5:1)
```

Powered by [axe-core](https://github.com/dequelabs/axe-core). Same engine used at Microsoft, Google, and US government sites. Every finding includes the fix.

</td>
</tr>
<tr>
<td valign="top">

### 🖼 Visual regression

```
! HIGH
  /pricing  2.3% pixels changed
            (threshold: 0.1%)
```

Local pixel diffing with [pixelmatch](https://github.com/mapbox/pixelmatch). No Percy subscription. Commit baselines to track changes across PRs.

</td>
<td valign="top">

### ⚡ Performance

```
! HIGH
  /dashboard  LCP 4200ms
              budget 2500ms (68% over)
```

[Lighthouse](https://developer.chrome.com/docs/lighthouse) audits with budget enforcement. Defaults: LCP 2500ms, FCP 1800ms, TTI 3800ms.

</td>
</tr>
<tr>
<td colspan="2" valign="top">

### 🤖 AI explorer

```
! HIGH
  /signup  Console error filling email with: <script>alert(1)</script>
           TypeError: Cannot read property 'trim' of undefined
  /search  POST /api/search returned 500 — input: ' OR '1'='1
```

Runs automatically in **full** mode. Roams your app, fills forms with adversarial inputs (XSS, SQL injection, Unicode), reports crashes. Every action traced in `.sniff/exploration-<timestamp>.json`.

</td>
</tr>
</table>

<br />

## Power-user flags

You don't need these. They're here when you do.

| Flag | Effect |
|:--|:--|
| `--no-explore` | Skip the AI explorer in full mode |
| `--no-browser` | Force source-only even when URL is configured |
| `--max-steps <n>` | Cap exploration steps (default: 50) |
| `--no-headless` | Show the browser window |
| `--format <list>` | Report formats: `html`, `json`, `junit` |
| `--fail-on <list>` | Severities that exit non-zero (default: `critical,high`) |
| `--track-flakes` | Enable flakiness detection across runs |
| `--json` | Machine-readable JSON output |

<br />

## Utility commands

| Command | Purpose |
|:--|:--|
| `sniff init` | Scaffold a `sniff.config.ts` file |
| `sniff ci` | Generate `.github/workflows/sniff.yml` |
| `sniff report` | Show results from the last run |
| `sniff update-baselines` | Accept current screenshots as new baselines |

<br />

## Configuration

Optional. Defaults are sensible. When you want control:

```typescript
// sniff.config.ts
import { defineConfig } from 'sniff-qa';

export default defineConfig({
  scanner: {
    include: ['src/**/*.{ts,tsx,js,jsx,vue,svelte}'],
    exclude: ['**/*.test.*'],
  },
  browser: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
  },
  viewports: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'desktop', width: 1280, height: 720 },
  ],
  performance: {
    budgets: { lcp: 2500, fcp: 1800, tti: 3800 },
  },
  visual: { threshold: 0.1 },
  flakiness: { windowSize: 5, threshold: 3 },
  exploration: { maxSteps: 50 },
  report: { formats: ['html', 'json'] },
});
```

> [!NOTE]
> When `browser.baseUrl` is set, `sniff` runs the full audit by default. Drop the URL or pass `--no-browser` for a source-only scan.

<br />

## CI integration

```bash
npx sniff-qa ci
```

Generates a complete GitHub Actions workflow with Playwright caching, headless mode, JUnit output, flakiness quarantine, and report artifacts.

<details>
<summary><b>See the generated workflow</b></summary>

```yaml
name: Sniff QA
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
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - uses: actions/cache@v4
        id: pw
        with:
          path: ~/.cache/ms-playwright
          key: ${{ runner.os }}-pw-${{ hashFiles('package-lock.json') }}
      - if: steps.pw.outputs.cache-hit != 'true'
        run: npx playwright install --with-deps chromium
      - if: steps.pw.outputs.cache-hit == 'true'
        run: npx playwright install-deps chromium
      - run: npx sniff-qa --ci
        env:
          CI: true
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: sniff-reports
          path: sniff-reports/
          retention-days: 30
```

</details>

**Flakiness quarantine.** Tests that fail 3 of 5 recent runs get quarantined. They still run, still appear in reports, but won't block your pipeline. History lives in `.sniff/history.json`.

<br />

## Use it inside Claude Code, Cursor, or Windsurf

Sniff ships an MCP server. Drop this in your project's `.mcp.json`:

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

Then ask your AI: *"Scan this project for issues"* or *"Check accessibility on localhost:3000"*.

| Tool | What it does |
|:--|:--|
| `sniff_scan` | Static source analysis |
| `sniff_run` | Browser-based quality scan |
| `sniff_report` | Last scan results |

<br />

## Built on

| | Project | Role | License |
|:--|:--|:--|:--|
| 🎭 | [Playwright](https://playwright.dev) | Browser automation | Apache-2.0 |
| ♿ | [axe-core](https://github.com/dequelabs/axe-core) | Accessibility engine | MPL-2.0 |
| 🔦 | [Lighthouse](https://developer.chrome.com/docs/lighthouse) | Performance auditing | Apache-2.0 |
| 🔲 | [pixelmatch](https://github.com/mapbox/pixelmatch) | Screenshot comparison | ISC |
| 📐 | [Zod](https://zod.dev) | Schema validation | MIT |
| 🔌 | [MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk) | AI tool protocol | MIT |

<br />

## Compared to

|  | **Sniff** | Lighthouse CI | Pa11y | BackstopJS |
|:--|:--:|:--:|:--:|:--:|
| Source scanning | ✅ | | | |
| Accessibility | ✅ | partial | ✅ | |
| Visual regression | ✅ | | | ✅ |
| Performance budgets | ✅ | ✅ | | |
| AI exploration | ✅ | | | |
| Flakiness detection | ✅ | | | |
| Zero config | ✅ | | | |
| Single command | ✅ | | | |
| MCP server | ✅ | | | |

<br />

## Contributing

Easiest way in: **add a source rule.** Each rule is a regex pattern with a severity level. See `src/scanners/source/rules/` for examples and read [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup.

Issues labeled [`good first issue`](https://github.com/Aboudjem/sniff/labels/good%20first%20issue) are scoped for newcomers.

<br />

## License

[Apache 2.0](LICENSE)

---

<div align="center">

Built by [**Adam Boudj**](https://github.com/Aboudjem)

Found a bug Sniff missed? [Open an issue.](https://github.com/Aboudjem/sniff/issues)
Sniff found one your tests didn't? [Drop a star.](https://github.com/Aboudjem/sniff)

</div>
