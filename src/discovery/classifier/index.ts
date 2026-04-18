import type { DomainSnapshot } from '../types.js';
import { SIGNATURES } from './signatures/index.js';
import {
  getRouteMatchTokens,
  getElementMatchPhrases,
} from './signatures/i18n.js';
import type { AppType, AppTypeGuess, Evidence, Signature } from './types.js';

const MIN_CONFIDENCE_TO_KEEP = 0.1;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'for', 'of', 'in', 'on', 'at',
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function signatureTotalWeight(signature: Signature): number {
  let total = 0;
  for (const weight of Object.values(signature.routes)) total += weight;
  for (const weight of Object.values(signature.elements)) total += weight;
  for (const weight of Object.values(signature.deps)) total += weight;
  for (const weight of Object.values(signature.schema)) total += weight;
  return total;
}

function scoreRoutes(
  signature: Signature,
  routeTokens: Set<string>,
): { score: number; evidence: Evidence[] } {
  let score = 0;
  const evidence: Evidence[] = [];
  for (const [token, weight] of Object.entries(signature.routes)) {
    // Each signature entry scores at most once, regardless of how many
    // aliases match. We pick the English key if present, else the first
    // matching alias for evidence display.
    const candidates = getRouteMatchTokens(token);
    let matched: string | undefined;
    for (const c of candidates) {
      if (routeTokens.has(c)) {
        matched = c;
        break;
      }
    }
    if (matched) {
      score += weight;
      evidence.push({
        signal: 'route',
        value: matched === token ? token : `${token} (i18n: ${matched})`,
        weight,
      });
    }
  }
  return { score, evidence };
}

function scoreElements(
  signature: Signature,
  elementTokens: Set<string>,
): { score: number; evidence: Evidence[] } {
  let score = 0;
  const evidence: Evidence[] = [];
  for (const [phrase, weight] of Object.entries(signature.elements)) {
    const candidates = getElementMatchPhrases(phrase);
    let matchedPhrase: string | undefined;
    for (const c of candidates) {
      const phraseTokens = tokenize(c);
      if (phraseTokens.length === 0) continue;
      if (phraseTokens.every((t) => elementTokens.has(t))) {
        matchedPhrase = c;
        break;
      }
    }
    if (matchedPhrase) {
      score += weight;
      evidence.push({
        signal: 'element',
        value: matchedPhrase === phrase ? phrase : `${phrase} (i18n: ${matchedPhrase})`,
        weight,
      });
    }
  }
  return { score, evidence };
}

function scoreDeps(
  signature: Signature,
  deps: Set<string>,
): { score: number; evidence: Evidence[] } {
  let score = 0;
  const evidence: Evidence[] = [];
  for (const [dep, weight] of Object.entries(signature.deps)) {
    if (deps.has(dep)) {
      score += weight;
      evidence.push({ signal: 'dep', value: dep, weight });
    }
  }
  return { score, evidence };
}

function scoreSchema(
  signature: Signature,
  entityNames: Set<string>,
): { score: number; evidence: Evidence[] } {
  let score = 0;
  const evidence: Evidence[] = [];
  for (const [entityKey, weight] of Object.entries(signature.schema)) {
    if (entityNames.has(entityKey)) {
      score += weight;
      evidence.push({ signal: 'schema', value: entityKey, weight });
    }
  }
  return { score, evidence };
}

function scoreSignature(signature: Signature, snapshot: DomainSnapshot): AppTypeGuess {
  const routeTokens = new Set(snapshot.vocabulary.routes);
  const elementTokens = new Set(snapshot.vocabulary.elements);
  const deps = new Set(snapshot.vocabulary.deps);
  const entityNames = new Set(snapshot.entities.map((e) => e.name.toLowerCase()));

  const r = scoreRoutes(signature, routeTokens);
  const el = scoreElements(signature, elementTokens);
  const d = scoreDeps(signature, deps);
  const s = scoreSchema(signature, entityNames);

  const rawScore = r.score + el.score + d.score + s.score;
  const evidence = [...r.evidence, ...el.evidence, ...d.evidence, ...s.evidence];

  const totalWeight = signatureTotalWeight(signature);
  const confidence = totalWeight > 0 ? Math.min(rawScore / totalWeight, 1) : 0;

  return {
    type: signature.type,
    confidence,
    evidence,
    rawScore,
  };
}

