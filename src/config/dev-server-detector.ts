import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Framework-to-port mappings
// ---------------------------------------------------------------------------

const FRAMEWORK_PORTS: Record<string, number[]> = {
  nextjs: [3000, 3001],
  vite: [5173, 5174],
  svelte: [5173, 5174],
  vue: [5173, 5174],
  react: [3000, 5173],
  angular: [4200],
  astro: [4321],
  remix: [3000],
  nuxt: [3000],
};

// Dev script patterns that indicate a dev server
const DEV_SCRIPT_PATTERNS: Array<{ pattern: RegExp; ports: number[] }> = [
  { pattern: /\bnext\s+dev\b/, ports: [3000] },
  { pattern: /\bvite\b/, ports: [5173] },
  { pattern: /\bsvelte-kit\s+dev\b/, ports: [5173] },
  { pattern: /\bnuxi?\s+dev\b/, ports: [3000] },
  { pattern: /\bastro\s+dev\b/, ports: [4321] },
  { pattern: /\bremix\s+dev\b/, ports: [3000] },
  { pattern: /\bng\s+serve\b/, ports: [4200] },
  { pattern: /\bwebpack\s+serve\b/, ports: [8080] },
  { pattern: /\bparcel\b/, ports: [1234] },
  // Explicit port flags in scripts
  { pattern: /-p\s+(\d+)/, ports: [] }, // captured dynamically
  { pattern: /--port[= ](\d+)/, ports: [] },
  { pattern: /PORT=(\d+)/, ports: [] },
];

// Conservative fallback probe list. Intentionally excludes 5000, 8000, 8080 —
// these collide with macOS AirPlay Receiver (5000), python http.server (8000),
// and every Java/Tomcat/Jenkins default (8080). Issue #4.
const COMMON_PORTS = [3000, 5173, 4200, 4321, 1234];

// How many ports above the default to probe when looking for auto-incremented
// dev servers (Next.js and Vite both roll forward when the default port is busy).
const AUTO_INCREMENT_RANGE = 20;

// ---------------------------------------------------------------------------
// Config-file parsing (no execution — static regex only)
// ---------------------------------------------------------------------------

const VITE_CONFIG_FILES = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs'];
const NUXT_CONFIG_FILES = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs'];
const ASTRO_CONFIG_FILES = ['astro.config.mjs', 'astro.config.ts', 'astro.config.js'];
const ANGULAR_CONFIG_FILE = 'angular.json';

async function readFileIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return undefined;
  }
}

async function readFirstMatching(rootDir: string, names: string[]): Promise<string | undefined> {
  for (const name of names) {
    const content = await readFileIfExists(join(rootDir, name));
    if (content !== undefined) return content;
  }
  return undefined;
}

function extractViteOrNuxtOrAstroPort(content: string): number | undefined {
  // Matches `server: { port: 4000 }` and `devServer: { port: 4000 }`.
  // Regex is deliberately loose — we're not parsing JS, just fishing for
  // the first explicit port under a server/devServer key.
  const match = content.match(/(?:server|devServer)\s*:\s*\{[^}]*\bport\s*:\s*(\d+)/s);
  if (match) {
    const port = parseInt(match[1], 10);
    if (!isNaN(port) && port > 0 && port < 65536) return port;
  }
  return undefined;
}

function extractAngularPort(content: string): number | undefined {
  try {
    const json = JSON.parse(content);
    const projects = json.projects ?? {};
    for (const project of Object.values(projects) as Array<Record<string, unknown>>) {
      const architect = (project.architect ?? project.targets) as Record<string, unknown> | undefined;
      const serve = architect?.serve as Record<string, unknown> | undefined;
      const options = serve?.options as Record<string, unknown> | undefined;
      if (options?.port && typeof options.port === 'number') return options.port;
    }
  } catch {
    // fall through
  }
  return undefined;
}

