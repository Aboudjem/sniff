import { readFile, access } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { DomainEntity, DomainField, DomainRelation, FieldFormat, FieldType } from '../types.js';

const PRISMA_SCALARS = new Set([
  'String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes',
]);

function mapPrismaScalar(prismaType: string): { type: FieldType; format?: FieldFormat } {
  switch (prismaType) {
    case 'String':   return { type: 'string' };
    case 'Int':      return { type: 'number', format: 'integer' };
    case 'BigInt':   return { type: 'number', format: 'integer' };
    case 'Float':    return { type: 'number', format: 'decimal' };
    case 'Decimal':  return { type: 'number', format: 'decimal' };
    case 'Boolean':  return { type: 'boolean' };
    case 'DateTime': return { type: 'date', format: 'iso-date' };
    case 'Json':     return { type: 'object' };
    case 'Bytes':    return { type: 'unknown' };
    default:         return { type: 'unknown' };
  }
}

function inferFormatFromName(fieldName: string, type: FieldType): FieldFormat | undefined {
  if (type !== 'string') return undefined;
  const n = fieldName.toLowerCase();
  if (n === 'email' || n.endsWith('email')) return 'email';
  if (n === 'url' || n.endsWith('url') || n.endsWith('uri')) return 'url';
  if (n === 'phone' || n.includes('phone')) return 'phone';
  if (n === 'password' || n.endsWith('password')) return 'password';
  if (n === 'id' || n.endsWith('id')) return 'uuid';
  return undefined;
}

interface ParsedModel {
  name: string;
  rawFields: Array<{ line: string; lineNumber: number }>;
}

function extractEnums(content: string): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  const enumRegex = /enum\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = enumRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];
    const values = body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
      .map((l) => l.split(/\s+/)[0])
      .filter(Boolean);
    enums.set(name, values);
  }
  return enums;
}

function extractModels(content: string): ParsedModel[] {
  const models: ParsedModel[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(content)) !== null) {
    const startLine = content.slice(0, match.index).split('\n').length;
    const name = match[1];
    const body = match[2];
    const lines = body.split('\n');
    const rawFields = lines
      .map((line, idx) => ({ line: line.trim(), lineNumber: startLine + idx + 1 }))
      .filter((f) => f.line && !f.line.startsWith('//') && !f.line.startsWith('@@'));
    models.push({ name, rawFields });
  }
  return models;
}

function parseFieldLine(
  line: string,
  modelNames: Set<string>,
  enums: Map<string, string[]>,
): { field: DomainField | null; isId: boolean; relation?: { to: string; cardinality: '1:1' | '1:N' | 'N:M' } } {
  const tokens = line.split(/\s+/);
  if (tokens.length < 2) return { field: null, isId: false };

  const name = tokens[0];
  let typeToken = tokens[1];

  const isList = typeToken.endsWith('[]');
  if (isList) typeToken = typeToken.slice(0, -2);

  const isOptional = typeToken.endsWith('?');
  if (isOptional) typeToken = typeToken.slice(0, -1);

  const rest = tokens.slice(2).join(' ');
  const isId = /\@id\b/.test(rest);
  const hasRelation = /\@relation\b/.test(rest);

  if (modelNames.has(typeToken)) {
    const cardinality = isList ? '1:N' : '1:1';
    const field: DomainField = {
      name,
      type: 'ref',
      refTo: typeToken,
      required: !isOptional,
    };
    return { field, isId, relation: { to: typeToken, cardinality } };
  }

  if (enums.has(typeToken)) {
    const field: DomainField = {
      name,
      type: 'enum',
      enum: enums.get(typeToken),
      required: !isOptional,
    };
    return { field, isId };
  }

  if (PRISMA_SCALARS.has(typeToken)) {
    const mapped = mapPrismaScalar(typeToken);
    const inferredFormat = inferFormatFromName(name, mapped.type);
    const field: DomainField = {
      name,
      type: isList ? 'list' : mapped.type,
      required: !isOptional && !isList,
      ...((mapped.format ?? inferredFormat) ? { format: (inferredFormat ?? mapped.format) as FieldFormat } : {}),
    };
    return { field, isId };
  }

  // Unknown type, suppress relation noise
  if (hasRelation) return { field: null, isId: false };

  return {
    field: { name, type: 'unknown', required: !isOptional },
    isId,
  };
}

export interface PrismaParseResult {
  entities: DomainEntity[];
  relations: DomainRelation[];
}

export async function parsePrismaSchema(rootDir: string): Promise<PrismaParseResult> {
  const candidates = [
    'prisma/schema.prisma',
    'schema.prisma',
    'db/schema.prisma',
  ];

  for (const candidate of candidates) {
    const path = join(rootDir, candidate);
    try {
      await access(path);
      const content = await readFile(path, 'utf-8');
      return parsePrismaContent(content, relative(rootDir, path));
    } catch {
      continue;
    }
  }

  return { entities: [], relations: [] };
}

export function parsePrismaContent(content: string, filePath: string): PrismaParseResult {
  const enums = extractEnums(content);
  const models = extractModels(content);
  const modelNames = new Set(models.map((m) => m.name));

  const entities: DomainEntity[] = [];
  const relations: DomainRelation[] = [];

  for (const model of models) {
    const fields: DomainField[] = [];
    const identifiers: string[] = [];

    for (const { line } of model.rawFields) {
      const parsed = parseFieldLine(line, modelNames, enums);
      if (!parsed.field) continue;
      fields.push(parsed.field);
      if (parsed.isId) identifiers.push(parsed.field.name);
      if (parsed.relation) {
        relations.push({
          from: model.name,
          to: parsed.relation.to,
          cardinality: parsed.relation.cardinality,
          field: parsed.field.name,
        });
      }
    }

    entities.push({
      name: model.name,
      source: 'prisma',
      filePath,
      fields,
      ...(identifiers.length > 0 ? { identifiers } : {}),
    });
  }

  return { entities, relations };
}
