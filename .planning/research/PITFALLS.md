# Pitfalls Research

**Domain:** AI-powered QA testing CLI tool (test generation, E2E, a11y, visual regression, performance, source scanning)
**Researched:** 2026-04-15
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: AI-Generated Tests That Validate Nothing (Coverage Theater)

**What goes wrong:**
AI generates tests by examining implementation and writing assertions that mirror what the code does rather than what it should do. Tests pass, bugs ship anyway. A documented case: production went down from a null pointer exception on a path that none of the AI-generated tests covered meaningfully, despite 94% code coverage. AI overfits to happy paths -- the least valuable tests because they are the flows most likely to already work. The bugs that matter live in edge cases, error states, race conditions, and cross-system interactions.

**Why it happens:**
LLMs lack intent. They see code and describe what it does, not what it should do. Without domain context or user-specified behavior, generated tests become implementation mirrors: `expect(result).toBeDefined()` instead of `expect(result.total).toBe(42.50)`. Happy paths dominate training data so AI defaults to them.

**How to avoid:**
- Generate scenario descriptions first (what to test), then test code (how to test it). Separate the "what" from the "how" in the generation pipeline.
- Require generated tests to include at least one value-specific assertion per test (not just `.toBeDefined()` or `.toBeTruthy()`).
- Focus generation on user flows and edge cases, not code coverage metrics. Never surface coverage percentages as a quality signal.
- Include a "test quality score" in reports that flags assertion-weak tests (tests with only existence checks, no value assertions).
- Generate chaos/negative scenarios by default: what happens when the form submits empty, the API returns 500, the network drops.

**Warning signs:**
- All generated tests pass on first run with no failures found.
- Tests contain mostly `.toBeDefined()`, `.toBeTruthy()`, `.not.toThrow()` assertions.
- High test count but zero bugs discovered across multiple scans.
- Tests mirror code structure (one test per function) rather than user scenarios.

**Phase to address:**
Phase 1 (AI scenario generator). Bake quality heuristics into the generation prompt and output validation from day one. This is the core differentiator -- getting it wrong means the tool is useless.

---

### Pitfall 2: Hallucinated Selectors and Non-Existent Elements

**What goes wrong:**
AI generates Playwright selectors for elements that do not exist in the actual DOM. Tests reference `#submit-button` when the real element is `button[type="submit"]` with class `.btn-primary`. Tests fail immediately or, worse, silently skip interactions because selectors return null. The problem is especially severe when generating tests without live DOM access.

**Why it happens:**
LLMs guess selectors based on naming conventions in training data. Without access to the actual rendered page, they hallucinate plausible-but-wrong selectors. Framework-specific patterns (React key-based elements, dynamically generated class names from CSS-in-JS) make guessing even less reliable.

**How to avoid:**
- Always generate tests in two passes: (1) crawl/discover actual page elements, (2) generate tests using discovered selectors.
- Use Playwright's built-in locators (`getByRole`, `getByText`, `getByLabel`, `getByTestId`) which are resilient to DOM changes, never raw CSS selectors or XPath from AI output.
- Validate every generated selector against the live DOM before including it in a test. If a selector matches zero elements, drop the test step and log a warning.
- Build an element discovery phase (`sniff scan`) that catalogs real interactive elements per route before test generation begins.

**Warning signs:**
- High percentage of test failures on first run due to `TimeoutError: waiting for selector`.
- Generated tests reference IDs or classes not present in the codebase.
- Tests work on one page but fail after any UI refactor.

**Phase to address:**
Phase 1 (repo analyzer + auto-discovery). The element discovery pipeline must exist before test generation. Without it, every generated test is a guess.

---

### Pitfall 3: Visual Regression False Positive Avalanche

**What goes wrong:**
Pixel-diff visual regression produces so many false positives that developers stop reviewing them within weeks. Sub-pixel rendering differences between macOS/Linux/Windows, anti-aliasing variance across GPU configurations, font metric differences across platforms, and dynamic content (timestamps, avatars, ads) all generate pixel diffs that are not real bugs. The review burden becomes unsustainable and the feature gets disabled.

