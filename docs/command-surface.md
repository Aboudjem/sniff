# Command Surface

## Visible commands (user-invocable)

| Command | What it does |
|:--|:--|
| `/sniff` | Walk the running app in a real browser, find actual bugs, report with proof and fix suggestions |

## Hidden commands (Claude-invocable only)

These are hidden from the `/` menu (`user-invocable: false`) so the surface stays at one command for ADHD-friendly focus. Claude routes to them automatically when the user says "fix it" or "show the report".

| Command | Trigger phrase | What it does |
|:--|:--|:--|
| `sniff-fix` | "fix it", "fix the safe ones", "auto-fix" | Re-scans and patches safe issues (debugger, console.log, etc.) |
| `sniff-report` | "show the report", "what did it find", "last scan" | Renders the last scan results without re-walking |

## Rationale

One primary command covers 90% of what a user actually wants — "find bugs in my running app." The other two are outputs of that primary flow, not independent workflows. Hiding them reduces the decision surface without removing capability: Claude can still invoke them on natural-language cues, and power users can type them directly if they know the name.

Rule of thumb: cap visible commands at 2. If a command is a sub-step of another command, hide it.
