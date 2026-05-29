# 04 — QA Capability-Gap Matrix

**Role:** QA capability-gap analyst.
**Question:** For each of the 12 issue classes the product vision says sniff MUST reliably find, can the *current code* detect it today (YES / PARTIAL / NO), via which module, and what is missing to make it a real finding *with reproduction proof*?

**A "finding with proof" (per vision) = exact route/steps to reproduce + screenshot and/or console/network log + severity + confidence + suggested fix. A finding without reproduction proof is not a finding.**

---

## How the engines map to the question

There are effectively three execution paths, and which class is covered depends heavily on which path runs:

| Engine | Entry | What it does | Proof quality |
|---|---|---|---|
| **Source scan** (always runs) | `sniff` default, `src/cli/commands/unified.ts:43-66` | Static regex/glob rules over files (`src/scanners/source/rules/*`) | file:line + snippet only — **NO runtime reproduction** |
| **Browser audit** (runs only if a URL is given) | `sniff <url>`, `unified.ts:72-120` → `runBrowserAudit` (`src/core/quality-run.ts:62`) → `BrowserRunner.run` (`src/browser/runner.ts:62`) | `page.goto` each statically-discovered route, run axe/visual/perf scanners + console/network hooks **per page (no interaction)** | URL + viewport + console/network log + screenshot on severe |
| **Autonomous flow-walker** (gated behind `--discover`) | `src/discovery/runner.ts:437` `runScenarios` | Multi-step scripted journeys (click/fill/submit) from **fixed templates** in `src/discovery/scenarios/templates/*`, with per-step console/network/a11y/layout validators + screenshot on step failure | Best: scenario id + per-step record + screenshot + validations |

Key wiring facts (evidence):
- Default scanners include `e2e` (console/network hooks): `src/config/schema.ts:120`.
- Browser audit registers **only** Accessibility, Visual, Performance scanners; console/network come from the pipeline hooks gated on `e2e`: `src/core/quality-run.ts:84-92`, `src/browser/runner.ts:106-109`.
- The browser audit visits routes from **static** analysis (`routesFromAnalysis`, `src/core/quality-run.ts:38-43`); it does NOT live-crawl links found in the DOM.
- The flow-walker only runs scripted **template** journeys; there is no adaptive/LLM-driven exploration in `discovery/runner.ts` (the chaos-monkey `exploration/` engine is a separate `--explore` path).
- Discovery default per-step validators: `console-clean, network-clean, response-time, visible-target, label-present`; per-scenario: `full-page-axe, layout-stability` (`src/discovery/scenarios/index.ts:13-24`). Note `reachability` is a *declared* validation kind (`scenarios/types.ts:61`) with **no implementation**.

---

## Capability Matrix (12 required classes)

### Class 1 — Broken pages/routes (4xx/5xx, blank renders, crash screens)
- **Status: PARTIAL**
- **Module:** `NetworkFailureHook` (`src/browser/page-hooks.ts:67-121`) catches HTTP >=400 responses and failed requests; surfaced per page via `BrowserRunner.run` (`src/browser/runner.ts:176-203`). Routes come from static analysis (`routesFromAnalysis`).
- **What works:** A route that returns 4xx/5xx (or a sub-resource that does) is logged with status, method, URL, viewport, and a screenshot if severe — that is real proof.
- **What's missing for a real finding:**
  - **Blank renders / crash screens are NOT detected.** There is no DOM assertion that the page rendered meaningful content (no "body is empty / only an error boundary / React error overlay" check). A 200-status page that renders a white screen or a raw stack trace passes silently.
  - **A `page.goto` timeout/navigation failure throws `URL_UNREACHABLE` and aborts the entire run** (`src/browser/runner.ts:129-134`) instead of being recorded as a per-route finding — so one broken route kills the whole audit rather than producing a finding.
  - SPA client-side route errors (200 HTML, JS throws on render) only surface if they emit a console error.
- **Confidence: confirmed.**

### Class 2 — Broken links (internal + external, dead anchors)
- **Status: PARTIAL**
- **Module:** `src/scanners/source/rules/dead-links.ts` (`scanFileForDeadLinks`).
- **What works:** Static scan of **docs/HTML/markdown** for internal file links, anchors, and external URLs (real HTTP HEAD/GET check, `dead-links.ts:243-313`). Produces file:line + snippet + severity.
- **What's missing for a real finding:**
  - This is **static, not the live app.** It extracts URLs from source text. For JSX/TSX/JS it is **off by default** (`scanCode: false`, `dead-links.ts:30`), so links in actual React/Vue components are not checked unless opted in.
  - **No DOM-level link crawl of the running app.** The browser audit does not enumerate `<a href>` in rendered pages, click them, or verify internal links resolve. "Dead anchor" detection (`href="#foo"` with no `#foo` target) only works against static files, not the live DOM.
  - Proof is file:line, not a reproduction route in the running app.
