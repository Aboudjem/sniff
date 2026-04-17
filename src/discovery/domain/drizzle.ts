import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { CallExpression, ObjectProperty, ObjectExpression, VariableDeclarator } from '@babel/types';
import type { DomainEntity, DomainField, DomainRelation, FieldFormat, FieldType } from '../types.js';

const traverse = (
  typeof _traverse === 'function' ? _traverse : (_traverse as unknown as { default: typeof _traverse }).default
) as unknown as (ast: unknown, opts: unknown) => void;

const TABLE_FACTORIES = new Set(['pgTable', 'mysqlTable', 'sqliteTable']);

const STRING_COLUMNS = new Set(['text', 'varchar', 'char', 'string', 'citext']);
const NUMBER_INT_COLUMNS = new Set(['serial', 'integer', 'bigint', 'smallint', 'tinyint']);
const NUMBER_DEC_COLUMNS = new Set(['decimal', 'numeric', 'real', 'doublePrecision', 'double', 'float']);
const BOOL_COLUMNS = new Set(['boolean', 'bool']);
const DATE_COLUMNS = new Set(['timestamp', 'timestamptz', 'date', 'time', 'datetime']);
const JSON_COLUMNS = new Set(['json', 'jsonb']);
const UUID_COLUMNS = new Set(['uuid']);

function mapDrizzleColumn(columnFn: string): { type: FieldType; format?: FieldFormat } {
  if (STRING_COLUMNS.has(columnFn)) return { type: 'string' };
  if (NUMBER_INT_COLUMNS.has(columnFn)) return { type: 'number', format: 'integer' };
  if (NUMBER_DEC_COLUMNS.has(columnFn)) return { type: 'number', format: 'decimal' };
  if (BOOL_COLUMNS.has(columnFn)) return { type: 'boolean' };
  if (DATE_COLUMNS.has(columnFn)) return { type: 'date', format: 'iso-date' };
  if (JSON_COLUMNS.has(columnFn)) return { type: 'object' };
  if (UUID_COLUMNS.has(columnFn)) return { type: 'string', format: 'uuid' };
  if (columnFn === 'enum' || columnFn === 'pgEnum') return { type: 'enum' };
  return { type: 'unknown' };
}

function inferFormatFromName(fieldName: string, type: FieldType): FieldFormat | undefined {
  if (type !== 'string') return undefined;
  const n = fieldName.toLowerCase();
  if (n === 'email' || n.endsWith('email')) return 'email';
  if (n === 'url' || n.endsWith('url') || n.endsWith('uri')) return 'url';
  if (n === 'phone' || n.includes('phone')) return 'phone';
  if (n === 'password' || n.endsWith('password')) return 'password';
  return undefined;
}

interface ColumnInspection {
  baseFn: string;
  modifiers: Set<string>;
  referencesEntity?: string;
  referencesField?: string;
}

function inspectColumnExpression(node: unknown): ColumnInspection {
  const modifiers = new Set<string>();
  let referencesEntity: string | undefined;
  let referencesField: string | undefined;
  let cursor: unknown = node;

  while (cursor && (cursor as { type: string }).type === 'CallExpression') {
    const call = cursor as CallExpression;
    const callee = call.callee;
    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
      modifiers.add(callee.property.name);
      if (callee.property.name === 'references' && call.arguments.length > 0) {
        const arg = call.arguments[0];
        if (arg.type === 'ArrowFunctionExpression') {
          const body = arg.body;
          if (body.type === 'MemberExpression' && body.object.type === 'Identifier' && body.property.type === 'Identifier') {
            referencesEntity = body.object.name;
            referencesField = body.property.name;
          }
        }
      }
      cursor = callee.object;
    } else if (callee.type === 'Identifier') {
      return { baseFn: callee.name, modifiers, referencesEntity, referencesField };
    } else {
      break;
    }
  }

  return { baseFn: 'unknown', modifiers };
}

function getStringLiteralName(declarator: VariableDeclarator): string | null {
  if (declarator.id.type !== 'Identifier') return null;
  return declarator.id.name;
}

function getColumnsObject(call: CallExpression): ObjectExpression | null {
  if (call.arguments.length < 2) return null;
  const columnsArg = call.arguments[1];
  if (columnsArg.type !== 'ObjectExpression') return null;
  return columnsArg;
}

function pascalCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function singularize(s: string): string {
  if (s.endsWith('ies') && s.length > 3) return s.slice(0, -3) + 'y';
  if (s.endsWith('ses') || s.endsWith('xes') || s.endsWith('zes')) return s.slice(0, -2);
  if (s.endsWith('s') && !s.endsWith('ss')) return s.slice(0, -1);
  return s;
}

export interface DrizzleParseResult {
  entities: DomainEntity[];
  relations: DomainRelation[];
}

export function parseDrizzleContent(content: string, filePath: string): DrizzleParseResult {
  const entities: DomainEntity[] = [];
  const relations: DomainRelation[] = [];
  const tableVarToEntity = new Map<string, string>();

  let ast;
  try {
    ast = babelParse(content, { sourceType: 'module', plugins: ['typescript'] });
  } catch {
    return { entities: [], relations: [] };
  }

  const tableCalls: Array<{ varName: string; entityName: string; columnsObj: ObjectExpression }> = [];

  traverse(ast, {
    VariableDeclarator(path: NodePath<VariableDeclarator>) {
      const init = path.node.init;
      if (!init || init.type !== 'CallExpression') return;
      if (init.callee.type !== 'Identifier' || !TABLE_FACTORIES.has(init.callee.name)) return;
      const varName = getStringLiteralName(path.node);
      if (!varName) return;
      const columnsObj = getColumnsObject(init);
      if (!columnsObj) return;
      const entityName = pascalCase(singularize(varName));
      tableVarToEntity.set(varName, entityName);
      tableCalls.push({ varName, entityName, columnsObj });
    },
  });

  for (const { varName, entityName, columnsObj } of tableCalls) {
    const fields: DomainField[] = [];
    const identifiers: string[] = [];

    for (const property of columnsObj.properties) {
      if (property.type !== 'ObjectProperty') continue;
      const prop = property as ObjectProperty;
      let fieldName: string;
      if (prop.key.type === 'Identifier') fieldName = prop.key.name;
      else if (prop.key.type === 'StringLiteral') fieldName = prop.key.value;
      else continue;

      const inspection = inspectColumnExpression(prop.value);
      const isRequired = inspection.modifiers.has('notNull') || inspection.modifiers.has('primaryKey');
      const isId = inspection.modifiers.has('primaryKey');

      if (inspection.referencesEntity) {
        const targetEntity = tableVarToEntity.get(inspection.referencesEntity) ?? pascalCase(singularize(inspection.referencesEntity));
        fields.push({
          name: fieldName,
          type: 'ref',
          refTo: targetEntity,
          required: isRequired,
        });
        relations.push({
          from: entityName,
          to: targetEntity,
          cardinality: '1:1',
          field: fieldName,
        });
        if (isId) identifiers.push(fieldName);
        continue;
      }

      const mapped = mapDrizzleColumn(inspection.baseFn);
      const inferredFormat = inferFormatFromName(fieldName, mapped.type);
      const finalFormat = inferredFormat ?? mapped.format;
      fields.push({
        name: fieldName,
        type: mapped.type,
        required: isRequired,
        ...(finalFormat ? { format: finalFormat } : {}),
      });
      if (isId) identifiers.push(fieldName);
    }

    entities.push({
      name: entityName,
      source: 'drizzle',
      filePath,
      fields,
      ...(identifiers.length > 0 ? { identifiers } : {}),
    });
  }

  return { entities, relations };
}

const DRIZZLE_GLOBS = [
  'src/db/**/*.{ts,js}',
  'db/**/*.{ts,js}',
  'src/schema/**/*.{ts,js}',
  'schema/**/*.{ts,js}',
  'src/lib/db/**/*.{ts,js}',
  'lib/db/**/*.{ts,js}',
  'src/database/**/*.{ts,js}',
  'database/**/*.{ts,js}',
];

export async function parseDrizzleSchemas(rootDir: string): Promise<DrizzleParseResult> {
  const files = await fg(DRIZZLE_GLOBS, {
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
    if (!content.includes('drizzle-orm') && !TABLE_FACTORIES.has('pgTable')) continue;
    if (!/\b(pgTable|mysqlTable|sqliteTable)\b/.test(content)) continue;

    const result = parseDrizzleContent(content, relative(rootDir, file));
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
