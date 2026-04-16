# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-16

### Added

- **Dead link checker** validates internal file references, external URLs (HTTP HEAD with retry/timeout), and anchor links across .md, .html, .jsx, .tsx, .vue, .svelte, and .astro files
- **API endpoint discovery** auto-detects routes from Express, Fastify, Hono, Next.js (App + Pages Router), SvelteKit, tRPC, and GraphQL schema definitions
- **API endpoint issue detection** flags missing error handling, input validation, auth middleware, and hardcoded secrets in route handlers
- **Cross-reference engine** correlates source code findings with browser runtime evidence (5 strategies: broken imports to 404s, console.log to runtime output, hardcoded URLs to network requests, a11y issues to axe violations, placeholders to visible text)
- **Corroborated findings** with bumped severity and confidence tags when issues are confirmed in both source and browser layers
- **Pipeline SVG diagrams** (light/dark) showing the full 8-check pipeline
- **Architecture SVG diagrams** (light/dark) showing all system components
- **Report example SVG** (light/dark) showing styled terminal output
- **Dead link config** section in `sniff.config.ts` (checkExternal, timeout, retries, ignorePatterns, maxConcurrent)
- **API endpoints config** section in `sniff.config.ts` (checkErrorHandling, checkValidation, checkAuth, checkSecrets, frameworks filter)

### Changed

- README updated to document all 8 checks with detailed examples, source rule reference table, cross-reference examples, and expanded config reference
- "Five checks" updated to "Eight checks" across all documentation
- Comparison table expanded with dead link checking, API endpoint discovery, and cross-reference engine rows

## [0.1.0] - 2026-04-16

### Added

- **Source scanner** with AST and regex rules for debugger statements, placeholder text, hardcoded URLs, broken imports, TODO/FIXME tags
- **Accessibility scanner** powered by axe-core for WCAG 2.x violations with fix guidance
- **Visual regression scanner** using pixelmatch for pixel level diffing with baseline tracking
- **Performance scanner** using Lighthouse for LCP, FCP, TTI budget enforcement
- **AI explorer** that roams your app, fills forms with adversarial inputs (XSS, SQL injection, Unicode), and reports crashes
- **Three modes**: quick scan (source only), full audit (all 5 checks), CI mode (deterministic)
- **MCP server** for native AI editor integration (Claude Code, Cursor, Windsurf, VS Code + Cline)
- **Flakiness quarantine** for stable CI pipelines
- **HTML, JSON, and JUnit report** generation
- **Zero config** operation with framework auto detection
- **CLI** with `npx sniff-qa` entry point