- **Confidence: confirmed.**

### Class 3 — Console errors / uncaught exceptions / failed network requests during real interaction
- **Status: PARTIAL (YES for page load; PARTIAL for "during real interaction")**
- **Module:** `ConsoleErrorHook` + `NetworkFailureHook` (`src/browser/page-hooks.ts:13-121`). Validators `validateConsoleClean` / `validateNetworkClean` (`src/discovery/validators/index.ts:13-31`).
- **What works:** Console `error` + `pageerror` (uncaught exceptions) and HTTP failures are captured with message/stack, URL, viewport, and screenshot — strong proof. In default `sniff <url>` this fires on each page load.
- **What's missing for "real interaction":**
  - In the **default** browser audit, sniff only navigates to each route; it does **not click/type/submit**, so errors that only fire on interaction are missed. Real-interaction capture exists **only** in the `--discover` flow-walker, which is gated and runs only fixed templates that must match the app.
  - Console capture is `type() === 'error'` only — uncaught promise rejections surfaced as warnings, and `console.warn`-level failures, are not captured.
- **Confidence: confirmed.**

### Class 4 — Empty data + fake/placeholder data (lorem ipsum, TODO, test@test.com, mock values)
- **Status: PARTIAL (placeholder in source = YES; everything runtime = NO)**
- **Module:** `src/scanners/source/rules/placeholder.ts` (lorem/TODO/FIXME/TBD), `src/scanners/source/rules/hardcoded.ts` (localhost/127.0.0.1).
- **What works:** Static detection of `lorem ipsum`, `TODO`, `FIXME`, `TBD`, hardcoded localhost — in **source files**, with file:line.
- **What's missing for a real finding:**
  - **No empty-data / empty-state detection in the running app.** There is no check for "list/table/page rendering nothing where content is expected." Grep confirms no `empty-state`/`empty-list`/`no-results` runtime logic (`src/discovery`, `src/browser`, `src/scanners` — none found).
  - **No runtime fake-data detection.** `test@test.com`, `test@example.com`, `John Doe`, `123-456-7890`, `$0.00`, "Sample Product" rendered in the live DOM are **not** flagged. The placeholder rules only read source text, not page content.
  - No detection of the placeholder patterns most users care about (`test@test.com`, lorem) actually shipped to the rendered page.
- **Confidence: confirmed.**

### Class 5 — Broken forms (submit does nothing; validation never fires/never clears; valid input rejected)
- **Status: PARTIAL (only in `--discover`, and weakly)**
- **Module:** `fillFormWithPersona` (`src/discovery/fill-form.ts`), edge classes `invalid-email`/`empty-input`/`missing-required` (`src/discovery/edge-cases/catalog.ts:68-187`), runner step expectations (`src/discovery/runner.ts:273-286`).
- **What works (in `--discover`):** It can fill a form with persona data, submit, and assert a `url-matches`/`text-visible` expectation. The `invalid-email`/`missing-required` edge variants inject bad input and *declare* an expected failure UX (`expectsFailureUx`).
- **What's missing for a real finding:**
  - The edge variants set `expectsFailureUx` as a **human-readable string only** — there is **no assertion** that validates "inline error shown / form did not submit." `mutate()` only changes input values/preconditions; nothing checks that validation actually fired or cleared. So "validation never fires" and "validation never clears" are **not** verified.
  - "Submit does nothing": only caught indirectly if a `url-matches`/`text-visible` expectation is present on the template's submit step. Generic forms with no template match get no submit assertion.
  - "Valid input rejected": no detection — there is no notion of "I submitted valid data and was incorrectly blocked."
  - Entirely depends on a **template matching the app's journey**; arbitrary forms are not exercised.
- **Confidence: confirmed.**

### Class 6 — State-loss bugs (fill form, navigate back, all wiped; multi-step flows lose progress)
- **Status: NO**
- **Module:** none.
- **Evidence:** No `goBack` / `history.back` / "state-loss" logic anywhere (`grep` across `src/` returned nothing). The runner only goes forward through steps and **stops on first step failure** (`src/discovery/runner.ts:386`); it never navigates back to assert preserved state.
- **What's missing:** A flow that fills inputs, navigates away/back (or reloads), and asserts values persisted; multi-step wizards asserting earlier-step data survives. None of this exists.
- **Confidence: confirmed.**

