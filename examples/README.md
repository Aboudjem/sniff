# Sniff — Examples

Working examples showing sniff in action. Each directory contains commands to run, sample output, and notes.

---

## Quick reference

```bash
# 1. Walk your running app (the default)
npx sniff-qa --url http://localhost:3000

# 2. Auto-detect a dev server on common ports
npx sniff-qa

# 3. Source-only scan (no browser needed)
npx sniff-qa scan

# 4. Generate a shareable HTML report
npx sniff-qa --url http://localhost:3000 --report

# 5. Environment health check
npx sniff-qa doctor

# 6. Show uncertain findings too
npx sniff-qa --url http://localhost:3000 --all

# 7. Always exit 0 (CI passthrough)
npx sniff-qa --url http://localhost:3000 --fail-on none
```

---

## Examples in this directory

| Directory | What it shows |
|:--|:--|
| [`01-local-walk/`](01-local-walk/) | Full browser walk of a local Next.js app — the most common use case |
| [`02-source-scan/`](02-source-scan/) | Source-only scan when no dev server is running |
| [`03-html-report/`](03-html-report/) | Generating and reading an HTML report |
| [`04-mcp-server/`](04-mcp-server/) | Using sniff as an MCP server inside Claude Code / any MCP client |
| [`05-ci/`](05-ci/) | GitHub Actions integration snippet |

---

## 01-local-walk — Browser walk of a local app

**Start your app first**, then run sniff against it:

```bash
# Terminal 1: start your app
npm run dev

# Terminal 2: sniff walks it
npx sniff-qa --url http://localhost:3000
```

**What sniff checks** in one pass:
- Broken routes (4xx/5xx, blank renders, crash screens)
- Dead internal and external links
- Console errors and failed network requests *during interaction*
- Empty/placeholder data (`lorem ipsum`, `TODO`, `test@test.com`)
- Broken forms (dead submit buttons, validation that never fires)
- State loss (fill a form, hit back — is it wiped?)
- Flow dead-ends (journeys that can't complete)
- Missing loading / error states
- Responsive overflow and tiny tap targets (375 px pass)
- Accessibility issues via axe-core (contrast, alt text, labels)

**Sample terminal output:**

```
sniff v0.7.0  ·  walking http://localhost:3000

  Walking /                       ✓
  Walking /about                  ✓
  Walking /contact                ✗  1 finding
  Walking /dashboard              ✗  3 findings

✗ Scan complete — 4 findings (2 high, 1 medium, 1 low)

HIGH  /contact › Broken form submit
  Steps: 1. Navigate to /contact  2. Fill "Name" field  3. Click "Send message"
  Expected: success state or error message  Got: no feedback, no request fired
  Screenshot: sniff-reports/screenshots/contact-form.png

HIGH  /dashboard › Console error during interaction
  Error: TypeError: Cannot read properties of undefined (reading 'map')
  at DashboardTable.jsx:42
  Screenshot: sniff-reports/screenshots/dashboard-error.png

MEDIUM  /contact › Dead external link
  Link: https://old-company-site.example.com/team  → 404

LOW  / › Placeholder data visible
  Found "lorem ipsum" text in hero section copy

Exit code 1 (findings present). Pass --fail-on none to exit 0 always.
```

Each finding includes severity (`high` / `medium` / `low`), confidence (`confirmed` / `likely`), reproduction steps, and a screenshot path.

---

## 02-source-scan — No dev server required

Sniff falls back automatically when no server is detected, but you can also run it explicitly:

```bash
npx sniff-qa scan
```

Source scan checks:
- Obvious broken imports and missing referenced files
- Hardcoded TODO / placeholder strings
- Routes that would 404 based on file structure

```
sniff v0.7.0  ·  source scan (no browser)

  No dev server detected on :3000, :5173, :4000, :8080, :8000
  Running source-only scan instead.
  → To walk the real app: npm run dev  then  npx sniff-qa

  Scanned 143 files in 1.2s

  MEDIUM  src/pages/settings.tsx:18  Hardcoded TODO: "TODO: wire real user API"
  LOW     src/components/Hero.tsx:7  Placeholder text: "lorem ipsum dolor sit amet"

✓ Scan complete — 2 findings
```

---

## 03-html-report — Shareable report

```bash
npx sniff-qa --url http://localhost:3000 --report
```

Writes a **self-contained HTML file** to `sniff-reports/sniff-report.html` — no server needed, everything is inlined. Share it with your team or attach it to a PR.

```
sniff v0.7.0  ·  walking http://localhost:3000

  [walk output ...]

✓ Report written: sniff-reports/sniff-report.html
  Open it in any browser. All screenshots and evidence are inlined.
```

A sample rendered report is in [`03-html-report/sample-report.md`](03-html-report/sample-report.md) (text summary of the HTML structure).

---

## 04-mcp-server — Claude Code / MCP client integration

Sniff ships a built-in MCP server. No separate install; the same `sniff-qa` binary starts it.

### Start the MCP server

```bash
npx sniff-qa --mcp
```

### Configure in Claude Code (`.mcp.json` or `claude_desktop_config.json`)

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

### Available MCP tools

Once connected, you can invoke sniff tools from within Claude Code (or any MCP client):

| Tool | What it does |
|:--|:--|
| `sniff` | Walk a running app and return all findings |
| `sniff_discover` | Detect dev servers and report what sniff can reach |
| `sniff_install` | One-shot install / config helper |
| `sniff_report` | Generate an HTML report from the last scan |
| `sniff_run` | Run the source-only scan |
| `sniff_scan` | Alias for source-only scan |

### Example Claude Code prompt

```
Use sniff to walk http://localhost:3000 and give me a prioritised bug list.
```

Claude Code calls `sniff` via MCP, receives structured findings, and summarises them for you — no copy-pasting terminal output.

---

## 05-ci — GitHub Actions

Drop this into `.github/workflows/qa.yml`:

```yaml
name: Sniff QA

on: [push, pull_request]

jobs:
  sniff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Start app
        run: npm ci && npm run build && npm run start &
      - name: Wait for app
        run: npx wait-on http://localhost:3000 --timeout 60000
      - name: Sniff walk
        run: npx sniff-qa --url http://localhost:3000 --report
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sniff-report
          path: sniff-reports/sniff-report.html
```

Sniff exits `1` when it finds bugs, so the CI step fails and the uploaded report tells you exactly what to fix.

---

## See also

- [Full README](../README.md) — all flags, MCP setup, CI tips
- [Site / live docs](../site/index.html) — rendered documentation
- [skills/](../skills/) — sniff, sniff-fix, sniff-report Claude Code skills
