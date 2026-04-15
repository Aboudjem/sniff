import type { BrowserFinding } from '../core/types.js';

export interface ExplorationContext {
  baseUrl: string;
  rootDir: string;
  headless: boolean;
  maxSteps: number;       // bounded step count
  timeout: number;        // per-page navigation timeout
  viewport: { width: number; height: number };
}

export interface ExplorationActionLog {
  step: number;
  timestamp: string;      // ISO 8601
  url: string;
  action: 'click' | 'fill' | 'navigate' | 'scroll' | 'done';
  target: {
    selector: string;
    text?: string;
    type?: string;        // input type for fill actions
  };
  value?: string;         // filled value for fill actions
  reasoning: string;      // AI's reasoning for choosing this action
  observation: {
    urlAfter: string;
    consoleErrors: number;
    networkFailures: number;
    screenshotPath?: string;
    newElementsFound: number;
  };
}

export interface ExplorationDecision {
  action: 'click' | 'fill' | 'navigate' | 'scroll' | 'done';
  selector?: string;
  value?: string;
  url?: string;
  reasoning: string;
}

export interface PageState {
  url: string;
  title: string;
  interactiveElements: InteractiveElement[];
  formFields: FormField[];
}

export interface InteractiveElement {
  selector: string;
  tag: string;
  text: string;
  type?: string;
  role?: string;
  visited: boolean;
}

export interface FormField {
  selector: string;
  name: string;
  type: string;          // text, email, password, number, etc.
  required: boolean;
  placeholder?: string;
}

export interface ExplorationResult {
  actionLog: ExplorationActionLog[];
  findings: BrowserFinding[];
  pagesVisited: string[];
  totalSteps: number;
  duration: number;
}
