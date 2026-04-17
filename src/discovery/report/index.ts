import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { DiscoveryReport } from '../run-types.js';
import { generateDiscoveryJsonReport } from './json.js';
import { generateDiscoveryJunitReport } from './junit.js';
import { generateDiscoveryHtmlReport } from './html.js';

export type DiscoveryReportFormat = 'html' | 'json' | 'junit';

export interface SaveDiscoveryReportOptions {
  rootDir: string;
  report: DiscoveryReport;
  formats?: DiscoveryReportFormat[];
  outputDir?: string;
}

export async function saveDiscoveryReport(options: SaveDiscoveryReportOptions): Promise<string[]> {
  const formats = options.formats ?? ['html', 'json', 'junit'];
  const outputDir = options.outputDir ?? join(options.rootDir, 'sniff-reports', 'discovery');
  await mkdir(outputDir, { recursive: true });

  const slug = options.report.runAt.replace(/[:.]/g, '-').slice(0, 19);
  const savedPaths: string[] = [];

  for (const format of formats) {
    switch (format) {
      case 'json': {
        const path = join(outputDir, `discovery-${slug}.json`);
        await writeFile(path, generateDiscoveryJsonReport(options.report), 'utf-8');
        savedPaths.push(path);
        break;
      }
      case 'junit': {
        const path = join(outputDir, `discovery-${slug}.xml`);
        await writeFile(path, generateDiscoveryJunitReport(options.report), 'utf-8');
        savedPaths.push(path);
        break;
      }
      case 'html': {
        const path = join(outputDir, `discovery-${slug}.html`);
        await writeFile(path, generateDiscoveryHtmlReport(options.report), 'utf-8');
        savedPaths.push(path);
        break;
      }
    }
  }

  return savedPaths;
}

export {
  generateDiscoveryJsonReport,
  generateDiscoveryJunitReport,
  generateDiscoveryHtmlReport,
};
