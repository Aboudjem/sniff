# 03 — Developer-Experience / CLI-UX Audit (sniff v0.5.2)

**Scope:** The CURRENTLY SHIPPED behavior (v0.5.2) — the experience real testers had. This is the RED baseline for DX. Out of scope: the in-progress engine under `src/crawl/`.

**Method:** Static reading of the shipped CLI + config code, plus live reproduction against the built `dist/` artifact (`dist/cli/index.js`, version confirmed `0.5.2` via `package.json`). Crash and behavior claims below were reproduced empirically, not inferred. Temporary instrumentation of `dist/` was applied and fully reverted (verified: zero `DEBUG` lines remain).

**Headline:** The promise is "one command walks your real user flows and reports broken things with proof." The shipped reality is: the default command runs a **regex source scan**; the flow-walker is gated behind `--discover`; and the documented entry point for it — the `sniff discover` subcommand — **silently swallows `--url` and crashes with "No URL available", exit 1, zero useful output**. The two facts together mean a newcomer following the obvious path never reaches the impressive feature at all.

---

## Friction Log — install → first useful result

Timestamps are elapsed wall-clock for a first-time user on a fresh machine following the README literally. T0 = decision to try sniff.

| T+ | Step | What the user does | What happens | Friction |
|----|------|--------------------|--------------|----------|
| 0:00 | Read README | Sees "`npx sniff-qa` — that's the whole setup" (README.md:39-43) and "walks your real user flows" pitch | Forms expectation: autonomous flow-walking out of the box | Expectation mismatch seeded here |
| 0:10 | `npx sniff-qa` (no dev server) | Runs in project dir | `[source] Scanning source code...` → `0 issues` → `No issues found.` exit 0 (reproduced) | **No hint** that this was only a regex source scan, that browser/flow testing exists, or that a dev server was looked for and not found. User concludes "sniff found nothing / doesn't work." |
| 0:10 | `npx sniff-qa` (with planted bugs) | Same | Finds `debugger`, `lorem ipsum`, `TODO`, `console.log` (reproduced) | The "autonomous QA bot" delivers a linter result. No flow-walking, no proof, no screenshots. Underwhelming vs pitch. |
| 0:30 | Start dev server, `npx sniff-qa` | Hopes for the flow-walker | If a dev server is detected, runs a11y/visual/perf **page audit** — still NOT the flow-walker. Flow-walking requires `--discover` (index.ts:58, 114-135). | The marquee feature is invisible unless you read deep into `--help` (28 options) and find `--discover`. |
| 0:35 | `npx sniff-qa --url http://localhost:3000` first browser run | Triggers `ensurePlaywrightBrowsers` | **~165 MB Chromium download** begins inline (ensure-browsers.ts:16, 79). 30-60s+ wait with `npx playwright install` stdio. | First-run surprise: a "30-second setup" tool downloads 165 MB. README mentions it only in a collapsed aside (README.md:75). |
| 0:40 | Find `discover` in help, run `sniff discover --url http://localhost:3000` | The documented way to invoke the flow-walker | **CRASH:** prints `No URL available. Pass --url <url> or start your dev server.` and exits 1 — *despite passing `--url`* (reproduced twice). | **Showstopper.** The one feature that justifies the product is unreachable via its own named subcommand. |
| 0:45 | User retries with variations | `sniff discover --url=... `, different order, etc. | Same crash regardless of `--url` form (root cause is argument routing, not URL syntax) | Dead end. A reasonable tester gives up here. This is the "couldn't make it find many useful issues" complaint, fully explained. |

**Time-to-first-useful-result:** For source-scan output: ~10s (but it is a linter, not the advertised product). For the advertised flow-walker via the documented `discover` subcommand: **never** — it crashes. The only working route to the flow-walker is the undocumented-in-quickstart `--discover` *flag on the default command* (e.g. `sniff --discover --url ...`), which a newcomer is very unlikely to discover.

---

## Ranked Findings

### F1 — `sniff discover --url <url>` crashes with "No URL available" (the flag value is silently dropped)
**Severity: CRITICAL · Confidence: CONFIRMED (reproduced)**

