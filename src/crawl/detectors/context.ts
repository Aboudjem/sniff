import type { Page } from 'playwright';
import type { PageEvidence } from '../evidence.js';
import type { RawFinding } from '../types.js';

export interface DetectorContext {
  page: Page;
  /** Full URL of the page being analyzed. */
  url: string;
  /** Normalized pathname. */
  route: string;
  viewport: 'desktop' | 'mobile';
  /** HTTP status of the main navigation response (null if it never resolved). */
  navStatus: number | null;
  /** Console/network evidence collected during navigation + settle. */
  evidence: PageEvidence;
  baseOrigin: string;
  /** Re-navigate the page to `url` from a clean state (used by interaction probes). */
  freshNavigate: () => Promise<void>;
}

export type Detector = (ctx: DetectorContext) => Promise<RawFinding[]>;
