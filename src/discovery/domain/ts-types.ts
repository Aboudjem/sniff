import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type {
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  TSTypeLiteral,
  TSTypeElement,
  TSPropertySignature,
  TSType,
} from '@babel/types';
import type { DomainEntity, DomainField, DomainRelation, FieldFormat, FieldType } from '../types.js';

const traverse = (
  typeof _traverse === 'function' ? _traverse : (_traverse as unknown as { default: typeof _traverse }).default
) as unknown as (ast: unknown, opts: unknown) => void;

function inferFormatFromName(fieldName: string, type: FieldType): FieldFormat | undefined {
  if (type !== 'string') return undefined;
  const n = fieldName.toLowerCase();
  if (n === 'email' || n.endsWith('email')) return 'email';
  if (n === 'url' || n.endsWith('url') || n.endsWith('uri')) return 'url';
  if (n === 'phone' || n.includes('phone')) return 'phone';
  if (n === 'password' || n.endsWith('password')) return 'password';
  if (n === 'id' || n.endsWith('id') || n.endsWith('Id')) return 'uuid';
  return undefined;
}

function mapTsType(tsType: TSType, knownEntities: Set<string>): {
  type: FieldType;
  format?: FieldFormat;
  refTo?: string;
  enumValues?: string[];
} {
  switch (tsType.type) {
    case 'TSStringKeyword': return { type: 'string' };
    case 'TSNumberKeyword': return { type: 'number' };
    case 'TSBooleanKeyword': return { type: 'boolean' };
    case 'TSBigIntKeyword': return { type: 'number', format: 'integer' };
    case 'TSNullKeyword': return { type: 'unknown' };
    case 'TSUndefinedKeyword': return { type: 'unknown' };
    case 'TSAnyKeyword': return { type: 'unknown' };
    case 'TSUnknownKeyword': return { type: 'unknown' };

    case 'TSArrayType': return { type: 'list' };

    case 'TSTypeReference': {
      if (tsType.typeName.type !== 'Identifier') return { type: 'unknown' };
      const name = tsType.typeName.name;
      if (name === 'Date') return { type: 'date', format: 'iso-date' };
      if (name === 'Array') return { type: 'list' };
      if (name === 'Record') return { type: 'object' };
      if (knownEntities.has(name)) return { type: 'ref', refTo: name };
      return { type: 'unknown' };
    }

    case 'TSUnionType': {
      const nonNull = tsType.types.filter(
        (t) => t.type !== 'TSNullKeyword' && t.type !== 'TSUndefinedKeyword',
      );
      const allStringLiterals = nonNull.every((t) => t.type === 'TSLiteralType' && t.literal.type === 'StringLiteral');
      if (allStringLiterals && nonNull.length > 0) {
        const values = nonNull
          .filter((t): t is import('@babel/types').TSLiteralType => t.type === 'TSLiteralType')
          .map((t) => (t.literal.type === 'StringLiteral' ? t.literal.value : null))
          .filter((v): v is string => v !== null);
        return { type: 'enum', enumValues: values };
      }
      if (nonNull.length === 1) return mapTsType(nonNull[0], knownEntities);
      return { type: 'unknown' };
    }

    case 'TSLiteralType':
      if (tsType.literal.type === 'StringLiteral') return { type: 'string' };
      if (tsType.literal.type === 'NumericLiteral') return { type: 'number' };
      if (tsType.literal.type === 'BooleanLiteral') return { type: 'boolean' };
      return { type: 'unknown' };

    case 'TSTypeLiteral': return { type: 'object' };

    default: return { type: 'unknown' };
  }
}

function interfaceMembers(node: TSInterfaceDeclaration): TSTypeElement[] {
  return node.body.body;
}

function typeAliasMembers(node: TSTypeAliasDeclaration): TSTypeElement[] | null {
  const annotation = node.typeAnnotation;
  if (annotation.type !== 'TSTypeLiteral') return null;
  return (annotation as TSTypeLiteral).members;
}

