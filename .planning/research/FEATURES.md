# Feature Landscape

**Domain:** AI-powered autonomous QA testing framework (CLI)
**Researched:** 2026-04-15

## Table Stakes

Features users expect from any modern testing CLI. Missing any of these and users will not adopt.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Zero-config startup (`npx sniff`) | Every modern CLI tool works out of the box. Developers abandon tools that require 10 minutes of setup | Low | Must detect framework, routes, and base URL automatically |
| E2E browser tests (Chromium at minimum) | Playwright/Cypress set this expectation. No testing tool ships without browser automation | Medium | Playwright already handles this; Sniff wraps it |
| Meaningful failure reports with screenshots | Playwright, Cypress, mabl all capture screenshots on failure. Users expect visual proof of what broke | Medium | Screenshots + DOM snapshot + console errors at point of failure |
| CI integration (GitHub Actions at minimum) | Every testing tool documents CI setup. Checkly, Playwright, mabl all have first-class CI support | Medium | Generate `.github/workflows/sniff.yml` with `sniff ci` command |
| JUnit XML / JSON output | Universal test result exchange format. GitHub Actions, Jenkins, GitLab CI all parse JUnit XML natively | Low | Required for CI reporter integrations like dorny/test-reporter |
| Exit codes (0 = pass, non-zero = fail) | Every CLI tool. CI pipelines depend on exit codes to gate deployments | Trivial | Non-negotiable |
| Configurable severity thresholds | Users need to control what blocks a build vs what's a warning. mabl, Checkly, axe-core all support this | Low | `--fail-on critical,high` flag pattern |
| Accessibility scanning (WCAG 2.1 AA) | axe-core made this table stakes. Regulatory pressure (ADA, EAA 2025) means teams must test a11y | Medium | Integrate axe-core via @axe-core/playwright. Well-documented path |
| Console error detection | Basic quality signal. Developers expect their testing tool to catch uncaught exceptions and console.error | Low | Listen to Playwright page `console` and `pageerror` events |
| Network error monitoring (4xx, 5xx) | Broken API calls and missing assets are bugs. Every browser devtools shows these; testing tools should too | Low | Intercept via Playwright route/response events |
| Multi-viewport testing (desktop + mobile) | Playwright projects support this natively. Users expect responsive testing without manual config | Low | Default viewports: 1280x720, 375x667 (iPhone SE), 768x1024 (tablet) |
| Colored, structured terminal output | Modern CLIs (Vitest, ESLint, Prettier) all use color-coded output. Plain text feels broken | Low | Use chalk/picocolors. Severity-based coloring (red/yellow/green) |
| `--help` and `--version` flags | CLI convention. Missing these signals amateur tooling | Trivial | Use commander or yargs |
| Watch mode for local dev | Vitest popularized instant feedback. Developers expect `--watch` for iterative testing | Medium | Watch source files, re-run affected tests on change |

## Differentiators

