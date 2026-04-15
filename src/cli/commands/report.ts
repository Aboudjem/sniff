export async function reportCommand(options: {
  json?: boolean;
  format?: string;
  output?: string;
}): Promise<void> {
  const { loadLastResults } = await import('../../core/persistence.js');

  const data = await loadLastResults(process.cwd());
  if (!data) {
    console.log("No scan results found. Run 'sniff scan' first.");
    return;
  }

  console.log(`Last scan: ${data.timestamp}`);

  const findings = data.results.flatMap((r) => r.findings);

  // If --format is provided, regenerate reports from stored results
  if (options.format) {
    const { buildReport, saveReport } = await import('../../report/model.js');
    const report = buildReport(
      data.results,
      {
        timestamp: data.timestamp,
        duration: 0,
        targetUrl: '',
        viewports: [],
        commandUsed: 'sniff report',
      },
      [],
    );

    const formats = options.format.split(',').map((f) => f.trim());
    const rootDir = options.output ?? process.cwd();
    const savedPaths = await saveReport(rootDir, report, formats);

    const pc = (await import('picocolors')).default;
    for (const p of savedPaths) {
      console.log(pc.dim(`Report saved to: ${p}`));
    }
    return;
  }

  if (options.json) {
    const bySeverity: Record<string, number> = {};
    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }
    console.log(
      JSON.stringify(
        { findings, summary: { total: findings.length, bySeverity } },
        null,
        2,
      ),
    );
  } else {
    // Use browser-aware formatter if results include browser scanners
    const hasBrowserResults = data.results.some((r) =>
      ['accessibility', 'visual', 'performance'].includes(r.scanner),
    );

    if (hasBrowserResults) {
      const { formatBrowserFindings } = await import('../formatter.js');
      console.log(formatBrowserFindings(findings));
    } else {
      const { formatFindings } = await import('../formatter.js');
      console.log(formatFindings(findings));
    }
  }
}
