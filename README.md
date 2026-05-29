<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-light.svg">
  <img alt="Sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?color=ef4444&logo=npm&label=npm&style=flat-square" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-ef4444?style=flat-square" alt="License"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node"></a>
  <a href="https://github.com/Aboudjem/10x"><img src="https://img.shields.io/badge/10x-marketplace-ef4444?style=flat-square" alt="10x marketplace"></a>
  <a href="https://github.com/Aboudjem/sniff/stargazers"><img src="https://img.shields.io/github/stars/Aboudjem/sniff?style=flat-square&color=ef4444" alt="Stars"></a>
</p>

<p align="center"><b>Point it at your running app. It walks your real user flows in a real browser and tells you what's actually broken — with proof.</b></p>

<p align="center">
  <a href="#get-started">Get started</a> ·
  <a href="#what-it-finds">What it finds</a> ·
  <a href="#why-you-can-trust-it">Why trust it</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#demo">Demo</a> ·
  <a href="#faq">FAQ</a>
</p>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg">
  <img alt="Sniff flow: your running app -> headless browser walk -> findings with proof" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg" width="100%">
</picture>

---

## What is this?

Sniff is an autonomous QA scanner. You point it at a running web app and it **walks your app's real user flows in a real (headless) browser** — clicking buttons, filling forms, following links — and reports what's actually broken.

It is **not** a linter and **not** a static scanner. It opens your pages, interacts with them like a user would, and watches what happens.

Every bug it reports comes with **proof**: the exact page, the ordered steps to reproduce it, a screenshot, and the console or network excerpt that caught it. A finding without reproduction proof is not a finding.

```bash
npx sniff-qa
```

That's the whole setup. Sniff auto-detects your running dev server and walks it. No API key. No Playwright setup. No config files.

