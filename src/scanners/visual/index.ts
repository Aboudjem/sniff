import { performance } from 'node:perf_hooks';

import type { BrowserScanner, BrowserScanContext, ScanResult } from '../types.js';
import type { BrowserFinding } from '../../core/types.js';
import type { Severity } from '../../core/types.js';

export class VisualRegressionScanner implements BrowserScanner {
  name = 'visual';

  async scan(ctx: BrowserScanContext): Promise<ScanResult> {
    const start = performance.now();
    const findings: BrowserFinding[] = [];

    const visualConfig = ctx.config.visual;
    if (visualConfig?.enabled === false) {
      return { scanner: this.name, findings, duration: performance.now() - start };
    }

    const pixelmatch = (await import('pixelmatch')).default;
    const { PNG } = await import('pngjs');
    const { mkdir, writeFile, readFile, copyFile } = await import('node:fs/promises');
    const { join, dirname } = await import('node:path');

    const baselineDir = join(ctx.rootDir, visualConfig?.baselineDir ?? 'sniff-baselines', ctx.viewport.name);
    const slug = ctx.page.url().replace(ctx.baseUrl, '').replace(/\//g, '_') || '_root';
    const baselinePath = join(baselineDir, slug + '.png');
    const currentPath = join(baselineDir, '.current', slug + '.png');
    const diffPath = join(baselineDir, '.diffs', slug + '.png');

    // Capture current screenshot
    const screenshotBuffer = await ctx.page.screenshot({ fullPage: false });

    // Ensure directories exist
    await mkdir(dirname(currentPath), { recursive: true });
    await mkdir(dirname(diffPath), { recursive: true });

    // Write current screenshot
    await writeFile(currentPath, screenshotBuffer);

    // Try to read baseline
    let baselineBuffer: Buffer;
    try {
      baselineBuffer = await readFile(baselinePath);
    } catch {
      // No baseline exists — first run: copy current as baseline (VIS-01)
      await mkdir(dirname(baselinePath), { recursive: true });
      await copyFile(currentPath, baselinePath);
      findings.push({
        ruleId: 'visual/new-baseline',
        severity: 'info',
        message: `New baseline created for ${slug} on ${ctx.viewport.name}. No comparison available yet.`,
        filePath: baselinePath,
        line: 0,
        column: 0,
        snippet: '',
        url: ctx.page.url(),
        viewport: ctx.viewport.name,
      });
      return { scanner: this.name, findings, duration: performance.now() - start };
    }

    // Parse both PNGs
    let baseline: InstanceType<typeof PNG>;
    try {
      baseline = PNG.sync.read(baselineBuffer);
    } catch (err) {
      // T-03-06: Handle corrupted baseline gracefully
      findings.push({
        ruleId: 'visual/corrupted-baseline',
        severity: 'high',
        message: `Baseline image corrupted for ${slug} on ${ctx.viewport.name}: ${err instanceof Error ? err.message : String(err)}. Run 'sniff update-baselines' to regenerate.`,
        filePath: baselinePath,
        line: 0,
        column: 0,
        snippet: '',
        url: ctx.page.url(),
        viewport: ctx.viewport.name,
      });
      return { scanner: this.name, findings, duration: performance.now() - start };
    }

    const current = PNG.sync.read(screenshotBuffer);
    const { width, height } = baseline;

    // Handle dimension mismatch
    if (current.width !== width || current.height !== height) {
      findings.push({
        ruleId: 'visual/regression',
        severity: 'high',
        message: `Viewport size changed for ${slug} on ${ctx.viewport.name}: baseline ${width}x${height} vs current ${current.width}x${current.height}. Run 'sniff update-baselines' to accept the new size.`,
        filePath: baselinePath,
        line: 0,
        column: 0,
        snippet: `Baseline: ${baselinePath}\nCurrent: ${currentPath}`,
        url: ctx.page.url(),
        viewport: ctx.viewport.name,
        screenshotPath: currentPath,
        fixSuggestion: `Viewport dimensions changed. Review the current screenshot at ${currentPath} and run 'sniff update-baselines' if the change is intentional.`,
      });
      return { scanner: this.name, findings, duration: performance.now() - start };
    }

    const diffImg = new PNG({ width, height });
    const threshold = visualConfig?.threshold ?? 0.1;
    const includeAA = visualConfig?.includeAA ?? false;

    const numDiffPixels = pixelmatch(
      baseline.data,
      current.data,
      diffImg.data,
      width,
      height,
      { threshold, includeAA },
    );

    if (numDiffPixels > 0) {
      const percent = ((numDiffPixels / (width * height)) * 100).toFixed(2);

      // Write diff image
      await writeFile(diffPath, PNG.sync.write(diffImg));

      // Determine severity based on diff percentage
      let severity: Severity;
      const percentNum = parseFloat(percent);
      if (percentNum > 5) {
        severity = 'high';
      } else if (percentNum > 1) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      findings.push({
        ruleId: 'visual/regression',
        severity,
        message: `Visual regression detected: ${numDiffPixels}px changed (${percent}% of viewport) on ${slug}`,
        filePath: diffPath,
        line: 0,
        column: 0,
        snippet: `Baseline: ${baselinePath}\nCurrent: ${currentPath}\nDiff: ${diffPath}`,
        url: ctx.page.url(),
        viewport: ctx.viewport.name,
        screenshotPath: diffPath,
        fixSuggestion: `Review the diff image at ${diffPath}. If the change is intentional, run 'sniff update-baselines' to accept it.`,
      });
    }

    return { scanner: this.name, findings, duration: performance.now() - start };
  }
}
