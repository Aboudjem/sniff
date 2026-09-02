import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Capability } from './caps.js';

describe('MCP Server', () => {
  describe('module exports', () => {
    it('exports startMcpServer as an async function', async () => {
      const mod = await import('./server.js');
      expect(typeof mod.startMcpServer).toBe('function');
    });

    it('resolves @modelcontextprotocol/sdk McpServer import', async () => {
      const mod = await import('@modelcontextprotocol/sdk/server/mcp.js');
      expect(mod.McpServer).toBeDefined();
    });

    it('resolves @modelcontextprotocol/sdk StdioServerTransport import', async () => {
      const mod = await import('@modelcontextprotocol/sdk/server/stdio.js');
      expect(mod.StdioServerTransport).toBeDefined();
    });
  });

  describe('capability gating', () => {
    it('defaults to every capability when --caps is absent', async () => {
      const { parseCaps, CAPABILITIES } = await import('./caps.js');
      expect(parseCaps(['node', 'sniff', '--mcp'])).toEqual([...CAPABILITIES]);
    });

    it('parses a comma-separated subset', async () => {
      const { parseCaps } = await import('./caps.js');
      expect(parseCaps(['node', 'sniff', '--mcp', '--caps', 'scan,report'])).toEqual(['scan', 'report']);
    });

    it('accepts the --caps=<list> form and tolerates whitespace', async () => {
      const { parseCaps } = await import('./caps.js');
      expect(parseCaps(['--mcp', '--caps= scan , report '])).toEqual(['scan', 'report']);
    });

    it('de-duplicates repeated names', async () => {
      const { parseCaps } = await import('./caps.js');
      expect(parseCaps(['--mcp', '--caps', 'scan,scan,report'])).toEqual(['scan', 'report']);
    });

    it('rejects an unknown capability instead of silently granting nothing', async () => {
      const { parseCaps, CapsError } = await import('./caps.js');
      expect(() => parseCaps(['--mcp', '--caps', 'scan,nope'])).toThrow(CapsError);
      expect(() => parseCaps(['--mcp', '--caps', 'scan,nope'])).toThrow(/Unknown capability: nope/);
    });

    it('rejects an empty --caps list', async () => {
      const { parseCaps, CapsError } = await import('./caps.js');
      expect(() => parseCaps(['--mcp', '--caps', ''])).toThrow(CapsError);
      expect(() => parseCaps(['--mcp', '--caps'])).toThrow(CapsError);
    });

    it('registers all six tools and all five modes by default', async () => {
      const { resolveTools, CAPABILITIES } = await import('./caps.js');
      const { tools, modes } = resolveTools(CAPABILITIES);
      expect(tools).toEqual([
        'sniff',
        'sniff_scan',
        'sniff_run',
        'sniff_discover',
        'sniff_install',
        'sniff_report',
      ]);
      expect(modes).toEqual(['walk', 'scan', 'run', 'discover', 'report']);
    });

    it('shrinks the tool list and the unified mode enum under --caps scan,report', async () => {
      const { parseCaps, resolveTools } = await import('./caps.js');
      const { tools, modes } = resolveTools(parseCaps(['--mcp', '--caps', 'scan,report']));
      expect(tools).toEqual(['sniff', 'sniff_scan', 'sniff_report']);
      expect(modes).toEqual(['scan', 'report']);
      // No browser launch and no browser download reachable from this profile.
      expect(tools).not.toContain('sniff_run');
      expect(tools).not.toContain('sniff_discover');
      expect(tools).not.toContain('sniff_install');
    });

    it('maps the legacy run mode to the walk capability', async () => {
      const { resolveTools } = await import('./caps.js');
      const { modes } = resolveTools(['walk']);
      expect(modes).toContain('walk');
      expect(modes).toContain('run');
    });

    it('expands walk to include scan, because a walk falls back to a source scan', async () => {
      const { expandCaps, resolveTools } = await import('./caps.js');
      expect(expandCaps(['walk'])).toEqual(['walk', 'scan']);
      const { tools, modes } = resolveTools(['walk']);
      expect(tools).toEqual(['sniff', 'sniff_scan', 'sniff_run']);
      expect(modes).toEqual(['walk', 'scan', 'run']);
    });

    it('drops the unified tool when only install is granted', async () => {
      const { resolveTools } = await import('./caps.js');
      const { tools, modes } = resolveTools(['install']);
      expect(tools).toEqual(['sniff_install']);
      expect(modes).toEqual([]);
    });
  });

  describe('tools/list over a real MCP connection', () => {
    async function listTools(caps?: Capability[]): Promise<{
      names: string[];
      modes: string[] | undefined;
    }> {
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
      const { startMcpServer } = await import('./server.js');
      const { CAPABILITIES } = await import('./caps.js');

      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      const client = new Client({ name: 'test', version: '0' }, { capabilities: {} });

      await startMcpServer(caps ?? [...CAPABILITIES], serverTransport);
      await client.connect(clientTransport);

      const res = await client.listTools();
      const unified = res.tools.find((t) => t.name === 'sniff');
      const schema = unified?.inputSchema as
        | { properties?: { mode?: { enum?: string[] } } }
        | undefined;
      await client.close();
      return {
        names: res.tools.map((t) => t.name),
        modes: schema?.properties?.mode?.enum,
      };
    }

    it('registers all six tools and all five modes by default', async () => {
      const { names, modes } = await listTools();
      expect(names).toEqual([
        'sniff',
        'sniff_scan',
        'sniff_run',
        'sniff_discover',
        'sniff_install',
        'sniff_report',
      ]);
      expect(modes).toEqual(['walk', 'scan', 'run', 'discover', 'report']);
    });

    it('exposes only the scan and report surface under --caps scan,report', async () => {
      const { names, modes } = await listTools(['scan', 'report']);
      expect(names).toEqual(['sniff', 'sniff_scan', 'sniff_report']);
      expect(modes).toEqual(['scan', 'report']);
      expect(names).not.toContain('sniff_run');
      expect(names).not.toContain('sniff_discover');
      expect(names).not.toContain('sniff_install');
    });

    it('exposes only the install tool under --caps install', async () => {
      const { names, modes } = await listTools(['install']);
      expect(names).toEqual(['sniff_install']);
      expect(modes).toBeUndefined();
    });
  });

  describe('handlers', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    describe('handleSniffScan', () => {
      it('returns error for non-absolute rootDir', async () => {
        const { handleSniffScan } = await import('./handlers.js');
        const result = await handleSniffScan('relative/path');
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('absolute path');
      });

      it('returns error for non-existent rootDir', async () => {
        const { handleSniffScan } = await import('./handlers.js');
        const result = await handleSniffScan('/nonexistent/path/abc123');
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('does not exist');
      });
    });

    describe('handleSniffRun', () => {
      it('returns error for invalid baseUrl', async () => {
        const { handleSniffRun } = await import('./handlers.js');
        const result = await handleSniffRun('/tmp', 'not-a-url', true);
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('Invalid URL');
      });

      it('returns error for non-http scheme', async () => {
        const { handleSniffRun } = await import('./handlers.js');
        const result = await handleSniffRun('/tmp', 'ftp://example.com', true);
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('http or https');
      });

      it('returns error for non-absolute rootDir', async () => {
        const { handleSniffRun } = await import('./handlers.js');
        const result = await handleSniffRun('relative', 'http://localhost:3000', true);
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('absolute path');
      });
    });

    describe('handleSniffDiscover', () => {
      it('returns error for non-absolute rootDir', async () => {
        const { handleSniffDiscover } = await import('./handlers.js');
        const result = await handleSniffDiscover({
          rootDir: 'relative',
          baseUrl: 'http://localhost:3000',
          headless: true,
        });
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('absolute path');
      });

      it('returns error when no baseUrl can be resolved', async () => {
        const { handleSniffDiscover } = await import('./handlers.js');
        const result = await handleSniffDiscover({
          rootDir: '/tmp',
          headless: true,
        });
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('baseUrl');
      });

      it('returns error for invalid baseUrl scheme', async () => {
        const { handleSniffDiscover } = await import('./handlers.js');
        const result = await handleSniffDiscover({
          rootDir: '/tmp',
          baseUrl: 'ftp://example.com',
          headless: true,
        });
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('http or https');
      });
    });

    describe('handleSniffReport', () => {
      it('returns "no results" message when no prior results exist', async () => {
        const { handleSniffReport } = await import('./handlers.js');
        // Use a temp directory that exists but has no .sniff data
        const os = await import('node:os');
        const fs = await import('node:fs/promises');
        const tmpDir = await fs.mkdtemp(`${os.tmpdir()}/sniff-test-`);

        try {
          const result = await handleSniffReport(tmpDir, 'summary');
          expect(result.content[0].text).toContain('No previous sniff results found');
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      });

      it('returns summary format with finding counts', async () => {
        const { handleSniffReport } = await import('./handlers.js');
        const os = await import('node:os');
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const tmpDir = await fs.mkdtemp(`${os.tmpdir()}/sniff-test-`);

        try {
          // Write mock results
          const sniffDir = path.join(tmpDir, '.sniff');
          await fs.mkdir(sniffDir, { recursive: true });
          await fs.writeFile(
            path.join(sniffDir, 'last-results.json'),
            JSON.stringify({
              timestamp: '2025-01-01T00:00:00.000Z',
              results: [
                {
                  scanner: 'source',
                  findings: [
                    { ruleId: 'test', severity: 'high', message: 'test', filePath: 'a.ts', line: 1, column: 1, snippet: '' },
                    { ruleId: 'test2', severity: 'low', message: 'test2', filePath: 'b.ts', line: 1, column: 1, snippet: '' },
                  ],
                  duration: 100,
                },
              ],
            }),
          );

          const result = await handleSniffReport(tmpDir, 'summary');
          const text = result.content[0].text;
          expect(text).toContain('Total findings: 2');
          expect(text).toContain('high: 1');
          expect(text).toContain('low: 1');
          expect(text).toContain('source');
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      });

      it('returns JSON format when requested', async () => {
        const { handleSniffReport } = await import('./handlers.js');
        const os = await import('node:os');
        const fs = await import('node:fs/promises');
        const path = await import('node:path');
        const tmpDir = await fs.mkdtemp(`${os.tmpdir()}/sniff-test-`);

        try {
          const sniffDir = path.join(tmpDir, '.sniff');
          await fs.mkdir(sniffDir, { recursive: true });
          await fs.writeFile(
            path.join(sniffDir, 'last-results.json'),
            JSON.stringify({
              timestamp: '2025-01-01T00:00:00.000Z',
              results: [{ scanner: 'source', findings: [], duration: 50 }],
            }),
          );

          const result = await handleSniffReport(tmpDir, 'json');
          const parsed = JSON.parse(result.content[0].text);
          expect(parsed.timestamp).toBe('2025-01-01T00:00:00.000Z');
          expect(parsed.results).toHaveLength(1);
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      });

      it('returns error for non-absolute rootDir', async () => {
        const { handleSniffReport } = await import('./handlers.js');
        const result = await handleSniffReport('relative/path', 'summary');
        const text = result.content[0].text;
        expect(text).toContain('error');
        expect(text).toContain('absolute path');
      });
    });
  });
});
