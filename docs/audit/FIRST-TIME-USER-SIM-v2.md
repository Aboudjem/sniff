# First-Time User Simulation v2 — README-only walkthrough

**Date:** 2026-05-29
**Persona:** Fresh developer who has never seen Sniff. Allowed to read ONLY `README.md`.
**Goal:** Get a useful result in under 5 minutes by following the README quickstart.
**Tool under test:** Sniff QA scanner (`sniff-qa` npm package; binary `sniff`).

> **Local-setup caveat (NOT counted as README friction):** the npm package isn't re-published in
> this environment, so everywhere the README says `npx sniff-qa` I substituted the local build:
> `node /Users/adamboudj/projects/sniff/dist/cli/index.js`. The target "app" was the bundled demo
> fixture started with `node sniff-tests/planted-bugs/server.mjs 0`, which printed
> `SNIFF_FIXTURE_LISTENING http://localhost:52676`.

---

## Time-to-first-useful-result

**~55 seconds** of actual scan time (walk start 01:35:23 → results printed 01:36:18). Counting the
one-time prerequisites a real user would also hit:

- Reading the quickstart: trivial, the "Get started" section is the second thing on the page.
- The fixture/app start: instant.
- The walk: 55.1s (the tool prints its own `12 pages, 13 links, 55.1s` summary).

Well under the 5-minute target. **No browser download happened** because Chromium was already
cached locally — the README warned this would be a one-time ~165 MB download on a truly fresh
machine, so that expectation was set correctly even though I didn't pay it.

---

## Step-by-step friction log

### Step 0 — Landing on the README
The headline ("Point it at your running app... tells you what's actually broken — with proof") and
the one-liner `npx sniff-qa` are the first things visible. Clear value prop. The "Get started"
section is exactly where I'd expect.

- **Surprise:** the very first code block (line 43) is bare `npx sniff-qa` with the caption "That's
  the whole setup." But the actual numbered quickstart (Step 2) tells you to run
  `npx sniff-qa --url http://localhost:3000` and calls it "the reliable one-liner." Mild tension:
  the hero sells zero-flag auto-detect, the steps quietly steer you to `--url`. Not blocking — the
  README does resolve it ("auto-detect... if it misses, pass `--url` — that always works"), but a
  brand-new user reads the hero first and might expect bare `npx sniff-qa` to Just Work.

### (a) Which command to run first — README expectation check: **CORRECT**
The README's Step 1 = start your app, Step 2 = walk it with `--url`. I followed exactly that:
started the fixture, then ran the walk with `--url http://localhost:52676`. The README's framing of
`--url` as "the reliable one-liner" matched reality perfectly — it worked on the first try with no
guesswork. Nothing confusing here.

### Step 2 — Walk it
Command run:
```
node .../dist/cli/index.js --url http://localhost:52676
```
Output was immediately legible:
```
sniff v0.6.0  walking http://localhost:52676
  · scan / ... (12 pages)
  · checking 13 links
  · mobile / ...
  sniff crawl — 12 pages, 13 links, 55.1s
  26 findings (+1 low-confidence hidden; use --all)
```
Then findings grouped CRITICAL → HIGH → MEDIUM → LOW, each with: confidence tag
(`[confirmed]`/`[likely]`), route, ordered repro steps, a `fix:` line, and a `shot:` screenshot
path. This is exactly the "proof-backed finding" the README promised. **No friction.**

- **Pleasant surprise:** the live progress (`· scan /orders`, `· mobile /signup`) reassures you it's
  actually driving a browser, not hanging. The README didn't promise this but it removed any "is it
  stuck?" anxiety during the 55s.
- The `+1 low-confidence hidden; use --all` line directly matches the README's documented
  default-suppression behavior (confidence section + `--all` flag). Expectation set correctly.

