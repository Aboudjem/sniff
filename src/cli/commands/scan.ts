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
  const { loadConfig } = await import('../../config/loader.js');
  const { ScannerRegistry } = await import('../../scanners/registry.js');
  const { SourceScanner } = await import('../../scanners/source/index.js');
  const { saveResults } = await import('../../core/persistence.js');

  const config = await loadConfig(process.cwd());
  const registry = new ScannerRegistry();
  registry.register(new SourceScanner());

  const { RepoAnalyzer } = await import('../../scanners/repo-analyzer.js');
  registry.register(new RepoAnalyzer());

  const ctx = { config, rootDir: process.cwd() };
  const results = await registry.runAll(ctx);

  // Extract analysis from RepoAnalyzer result and generate tests
  const repoResult = results.find((r) => r.scanner === 'repo-analyzer');
  if (repoResult?.metadata?.analysis) {
    const { generateTests } = await import('../../ai/generator.js');
    const analysis = repoResult.metadata.analysis as import('../../analyzers/types.js').AnalysisResult;
    const aiConfig = (config as Record<string, unknown>).ai as Record<string, unknown> | undefined;
    await generateTests(analysis, {
      outputDir: (aiConfig?.outputDir as string) ?? 'sniff-tests',
      maxConcurrency: (aiConfig?.maxConcurrency as number) ?? 5,
      rootDir: process.cwd(),
    });
  }

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

  const hasFailure = findings.some((f) =>
    failOnSeverities.includes(f.severity),
  );

  process.exit(hasFailure ? 1 : 0);
}
