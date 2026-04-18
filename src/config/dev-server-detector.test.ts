import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { detectDevServerUrl, __testing } from './dev-server-detector.js';

const { COMMON_PORTS, extractViteOrNuxtOrAstroPort, extractAngularPort, detectFrameworkFromBody } = __testing;

describe('COMMON_PORTS conservatism', () => {
  it('excludes macOS AirPlay / python / tomcat ghost ports', () => {
    // Issue #4: port 5000 collides with macOS AirPlay Receiver, 8000 with
    // python -m http.server, 8080 with every Java dev server. These were in
    // the original probe list and caused false-positive dev-server detection.
    expect(COMMON_PORTS).not.toContain(5000);
    expect(COMMON_PORTS).not.toContain(8000);
    expect(COMMON_PORTS).not.toContain(8080);
  });

  it('keeps canonical framework defaults', () => {
    expect(COMMON_PORTS).toContain(3000); // Next.js, Remix, Nuxt
    expect(COMMON_PORTS).toContain(5173); // Vite, SvelteKit
    expect(COMMON_PORTS).toContain(4200); // Angular
    expect(COMMON_PORTS).toContain(4321); // Astro
  });
});

describe('extractViteOrNuxtOrAstroPort', () => {
  it('pulls port from server.port block', () => {
    const vite = `
      export default defineConfig({
        plugins: [react()],
        server: {
          port: 4000,
          host: true,
        },
      });
    `;
    expect(extractViteOrNuxtOrAstroPort(vite)).toBe(4000);
  });

  it('pulls port from devServer.port block (Nuxt)', () => {
    const nuxt = `
      export default defineNuxtConfig({
        devServer: {
          port: 3333,
          host: '0.0.0.0',
        },
      });
    `;
    expect(extractViteOrNuxtOrAstroPort(nuxt)).toBe(3333);
  });

  it('returns undefined when no port is declared', () => {
    const vite = `export default defineConfig({ plugins: [react()] });`;
    expect(extractViteOrNuxtOrAstroPort(vite)).toBeUndefined();
  });
});

describe('extractAngularPort', () => {
  it('pulls port from projects.<name>.architect.serve.options.port', () => {
    const angularJson = JSON.stringify({
      projects: {
        demo: {
          architect: {
            serve: { options: { port: 4201 } },
          },
        },
      },
    });
    expect(extractAngularPort(angularJson)).toBe(4201);
  });

  it('supports the `targets` variant (Angular 15+)', () => {
    const angularJson = JSON.stringify({
      projects: {
        demo: {
          targets: {
            serve: { options: { port: 4300 } },
          },
        },
      },
    });
    expect(extractAngularPort(angularJson)).toBe(4300);
  });

  it('returns undefined on malformed JSON', () => {
    expect(extractAngularPort('{ not json')).toBeUndefined();
  });
});

describe('detectFrameworkFromBody', () => {
  it('recognizes Vite by @vite/client tag', () => {
    expect(detectFrameworkFromBody('<script type="module" src="/@vite/client"></script>')).toBe('vite');
  });

  it('recognizes Next.js by __NEXT_DATA__ or /_next/static', () => {
    expect(detectFrameworkFromBody('<script id="__NEXT_DATA__"></script>')).toBe('next');
    expect(detectFrameworkFromBody('<link href="/_next/static/chunks/main.js" />')).toBe('next');
  });

  it('recognizes Nuxt by __NUXT__ or /_nuxt/', () => {
    expect(detectFrameworkFromBody('<script>window.__NUXT__={}</script>')).toBe('nuxt');
    expect(detectFrameworkFromBody('<link href="/_nuxt/entry.js" />')).toBe('nuxt');
  });

  it('recognizes Astro by astro-island', () => {
    expect(detectFrameworkFromBody('<astro-island component-url="/_astro/Thing.js">')).toBe('astro');
  });

  it('recognizes SvelteKit by __sveltekit_data', () => {
    expect(detectFrameworkFromBody('<script>__sveltekit_data={}</script>')).toBe('svelte');
  });

  it('recognizes Angular by ng-version attribute', () => {
    expect(detectFrameworkFromBody('<app-root ng-version="17.0.0">')).toBe('angular');
  });

  it('returns null for macOS AirPlay Receiver ("Control Center")', () => {
    // AirPlay Receiver on macOS returns an HTML body with a "Control Center"
    // title. Used to be picked up as a dev server because isPortAlive only
    // checked status < 500.
    expect(detectFrameworkFromBody('<title>Control Center</title>')).toBe(null);
    expect(detectFrameworkFromBody('<html><body>AirTunes</body></html>')).toBe(null);
  });

  it('returns "unknown" when body has HTML but no recognizable marker', () => {
    expect(detectFrameworkFromBody('<html><body>Hello world</body></html>')).toBe('unknown');
  });
});

describe('detectDevServerUrl (env override)', () => {
  let tmpDir: string;
  const savedEnv = { ...process.env };

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-dev-server-'));
    delete process.env.SNIFF_URL;
    delete process.env.PORT;
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    process.env = { ...savedEnv };
  });

  it('respects SNIFF_URL env override and returns it unprobed', async () => {
    // SNIFF_URL short-circuits the whole probe path — no network touched,
    // no flakiness possible. The rest of the detector is covered by the
    // pure-unit tests above (COMMON_PORTS shape, config parsers, body
    // sniffer) and by the real discover E2E against fixture projects.
    process.env.SNIFF_URL = 'http://localhost:9999';
    const result = await detectDevServerUrl(tmpDir);
    expect(result.url).toBe('http://localhost:9999');
    expect(result.method).toBe('env');
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates?.[0].detail).toBe('SNIFF_URL');
  });
});
