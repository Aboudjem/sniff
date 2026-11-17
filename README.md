<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg">
  <img alt="sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?style=flat-square&color=FF006E&logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&color=00D4FF&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-7C3AED?style=flat-square" alt="License Apache 2.0"></a>
</p>

<p align="center"><b>English</b> · <a href="READMEs/zh-CN.md">简体中文</a> · <a href="READMEs/ja.md">日本語</a> · <a href="READMEs/es.md">Español</a> · <a href="READMEs/fr.md">Français</a></p>

<p align="center"><b>Point it at your running app. It clicks through your pages in a real browser and tells you what is broken, with the steps to reproduce it.</b></p>

<p align="center"><a href="#what-you-get">What you get</a> · <a href="#install">Install</a> · <a href="#how-it-works">How it works</a> · <a href="#works-with">Works with</a> · <a href="#proof">Proof</a> · <a href="#faq">FAQ</a> · <a href="#limits">Limits</a></p>

```bash
npx sniff-qa --url http://localhost:3000
```

## What you get

A report that opens with the verdict, then the three things to fix first, then every finding.
This is the top of a real run on this repo's planted-bug fixture (2026-11-17, sniff 0.9.0):

```text
  VERDICT  FAIL: 26 findings (1 critical, 13 high, 11 medium, 1 low)
  Walked 12 pages, checked 13 links, in 53.8s. 1 low-confidence finding hidden, show with --all.

  Fix these first:
    1. Page returns HTTP 500 on /crash  [critical]
    2. Page returns HTTP 404 on /dead  [high]
    3. Page returns HTTP 404 on /missing  [high]

  Every finding, with the steps that reproduce it:

  CRITICAL (1)
    • [confirmed] Page returns HTTP 500
      /crash  (route/broken-page)
        - Navigate to /crash
        - Server responded with HTTP 500
      fix: The route throws server-side. Check the server logs/handler for this path and return a valid page or a proper error page.
      shot: sniff-reports/crawl/_crash-desktop.png
```

Each finding carries a severity, a confidence label, the route, the steps, a fix and a screenshot.

| Output          | Flag        | Use it for                                  |
| :-------------- | :---------- | :------------------------------------------ |
| Terminal report | (default)   | Reading the result now                      |
| HTML page       | `--report`  | Sending to someone, one self-contained file |
| JSON            | `--json`    | Scripts and other tools                     |
| Exit code       | `--fail-on` | Failing CI on real bugs                     |

| Exit code | Meaning                                                                         |
| :-------- | :------------------------------------------------------------------------------ |
| `0`       | No finding reached the `--fail-on` severities (default: critical and high)      |
| `1`       | A finding reached them, an `assert` budget was breached, or sniff could not run |

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

## Install

Node.js 22 or newer. Pick one path.

**Command line, no editor.** Start your app, then walk it from a second terminal:

```bash
npx sniff-qa --url http://localhost:3000
```

The npm package is `sniff-qa`. Do not run `npx sniff`: that is an unrelated package.

