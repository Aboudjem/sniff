# Example 03 — HTML report

Generate a self-contained HTML report you can share with your team or attach to a PR.

## Command

```bash
npx sniff-qa --url http://localhost:3000 --report
```

## Output

```
sniff v0.7.0  ·  walking http://localhost:3000

  [walk output ...]

✓ Report written: sniff-reports/sniff-report.html
  Open it in any browser. All screenshots and evidence are inlined.
```

## What's in the report

- All findings grouped by severity and route
- Reproduction steps for each finding
- Inlined screenshots (base64 — no external deps, works offline)
- Console and network excerpts as evidence
- Summary table: total findings by class

## Sharing

The `.html` file is fully self-contained. Open it in a browser, email it, or upload it as a CI artifact:

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: sniff-report
    path: sniff-reports/sniff-report.html
```

See [`../05-ci/`](../05-ci/) for the full GitHub Actions example.