Evidence:
- `src/cli/index.ts:183-243` registers a `discover` **subcommand** with its own `--url` option (line 186) and passes `url: options.url` into `discoverCommand` (line 221).
- `src/cli/commands/discover.ts:169-189`: when `options.url` is falsy, the resolver falls through to `console.error('No URL available...')` and returns `exitCode: 1` (line 187-188).
- Reproduced: `node dist/cli/index.js discover --url http://localhost:9999 --non-interactive` → prints "No URL available." and exits 1, with zero other output.
- Root cause isolated with instrumentation: the `discover` action handler receives `options = {headless:true, llm:true}` — `url` and `nonInteractive` are **entirely missing**. The boolean defaults present (`headless`, `llm`) are the negatable-flag defaults of `--no-headless`/`--no-llm`.
- Minimal reproduction in pure commander 14.0.3 (the pinned version): registering BOTH a program-level default command (`program.argument('[target]').option('--url ...').action(...)`, index.ts:25-136) AND a `program.command('discover')` subcommand with overlapping options causes commander to drop the subcommand's `--url`/`--non-interactive` values, returning only `{headless:true, llm:true}`. Removing the program-level default `.action()` makes `--url` parse correctly. So the defect is the **coexistence of a default command and the `discover` subcommand**, not a typo in `discover.ts`.

Impact: The headline feature is unreachable through its own documented subcommand. This single bug is the most likely concrete cause of "testers couldn't make it find useful issues." Note the working alternative — `sniff --discover --url ...` (the *flag* on the default command, index.ts:58) — routes URL correctly (reproduced: it proceeds past URL resolution), but no quickstart points users there.

### F2 — The default `sniff` run does NOT do the impressive thing; it is a regex source scan
**Severity: HIGH · Confidence: CONFIRMED (reproduced)**

Evidence:
- `src/cli/commands/unified.ts:43-61`: Phase 1 "Source scan (always runs)" via `runSourceScan`. Reproduced output on planted code: flags `debugger`, `lorem ipsum`, `TODO`, `console.log` — pure source regex rules.
- Browser audit runs **only if a URL is present** (unified.ts:64, 70), and even then it is a per-page a11y/visual/perf audit (unified.ts:83-118) — NOT the flow-walker.
- The flow-walker (discovery) is gated behind `--discover`/`--regenerate`/etc. (index.ts:58).
- README.md:37-43 sells "opens your app in a headless browser, and hunts down bugs across eight dimensions… `npx sniff-qa`. That's the whole setup." The default behavior on a typical project (no dev server running) is just the linter.

Impact: The product's first impression is a glorified `grep` for `TODO`/`console.log`. The autonomy promise is structurally hidden behind a flag, and that flag's subcommand form is broken (F1).

### F3 — Silent, contextless "No issues found." on the default no-dev-server path
**Severity: HIGH · Confidence: CONFIRMED (reproduced)**

Evidence:
- Reproduced: `sniff` in a project with no running dev server prints only `[source] Scanning source code...` → `[source] 0 issues` → `No issues found.` (formatter.ts:39-40) and exits 0.
- `src/cli/index.ts:102-112`: dev-server auto-detect runs, but when it finds nothing there is **no message at all** — the `[auto]` line (line 108-110) prints only on success. The user is never told "I looked for a running app and didn't find one; start `npm run dev` to test real flows."
- `getDevCommand` exists and is used by `doctor` (index.ts:298) to suggest `npm run dev`, but the **default run does not surface this hint**.

Impact: A newcomer with no dev server running gets a clean bill of health that means "I only scanned source and found no lint issues," but reads as "sniff doesn't do anything." The most valuable next-step hint (start your dev server) is withheld on the exact path where it matters.

### F4 — 28 flags on a single default command (flag bloat / discoverability collapse)
**Severity: HIGH · Confidence: CONFIRMED**

Evidence:
- `src/cli/index.ts:27-54`: the default command carries exactly **28 `.option()` declarations** plus the `[target]` argument. Counted: lines 27-54 are 28 options.
- ~19 of the 28 are discovery-only (`--max-scenarios`, `--max-variants-per-scenario`, `--max-variants-per-run`, `--realism`, `--seed`, `--only`, `--app-type`, `--force-app-type`, `--no-llm`, `--non-interactive`, `--regenerate`, `--regenerate-only`, `--force-regenerate`, `--verbose`, `--dry-run`, `--discover`, `--explore`, `--no-explore`, `--max-steps`), yet they live on the default command AND are duplicated verbatim on the `discover` subcommand (index.ts:186-206). This duplication is precisely what triggers the F1 commander conflict.
- Overlapping/contradictory toggles add cognitive load: `--headed` vs `--no-headless` (aliases, lines 33-34), `--explore` vs `--no-explore` where the help text admits `--no-explore` is "kept for compatibility; exploration is off by default" (line 31) — a flag that does nothing by default.

