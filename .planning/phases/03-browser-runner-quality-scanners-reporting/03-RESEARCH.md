# Phase 3: Browser Runner + Quality Scanners + Reporting - Research

**Researched:** 2026-04-15
**Phase:** 03-browser-runner-quality-scanners-reporting

## Research Summary

Phase 3 is the largest phase (22 requirements) that transforms sniff from a source-only scanner into a full browser-based QA tool. It requires integrating Playwright for browser execution, axe-core for accessibility, pixelmatch for visual regression, Lighthouse for performance, and building a multi-format reporting system.

## Key Technical Findings

### 1. Playwright Programmatic API (E2E-01 through E2E-06)

**Approach:** Use `playwright` (not `@playwright/test`) for programmatic browser control.

```typescript
import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
```

**Key APIs:**
- `chromium.launch()` — headless browser launch
- `browser.newContext({ viewport: { width, height } })` — viewport configuration per project
- `page.goto(url)` — navigation
- `page.screenshot({ path, fullPage })` — screenshot capture (E2E-03)
- `page.on('console', msg => ...)` — console error monitoring (E2E-04)
- `page.on('response', res => ...)` — network failure detection (E2E-05)
- `page.on('pageerror', err => ...)` — uncaught exception capture

**Viewport projects (E2E-02):**
| Name | Width | Height |
|------|-------|--------|
| desktop | 1280 | 720 |
| mobile | 375 | 667 |
| tablet | 768 | 1024 |

**Auto-discovery (E2E-06):** Combine Phase 2's static element-extractor output with runtime DOM inspection:
```typescript
// Runtime discovery of clickable elements
const clickables = await page.$$eval('a, button, [role="button"], input[type="submit"], [onclick]', els => 
  els.map(el => ({ tag: el.tagName, text: el.textContent?.trim(), selector: /* build selector */ }))
);
```

**Dependencies:** `playwright` (peer dependency — users install browsers via `npx playwright install chromium`)

### 2. Accessibility Scanning with axe-core (A11Y-01 through A11Y-03)

**Package:** `@axe-core/playwright` — official Playwright integration.

```typescript
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag21aa'])  // WCAG 2.1 AA (A11Y-01)
  .analyze();
```

**Touch target validation (A11Y-02):** axe-core includes `target-size` rule (WCAG 2.1 SC 2.5.5). Enable specifically for mobile viewport:
```typescript
new AxeBuilder({ page }).withRules(['target-size'])
```

**Color contrast (A11Y-03):** Built-in axe rules `color-contrast` and `color-contrast-enhanced`. Results include affected elements, expected ratio, and actual ratio — map to fix suggestions.

**Finding mapping:** Each axe violation maps to a `Finding`:
- `ruleId`: `a11y/${violation.id}` (e.g., `a11y/color-contrast`)
- `severity`: Map axe impact (`critical` → `critical`, `serious` → `high`, `moderate` → `medium`, `minor` → `low`)
- `message`: violation.help + violation.helpUrl
- `filePath`: page URL (no source file for runtime a11y)
- `snippet`: violation.nodes[0].html

**Dependencies:** `@axe-core/playwright`

### 3. Visual Regression with pixelmatch (VIS-01 through VIS-03)

**Package:** `pixelmatch` + `pngjs` for pixel-level comparison.

```typescript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const diff = pixelmatch(img1.data, img2.data, diffImg.data, width, height, {
  threshold: 0.1,  // VIS-03: configurable noise tolerance
  includeAA: false  // Ignore anti-aliasing differences
});
```

**Baseline management (VIS-01, VIS-02):**
- Baselines stored in configurable directory (`sniff-baselines/` default)
- Organized as: `{baselineDir}/{viewport}/{route-slug}.png`
- `sniff update-baselines` command overwrites all baselines with current screenshots
- First run with no baselines: auto-create baselines, report as "info" findings

**Smart diff thresholds (VIS-03):**
- `threshold`: Per-pixel color distance threshold (0-1). Default 0.1
- `includeAA`: Whether to detect anti-aliasing. Default false (ignore)
- Configurable in sniff config: `visual: { threshold: 0.1, includeAA: false }`

