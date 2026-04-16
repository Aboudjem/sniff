# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