Features that set Sniff apart from the competition. Not expected, but create "wow" moments and competitive moats.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Zero-test-writing AI generation** | No competitor offers fully autonomous test generation from codebase analysis alone. mabl requires a dashboard, Testim requires recording, Functionize requires a web UI. Sniff reads your code and generates tests with no human input | High | Core differentiator. Claude Code (no API key) generates scenarios from route/component analysis. This is the "one command" promise |
| **No API key required (Claude Code default)** | Every AI testing tool (mabl, Stagehand, Browser Use, Skyvern) requires paid API keys or subscriptions. Sniff works if you have Claude Code installed -- zero cost, zero signup | Medium | Use Claude Code CLI as subprocess. Fall back to Anthropic API for CI/headless. Unique in the market |
| **Multi-dimensional scanning in one command** | Competitors are siloed: axe-core = a11y only, Percy = visual only, Checkly = monitoring only, Lighthouse = perf only. Sniff runs E2E + a11y + visual + perf + source scanning in a single `sniff run` | High | The "5 tools in 1" pitch. Each dimension is a plugin but orchestrated together |
| **Source code text scanning** | No testing tool scans source for lorem ipsum, TODO, placeholder text, hardcoded secrets, or debug statements. This catches embarrassing production deploys that E2E tests miss | Medium | AST-light: regex + glob scan. Fast, no browser needed. Catches "Lorem ipsum" on production landing pages |
| **AI-driven chaos monkey exploration** | mabl's "Agentic Tester" is the closest competitor but requires their paid platform. Sniff's exploration mode lets AI autonomously navigate your app, clicking random paths, filling forms with edge-case data, finding crashes no scripted test would hit | High | Agent mode: AI decides what to click, what data to enter. Reports unexpected errors, crashes, visual anomalies. "Supervised autonomy" -- AI explores, human reviews |
| **Brutal honesty reporting** | Testing tools are diplomatic. Sniff should be opinionated and direct: "Your signup form has 3 critical a11y violations, 2 broken API calls, and lorem ipsum in the footer. Fix these before you ship." Personality as brand | Medium | Tone and copy in report templates. Severity scoring with no sugar-coating. This is a marketing differentiator as much as a feature |
| **Local-only visual regression (no vendor)** | Percy costs $199+/mo. Applitools is enterprise-priced. Sniff does pixel-diff locally using pixelmatch/odiff -- free, no cloud dependency, no vendor lock-in | Medium | Use odiff (fast, Rust-based) or pixelmatch. Store baselines in `.sniff/baselines/`. Git-friendly |
| **MCP server for AI agent integration** | Playwright MCP exists but doesn't do autonomous QA. Sniff as MCP server lets Cursor, Windsurf, Claude Desktop, and any MCP client trigger test runs, read reports, and fix bugs in a loop | High | Unique distribution channel. No testing tool offers MCP-native integration today |
| **Auto-generated fix suggestions** | mabl provides "failure summaries" but not fix code. Sniff should output "Here's what broke and here's a diff to fix it" -- leveraging AI to turn test failures into actionable patches | High | AI analyzes failure context (DOM, screenshot, console error) and generates a suggested fix. Game-changer for DX |
| **Flakiness detection with auto-quarantine** | Trunk.io charges for this. Datadog charges for this. Sniff tracks test stability across runs locally, flags flaky tests, and auto-quarantines them so they don't block CI | Medium | Track pass/fail history in `.sniff/history.json`. Flag tests that flip. Quarantine = run but don't fail pipeline |
| **Performance budgets (Lighthouse + Web Vitals)** | Lighthouse CLI exists but isn't integrated with E2E. Sniff runs perf checks alongside functional tests, catching "the page works but takes 8 seconds to load" | Medium | Lighthouse Node API or web-vitals extraction during Playwright runs. Set budgets in config |
| **Claude Code plugin (one-line install)** | No testing tool integrates as a Claude Code plugin. This puts Sniff in the workflow of every Claude Code user | Medium | `/install-sniff` installs and configures. Tests run inside Claude Code sessions |

## Anti-Features

