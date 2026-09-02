# Editors and agents

sniff reaches an agent two ways, and they are independent:

- **Skills.** The three skills (`sniff`, `sniff-fix`, `sniff-report`) are plain `SKILL.md` files. One
  command installs them into whichever agent you use.
- **MCP server.** `npx -y sniff-qa --mcp` is a stdio MCP server. Any MCP-capable client can run it,
  and it needs no install step of its own.

You can use either or both. Neither needs an API key.

## Install the skills

```bash
npx skills add Aboudjem/sniff
```

That prompts for the agent and scope. To skip the prompts, name the agent with `-a` and add `-y`:

| Agent | Command |
| --- | --- |
| Claude Code | `npx skills add Aboudjem/sniff -a claude-code -y` |
| Cursor | `npx skills add Aboudjem/sniff -a cursor -y` |
| Codex | `npx skills add Aboudjem/sniff -a codex -y` |
| GitHub Copilot (and VS Code) | `npx skills add Aboudjem/sniff -a github-copilot -y` |
| Gemini CLI | `npx skills add Aboudjem/sniff -a gemini-cli -y` |
| OpenCode | `npx skills add Aboudjem/sniff -a opencode -y` |
| Windsurf | `npx skills add Aboudjem/sniff -a windsurf -y` |
| Zed | `npx skills add Aboudjem/sniff -a zed -y` |
| Kimi Code CLI | `npx skills add Aboudjem/sniff -a kimi-code-cli -y` |
| Mistral Vibe | `npx skills add Aboudjem/sniff -a mistral-vibe -y` |
| Antigravity | `npx skills add Aboudjem/sniff -a antigravity -y` |
| Hermes Agent | `npx skills add Aboudjem/sniff -a hermes-agent -y` |
| Cline | `npx skills add Aboudjem/sniff -a cline -y` |
| Trae | `npx skills add Aboudjem/sniff -a trae -y` |
| OpenClaw | `npx skills add Aboudjem/sniff -a openclaw -y` |
| Pi | `npx skills add Aboudjem/sniff -a pi -y` |

With `-y`, the skills CLI installs into the current project when it detects one, and for your user
otherwise. Add `-g` to force user scope. The full agent list, and the
directory each one reads, is in the [skills CLI supported-agents
table](https://github.com/vercel-labs/skills#supported-agents).

`install.sh <platform>` does the same thing. It now delegates to the skills CLI, so it is a
convenience wrapper rather than a second mechanism. `install.sh --legacy <platform>` keeps the old
symlink behavior for an offline machine or one without `npx`. See [install.sh](#installsh) below.

## Claude Code plugin

The plugin bundles the skills and the MCP server together:

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

## Add it as an MCP server

Every snippet below runs the same command, `npx -y sniff-qa --mcp`. The `-y` skips the npx
first-run confirmation, which matters because MCP clients give the server no terminal to answer on.

### Claude Code

```bash
claude mcp add sniff-qa -- npx -y sniff-qa --mcp
# project-scoped, writes ./.mcp.json:
claude mcp add --scope project sniff-qa -- npx -y sniff-qa --mcp
```

### Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] }
  }
}
```

### VS Code and GitHub Copilot

`.vscode/mcp.json`. Note the top-level key is `servers`, not `mcpServers`. VS Code is the one client
that differs here, and a file using the wrong key is ignored without an error.

```json
{
  "servers": {
    "sniff-qa": { "type": "stdio", "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] }
  }
}
```

### Codex

`~/.codex/config.toml`:

```toml
[mcp_servers.sniff-qa]
command = "npx"
args = ["-y", "sniff-qa", "--mcp"]
```

Or `codex mcp add sniff-qa -- npx -y sniff-qa --mcp`.

### Gemini CLI

`~/.gemini/settings.json` (global) or `.gemini/settings.json` (project):

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] }
  }
}
```

Or `gemini mcp add sniff-qa -- npx -y sniff-qa --mcp`.

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] }
  }
}
```

### Continue

`.continue/mcpServers/sniff-qa.yaml`, or the `mcpServers` block of `config.yaml`:

```yaml
mcpServers:
  - name: sniff-qa
    command: npx
    args: ["-y", "sniff-qa", "--mcp"]
