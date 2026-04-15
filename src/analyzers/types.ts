export interface FrameworkInfo {
  name: 'nextjs' | 'react' | 'vue' | 'svelte' | 'unknown';
  version?: string;
  configFiles: string[];
}

export interface RouteInfo {
  path: string;
  filePath: string;
  framework: string;
  dynamic: boolean;
  params?: string[];
}

export interface ElementInfo {
  tag: string;
  testId?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  role?: string;
  text?: string;
  type?: string;
  href?: string;
  filePath: string;
  line: number;
}

export interface ComponentInfo {
  name: string;
  filePath: string;
  exports: string[];
  hasDefaultExport: boolean;
  elements: ElementInfo[];
  routes: string[];
}

export interface AnalysisResult {
  project: {
    name: string;
    frameworks: FrameworkInfo[];
    rootDir: string;
  };
  routes: RouteInfo[];
  components: ComponentInfo[];
  elements: ElementInfo[];
  metadata: {
    analyzedAt: string;
    duration: number;
    fileCount: number;
    routeCount: number;
    elementCount: number;
  };
}
