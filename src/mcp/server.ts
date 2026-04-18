import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleSniffScan, handleSniffRun, handleSniffReport, handleSniffDiscover, handleSniffInstall } from './handlers.js';
import { getVersion } from '../version.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'sniff',
    version: getVersion(),
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
        // Gate on Playwright — return structured setup hint instead of
        // silently running `npx playwright install` (MCP stdio transports
        // commonly time out on the ~45s install).
        const { checkPlaywrightBrowsers } = await import('../core/ensure-browsers.js');
        const check = await checkPlaywrightBrowsers();
        if (check.status !== 'installed') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                needsSetup: 'playwright-chromium',
                installCommand: check.status === 'missing' ? check.installCommand : 'npx playwright install chromium',
                installSizeMb: check.status === 'missing' ? check.installSizeMb : 165,
                hint: 'Run the sniff_install MCP tool, or run the install command manually, then retry.',
              }),
            }],
          };
        }
        return handleSniffRun(rootDir, url, headless);
      }

      // No server found -- fall back to source scan only
      return handleSniffScan(rootDir);
    },
  );

  // Tool: sniff_discover -- autonomous E2E discovery (scenarios + edge cases)
  server.tool(
    'sniff_discover',
    'Run autonomous end-to-end discovery: extract the app domain from source, classify the app type, generate scenarios with edge-case variants, drive them through Playwright, and return a compact summary. Requires a running dev server (baseUrl optional, auto-detected if omitted). Writes HTML/JSON reports to sniff-reports/discovery/.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
      baseUrl: z.string().optional().describe('URL of the running app. Optional -- sniff auto-detects localhost servers if omitted.'),
      headless: z.boolean().default(true).describe('Run browser in headless mode'),
      maxScenarios: z.number().int().min(1).max(200).optional().describe('Cap total scenarios (default: 50)'),
      maxVariantsPerScenario: z.number().int().min(0).max(20).optional().describe('Cap edge variants per scenario (default: 3)'),
      maxVariantsPerRun: z.number().int().min(0).max(200).optional().describe('Cap edge variants per run (default: 40)'),
      realism: z.enum(['robot', 'careful-user', 'casual-user', 'frustrated-user', 'power-user']).optional().describe('Realism profile (default: robot in CI, casual-user otherwise)'),
      seed: z.number().int().optional().describe('Replay a specific random seed'),
      only: z.string().optional().describe('Filter scenarios by id substring or app type'),
      appType: z.array(z.string()).optional().describe('Filter classifier guesses to these app types (does NOT bypass classification — use forceAppType for that)'),
      forceAppType: z.string().optional().describe('Force a single app type, bypassing the classifier entirely. Use when classification returns blank.'),
    },
    async (args) => {
      let url = args.baseUrl;
      if (!url) {
        const { detectDevServerUrl } = await import('../config/dev-server-detector.js');
        const detection = await detectDevServerUrl(args.rootDir);
        url = detection.url;
      }
      return handleSniffDiscover({
        rootDir: args.rootDir,
        baseUrl: url,
        headless: args.headless,
        ...(args.maxScenarios !== undefined ? { maxScenarios: args.maxScenarios } : {}),
        ...(args.maxVariantsPerScenario !== undefined ? { maxVariantsPerScenario: args.maxVariantsPerScenario } : {}),
        ...(args.maxVariantsPerRun !== undefined ? { maxVariantsPerRun: args.maxVariantsPerRun } : {}),
        ...(args.realism !== undefined ? { realism: args.realism } : {}),
        ...(args.seed !== undefined ? { seed: args.seed } : {}),
        ...(args.only !== undefined ? { only: args.only } : {}),
        ...(args.appType !== undefined ? { appType: args.appType } : {}),
        ...(args.forceAppType !== undefined ? { forceAppType: args.forceAppType } : {}),
      });
    },
  );

  // Tool: sniff_install -- explicitly install Playwright's Chromium binary.
  // MCP browser tools return `needsSetup: playwright-chromium` instead of
  // silently shelling out (install takes ~45s, transports time out). Call
  // this tool when that happens, then retry the browser tool.
  server.tool(
    'sniff_install',
    'Install the Playwright Chromium binary (~165MB, one-time). Run this when sniff_run or sniff_discover returns `needsSetup: playwright-chromium`.',
    {},
    async () => handleSniffInstall(),
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
