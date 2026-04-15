export const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.svelte-kit/**',
  '**/.sniff/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.map',
];

export const DEFAULT_FAIL_ON: string[] = ['critical', 'high'];

export const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 720 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
];

export const DEFAULT_PERF_BUDGETS = { lcp: 2500, fcp: 1800, tti: 3800 };
export const DEFAULT_VISUAL_THRESHOLD = 0.1;
export const DEFAULT_REPORT_DIR = 'sniff-reports';
export const DEFAULT_BASELINE_DIR = 'sniff-baselines';
