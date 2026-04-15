export async function reportCommand(options: {
  json?: boolean;
}): Promise<void> {
  const { loadLastResults } = await import('../../core/persistence.js');

  const data = await loadLastResults(process.cwd());
  if (!data) {
    console.log("No scan results found. Run 'sniff scan' first.");
    return;
  }

  console.log(`Last scan: ${data.timestamp}`);

  const findings = data.results.flatMap((r) => r.findings);

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
    const { formatFindings } = await import('../formatter.js');
    console.log(formatFindings(findings));
  }
}
