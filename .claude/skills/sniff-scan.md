---
name: sniff
description: Scan the current project for bugs. Runs source code analysis (debug statements, dead links, API endpoints, broken imports, placeholder text, hardcoded URLs). If a dev server is running, also checks accessibility, visual regression, and performance. No API key needed.
command: /sniff
---

# /sniff - Scan this project

Run a full quality scan on the current project.

## What to do

1. Use the `sniff_run` MCP tool with:
   - `rootDir`: the current project's absolute path
   - Do NOT pass `baseUrl` -- sniff auto-detects running dev servers
   - `headless`: true

2. If `sniff_run` is not available, use `sniff_scan` with just `rootDir`

3. Present the findings to the user grouped by severity:
   - CRITICAL and HIGH first
   - Show file path, line number, and the issue
   - Suggest fixes for the top issues

## Example

```
User: /sniff
You: I'll scan your project for issues.

[calls sniff_run with rootDir=/Users/user/projects/my-app]

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
