import type { Severity } from '../core/types.js';

export type { Severity };

/**
 * How sure we are the finding is a real, user-visible defect.
 * - `confirmed`: deterministically reproduced with proof (e.g. an HTTP 500, an
 *   axe violation, a horizontal-overflow measurement). Safe to show by default.
 * - `likely`: a strong heuristic fired (e.g. a submit click produced no
 *   observable effect) but a benign explanation is conceivable.
 * - `uncertain`: worth a look but easily a false positive; suppressed from the
 *   default report unless `--all` is passed.
 */
export type Confidence = 'confirmed' | 'likely' | 'uncertain';

/**
 * Reproduction proof. The engine never emits a finding without at least a
 * route and the ordered steps that produced it — "a finding without
 * reproduction proof is not a finding".
 */
export interface Reproduction {
  /** Full URL where the issue was observed. */
  url: string;
  /** Pathname (normalized) for grouping/scoring. */
  route: string;
  /** Ordered, human-readable actions taken to reach/observe the issue. */
  steps: string[];
  /** Relative path to a screenshot captured at the moment of the finding. */
  screenshotPath?: string;
  /** Relevant console lines (errors/warnings) captured during the steps. */
  consoleExcerpt?: string[];
  /** Relevant failed/relevant network lines captured during the steps. */
  networkExcerpt?: string[];
}

export interface QaFinding {
  /** Stable rule id, namespaced by domain, e.g. `route/broken-page`. */
  ruleId: string;
  /** Which of the 12 product issue classes this maps to (1-12). */
  issueClass: number;
  title: string;
  severity: Severity;
  confidence: Confidence;
  /** Proof of reproduction — required. */
  reproduction: Reproduction;
  /** Actionable suggested fix. */
  suggestedFix: string;
  /**
   * Set when the real outcome can only be confirmed outside the browser
   * (e.g. a confirmation email, a webhook, an async job). The finding then
   * explains how to check.
   */
  needsOutOfBandVerification?: boolean;
}

/** A finding as produced by a detector, before the engine attaches proof. */
export interface RawFinding {
  ruleId: string;
  issueClass: number;
  title: string;
  severity: Severity;
  confidence: Confidence;
  /** Steps specific to this finding (the engine prepends the navigation path). */
  steps?: string[];
  suggestedFix: string;
  consoleExcerpt?: string[];
  networkExcerpt?: string[];
  needsOutOfBandVerification?: boolean;
  /**
   * Optional de-dupe key suffix. Findings with the same (ruleId, route, key)
   * are collapsed. Defaults to the title.
   */
  dedupeKey?: string;
}

export interface CrawlStats {
  pagesVisited: number;
  linksChecked: number;
  durationMs: number;
  startUrl: string;
}

export interface CrawlReport {
  findings: QaFinding[];
  stats: CrawlStats;
  /** Routes that were reached and scanned. */
  routes: string[];
  runAt: string;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byConfidence: Record<string, number>;
    byIssueClass: Record<string, number>;
  };
}
