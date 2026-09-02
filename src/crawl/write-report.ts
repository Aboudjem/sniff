import { join } from 'node:path';
import type { CrawlReport } from './types.js';
import { renderHtmlReport } from './report-html.js';
import { redactValue } from '../core/redaction.js';

export interface CrawlArtifacts {
  jsonPath: string;
  htmlPath?: string;
}

/**
 * The single place the crawl writes its report files.
 *
 * Both artifacts are rendered from one redacted copy of the report, so the HTML
 * and the JSON cannot disagree, and HTML escaping cannot smuggle a credential
 * past a string match: redaction happens on the object, before rendering.
 * `redactValue` is a no-op unless a storage state has been loaded.
 */
export async function writeCrawlArtifacts(opts: {
  reportDir: string;
  report: CrawlReport;
  html?: boolean;
  title?: string;
}): Promise<CrawlArtifacts> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const safe = redactValue(opts.report);

  await mkdir(opts.reportDir, { recursive: true }).catch(() => {});

  const jsonPath = join(opts.reportDir, 'sniff-crawl.json');
  await writeFile(jsonPath, JSON.stringify(safe, null, 2)).catch(() => {});

  if (!opts.html) return { jsonPath };

  const htmlPath = join(opts.reportDir, 'sniff-report.html');
  await writeFile(
    htmlPath,
    renderHtmlReport(safe, opts.title ? { title: opts.title } : {}),
  ).catch(() => {});
  return { jsonPath, htmlPath };
}
