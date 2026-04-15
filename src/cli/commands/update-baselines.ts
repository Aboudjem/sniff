export async function updateBaselinesCommand(options: { yes?: boolean }): Promise<void> {
  const { readdir, copyFile, rm } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { createInterface } = await import('node:readline');
  const { loadConfig } = await import('../../config/loader.js');

  const config = await loadConfig(process.cwd());
  const baselineDir = join(process.cwd(), config.visual?.baselineDir ?? 'sniff-baselines');

  // Discover viewport directories containing .current subdirectories
  let viewportDirs: string[];
  try {
    const entries = await readdir(baselineDir, { withFileTypes: true });
    viewportDirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch {
    console.log('No baseline directory found. Run "sniff run" first to capture screenshots.');
    return;
  }

  // Count current screenshots across all viewports
  let totalCount = 0;
  const viewportCounts: Array<{ name: string; dir: string; files: string[] }> = [];

  for (const vp of viewportDirs) {
    const currentDir = join(baselineDir, vp, '.current');
    try {
      const files = await readdir(currentDir);
      const pngFiles = files.filter((f) => f.endsWith('.png'));
      if (pngFiles.length > 0) {
        viewportCounts.push({ name: vp, dir: join(baselineDir, vp), files: pngFiles });
        totalCount += pngFiles.length;
      }
    } catch {
      // No .current directory for this viewport, skip
    }
  }

  if (totalCount === 0) {
    console.log('No current screenshots found. Run "sniff run" first to capture screenshots.');
    return;
  }

  // Confirmation prompt unless --yes
  if (!options.yes) {
    const confirmed = await promptConfirm(
      `This will overwrite ${totalCount} baseline images. Continue? [y/N] `,
      createInterface,
    );
    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  }

  // Copy .current screenshots to baseline directory, overwriting existing
  for (const vp of viewportCounts) {
    for (const file of vp.files) {
      await copyFile(
        join(vp.dir, '.current', file),
        join(vp.dir, file),
      );
    }

    // Remove .diffs directory
    try {
      await rm(join(vp.dir, '.diffs'), { recursive: true, force: true });
    } catch {
      // Ignore if .diffs doesn't exist
    }
  }

  console.log(`Updated ${totalCount} baselines across ${viewportCounts.length} viewports.`);
}

async function promptConfirm(
  message: string,
  createInterface: typeof import('node:readline').createInterface,
): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}