Things testing tools do that annoy users. Sniff should deliberately NOT build these.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Web dashboard requirement** | mabl, Functionize, Testim all force you into a browser dashboard to create/view tests. Developers live in terminals and IDEs, not dashboards. Dashboards create context-switching friction | CLI-first with HTML report files. Open in browser when needed, but never require it for core workflows |
| **Proprietary test format / vendor lock-in** | Testim, mabl, Functionize use proprietary formats. If you leave, you lose everything. Developers hate this. The #1 complaint in automation tool reviews | Generate standard Playwright test files. Users can eject and run tests without Sniff. Tests are just `.spec.ts` files |
| **Mandatory cloud/SaaS dependency** | Stagehand needs BrowserBase for production. Percy needs BrowserStack cloud. Skyvern is cloud-hosted. Developers want tools that work offline, on planes, behind firewalls | Everything runs locally. Cloud is optional enhancement, never a requirement |
| **Account/signup required to use** | Every SaaS testing tool requires an account. This is the highest friction point for OSS adoption. `npx sniff` should just work | No account, no signup, no telemetry by default. Respect developer trust |
| **"Plain English" test writing that breaks on complexity** | Functionize, testRigor, and other "no-code" tools promise plain English but fall apart for complex conditional flows. Developers end up fighting the abstraction | AI generates real TypeScript/Playwright code. When users need to customize, they edit real code, not pseudo-English |
| **Slow startup / heavy install** | Large dependency trees and slow boot times kill adoption. If `npx sniff` takes 60 seconds to start, users leave | Minimize dependencies. Lazy-load heavy modules (Playwright, axe-core). Target <5 second cold start for `sniff scan` |
| **Noisy false positives** | Applitools and pixel-diff tools are notorious for flagging irrelevant changes (anti-aliasing, font rendering). This erodes trust faster than missing bugs | Smart diff thresholds. Ignore sub-pixel differences. Let users set tolerance. Default to "only flag obvious visual regressions" |
| **Opaque AI decisions** | AI tools that say "test failed" without explaining why the AI did what it did. Users distrust black boxes | Show AI reasoning: "I clicked the signup button because it matched the route /signup. The form submission returned a 500 error." Trace every AI decision |
| **Excessive configuration upfront** | Tools that require 20 lines of YAML before your first test run. jest, vitest, and Playwright all work with zero config. Sniff must too | Sensible defaults. Config file is optional. `sniff init` generates one if wanted, but `sniff run` works without it |
| **Telemetry/analytics without consent** | Multiple npm packages have been called out for silent telemetry. This destroys OSS trust instantly | No telemetry by default. If added later, opt-in only with clear disclosure. Respect is a feature |
| **Recording mode as primary workflow** | Selenium IDE, Testim's recorder, Cypress Studio -- record-and-replay is fragile and produces unmaintainable tests. It feels magical initially but creates tech debt | AI-generated tests from code analysis, not from recording user sessions. Tests should be deterministic and reviewable |

## Feature Dependencies

```
Repo Analyzer (route/component discovery)
  --> AI Scenario Generator (needs routes + components to generate tests)
    --> E2E Test Runner (needs generated test files to execute)
      --> Failure Reporter (needs test results to report)
        --> Fix Suggestions (needs failure context to generate patches)

Repo Analyzer
  --> Source Code Scanner (needs file list and AST info)

E2E Test Runner
  --> Console Error Monitor (runs during test execution)
  --> Network Error Monitor (runs during test execution)
  --> Screenshot Capture (triggers on failure)
  --> Accessibility Scanner (runs axe-core during page visits)
  --> Visual Regression (captures and compares screenshots)
  --> Performance Budgets (measures during page loads)

Flakiness Detection
  --> E2E Test Runner (needs historical run data)
  --> CI Mode (quarantine behavior matters most in CI)

AI Chaos Monkey
  --> Repo Analyzer (needs route map for exploration)
  --> E2E Test Runner (uses Playwright for browser control)
  --> AI Scenario Generator (uses same AI for decision-making)

CI Mode
  --> JUnit XML Output (CI systems parse this)
  --> GitHub Actions Generator (convenience for most common CI)
  --> Exit Codes (pipeline gating)

MCP Server
  --> E2E Test Runner (exposes test-running as tools)
  --> Failure Reporter (exposes report-reading as tools)
  --> Fix Suggestions (enables AI-in-the-loop fixing)

Claude Code Plugin
  --> MCP Server (plugin uses MCP protocol)
```

## MVP Recommendation

**Prioritize (Phase 1 -- must ship for credibility):**

1. **Repo Analyzer** -- discover routes, components, forms, links from source code. This is the foundation everything else depends on. Without it, Sniff is just another Playwright wrapper.