**Claude Code plugin**, through the [10x marketplace](https://github.com/Aboudjem/10x):

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

**Skills for any agent**, through the Vercel skills CLI:

```bash
npx skills add Aboudjem/sniff
```

**MCP server**, for any MCP client:

```bash
claude mcp add sniff-qa -- npx -y sniff-qa --mcp
```

The first walk downloads a Chromium build once (about 165 MB). Run `npx sniff-qa doctor` to check
Node, the browser and your dev server.

<details>
<summary>Project install and CI</summary>

`npm install -D sniff-qa` adds it to a project. `npx sniff-qa ci` writes a GitHub Actions workflow
with browser caching and report artifacts.
</details>

## How it works

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **Find the app.** It uses `--url`, or a dev server on a common port.
2. **Walk it.** A headless Chromium follows your links, clicks buttons and fills forms, like a user.
3. **Judge what happened.** Each page is checked for 12 classes of bugs.
4. **Prove it.** A finding needs a route, the steps, a screenshot and the console or network excerpt.
5. **Report.** Verdict first, then the fix-first list, then the detail.

The 12 classes:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

With no app running, `sniff` reads your source instead (`sniff scan`). It flags debug statements,
placeholder text and broken imports, and tells you how to start the real walk.

The MCP server exposes these tools:

| Tool             | What it does                                            |
| :--------------- | :------------------------------------------------------ |
| `sniff`          | One entry point: `mode: "walk"`, `"scan"` or `"report"` |
| `sniff_scan`     | Source-only scan, no browser                            |
| `sniff_run`      | Source scan plus browser checks                         |
| `sniff_discover` | Generates scenarios from your source and drives them    |
| `sniff_install`  | Downloads the Playwright browser                        |
| `sniff_report`   | Reads the last saved results                            |

`--caps scan,report` narrows the server to those two tools, with no browser at all.

## Works with

Each row was tested on 2026-11-17 against the sniff 0.9.0 build.

| Agent          | What ran                                                                         | Tested     |
| :------------- | :------------------------------------------------------------------------------- | :--------- |
| Claude Code    | `claude -p` with sniff as an MCP server called `sniff_scan` and read 2 findings  | 2026-11-17 |
| Codex CLI      | `codex exec` with sniff as an MCP server called `sniff_scan` and read 2 findings | 2026-11-17 |
| Gemini CLI     | `gemini extensions validate .` accepted `gemini-extension.json`                  | 2026-11-17 |
| Any MCP client | `node sniff-tests/mcp-smoke.mjs` listed 6 tools and a walk returned 20 findings  | 2026-11-17 |
| Skills CLI     | `npx skills@1.9.0 add Aboudjem/sniff` installed the 3 skills into a temp folder  | 2026-11-17 |

Documented, not tested today: Cursor, VS Code with Copilot, Windsurf, OpenCode and Zed.
Their snippets are in [docs/editors.md](docs/editors.md).

## Proof

Two commands re-print every number on this page.

```bash
npm run build && npm run proof
```

It starts the planted-bug fixture, walks it, and scores the report. Output on 2026-11-17:

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

The fixture holds 21 planted bugs across all 12 classes, plus a clean control page.
The scorer is [sniff-tests/score-fixture.mjs](sniff-tests/score-fixture.mjs).
The bugs are listed in [sniff-tests/planted-bugs/MANIFEST.json](sniff-tests/planted-bugs/MANIFEST.json).

```bash
npm test
```

Prints `Test Files  50 passed (50)` and `Tests  534 passed (534)` on 2026-11-17.
The suite includes the fixture gate. It fails the build if recall drops below 85%.
It also fails on any finding on the clean page.

## FAQ

**Do I need an API key or an account?**
No. The walk and the source scan run on your machine. Nothing is sent anywhere unless you set up the optional AI exploration yourself.

**Will a walk change data in my app?**
It can. A walk clicks buttons and submits real forms, so point it at a dev or staging app.

**Why did it exit 1 when nothing crashed?**
Exit 1 means it found bugs at a failing severity, so CI fails the build. Pass `--fail-on none` to always exit 0.

**Will it edit my code?**
No. Walking and scanning never touch your source. Only `sniff fix` edits files, and only when you run it.

**Can it walk a logged-in app?**
Yes. Pass `--storage-state auth.json`. Cookie and token values from that file are redacted from the written reports.

More answers are in [docs/faq.md](docs/faq.md).

## Limits

- It needs a running app for the walk. Without one you only get the source scan.
- The first walk needs internet to download Chromium once.
- Dead-link checking follows external links, so a walk requests the third-party URLs your pages link to.
- Redaction covers report text, not screenshot pixels. A screenshot of a logged-in page can show private data.
- It finds what a user would see. It does not read your server logs or measure load.

## Learn more

- [docs/editors.md](docs/editors.md): install and MCP snippets for every agent
- [docs/authenticated-walks.md](docs/authenticated-walks.md): walking a logged-in app
- [docs/assert-budgets.md](docs/assert-budgets.md): capping findings by severity in `sniff.config`
- [docs/comparison.md](docs/comparison.md): how sniff differs from linters and E2E frameworks
- [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [LICENSE](LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>