Impact: `sniff --help` is a wall of 28 options with no grouping. A first-time user cannot tell which 2-3 flags matter. The bloat is also the mechanical cause of the F1 crash.

### F5 — Inconsistent / weak error handling for bad inputs
**Severity: MEDIUM · Confidence: CONFIRMED (reproduced) + LIKELY**

Evidence:
- Invalid URL is only validated **inside the browser phase**. `unified.ts:71-77` does `new URL(options.url)` and errors only when `options.url` is truthy AND browser runs. Reproduced: `sniff --url "not-a-url" --no-browser` silently ignores the bad URL and runs the source scan — no validation, no warning. The invalid value is accepted because `--no-browser` skips the phase that would check it.
- `discover.ts:191-200` does validate URL protocol/shape, but only on the (broken, F1) subcommand path or the working `--discover` flag path.
- `--fail-on` unknown severities print `Warning: Unknown severity "x"... ignoring.` (unified.ts:278-281) — uncolored `console.error`, easy to miss, no list of valid values.
- Browser launch failure is caught and reduced to a one-liner `Failed to launch browser. Run: npx playwright install chromium` (unified.ts:101-104) — reasonable, but it swallows the real error, so genuine launch problems (missing system libs, sandbox) are masked behind a generic install suggestion.

Impact: Bad inputs sometimes crash with stack-trace-free one-liners, sometimes silently no-op. The behavior is inconsistent and occasionally misleading (the masked browser error).

### F6 — First-run 165 MB Playwright download is a surprise on the "30-second setup" path
**Severity: MEDIUM · Confidence: CONFIRMED**

Evidence:
- `src/core/ensure-browsers.ts:16` `CHROMIUM_INSTALL_SIZE_MB = 165`; line 69-93 `ensurePlaywrightBrowsers` shells out to `npx playwright install chromium` inline with `stdio: 'inherit'` the first time any URL/browser run happens (triggered from index.ts:121 and index.ts:62/212).
- The user sees `Playwright browsers not installed.` + `Installing chromium (~165MB, one-time)...` (ensure-browsers.ts:75-79) then raw Playwright download progress.
- README discloses this only in a collapsed `[!IMPORTANT]` aside (README.md:75: "Browser checks auto-install the configured Playwright browser projects on first CLI run") — easy to miss after "That's the whole setup."

