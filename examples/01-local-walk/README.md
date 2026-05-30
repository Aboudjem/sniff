# Example 01 — Local browser walk

The most common use case: walk a running local app and see every real bug.

## Steps

```bash
# Terminal 1: start your app
npm run dev

# Terminal 2: run sniff
npx sniff-qa --url http://localhost:3000
```

## What happens

1. Sniff opens a headless Chromium browser.
2. It discovers routes by following links from the root.
3. For each route it clicks buttons, fills forms, watches console + network.
4. Findings print to stdout grouped by severity.
5. Exit code `1` if findings exist (makes CI fail), `0` if clean.

## Sample output

```
sniff v0.7.0  ·  walking http://localhost:3000

  Walking /                       ✓
  Walking /about                  ✓
  Walking /contact                ✗  1 finding
  Walking /dashboard              ✗  3 findings

✗ Scan complete — 4 findings (2 high, 1 medium, 1 low)

HIGH  /contact › Broken form submit
  Steps: 1. Navigate /contact  2. Fill "Name"  3. Click "Send"
  Got: no feedback, no network request fired
  Screenshot: sniff-reports/screenshots/contact-form.png

HIGH  /dashboard › Console error during interaction
  TypeError: Cannot read properties of undefined (reading 'map')
  at DashboardTable.jsx:42

MEDIUM  /contact › Dead external link
  https://old-company-site.example.com/team  →  404

LOW  / › Placeholder data visible
  "lorem ipsum" in hero section
```

## Flags

```bash
npx sniff-qa --url http://localhost:3000 --all       # include uncertain findings
npx sniff-qa --url http://localhost:3000 --report    # also write HTML report
npx sniff-qa --url http://localhost:3000 --fail-on none  # always exit 0
```
