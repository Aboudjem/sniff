# FAQ

## Does it work without a dev server?

It is built to walk a running app, so that is where it is worth using. With no server up it does not
fail silently: it runs a source-only scan and prints the next step, which is to start your dev server
or pass `--url`. `npx sniff-qa scan` runs that source scan on purpose.

## What gets downloaded on the first run?

The first time sniff opens a browser it downloads a Chromium build through Playwright, once, and
caches it under `~/.cache/ms-playwright` (or the macOS equivalent). You see the progress and you need
internet access for that first run. Nothing else is installed and no account is created.

## Do I need an API key?

No. The default walk and the source scan run entirely on your machine, with no API key and no
signup. Two things reach outward. Dead-link checking requests the third-party URLs your own pages
already link to. And the optional AI exploration provider, which is off unless you set
`ANTHROPIC_API_KEY` or `OPENAI_API_KEY` yourself, sends prompts to that provider when you enable it.

## How is it different from a linter?

A linter reads your source files and never runs your app, so it cannot see a dead submit button, an
infinite spinner, a wiped form, or an HTTP 500 page. sniff opens the real app, interacts with it, and
reports what actually broke, with a screenshot and steps to reproduce.

## How is it different from Playwright codegen or writing end-to-end tests?

Codegen records a script that you then author and maintain, and it tests only the path you clicked.
sniff writes nothing for you to maintain. It explores your flows on its own and judges the outcome,
which catches things a recorded happy path never checks: placeholder data, state loss, missing
success feedback.

## Will a walk change data in my app?

Possibly. A walk clicks buttons and fills and submits real forms, because that is the only way to
catch a dead submit button, validation that never fires, or a submit with no success feedback. If
your app writes on submit, the walk writes. Point it at a dev or staging environment rather than at
production data.

## Will it change my code?

Not during a walk. Walking and scanning never change your code. `sniff fix` is the only command that
edits source files: it applies safe auto-fixes, like removing a stray `console.log` or `debugger`,
and only when you run it. Two other commands write files you asked for rather than editing code:
`sniff ci` scaffolds a GitHub Actions workflow and `sniff init` writes a config file.

## What stacks does it work with?

Any web app you can open in a browser: React, Next.js, Vue, Svelte, Angular, Remix, SvelteKit, Astro,
plain HTML. It walks the rendered app, so the framework does not matter for the browser checks.

## Why did it exit 1 when nothing crashed?

A walk that finds bugs exits non-zero on purpose, so a CI job fails the build. You still see a
`✓ Scan complete` line. `--fail-on critical` fails only on the worst findings, and `--fail-on none`
turns the severity gate off entirely. One thing survives `--fail-on none`: an `assert` budget in
`sniff.config` is evaluated separately and can still exit 1.

## Can it walk a page behind a login?

Yes. Save a Playwright storage state file and pass `--storage-state auth.json`. Cookie and token
values from that file are redacted from every written text report. See
[authenticated-walks.md](authenticated-walks.md) for how the file is made and exactly what redaction
covers.

## Can I cap how many findings CI tolerates?

Yes. An `assert` block in `sniff.config` sets `maxCritical`, `maxHigh`, `maxMedium`, `maxLow`,
`maxInfo`, and `maxTotal`. It is additive: it can turn a pass into a failure, never the reverse. See
[assert-budgets.md](assert-budgets.md).

## Can I narrow what the MCP server exposes?

Yes. `--caps` takes a comma-separated list of `scan`, `walk`, `discover`, `report`, and `install`.
`--caps scan,report` leaves the source scan and the saved-results reader, with no browser launch and
no browser download. It is not a read-only profile: the source scan still writes
`.sniff/last-results.json`. See [editors.md](editors.md).

## Which editors does it work in?

Claude Code as a plugin, 70+ agents through `npx skills add Aboudjem/sniff`, and any MCP-capable
client through `npx -y sniff-qa --mcp`. The per-editor snippets are in [editors.md](editors.md).
