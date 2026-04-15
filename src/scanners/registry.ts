import type { Scanner, ScanContext, ScanResult } from './types.js';

export class ScannerRegistry {
  private scanners: Scanner[] = [];

  register(scanner: Scanner): void {
    this.scanners.push(scanner);
  }

  async runAll(ctx: ScanContext): Promise<ScanResult[]> {
    const enabled = this.scanners.filter((s) =>
      ctx.config.scanners.includes(s.name),
    );

    const results: ScanResult[] = [];

    for (const scanner of enabled) {
      try {
        if (scanner.setup) {
          await scanner.setup(ctx);
        }
        const result = await scanner.scan(ctx);
        results.push(result);
      } catch (err) {
        results.push({
          scanner: scanner.name,
          findings: [],
          duration: 0,
          metadata: {
            error: err instanceof Error ? err.message : String(err),
          },
        });
      } finally {
        try {
          if (scanner.teardown) {
            await scanner.teardown();
          }
        } catch {
          // teardown errors are silently ignored
        }
      }
    }

    return results;
  }
}
