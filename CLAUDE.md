<!-- GSD:project-start source:PROJECT.md -->
## Project

**Sniff**

An autonomous QA scanner that walks your running app in a real headless browser, follows real user flows, and reports what is actually broken (broken pages, forms, accessibility, console errors, responsive issues), each with screenshot proof. The flow-walk is the default (`sniff` or `sniff --url`); `sniff scan` is the source-only mode. Distributed as an npm CLI and Claude Code plugin, with no API key required.

**Core Value:** One command finds bugs across every dimension (functional, visual, accessibility, performance) before users do, with no manual test writing, ever.

### Constraints

- **Tech stack**: TypeScript + Node.js 22+ (locked decision)
- **Test runtime**: Playwright (chromium, webkit, firefox), a locked decision
- **Default AI**: Claude Code (no API key), the key differentiator, must work out of the box
- **Distribution**: npm-first (`npx sniff`), the lowest-friction path for developers
- **Budget**: Zero infrastructure cost for users, everything runs locally
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

## Sniff contributor notes (portability and discoverability layer)

These notes record the gotchas introduced by the multi-CLI install and discoverability work. Keep them current when you touch the related files.

### Host-agnostic agents

Sniff has no `agents/` directory, so there is no `model:` frontmatter to strip. If agents are ever added, omit `model:` from their frontmatter so each host CLI falls back to its own default model. A literal `model: inherit` is a Claude-Code-only keyword that some hosts (for example OpenCode) reject as an unknown model id, which is why host-agnostic plugins carry only `name` and `description`.

### Multi-CLI installer target directories

`install.sh` and `install.ps1` symlink the three skills (`sniff`, `sniff-fix`, `sniff-report`) into a CLI's skills directory. Current map:

| Platform | Directory | Style |
|:--|:--|:--|
| gemini, codex, opencode, pi | `~/.agents/skills` | per-skill |
| vscode, copilot | `~/.copilot/skills` | per-skill |
| trae | `~/.trae/skills` | per-skill |
| vibe | `~/.vibe/skills` | per-skill |
| openclaw | `~/.openclaw/skills` | folder |
| antigravity | `~/.gemini/antigravity/skills` | folder |
| hermes, cline, kimi | `~/.<cli>/skills` | folder |

These conventions change between CLI releases. When one drifts, update `install.sh` (`platform_target`), `install.ps1` (`Get-PlatformTarget`), and the install matrix in the README together. The MCP server (`npx -y sniff-qa --mcp`) is the universal fallback and is unaffected by this table.

### Manifests to keep in sync

Three plugin manifests must stay aligned on `name`, `version`, and `description`: `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, `.copilot-plugin/plugin.json`.

### Version-bump checklist

When cutting a release, bump the version in `package.json`, `.claude-plugin/plugin.json`, `.cursor-plugin/plugin.json`, and `.copilot-plugin/plugin.json`, and add a `CHANGELOG.md` entry. The npm `files` list does not include the installer, the discovery manifests, `READMEs/`, or `site/`, so those are repo-only and are not shipped to npm.

### GitHub Pages

`site/index.html` is deployed by `.github/workflows/deploy-pages.yml` (`concurrency: pages`). It reuses the already-built demo assets and a sample report; it does not rebuild them. Pages must be set to deploy from GitHub Actions in the repo settings.
