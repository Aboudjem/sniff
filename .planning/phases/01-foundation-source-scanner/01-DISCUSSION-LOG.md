# Phase 1: Foundation + Source Scanner - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 01-Foundation + Source Scanner
**Areas discussed:** CLI framework, Config system, Scanner output format, Scanner rule design
**Mode:** Auto (all recommended defaults selected)

---

## CLI Framework

| Option | Description | Selected |
|--------|-------------|----------|
| Commander.js | Most popular, used by Playwright/Vitest, well-documented | ✓ |
| oclif | Feature-rich but heavier, Salesforce-backed | |
| citty | Lightweight, unjs ecosystem | |
| yargs | Mature but verbose API | |

**User's choice:** Commander.js (auto-selected recommended default)
**Notes:** Top-level subcommands pattern (sniff init/scan/run/report). Lazy-load heavy modules for fast startup.

---

## Config System

| Option | Description | Selected |
|--------|-------------|----------|
| cosmiconfig + Zod | Industry standard discovery + type-safe validation | ✓ |
| Manual JSON/YAML loading | Simpler but less flexible | |
| RC package | Older approach, less TypeScript support | |

**User's choice:** cosmiconfig + Zod with defineConfig() helper (auto-selected recommended default)
**Notes:** Supports sniff.config.ts, .sniffrc.json, package.json#sniff. Vite-style defineConfig() for autocomplete.

---

## Scanner Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by severity with colors | ESLint/Biome pattern, file:line refs | ✓ |
| Flat list | Simpler but harder to scan visually | |
| Table format | Structured but verbose | |

**User's choice:** Grouped by severity with colored indicators (auto-selected recommended default)
**Notes:** Red/yellow/green severity colors. Summary counts at bottom. --json flag for programmatic use.

---

## Scanner Rule Design

| Option | Description | Selected |
|--------|-------------|----------|
| Built-in regex rules, extensible via config | ESLint-style, familiar pattern | ✓ |
| AST-based rules only | More precise but heavier, slower | |
| External rule files | Flexible but complex for v1 | |

**User's choice:** Built-in regex rules with config extensibility (auto-selected recommended default)
**Notes:** Four default categories: placeholder text, debug artifacts, hardcoded strings, broken imports. Plugin interface from day one.

---

## Claude's Discretion

- Exact Commander.js command structure and option naming
- cosmiconfig search paths and precedence
- Zod schema structure
- Rule regex patterns and edge cases
- Progress indicator implementation
- Cache directory structure (.sniff/)

## Deferred Ideas

None — discussion stayed within phase scope
