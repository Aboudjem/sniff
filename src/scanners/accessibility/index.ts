import { performance } from 'node:perf_hooks';

import type { BrowserScanner, BrowserScanContext, ScanResult } from '../types.js';
import type { BrowserFinding } from '../../core/types.js';
import type { Severity } from '../../core/types.js';

function mapAxeImpact(impact: string | null | undefined): Severity {
  switch (impact) {
    case 'critical': return 'critical';
    case 'serious': return 'high';
    case 'moderate': return 'medium';
    case 'minor': return 'low';
    default: return 'medium';
  }
}

function buildFixSuggestion(
  violation: { id: string; helpUrl: string },
  node: { failureSummary?: string; any?: Array<{ id: string; data?: Record<string, unknown> }> },
): string {
  if (violation.id === 'color-contrast') {
    const contrastData = node.any?.find((check) => check.id === 'color-contrast');
    if (contrastData?.data) {
      const expected = contrastData.data['expected'] as string | undefined;
      const actual = contrastData.data['contrastRatio'] as number | undefined;
      if (expected && actual !== undefined) {
        return `Expected contrast ratio of at least ${expected}:1, but found ${actual}:1. Increase the color difference between foreground and background.`;
      }
    }
  }

  if (node.failureSummary) {
    return node.failureSummary;
  }

  return `See ${violation.helpUrl} for remediation guidance.`;
}

export class AccessibilityScanner implements BrowserScanner {
  name = 'accessibility';

  async scan(ctx: BrowserScanContext): Promise<ScanResult> {
    const start = performance.now();

    const { AxeBuilder } = await import('@axe-core/playwright');

    const a11yConfig = ctx.config.accessibility;

    const standard = a11yConfig?.standard ?? 'wcag21aa';
    let tags: string[];
    switch (standard) {
      case 'wcag2a':
        tags = ['wcag2a'];
        break;
      case 'wcag2aa':
        tags = ['wcag2a', 'wcag2aa'];
        break;
      case 'wcag21aa':
      default:
        tags = ['wcag2a', 'wcag2aa', 'wcag21aa'];
        break;
    }

    let builder = new AxeBuilder({ page: ctx.page }).withTags(tags);

    // Apply custom rule overrides
    if (a11yConfig?.rules) {
      for (const [ruleId, enabled] of Object.entries(a11yConfig.rules)) {
        if (enabled === false) {
          builder = builder.disableRules([ruleId]);
        }
      }
    }

    // Enable touch target-size rule on mobile viewports (A11Y-02)
    if (ctx.viewport.name === 'mobile') {
      builder = builder.withRules(['target-size']);
    }

    const results = await builder.analyze();

    const findings: BrowserFinding[] = [];
    for (const violation of results.violations) {
      const severity = mapAxeImpact(violation.impact);
      for (const node of violation.nodes) {
        findings.push({
          ruleId: `a11y/${violation.id}`,
          severity,
          message: `${violation.help}. ${violation.description}`,
          filePath: ctx.page.url(),
          line: 0,
          column: 0,
          snippet: node.html,
          url: ctx.page.url(),
          viewport: ctx.viewport.name,
          fixSuggestion: buildFixSuggestion(violation, node),
        });
      }
    }

    return {
      scanner: this.name,
      findings,
      duration: performance.now() - start,
    };
  }
}