**Diff output:** Generate a diff image highlighting changed pixels in magenta. Include in HTML report as side-by-side comparison (baseline | current | diff).

**Dependencies:** `pixelmatch`, `pngjs`

### 4. Performance Measurement with Lighthouse (PERF-01 through PERF-03)

**Package:** `lighthouse` programmatic API.

```typescript
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

// Reuse existing Playwright's browser port OR launch separate Chrome
const result = await lighthouse(url, {
  port: chromePort,
  output: 'json',
  onlyCategories: ['performance'],
});
```

**Important consideration:** Lighthouse needs its own Chrome instance — it cannot share Playwright's browser instance directly. Two approaches:

**Option A (Recommended): Sequential Lighthouse after Playwright scans**
- Run Playwright browser scans first (E2E, a11y, visual)
- Close Playwright browser
- Launch Lighthouse separately per unique URL
- Avoids port conflicts and browser state interference

**Option B: chrome-launcher with port sharing**
- Launch Chrome via chrome-launcher
- Connect both Playwright and Lighthouse to it
- More complex, potential state conflicts

**Metrics (PERF-01):**
- LCP (Largest Contentful Paint): `result.lcp.numericValue`
- FCP (First Contentful Paint): `result.audits['first-contentful-paint'].numericValue`
- TTI (Time to Interactive): `result.audits['interactive'].numericValue`

**Budget configuration (PERF-02, PERF-03):**
```typescript
// In sniff.config.ts
performance: {
  budgets: {
    lcp: 2500,   // ms
    fcp: 1800,   // ms
    tti: 3800,   // ms
  }
}
```

**Severity mapping for violations (PERF-03):**
- Exceeds by >100%: critical
- Exceeds by 50-100%: high
- Exceeds by 25-50%: medium
- Exceeds by <25%: low

**Dependencies:** `lighthouse`, `chrome-launcher`

### 5. Report Generation (RPT-01 through RPT-06)

**Internal report model:**
```typescript
interface SniffReport {
  metadata: {
    version: string;
    timestamp: string;
    duration: number;
    targetUrl: string;
    viewports: ViewportConfig[];
  };
  summary: {
    total: number;
    bySeverity: Record<Severity, number>;
    byScanner: Record<string, number>;
    passRate: number;
  };
  findings: Finding[];      // Extended with screenshot paths
  screenshots: Screenshot[]; // Failure screenshots + visual diffs
}
```

**HTML Report (RPT-01, RPT-02, RPT-03, RPT-06):**
- Self-contained single file (inline CSS, base64 images)
- Template approach: TypeScript string template literals (no external template engine needed)
- Sections: Header with summary badges → Scanner group sections → Individual findings with severity → Fix suggestions
- Screenshots embedded as `<img src="data:image/png;base64,..." />`
- `<details>` elements for expand/collapse (no JS needed)
- Dark/light mode via `prefers-color-scheme` media query
- Brutal tone in copy: "Your app has 47 problems. Here they are." not "We found some potential improvements."

**JUnit XML (RPT-04):**
```xml
<testsuites name="sniff" tests="47" failures="12" errors="3">
  <testsuite name="accessibility" tests="15" failures="5">
    <testcase name="color-contrast on /dashboard" classname="a11y">
      <failure message="..." type="high"/>
    </testcase>
  </testsuite>
</testsuites>
```
- No external XML library needed — template literals sufficient for well-formed XML

**JSON (RPT-05):**
- Direct serialization of the internal report model
- `JSON.stringify(report, null, 2)` with the SniffReport interface

### 6. Config Schema Extensions

