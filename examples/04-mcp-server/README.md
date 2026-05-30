# Example 04 — MCP server

Use sniff as an MCP server so Claude Code (or any MCP client) can run QA scans as a tool call.

## Start the server

```bash
npx sniff-qa --mcp
```

## Configure in Claude Code

Add to `.mcp.json` in your project root (or `claude_desktop_config.json` for Claude Desktop):

```json
{
  "mcpServers": {
    "sniff": {
      "command": "npx",
      "args": ["-y", "sniff-qa", "--mcp"]
    }
  }
}
```

## Available MCP tools

| Tool | Description |
|:--|:--|
| `sniff` | Walk a running app and return all findings |
| `sniff_discover` | Detect dev servers and report reachable targets |
| `sniff_install` | One-shot install / config helper |
| `sniff_report` | Generate an HTML report from the last scan |
| `sniff_run` | Run the source-only scan |
| `sniff_scan` | Alias for source-only scan |

## Example Claude Code prompt

```
Use sniff to walk http://localhost:3000 and give me a prioritised list of bugs to fix.
```

Claude Code calls the `sniff` MCP tool, receives structured findings JSON, and summarises them — no copy-pasting terminal output, no manual triage.

## Other MCP clients

The same `npx -y sniff-qa --mcp` command works in any stdio MCP client. Config file locations differ by client:

| Client | Config file |
|:--|:--|
| Claude Code | `.mcp.json` (project) or `~/.claude/mcp.json` (global) |
| Claude Desktop | `claude_desktop_config.json` |
| Cursor | `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| Cline | Cline MCP settings panel |
