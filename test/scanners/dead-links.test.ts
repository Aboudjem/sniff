import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanFileForDeadLinks, defaultDeadLinkConfig } from '../../src/scanners/source/rules/dead-links.js';
import type { DeadLinkConfig } from '../../src/scanners/source/rules/dead-links.js';

function makeConfig(overrides?: Partial<DeadLinkConfig>): DeadLinkConfig {
  return { ...defaultDeadLinkConfig, checkExternal: false, ...overrides };
}

describe('dead-links', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-dl-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('internal link validation', () => {
    it('reports broken internal links in markdown', async () => {
      const md = '# Hello\n\nSee [the guide](./guide.md) for details.\n';
      const filePath = join(tmpDir, 'README.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'README.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('dead-link-internal');
      expect(findings[0].severity).toBe('high');
      expect(findings[0].message).toContain('guide.md');
    });

    it('passes when internal link target exists', async () => {
      await writeFile(join(tmpDir, 'guide.md'), '# Guide\n');
      const md = 'See [the guide](./guide.md) for details.\n';
      const filePath = join(tmpDir, 'README.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'README.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('resolves links relative to the source file directory', async () => {
      await mkdir(join(tmpDir, 'docs'));
      await writeFile(join(tmpDir, 'docs', 'api.md'), '# API\n');

      const md = 'Check [API docs](./api.md)\n';
      const filePath = join(tmpDir, 'docs', 'index.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'docs/index.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('resolves root-relative links from project root', async () => {
      await mkdir(join(tmpDir, 'docs'));
      await writeFile(join(tmpDir, 'docs', 'api.md'), '# API\n');

      const md = 'See [API](/docs/api.md)\n';
      const filePath = join(tmpDir, 'README.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'README.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('detects broken links in HTML href attributes', async () => {
      const html = '<a href="./missing-page.html">Click</a>\n';
      const filePath = join(tmpDir, 'index.html');
      await writeFile(filePath, html);

      const findings = await scanFileForDeadLinks(
        filePath, 'index.html', html, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('dead-link-internal');
    });

    it('detects broken links in JSX src attributes', async () => {
      const jsx = '<img src="./logo.png" alt="logo" />\n';
      const filePath = join(tmpDir, 'App.tsx');
      await writeFile(filePath, jsx);

      const findings = await scanFileForDeadLinks(
        filePath, 'App.tsx', jsx, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('dead-link-internal');
    });
  });

  describe('anchor link validation', () => {
    it('reports broken anchor links', async () => {
      const md = '# Title\n\nJump to [section](#nonexistent)\n';
      const filePath = join(tmpDir, 'doc.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'doc.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('dead-link-anchor');
      expect(findings[0].severity).toBe('medium');
    });

    it('passes when anchor matches a heading', async () => {
      const md = '# My Section\n\nJump to [section](#my-section)\n';
      const filePath = join(tmpDir, 'doc.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'doc.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('passes when anchor matches an HTML id', async () => {
      const html = '<div id="target">Content</div>\n<a href="#target">Link</a>\n';
      const filePath = join(tmpDir, 'page.html');
      await writeFile(filePath, html);

      const findings = await scanFileForDeadLinks(
        filePath, 'page.html', html, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('validates anchors in cross-file links', async () => {
      await writeFile(join(tmpDir, 'guide.md'), '# Setup\n\n## Installation\n');
      const md = 'See [install](./guide.md#installation)\n';
      const filePath = join(tmpDir, 'README.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'README.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('reports broken anchors in cross-file links', async () => {
      await writeFile(join(tmpDir, 'guide.md'), '# Setup\n');
      const md = 'See [install](./guide.md#missing-section)\n';
      const filePath = join(tmpDir, 'README.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'README.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(1);
      expect(findings[0].ruleId).toBe('dead-link-internal');
    });
  });

  describe('external link validation', () => {
    it('skips external links when checkExternal is false', async () => {
      const md = 'Visit [example](https://httpstat.us/404)\n';
      const filePath = join(tmpDir, 'doc.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'doc.md', md, tmpDir, makeConfig({ checkExternal: false }),
      );

      expect(findings).toHaveLength(0);
    });

    it('reports broken external links when enabled', async () => {
      // Mock fetch to avoid real network calls
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      try {
        const md = 'Visit [broken](https://example.com/nonexistent)\n';
        const filePath = join(tmpDir, 'doc.md');
        await writeFile(filePath, md);

        const findings = await scanFileForDeadLinks(
          filePath, 'doc.md', md, tmpDir,
          makeConfig({ checkExternal: true, retries: 0 }),
        );

        expect(findings).toHaveLength(1);
        expect(findings[0].ruleId).toBe('dead-link-external');
        expect(findings[0].message).toContain('404');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('passes for valid external links', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      try {
        const md = 'Visit [example](https://example.com)\n';
        const filePath = join(tmpDir, 'doc.md');
        await writeFile(filePath, md);

        const findings = await scanFileForDeadLinks(
          filePath, 'doc.md', md, tmpDir,
          makeConfig({ checkExternal: true }),
        );

        expect(findings).toHaveLength(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('falls back to GET when HEAD returns 405', async () => {
      const originalFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
        callCount++;
        if (opts?.method === 'HEAD') {
          return Promise.resolve({ ok: false, status: 405 });
        }
        return Promise.resolve({ ok: true, status: 200 });
      });

      try {
        const md = 'Visit [site](https://example.com/page)\n';
        const filePath = join(tmpDir, 'doc.md');
        await writeFile(filePath, md);

        const findings = await scanFileForDeadLinks(
          filePath, 'doc.md', md, tmpDir,
          makeConfig({ checkExternal: true, retries: 0 }),
        );

        expect(findings).toHaveLength(0);
        expect(callCount).toBe(2); // HEAD then GET
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('config options', () => {
    it('respects ignorePatterns', async () => {
      const md = 'See [internal](./missing.md) and [ext](https://ignored.com/path)\n';
      const filePath = join(tmpDir, 'doc.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'doc.md', md, tmpDir,
        makeConfig({ ignorePatterns: ['missing\\.md', 'ignored\\.com'] }),
      );

      expect(findings).toHaveLength(0);
    });

    it('skips non-link file types', async () => {
      const content = 'const url = "https://broken.example.com/404";\n';
      const filePath = join(tmpDir, 'data.json');
      await writeFile(filePath, content);

      const findings = await scanFileForDeadLinks(
        filePath, 'data.json', content, tmpDir, makeConfig({ checkExternal: true }),
      );

      expect(findings).toHaveLength(0);
    });

    it('skips mailto and tel links', async () => {
      const md = '[email](mailto:test@example.com) [phone](tel:+1234567890)\n';
      const filePath = join(tmpDir, 'contact.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'contact.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('skips template variable links', async () => {
      const jsx = '<a href="{{baseUrl}}/page">Link</a>\n<a href="${apiUrl}/endpoint">API</a>\n';
      const filePath = join(tmpDir, 'template.html');
      await writeFile(filePath, jsx);

      const findings = await scanFileForDeadLinks(
        filePath, 'template.html', jsx, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('deduplicates external URLs across multiple occurrences', async () => {
      const originalFetch = globalThis.fetch;
      let fetchCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve({ ok: false, status: 404 });
      });

      try {
        const md = [
          'See [link1](https://example.com/broken)',
          'Also [link2](https://example.com/broken)',
          'And [link3](https://example.com/broken)',
        ].join('\n');
        const filePath = join(tmpDir, 'doc.md');
        await writeFile(filePath, md);

        const findings = await scanFileForDeadLinks(
          filePath, 'doc.md', md, tmpDir,
          makeConfig({ checkExternal: true, retries: 0 }),
        );

        // Only one finding reported (first occurrence)
        expect(findings).toHaveLength(1);
        // Only one fetch call (deduplicated)
        expect(fetchCount).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('handles empty files', async () => {
      const filePath = join(tmpDir, 'empty.md');
      await writeFile(filePath, '');

      const findings = await scanFileForDeadLinks(
        filePath, 'empty.md', '', tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });

    it('handles files with no links', async () => {
      const md = '# Just a heading\n\nSome plain text without links.\n';
      const filePath = join(tmpDir, 'plain.md');
      await writeFile(filePath, md);

      const findings = await scanFileForDeadLinks(
        filePath, 'plain.md', md, tmpDir, makeConfig(),
      );

      expect(findings).toHaveLength(0);
    });
  });
});
