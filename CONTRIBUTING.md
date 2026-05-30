# Contributing to Sniff

Glad you're here. Whether it's a typo fix, a new scanner rule, or a whole new scanning dimension · it all moves the project forward.

## Getting set up

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/sniff.git
cd sniff

# Install everything
npm install

# Build once to make sure things work
npm run build

# Run the test suite (one-shot; `npm test` runs Vitest in watch mode)
npx vitest run

# Try the CLI locally (the flow-walk against a running app is the default)
node dist/cli/index.js --url http://localhost:3000

# Or run a source-only scan (no browser)
node dist/cli/index.js scan
```

You'll need **Node.js 22+** and optionally **Playwright browsers** (`npx playwright install chromium`) if you're working on anything browser-related.

## Where things live

```
src/
  ai/              # AI providers (Claude Code CLI, Anthropic API)
  analyzers/       # Static analysis · route discovery, element extraction
  browser/         # Playwright runner + page hooks (console, network, screenshots)
  ci/              # GitHub Actions workflow generation
  cli/             # Commander-based CLI · one file per command
  config/          # Zod schemas + cosmiconfig loader
  core/            # Shared types, persistence layer, flakiness detection
  exploration/     # Chaos monkey · AI explorer + edge-case payloads
  mcp/             # MCP server for AI editor integration
  report/          # HTML, JSON, JUnit report generators
  scanners/        # The actual scanners (source, accessibility, visual, performance)
```

## Testing against the planted-bug fixture

The flow-walk engine is held to a regression gate by a fixture of deliberately planted
bugs. Everything lives under `sniff-tests/`:

- `sniff-tests/planted-bugs/` · a small app with 21 planted bugs across all 12 issue
  classes plus a clean control page, with `MANIFEST.json` as the ground truth
- `sniff-tests/score-fixture.mjs` + `sniff-tests/score-lib.mjs` · the scorer that grades a
  Sniff JSON report against the manifest (precision, recall, false positives)
- `sniff-tests/run-crawl.mjs` · a dev harness to run a manual scan against any URL

To run a manual scan against a running app (build first):

```bash
npm run build
node sniff-tests/run-crawl.mjs http://localhost:3000
```

The same fixture run is wired into the Vitest suite as a locked regression test, so if you
touch the walk engine, run `npx vitest run` and keep the fixture at 21/21 with 0 false
positives.

## Ways to contribute

### Report a bug

Use the [bug report form](https://github.com/Aboudjem/sniff/issues/new?template=bug_report.yml). Include your Node version, OS, and the full error output · it saves a lot of back-and-forth.

### Suggest something

Got an idea? Use the [feature request form](https://github.com/Aboudjem/sniff/issues/new?template=feature_request.yml). Focus on the problem you're trying to solve · that context helps us figure out the best approach together.

### Submit a pull request

1. **Fork** the repo, branch off `main`
2. **Write tests** for new behavior
3. **Follow what's already there** · look at a similar file for patterns
4. **Make sure it passes** before opening the PR:
   ```bash
   npm run build && npx vitest run
   ```
5. **Open the PR** with a short explanation of what changed and why

### Add a source rule (easiest first contribution)

Source rules are regex patterns with a severity level. Each one is a few lines of code:

1. Create your rule in `src/scanners/source/rules/`
2. Export it from `src/scanners/source/rules/index.ts`
3. Done · the scanner picks it up automatically

Look at the existing rules for the pattern. If you can write a regex, you can add a rule.

### Add a scanner

The scanner system is designed to be extended without touching core code:

1. Create `src/scanners/your-scanner/index.ts`
2. Implement the `Scanner` or `BrowserScanner` interface
3. Register it in the relevant command (`scan` or `run`)
4. Add a test file alongside it

## Code conventions

- **ESM imports** with `.js` extensions · this is a TypeScript ESM project
- **Lazy imports** in CLI commands (`await import(...)`) to keep startup fast
- **Zod** for all config and schema validation
- **Vitest** for tests
- **picocolors** for terminal colors (not chalk)
- Keep things straightforward · don't add abstractions until the third time you need one

## Commit style

Conventional commits. Keep the subject line short, put detail in the body if needed.

```
feat: add CSS specificity scanner
fix: handle empty config file without crashing
docs: clarify visual regression setup for CI
test: cover flakiness detection edge cases
```

## License

Your contributions will be licensed under [Apache 2.0](LICENSE), same as the rest of the project. The [NOTICE](NOTICE) file carries attribution to the original author · that stays with any derivative work.
