# Skeptical Reviewer — Independent Re-Derivation of the Sniff Rebuild Claims

**Reviewer role:** Adversarial, independent. Every number below was re-derived from primaries
(fresh build, fresh crawl, fresh score, source reads). No summary was trusted.

**Date:** 2026-05-29
**Repo:** `/Users/adamboudj/projects/sniff`
**Environment:** node ≥22, Playwright/chromium, axe-core via `@axe-core/playwright`.

---

## TL;DR verdict: **CONFIRMED (GREEN)** — claims hold; concerns are minor/disclosed.

| # | Claim | Verdict |
|---|-------|---------|
| 1 | New engine: 21/21 bugs, ~100% precision, 0 FP, 0 findings on /clean | **CONFIRMED** |
| 2 | Findings are REAL/reproducible, not fabricated or rigged by the scorer | **CONFIRMED** |
| 3 | Engine GENERALIZES — no FP spew on an ordinary non-buggy page | **CONFIRMED** |
| 4 | Full test suite passes | **CONFIRMED** (441/441) |

---

## What I ran (primaries)

```
npm run build                                         # Build success (tsup + dts)
node sniff-tests/planted-bugs/server.mjs 0            # SNIFF_FIXTURE_LISTENING http://localhost:51008
node sniff-tests/run-crawl.mjs http://localhost:51008 /tmp/skeptic.json
node sniff-tests/score-fixture.mjs /tmp/skeptic.json
node sniff-tests/run-crawl.mjs http://localhost:51008 /tmp/skeptic2.json   # reproducibility re-run
node sniff-tests/score-fixture.mjs /tmp/skeptic2.json
# adversarial: a hand-written 4-page clean site served on a random port, crawled with the SAME harness
node sniff-tests/run-crawl.mjs http://localhost:51317 /tmp/clean.json
node sniff-tests/score-fixture.mjs docs/audit/red/default-honest.json     # re-score RED with the SAME scorer
npx vitest run
```

---

## Claim 1 — 21/21 at ~100% precision, 0 FP, 0 on /clean — **CONFIRMED**

My fresh scorer output against the live fixture:

```
Recall:    21/21  (100%)
Findings:  27 deduped (27 raw)
Matched:   27   Candidate FP: 0   Precision proxy: 100%
Hard FP on clean page (/clean): 0
```

All B01–B21 reported FOUND. I independently confirmed from the report JSON
(`/tmp/skeptic.json`) that `/clean` **was crawled** (it appears in `report.routes`)
and produced **zero** findings — i.e. 0 is a true negative, not a skipped page.

Reproducibility: a **second independent crawl** (`/tmp/skeptic2.json`) produced an
identical 21/21, 27 findings, 0 candidate FP, 0 hard FP — including the timing-sensitive
interaction findings (stuck spinner B13, silent-async B15). Not flaky.

**Caveat on "100% precision":** `precisionProxy` in `score-lib.mjs:93` is partly
tautological — a finding counts as TP if **any** bug matcher matches it, and "candidate
FP" is just "findings that matched no bug." So precisionProxy=100% only says *every*
finding mapped to a planted bug. The trustworthy precision signals are therefore (a)
**hard FP on /clean = 0**, and (b) my adversarial clean-site test (Claim 3). Both pass.
The honest reading: 27 findings, all 27 explained by a planted bug, none orphaned, none
on the control page. That is the real result; "~100% precision" is a fair characterization
given (a)+(b), not just the proxy.

## Claim 2 — Findings are REAL, not fabricated or rigged — **CONFIRMED**

I mapped 6 findings of distinct issue classes to the actually-planted defect, citing both
the fixture source and the detector that asserts it:

1. **B02 broken-page-500** — `server.mjs:65-70` returns HTTP 500 with a raw stack trace
   for `/crash`. Finding `route/broken-page` confirmed, "Server responded with HTTP 500".
   Detector: `engine.ts:105-115` emits the broken-page finding off the real `navStatus`.
2. **B08 placeholder data** — `public/profile.html:21-23` literally contains
   `test@test.com`, `Lorem Ipsum`, `TODO: replace with real address`. Detector
   `content.ts:73-87` matches generic `PLACEHOLDER_PATTERNS` (`noise.ts:64-72`) against
   **visible innerText only** (`content.ts:15`). 4 findings, all real text.
3. **B09 submit-noop** — `public/signup.html:29` is `<button type="button">` with a script
   comment "Deliberately no handler". Detector `forms.ts:74-118` actually **fills the
   form, registers a real `page.on('request')` listener, clicks, waits 1200ms**, and
   asserts NO observable effect (no nav, no DOM delta >8 chars, no new alert, no request).
   This is a genuine interaction probe, not a fake. The clean site's working form was the
   FP guard and did not fire.
4. **B11 state-loss** — `public/wizard.html:38-42` wipes `fullname` on Back. Detector
   `flow.ts:36-96` fills a `SNIFFSTATE12345` sentinel, clicks Next, clicks Back, then reads
   `inputValue()` and fires only if the sentinel was actually lost (`flow.ts:84-85`).
   Real assert-on-state-diff.
5. **B13 infinite-spinner / B06 failed-request** — `server.mjs:43-48` holds `/api/hang`
   open; `/api/stats` returns 500. `dashboard.html` fetches both. Findings
   `loading/stuck-spinner` + `network/failed-request` both confirmed off real
   console/network evidence (`PageEvidence`, `engine.ts:71`).
