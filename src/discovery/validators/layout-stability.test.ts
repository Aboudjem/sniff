import { describe, it, expect } from 'vitest';
import { compareSnapshots, validateLayoutStability, type LayoutSnapshot } from './layout-stability.js';

function snap(partial: Partial<LayoutSnapshot>): LayoutSnapshot {
  return {
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    buffer: Buffer.alloc(400),
    ...partial,
  };
}

describe('compareSnapshots', () => {
  it('passes when either snapshot is null', () => {
    expect(compareSnapshots(null, snap({})).passed).toBe(true);
    expect(compareSnapshots(snap({}), null).passed).toBe(true);
  });

  it('passes when buffers are identical', () => {
    const before = snap({ buffer: Buffer.from([1, 2, 3, 4, 5]) });
    const after = snap({ buffer: Buffer.from([1, 2, 3, 4, 5]) });
    const result = compareSnapshots(before, after);
    expect(result.passed).toBe(true);
    expect(result.ratio).toBe(0);
  });

  it('fails when region width changes', () => {
    const before = snap({ width: 100 });
    const after = snap({ width: 120 });
    const result = compareSnapshots(before, after);
    expect(result.passed).toBe(false);
    expect(result.detail).toContain('region size changed');
  });

  it('fails when buffer length differs', () => {
    const before = snap({ buffer: Buffer.alloc(400) });
    const after = snap({ buffer: Buffer.alloc(800) });
    const result = compareSnapshots(before, after);
    expect(result.passed).toBe(false);
  });

  it('passes when diff ratio is below the default threshold', () => {
    const base = Buffer.alloc(1000, 10);
    const mod = Buffer.from(base);
    for (let i = 0; i < 40; i++) mod[i] = 99;
    const result = compareSnapshots(snap({ buffer: base }), snap({ buffer: mod }));
    expect(result.passed).toBe(true);
    expect(result.ratio).toBeCloseTo(0.04, 2);
  });

  it('fails when diff ratio exceeds the threshold', () => {
    const base = Buffer.alloc(1000, 10);
    const mod = Buffer.from(base);
    for (let i = 0; i < 500; i++) mod[i] = 99;
    const result = compareSnapshots(snap({ buffer: base }), snap({ buffer: mod }), { maxPixelRatio: 0.1 });
    expect(result.passed).toBe(false);
    expect(result.ratio).toBeGreaterThan(0.1);
  });
});

describe('validateLayoutStability', () => {
  it('returns the kind layout-stability', async () => {
    const outcome = await validateLayoutStability(null, null);
    expect(outcome.kind).toBe('layout-stability');
    expect(outcome.passed).toBe(true);
  });

  it('marks outcome as failed when buffers diverge', async () => {
    const before = snap({ buffer: Buffer.alloc(100, 0) });
    const after = snap({ buffer: Buffer.alloc(100, 255) });
    const outcome = await validateLayoutStability(before, after);
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toMatch(/region pixels differ/);
  });
});
