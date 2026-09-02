import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';
import { handleSniffScan, handleSniffRun, handleSniffReport, handleSniffDiscover, handleSniffInstall, handleSniffUnified } from './handlers.js';
import { getVersion } from '../version.js';
import { CAPABILITIES, resolveTools } from './caps.js';
import type { Capability, UnifiedMode } from './caps.js';
import type { BrowserProject } from '../config/schema.js';

/**
 * Start the stdio MCP server. `caps` narrows which tools are registered; the
 * default is every capability, so an existing config keeps the tool list it
 * has today. See `src/mcp/caps.ts` for the names.
 */
export async function startMcpServer(
  caps: readonly Capability[] = CAPABILITIES,
  transport?: Transport,
): Promise<void> {
  const server = new McpServer({
    name: 'sniff',
    version: getVersion(),
  });

  const { tools, modes } = resolveTools(caps);
  const granted = (tool: string): boolean => tools.includes(tool);
  // The install tool may be gated off, in which case the setup hint must not
  // point the caller at a tool that is not registered.
  const setupHint = granted('sniff_install')
    ? 'Run the sniff_install MCP tool with the same projects, or run the install command manually, then retry.'
    : 'Run the install command shown above in a terminal, then retry.';

  // Tool: sniff -- unified entry point (preferred). Dispatches to the narrow
  // tools below. The narrow tools remain registered for back-compat and to
  // preserve the documented security pattern of scoped capabilities
  // (sniff-qa/DEEP-DIVE.md:1108). Marked deprecated in v0.5, removal planned v0.7.
  if (granted('sniff')) server.tool(
    'sniff',
    'Find real, reproducible QA bugs in a web app. Pass { mode, rootDir, baseUrl? }. Use mode:"walk" (RECOMMENDED) to drive a real browser, walk the app\'s user flows, and report broken pages/links, console & network errors, empty/placeholder data, broken forms, state-loss, dead-ends, bad loading/error states, responsive issues and accessibility, each with reproduction proof, severity, confidence, and a fix. mode:"scan" = source-only (no browser). mode:"report" = load last results. (mode:"run"/"discover" are legacy.) Auto-detects a running dev server if baseUrl is omitted. Prefer this over the narrow tools (sniff_scan / sniff_run / sniff_discover / sniff_report).',
    {
      mode: z.enum(modes as [UnifiedMode, ...UnifiedMode[]]).describe('walk = autonomous flow-walk that finds real bugs (RECOMMENDED for a running app); scan = source only; run/discover = legacy; report = load last results'),
      rootDir: z.string().describe('Absolute path to the project root directory'),
      baseUrl: z.string().optional().describe('URL of the running app (walk/run/discover). Optional, auto-detected if omitted.'),
      headless: z.boolean().optional(),
      maxPages: z.number().int().min(1).max(200).optional().describe('walk: max pages to crawl (default 25)'),
      mobile: z.boolean().optional().describe('walk: include the mobile (375px) responsive pass (default true)'),
      all: z.boolean().optional().describe('walk: include low-confidence findings too (default false)'),
      format: z.enum(['json', 'summary']).optional(),
      maxScenarios: z.number().int().min(1).max(200).optional(),
      maxVariantsPerScenario: z.number().int().min(0).max(20).optional(),
      maxVariantsPerRun: z.number().int().min(0).max(200).optional(),
      realism: z.enum(['robot', 'careful-user', 'casual-user', 'frustrated-user', 'power-user']).optional(),
      seed: z.number().int().optional(),
      only: z.string().optional(),
      appType: z.array(z.string()).optional(),
      forceAppType: z.string().optional(),
      dryRun: z.boolean().optional(),
    },
    async (args) => handleSniffUnified(args),
  );

  // Tool: sniff_scan -- static source analysis (no browser needed)
  if (granted('sniff_scan')) server.tool(
    'sniff_scan',
    'Scan project source code for bugs. Finds debug statements, placeholder text, dead links, broken imports, hardcoded URLs, and API endpoint issues (missing validation, auth, error handling, secrets). Works offline, no browser or API key needed. Just pass the project path.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
    },
    async ({ rootDir }) => handleSniffScan(rootDir),
  );

  // Tool: sniff_run -- full audit (source + browser, auto-detects URL)
  if (granted('sniff_run')) server.tool(
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
        // Gate on Playwright: return a structured setup hint instead of
        // silently running `npx playwright install` (MCP stdio transports
        // commonly time out on the ~45s install).
        const { loadConfig } = await import('../config/loader.js');
        const config = await loadConfig(rootDir);
        const { checkPlaywrightBrowsers } = await import('../core/ensure-browsers.js');
        const check = await checkPlaywrightBrowsers(config.browser?.projects);
        if (check.status !== 'installed') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                needsSetup: 'playwright-browsers',
                projects: check.status === 'missing' ? check.missingProjects : config.browser?.projects ?? ['chromium'],
                installCommand: check.status === 'missing' ? check.installCommand : `npx playwright install ${(config.browser?.projects ?? ['chromium']).join(' ')}`,
                installSizeMb: check.status === 'missing' ? check.installSizeMb : 165,
                hint: setupHint,
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
  if (granted('sniff_discover')) server.tool(
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
      appType: z.array(z.string()).optional().describe('Filter classifier guesses to these app types (does NOT bypass classification; use forceAppType for that)'),
      forceAppType: z.string().optional().describe('Force a single app type, bypassing the classifier entirely. Use when classification returns blank.'),
      dryRun: z.boolean().optional().describe('Generate scenarios + classify without launching a browser or writing reports. Useful for preview.'),
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
        ...(args.dryRun !== undefined ? { dryRun: args.dryRun } : {}),
      });
    },
  );

  // Tool: sniff_install -- explicitly install requested Playwright browsers.
  // MCP browser tools return `needsSetup: playwright-browsers` instead of
  // silently shelling out (install takes ~45s, transports time out). Call
  // this tool when that happens, then retry the browser tool.
  if (granted('sniff_install')) server.tool(
    'sniff_install',
    'Install requested Playwright browser binaries (default: chromium). Run this when sniff_run or sniff_discover returns `needsSetup: playwright-browsers`.',
    {
      projects: z.array(z.enum(['chromium', 'firefox', 'webkit'])).optional().describe('Browser projects to install. Defaults to ["chromium"].'),
    },
    async ({ projects }) => handleSniffInstall(projects as BrowserProject[] | undefined),
  );

  // Tool: sniff_report -- load last results
  if (granted('sniff_report')) server.tool(
    'sniff_report',
    'Get the results from the most recent sniff scan. Returns findings, severities, and fix suggestions.',
    {
      rootDir: z.string().describe('Absolute path to the project root directory'),
      format: z.enum(['json', 'summary']).default('summary').describe('Output format: full JSON or text summary'),
    },
    async ({ rootDir, format }) => handleSniffReport(rootDir, format),
  );

  // Connect via stdio transport unless the caller supplied one (tests use the
  // SDK's in-memory transport to exercise the real protocol).
  await server.connect(transport ?? new StdioServerTransport());
}
