## Project

**Sniff**

An autonomous QA scanner that walks your running app in a real headless browser, follows real user flows, and reports what is actually broken (broken pages, forms, accessibility, console errors, responsive issues), each with screenshot proof. The flow-walk is the default (`sniff` or `sniff --url`); `sniff scan` is the source-only mode. Distributed as an npm CLI and Claude Code plugin, with no API key required.

**Core Value:** One command finds bugs across every dimension (functional, visual, accessibility, performance) before users do, with no manual test writing, ever.

### Constraints

- **Tech stack**: TypeScript + Node.js 22+ (locked decision)
- **Test runtime**: Playwright (chromium, webkit, firefox), a locked decision
- **Default AI**: Claude Code (no API key), the key differentiator, must work out of the box
- **Distribution**: npm-first (`npx sniff-qa`; `npx sniff` is an unrelated package)
- **Budget**: Zero infrastructure cost for users, everything runs locally
- **Performance**: Must complete a scan of a medium app (50 routes) in under 10 minutes

## Technology Stack

TypeScript on Node.js 22+, built with tsup, tested with vitest. Playwright drives the browser and
axe-core backs the accessibility checks. The MCP server uses `@modelcontextprotocol/sdk` over stdio.

## Layout

- `src/cli/`: the `sniff` command (commander). `src/cli/index.ts` holds the help text and `doctor`.
- `src/crawl/`: the default flow-walk. Detectors live in `src/crawl/detectors/`, one per issue class.
- `src/crawl/verdict.ts`: the verdict line and the fix-first list every report opens with.
- `src/mcp/`: the MCP server and its tools. `src/mcp/caps.ts` gates the tool list.
- `skills/`: the three skills (`sniff`, `sniff-fix`, `sniff-report`).
- `sniff-tests/planted-bugs/`: the fixture app with 21 planted bugs. `npm run proof` scores a walk on it.

## Commands

- `npm test`: the full suite once. The fixture gate needs Chromium; outside CI it skips with a reason when the browser is absent.
- `npm run typecheck`, `npm run build`, `npm run proof`.

## Sniff contributor notes (portability and discoverability layer)

These notes record the gotchas introduced by the multi-CLI install and discoverability work. Keep them current when you touch the related files.

### Host-agnostic agents

Sniff has no `agents/` directory, so there is no `model:` frontmatter to strip. If agents are ever added, omit `model:` from their frontmatter so each host CLI falls back to its own default model. A literal `model: inherit` is a Claude-Code-only keyword that some hosts (for example OpenCode) reject as an unknown model id, which is why host-agnostic plugins carry only `name` and `description`.

### Multi-CLI installer target directories

`install.sh` delegates to the Vercel skills CLI by default
(`npx --yes skills@1.5.23 add Aboudjem/sniff -a <agent> -y`), so the directory conventions below no
longer have to be right for the common path. The platform-to-agent map lives in `platform_agent`;
the agent codes are verified against https://github.com/vercel-labs/skills#supported-agents.

`install.sh --legacy` and `install.ps1` still symlink the three skills (`sniff`, `sniff-fix`,
`sniff-report`) into a CLI's skills directory by hand. That path is for an offline machine or one
without `npx`. Its map:

| Platform | Directory | Style |
|:--|:--|:--|
| gemini, codex, opencode, pi | `~/.agents/skills` | per-skill |
| vscode, copilot | `~/.copilot/skills` | per-skill |
| trae | `~/.trae/skills` | per-skill |
| vibe | `~/.vibe/skills` | per-skill |
| openclaw | `~/.openclaw/skills` | folder |
| antigravity | `~/.gemini/antigravity/skills` | folder |
| hermes, cline, kimi | `~/.<cli>/skills` | folder |

These conventions change between CLI releases. When one drifts, update `install.sh`
(`platform_target`, the legacy path only), `install.ps1` (`Get-PlatformTarget`), and the install
matrix in the README together. The MCP server (`npx -y sniff-qa --mcp`) is the universal fallback
and is unaffected by this table. Editor and agent notes live in `docs/editors.md`.

### MCP capability gating

`--caps` narrows the registered tool set (`src/mcp/caps.ts`). Granting `walk` also grants `scan`,
because `handleSniffWalk` degrades to a source scan when no dev server is reachable. When you add or
rename an MCP tool, update `CAPABILITY_TOOL` and `TOOL_ORDER` in that file, or the default tool list
silently changes shape.

### Report redaction

`--storage-state` arms a process-level redactor (`src/core/redaction.ts`). Any new writer that
serializes findings must pass them through `redactValue` first, or an authenticated run can leak a
session token into a committed report. The existing chokepoints are `saveResults`, `saveReport` and
`src/crawl/write-report.ts`.

### Manifests to keep in sync

Three plugin manifests must stay aligned on `name`, `version`, and `description`: `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.copilot-plugin/plugin.json`.

### Version-bump checklist

When cutting a release, bump the version in `package.json` (and `package-lock.json`), `server.json`
(top level and `packages[0].version`), `gemini-extension.json`, `.claude-plugin/plugin.json`,
`.cursor-plugin/plugin.json`, and `.copilot-plugin/plugin.json`, and the pinned `sniff-qa@<version>`
in `.mcp.json`, `gemini-extension.json` and the Cursor and Copilot manifests. Add a `CHANGELOG.md`
entry. `test/manifests.test.ts` fails when any of these drift. 10x pins from `.claude-plugin/plugin.json`. The npm `files` list does not include the installer, the discovery manifests, `READMEs/`, or `site/`, so those are repo-only and are not shipped to npm.

### GitHub Pages

`site/index.html` is deployed by `.github/workflows/deploy-pages.yml` (`concurrency: pages`). It reuses the already-built demo assets and a sample report; it does not rebuild them. Pages must be set to deploy from GitHub Actions in the repo settings.