6. **B18/B20 a11y** — `a11y.ts:25-99` runs **real axe-core** (`@axe-core/playwright`) with
   wcag2a/2aa/21aa tags; `image-alt` and `color-contrast` violations are echoed verbatim
   from axe, including the offending element HTML.

**Is the scorer rigged?** No. The matchers (`score-lib.mjs:47-69`) require BOTH a route
match AND a rule-keyword match — they are not "anything-goes." Proof: re-running the SAME
scorer on the RED baseline yields only 9/21 with 125 unmatched findings. If the matchers
were trivially satisfiable, RED (143 findings) would have scored far higher. The matchers
discriminate. Findings are emitted by a real Chromium browser (`engine.ts:56-57`
`chromium.launch`), not synthesized.

## Claim 3 — Generalization / low FP in the wild — **CONFIRMED**

I wrote a fresh, well-formed 4-page site the engine had never seen (`/tmp/cleansite/`):
proper `<title>`, `lang="en"`, alt text, `<label for>` on every input, an `type="email"
required` field, working internal links, real prose content, and a contact form that
**validates email and shows a success message** on submit. Served on a random port and
crawled with the identical harness:

```
sniff crawl — 3 pages, 3 links, 12.3s
0 findings
No issues found. ✓
```

**Zero findings.** This is the strongest anti-overfit signal: the interaction detectors
(forms/flow/loading) and axe did NOT fire on a legitimate form, legitimate images, or
legitimate content. Specifically, the forms detector did not false-positive
`submit-noop`/`no-validation`/`no-success-feedback` on the working contact form — it
correctly observed the DOM change/validation, so it stayed silent.

Minor note (not a defect): only 3 of 4 pages were crawled; `/thanks` is reachable only via
a form whose JS `preventDefault`s navigation, so it is not discovered as a crawlable link.
That is correct crawler behavior, and the 3 crawled pages include the form page — the FP
surface that matters.

## Claim 4 — Test suite passes — **CONFIRMED**

```
Test Files  45 passed (45)
      Tests  441 passed (441)
   Duration  56.49s
VITEST_EXIT=0
```

(Note: DECISIONS.md/D1 references "427 tests" for the legacy engines; the current suite is
441 — it has grown, all green. No contradiction with the pass claim.)

## RED baseline fairness (D1) — **FAIR, not rigged**

DECISIONS.md D1 claims the shipped v0.5.2 engine scores recall 9/21, precision proxy 13%,
125 candidate FP, 1 hard FP on /clean. I re-scored the archived RED dump
(`docs/audit/red/default-honest.json`) with the **same** `score-fixture.mjs` and reproduced
it **exactly**: 9/21, 13%, 125 candidate FP, 1 hard FP. Same 21-bug fixture, same scorer,
same matchers → genuine apples-to-apples. The RED dump is plainly a real legacy-engine
output (distinct rule taxonomy: `e2e/console-error` x48, `perf/lighthouse-error` x21,
`a11y/document-title` x24, `corroborated-broken-resource` x22 …), exactly the noise-spew the
rebuild set out to fix. Not a strawman.

---

## Remaining concerns (real, but minor)

1. **precisionProxy is self-referential.** It cannot, by construction, surface a false
   positive that happens to land on a buggy route with a matching keyword. Real FP defense
   rests on (a) hard-FP-on-/clean and (b) the wild clean-site test — both of which I ran and
   both of which pass. Recommend the team keep (and grow) an independent clean-site corpus
   as the precision gate rather than leaning on precisionProxy.
2. **Single clean control surface.** The fixture has exactly one clean page (`/clean`) and
   my adversarial site is small (4 pages, static HTML). Generalization to large SPA/React
   apps with heavy client routing, skeleton loaders, and third-party widgets is **not**
   exercised here. The noise filter (`noise.ts`) is thoughtfully built for that world, but
   it is unproven against a real framework app in this review.
3. **Interaction probes are heuristic and timing-bound.** `forms.ts`/`flow.ts` use fixed
   waits (1200ms/800ms) and a `>8` char DOM-delta threshold. They held across two runs here,
   but on a slow/animated real app these thresholds could both miss (false negative) and,
   in principle, misfire. The `confidence: likely` labeling and `needsOutOfBandVerification`
   on silent-async are honest mitigations.
4. **The fixture is authored alongside the engine.** Bugs, manifest, matchers, and detectors
   all live in one repo authored together — some co-design is unavoidable. The detectors are
   generic (axe-core, generic placeholder regexes, generic empty-table/sentinel logic, not
   fixture-string lookups), and the clean-site test guards against fixture-shaped overfit,
   so I judge this acceptable — but a third-party bug corpus would harden the claim further.

## Bottom line

I tried to break each claim and could not. The findings are produced by a real browser,
the interaction detectors genuinely assert state, the scorer's matchers discriminate (RED
proves it), the engine stays silent on both the control page and an unseen well-formed site,
the result reproduces across runs, and the full suite is green. The headline numbers
(21/21, 0 FP, 0 on /clean, 441/441) are accurate. The only honest softening: "~100%
precision" leans on a partly-tautological proxy, but the independent clean-page and
clean-site evidence backs the spirit of the claim. **GREEN.**
