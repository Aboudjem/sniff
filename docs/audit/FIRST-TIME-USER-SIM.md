# Sniff — First-Time User Simulation

**Persona:** Fresh developer, has never seen Sniff. Allowed to read ONLY `README.md`. Goal: get a
useful result in under 5 minutes following the README's quickstart.

**Date:** 2026-05-29
**Environment:** macOS (darwin 25.3.0), Node v22.22.0, npm 10.9.4
**Build under test:** sniff-qa v0.5.2

**Local-setup caveat (not a README problem):** the npm package is not re-published, so wherever the
README says `npx sniff-qa` I substituted the local build: `npm run build` then
`node /Users/adamboudj/projects/sniff/dist/cli/index.js`. "My app" is the bundled demo at
`node sniff-tests/planted-bugs/server.mjs 0`, which printed `SNIFF_FIXTURE_LISTENING http://localhost:51042`.

---

## Verdict: MIXED

I got a genuinely useful, understandable result well under 5 minutes — 26 real findings, each with
severity, confidence, ordered reproduction steps, a suggested fix, and a real screenshot file, plus a
self-contained HTML report. That is exactly what the README promises. It lands as **MIXED rather than
GREEN** because of two avoidable friction points the README does not prepare a stranger for: (1) the
README's hero command (bare `npx sniff-qa` auto-detect) did **not** find my running app and silently
fell back to scanning the tool's own source, and (2) a normal successful walk exits with code **1**
when it finds bugs, with no README warning, so it reads like a crash.

