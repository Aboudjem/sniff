import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';
import type { DomainEntity, DomainField, DomainRelation, FieldFormat, FieldType } from '../types.js';

const SCALAR_MAP: Record<string, { type: FieldType; format?: FieldFormat }> = {
  String:   { type: 'string' },
  Int:      { type: 'number', format: 'integer' },
  Float:    { type: 'number', format: 'decimal' },
  Boolean:  { type: 'boolean' },
  ID:       { type: 'string', format: 'uuid' },
  DateTime: { type: 'date', format: 'iso-date' },
  Date:     { type: 'date', format: 'iso-date' },
  Email:    { type: 'string', format: 'email' },
  URL:      { type: 'string', format: 'url' },
  UUID:     { type: 'string', format: 'uuid' },
  JSON:     { type: 'object' },
};

interface GraphQlType {
  name: string;
  rawBody: string;
}

interface GraphQlEnum {
  name: string;
  values: string[];
}

function extractTypeBlocks(sdl: string): GraphQlType[] {
  const result: GraphQlType[] = [];
  const pattern = /\btype\s+([A-Z]\w*)(?:\s+implements\s+[\w\s&,]+)?\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sdl)) !== null) {
    result.push({ name: match[1], rawBody: match[2] });
  }
  return result;
}

function extractEnumBlocks(sdl: string): GraphQlEnum[] {
  const result: GraphQlEnum[] = [];
  const pattern = /\benum\s+([A-Z]\w*)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(sdl)) !== null) {
    const values = match[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('"'))
      .map((l) => l.split(/\s+/)[0])
      .filter(Boolean);
    result.push({ name: match[1], values });
  }
  return result;
}

function stripComments(block: string): string {
  return block
    .split('\n')
    .filter((l) => !l.trim().startsWith('#') && !l.trim().startsWith('"""'))
    .join('\n');
}

interface ParsedFieldType {
  typeName: string;
  isList: boolean;
  required: boolean;
}

function parseFieldType(raw: string): ParsedFieldType {
  let s = raw.trim();
  let required = false;
  if (s.endsWith('!')) {
    required = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    const innerRequired = inner.endsWith('!');
    const innerName = innerRequired ? inner.slice(0, -1).trim() : inner;
    return { typeName: innerName, isList: true, required };
  }
  return { typeName: s, isList: false, required };
}

function inferFormatFromName(fieldName: string, type: FieldType): FieldFormat | undefined {
  if (type !== 'string') return undefined;
  const n = fieldName.toLowerCase();
  if (n === 'email' || n.endsWith('email')) return 'email';
  if (n === 'url' || n.endsWith('url') || n.endsWith('uri')) return 'url';
  if (n === 'phone' || n.includes('phone')) return 'phone';
  return undefined;
}

const INTROSPECTION_TYPES = new Set(['Query', 'Mutation', 'Subscription', 'Schema']);

export interface GraphQlParseResult {
  entities: DomainEntity[];
  relations: DomainRelation[];
}

export function parseGraphQlContent(content: string, filePath: string): GraphQlParseResult {
  const typeBlocks = extractTypeBlocks(content);
  const enumBlocks = extractEnumBlocks(content);
  const enumsByName = new Map(enumBlocks.map((e) => [e.name, e.values]));

  const typeNames = new Set(typeBlocks.map((t) => t.name));

  const entities: DomainEntity[] = [];
  const relations: DomainRelation[] = [];

  for (const block of typeBlocks) {
    if (INTROSPECTION_TYPES.has(block.name)) continue;

    const fields: DomainField[] = [];
    const identifiers: string[] = [];

    const lines = stripComments(block.rawBody)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const namePart = line.slice(0, colon).trim();
      const typePart = line.slice(colon + 1).trim();

      const fieldName = namePart.replace(/\(.*/, '').trim();
      if (!fieldName || !/^[a-zA-Z_]\w*$/.test(fieldName)) continue;

      const cleanTypePart = typePart.replace(/@[\w]+(\([^)]*\))?/g, '').trim();
      const parsed = parseFieldType(cleanTypePart);

      if (enumsByName.has(parsed.typeName)) {
        fields.push({
          name: fieldName,
          type: 'enum',
          required: parsed.required,
          enum: enumsByName.get(parsed.typeName),
        });
        continue;
      }

      if (typeNames.has(parsed.typeName)) {
        fields.push({
          name: fieldName,
          type: 'ref',
          refTo: parsed.typeName,
          required: parsed.required,
        });
        relations.push({
          from: block.name,
          to: parsed.typeName,
          cardinality: parsed.isList ? '1:N' : '1:1',
          field: fieldName,
        });
        continue;
      }

      const scalar = SCALAR_MAP[parsed.typeName];
      if (scalar) {
        const inferredFormat = inferFormatFromName(fieldName, scalar.type);
        const field: DomainField = {
          name: fieldName,
          type: parsed.isList ? 'list' : scalar.type,
          required: parsed.required,
        };
        const format = inferredFormat ?? scalar.format;
        if (format) field.format = format;
        fields.push(field);
        if (parsed.typeName === 'ID') identifiers.push(fieldName);
        continue;
      }

      fields.push({
        name: fieldName,
        type: parsed.isList ? 'list' : 'unknown',
        required: parsed.required,
      });
    }

    if (fields.length === 0) continue;
    entities.push({
      name: block.name,
      source: 'graphql',
      filePath,
      fields,
      ...(identifiers.length > 0 ? { identifiers } : {}),
    });
  }

  return { entities, relations };
}

const GRAPHQL_GLOBS = [
  '**/*.graphql',
  '**/*.gql',
  'schema.{ts,js}',
  'src/schema.{ts,js}',
  'src/graphql/**/*.{ts,js}',
  'graphql/**/*.{ts,js}',
];

function extractEmbeddedSdl(jsContent: string): string | null {
  const chunks: string[] = [];
  const pattern = /(?:gql|graphql)\s*`([^`]*)`/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(jsContent)) !== null) {
    chunks.push(match[1]);
  }
  return chunks.length > 0 ? chunks.join('\n') : null;
}

export async function parseGraphQlSchemas(rootDir: string): Promise<GraphQlParseResult> {
  const files = await fg(GRAPHQL_GLOBS, {
    cwd: rootDir,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
  });

  const allEntities: DomainEntity[] = [];
  const allRelations: DomainRelation[] = [];
  const seenEntities = new Set<string>();

  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, 'utf-8');
    } catch {
      continue;
    }

    const sdl = file.endsWith('.graphql') || file.endsWith('.gql')
      ? content
      : extractEmbeddedSdl(content);
    if (!sdl) continue;

    const result = parseGraphQlContent(sdl, relative(rootDir, file));
    for (const entity of result.entities) {
      if (!seenEntities.has(entity.name)) {
        seenEntities.add(entity.name);
        allEntities.push(entity);
      }
    }
    allRelations.push(...result.relations);
  }

  return { entities: allEntities, relations: allRelations };
}