Impact: A tool pitched as zero-setup/zero-infra performs a multi-hundred-MB download mid-run, on the first invocation that does anything interesting. Acceptable engineering choice, but the messaging undersells it and there is no pre-confirmation or `--yes`-style gate on the CLI path (only MCP gets a structured `needsSetup` payload, per the file's own comment at lines 1-14).

### F7 — Progress UI gives no time/scope expectations; "doctor" is the only orientation aid and it isn't advertised on failure
**Severity: MEDIUM · Confidence: CONFIRMED**

Evidence:
- Progress is bracketed-tag lines: `[source]`, `[browser]`, `[perf]`, `[xref]`, `[explore]`, `[discover]` (unified.ts:46,80,117,168,177; discover.ts:206-396). No spinner, no step counts during the long browser/discovery phases, no ETA. For discovery, the only progress is four static "Extracting…/Classifying…/Generating…/Running N scenarios…" lines (discover.ts:206-396); a 50-scenario run shows no per-scenario progress until the final summary.
- `doctor` (index.ts:257-334) is genuinely good — checks Node, Playwright, config, dev server, package.json, scenarios — but nothing in the default run's empty/failed output points the user to `sniff doctor`. F3's "No issues found." never says "stuck? run `sniff doctor`."

Impact: During long runs the user can't tell if sniff is working or hung. After an unhelpful run, the one diagnostic command that would orient them is never surfaced.

### F8 — `--realism` and other enum flags accept invalid values without validation at the CLI layer
**Severity: LOW · Confidence: LIKELY**

Evidence:
- `index.ts:43` and `:195` declare `--realism <profile>` with the valid set only in help text; the value is passed through (`...options.realism ? { realism: options.realism } : {}`, index.ts:77/228) into `discoverCommand` typed as `RealismProfile` (discover.ts:13) with no runtime guard at the boundary. An invalid profile is forwarded rather than rejected with the list of valid values.
- Numeric flags (`--max-steps`, `--max-scenarios`, `--seed`) use bare `parseInt(...)` (index.ts:74-78, 128, 183) with no NaN handling at the CLI; a non-numeric value becomes `NaN` and flows downstream silently.

Impact: Typos in enum/numeric flags fail quietly or downstream, rather than at the input boundary with a helpful message.

### F9 — Auto-detection is conservative to a fault and never explains a miss
**Severity: LOW · Confidence: CONFIRMED**

Evidence:
- `src/config/dev-server-detector.ts:37-40`: `COMMON_PORTS` deliberately excludes 5000/8000/8080 (AirPlay/python/Tomcat collisions) — sensible, but means a dev server on 8080 (webpack/Java-adjacent setups) won't be probed unless a script pattern matches.
- Probe requires a framework marker for blind common-port hits (lines 410-411, 376): a running app with no recognized marker (custom SSR, plain Express serving HTML) is treated as "not a dev server" and ignored.
- On `method: 'none'` (line 425) the default run prints **nothing** (F3) — the detector even has all the data (`getDevCommand`) to say "I saw `npm run dev` in package.json but nothing is listening on :3000," but the default path never renders it.

Impact: Users with slightly non-standard ports/frameworks silently get the source-only path with no explanation, reinforcing "sniff doesn't work on my project."

### F10 — `init` config is almost entirely commented out; provides little guidance
**Severity: LOW · Confidence: CONFIRMED**

Evidence:
- `src/cli/commands/init.ts:4-53`: all three templates (TS/ESM/CJS) emit a `defineConfig({})` with every meaningful key commented out — no `browser.baseUrl` example, which is the single most useful thing to set given that a configured `baseUrl` is the reliable way to get browser/flow testing (it's checked at index.ts:100 and discover.ts:173 and bypasses the fragile auto-detect).
- `init` doesn't mention `discover`/scenarios at all, so a user who runs `sniff init` gets no nudge toward the product's actual value.

Impact: The onboarding command produces a near-empty file and misses the chance to teach the one setting (`baseUrl`) that makes the tool reliably do browser work.

---

## Top Recommendations (ranked by impact-to-effort)

1. **Fix F1 — the `discover` subcommand crash.** Either (a) drop the program-level default `.action()`/`--url` overlap and make the bare `sniff` invocation a real subcommand (e.g. `sniff scan`), or (b) remove the duplicated discovery options from the default command and keep them only on `discover`, or (c) upgrade/patch around the commander 14 default-command + subcommand option-routing conflict. This is the single highest-leverage fix: it makes the advertised feature reachable. Add a regression test that runs `discover --url X` and asserts the URL reaches `discoverCommand`.

2. **Fix F2/F3 — make the default run honest and self-explaining.** When no URL/dev-server is found, print a one-line summary: "Scanned source only (N issues). No running app detected — start your dev server or pass `--url` to test real flows. Run `sniff discover` to auto-walk user journeys." Never end on a bare "No issues found." without context. (unified.ts:243-259, index.ts:102-112.)

3. **Reduce F4 flag bloat.** Split the surface: `sniff` (source + optional page audit) vs `sniff discover` (flow-walker) with discovery flags living ONLY on `discover`. Group `--help` output. Remove dead toggles (`--no-explore` admits it does nothing by default). This also structurally removes the F1 conflict.

4. **Improve F5/F8 input validation at the CLI boundary.** Validate `--url` regardless of `--no-browser`; validate `--realism` against the enum and `--max-*`/`--seed` for NaN, each with a "valid values: …" message. Stop masking real browser-launch errors behind the generic install suggestion (unified.ts:101-104).

5. **Soften F6 the first-run download.** Surface the 165 MB download in the README quickstart (not a collapsed aside), and consider a one-time confirmation or a `sniff install` nudge before the inline `npx playwright install` on the CLI path.

6. **Surface F7 orientation.** Point users to `sniff doctor` from any empty/failed run, and add per-scenario/per-page progress (count of N) during long discovery/browser phases so the tool doesn't look hung.

7. **Improve F10 onboarding.** Have `sniff init` write a commented `browser: { baseUrl: 'http://localhost:3000' }` example and mention `sniff discover`.