**Time to first useful result:** ~1.5 min of setup (`npm run build` 69ms compile + ~5s types; start
demo app) + one ~54s walk = **useful, proof-backed findings on screen in roughly 2 minutes** from the
moment the app was running. Comfortably under 5 minutes. (Chromium was already cached, so the
README's one-time ~165 MB download did not apply on this machine — I could not verify that step.)

---

## Step-by-step friction log (verbatim by README step)

### README "Get started → 1. Start your app" / "2. Walk it"

The README leads with, as the entire setup:

```bash
npx sniff-qa
```

> "Sniff auto-detects your running dev server and walks it. No API key. No Playwright setup. No config files."

**What I did (fresh-user instinct): ran the bare hero command first** (local equivalent
`node dist/cli/index.js`, cwd = project folder, demo app already listening on :51042).

**SURPRISE / FRICTION #1 — auto-detect missed my running app and scanned the tool itself.**
The bare command printed:

```
No running app detected — no --url and no dev server.
Running a source-only scan. For the full flow-walk that finds real bugs,
start your app (npm run dev) then re-run, or pass --url <url>. See sniff doctor.
```

...then ran a **source-only scan of the current directory (the Sniff repo)** and reported
**270 issues (74 high, 195 medium/low)** — including flagging Sniff's *own* source as bugs, e.g.
`src/crawl/noise.ts:65 Lorem ipsum placeholder text detected` (that line is the regex that *defines*
the lorem-ipsum check) and `src/report/template.html:410 Debugger statement detected`.

- Did the README answer it? **Partially.** The README does say (twice) that with no dev server it
  "falls back to a source-code scan and tells you exactly how to start the real walk," and the
  fallback message itself is clear and actionable (`pass --url`, `sniff doctor`). So it is *not* a
  silent failure — credit where due.
- But the README's headline framing ("auto-detects your running dev server and walks it — that's the
  whole setup") **does not hold** when the app runs on a non-standard port. My fixture was on
  :51042; auto-detect appears to probe only common dev ports. The README never lists which
  ports/hosts it probes, so a stranger has no way to know auto-detect will miss them.
- Secondary confusion: the fallback scanned the *current directory*, which happened to be Sniff's own
  repo, yielding 270 "issues" against the tool's source. A genuine first-timer running this inside
  their own project would scan their project (fine), but the alarming 270-count with the tool flagging
  its own detector definitions is jarring and undercuts the "near-zero false positives" pitch — the
  source scan clearly does not share the browser walk's noise filtering.

**Recovery was immediate** because the README also documents the explicit form:

```bash
npx sniff-qa --url http://localhost:3000
```

I ran `node dist/cli/index.js --url http://localhost:51042`. This Just Worked.

### README "2. Walk it" (with --url) — the good part

The walk ran cleanly: it scanned 12 pages, checked 13 links, did a 375px mobile pass, and finished in
**54.4s** with:

```
26 findings (+1 low-confidence hidden; use --all)
```

grouped CRITICAL / HIGH / MEDIUM / LOW. Every finding had exactly what the README promised:
- a route (e.g. `/crash`, `/dashboard`, `/signup`),
- a confidence tag (`confirmed` / `likely`),
- ordered reproduction steps,
- a `fix:` line,
- a `shot:` path to a real PNG.

Spot-checks of the proof artifacts confirmed the screenshots exist on disk
(`sniff-reports/crawl/_crash-desktop.png`, `_dashboard-desktop.png`, `_wide-mobile.png`, etc.). The
findings are real and diverse — HTTP 500 page, two 404s, broken internal/external links, an uncaught
JS exception, a failed `/api/stats` 500, dead submit button, form state-loss on back, multi-step
dead-end, no success feedback, stuck spinner, missing error state, lorem/TODO/test-email placeholders,
empty table with no empty-state, mobile horizontal overflow, axe-core contrast + alt-text +
missing-label, and small tap targets. This is genuinely useful and understandable with zero prior
knowledge. **This is the GREEN core of the experience.**

**SURPRISE / FRICTION #2 — a successful walk exits with code 1.**
A normal walk that finds bugs (no `--fail-on`, no `--ci`) exits **non-zero (exit code 1)**. I
confirmed this twice. The README only mentions non-zero exits in the *CI* section
(`--ci --fail-on high`). Nowhere in the basic quickstart does it warn that the default command exits
1 when findings exist.

- Did the README answer it? **No.** A stranger sees a non-zero exit and reasonably concludes "the
  tool errored / crashed," especially since there is no "scan complete" success line distinguishing
  "ran fine, found bugs" from "blew up." (In my harness the first run was literally auto-labeled
  "failed" purely because of exit 1, despite producing a perfect report.) One sentence in the
  quickstart — "the walk exits non-zero when it finds bugs; that's expected" — would remove this.

### README "3. Read the report" (`--report`)

```bash
npx sniff-qa --report   # writes sniff-reports/sniff-report.html (self-contained, open in any browser)
```

Ran `node dist/cli/index.js --url http://localhost:51042 --report`. Worked. It printed the exact path
(`HTML report: /Users/.../sniff-reports/sniff-report.html`) and wrote a 26 KB
`sniff-report.html` with **zero external CDN script/link references** (verified) — so "self-contained,
open in any browser" holds for styling/JS.

- Minor note: the HTML references screenshots by absolute file path (`href=".../crawl/_x.png"`) rather
  than embedding them all as data URIs (only one `data:image` was inline). So the *report logic* is
  self-contained, but to view the screenshots the `sniff-reports/crawl/` folder must travel with the
  HTML. The README's "self-contained" claim is fair (no network deps) but a reader might expect the
  images to be embedded too. Low severity.

### README "Stuck? Run `npx sniff-qa doctor`"

Ran `node dist/cli/index.js doctor`:

```
OK Node.js v22.22.0
OK Playwright installed
OK Config loaded (defaults)
-- No dev server running (try: npm run dev)
OK package.json found (sniff-qa)
-- No sniff-scenarios/ (run 'sniff discover' to generate)
```

Reassuring and matches the README's billing. Two small surprises: (a) it says "No dev server running"
even though my app *was* up on :51042 — consistent with the auto-detect-misses-nonstandard-ports issue
above; and (b) it points to `sniff discover` / `sniff-scenarios/`, which the README never explains in
the quickstart (only obliquely as "legacy" MCP modes). Minor.

---

## What the README got right (kept this from being RED)

- The core flow-walk delivers precisely what the README advertises: real findings, with severity,
  confidence, reproduction steps, fixes, and screenshot proof. The proof artifacts are real files.
- The `--url`, `--report`, and `doctor` documented commands all worked exactly as written.
- The no-server fallback is genuinely "doesn't fail silently" — the message tells you what to do next.
- No API key, no Playwright setup, no config files needed — all true.
- Findings were understandable to a stranger with no domain knowledge of the tool.

## Friction points (summary)

1. **Hero command `npx sniff-qa` (auto-detect) did not find my running app** (on non-standard port
   :51042) and fell back to scanning the tool's own repo, reporting 270 mostly-self-referential
   "issues." README's "that's the whole setup" framing oversells auto-detect; it never lists which
   ports it probes. Recovery via documented `--url` was instant.
2. **A successful walk exits with code 1 when bugs are found** — undocumented in the quickstart, reads
   like a crash. Only the CI section mentions non-zero exits.
3. **Minor:** HTML report links screenshots by absolute file path rather than embedding them, so the
   report is portable in markup but not fully standalone for images.
4. **Minor:** `doctor` and the fallback reference `sniff discover` / `sniff-scenarios/` that the
   quickstart never explains.
5. **Could not verify** the README's one-time ~165 MB Chromium download step (Chromium already cached
   in this environment).

## Bottom line

Following the README only, a stranger reaches a real, proof-backed, understandable result in ~2
minutes via the `--url` path. But anyone who trusts the README's headline and runs the bare
`npx sniff-qa` first will be briefly misled (scans the wrong thing, scary 270 count) and then rattled
by an exit-1 "success." Two short README clarifications would lift this from MIXED to GREEN.