### Class 7 — Flow regressions (after X→Y→Z a button/entry point disappears or path dead-ends)
- **Status: NO (effectively)**
- **Module:** Closest is `visible-target` per step and `reachability` (declared kind, `scenarios/types.ts:61`).
- **Evidence:** `reachability` has **no implementation** — it is only a string in the union type; nothing in `validators/index.ts` or the runner handles it. The runner asserts a target is visible *for the current step's selector* (`validateVisibleTarget`, `validators/index.ts:49-72`) but has no model of "an option that used to be reachable is now gone" or "the path dead-ends." There is no graph of reachable actions before/after a navigation.
- **What's missing:** Reachability/affordance diffing across states; a notion of "expected entry points still present after navigation." A dead-end is only caught accidentally if a later scripted step's selector fails to resolve.
- **Confidence: confirmed.**

### Class 8 — Bad loading states (infinite spinners, layout shift) and missing error states (failure shows nothing / raw stack trace)
- **Status: PARTIAL**
- **Module:** Layout: `validateLayoutStability` + `compareSnapshots` (`src/discovery/validators/layout-stability.ts`). Slow-network/offline edge classes (`edge-cases/catalog.ts:189-220`). Visual scanner (`src/scanners/visual/index.ts`).
- **What works:** Layout-stability validator screenshots a region before/after a step and byte-compares (catches *gross* shift). `slow-network` edge injects a 3s route delay and `offline` edge goes offline mid-flow, and `expectsFailureUx` describes the expected loading/error state.
- **What's missing for a real finding:**
  - **Infinite spinners are NOT detected.** There is no check for "a loading indicator is still present after N seconds" or "the request never resolved and the spinner is stuck." The `slow-network`/`offline` edges set up the *condition* but assert nothing about the resulting UX (the `expectsFailureUx` strings are not validated).
  - **Missing error states are NOT detected.** No assertion that a failed request produced a visible, non-raw-stack error UI. A page that "shows nothing on failure" passes.
  - Layout-stability is a crude full-byte buffer diff over a clipped region (`layout-stability.ts:77-82`), prone to false positives/negatives; the dead `getBoundingBox` stub (`layout-stability.ts:22-26`) suggests an unfinished design.
- **Confidence: confirmed.**

### Class 9 — Broken async outcomes observable client-side (no success state, hung request, silent failure); flag email/async for out-of-band verification
- **Status: NO (mostly)**
- **Module:** Closest is `validateNetworkClean` (catches 4xx/5xx) and template `goal`/`text-visible` expectations.
- **What's missing:**
  - **No "success state expected but absent" detection.** Unless a template explicitly carries a `text-visible: success` expectation on the final step, a silent failure (request 200 but UI shows nothing) passes.
  - **No hung-request detection** beyond the per-step `response-time` budget (3000ms, `scenarios/index.ts:16`) — and that only fires inside scripted scenarios, not the default audit. A request that never resolves typically manifests as a step timeout/skip, not a precise "hung request" finding.
  - **No email/out-of-band flagging mechanism.** There is no concept of "this action triggers an email/webhook; flag as needs-out-of-band-verification with how to check." Grep found nothing.
- **Confidence: confirmed.**

### Class 10 — Responsive issues (overflow, unusable layout, tap targets too small at mobile widths)
- **Status: PARTIAL**
- **Module:** Multi-viewport runs (desktop/mobile/tablet defaults, `quality-run.ts` viewports) + axe `target-size` rule enabled on mobile (`src/scanners/accessibility/index.ts:84-87`).
- **What works:** Tap-target-too-small **is** covered via axe `target-size` on the mobile viewport, with a screenshot. Pages are visited at 375px width.
- **What's missing for a real finding:**
  - **No horizontal-overflow / content-clipping detection.** There is no check for `scrollWidth > clientWidth`, elements overflowing the viewport, or unreadable/overlapping layout at narrow widths.
  - **No "unusable layout" heuristic** (e.g., off-screen primary actions, content cut off). Visual regression could catch a *change* vs a baseline but cannot judge an absolute responsive defect on first run (it just creates a baseline, `visual/index.ts:44-60`).
- **Confidence: confirmed.**

### Class 11 — Accessibility (missing labels/alt, contrast, focus traps, keyboard-unreachable controls)
- **Status: PARTIAL (strongest class, but with real holes)**
- **Module:** `AccessibilityScanner` (full-page axe, `src/scanners/accessibility/index.ts`), scoped validators `validateContrast` / `validateScopedLabels` / `validateFullPageAxe` (`src/discovery/validators/scoped-a11y.ts`), `validateLabelPresent` (`validators/index.ts:74-114`), `validateFocusRing` (`src/discovery/validators/focus-ring.ts`).
- **What works:** axe-core (`wcag2a/2aa/21aa`) runs on every visited page → missing labels, missing alt, contrast, button/link names, ARIA — all with snippet + helpUrl + fix suggestion + screenshot. Focus-ring validator checks computed outline/box-shadow on focus.
- **What's missing for a real finding:**
  - **Focus traps are NOT detected.** No keyboard-trap test (Tab cycling that never escapes a modal). axe's `focus-trap` is not a core rule and nothing simulates Tab.
  - **Keyboard-unreachable controls are NOT detected.** No tab-order traversal asserting every interactive element is reachable via keyboard; focus-ring only probes a single resolved selector via programmatic `.focus()` (`focus-ring.ts:35-72`), not real Tab navigation.
  - `validateLabelPresent` (the non-axe one) treats a bare `placeholder` as a valid label (`validators/index.ts:97`) — that is a false negative (placeholder is not an accessible name).
