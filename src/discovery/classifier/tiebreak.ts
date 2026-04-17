import type { DiscoveryLLM } from '../llm/types.js';
import type { DomainSnapshot } from '../types.js';
import type { AppTypeGuess } from './types.js';

const TIEBREAK_THRESHOLD = 0.08;
const MAX_CANDIDATES = 3;

const SYSTEM_PROMPT = [
  'You are a senior product engineer classifying what an application does based on its source-code signals.',
  'You will be given a short list of candidate app types with evidence and must pick the single best match.',
  'Reply with only the exact lowercase app-type id, nothing else. No explanations, no punctuation.',
].join(' ');

function buildUserPrompt(guesses: AppTypeGuess[], snapshot: DomainSnapshot): string {
  const candidates = guesses.slice(0, MAX_CANDIDATES);
  const lines: string[] = [];
  lines.push('Candidates:');
  for (const g of candidates) {
    const evidence = g.evidence.slice(0, 6).map((e) => `${e.signal}:${e.value}`).join(', ');
    lines.push(`- ${g.type} (confidence ${g.confidence.toFixed(2)}): ${evidence || 'no-signals'}`);
  }
  lines.push('');
  lines.push('Project signals:');
  lines.push(`- project: ${snapshot.project.name}`);
  lines.push(`- frameworks: ${snapshot.project.frameworks.map((f) => f.name).join(', ') || 'none'}`);
  lines.push(`- entities: ${snapshot.entities.slice(0, 8).map((e) => e.name).join(', ') || 'none'}`);
  lines.push(`- routes: ${snapshot.vocabulary.routes.slice(0, 12).join(', ') || 'none'}`);
  lines.push(`- deps: ${snapshot.vocabulary.deps.slice(0, 10).join(', ') || 'none'}`);
  lines.push('');
  lines.push(`Reply with exactly one of: ${candidates.map((c) => c.type).join(', ')}`);
  return lines.join('\n');
}

export function needsTieBreak(guesses: AppTypeGuess[]): boolean {
  if (guesses.length < 2) return false;
  const [first, second] = guesses;
  if (!first || !second) return false;
  return Math.abs(first.confidence - second.confidence) <= TIEBREAK_THRESHOLD;
}

export async function tieBreakClassification(
  guesses: AppTypeGuess[],
  snapshot: DomainSnapshot,
  llm: DiscoveryLLM,
): Promise<AppTypeGuess[]> {
  if (!needsTieBreak(guesses)) return guesses;

  const user = buildUserPrompt(guesses, snapshot);
  let raw: string;
  try {
    raw = await llm.complete({
      system: SYSTEM_PROMPT,
      user,
      purpose: 'discovery.classifier.tiebreak.v1',
    });
  } catch {
    return guesses;
  }

  const normalized = raw.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z-]/g, '') ?? '';
  const candidateTypes = new Set<string>(guesses.slice(0, MAX_CANDIDATES).map((g) => g.type));
  if (!candidateTypes.has(normalized)) return guesses;

  return [...guesses].sort((a, b) => {
    if (a.type === normalized && b.type !== normalized) return -1;
    if (b.type === normalized && a.type !== normalized) return 1;
    return b.confidence - a.confidence;
  });
}