function applyBlankFallback(guesses: AppTypeGuess[]): AppTypeGuess[] {
  const nonBlank = guesses.filter((g) => g.type !== 'blank');
  const topNonBlank = nonBlank.reduce(
    (max, g) => (g.confidence > max ? g.confidence : max),
    0,
  );

  if (topNonBlank >= MIN_CONFIDENCE_TO_KEEP) {
    return guesses.filter((g) => g.type !== 'blank' || topNonBlank < 0.05);
  }

  return guesses.map((g) =>
    g.type === 'blank'
      ? { ...g, confidence: 1, rawScore: 0, evidence: [{ signal: 'pkg', value: 'no signals matched any signature', weight: 0 }] }
      : g,
  );
}

export function classifyApp(snapshot: DomainSnapshot): AppTypeGuess[] {
  const raw = SIGNATURES.map((signature) => scoreSignature(signature, snapshot));
  const withBlank = applyBlankFallback(raw);
  return withBlank
    .filter((g) => g.confidence >= MIN_CONFIDENCE_TO_KEEP)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Returns every signature's guess with full evidence, BEFORE the blank fallback
 * and BEFORE the min-confidence filter. Useful for --verbose output and for the
 * `classificationBreakdown` field in DiscoveryReport so callers can see which
 * signatures almost matched and on which tokens.
 */
export function scoreAllSignatures(snapshot: DomainSnapshot): AppTypeGuess[] {
  return SIGNATURES.map((signature) => scoreSignature(signature, snapshot))
    .sort((a, b) => b.rawScore - a.rawScore);
}

export interface SignalEvidenceEntry {
  value: string;
  weight: number;
  appType: AppType;
}

export interface ClassificationBreakdown {
  top3: Array<{ type: AppType; confidence: number; rawScore: number }>;
  matchedSignals: {
    routes: SignalEvidenceEntry[];
    elements: SignalEvidenceEntry[];
    deps: SignalEvidenceEntry[];
    schema: SignalEvidenceEntry[];
  };
}

/**
 * Build a consolidated breakdown for surfacing *why* the classifier chose
 * what it did (and why near-misses lost). Pass the full raw guess list from
 * `scoreAllSignatures` — includes every signature, not just ones that cleared
 * the confidence floor.
 */
export function buildClassificationBreakdown(
  allGuesses: AppTypeGuess[],
): ClassificationBreakdown {
  const sorted = [...allGuesses].sort((a, b) => b.rawScore - a.rawScore);
  const top3 = sorted.slice(0, 3).map((g) => ({
    type: g.type,
    confidence: g.confidence,
    rawScore: g.rawScore,
  }));

  const matchedSignals: ClassificationBreakdown['matchedSignals'] = {
    routes: [],
    elements: [],
    deps: [],
    schema: [],
  };
  for (const guess of allGuesses) {
    if (guess.type === 'blank') continue;
    for (const ev of guess.evidence) {
      const entry: SignalEvidenceEntry = {
        value: ev.value,
        weight: ev.weight,
        appType: guess.type,
      };
      if (ev.signal === 'route') matchedSignals.routes.push(entry);
      else if (ev.signal === 'element') matchedSignals.elements.push(entry);
      else if (ev.signal === 'dep') matchedSignals.deps.push(entry);
      else if (ev.signal === 'schema') matchedSignals.schema.push(entry);
    }
  }
  return { top3, matchedSignals };
}

export function topAppType(snapshot: DomainSnapshot): AppType {
  const ranked = classifyApp(snapshot);
  return ranked[0]?.type ?? 'blank';
}
