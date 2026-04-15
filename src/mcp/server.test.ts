import { describe, it, expect, vi, beforeEach } from 'vitest';

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
