# How sniff compares

Linters read your source. End-to-end frameworks make you write the tests. Link checkers only check
links. sniff drives your real app and judges the result.

| | sniff | linkinator | pa11y | Playwright codegen | Hosted QA services |
|:--|:--|:--|:--|:--|:--|
| Walks real user flows in a browser | Yes | No | No | You script it | Yes |
| Nothing to write or maintain | Yes | Yes | Yes | No | No, there is onboarding |
| Broken links | Yes | Yes | No | Manual | Manual |
| Accessibility, via axe-core | Yes | No | Yes | Manual | Some |
| Empty and placeholder data | Yes | No | No | No | No |
| State lost on the back button | Yes | No | No | Manual | Manual |
| Reproduction proof on each finding | Yes | No | Partial | No | Varies |
| Self-contained HTML report | Yes | No | Partial | No | A dashboard |
| Runs locally, no account, no API key | Yes | Yes | Yes | Yes | No |

The row that is hard to get anywhere else: **empty and placeholder data, state loss, and broken
async outcomes, in one command, with no scripts to write and no service to sign up for.**

Pricing is deliberately absent from this table. Hosted QA pricing changes and is often quoted per
seat or per run, so any figure here would be stale by the time you read it.

## How it keeps false positives down

- A first-party **noise filter** drops what is not your bug: favicons, analytics, hot-module-reload
  chatter, expected auth redirects, engine aborts.
- Accessibility findings come from [axe-core](https://github.com/dequelabs/axe-core), which is
  designed to report zero false positives.
- **Uncertain findings are suppressed by default.** Pass `--all` to see them.
- A broken page is reported **once**, not re-flagged on every link that points at it.

## The fixture it is measured against

`sniff-tests/planted-bugs/` is a small app with 21 deliberately planted bugs covering all 12
classes, plus a clean control page that should produce nothing. `sniff-tests/score-fixture.mjs`
scores a JSON report against `MANIFEST.json`, and the result is locked as a regression test in the
suite. Run it yourself:

```bash
node sniff-tests/planted-bugs/server.mjs &
npx sniff-qa --url http://localhost:4321 --json > /tmp/report.json
node sniff-tests/score-fixture.mjs /tmp/report.json
```

The engine rewrite that produced the current numbers replaced a version that found 9 of the 21
planted bugs and emitted 125 false positives. That comparison is history, not a benchmark against
any other tool.
