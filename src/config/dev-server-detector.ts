import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Framework-to-port mappings
// ---------------------------------------------------------------------------

const FRAMEWORK_PORTS: Record<string, number[]> = {
  nextjs: [3000, 3001],
  vite: [5173, 5174],
  svelte: [5173, 5174],
  vue: [5173, 5174, 8080],
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

// Common ports to try as last resort
const COMMON_PORTS = [3000, 5173, 8080, 4200, 8000, 5000, 4321, 1234];

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
// Port health check
// ---------------------------------------------------------------------------

async function isPortAlive(port: number, hostname = 'localhost'): Promise<boolean> {
  const url = `http://${hostname}:${port}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);
    return response.ok || response.status < 500;
  } catch {
    // HEAD might fail, try GET
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timer);
      return response.ok || response.status < 500;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DetectionResult {
  url: string | undefined;
  method: 'config' | 'env' | 'script' | 'framework' | 'probe' | 'none';
  detail?: string;
}

/**
 * Auto-detect the dev server URL by checking (in order):
 * 1. SNIFF_URL or PORT environment variables
 * 2. package.json scripts (dev, start, serve)
 * 3. Framework-default ports
 * 4. Common port probing
 */
export async function detectDevServerUrl(rootDir: string): Promise<DetectionResult> {
  // 1. Environment variables
  if (process.env.SNIFF_URL) {
    return { url: process.env.SNIFF_URL, method: 'env', detail: 'SNIFF_URL' };
  }

  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (!isNaN(port)) {
      const alive = await isPortAlive(port);
      if (alive) {
        return { url: `http://localhost:${port}`, method: 'env', detail: `PORT=${port}` };
      }
    }
  }

  // 2. Parse package.json scripts
  const devInfo = await parseDevScript(rootDir);

  // Try script-detected ports first
  if (devInfo.ports.length > 0) {
    for (const port of devInfo.ports) {
      if (await isPortAlive(port)) {
        const detail = devInfo.script
          ? `npm run ${devInfo.script} (port ${port})`
          : `framework default (port ${port})`;
        return {
          url: `http://localhost:${port}`,
          method: devInfo.script ? 'script' : 'framework',
          detail,
        };
      }
    }
  }

  // 3. Probe common ports
  for (const port of COMMON_PORTS) {
    if (await isPortAlive(port)) {
      return {
        url: `http://localhost:${port}`,
        method: 'probe',
        detail: `found server on port ${port}`,
      };
    }
  }

  // 4. Nothing found
  return { url: undefined, method: 'none' };
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