New config sections needed:
```typescript
// Additions to sniffConfigSchema
browser: z.object({
  headless: z.boolean().default(true),
  slowMo: z.number().default(0),
  timeout: z.number().default(30000),
  baseUrl: z.string().optional(),
}).optional(),

viewports: z.array(z.object({
  name: z.string(),
  width: z.number(),
  height: z.number(),
})).default([
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
]),

accessibility: z.object({
  enabled: z.boolean().default(true),
  standard: z.enum(['wcag2a', 'wcag2aa', 'wcag21aa']).default('wcag21aa'),
  rules: z.record(z.string(), z.boolean()).default({}),
}).optional(),

visual: z.object({
  enabled: z.boolean().default(true),
  baselineDir: z.string().default('sniff-baselines'),
  threshold: z.number().default(0.1),
  includeAA: z.boolean().default(false),
}).optional(),

performance: z.object({
  enabled: z.boolean().default(true),
  budgets: z.object({
    lcp: z.number().default(2500),
    fcp: z.number().default(1800),
    tti: z.number().default(3800),
  }).optional(),
}).optional(),

report: z.object({
  outputDir: z.string().default('sniff-reports'),
  formats: z.array(z.enum(['html', 'json', 'junit'])).default(['html', 'json']),
  openAfter: z.boolean().default(false),
}).optional(),
```

### 7. Scanner Interface Extension

The existing Scanner interface needs browser context support:

```typescript
// Extended scan context for browser-based scanners
interface BrowserScanContext extends ScanContext {
  page: Page;           // Playwright page instance
  viewport: ViewportConfig;
  baseUrl: string;
}

// Browser scanner extends base scanner
interface BrowserScanner extends Scanner {
  scan(ctx: BrowserScanContext): Promise<ScanResult>;
}
```

This allows browser scanners to receive a Playwright page while source scanners continue using the base `ScanContext`.

### 8. Finding Type Extension

The current Finding type needs extension for browser context:

```typescript
interface BrowserFinding extends Finding {
  url: string;           // Page URL where finding occurred
  viewport: string;      // 'desktop' | 'mobile' | 'tablet'
  screenshotPath?: string; // Path to failure screenshot
  fixSuggestion?: string;  // AI or rule-based fix suggestion
}
```

### 9. Integration Architecture

**Execution flow for `sniff run`:**

1. Load config → resolve test files from Phase 2 output
2. Launch Playwright browser (headless by default)
3. For each viewport:
   a. Create browser context with viewport dimensions
   b. For each route/page:
      - Navigate to page
      - Start console/network listeners
      - Run E2E test assertions (from generated tests)
      - Run axe-core accessibility scan
      - Capture screenshot for visual regression comparison
      - Collect console errors and network failures
   c. Close context
4. Close Playwright browser
5. For each unique URL: Run Lighthouse performance audit (sequential)
6. Aggregate all findings into report model
7. Generate reports (HTML, JSON, JUnit XML per config)
8. Display terminal summary
9. Exit with appropriate code (0 = pass, 1 = failures above threshold)

### 10. Dependencies Summary

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `playwright` | Browser automation | Peer dep (user installs) |
| `@axe-core/playwright` | Accessibility scanning | ~2MB |
| `pixelmatch` | Pixel diff comparison | ~15KB |
| `pngjs` | PNG read/write for pixelmatch | ~100KB |
| `lighthouse` | Performance auditing | ~15MB (heavy) |
| `chrome-launcher` | Chrome instance for Lighthouse | ~50KB |

**Note on Lighthouse size:** lighthouse is a heavy dependency (~15MB). Consider making it optional:
- Install as optional dependency
- Graceful degradation if not installed: skip perf scanning with info message
- Or use `lighthouse` as peer dependency like Playwright

### 11. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Lighthouse + Playwright port conflicts | Browser crashes | Run Lighthouse sequentially after closing Playwright |
| Large baseline directories bloating git | Slow clones | Document .gitignore option, suggest LFS for large projects |
| Flaky visual diffs from font rendering | False positives | Anti-aliasing ignore + configurable threshold |
| Lighthouse cold start timing | Inconsistent scores | Run 2 passes, use median |
| Missing Playwright browsers | Crash on first run | Detect and prompt `npx playwright install chromium` |

---

*Research completed: 2026-04-15*