2. **AI Scenario Generator** -- turn discovered routes/components into Playwright test scenarios. This is the "no test writing" promise. Ship this or there's no product.

3. **E2E Test Runner with failure capture** -- run generated tests, capture screenshots on failure, log console errors and network failures. This is the minimum viable test execution.

4. **Source Code Scanner** -- scan for lorem ipsum, TODO, placeholder text, hardcoded strings. Fast to build (regex), high-impact ("you have lorem ipsum on your production landing page"), and no browser required. Cheap differentiator.

5. **HTML Report with severity scoring** -- render results as a single HTML file with red/yellow/green severity. The "brutal honesty" tone starts here.

6. **CLI interface** -- `sniff init`, `sniff scan` (source scan only), `sniff run` (full test run), `sniff report` (view last report). Clean, fast, colored output.

**Defer to Phase 2:**

- **Accessibility scanning (axe-core)** -- important but adds complexity to Phase 1. Well-understood integration path via @axe-core/playwright.
- **Visual regression (pixel diff)** -- needs baseline management UX. Defer until core E2E is solid.
- **CI mode + GitHub Actions generator** -- users need local-first experience before CI. Ship CI in Phase 2 when early adopters ask for it.
- **Flakiness detection** -- needs multiple run history. Can't detect flakiness until people are running tests regularly.

**Defer to Phase 3:**

- **Performance budgets (Lighthouse)** -- specialized, additive. Not core to the "find bugs" promise.
- **AI Chaos Monkey exploration** -- highest risk, highest reward. Needs solid E2E foundation first.
- **MCP server** -- distribution channel, not core product. Ship when the core is proven.
- **Fix suggestions** -- requires sophisticated AI context (DOM + screenshot + error + source). Build on top of mature failure reporting.

**Defer to Phase 4+:**

- **Claude Code plugin** -- depends on MCP server. Distribution optimization, not core.
- **Watch mode** -- nice DX improvement but not launch-critical.
- **Multi-browser (WebKit, Firefox)** -- Chromium covers 90% of users. Add browsers when asked.

## Sources

- [mabl AI capabilities](https://www.mabl.com/breakthrough-agentic-ai-capabilities-redefining-software-quality)
- [Stagehand v3 features](https://www.browserbase.com/blog/stagehand-v3)
- [Browser Use](https://browser-use.com/)
- [Skyvern browser automation](https://www.skyvern.com/)
- [Testim self-healing](https://www.testim.io/blog/ai-and-quality-assurance-self-healing-processes-to-improve-engineer-experience/)
- [Applitools Eyes + Autonomous](https://applitools.com/blog/applitools-autonomous-eyes-ai-testing-updates/)
- [Checkly CLI](https://www.checklyhq.com/docs/cli/overview/)
- [Playwright MCP](https://www.testleaf.com/blog/playwright-mcp-ai-test-automation-2026/)
- [Functionize platform](https://www.functionize.com/product)
- [Percy visual testing](https://percy.io/blog/visual-regression-testing-tools)
- [LaVague QA automation](https://docs.lavague.ai/en/latest/docs/lavague-qa/quick-tour/)
- [Flaky test detection tools 2026](https://testdino.com/blog/flaky-test-detection-tools/)
- [Trunk.io flaky test quarantine](https://trunk.io/flaky-tests)
- [Test automation pain points](https://dev.to/satya_prakash/test-automation-challenges-you-cant-ignore-in-2025-2c8k)
- [axe-core accessibility engine](https://github.com/dequelabs/axe-core)
- [2026 Guide to AI-Powered Test Automation](https://dev.to/matt_calder_e620d84cf0c14/the-2026-guide-to-ai-powered-test-automation-tools-5f24)
- [MonkeyTest AI autonomous testing](https://monkeytest.ai/)
- [GitHub Actions test reporting](https://www.testmo.com/guides/github-actions-test-automation/)
