import type { Scenario } from '../scenarios/types.js';
import { parseJsonFrontmatter, serializeJsonFrontmatter } from './frontmatter.js';

function bodyForScenario(scenario: Scenario): string {
  const lines: string[] = [];
  lines.push(`# ${scenario.name}`, '');
  lines.push('## Purpose', '');
  lines.push(scenario.goal.description, '');
  lines.push(`Goal kind: \`${scenario.goal.kind}\``, `Goal value: \`${scenario.goal.value}\``, '');

  if (scenario.tags.length > 0) {
    lines.push('## Tags', '');
    lines.push(scenario.tags.map((t) => `- \`${t}\``).join('\n'), '');
  }

  lines.push('## Steps', '');
  for (const step of scenario.steps) {
    lines.push(`${step.n}. **${step.intent}** (\`${step.action}\`)`);
  }
  lines.push('');

  lines.push('## Known failure modes', '');
  lines.push('Add observed failure modes here. They are informational only.', '');

  return lines.join('\n');
}

export function scenarioToMarkdown(scenario: Scenario): string {
  return serializeJsonFrontmatter(scenario, bodyForScenario(scenario));
}

export interface ParseScenarioResult {
  scenario: Scenario | null;
  error?: string;
}

export function markdownToScenario(content: string): ParseScenarioResult {
  const { data, error } = parseJsonFrontmatter<Scenario>(content);
  if (!data) return { scenario: null, ...(error ? { error } : {}) };
  if (typeof data.id !== 'string' || !Array.isArray(data.steps)) {
    return { scenario: null, error: 'frontmatter missing required Scenario fields' };
  }
  return { scenario: data };
}

export function scenarioRelativePath(scenario: Scenario): string {
  const suffix = scenario.variant === 'happy' ? 'happy' : scenario.variant.replace(/[^a-z0-9-]/gi, '-');
  return `${scenario.appType}/${scenario.journey}.${suffix}.scenario.md`;
}
