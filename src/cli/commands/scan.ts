import type { Severity } from '../../core/types.js';

const VALID_SEVERITIES: ReadonlySet<string> = new Set([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

export async function scanCommand(options: {
  json?: boolean;
  failOn?: string;
}): Promise<void> {
  const { saveResults } = await import('../../core/persistence.js');
  const { runSourceScan, generateAiTestsIfEnabled } = await import('../../core/quality-run.js');

  const rootDir = process.cwd();
  const { config, results, analysis } = await runSourceScan(rootDir);
  await generateAiTestsIfEnabled(rootDir, config, analysis);

  // Flatten findings
  const findings = results.flatMap((r) => r.findings);

  // Persist for `sniff report`
  await saveResults(process.cwd(), results);

  if (options.json) {
    // JSON output mode (D-12)
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

  // Determine exit code (D-13, CLI-06, T-01-08)
  const failOnInput = options.failOn ?? 'critical,high';
  const failOnSeverities = failOnInput
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is Severity => {
      if (!VALID_SEVERITIES.has(s)) {
        console.error(`Warning: Unknown severity "${s}" in --fail-on, ignoring.`);
        return false;
      }
      return true;
    });

  const failsOnSeverity = findings.some((f) =>
    failOnSeverities.includes(f.severity),
  );

  // Assertion budgets from config, additive to --fail-on.
  const { evaluateSeverityBudget, printBudgetViolations } = await import('../../core/assert-budget.js');
  const failsOnBudget = printBudgetViolations(evaluateSeverityBudget(findings, config.assert));

  process.exit(failsOnSeverity || failsOnBudget ? 1 : 0);
}
