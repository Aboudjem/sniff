import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleSniffScan, handleSniffRun, handleSniffReport } from './handlers.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'sniff',
    version: '0.2.0',
  });

  // Tool: sniff_scan -- static source analysis (no browser needed)
  server.tool(
    'sniff_scan',
    'Scan project source code for bugs. Finds debug statements, placeholder text, dead links, broken imports, hardcoded URLs, and API endpoint issues (missing validation, auth, error handling, secrets). Works offline, no browser or API key needed. Just pass the project path.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
    },
    async ({ rootDir }) => handleSniffScan(rootDir),
  );

  // Tool: sniff_run -- full audit (source + browser, auto-detects URL)
  server.tool(
    'sniff_run',
    'Run a full quality audit: source scan + browser checks (accessibility, visual regression, performance). The URL is optional -- sniff auto-detects running dev servers. If no server is found, runs source scan only. No API key needed.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
      baseUrl: z.string().optional().describe('URL of the running app. Optional -- sniff auto-detects localhost servers if omitted.'),
      headless: z.boolean().default(true).describe('Run browser in headless mode'),
    },
    async ({ rootDir, baseUrl, headless }) => {
      // Auto-detect URL if not provided
      let url = baseUrl;
      if (!url) {
        const { detectDevServerUrl } = await import('../config/dev-server-detector.js');
        const detection = await detectDevServerUrl(rootDir);
        url = detection.url;
      }

      if (url) {
        return handleSniffRun(rootDir, url, headless);
      }

      // No server found -- fall back to source scan only
      return handleSniffScan(rootDir);
    },
  );

  // Tool: sniff_report -- load last results
  server.tool(
    'sniff_report',
    'Get the results from the most recent sniff scan. Returns findings, severities, and fix suggestions.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
      format: z.enum(['json', 'summary']).default('summary').describe('Output format: full JSON or text summary'),
    },
    async ({ rootDir, format }) => handleSniffReport(rootDir, format),
  );

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
