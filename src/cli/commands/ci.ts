export async function ciCommand(options: {
  output?: string;
  force?: boolean;
  packageName?: string;
}): Promise<void> {
  const pc = (await import('picocolors')).default;
  const { existsSync } = await import('node:fs');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join, dirname } = await import('node:path');
  const { generateGitHubActionsWorkflow, detectPackageManager } = await import('../../ci/workflow-template.js');

  const outputPath = options.output ?? '.github/workflows/sniff.yml';

  // Validate output path ends with .yml or .yaml (T-04-10 mitigation)
  if (!outputPath.endsWith('.yml') && !outputPath.endsWith('.yaml')) {
    console.error(pc.red('Output path must end with .yml or .yaml'));
    process.exit(1);
  }

  // Prevent path traversal outside project directory (T-04-10 mitigation)
  const fullPath = join(process.cwd(), outputPath);
  if (!fullPath.startsWith(process.cwd() + '/') && fullPath !== process.cwd()) {
    console.error(pc.red('Output path must be within the project directory'));
    process.exit(1);
  }

  // Check for existing file
  if (existsSync(fullPath) && !options.force) {
    console.error(pc.yellow(`Workflow already exists at ${outputPath}. Use --force to overwrite.`));
    process.exit(1);
  }

  const packageManager = await detectPackageManager(process.cwd());
  const packageName = options.packageName ?? 'sniff-qa';

  const yaml = generateGitHubActionsWorkflow({
    packageName,
    nodeVersion: '22',
    branches: ['main', 'master'],
    timeoutMinutes: 15,
    retentionDays: 30,
    packageManager,
  });

  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, yaml, 'utf-8');

  console.log(`\n${pc.green('Created')} ${outputPath}\n`);
  console.log(`  Package manager: ${packageManager}`);
  console.log(`  Package name: ${packageName}`);
  console.log(`  Triggers: push + PR to main/master`);
  console.log(`  Caches: Playwright browsers + node_modules`);
  console.log(`\n${pc.dim('The workflow runs')} ${pc.bold('npx ' + packageName + ' run --ci')} ${pc.dim('which enables:')}`);
  console.log(`  ${pc.dim('- Headless browser mode')}`);
  console.log(`  ${pc.dim('- JUnit XML output')}`);
  console.log(`  ${pc.dim('- Flakiness tracking + quarantine')}`);
  console.log(`  ${pc.dim('- Non-zero exit on failure')}\n`);
}