async function extractConfigFilePort(rootDir: string): Promise<{ port: number; source: string } | undefined> {
  const vite = await readFirstMatching(rootDir, VITE_CONFIG_FILES);
  if (vite) {
    const port = extractViteOrNuxtOrAstroPort(vite);
    if (port !== undefined) return { port, source: 'vite.config' };
  }

  const nuxt = await readFirstMatching(rootDir, NUXT_CONFIG_FILES);
  if (nuxt) {
    const port = extractViteOrNuxtOrAstroPort(nuxt);
    if (port !== undefined) return { port, source: 'nuxt.config' };
  }

  const astro = await readFirstMatching(rootDir, ASTRO_CONFIG_FILES);
  if (astro) {
    const port = extractViteOrNuxtOrAstroPort(astro);
    if (port !== undefined) return { port, source: 'astro.config' };
  }

  const angular = await readFileIfExists(join(rootDir, ANGULAR_CONFIG_FILE));
  if (angular) {
    const port = extractAngularPort(angular);
    if (port !== undefined) return { port, source: 'angular.json' };
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Package.json script parsing
// ---------------------------------------------------------------------------

interface DetectedDevInfo {
  script?: string;
  command?: string;
  ports: number[];
}

async function parseDevScript(rootDir: string): Promise<DetectedDevInfo> {
  try {
    const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf-8'));
    const scripts = pkg.scripts ?? {};

    // Try these script names in order
    const scriptNames = ['dev', 'start', 'serve', 'dev:local', 'start:dev'];

    for (const name of scriptNames) {
      const cmd = scripts[name];
      if (!cmd || typeof cmd !== 'string') continue;

      // Check for explicit port in script
      const portMatch = cmd.match(/(?:-p|--port[= ]|PORT=)\s*(\d+)/);
      if (portMatch) {
        return {
          script: name,
          command: cmd,
          ports: [parseInt(portMatch[1], 10)],
        };
      }

      // Match against known dev server patterns
      for (const { pattern, ports } of DEV_SCRIPT_PATTERNS) {
        if (pattern.test(cmd)) {
          return { script: name, command: cmd, ports };
        }
      }
    }

    // Check dependencies for framework hints
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const detectedPorts: number[] = [];

    for (const [fw, ports] of Object.entries(FRAMEWORK_PORTS)) {
      const depName = fw === 'nextjs' ? 'next' : fw === 'vue' ? 'vue' : fw;
      if (allDeps[depName]) {
        detectedPorts.push(...ports);
      }
    }

    if (detectedPorts.length > 0) {
      return { ports: [...new Set(detectedPorts)] };
    }

    return { ports: [] };
  } catch {
    return { ports: [] };
  }
}

// ---------------------------------------------------------------------------
// Liveness + framework-marker sniffing
// ---------------------------------------------------------------------------

export type FrameworkMarker = 'next' | 'vite' | 'nuxt' | 'astro' | 'remix' | 'angular' | 'svelte' | 'unknown' | null;

interface ProbeResult {
  alive: boolean;
  framework: FrameworkMarker;
}

async function probePort(port: number, hostname = 'localhost'): Promise<ProbeResult> {
  const url = `http://${hostname}:${port}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { Accept: 'text/html,*/*' },
    });

    clearTimeout(timer);
    if (!response.ok && response.status >= 500) return { alive: false, framework: null };

    const framework = detectFrameworkFromResponse(response);
    if (framework === null) {
      // Response, but no framework markers. Try to read body briefly (max ~4KB).
      const reader = response.body?.getReader();
      if (!reader) return { alive: response.ok || response.status < 500, framework: 'unknown' };
      const chunks: Uint8Array[] = [];
      let total = 0;
      const MAX = 4096;
      while (total < MAX) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.byteLength;
        }
      }
      try { await reader.cancel(); } catch { /* ignore */ }
      const snippet = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8').slice(0, MAX);
      return { alive: true, framework: detectFrameworkFromBody(snippet) };
    }

    return { alive: true, framework };
  } catch {
    return { alive: false, framework: null };
  }
}

function detectFrameworkFromResponse(response: Response): FrameworkMarker {
  // Each framework leaves telltale response headers.
  const headers = response.headers;
  const xPoweredBy = headers.get('x-powered-by') ?? '';
  if (xPoweredBy.toLowerCase().includes('next')) return 'next';
  if (xPoweredBy.toLowerCase().includes('express')) return 'unknown'; // could be anything
  // Nuxt dev sends x-nuxt-*
  for (const [k] of headers.entries()) {
    if (k.toLowerCase().startsWith('x-nuxt-')) return 'nuxt';
  }
  return null;
}

function detectFrameworkFromBody(body: string): FrameworkMarker {
  const lower = body.toLowerCase();
  if (lower.includes('/@vite/client')) return 'vite';
  if (lower.includes('__next_data__') || lower.includes('/_next/static')) return 'next';
  if (lower.includes('__nuxt__') || lower.includes('/_nuxt/')) return 'nuxt';
  if (lower.includes('astro-island') || lower.includes('data-astro-cid')) return 'astro';
  if (lower.includes('__remix_context__') || lower.includes('/_build/')) return 'remix';
  if (lower.includes('ng-version=') || lower.includes('data-ng-')) return 'angular';
  if (lower.includes('__sveltekit_data') || lower.includes('/@fs/')) return 'svelte';
  // macOS AirPlay Receiver returns "Control Center" / specific strings
  if (lower.includes('airtunes') || lower.includes('<title>control center')) return null;
  return 'unknown';
}

// Back-compat alias used by other callers in sniff.
async function isPortAlive(port: number, hostname = 'localhost'): Promise<boolean> {
  const { alive } = await probePort(port, hostname);
  return alive;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DetectionCandidate {
  url: string;
  port: number;
  framework: FrameworkMarker;
  method: 'env' | 'script' | 'config' | 'framework' | 'probe' | 'auto-increment';
  detail: string;
}

export interface DetectionResult {
  url: string | undefined;
  method: 'config' | 'env' | 'script' | 'framework' | 'probe' | 'auto-increment' | 'none';
  detail?: string;
  /**
   * All candidate URLs found during detection. The caller may pick, or
   * prompt the user, if multiple frameworks look alive. The chosen `url`
   * is always `candidates[0].url` when candidates is non-empty.
   */
  candidates?: DetectionCandidate[];
}

async function probeAndRecord(
  port: number,
  method: DetectionCandidate['method'],
  detail: string,
  candidates: DetectionCandidate[],
): Promise<DetectionCandidate | undefined> {
  const { alive, framework } = await probePort(port);
  if (!alive) return undefined;
  const candidate: DetectionCandidate = {
    url: `http://localhost:${port}`,
    port,
    framework,
    method,
    detail,
  };
  candidates.push(candidate);
  return candidate;
}

/**
 * Auto-detect the dev server URL by checking (in order):
 * 1. SNIFF_URL or PORT environment variables
 * 2. package.json scripts (dev, start, serve)
 * 3. Framework config files (vite/nuxt/astro/angular)
 * 4. Framework-default ports
 * 5. Auto-increment probe (defaultPort + 1..20) — catches Next.js/Vite port roll
 * 6. Conservative common-port probe (excludes 5000/8000/8080 to avoid AirPlay etc.)
 */
export async function detectDevServerUrl(rootDir: string): Promise<DetectionResult> {
  const candidates: DetectionCandidate[] = [];

  // 1. Environment variables
  if (process.env.SNIFF_URL) {
    return {
      url: process.env.SNIFF_URL,
      method: 'env',
      detail: 'SNIFF_URL',
      candidates: [{
        url: process.env.SNIFF_URL,
        port: 0,
        framework: null,
        method: 'env',
        detail: 'SNIFF_URL',
      }],
    };
  }

  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (!isNaN(port)) {
      const hit = await probeAndRecord(port, 'env', `PORT=${port}`, candidates);
      if (hit) {
        return { url: hit.url, method: 'env', detail: hit.detail, candidates };
      }
    }
  }

  // 2. Parse package.json scripts
  const devInfo = await parseDevScript(rootDir);

  // Try script-detected ports first
  if (devInfo.ports.length > 0) {
    for (const port of devInfo.ports) {
      const detail = devInfo.script
        ? `npm run ${devInfo.script} (port ${port})`
        : `framework default (port ${port})`;
      const hit = await probeAndRecord(port, devInfo.script ? 'script' : 'framework', detail, candidates);
      if (hit) {
        return { url: hit.url, method: hit.method, detail: hit.detail, candidates };
      }
    }

    // 5. Auto-increment probe (Next.js/Vite roll forward on busy port)
    for (const basePort of devInfo.ports) {
      for (let offset = 1; offset <= AUTO_INCREMENT_RANGE; offset++) {
        const port = basePort + offset;
        const { alive, framework } = await probePort(port);
        if (alive && framework && framework !== 'unknown') {
          const candidate: DetectionCandidate = {
            url: `http://localhost:${port}`,
            port,
            framework,
            method: 'auto-increment',
            detail: `auto-incremented from ${basePort} to ${port} (${framework})`,
          };
          candidates.push(candidate);
          return { url: candidate.url, method: 'auto-increment', detail: candidate.detail, candidates };
        }
      }
    }
  }

  // 3. Framework config files — read static config for explicit port overrides
  const configPort = await extractConfigFilePort(rootDir);
  if (configPort) {
    const hit = await probeAndRecord(
      configPort.port,
      'config',
      `${configPort.source} (port ${configPort.port})`,
      candidates,
    );
    if (hit) return { url: hit.url, method: 'config', detail: hit.detail, candidates };
  }

  // 4 & 6. Probe conservative common ports — only ones with clear framework association
  for (const port of COMMON_PORTS) {
    // Skip ports we already probed
    if (candidates.some((c) => c.port === port)) continue;
    const { alive, framework } = await probePort(port);
    if (!alive) continue;
    // Require a framework marker here — probing blind into :3000 on a
    // random machine could land on an unrelated service.
    if (framework && framework !== 'unknown') {
      const candidate: DetectionCandidate = {
        url: `http://localhost:${port}`,
        port,
        framework,
        method: 'probe',
        detail: `probed ${port} (${framework})`,
      };
      candidates.push(candidate);
      return { url: candidate.url, method: 'probe', detail: candidate.detail, candidates };
    }
  }

  // Nothing confirmed
  return { url: undefined, method: 'none', candidates };
}

/**
 * Get the dev start command from package.json (for suggesting to user).
 */
export async function getDevCommand(rootDir: string): Promise<string | undefined> {
  try {
    const pkg = JSON.parse(await readFile(join(rootDir, 'package.json'), 'utf-8'));
    const scripts = pkg.scripts ?? {};

    for (const name of ['dev', 'start', 'serve']) {
      if (scripts[name]) return `npm run ${name}`;
    }
  } catch {
    // no package.json
  }
  return undefined;
}

// Internal exports for tests
export const __testing = {
  isPortAlive,
  probePort,
  parseDevScript,
  extractViteOrNuxtOrAstroPort,
  extractAngularPort,
  detectFrameworkFromBody,
  COMMON_PORTS,
  AUTO_INCREMENT_RANGE,
};
