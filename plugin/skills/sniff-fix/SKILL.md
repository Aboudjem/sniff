---
name: sniff-fix
description: Scan the project and auto-fix safe issues (remove debugger statements, console.log calls, and other auto-fixable problems).
---

# /sniff-fix - Scan and fix issues

Scan the project, then automatically fix safe issues.

## What to do

1. Use `sniff_scan` MCP tool with the project's `rootDir` to get all findings

2. For each finding, fix it if safe:
   - `debug-debugger`: Remove the `debugger;` line
   - `debug-console-log`: Remove `console.log/debug/info` lines
   - `placeholder-lorem`: Flag to user (needs manual replacement)
   - `hardcoded-localhost`: Suggest environment variable
   - `api-hardcoded-secret`: Remove the secret and suggest env var

3. Do NOT auto-fix without telling the user what you're changing

4. After fixing, re-run `sniff_scan` to verify issues are resolved

## Example

```
User: /sniff-fix
You: I'll scan and fix what I can.

Found 8 issues. Auto-fixing 4:

- Removed `debugger` from src/handler.ts:42
- Removed `console.log` from src/api.ts:8
- Removed `console.log` from src/api.ts:15
- Removed `console.debug` from src/utils.ts:3

4 issues need manual attention:
- src/config.ts:8 - Hardcoded localhost URL (replace with env var)
- README.md:28 - Broken link to ./missing-guide.md
- ...

Re-scanning... 4 issues remaining (down from 8).
```
