import { basename, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { AnalysisResult } from '../../analyzers/types.js';
import type {
  ApiEndpoint,
  DomainEntity,
  DomainRelation,
  DomainSnapshot,
  EntitySource,
} from '../types.js';
import { parsePrismaSchema } from './prisma.js';
import { parseDrizzleSchemas } from './drizzle.js';
import { parseTypeOrmEntities } from './typeorm.js';
import { parseZodSchemas } from './zod.js';
import { parseTsTypes } from './ts-types.js';
import { parseGraphQlSchemas } from './graphql.js';
import { parseOpenApiSpec } from './openapi.js';
import { extractForms } from './forms.js';
import { buildVocabulary } from './vocab.js';

const SOURCE_PRIORITY: EntitySource[] = [
  'prisma', 'drizzle', 'typeorm', 'graphql', 'openapi', 'zod', 'ts', 'form',
];

function sourceRank(source: EntitySource): number {
  const idx = SOURCE_PRIORITY.indexOf(source);
  return idx === -1 ? SOURCE_PRIORITY.length : idx;
}

function dedupeEntities(entities: DomainEntity[]): DomainEntity[] {
  const byName = new Map<string, DomainEntity>();
  for (const entity of entities) {
    const existing = byName.get(entity.name);
    if (!existing) {
      byName.set(entity.name, entity);
      continue;
    }
    if (sourceRank(entity.source) < sourceRank(existing.source)) {
      byName.set(entity.name, entity);
    }
  }
  return Array.from(byName.values());
}

function dedupeRelations(relations: DomainRelation[]): DomainRelation[] {
  const seen = new Set<string>();
  const out: DomainRelation[] = [];
  for (const r of relations) {
    const key = `${r.from}::${r.to}::${r.field}::${r.cardinality}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

async function computeAnalysisResult(rootDir: string): Promise<AnalysisResult> {
  const start = performance.now();
  const { detectFrameworks } = await import('../../analyzers/framework-detector.js');
  const { discoverRoutes } = await import('../../analyzers/route-discoverer.js');
  const { extractElements } = await import('../../analyzers/element-extractor.js');

  const frameworks = await detectFrameworks(rootDir);
  const routes = await discoverRoutes(rootDir, frameworks);

  const routeFilePaths = routes
    .map((r) => join(rootDir, r.filePath))
    .filter(
      (f) =>
        f.endsWith('.tsx') ||
        f.endsWith('.jsx') ||
        f.endsWith('.ts') ||
        f.endsWith('.js') ||
        f.endsWith('.vue'),
    );

  const { elements, components } = await extractElements(routeFilePaths, rootDir);

  return {
    project: { name: basename(rootDir), frameworks, rootDir },
    routes,
    components,
    elements,
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: performance.now() - start,
      fileCount: routeFilePaths.length,
      routeCount: routes.length,
      elementCount: elements.length,
    },
  };
}

export interface ExtractDomainSnapshotOptions {
  analysis?: AnalysisResult;
}

export async function extractDomainSnapshot(
  rootDir: string,
  options: ExtractDomainSnapshotOptions = {},
): Promise<DomainSnapshot> {
  const start = performance.now();

  const analysis = options.analysis ?? (await computeAnalysisResult(rootDir));

  const [prisma, drizzle, typeorm, zod, ts, graphql, openapi] = await Promise.all([
    parsePrismaSchema(rootDir),
    parseDrizzleSchemas(rootDir),
    parseTypeOrmEntities(rootDir),
    parseZodSchemas(rootDir),
    parseTsTypes(rootDir),
    parseGraphQlSchemas(rootDir),
    parseOpenApiSpec(rootDir),
  ]);

  const allEntities: DomainEntity[] = [
    ...prisma.entities,
    ...drizzle.entities,
    ...typeorm.entities,
    ...graphql.entities,
    ...openapi.entities,
    ...zod.entities,
    ...ts.entities,
  ];

  const entities = dedupeEntities(allEntities);

  const allRelations: DomainRelation[] = [
    ...prisma.relations,
    ...drizzle.relations,
    ...typeorm.relations,
    ...graphql.relations,
    ...ts.relations,
  ];

  const entityNames = new Set(entities.map((e) => e.name));
  const relations = dedupeRelations(allRelations).filter(
    (r) => entityNames.has(r.from) && entityNames.has(r.to),
  );

  const apiEndpoints: ApiEndpoint[] = [...openapi.endpoints];

  const forms = extractForms(analysis.components, analysis.routes);
  const vocabulary = await buildVocabulary(analysis.routes, analysis.elements, rootDir);

  return {
    project: analysis.project,
    routes: analysis.routes,
    forms,
    entities,
    relations,
    apiEndpoints,
    vocabulary,
    metadata: {
      analyzedAt: new Date().toISOString(),
      duration: performance.now() - start,
    },
  };
}
