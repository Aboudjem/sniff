import type { DomainSnapshot } from '../types.js';
import type { Scenario } from '../scenarios/types.js';
import { EDGE_CLASSES } from './catalog.js';

export interface EnumerateEdgeOptions {
  maxPerScenario?: number;
  maxPerRun?: number;
  only?: string[];
}

const EDGE_PRIORITY_BY_APP_TYPE: Record<string, string[]> = {
  ecommerce:     ['empty-cart', 'payment-declined', 'invalid-email', 'missing-required', 'boundary-number', 'xss', 'empty-input', 'long-input', 'slow-network', 'offline'],
  booking:       ['missing-required', 'invalid-email', 'payment-declined', 'slow-network', 'empty-input', 'xss', 'long-input', 'boundary-number', 'offline'],
  social:        ['xss', 'long-input', 'empty-input', 'invalid-email', 'missing-required', 'slow-network', 'offline'],
  saas:          ['invalid-email', 'missing-required', 'empty-input', 'xss', 'slow-network', 'offline', 'long-input'],
  content:       ['invalid-email', 'xss', 'empty-input', 'slow-network', 'offline'],
  crm:           ['missing-required', 'empty-input', 'xss', 'long-input', 'slow-network'],
  'auth-only':   ['invalid-email', 'empty-input', 'missing-required', 'xss', 'slow-network'],
  marketing:     ['invalid-email', 'empty-input', 'xss', 'missing-required', 'slow-network'],
  admin:         ['missing-required', 'empty-input', 'xss', 'long-input', 'boundary-number', 'slow-network'],
  blank:         ['slow-network', 'offline'],
};

export function enumerateEdgeVariants(
  scenario: Scenario,
  snapshot: DomainSnapshot,
  options: EnumerateEdgeOptions = {},
): Scenario[] {
  const cap = options.maxPerScenario ?? 3;
  if (cap <= 0) return [];

  const priority = EDGE_PRIORITY_BY_APP_TYPE[scenario.appType] ?? [];
  const only = options.only ? new Set(options.only) : null;

  const ordered = [...EDGE_CLASSES].sort((a, b) => {
    const idxA = priority.indexOf(a.id);
    const idxB = priority.indexOf(b.id);
    if (idxA === -1 && idxB === -1) return 0;
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });

  const variants: Scenario[] = [];
  for (const edgeClass of ordered) {
    if (variants.length >= cap) break;
    if (only && !only.has(edgeClass.id)) continue;
    if (!edgeClass.applies(scenario, snapshot)) continue;
    variants.push(edgeClass.mutate(scenario));
  }

  return variants;
}

export function enumerateAllEdgeVariants(
  scenarios: Scenario[],
  snapshot: DomainSnapshot,
  options: EnumerateEdgeOptions = {},
): Scenario[] {
  const maxPerRun = options.maxPerRun ?? 40;
  const all: Scenario[] = [];
  for (const scenario of scenarios) {
    if (scenario.variant !== 'happy') continue;
    if (all.length >= maxPerRun) break;
    const remaining = maxPerRun - all.length;
    const cap = Math.min(options.maxPerScenario ?? 3, remaining);
    const variants = enumerateEdgeVariants(scenario, snapshot, { ...options, maxPerScenario: cap });
    all.push(...variants);
  }
  return all;
}

export { EDGE_CLASSES } from './catalog.js';
