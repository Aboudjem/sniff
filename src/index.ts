export { defineConfig } from './config/define-config.js';
export type { SniffConfig, SniffUserConfig } from './config/schema.js';
export type { Finding, Severity } from './core/types.js';
export type { AnalysisResult, RouteInfo, ElementInfo, ComponentInfo, FrameworkInfo } from './analyzers/types.js';
export type { AIProvider, RouteTestContext, GeneratedTest } from './ai/types.js';
export { generateTests } from './ai/generator.js';

// New crawl/flow-walk engine (the default browser experience).
export { runCrawl, formatReportText } from './crawl/index.js';
export type { CrawlOptions, QaFinding, CrawlReport, Confidence, Reproduction } from './crawl/index.js';
