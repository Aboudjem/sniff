<!-- GSD:project-start source:PROJECT.md -->
## Project

**Sniff**

An autonomous AI-powered QA testing framework that reads your codebase, generates test scenarios automatically, runs comprehensive tests (E2E, accessibility, visual regression, performance, source scanning), and delivers brutal reports with fix suggestions. Distributed as an npm CLI and Claude Code plugin — no API key required for default usage.

**Core Value:** One command finds bugs across every dimension (functional, visual, accessibility, performance) before users do — no manual test writing, ever.

### Constraints

- **Tech stack**: TypeScript + Node.js 22+ — locked decision
- **Test runtime**: Playwright (chromium, webkit, firefox) — locked decision
- **Default AI**: Claude Code (no API key) — key differentiator, must work out of the box
- **Distribution**: npm-first (`npx sniff`) — lowest friction for developers
- **Budget**: Zero infrastructure cost for users — everything runs locally
- **Performance**: Must complete a scan of a medium app (50 routes) in under 10 minutes
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
