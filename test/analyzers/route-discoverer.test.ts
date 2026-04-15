import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverRoutes } from '../../src/analyzers/route-discoverer.js';
import type { FrameworkInfo, RouteInfo } from '../../src/analyzers/types.js';

describe('discoverRoutes', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-routes-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('Next.js App Router', () => {
    const nextjsFramework: FrameworkInfo[] = [
      { name: 'nextjs', version: '14.x', configFiles: ['next.config.js'] },
    ];

    it('discovers app/page.tsx as route /', async () => {
      await mkdir(join(tmpDir, 'app'), { recursive: true });
      await writeFile(join(tmpDir, 'app', 'page.tsx'), 'export default function Home() {}');

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/',
          framework: 'nextjs-app',
          dynamic: false,
        }),
      );
    });

    it('discovers app/dashboard/page.tsx as /dashboard', async () => {
      await mkdir(join(tmpDir, 'app', 'dashboard'), { recursive: true });
      await writeFile(join(tmpDir, 'app', 'dashboard', 'page.tsx'), 'export default function Dashboard() {}');

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/dashboard',
          framework: 'nextjs-app',
        }),
      );
    });

    it('discovers app/users/[id]/page.tsx as /users/[id] with dynamic: true and params: ["id"]', async () => {
      await mkdir(join(tmpDir, 'app', 'users', '[id]'), { recursive: true });
      await writeFile(join(tmpDir, 'app', 'users', '[id]', 'page.tsx'), 'export default function User() {}');

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/users/[id]',
          framework: 'nextjs-app',
          dynamic: true,
          params: ['id'],
        }),
      );
    });

    it('strips route groups: app/(marketing)/about/page.tsx becomes /about', async () => {
      await mkdir(join(tmpDir, 'app', '(marketing)', 'about'), { recursive: true });
      await writeFile(
        join(tmpDir, 'app', '(marketing)', 'about', 'page.tsx'),
        'export default function About() {}',
      );

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/about',
          framework: 'nextjs-app',
        }),
      );
    });

    it('does NOT discover app/layout.tsx as a route', async () => {
      await mkdir(join(tmpDir, 'app'), { recursive: true });
      await writeFile(join(tmpDir, 'app', 'layout.tsx'), 'export default function Layout() {}');
      await writeFile(join(tmpDir, 'app', 'page.tsx'), 'export default function Home() {}');

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      const filePaths = routes.map((r: RouteInfo) => r.filePath);
      expect(filePaths).not.toContainEqual(expect.stringContaining('layout.tsx'));
    });
  });

  describe('Next.js Pages Router', () => {
    const nextjsFramework: FrameworkInfo[] = [
      { name: 'nextjs', version: '14.x', configFiles: ['next.config.js'] },
    ];

    it('discovers pages/index.tsx as / and pages/settings.tsx as /settings', async () => {
      await mkdir(join(tmpDir, 'pages'), { recursive: true });
      await writeFile(join(tmpDir, 'pages', 'index.tsx'), 'export default function Home() {}');
      await writeFile(join(tmpDir, 'pages', 'settings.tsx'), 'export default function Settings() {}');

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/',
          framework: 'nextjs-pages',
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/settings',
          framework: 'nextjs-pages',
        }),
      );
    });

    it('excludes pages/_app.tsx and pages/_document.tsx', async () => {
      await mkdir(join(tmpDir, 'pages'), { recursive: true });
      await writeFile(join(tmpDir, 'pages', '_app.tsx'), 'export default function App() {}');
      await writeFile(join(tmpDir, 'pages', '_document.tsx'), 'export default function Doc() {}');
      await writeFile(join(tmpDir, 'pages', 'index.tsx'), 'export default function Home() {}');

      const routes = await discoverRoutes(tmpDir, nextjsFramework);

      const paths = routes.map((r: RouteInfo) => r.path);
      expect(paths).not.toContainEqual(expect.stringContaining('_app'));
      expect(paths).not.toContainEqual(expect.stringContaining('_document'));
      expect(paths).toContain('/');
    });
  });

  describe('SvelteKit', () => {
    const svelteFramework: FrameworkInfo[] = [
      { name: 'svelte', version: '4.x', configFiles: ['svelte.config.js'] },
    ];

    it('discovers src/routes/+page.svelte as / and src/routes/blog/[slug]/+page.svelte as /blog/[slug]', async () => {
      await mkdir(join(tmpDir, 'src', 'routes', 'blog', '[slug]'), { recursive: true });
      await writeFile(join(tmpDir, 'src', 'routes', '+page.svelte'), '<h1>Home</h1>');
      await writeFile(
        join(tmpDir, 'src', 'routes', 'blog', '[slug]', '+page.svelte'),
        '<h1>Blog Post</h1>',
      );

      const routes = await discoverRoutes(tmpDir, svelteFramework);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/',
          framework: 'sveltekit',
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog/[slug]',
          framework: 'sveltekit',
          dynamic: true,
          params: ['slug'],
        }),
      );
    });
  });

  describe('HTML Fallback', () => {
    it('falls back to scanning *.html files when no framework detected, converts index.html to / and about.html to /about', async () => {
      await writeFile(
        join(tmpDir, 'index.html'),
        '<html><body><a href="/contact">Contact</a></body></html>',
      );
      await writeFile(
        join(tmpDir, 'about.html'),
        '<html><body><a href="/">Home</a></body></html>',
      );

      const routes = await discoverRoutes(tmpDir, []);

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/',
          framework: 'html-static',
          dynamic: false,
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/about',
          framework: 'html-static',
          dynamic: false,
        }),
      );
    });

    it('extracts routes from <a href> and <form action> attributes', async () => {
      await writeFile(
        join(tmpDir, 'index.html'),
        `<html><body>
          <a href="/products">Products</a>
          <a href="/services">Services</a>
          <form action="/submit">
            <input type="text" />
          </form>
        </body></html>`,
      );

      const routes = await discoverRoutes(tmpDir, []);

      const paths = routes.map((r: RouteInfo) => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/products');
      expect(paths).toContain('/services');
      expect(paths).toContain('/submit');
    });
  });

  describe('React Router', () => {
    it('finds routes from createBrowserRouter config in source file', async () => {
      await mkdir(join(tmpDir, 'src'), { recursive: true });
      await writeFile(
        join(tmpDir, 'src', 'router.tsx'),
        `import { createBrowserRouter } from 'react-router-dom';

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/about', element: <About /> },
  { path: '/users/:id', element: <UserDetail /> },
]);`,
      );

      const reactFramework: FrameworkInfo[] = [
        { name: 'react', version: '18.x', configFiles: [] },
      ];

      const routes = await discoverRoutes(tmpDir, reactFramework);

      const paths = routes.map((r: RouteInfo) => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/about');
      expect(paths).toContain('/users/:id');

      const dynamicRoute = routes.find((r: RouteInfo) => r.path === '/users/:id');
      expect(dynamicRoute?.dynamic).toBe(true);
      expect(dynamicRoute?.framework).toBe('react-router');
    });
  });

  describe('Vue Router', () => {
    it('finds routes from router config file', async () => {
      await mkdir(join(tmpDir, 'src', 'router'), { recursive: true });
      await writeFile(
        join(tmpDir, 'src', 'router', 'index.ts'),
        `import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  { path: '/', component: Home },
  { path: '/dashboard', component: Dashboard },
];

export default createRouter({ history: createWebHistory(), routes });`,
      );

      const vueFramework: FrameworkInfo[] = [
        { name: 'vue', version: '3.x', configFiles: [] },
      ];

      const routes = await discoverRoutes(tmpDir, vueFramework);

      const paths = routes.map((r: RouteInfo) => r.path);
      expect(paths).toContain('/');
      expect(paths).toContain('/dashboard');
      expect(routes[0]?.framework).toBe('vue-router');
    });
  });
});
