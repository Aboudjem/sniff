import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleSniffScan, handleSniffRun, handleSniffReport, handleSniffDiscover, handleSniffUnified } from './handlers.js';
import { getVersion } from '../version.js';

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: 'sniff',
    version: getVersion(),
  });

  // Tool: sniff -- unified entry point (mode dispatches to the narrow tools below).
  // The narrow tools (sniff_scan, sniff_run, sniff_discover, sniff_report) remain
  // registered for back-compat and security (scoped capabilities per
  // sniff-qa/DEEP-DIVE.md:1108) — but `sniff({ mode })` is the preferred
  // surface for new integrations. Will be marked deprecated on narrow tools
  // in v0.6 and removed in v0.7.
  server.tool(
    'sniff',
    'Unified entry point. Pass { mode: "scan" | "run" | "discover" | "report", rootDir, ...} to dispatch. Prefer this over the narrow tools (sniff_scan / sniff_run / sniff_discover / sniff_report) which are kept only for back-compat.',
    {
      mode: z.enum(['scan', 'run', 'discover', 'report']).describe('What to run: scan = source only, run = source + browser audit, discover = autonomous E2E, report = load last results.'),
      rootDir: z.string().describe('Absolute path to the project root directory'),
      baseUrl: z.string().optional().describe('URL of the running app (modes: run, discover). Auto-detected if omitted.'),
      headless: z.boolean().optional().describe('Run browser in headless mode (modes: run, discover). Default: true.'),
      format: z.enum(['json', 'summary']).optional().describe('Report format (mode: report). Default: summary.'),
      maxScenarios: z.number().int().min(1).max(200).optional().describe('Cap total scenarios (mode: discover). Default: 50.'),
      maxVariantsPerScenario: z.number().int().min(0).max(20).optional().describe('Cap edge variants per scenario (mode: discover). Default: 3.'),
      maxVariantsPerRun: z.number().int().min(0).max(200).optional().describe('Cap edge variants per run (mode: discover). Default: 40.'),
      realism: z.enum(['robot', 'careful-user', 'casual-user', 'frustrated-user', 'power-user']).optional().describe('Realism profile (mode: discover).'),
      seed: z.number().int().optional().describe('Replay a specific random seed (mode: discover).'),
      only: z.string().optional().describe('Filter scenarios by id substring or app type (mode: discover).'),
      appType: z.array(z.string()).optional().describe('Filter app types (mode: discover). Does NOT bypass classification — use forceAppType.'),
      forceAppType: z.string().optional().describe('Force a single app type, bypassing the classifier (mode: discover).'),
      dryRun: z.boolean().optional().describe('Generate scenarios without browser or reports (mode: discover).'),
    },
    async (args) => handleSniffUnified(args),
  );

  // Tool: sniff_scan -- static source analysis (no browser needed)
  server.tool(
    'sniff_scan',
    '[DEPRECATED in v0.5, will be removed in v0.7 — use `sniff({ mode: "scan" })` instead.] Scan project source code for bugs. Finds debug statements, placeholder text, dead links, broken imports, hardcoded URLs, and API endpoint issues.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
    },
    async ({ rootDir }) => handleSniffScan(rootDir),
  );

  // Tool: sniff_run -- full audit (source + browser, auto-detects URL)
  server.tool(
    'sniff_run',
    '[DEPRECATED in v0.5, will be removed in v0.7 — use `sniff({ mode: "run" })` instead.] Run a full quality audit: source scan + browser checks (accessibility, visual regression, performance).',
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

  // Tool: sniff_discover -- autonomous E2E discovery (scenarios + edge cases)
  server.tool(
    'sniff_discover',
    '[DEPRECATED in v0.5, will be removed in v0.7 — use `sniff({ mode: "discover" })` instead.] Run autonomous end-to-end discovery: classify the app, generate scenarios, drive them through Playwright.',
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
      appType: z.array(z.string()).optional().describe('Force app types'),
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
      });
    },
  );

  // Tool: sniff_report -- load last results
  server.tool(
    'sniff_report',
    '[DEPRECATED in v0.5, will be removed in v0.7 — use `sniff({ mode: "report" })` instead.] Get the results from the most recent sniff scan.',
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
