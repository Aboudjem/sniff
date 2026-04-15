import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleSniffScan, handleSniffRun, handleSniffReport } from './handlers.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'sniff',
    version: '0.1.0',
  });

  // Tool: sniff_scan -- static source analysis
  server.tool(
    'sniff_scan',
    'Run static source code analysis on a project and return findings (placeholder text, TODOs, hardcoded strings, broken links)',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
    },
    async ({ rootDir }) => handleSniffScan(rootDir),
  );

  // Tool: sniff_run -- browser E2E + quality scan
  server.tool(
    'sniff_run',
    'Run browser-based E2E quality scan (accessibility, visual regression, performance) against a live URL',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
      baseUrl: z.string().describe('Base URL of the running application (e.g., http://localhost:3000)'),
      headless: z.boolean().default(true).describe('Run browser in headless mode'),
    },
    async ({ rootDir, baseUrl, headless }) => handleSniffRun(rootDir, baseUrl, headless),
  );

  // Tool: sniff_report -- load last results
  server.tool(
    'sniff_report',
    'Load the most recent sniff scan results and return a formatted summary',
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
