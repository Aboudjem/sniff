import { describe, it, expect } from 'vitest';
import { checkPlaywrightBrowsers } from './ensure-browsers.js';

describe('checkPlaywrightBrowsers', () => {
  it('returns a structured status object', async () => {
    const result = await checkPlaywrightBrowsers();
    // The actual status depends on whether playwright's chromium is
    // installed in this environment. Both branches are valid. What we
    // care about is that the shape is stable and does NOT silently shell
    // out to `npx playwright install`.
    expect(['installed', 'missing', 'error']).toContain(result.status);
    if (result.status === 'missing') {
      expect(result.installCommand).toBe('npx playwright install chromium');
      expect(result.installSizeMb).toBeGreaterThan(0);
    }
  });
});