**Why it happens:**
Default pixel-perfect comparison is fundamentally unsuitable for cross-platform environments. Font rendering varies significantly: Windows, macOS, and Linux all render text differently. Even the same OS with different GPU drivers produces anti-aliasing differences. Dynamic content changes between runs. Without aggressive thresholds and environment standardization, every run produces dozens of meaningless diffs.

**How to avoid:**
- Run visual comparisons exclusively in Docker with fixed font packages. Never compare screenshots taken on different OSes. Vitest includes browser+platform in screenshot names (e.g., `button-chromium-darwin.png`) for this reason.
- Use a similarity threshold of 0.95-0.97 as starting point, not pixel-perfect comparison. Make the threshold configurable per-component.
- Mask dynamic content regions (timestamps, avatars, live data) automatically. Provide a simple API for users to specify mask regions.
- Compare component-level screenshots, not full pages, to reduce noise surface area.
- Generate baseline screenshots in the same environment (CI Docker container) where comparisons will run. Never generate baselines locally and compare in CI.
- Provide clear docs: "Visual regression only works reliably in Docker. Local comparisons are approximate."

**Warning signs:**
- Users report visual tests "always fail" after initial setup.
- GitHub issues pile up asking how to make visual tests pass on their machine.
- Visual regression feature has low adoption despite being prominently featured.

**Phase to address:**
Phase 3 (visual regression). Ship with Docker-only recommendation from day one. Do not promise cross-platform pixel comparison -- it does not work reliably.

---

### Pitfall 4: Playwright Browser Download Bloating Install Time

**What goes wrong:**
`npx sniff` triggers Playwright browser downloads (400MB+ for Chromium alone, 1.5GB+ for all browsers), turning a "try it in 30 seconds" experience into a 5-minute wait. Users abandon before seeing any value. In CI, browser downloads on every run waste minutes and bandwidth. Docker images balloon to 2GB+.

