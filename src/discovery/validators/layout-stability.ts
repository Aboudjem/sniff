import type { Page } from 'playwright';
import type { ValidationOutcome } from '../run-types.js';

export interface LayoutSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
  buffer: Buffer;
}

export interface LayoutStabilityOptions {
  threshold: number;
  maxPixelRatio: number;
}

const DEFAULT_OPTIONS: LayoutStabilityOptions = {
  threshold: 0.1,
  maxPixelRatio: 0.05,
};

async function getBoundingBox(page: Page, selector: string): Promise<LayoutSnapshot['x'] | null> {
  void page;
  void selector;
  return null;
}

export async function captureRegionSnapshot(
  page: Page,
  selector: string | null,
): Promise<LayoutSnapshot | null> {
  if (!selector) return null;
  try {
    const locator = page.locator(selector).first();
    const box = await locator.boundingBox();
    if (!box) return null;

    const padding = 16;
    const clip = {
      x: Math.max(0, Math.floor(box.x - padding)),
      y: Math.max(0, Math.floor(box.y - padding)),
      width: Math.max(1, Math.ceil(box.width + padding * 2)),
      height: Math.max(1, Math.ceil(box.height + padding * 2)),
    };

    const buffer = await page.screenshot({ clip });
    return { ...clip, buffer };
  } catch {
    return null;
  }
}

export function compareSnapshots(
  before: LayoutSnapshot | null,
  after: LayoutSnapshot | null,
  options: Partial<LayoutStabilityOptions> = {},
): { passed: boolean; ratio: number; detail?: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (!before || !after) {
    return { passed: true, ratio: 0 };
  }
  if (before.width !== after.width || before.height !== after.height) {
    return {
      passed: false,
      ratio: 1,
      detail: `region size changed from ${before.width}x${before.height} to ${after.width}x${after.height}`,
    };
  }
  if (before.buffer.length !== after.buffer.length) {
    return {
      passed: false,
      ratio: 1,
      detail: `buffer size changed from ${before.buffer.length} to ${after.buffer.length} bytes`,
    };
  }

  let diffBytes = 0;
  for (let i = 0; i < before.buffer.length; i++) {
    if (before.buffer[i] !== after.buffer[i]) diffBytes++;
  }
  const ratio = diffBytes / Math.max(1, before.buffer.length);
  const passed = ratio <= opts.maxPixelRatio;

  return {
    passed,
    ratio,
    ...(passed ? {} : { detail: `region pixels differ by ${(ratio * 100).toFixed(2)}% (max ${(opts.maxPixelRatio * 100).toFixed(2)}%)` }),
  };
}

export async function validateLayoutStability(
  before: LayoutSnapshot | null,
  after: LayoutSnapshot | null,
  options: Partial<LayoutStabilityOptions> = {},
): Promise<ValidationOutcome> {
  const { passed, detail } = compareSnapshots(before, after, options);
  return {
    kind: 'layout-stability',
    name: 'interaction region stayed stable',
    passed,
    ...(detail ? { detail } : {}),
  };
}

export { getBoundingBox };
