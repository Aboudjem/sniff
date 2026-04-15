# Contributing to Sniff

First off, thanks for considering contributing to Sniff! Every contribution helps
make QA testing more accessible for developers everywhere.

## Quick Start

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/sniff.git
cd sniff

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run the CLI locally
node dist/cli/index.js scan
```

## Development Setup

- **Node.js 22+** required
- **Playwright** browsers installed: `npx playwright install chromium`
- **TypeScript 6+** for type checking

## Project Structure

```
src/
  ai/              # AI providers (Claude Code, Anthropic API)
  analyzers/       # Static analysis (routes, elements, frameworks)
  browser/         # Playwright browser runner + page hooks
  ci/              # CI workflow generation
  cli/             # Commander CLI commands
  config/          # Zod config schema + loader
  core/            # Types, persistence, flakiness detection
  exploration/     # Chaos monkey explorer
  mcp/             # MCP server (Model Context Protocol)
  report/          # HTML, JSON, JUnit report generators
  scanners/        # All scanners (source, accessibility, visual, performance)
```

## How to Contribute

### Reporting Bugs

Use the [bug report template](https://github.com/adamboudj/sniff/issues/new?template=bug_report.yml).
Include your Node.js version, OS, and the full error output.

### Suggesting Features

Use the [feature request template](https://github.com/adamboudj/sniff/issues/new?template=feature_request.yml).
Explain the problem you're solving, not just the solution.

### Submitting Code

1. **Fork** the repo and create a branch from `main`
2. **Write tests** for any new functionality
3. **Follow existing patterns** -- look at similar files for style guidance
4. **Run the full check** before submitting:
   ```bash
   npm run build && npm test
   ```
5. **Open a PR** with a clear description of what and why

### Adding a Scanner

Sniff's scanner system is pluggable. To add a new scanner:

1. Create `src/scanners/your-scanner/index.ts`
2. Implement the `Scanner` or `BrowserScanner` interface
3. Register it in the appropriate command (`scan` or `run`)
4. Add tests in `src/scanners/your-scanner/index.test.ts`

### Adding Source Rules

Source rules are the simplest contribution:

1. Add your rule to `src/scanners/source/rules/`
2. Export it from `src/scanners/source/rules/index.ts`
3. Each rule is a regex pattern with severity and description

## Code Style

- **ESM imports** with `.js` extensions (TypeScript ESM)
- **Lazy imports** in CLI commands (`await import(...)`)
- **Zod schemas** for all config validation
- **Vitest** for all tests
- **picocolors** for CLI output (not chalk)
- No unnecessary abstractions -- keep it simple

## Commit Messages

Use conventional-style messages:

```
feat: add CSS specificity scanner
fix: handle empty config file gracefully
docs: update scanner architecture diagram
test: add edge cases for flakiness detection
```

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE). The NOTICE file requires attribution to the
original author (Adam Boudj) in derivative works.
