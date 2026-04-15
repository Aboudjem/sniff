# Sniff

## What This Is

An autonomous AI-powered QA testing framework that reads your codebase, generates test scenarios automatically, runs comprehensive tests (E2E, accessibility, visual regression, performance, source scanning), and delivers brutal reports with fix suggestions. Distributed as an npm CLI and Claude Code plugin — no API key required for default usage.

## Core Value

One command finds bugs across every dimension (functional, visual, accessibility, performance) before users do — no manual test writing, ever.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CLI interface (`sniff init`, `sniff scan`, `sniff run`, `sniff report`)
- [ ] Repo analyzer that reads source to identify routes, components, forms, links
- [ ] Playwright config generator with multi-viewport projects
- [ ] AI scenario generator (Claude Code by default, Anthropic API optional)
- [ ] Auto-discovery of clickable elements and form fields
- [ ] Source-code text scanner (lorem, TODO, placeholders, hardcoded strings)
- [ ] Console error monitor during test runs
- [ ] Network failure monitor (4xx, 5xx, broken assets)
- [ ] Screenshot capture on failure
- [ ] HTML report with severity scoring
- [ ] axe-core accessibility integration
- [ ] Visual regression via pixel diff (no paid service required)
- [ ] Performance budgets (Lighthouse + k6)
- [ ] AI-driven chaos monkey exploration mode
- [ ] Flakiness detection and auto-quarantine
- [ ] CI mode with GitHub Actions workflow generator
- [ ] MCP server exposing sniff tools to other AI agents
- [ ] Claude Code plugin for one-line install
- [ ] Optional Anthropic API mode for CI/batch/unattended runs

### Out of Scope

- Real-time chat features — not a QA concern
- BrowserStack / Sauce Labs integration — defer to v0.4+, adds complexity and cost
- Recording mode (record manual session, replay) — complex, defer post-launch
- Synthetic user generator — nice-to-have, not core
- i18n coverage checker — specialized, defer
- Dark mode visual regression — subset of visual regression, handle later
- Sentry / DataDog integration — monitoring, not testing
- Mobile native app testing — web-first, browser emulation covers mobile web

## Context

- **Author:** Adam Boudjemaa — building for AI-engineering authority on LinkedIn/X
- **Prior art:** Shiftly v2 testing setup (78 Playwright tests, axe-core, Percy, k6, mabl integration) at `~/projects/shiftly-v2/apps/web/e2e/`
- **Market gap:** No single tool combines AI test generation + E2E + a11y + visual regression + perf + source scanning. Users cobble together 5+ tools
- **Distribution strategy:** npm (`npx sniff`), Homebrew tap, curl installer, Claude Code plugin
- **License:** Apache 2.0 with NOTICE file for author attribution
- **Open source play:** Drive LinkedIn/X authority, enterprise adoption without legal friction

## Constraints

- **Tech stack**: TypeScript + Node.js 22+ — locked decision
- **Test runtime**: Playwright (chromium, webkit, firefox) — locked decision
- **Default AI**: Claude Code (no API key) — key differentiator, must work out of the box
- **Distribution**: npm-first (`npx sniff`) — lowest friction for developers
- **Budget**: Zero infrastructure cost for users — everything runs locally
- **Performance**: Must complete a scan of a medium app (50 routes) in under 10 minutes

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript + Node.js 22+ | Ecosystem alignment with JS testing tools, modern Node features | — Pending |
| Playwright over Cypress/Puppeteer | Multi-browser, better parallelization, Microsoft backing | — Pending |
| Claude Code as default AI (no API key) | Zero-friction onboarding, runs in user's terminal | — Pending |
| Apache 2.0 license | Enterprise-friendly, NOTICE file preserves attribution | — Pending |
| npm as primary distribution | Largest JS package ecosystem, `npx` for zero-install | — Pending |
| MCP server architecture | Enables Cursor/Windsurf/OpenCode integration without custom plugins | — Pending |
| Pixel diff over Percy/Applitools | Free, no vendor lock-in, runs locally | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 after initialization*