- **Confidence: confirmed.**

### Class 12 — Unclear user flows (a key action buried/non-obvious)
- **Status: NO**
- **Module:** none.
- **Evidence:** No discoverability/heuristic exists. The system has fixed `selectorHints` for known journeys (`scenarios/templates/*`), which is the *opposite* — it assumes it knows where actions are. There is no measure of "primary CTA is below the fold / low-contrast / buried in a menu / hard to find." No code addresses this; it likely requires the LLM/exploration engine, which is a separate, gated path.
- **Confidence: confirmed.**

---

## Summary scorecard

| # | Class | Status | Primary module | Proof quality today |
|---|---|---|---|---|
| 1 | Broken pages/routes | PARTIAL | `page-hooks.ts:67` NetworkFailureHook | HTTP errors: good. **Blank/crash render: none.** goto-fail aborts run |
| 2 | Broken links | PARTIAL | `source/rules/dead-links.ts` | Static only; **no live-DOM link crawl**; off for JS by default |
| 3 | Console errors / failed requests | PARTIAL | `page-hooks.ts:13` ConsoleErrorHook | Good on load; **interaction only in gated `--discover`** |
| 4 | Empty / fake data | PARTIAL | `source/rules/placeholder.ts` | Source-only; **no runtime empty-state or fake-data check** |
| 5 | Broken forms | PARTIAL | `fill-form.ts`, `edge-cases/catalog.ts` | Submit/validation **not actually asserted**; template-bound |
| 6 | State-loss | NO | — | none |
| 7 | Flow regressions | NO | `reachability` (unimpl) | `reachability` is a type with no code |
| 8 | Loading/error states | PARTIAL | `layout-stability.ts`, edge slow/offline | **Spinners & missing error states not asserted** |
| 9 | Broken async outcomes | NO | — | no success/hung/email-flag logic |
| 10 | Responsive | PARTIAL | a11y `target-size`, multi-viewport | Tap targets yes; **no overflow/unusable-layout** |
| 11 | Accessibility | PARTIAL | `accessibility/index.ts`, scoped-a11y | axe strong; **no focus-trap / keyboard-reach** |
| 12 | Unclear flows | NO | — | none |

**Net:** 0 of 12 are full YES. 7 PARTIAL, 5 NO (incl. one declared-but-unimplemented). The strongest, most proof-complete capabilities (console/network, axe, perf) are exactly the ones that run on **page load only** in the default command — they don't require interaction, which is why testers "couldn't make it find many useful issues": the interesting interaction/flow classes (5,6,7,9,12) are weak or absent, and the autonomous flow-walker that would exercise them is gated behind `--discover` and limited to fixed templates that must match the target app.

---

## Highest-leverage gaps to close (ordered by vision impact)

1. **Blank-render / crash-screen detection (Class 1)** — assert rendered content (visible text length, presence of a `<main>`/app root with children, detect React/Vue error overlays and raw stack traces). Make a `goto` failure a *per-route finding*, not a run-aborting throw.
2. **Live-DOM link crawl (Class 2)** — enumerate `<a href>`/buttons in the running app, follow internal links, verify they resolve; this also feeds Class 1 and Class 7.
3. **Real interaction in the default path (Class 3, 5)** — the default `sniff <url>` should click/submit, not just `goto`. Today's strongest detectors only fire on load.
4. **Form-validation assertions (Class 5)** — turn `expectsFailureUx` strings into real assertions: detect "submit did nothing" (URL/DOM unchanged + no error), "validation never fired," "valid input rejected."
5. **Empty-state + runtime fake-data detection (Class 4)** — scan rendered DOM for empty lists/tables and for shipped placeholder values (`test@test.com`, lorem, "John Doe", `$0.00`).
6. **State-loss + flow-reachability (Classes 6, 7)** — add back-nav/reload state checks and implement the declared-but-empty `reachability` validator (affordance diffing across states).
7. **Loading/error-state assertions (Class 8, 9)** — assert spinners resolve within budget, failed requests surface a visible non-raw error, success states appear; add an out-of-band (email/async) flag mechanism.
8. **Responsive overflow + keyboard a11y (Classes 10, 11)** — add `scrollWidth>clientWidth` overflow detection and a real Tab-traversal for focus traps / keyboard reachability.
