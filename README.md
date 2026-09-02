<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg">
  <img alt="sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?style=flat-square&color=FF006E&logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&color=00D4FF&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-7C3AED?style=flat-square" alt="License Apache 2.0"></a>
  <a href="https://github.com/Aboudjem/sniff/stargazers"><img src="https://img.shields.io/github/stars/Aboudjem/sniff?style=flat-square&color=2BE8C8" alt="Stars"></a>
</p>

<p align="center"><b>English</b> · <a href="READMEs/zh-CN.md">简体中文</a> · <a href="READMEs/ja.md">日本語</a> · <a href="READMEs/es.md">Español</a> · <a href="READMEs/fr.md">Français</a></p>

<p align="center"><b>Point it at your running app. It walks your real user flows in a real browser and tells you what is actually broken, with proof.</b></p>

<p align="center"><a href="#what-it-does">What it does</a> · <a href="#install">Install</a> · <a href="#use-it">Use it</a> · <a href="#what-you-get">What you get</a> · <a href="#works-in-your-editor">Works in your editor</a> · <a href="#good-to-know">Good to know</a></p>

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

## What it does

Linters read your source and never run your app. End-to-end frameworks make you write and maintain
the tests. sniff opens your running app in a real browser, clicks and fills things like a user
would, and judges what actually happened.

- **It finds 12 classes of bugs**, from HTTP 500 routes and dead links to placeholder data, dead
  submit buttons, forms wiped by the back button, stuck spinners, and mobile overflow.
- **It proves every one.** A finding carries the route, the ordered steps to reproduce it, a
  screenshot, and the console or network excerpt that caught it. No proof, no finding.
- **It has been measured.** On a fixture app planted with 21 bugs across all 12 classes, plus a
  clean control page, sniff finds 21 of 21 and reports nothing on the control page.

## Install

The block above is the Claude Code path, through the [10x marketplace](https://github.com/Aboudjem/10x).
For any other agent, the Vercel skills CLI installs the same three skills:

```bash
npx skills add Aboudjem/sniff
```

To use it as a plain command line tool, with no editor involved:

```bash
npx sniff-qa --url http://localhost:3000
```

The npm package is `sniff-qa` and the binary it installs is `sniff`. Do not run `npx sniff`, which
is an unrelated package.

<details>
<summary>Node version, project install, and CI</summary>

Node.js 22 or newer. `npm install -D sniff-qa` pins it in a project, and `npx sniff-qa ci` writes a
GitHub Actions workflow with browser caching and report artifacts.
</details>

## Use it

**1. Start your app.** Any dev server, any framework.

```bash
npm run dev
```

**2. Walk it,** from a second terminal. sniff auto-detects a dev server on the common ports, so
`--url` is optional, but passing it always works.

```bash
npx sniff-qa --url http://localhost:3000
```

**3. Read the findings.** They print grouped by severity. Below is an abridged real run against this
repo's own planted-bug fixture, from `npx sniff-qa --url http://localhost:4321 --ci --max-pages 12`:

```text
sniff v0.8.0  walking http://localhost:4321

  26 findings (+1 low-confidence hidden; use --all)

  CRITICAL (1)
    • [confirmed] Page returns HTTP 500
      /crash  (route/broken-page)
        - Navigate to /crash
        - Server responded with HTTP 500
      fix: The route throws server-side. Check the server logs/handler for this path and return a valid page or a proper error page.
      shot: sniff-reports/crawl/_crash-desktop.png

✓ Scan complete: 26 issue(s) found. Exit code 1 so CI fails on bugs; pass --fail-on none to always exit 0.
```

Add `--report` for a self-contained HTML page you can send to someone. Run `npx sniff-qa doctor` if
the environment looks wrong.

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

## What you get

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

- **A terminal report** grouped by severity, each finding with steps, a screenshot path, and a fix.
- **A shareable file**, a self-contained HTML report with `--report` or JSON with `--json`.
- **An exit code**, non-zero when findings reach the `--fail-on` severity, so CI fails on real bugs.
- **A confidence label** on each finding. `uncertain` ones stay hidden unless you pass `--all`.

New in 0.8.0:

- `--caps scan,report` narrows the MCP server to the source scan and the saved-results reader, with
  no browser launch and no browser download.
- `--storage-state auth.json` walks a logged-in app, and cookie and token values from that file are
  redacted from every written report.
- An `assert` block in `sniff.config` caps findings by severity (`maxCritical`, `maxHigh`,
  `maxTotal`), enforced by the walk, the source scan, and discovery.

## Works in your editor

Works in Claude Code, Cursor, Codex, Copilot, Gemini CLI, and 70+ other agents through
`npx skills add`. The skills are Markdown, so they run on whatever model your editor points at.

| Agent | One-line install |
|:--|:--|
| Claude Code | `claude plugin install sniff@10x` |
| Any of 70+ agents | `npx skills add Aboudjem/sniff` |
| Codex, Gemini CLI, OpenCode, Pi | `install.sh codex` |
| VS Code (Copilot) | `install.sh copilot` |
| Everything else | see [docs/editors.md](docs/editors.md) |

<details>
<summary>Add it as an MCP server instead</summary>

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

Cursor, VS Code, Gemini CLI, Windsurf, Continue, OpenCode, and Zed take the same command as a JSON
or TOML entry. Every per-editor snippet is in [docs/editors.md](docs/editors.md).
</details>

## Good to know

> [!IMPORTANT]
> No API key, no account, no signup. sniff runs on your machine and your source never leaves it.
> Walking and scanning never change your code. `sniff fix` is the only command that edits source
> files, and only when you run it.

> [!NOTE]
> The first browser walk downloads a Chromium build once and then caches it. Over MCP, sniff returns
> a `needsSetup` payload instead of blocking your editor on the download.

- **It wants a running app.** With no dev server up it falls back to a source-only scan and tells
  you how to start the real walk. `npx sniff-qa scan` runs that scan on purpose.
- **Dead-link checking follows external links,** so a walk makes requests to the third-party URLs
  your own pages already link to.
- **A walk that finds bugs exits 1** on purpose, so CI fails the build. That is not a crash. Pass
  `--fail-on none` to always exit 0.

## Learn more

- [docs/editors.md](docs/editors.md), install and MCP snippets for every supported agent
- [docs/authenticated-walks.md](docs/authenticated-walks.md), walking a logged-in app with `--storage-state`
- [docs/assert-budgets.md](docs/assert-budgets.md), capping findings by severity in `sniff.config`
- [docs/comparison.md](docs/comparison.md), how sniff differs from linters, link checkers, and E2E frameworks
- [docs/faq.md](docs/faq.md), the questions this page does not answer
- [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [LICENSE](LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="LICENSE">Apache 2.0</a> · standing on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>