**Why it happens:**
Playwright requires browser binaries that are version-locked to the Playwright npm package. These binaries are not cacheable effectively in CI (Playwright's own docs say caching browsers is not recommended because restore time is comparable to download time). The default `npx playwright install` downloads Chromium, Firefox, and WebKit -- most users only need Chromium.

**How to avoid:**
- Default to Chromium-only on first run. Only download additional browsers when explicitly requested (`sniff init --browsers=all`).
- Detect if Playwright browsers are already installed before downloading. Check `PLAYWRIGHT_BROWSERS_PATH` and standard cache locations.
- Provide clear progress indication during browser download with ETA. Silent downloads feel like hangs.
- For Docker/CI, provide a pre-built Docker image (`ghcr.io/sniff/sniff:latest`) with browsers baked in. Generate CI configs that use this image.
- Set `PLAYWRIGHT_BROWSERS_PATH` to a shared location in CI guidance so browsers persist across runs.
- Never use Alpine as base image -- musl vs glibc causes Chromium incompatibilities. Use Debian/Ubuntu.
- Consider detecting system Chrome/Chromium and using it via `channel: 'chromium'` to skip downloads entirely for local dev.

**Warning signs:**
- `npx sniff` takes more than 60 seconds before showing any useful output.
- Users report "it just hangs" after install.
- CI pipelines add 3+ minutes from sniff-related browser downloads.

**Phase to address:**
Phase 1 (CLI + Playwright setup). The install experience IS the first impression. Optimize browser management before public launch.

---

### Pitfall 5: Prompt Brittleness and Model Version Sensitivity

**What goes wrong:**
Test generation quality degrades silently when the underlying Claude model is updated. Prompts that produce excellent E2E scenarios with one model version produce garbage with the next. Since Sniff depends on Claude Code (which auto-updates), there is no version pinning. Users experience inconsistent results across days/weeks without changing anything.

**Why it happens:**
LLM behavior is non-deterministic and shifts between model versions. Prompts are tuned (consciously or unconsciously) to a specific model's tendencies. Claude Code updates the underlying model without user action. Temperature, system prompt interpretation, and output formatting all shift between versions.

**How to avoid:**
- Design prompts to be structurally constrained: use structured output (JSON schema) rather than free-form text generation. Request specific fields, not prose.
- Include few-shot examples in prompts showing exact expected output format. This anchors behavior across model versions.
- Build a prompt regression test suite: a set of representative codebases with expected scenario outputs. Run this suite against new model versions to detect quality drift.
- When using Anthropic API mode, pin to a specific model version (e.g., `claude-sonnet-4-20250514` not `claude-sonnet-4-latest`).
- Log the model version used for each generation run in the report for debugging.

**Warning signs:**
- Users report "it used to generate good tests, now they're worse" without code changes.
- Inconsistent test counts or scenario types across runs on the same codebase.
- Generated output format changes (JSON keys missing, structure altered).

**Phase to address:**
Phase 1 (AI scenario generator) for prompt design, Phase 4 (CI mode) for model version pinning in API mode. Build prompt regression tests as part of Sniff's own CI.

---

### Pitfall 6: Claude Code Dependency as Single Point of Failure

**What goes wrong:**
Sniff's core differentiator (no API key required, uses Claude Code) becomes its biggest liability. Claude Code may change its CLI interface, rate-limit automated usage, add interactive prompts that break automation, or simply not be installed. Users without Claude Code installed see cryptic errors instead of a clear path forward.

**Why it happens:**
Claude Code is an Anthropic product that Sniff does not control. Its CLI interface is not a stable API -- it is a developer tool that can change behavior between updates. Automated usage patterns (spawning Claude Code as a subprocess) may conflict with Anthropic's intended use or terms of service.

**How to avoid:**
- Implement Claude Code integration as a swappable provider behind an abstraction layer. Day one architecture: `AIProvider` interface with `ClaudeCodeProvider` and `AnthropicAPIProvider` implementations.
- Detect Claude Code availability gracefully at startup. If not found, show a clear message: "Install Claude Code for zero-config usage, or set ANTHROPIC_API_KEY for API mode."
- Never depend on Claude Code's output format being stable. Parse outputs defensively with fallback handling.
- Ship Anthropic API mode as a first-class alternative, not an afterthought. CI/batch usage will always need API mode.
- Monitor Claude Code changelog for breaking changes. Consider integration tests that verify Claude Code compatibility.

**Warning signs:**
- Bug reports spike after a Claude Code update.
- Users report "sniff worked yesterday, broken today" without changing Sniff.
- Claude Code subprocess calls return unexpected output formats.

**Phase to address:**
Phase 1 (core architecture). The provider abstraction must be in the initial architecture. Retrofitting it later means rewriting the generation pipeline.

---

### Pitfall 7: MCP Server Security and Stateful Session Pitfalls

**What goes wrong:**
MCP servers exposed without authentication allow anyone to access tool listings and exfiltrate data. Research in July 2025 found nearly 2,000 MCP servers exposed with zero authentication. Stateful sessions fight with load balancers, horizontal scaling requires workarounds, and there is no standard way for a registry to discover server capabilities without connecting. Additionally, Anthropic's own reference SQLite MCP implementation contained a SQL injection flaw -- even official examples get security wrong.

**Why it happens:**
MCP is a young protocol (2024-2025) with immature security practices. The specification prioritized developer experience over security initially. Tool-calling without proper input sanitization creates injection vectors. The MCP Inspector proxy itself had a critical RCE vulnerability (listening on 0.0.0.0 with no auth).

**How to avoid:**
- Sniff's MCP server should be local-only by default (stdio transport, not HTTP). Never expose on 0.0.0.0.
- Sanitize all inputs from MCP tool calls. Never pass user-provided values directly to shell commands or file system operations.
- Scope MCP tools narrowly: expose `sniff.scan`, `sniff.report`, `sniff.runTest` -- not arbitrary file access or command execution.
- If HTTP transport is needed later, implement OAuth with proper scopes from the start. Do not bolt on auth after launch.
- Use Streamable HTTP transport (not legacy HTTP+SSE) for any remote deployment -- SSE prevents serverless scaling.

**Warning signs:**
- MCP server accepts file paths or commands from tool inputs without validation.
- Server listens on network interfaces beyond localhost.
- No input validation tests in MCP server test suite.

**Phase to address:**
Phase 5 (MCP server). Keep it simple (stdio only) at launch. HTTP transport with auth is a post-launch feature if needed.

---

### Pitfall 8: Slow CLI Startup Killing Developer Experience

**What goes wrong:**
`sniff scan` takes 3-5 seconds before showing any output because Node.js loads hundreds of modules at startup. TypeScript transpilation adds overhead. Importing Playwright, axe-core, and AI libraries eagerly makes every command pay the cost of the heaviest dependency. Users perceive the tool as slow before it does any actual work.

**Why it happens:**
Node.js CommonJS requires synchronous, eager loading. Deep dependency trees (Playwright alone has significant transitive dependencies) cause filesystem thrashing. TypeScript compilation at runtime (ts-node/tsx) adds transpilation overhead. npm's own CLI startup takes 800ms+ compared to alternatives.

**How to avoid:**
- Compile TypeScript to JavaScript at publish time (use `tsup` or `esbuild`). Never ship TypeScript that gets transpiled at runtime.
- Lazy-load heavy dependencies. Playwright, axe-core, and AI modules should only load when their specific command runs. `sniff --help` and `sniff --version` must return in under 200ms.
- Use a CLI framework that supports lazy command loading (Commander.js with lazy action imports, or oclif).
- Show a spinner or progress bar immediately, before heavy imports begin. Perceived performance matters as much as actual performance.
- Profile startup time in CI. Set a budget: `sniff --version` must complete in under 300ms. Fail the build if it exceeds this.
- Consider shipping as a single bundled file to eliminate module resolution overhead.

**Warning signs:**
- `time sniff --version` takes more than 500ms.
- Users compare unfavorably to Vitest or Biome startup times.
- Import of Playwright happens at module load time rather than command execution time.

**Phase to address:**
Phase 1 (CLI scaffold). Lazy loading architecture must be established from the start. Retrofitting lazy imports into an eager-loading codebase is painful.

---

### Pitfall 9: Playwright Browser Memory Exhaustion in Large Scans

**What goes wrong:**
Scanning 50+ routes with Playwright browsers open exhausts available memory. Each browser context consumes 100-300MB. Running multiple viewports multiplies this. Unoptimized implementations consume 40% more memory than necessary. In CI environments with 4-8GB RAM, the scan crashes partway through with no useful output.

**Why it happens:**
Playwright browser contexts accumulate memory from page loads, JavaScript execution, and cached resources. Keeping contexts alive across multiple page navigations compounds the leak. Running all three browsers (Chromium, WebKit, Firefox) simultaneously triples memory. Playwright 1.57+ switched from lightweight Chromium to Chrome for Testing, dramatically increasing per-instance memory (20GB+ reported in some cases).

**How to avoid:**
- Close and recreate browser contexts between route scans. Never reuse a single context for the entire scan.
- Run browsers sequentially, not in parallel, by default. Offer `--parallel` flag for CI environments with sufficient memory.
- Default to single-browser (Chromium) scanning. Multi-browser is opt-in via `--browsers=all`.
- Monitor memory usage during scans. If approaching a threshold (configurable, default 80% of available), pause scanning, close browsers, garbage collect, then resume.
- Set `PLAYWRIGHT_CHROMIUM_USE_HEADLESS_NEW=1` and configure minimal resource caching in browser contexts.
- Pin Playwright version carefully. Test memory impact of each Playwright upgrade before bumping.
- Provide a `--max-memory` flag that limits concurrent operations based on available RAM.

**Warning signs:**
- Scans crash on repos with 30+ routes without clear error messages.
- Memory usage climbs linearly during scans without dropping.
- CI runners OOM-kill the process during multi-browser scans.

**Phase to address:**
Phase 2 (test runner + Playwright integration). Build memory management into the scan orchestrator from the start. Test with a 50-route repo as the benchmark.

---

### Pitfall 10: Open Source Launch Without Community Infrastructure

**What goes wrong:**
Project launches with code but no CONTRIBUTING.md, no issue templates, no CI badges, no demo GIF, and no clear "why should I use this" in the README. First visitors (who are potential contributors and evangelists) bounce because the project looks incomplete or abandoned. Without a license, contributions are legally unusable. Without CI, PRs cannot be validated.

**Why it happens:**
Developers focus on code and defer community infrastructure as "later" tasks. The README describes what the tool does technically but not why anyone should care. No demo means potential users cannot evaluate the tool without installing it. Missing CONTRIBUTING.md signals "we don't want contributions."

**How to avoid:**
- Launch checklist (all must be complete before v0.1.0 announcement):
  - [ ] Apache 2.0 LICENSE file with NOTICE for attribution
  - [ ] README with: problem statement (why), 30-second GIF demo, `npx sniff` quickstart, feature matrix
  - [ ] CONTRIBUTING.md with: setup instructions, PR process, code style requirements
  - [ ] GitHub issue templates: bug report, feature request
  - [ ] CI pipeline (GitHub Actions): lint, test, build on every PR
  - [ ] Release automation: semantic versioning, automated npm publish, changelog generation
  - [ ] Code of Conduct (Contributor Covenant)
- Study what worked for successful launches:
  - **Vitest**: Rode the Vite ecosystem wave, Jest-compatible API lowered switching cost
  - **Biome**: Learned from Rome's failure -- focused on pragmatic scope, not everything at once
  - **Bun**: Performance benchmarks as launch content, "try it and see the speed" demo
  - **tRPC**: Solved one specific pain point perfectly (type-safe APIs without codegen)
- For Sniff: the launch narrative should be "one command finds bugs you didn't know existed" with a real demo on a real (messy) codebase, not a toy example.

**Warning signs:**
- First GitHub stars come but no issues or PRs follow.
- README has no GIF/video showing the tool in action.
- Visitors ask questions that are answered by docs that do not exist.

**Phase to address:**
Phase 6 (launch prep). But start the README and CONTRIBUTING.md in Phase 1 and iterate throughout. The demo GIF requires a working tool, so it comes last.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded prompts in source code | Fast iteration on prompt quality | Cannot A/B test, users cannot customize, prompt changes require new releases | MVP only -- extract to config files by Phase 2 |
| Synchronous browser operations | Simpler code, easier debugging | Scans take 3-5x longer than necessary on multi-core machines | Never after Phase 2 |
| Single output format (HTML report) | Ship faster | Users need JSON for CI integration, Markdown for PRs, SARIF for GitHub Security tab | MVP can ship HTML-only, add JSON/SARIF in Phase 3 |
| No test quarantine system | Simpler test runner | Flaky tests pollute results, users lose trust in scan output | Acceptable until Phase 3, but track flaky test rate from Phase 2 |
| Bundling all scan types in one command | Simpler CLI surface | Users cannot run just a11y or just visual regression without full scan overhead | Never -- `sniff scan --type=a11y` should work from Phase 1 |
| Skipping element discovery, generating blind | Faster generation pipeline | Hallucinated selectors, worthless tests, user frustration | Never -- discovery before generation is non-negotiable |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Playwright browsers | Running as root in Docker, disabling sandbox | Use official Playwright Docker images with non-root user, or configure `--no-sandbox` only in CI with security awareness |
| Playwright in Alpine Linux | Using Alpine for smaller images | Avoid Alpine entirely -- musl vs glibc breaks Chromium. Use `mcr.microsoft.com/playwright` or Debian-based images |
| axe-core | Running accessibility scan on page before it finishes loading | Wait for network idle + DOM stable before running `axe.run()`. Use Playwright's `waitForLoadState('networkidle')` |
| Claude Code subprocess | Parsing stdout as structured data | Claude Code output format is not stable. Use `--output-format json` if available, or use Anthropic API for structured output needs |
| Pixel diff libraries | Using default sensitivity settings | Tune threshold to 0.95-0.97 similarity. Provide per-component threshold overrides. Document that pixel-perfect is not achievable cross-platform |
| GitHub Actions | Not caching Playwright browsers | Playwright docs say caching is not recommended (restore time equals download time). Instead, use the official Playwright Docker action or container |
| Lighthouse/performance | Running perf tests alongside functional tests | Performance tests need isolated environments. Run perf scans in a separate phase after functional scans complete, with browser cache cleared |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Eager loading all dependencies at CLI startup | `sniff --help` takes 2+ seconds | Lazy-load Playwright, axe-core, AI modules per command | Immediately noticeable with any dependency growth |
| Keeping browser contexts alive across routes | Memory climbs to 4GB+ during large scans | Close/recreate context per route, or per batch of 5-10 routes | At 20+ routes on a 4GB CI runner |
| Scanning all files for repo analysis | 30+ second analysis phase on monorepos | Respect `.gitignore`, limit depth, use fast glob with `ignore` patterns, skip `node_modules`/`dist`/`.next` | At 10,000+ files or monorepo with multiple apps |
| Full-page screenshots for visual regression | 50MB+ screenshot files, slow comparison, memory spikes | Capture viewport-sized screenshots, not full-page. Compress to WebP before comparison | At 20+ routes with 3 viewports each |
| Spawning new browser per test instead of per context | 5+ seconds per test for browser launch | Reuse browser instance, create fresh contexts. One browser launch per scan, many contexts | At 10+ tests -- users will notice the per-test overhead |
| Synchronous AI calls for each route | Scan time scales linearly with route count | Batch routes into a single prompt context when possible, or parallelize API calls with concurrency limits | At 10+ routes, scan exceeds 5-minute budget |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP server listening on 0.0.0.0 | Remote code execution, data exfiltration (2,000 servers found exposed in 2025) | Default to stdio transport. If HTTP needed, bind to 127.0.0.1 only. Require explicit `--host 0.0.0.0` flag |
| Passing AI-generated commands to shell | Prompt injection leads to arbitrary command execution on user machine | Never `exec()` AI output. AI generates test code only, which runs in Playwright's sandboxed browser context |
| Storing API keys in config files | Keys committed to git, leaked in error reports | Use environment variables only. Never write keys to `sniff.config.js`. Redact keys in error output |
| MCP tool inputs passed unsanitized | Path traversal, command injection via tool parameters | Validate and sanitize all MCP tool inputs. Restrict file operations to project directory. Use allowlists for paths |
| Generated test code with `eval()` or dynamic requires | Arbitrary code execution via malicious AI output | Use Playwright's test runner to execute generated code in isolation. Never `eval()` generated strings. Write to `.ts` files and execute via Playwright CLI |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No progress indication during scan | User thinks tool is hung, Ctrl+C and abandons | Show real-time progress: "Scanning route 3/47: /dashboard (a11y check...)" with elapsed time |
| Error messages showing stack traces | Non-expert users cannot diagnose or report issues | Show human-readable error + suggestion. Log stack trace to `.sniff/debug.log` for bug reports |
| Too many config options at init | Decision paralysis, user picks wrong defaults | `sniff init` with zero questions by default (auto-detect framework, routes, viewports). `sniff init --advanced` for power users |
| Report shows 200+ issues with no prioritization | Overwhelming, user does not know where to start | Severity scoring (critical/high/medium/low), group by page, show top 5 "fix these first" items at the top |
| Requiring global install | Conflicts with other projects, version management pain | `npx sniff` must work. Never require global install. Provide `npx sniff init` for project-local setup |
| No demo on real-world messy code | Users do not believe it works on real projects | Launch demo must run on a real open-source app (e.g., a Next.js starter with actual bugs) not a toy example |

## "Looks Done But Isn't" Checklist

- [ ] **CLI help text:** Often missing examples for each command -- verify every command has a usage example in `--help`
- [ ] **Error handling:** Often missing graceful handling when target app is not running -- verify `sniff scan` gives clear error if localhost:3000 is down
- [ ] **Report generation:** Often missing when scan partially fails -- verify report generates even when some routes fail, showing partial results
- [ ] **Browser cleanup:** Often missing process cleanup on Ctrl+C -- verify SIGINT handler closes all browser processes
- [ ] **Config file:** Often missing validation -- verify `sniff.config.js` with invalid values gives helpful error, not a crash
- [ ] **CI mode:** Often missing non-zero exit codes on failures -- verify `sniff scan --ci` returns exit code 1 when critical issues found
- [ ] **Visual regression:** Often missing baseline management -- verify `sniff update-baselines` command exists and works
- [ ] **Multi-framework support:** Often missing framework auto-detection -- verify detection works for Next.js, Vite, CRA, Remix, Astro, and plain HTML

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Coverage theater (useless tests) | MEDIUM | Add test quality scoring to report output, retroactively filter low-quality tests, adjust generation prompts |
| Hallucinated selectors | LOW | Add selector validation pass, re-run discovery, regenerate tests with real selectors |
| Visual regression false positives | MEDIUM | Switch to Docker-only comparison, reset all baselines, adjust thresholds, add masking regions |
| Browser download bloat | LOW | Add browser detection logic, provide Docker image, update install docs |
| Prompt brittleness | HIGH | Build prompt regression test suite, switch to structured output, add few-shot examples -- requires prompt engineering rework |
| Claude Code breaking changes | MEDIUM | Activate API mode fallback, update Claude Code integration layer, add version detection |
| MCP security exposure | HIGH | Audit all tool inputs, switch to stdio, add input validation -- if data was exposed, incident response needed |
| Slow CLI startup | MEDIUM | Profile imports, add lazy loading, bundle with esbuild -- requires architectural refactoring if not done from start |
| Memory exhaustion | MEDIUM | Add context recycling, sequential browser mode, memory monitoring -- requires scan orchestrator changes |
| Missing community infrastructure | LOW | Create CONTRIBUTING.md, issue templates, CI pipeline, demo GIF -- straightforward but time-consuming |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Coverage theater | Phase 1 (AI generator) | Generated tests have value-specific assertions, test quality score included in reports |
| Hallucinated selectors | Phase 1 (repo analyzer) | Element discovery runs before generation, selector validation pass exists |
| Visual regression false positives | Phase 3 (visual regression) | Docker-based comparison documented, threshold configurable, CI runs produce zero false positives |
| Browser download bloat | Phase 1 (CLI + Playwright) | `time npx sniff --version` < 30s including browser check, Chromium-only by default |
| Prompt brittleness | Phase 1 (AI generator) + Phase 4 (CI) | Structured output schema exists, prompt regression tests in CI, model version logged |
| Claude Code dependency | Phase 1 (architecture) | AIProvider interface with two implementations, graceful fallback message when Claude Code missing |
| MCP security | Phase 5 (MCP server) | Stdio-only transport, input validation tests, no network exposure by default |
| Slow CLI startup | Phase 1 (CLI scaffold) | `sniff --version` completes in < 300ms, lazy loading verified in CI |
| Memory exhaustion | Phase 2 (test runner) | 50-route scan completes in < 8GB RAM, context recycling implemented |
| Missing community infra | Phase 6 (launch prep) | All launch checklist items complete before v0.1.0 announcement |

## Sources

- [AI-Generated Tests Give False Confidence](https://codeintelligently.com/blog/ai-generated-tests-false-confidence) -- coverage theater, assertion quality
- [AI Testing Tools: What Works, What Doesn't](https://bug0.com/blog/ai-testing-tools) -- hallucinated selectors, real-world failures
- [Playwright Docker Guide](https://playwright.dev/docs/docker) -- browser management, Alpine incompatibility
- [Playwright CI Guide](https://playwright.dev/docs/ci) -- browser caching, CI configuration
- [Visual Regression Testing Best Practices](https://medium.com/@ss-tech/the-ui-visual-regression-testing-best-practices-playbook-dc27db61ebe0) -- false positives, thresholds
- [Visual Regression Production Hardening](https://www.desplega.ai/blog/deep-dive-3-visual-regression-testing-production-hardening) -- cross-platform rendering
- [MCP Security Survival Guide](https://towardsdatascience.com/the-mcp-security-survival-guide-best-practices-pitfalls-and-real-world-lessons/) -- MCP security pitfalls
- [MCP Implementation Tips and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) -- transport, sessions
- [Six Fatal Flaws of MCP](https://www.scalifiai.com/blog/model-context-protocol-flaws-2025) -- auth, scaling
- [Playwright MCP 2.0 Memory Leak Fixes](https://markaicode.com/playwright-mcp-memory-leak-fixes-2025/) -- memory management, context lifecycle
- [Playwright Memory Issues #15400](https://github.com/microsoft/playwright/issues/15400) -- browser context memory
- [Playwright Chrome for Testing Memory #38489](https://github.com/microsoft/playwright/issues/38489) -- 20GB+ memory per instance
- [Node.js Loader Performance](https://blog.appsignal.com/2025/10/22/ways-to-improve-nodejs-loader-performance.html) -- startup optimization
- [Open Source Launch Guides](https://opensource.guide/) -- community infrastructure, licensing
- [AI Testing Fails 2025](https://www.testlio.com/blog/ai-testing-fails-2025) -- real-world AI testing failures

---
*Pitfalls research for: AI-powered QA testing CLI tool*
*Researched: 2026-04-15*