### (b) With / without a detected dev server — README expectation check: **CORRECT (validated the documented path)**
I used the `--url` path the README calls reliable, and it behaved exactly as described: it walked
the running app (real browser flows), not a source scan. The README is explicit that with **no**
server it falls back to a source-only scan and prints how to start the real walk; I deliberately
gave it a running server via `--url`, so I correctly got the full browser walk. The README's
with/without-server contract is coherent and I was never misled about which mode I was in — the
`walking <url>` banner and the per-page `scan`/`mobile` lines make the active mode obvious.

### (c) Exit code when bugs are found — README expectation check: **CORRECT — and this is the README's biggest win**
The walk ended with:
```
✓ Scan complete — 26 issue(s) found. Exit code 1 so CI fails on bugs; pass --fail-on none to always exit 0.
=== EXIT CODE: 1 ===
```
My harness's tooling flagged the non-zero exit as a "command failed," which is *exactly* the trap a
first-timer would fall into — thinking the tool crashed. **The README pre-empted this completely.**
Line 78 says verbatim: *"Found bugs? It exits non-zero — on purpose. A walk that finds issues exits
with code `1` so CI fails the build; it is not a crash (you'll see a `✓ Scan complete` line)."* I saw
the `✓ Scan complete` line, recognized exit 1 as intended, and was not alarmed. The CLI's closing
line even re-states the contract. This is a model example of a README defusing a confusing signal
before it happens.

### Step 3 — Read the report
Ran `node .../dist/cli/index.js --url http://localhost:52676 --report`. It re-walked and wrote
`sniff-reports/sniff-report.html` (26 KB).

- **Minor expectation gap (cosmetic):** README line 87 says `--report` "writes
  `sniff-reports/sniff-report.html`." It does — confirmed the file exists and is self-contained
  (inline `<style>`, embedded screenshot as a `data:image` URI; the only external URLs are the
  findings' own URLs and axe-core doc links). So "self-contained, open in any browser" is accurate.
- **Surprise:** `--report` runs a **fresh full walk** (another ~55s) rather than reusing the
  previous run's results. The README doesn't say it re-scans; a first-timer might expect `--report`
  to just render the last run. There's a separate `sniff report` subcommand (Commands table, line
  188: "Show the results from the last run") for that, but the `--report` flag vs `report`
  subcommand distinction isn't spelled out. Low-impact, but a sentence clarifying "`--report` walks
  and writes HTML; `sniff report` re-renders the last run" would help.

---

## What the README got right (no friction)
- Correct first command and ordering (start app → walk with `--url`).
- The non-zero-exit-on-bugs explanation — pre-empted the single most alarming signal.
- Confidence/severity model and `--all` default-hidden behavior matched output exactly.
- One-time Chromium download warning (didn't trigger here, but expectation was set).
- HTML report path and "self-contained" claim were accurate.
- "No API key, no config" — true; the bare `--url` walk needed nothing else.

## Remaining friction (all minor, none blocking)
1. **Hero vs. quickstart mismatch:** the hero sells bare `npx sniff-qa` ("that's the whole setup")
   while the numbered steps steer to `--url` as "the reliable one-liner." A first reader may expect
   zero-flag auto-detect to be the primary path. Reconcilable, but slightly mixed messaging.
2. **`--report` re-walks vs. `report` subcommand re-renders:** the README never says `--report`
   triggers a fresh scan, nor distinguishes it from the `sniff report` subcommand. Cost: an
   unexpected extra ~55s walk.

Neither friction point caused me to get stuck or get a wrong/misleading result. Both are
documentation-polish items, not functional gaps.

---

## VERDICT: GREEN

Following the README only, I got a useful, understandable, fully proof-backed result
(26 findings: 1 critical, 13 high, 11 medium, 1 low — each with route, repro steps, fix, and
screenshot) in **~55 seconds**, far under the 5-minute target. The README correctly set expectations
for (a) which command to run first, (b) running-vs-no-server behavior, and — critically — (c) the
non-zero exit code on bugs, which pre-empted the one signal that would otherwise have looked like a
crash. I was never misled or alarmed. The only friction was two minor documentation-polish items
(hero/quickstart command emphasis, and the `--report` flag re-walking), neither of which blocked or
distorted the result. That clears the GREEN bar.