function extractFieldsFromMembers(
  members: TSTypeElement[],
  knownEntities: Set<string>,
): { fields: DomainField[]; refs: Array<{ field: string; to: string; isList: boolean }> } {
  const fields: DomainField[] = [];
  const refs: Array<{ field: string; to: string; isList: boolean }> = [];

  for (const member of members) {
    if (member.type !== 'TSPropertySignature') continue;
    const sig = member as TSPropertySignature;
    if (sig.key.type !== 'Identifier') continue;
    const fieldName = sig.key.name;
    const required = sig.optional !== true;
    const annotation = sig.typeAnnotation;
    if (!annotation || annotation.type !== 'TSTypeAnnotation') {
      fields.push({ name: fieldName, type: 'unknown', required });
      continue;
    }

    const tsType = annotation.typeAnnotation;
    const mapped = mapTsType(tsType, knownEntities);

    if (mapped.type === 'list' && tsType.type === 'TSArrayType') {
      const elementType = tsType.elementType;
      const inner = mapTsType(elementType, knownEntities);
      if (inner.type === 'ref' && inner.refTo) {
        fields.push({ name: fieldName, type: 'ref', refTo: inner.refTo, required });
        refs.push({ field: fieldName, to: inner.refTo, isList: true });
        continue;
      }
      fields.push({ name: fieldName, type: 'list', required });
      continue;
    }

    if (mapped.type === 'ref' && mapped.refTo) {
      fields.push({ name: fieldName, type: 'ref', refTo: mapped.refTo, required });
      refs.push({ field: fieldName, to: mapped.refTo, isList: false });
      continue;
    }

    const inferredFormat = inferFormatFromName(fieldName, mapped.type);
    const finalFormat = mapped.format ?? inferredFormat;
    const field: DomainField = { name: fieldName, type: mapped.type, required };
    if (finalFormat) field.format = finalFormat;
    if (mapped.enumValues) field.enum = mapped.enumValues;
    fields.push(field);
  }

  return { fields, refs };
}

export interface TsTypesParseResult {
  entities: DomainEntity[];
  relations: DomainRelation[];
}

interface CandidateEntity {
  name: string;
  filePath: string;
  members: TSTypeElement[];
}

export function parseTsTypesContent(content: string, filePath: string): TsTypesParseResult {
  let ast;
  try {
    ast = babelParse(content, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch {
    return { entities: [], relations: [] };
  }

  const candidates: CandidateEntity[] = [];

  traverse(ast, {
    TSInterfaceDeclaration(path: NodePath<TSInterfaceDeclaration>) {
      const name = path.node.id.name;
      candidates.push({ name, filePath, members: interfaceMembers(path.node) });
    },
    TSTypeAliasDeclaration(path: NodePath<TSTypeAliasDeclaration>) {
      const name = path.node.id.name;
      const members = typeAliasMembers(path.node);
      if (!members) return;
      candidates.push({ name, filePath, members });
    },
  });

  const knownEntities = new Set(candidates.map((c) => c.name));
  const entities: DomainEntity[] = [];
  const relations: DomainRelation[] = [];

  for (const candidate of candidates) {
    const { fields, refs } = extractFieldsFromMembers(candidate.members, knownEntities);
    if (fields.length === 0) continue;
    const identifiers = fields
      .filter((f) => f.name === 'id' || f.format === 'uuid')
      .map((f) => f.name)
      .slice(0, 1);

    entities.push({
      name: candidate.name,
      source: 'ts',
      filePath: candidate.filePath,
      fields,
      ...(identifiers.length > 0 ? { identifiers } : {}),
    });

    for (const ref of refs) {
      relations.push({
        from: candidate.name,
        to: ref.to,
        cardinality: ref.isList ? '1:N' : '1:1',
        field: ref.field,
      });
    }
  }

  return { entities, relations };
}

const TS_TYPE_GLOBS = [
  'src/models/**/*.{ts,tsx}',
  'models/**/*.{ts,tsx}',
  'src/types/**/*.{ts,tsx}',
  'types/**/*.{ts,tsx}',
  'src/schemas/**/*.{ts,tsx}',
  'schemas/**/*.{ts,tsx}',
  'src/entities/**/*.{ts,tsx}',
  'entities/**/*.{ts,tsx}',
  'src/domain/**/*.{ts,tsx}',
  'domain/**/*.{ts,tsx}',
];

const COMMON_UTILITY_NAMES = new Set([
  'Props',
  'State',
  'Config',
  'Options',
  'Params',
  'Query',
  'Context',
  'Theme',
  'Variant',
]);

function looksLikeEntityName(name: string): boolean {
  if (!/^[A-Z]/.test(name)) return false;
  if (COMMON_UTILITY_NAMES.has(name)) return false;
  if (name.endsWith('Props') || name.endsWith('State') || name.endsWith('Config')) return false;
  return true;
}

export async function parseTsTypes(rootDir: string): Promise<TsTypesParseResult> {
  const files = await fg(TS_TYPE_GLOBS, {
    cwd: rootDir,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**', '**/*.test.ts', '**/*.spec.ts'],
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

    const result = parseTsTypesContent(content, relative(rootDir, file));
    for (const entity of result.entities) {
      if (!looksLikeEntityName(entity.name)) continue;
      if (seenEntities.has(entity.name)) continue;
      seenEntities.add(entity.name);
      allEntities.push(entity);
    }
    for (const relation of result.relations) {
      if (!looksLikeEntityName(relation.from) || !looksLikeEntityName(relation.to)) continue;
      allRelations.push(relation);
    }
  }

  return { entities: allEntities, relations: allRelations };
}
