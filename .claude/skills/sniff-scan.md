---
name: sniff
description: Scan the current project for bugs. Uses the unified sniff MCP tool to walk your running app in a real browser (mode:"walk") — or source-only scan (mode:"scan") if no app is running. No API key needed.
command: /sniff
---

# /sniff - Scan this project

Run a full quality scan on the current project using the autonomous flow-walk engine.

## What to do

1. Use the unified `sniff` MCP tool with:
   - `mode`: `"walk"` (default — drives a real browser, walks user flows, returns real bugs with proof)
   - `rootDir`: the current project's absolute path
   - `baseUrl`: omit to auto-detect the running dev server
   - If no app is running, sniff degrades to a source scan and returns a `note` field

2. If the unified `sniff` tool is not available, use legacy `sniff_run` with just `rootDir`

3. Present the findings to the user grouped by severity:
   - CRITICAL and HIGH first
   - Show file path, line number, and the issue
   - Suggest fixes for the top issues

## Example

```
User: /sniff
You: I'll scan your project for issues.

[calls sniff with mode:"walk", rootDir=/Users/user/projects/my-app]

Found 12 issues:

**Critical (1)**
- `src/routes.ts:14` - Hardcoded Stripe key in route handler

**High (3)**
- `src/handler.ts:42` - debugger statement
- `README.md:28` - Broken link to ./missing-guide.md
- `src/Page.tsx:15` - Lorem ipsum placeholder text

**Medium (8)**
- ...

Want me to fix any of these?
```
