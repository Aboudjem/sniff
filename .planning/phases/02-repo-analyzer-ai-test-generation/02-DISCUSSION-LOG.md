# Phase 2: Repo Analyzer + AI Test Generation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 02-repo-analyzer-ai-test-generation
**Areas discussed:** Framework detection scope, Route/element discovery, AI provider interaction, Test file organization
**Mode:** --auto (all decisions auto-selected)

---

## Framework Detection Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js only | Deep support for one framework, extend later | |
| Next.js + React + Vue + Svelte (broad) | Detect all four with deep Next.js, basic others | ✓ |
| All frameworks + Angular/Remix/Astro | Comprehensive but high effort | |

**User's choice:** [auto] Next.js + React + Vue + Svelte with deep Next.js, basic others
**Notes:** REPO-01 explicitly lists Next.js, React, Vue, Svelte. Detection is lightweight. Deep route discovery is Next.js-first.

| Option | Description | Selected |
|--------|-------------|----------|
| Deep for all frameworks | Full route + component parsing for every framework | |
| Deep for Next.js, basic for others | Prioritize the most predictable file-system routing | ✓ |
| Shallow for all | Entry-point only, extend post-launch | |

**User's choice:** [auto] Deep for Next.js, basic for others
**Notes:** Next.js has most predictable file-system routing. Config-based routers are more fragile to parse.

---

## Route & Element Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| File-system only | Scan directories, no AST | |
| File-system first + AST fallback | Deterministic FS for Next.js, AST for config routers | ✓ |
| Full AST parsing | Parse everything via AST, most accurate but heaviest | |

**User's choice:** [auto] File-system first with AST fallback
**Notes:** File-system routing is deterministic and fast. AST fallback for React Router/Vue Router configs.

| Option | Description | Selected |
|--------|-------------|----------|
| Regex-based element extraction | Fast but fragile | |
| AST analysis of JSX/TSX/templates | Accurate extraction of forms, buttons, links, inputs | ✓ |
| Runtime DOM analysis | Requires browser, belongs in Phase 3 | |

**User's choice:** [auto] AST analysis of JSX/TSX/Vue templates
**Notes:** Extracts element props (data-testid, id, name, aria-label) for real selectors.

---

## AI Provider Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Claude Code CLI via shell exec | Zero API key, `--print` flag, JSON output | ✓ |
| Anthropic API only | Requires API key, not zero-friction | |
| Both via provider abstraction | CLI default + API optional | ✓ |

**User's choice:** [auto] Claude Code CLI as default, Anthropic API as optional via provider abstraction
**Notes:** AIGEN-02 mandates Claude Code default. AIGEN-03/04 require optional API + abstraction.

| Option | Description | Selected |
|--------|-------------|----------|
| One mega-prompt for all routes | Single prompt, risk of hallucination at scale | |
| One prompt per route | Focused context, prevents hallucinated selectors | ✓ |
| Batch prompts (3-5 routes each) | Balance between context and efficiency | |

**User's choice:** [auto] One prompt per route with full context
**Notes:** Per-route keeps context focused. Includes discovered elements to prevent hallucinated selectors.

---

## Test File Organization

| Option | Description | Selected |
|--------|-------------|----------|
| One spec per route | Natural mapping, easy to navigate | ✓ |
| One spec per component | Too granular for initial version | |
| One mega spec file | Hard to maintain and debug | |

**User's choice:** [auto] One `.spec.ts` per route in `sniff-tests/` directory
**Notes:** Standard Playwright format. Separate output dir avoids polluting user's test suite.

| Option | Description | Selected |
|--------|-------------|----------|
| Separate reasoning file | `*.reasoning.md` alongside each spec | |
| JSDoc comments inline | Co-located with test code, no extra files | ✓ |
| Console output only | Lost after generation | |

**User's choice:** [auto] JSDoc comments above each test block
**Notes:** AIGEN-06 transparency requirement. Inline keeps reasoning visible when reading tests.

---

## Claude's Discretion

- Analyzer output JSON schema shape
- Prompt engineering details
- Error handling for AI provider failures
- Concurrency model for multi-route generation

## Deferred Ideas

None
