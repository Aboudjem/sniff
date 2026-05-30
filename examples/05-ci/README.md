# Example 05 — GitHub Actions CI

Run sniff on every push and pull request. Sniff exits `1` when it finds bugs, so the CI step fails and the uploaded report tells you exactly what to fix.

## Workflow

Save as `.github/workflows/sniff-qa.yml`:

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

      - name: Install dependencies
        run: npm ci

      - name: Build app
        run: npm run build

      - name: Start app in background
        run: npm run start &

      - name: Wait for app to be ready
        run: npx wait-on http://localhost:3000 --timeout 60000

      - name: Run sniff
        run: npx sniff-qa --url http://localhost:3000 --report

      - name: Upload sniff report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: sniff-report-${{ github.sha }}
          path: sniff-reports/sniff-report.html
```

## Notes

- `npx wait-on` polls until the app responds (install once: `npm i -D wait-on`)
- `if: always()` uploads the report even when sniff finds bugs (exits 1)
- The artifact appears in the Actions run summary; click to download the self-contained HTML
- Pass `--fail-on none` to `sniff-qa` if you want warnings without blocking merges

## Source-only CI (no preview deploy)

For branches without a running app, use the source scan instead:

```yaml
      - name: Run sniff (source scan)
        run: npx sniff-qa scan
```
