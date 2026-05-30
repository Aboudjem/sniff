# Example 02 — Source-only scan

No running app needed. Sniff reads your source files and reports what it can find statically.

## When to use

- You want a quick pass before starting the dev server
- In CI on a branch that doesn't deploy a preview
- Sniff auto-falls-back to this mode if no dev server is detected

## Command

```bash
npx sniff-qa scan
```

## Sample output

```
sniff v0.7.0  ·  source scan (no browser)

  No dev server detected on :3000, :5173, :4000, :8080, :8000
  Running source-only scan instead.
  → To walk the real app: npm run dev  then  npx sniff-qa

  Scanned 143 files in 1.2s

  MEDIUM  src/pages/settings.tsx:18
    Hardcoded TODO: "TODO: wire real user API"

  LOW     src/components/Hero.tsx:7
    Placeholder text: "lorem ipsum dolor sit amet"

✓ Scan complete — 2 findings
```

## Note

Source scan finds a subset of what the browser walk finds. For the full picture (broken forms, JS errors, responsive issues, accessibility) always use `--url` against a running app.