> Sniff walks a **running app**. If no dev server is running, it falls back to a source-code scan and tells you exactly how to start the real walk. See [Get started](#get-started).

---

## Get started

You need **Node.js 22+** and a web app you can run locally (or a URL).

> **Naming:** the npm package is **`sniff-qa`** — use `npx sniff-qa` or `npm install -D sniff-qa`. Once installed, the binary is **`sniff`** (the `sniff-qa` binary works too). Don't run `npx sniff` — that's a different package.

### 1. Start your app

```bash
npm run dev        # or however you start your app
```

### 2. Walk it

In another terminal:

```bash
npx sniff-qa --url http://localhost:3000     # point it at your running app
```

That's the reliable one-liner. Sniff also **auto-detects** a dev server on common ports, so from your project folder you can often just run `npx sniff-qa` with no flags. If your app is on a non-standard port (or auto-detect misses it), pass `--url` — that always works. It also walks a deployed URL:

```bash
npx sniff-qa --url https://staging.myapp.com
```

> **Found bugs? It exits non-zero — on purpose.** A walk that finds issues exits with code `1` so CI fails the build; it is **not** a crash (you'll see a `✓ Scan complete` line). Pass `--fail-on none` to always exit `0`.

> **First run downloads a browser.** The first time Sniff opens a browser it downloads a Chromium build (~165 MB, one-time). You'll see the progress. You need internet access for that first run; after that it's cached.

### 3. Read the report

Findings print to your terminal, grouped by severity, each with steps to reproduce. Want a shareable page?

```bash
npx sniff-qa --report     # writes sniff-reports/sniff-report.html (self-contained, open in any browser)
```

**No app running?** Sniff doesn't fail silently. It runs a source-only scan and prints a clear next step — start your dev server or pass `--url` — so you can get to the real flow-walk. You can also run the source scan on purpose:

```bash
npx sniff-qa scan         # source-only scan, no browser
```

Stuck? Run `npx sniff-qa doctor` to check your environment (Node, browser, dev server).

---

## What it finds

Sniff walks your app and looks for **12 classes of real bugs**:

| # | Class | Examples |
|:--|:------|:---------|
| 1 | **Broken pages / routes** | 4xx/5xx responses, blank renders, crash screens |
| 2 | **Broken links** | Dead internal and external links |
| 3 | **Console & network errors** | Uncaught exceptions and failed requests *during interaction* |
| 4 | **Empty & fake data** | Missing data, plus placeholders like `lorem ipsum`, `TODO`, `test@test.com` |
| 5 | **Broken forms** | Dead submit buttons, validation that never fires |
| 6 | **State loss** | Fill a form, hit back, and it's wiped |
| 7 | **Flow regressions / dead-ends** | A journey that can't be completed |
| 8 | **Bad loading & error states** | Infinite spinners, missing error states |
| 9 | **Broken async outcomes** | Submitted but no success feedback (flagged "needs out-of-band verification") |
| 10 | **Responsive issues** | Overflow and tiny tap targets (a 375px mobile pass) |
| 11 | **Accessibility** | Missing alt text and labels, contrast — via [axe-core](https://github.com/dequelabs/axe-core) |
| 12 | **Unclear primary actions** | The main call-to-action is buried or ambiguous |

Each finding ships with:

- **Reproduction proof** — the exact route, the ordered steps, a screenshot, and the console/network excerpt.
- **A severity** — so you fix the right thing first.
- **A confidence** — `confirmed`, `likely`, or `uncertain`. Uncertain findings are hidden by default; add `--all` to see them.
- **A suggested fix.**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The bug classes Sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

---

## Why you can trust it

Most scanners drown you in false positives until you stop reading them. Sniff is built the opposite way.

We measured it on a fixture app planted with **21 bugs across all 12 classes**, plus a clean control page that should produce zero findings:

| | Old engine | New engine |
|:--|:--|:--|
| Bugs found | 9 / 21 (43%) | **21 / 21 (100%)** |
| Precision | ~13% | **100%** |
| False positives | 125 | **0** |
| Findings on the clean page | — | **0** |
| Flagship command | crashed | works |

Those numbers are locked as a regression test. The full suite is **441 tests**.

**How it keeps false positives near zero:**

- A first-party **noise filter** drops the junk that isn't your bug — favicons, analytics, hot-module-reload chatter, expected auth redirects, engine aborts.
- Accessibility findings are backed by **axe-core**, which is zero-false-positive by design.
- **Uncertain findings are suppressed by default** (use `--all` to see them).
- A broken page is reported **once**, not re-flagged on every link that points to it.

If Sniff can't prove a bug, it doesn't claim one.

---

## How is it different?

Linters read your source. End-to-end frameworks make *you* write the tests. Link checkers only check links. Sniff drives your real app and judges the result.

| | **Sniff** | linkinator | pa11y | Playwright codegen | QA-Wolf-style services |
|:--|:--|:--|:--|:--|:--|
| Walks real user flows in a browser | **Yes** | No | No | You script it | Yes |
| Zero setup, zero test-writing | **Yes** | Yes | Yes | No (you write tests) | No (onboarding) |
| Broken links | **Yes** | Yes | No | Manual | Manual |
| Accessibility (axe-core) | **Yes** | No | **Yes** | Manual | Some |
| Empty / placeholder / fake data | **Yes** | No | No | No | No |
| State-loss (back-button wipes a form) | **Yes** | No | No | Manual | Manual |
| One-shot reproduction proof per finding | **Yes** | No | Partial | No | Varies |
| Self-contained HTML report | **Yes** | No | Partial | No | Dashboard |
| Runs locally, no account, no API key | **Yes** | Yes | Yes | Yes | No (service) |

What Sniff uniquely does in one command: catch **empty/placeholder data**, **state-loss**, and **broken async outcomes** — and hand you a single proof report — with **no scripts to write and no service to sign up for**.

---

## Commands

```
sniff                  Walk your app (auto-detects the dev server). The default.
sniff --url <url>      Walk a specific URL
sniff scan             Source-only scan, no browser (placeholders, TODOs, dead links, etc.)
sniff report           Show the results from the last run
sniff doctor           Check your environment (Node, browser, config, dev server)
sniff ci               Generate a GitHub Actions workflow
sniff fix              Auto-fix safe issues (console.log, debugger, etc.)
sniff --help           Show every command and flag
sniff --version        Show the version
```

### Useful flags

| Flag | What it does |
|:-----|:-------------|
| `--url <url>` | Walk this URL instead of auto-detecting |
| `--report` | Write a self-contained HTML report to `sniff-reports/sniff-report.html` |
| `--all` | Also show low-confidence (`uncertain`) findings |
| `--max-pages <n>` | Cap how many pages to walk (default: 25) |
| `--no-mobile` | Skip the 375px responsive pass |
| `--headed` | Show the browser window while it walks |
| `--json` | Machine-readable JSON output |
| `--ci` | CI mode (stable output, non-interactive) |
| `--fail-on <sev>` | Exit non-zero on findings at or above this severity |

---

## Demo

A real run against a buggy app — 21 real issues, zero false positives, every finding with severity, confidence, reproduction steps, and a fix:

<img alt="Sniff walking a buggy app and reporting 21 real issues with zero false positives" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.svg" width="100%">

---

## Use it from your AI editor

Sniff ships as an MCP server too. Add it once, then just ask your assistant *"scan this project for bugs"* or *"walk my app."* If your app is running, Sniff auto-detects it — you don't have to pass a URL.

**One unified `sniff` tool, three modes:**

- `walk` — **recommended.** Walks your running app's real flows (the flow-walk above).
- `scan` — source-only scan, no browser.
- `report` — show the last run's results.

(`run` and `discover` are legacy modes kept for back-compat.)

<details>
<summary><b>Claude Code</b></summary>

One-command plugin install from the [10x marketplace](https://github.com/Aboudjem/10x):

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

Or add just the MCP server:

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
```
</details>

<details>
<summary><b>Cursor</b></summary>

Add to `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

Add to `.vscode/mcp.json`:

```json
{ "servers": { "sniff-qa": { "type": "stdio", "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```
</details>

<details>
<summary><b>Gemini CLI</b></summary>

Add to `~/.gemini/mcp_config.json`:

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Windsurf</b></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Continue.dev</b></summary>

Add to `.continue/mcpServers/sniff-qa.yaml`:

```yaml
mcpServers:
  sniff-qa: { command: npx, args: ["-y", "sniff-qa", "--mcp"], type: stdio }
```
</details>

> The first browser-based walk downloads Chromium (~165 MB). Over MCP, Sniff returns a structured `needsSetup` payload instead of blocking the editor on a long download — run the install it shows you, then ask again.

---

## How it works

1. **Find the app.** Sniff auto-detects your running dev server (or you pass `--url`).
2. **Walk the flows.** It opens pages in a headless browser and interacts with them like a user — clicking, filling forms, following links — across desktop and a 375px mobile pass.
3. **Watch everything.** It records console errors, failed network requests, broken renders, missing feedback, and accessibility issues as it goes.
4. **Filter the noise.** The first-party noise filter and axe-core drop the false positives; uncertain findings are held back.
5. **Report with proof.** Each surviving finding gets a severity, a confidence, reproduction steps, a screenshot, and a suggested fix — in the terminal and an optional HTML report.

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

---

## CI integration

Run Sniff in your pipeline and fail the build on real bugs:

```bash
npx sniff-qa --ci --fail-on high
```

Generate a ready-to-commit GitHub Actions workflow:

```bash
npx sniff-qa ci
```

This writes `.github/workflows/sniff.yml` with browser caching and report artifacts.

---

## FAQ

**Does it work without a dev server?**
Sniff is built to walk a *running* app, so that's where it shines. If no server is running, it doesn't fail silently — it runs a source-only scan and tells you exactly how to start the real walk (start your dev server or pass `--url`). You can also run `npx sniff-qa scan` to get the source scan on purpose.

**What gets downloaded on first run?**
The first time Sniff opens a browser, it downloads a Chromium build (~165 MB, one-time, then cached). You'll see the progress, and you need internet access for that first run. Nothing else is installed and no account is created.

**Do I need an API key?**
No. Sniff runs entirely on your machine with no API key and no signup. Your code and your app never leave your computer.

**How is it different from a linter?**
A linter reads your source files and never runs your app, so it can't see a dead submit button, an infinite spinner, a wiped form, or a 500 page. Sniff opens your real app, interacts with it, and reports what actually broke — with a screenshot and steps to reproduce.

**How is it different from Playwright codegen (or writing E2E tests)?**
Playwright codegen records a script that *you* author and maintain; it tests only the path you clicked. Sniff writes nothing for you to maintain — it explores your flows on its own and judges the outcome, catching things a recorded happy-path never checks (empty/placeholder data, state-loss, missing success feedback).

**Will it change my code?**
No, not during a walk. Walking and scanning are read-only. The separate `sniff fix` command applies safe auto-fixes (like stray `console.log`/`debugger`) and only when you run it.

**What stacks does it work with?**
Any web app you can open in a browser — React, Next.js, Vue, Svelte, Angular, Remix, SvelteKit, Astro, plain HTML, and more. It walks the rendered app, so the framework doesn't matter for the browser checks.

---

## Works first-class in

Claude Code · Cursor · VS Code (Copilot) · Codex · Gemini CLI · Windsurf · Continue.dev — via the MCP server (command `npx`, args `["-y", "sniff-qa", "--mcp"]`) or the CLI directly.

---

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

---

<p align="center">
  <sub>
    Built on <a href="https://playwright.dev">Playwright</a> · <a href="https://github.com/dequelabs/axe-core">axe-core</a> · <a href="https://developer.chrome.com/docs/lighthouse">Lighthouse</a> · <a href="https://github.com/mapbox/pixelmatch">pixelmatch</a> · <a href="https://zod.dev">Zod</a> · <a href="https://github.com/modelcontextprotocol/typescript-sdk">MCP SDK</a>
  </sub>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/adam-boudjemaa/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/AdamBoudj"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://adam-boudjemaa.com/"><img src="https://img.shields.io/badge/Website-ef4444?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
</p>

<p align="center">
  <sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="LICENSE">Apache 2.0</a></sub>
</p>
