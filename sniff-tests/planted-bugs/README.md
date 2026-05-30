# Planted-bug fixture

A tiny, zero-dependency web app with **21 deliberately planted QA bugs** spanning all 12 sniff issue
classes, plus a **clean control page** (`/clean`) that carries none of them. It is the RED baseline
and the precision/recall regression gate for sniff's QA engine.

## Run it

```bash
node server.mjs          # serves http://localhost:4321 (prints SNIFF_FIXTURE_LISTENING <url>)
node server.mjs 0        # bind a random free port
```

Then point sniff at it:

```bash
sniff --url http://localhost:4321
```

## What's planted

See [`MANIFEST.json`](./MANIFEST.json) for the machine-readable ground truth (bug id → issue class →
route → expected finding). Summary:

| Class | Bugs | Where |
|---|---|---|
| 1 Broken pages/routes | B01 (404), B02 (500+stack) | `/missing`, `/crash` |
| 2 Broken links | B03 (internal), B04 (external) | `/` |
| 3 Console/network errors | B05 (uncaught), B06 (500 fetch) | `/dashboard` |
| 4 Empty / fake data | B07 (empty table), B08 (lorem/test@test.com/TODO) | `/orders`, `/profile` |
| 5 Broken forms | B09 (submit no-op), B10 (no validation) | `/signup` |
| 6 State-loss | B11 (back wipes field) | `/wizard` |
| 7 Flow regression / dead-end | B12 (Finish disabled) | `/wizard` |
| 8 Loading / error states | B13 (infinite spinner), B14 (no error state) | `/dashboard` |
| 9 Broken async | B15 (no success feedback) | `/checkout` |
| 10 Responsive | B16 (overflow), B17 (tiny tap targets) | `/wide` |
| 11 Accessibility | B18 (no alt), B19 (no label), B20 (low contrast) | `/`, `/signup` |
| 12 Unclear flow | B21 (buried primary action) | `/` |

## Scoring

- **True positive**: a finding maps to a planted bug id on the correct route, with reproduction proof.
- **False negative**: a planted bug with no matching finding (a miss).
- **False positive**: a finding that maps to no planted bug, **or any finding on `/clean`**.
- `recall = TP / 21`, `precision = TP / (TP + FP)`.

The scorer lives at `../score-fixture.mjs` (added during the rebuild) and the regression test asserts
recall/precision thresholds.