```

### OpenCode

`opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "sniff-qa": { "type": "local", "command": ["npx", "-y", "sniff-qa", "--mcp"], "enabled": true }
  }
}
```

### Zed

`settings.json`. The key is `context_servers`, and `command` is a plain string next to a sibling
`args` array:

```json
{
  "context_servers": {
    "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"], "env": {} }
  }
}
```

## Narrowing the MCP tool surface

By default the server registers six tools: `sniff` (unified), `sniff_scan`, `sniff_run`,
`sniff_discover`, `sniff_install` and `sniff_report`. `--caps` narrows that to the capabilities you
name:

| Capability | Tool it registers | What it can do |
| --- | --- | --- |
| `scan` | `sniff_scan` | Read source files and check links, no browser |
| `walk` | `sniff_run` | Launch a browser and audit a running app |
| `discover` | `sniff_discover` | Generate and drive end-to-end scenarios |
| `report` | `sniff_report` | Read the results of the last run |
| `install` | `sniff_install` | Download Playwright browser binaries |

The unified `sniff` tool registers whenever at least one of `scan`, `walk`, `discover` or `report`
is granted, and its `mode` argument is narrowed to the modes you granted.

Granting `walk` also grants `scan`. A walk falls back to a source scan when it cannot reach a dev
server, so the authority is already there and the capability list says so rather than hiding it.
`--caps walk` therefore registers `sniff_scan` alongside `sniff_run`.

`--caps scan,report` is the profile that never launches a browser and never downloads a browser
binary. Two things it is not:

- It is not read-only. A source scan writes `.sniff/last-results.json` into the project so that
  `sniff_report` has something to read back.
- It is not offline. Dead-link checking follows external links by default; set
  `deadLinks.checkExternal` to `false` in your config to stop that.

```json
{
  "mcpServers": {
    "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp", "--caps", "scan,report"] }
  }
}
```

An unknown capability name is a startup error rather than a silent no-op, so a typo in a config
fails loudly.

## install.sh

`install.sh <platform>` maps a short platform id to a skills-CLI agent code and runs
`npx --yes skills@1.5.23 add Aboudjem/sniff -a <agent> -y` for you.

| `install.sh` platform | skills-CLI agent |
| --- | --- |
| `gemini` | `gemini-cli` |
| `codex` | `codex` |
| `opencode` | `opencode` |
| `pi` | `pi` |
| `vibe` | `mistral-vibe` |
| `vscode` | `github-copilot` |
| `copilot` | `github-copilot` |
| `trae` | `trae` |
| `openclaw` | `openclaw` |
| `antigravity` | `antigravity` |
| `hermes` | `hermes-agent` |
| `cline` | `cline` |
| `kimi` | `kimi-code-cli` |

Options:

- `--legacy` uses the previous behavior: clone the repo and symlink the three skill directories by
  hand. Use it offline, or on a machine without `npx`.
- `--update` re-runs the install so the skills point at the current version. Under `--legacy` it
  pulls the checkout and relinks.
- `--uninstall` removes the skills. Under the default path this calls `skills remove`; under
  `--legacy` it deletes the symlinks.
- `--no-mcp` suppresses the MCP hint printed at the end.
- `all` applies the action to every platform in the table.

## Manual copy

If you would rather not run an installer, copy the skill directories into whichever path your agent
reads (the supported-agents table linked above lists them):

```bash
git clone --depth 1 https://github.com/Aboudjem/sniff.git
cp -R sniff/skills/sniff sniff/skills/sniff-fix sniff/skills/sniff-report ~/.agents/skills/
```

## Notes

- `sniff-fix` and `sniff-report` carry `user-invocable: false`, which Claude Code honors and other
  agents do not. They are steps inside a sniff run, not entry points. Each file says so in its body.
- The MCP server and the skills are independent. Installing the skills does not configure the MCP
  server, and adding the MCP server does not install the skills.
- To walk an app behind a login, see [authenticated walks](authenticated-walks.md). The
  `browser.storageState` config key works for both the CLI and the MCP server.
