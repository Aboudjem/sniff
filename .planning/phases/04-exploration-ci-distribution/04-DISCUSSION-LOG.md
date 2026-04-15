# Phase 4: Exploration + CI + Distribution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 04-exploration-ci-distribution
**Areas discussed:** Chaos Monkey Strategy, Flakiness Detection, CI Workflow Generation, MCP Server Surface, Plugin Packaging
**Mode:** Auto (all decisions auto-selected with recommended defaults)

---

## Chaos Monkey Navigation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Intelligent crawling | Uses existing route discovery + element extractor to systematically visit and interact | :heavy_check_mark: |
| Random clicking | Randomly clicks elements on each page | |
| Goal-directed paths | AI sets exploration goals and navigates toward them | |

**User's choice:** [auto] Intelligent crawling (recommended default)
**Notes:** Leverages existing src/analyzers/ infrastructure. Systematic approach ensures coverage.

### Form Fill Data Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Built-in edge-case patterns | Hardcoded sets: empty, XSS, SQL injection, Unicode, max-length | :heavy_check_mark: |
| External data files | Load test data from configurable JSON/YAML files | |
| AI-generated data | Let AI generate context-appropriate test data per field | |

**User's choice:** [auto] Built-in edge-case patterns (recommended default)
**Notes:** Zero external dependency. Covers OWASP-style edge cases out of the box.

### AI Decision Trace Format

| Option | Description | Selected |
|--------|-------------|----------|
| Structured JSON log per action | Each action records target, action, reasoning, observation | :heavy_check_mark: |
| Narrative text log | Human-readable prose describing exploration | |
| Video recording | Record browser session for replay | |

**User's choice:** [auto] Structured JSON log (recommended default)
**Notes:** Aligns with EXPLR-03 requirement. Machine-readable for report integration.

---

## Flakiness Detection & Quarantine

| Option | Description | Selected |
|--------|-------------|----------|
| Local JSON history | Append results to .sniff/history.json, compute flake rates | :heavy_check_mark: |
| SQLite database | Structured queries over test history | |
| Git-tracked history | Store in repo for team visibility | |

**User's choice:** [auto] Local JSON history (recommended default)
**Notes:** Zero infrastructure. Consistent with existing persistence patterns.

### Quarantine Threshold

| Option | Description | Selected |
|--------|-------------|----------|
| 3+ failures in last 5 runs | Conservative, configurable | :heavy_check_mark: |
| 2+ failures in last 3 runs | Aggressive, catches flakes faster | |
| Percentage-based (>50% fail rate) | Statistical approach | |

**User's choice:** [auto] 3+ failures in last 5 runs (recommended default)
**Notes:** Conservative default prevents false quarantine. Configurable via sniff.config.ts.

---

## CI Workflow Generation

| Option | Description | Selected |
|--------|-------------|----------|
| Single opinionated workflow | One .github/workflows/sniff.yml with everything | :heavy_check_mark: |
| Modular workflow templates | Multiple composable workflow files | |
| Workflow generator with prompts | Interactive setup asking about CI preferences | |

**User's choice:** [auto] Single opinionated workflow (recommended default)
**Notes:** Simplest onboarding. One command, one file. Can iterate in later versions.

### Cache Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Playwright browsers + node_modules | Standard GitHub Actions cache | :heavy_check_mark: |
| Docker layer caching | Pre-built image with browsers | |
| No caching | Simpler, slower | |

**User's choice:** [auto] Playwright browsers + node_modules (recommended default)
**Notes:** Standard approach. Significant CI time savings.

---

## MCP Server Tool Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Three tools: scan, run, report | 1:1 with CLI commands | :heavy_check_mark: |
| Granular tools per scanner | Separate tools for a11y, visual, perf | |
| Single tool with mode parameter | One sniff tool, mode: scan/run/report | |

**User's choice:** [auto] Three tools (recommended default)
**Notes:** Simple mental model. Matches CLI 1:1.

### Transport

| Option | Description | Selected |
|--------|-------------|----------|
| stdio | Standard MCP stdio protocol | :heavy_check_mark: |
| SSE | Server-sent events for web clients | |
| Both | stdio + SSE for broader compatibility | |

**User's choice:** [auto] stdio (recommended default)
**Notes:** Works with Claude Desktop, Cursor, Windsurf. SSE can be added later.

---

## Plugin Packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Plugin manifest + CLI wrapper | plugin.json manifest, commands invoke CLI | :heavy_check_mark: |
| Native plugin API | Deep integration with Claude Code internals | |
| MCP-only | Use MCP server as the plugin interface | |

**User's choice:** [auto] Plugin manifest + CLI wrapper (recommended default)
**Notes:** Simplest approach. MCP server provides the deeper integration separately.

---

## Claude's Discretion

- Exploration step ordering and prioritization algorithm
- GitHub Actions runner OS and Node version defaults
- MCP tool parameter naming and descriptions
- npm package keywords and README structure
- MCP SDK choice vs direct protocol implementation

## Deferred Ideas

None — auto-mode stayed within phase scope.
