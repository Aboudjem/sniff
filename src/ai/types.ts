import type { RouteInfo, ElementInfo, ComponentInfo, FrameworkInfo } from '../analyzers/types.js';
import type { PageState, ExplorationActionLog, ExplorationDecision } from '../exploration/types.js';
import type { AIProviderName } from '../config/schema.js';

export interface AIProvider {
  name: AIProviderName;
  generateTests(context: RouteTestContext): Promise<GeneratedTest>;
}

export interface AIProviderResolution {
  provider: AIProvider | null;
  name: AIProviderName;
  reason?: string;
}

export interface RouteTestContext {
  route: RouteInfo;
  elements: ElementInfo[];
  components: ComponentInfo[];
  framework: FrameworkInfo;
  sourceContent?: string;
}

export interface GeneratedTest {
  specContent: string;
  reasoning: string;
  route: string;
}

export interface ExplorationProvider {
  decideNextAction(
    pageState: PageState,
    history: ExplorationActionLog[],
  ): Promise<ExplorationDecision>;
}
