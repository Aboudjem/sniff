import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type {
  ClassDeclaration,
  ClassProperty,
  Decorator,
  Identifier,
  ObjectExpression,
  StringLiteral,
  TSType,
} from '@babel/types';
import type { DomainEntity, DomainField, DomainRelation, FieldFormat, FieldType } from '../types.js';

const traverse = (
  typeof _traverse === 'function' ? _traverse : (_traverse as unknown as { default: typeof _traverse }).default
) as unknown as (ast: unknown, opts: unknown) => void;

const RELATION_DECORATORS = new Set(['OneToOne', 'OneToMany', 'ManyToOne', 'ManyToMany']);
const ID_DECORATORS = new Set([
  'PrimaryColumn',
  'PrimaryGeneratedColumn',
  'ObjectIdColumn',
]);

const COLUMN_TYPE_MAP: Record<string, { type: FieldType; format?: FieldFormat }> = {
  varchar:   { type: 'string' },
  char:      { type: 'string' },
  text:      { type: 'string' },
  uuid:      { type: 'string', format: 'uuid' },
  int:       { type: 'number', format: 'integer' },
  integer:   { type: 'number', format: 'integer' },
  bigint:    { type: 'number', format: 'integer' },
  smallint:  { type: 'number', format: 'integer' },
  tinyint:   { type: 'number', format: 'integer' },
  float:     { type: 'number', format: 'decimal' },
  double:    { type: 'number', format: 'decimal' },
  decimal:   { type: 'number', format: 'decimal' },
  numeric:   { type: 'number', format: 'decimal' },
  real:      { type: 'number', format: 'decimal' },
  boolean:   { type: 'boolean' },
  bool:      { type: 'boolean' },
  date:      { type: 'date', format: 'iso-date' },
  datetime:  { type: 'date', format: 'iso-date' },
  timestamp: { type: 'date', format: 'iso-date' },
  time:      { type: 'date', format: 'iso-date' },
  json:      { type: 'object' },
  jsonb:     { type: 'object' },
  enum:      { type: 'enum' },
};

function inferFormatFromName(fieldName: string, type: FieldType): FieldFormat | undefined {
  if (type !== 'string') return undefined;
  const n = fieldName.toLowerCase();
  if (n === 'email' || n.endsWith('email')) return 'email';
  if (n === 'url' || n.endsWith('url') || n.endsWith('uri')) return 'url';
  if (n === 'phone' || n.includes('phone')) return 'phone';
  if (n === 'password' || n.endsWith('password')) return 'password';
  return undefined;
}

function mapTsTypeAnnotation(tsType: TSType | null | undefined): { type: FieldType; format?: FieldFormat } {
  if (!tsType) return { type: 'unknown' };
  switch (tsType.type) {
    case 'TSStringKeyword': return { type: 'string' };
    case 'TSNumberKeyword': return { type: 'number' };
    case 'TSBooleanKeyword': return { type: 'boolean' };
    case 'TSArrayType': return { type: 'list' };
    case 'TSTypeReference': {
      if (tsType.typeName.type === 'Identifier') {
        const name = tsType.typeName.name;
        if (name === 'Date') return { type: 'date', format: 'iso-date' };
        if (name === 'Array') return { type: 'list' };
      }
      return { type: 'unknown' };
    }
    default: return { type: 'unknown' };
  }
}

function getDecoratorName(decorator: Decorator): string | null {
  const expr = decorator.expression;
  if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') {
    return expr.callee.name;
  }
  if (expr.type === 'Identifier') return expr.name;
  return null;
}

function findDecorator(decorators: Decorator[] | null | undefined, name: string): Decorator | undefined {
  if (!decorators) return undefined;
  return decorators.find((d) => getDecoratorName(d) === name);
}

function findDecoratorByNames(decorators: Decorator[] | null | undefined, names: Set<string>): Decorator | undefined {
  if (!decorators) return undefined;
  return decorators.find((d) => {
    const name = getDecoratorName(d);
    return name !== null && names.has(name);
  });
}

function getObjectPropertyString(obj: ObjectExpression, propName: string): string | null {
  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    const key = prop.key;
    const matches =
      (key.type === 'Identifier' && key.name === propName) ||
      (key.type === 'StringLiteral' && key.value === propName);
    if (!matches) continue;
    if (prop.value.type === 'StringLiteral') return prop.value.value;
  }
  return null;
}

function getObjectPropertyBoolean(obj: ObjectExpression, propName: string): boolean | null {
  for (const prop of obj.properties) {
    if (prop.type !== 'ObjectProperty') continue;
    const key = prop.key;
    const matches =
      (key.type === 'Identifier' && key.name === propName) ||
      (key.type === 'StringLiteral' && key.value === propName);
    if (!matches) continue;
    if (prop.value.type === 'BooleanLiteral') return prop.value.value;
  }
  return null;
}

function parseColumnDecorator(decorator: Decorator): { columnType?: string; nullable?: boolean } {
  if (decorator.expression.type !== 'CallExpression') return {};
  const args = decorator.expression.arguments;
  if (args.length === 0) return {};

  const result: { columnType?: string; nullable?: boolean } = {};

  if (args[0].type === 'StringLiteral') {
    result.columnType = (args[0] as StringLiteral).value.toLowerCase();
  }

  const optionsArg = args.find((a) => a.type === 'ObjectExpression') as ObjectExpression | undefined;
  if (optionsArg) {
    const typeStr = getObjectPropertyString(optionsArg, 'type');
    if (typeStr) result.columnType = typeStr.toLowerCase();
    const nullable = getObjectPropertyBoolean(optionsArg, 'nullable');
    if (nullable !== null) result.nullable = nullable;
  }

  return result;
}

function parseRelationDecorator(decorator: Decorator): { target?: string; isMany: boolean } {
  let isMany = false;
  const name = getDecoratorName(decorator);
  if (name === 'OneToMany' || name === 'ManyToMany') isMany = true;

  if (decorator.expression.type !== 'CallExpression') return { isMany };
  const args = decorator.expression.arguments;
  if (args.length === 0) return { isMany };

  const targetArg = args[0];
  if (targetArg.type === 'ArrowFunctionExpression') {
    const body = targetArg.body;
    if (body.type === 'Identifier') return { target: body.name, isMany };
  }

  return { isMany };
}

export interface TypeOrmParseResult {
  entities: DomainEntity[];
  relations: DomainRelation[];
}

export function parseTypeOrmContent(content: string, filePath: string): TypeOrmParseResult {
  const entities: DomainEntity[] = [];
  const relations: DomainRelation[] = [];

  let ast;
  try {
    ast = babelParse(content, {
      sourceType: 'module',
      plugins: [
        'typescript',
        ['decorators', { decoratorsBeforeExport: true }],
        'classProperties',
      ],
    });
  } catch {
    return { entities: [], relations: [] };
  }

  traverse(ast, {
    ClassDeclaration(path: NodePath<ClassDeclaration>) {
      const classNode = path.node;
      const decorators = classNode.decorators as Decorator[] | undefined;
      const entityDecorator = findDecorator(decorators, 'Entity');
      if (!entityDecorator) return;
      if (!classNode.id || classNode.id.type !== 'Identifier') return;

      const entityName = (classNode.id as Identifier).name;
      const fields: DomainField[] = [];
      const identifiers: string[] = [];

      for (const member of classNode.body.body) {
        if (member.type !== 'ClassProperty' && member.type !== 'ClassAccessorProperty') continue;
        const property = member as ClassProperty;
        if (property.key.type !== 'Identifier') continue;

        const fieldName = property.key.name;
        const propDecorators = property.decorators as Decorator[] | undefined;
        if (!propDecorators || propDecorators.length === 0) continue;

        const idDecorator = findDecoratorByNames(propDecorators, ID_DECORATORS);
        const columnDecorator = findDecorator(propDecorators, 'Column');
        const relationDecorator = findDecoratorByNames(propDecorators, RELATION_DECORATORS);

        const isOptional = property.optional ?? false;

        if (relationDecorator) {
          const { target, isMany } = parseRelationDecorator(relationDecorator);
          if (!target) continue;
          fields.push({
            name: fieldName,
            type: 'ref',
            refTo: target,
            required: !isOptional,
          });
          relations.push({
            from: entityName,
            to: target,
            cardinality: isMany ? '1:N' : '1:1',
            field: fieldName,
          });
          continue;
        }

        if (idDecorator) {
          const tsMapped = mapTsTypeAnnotation(property.typeAnnotation?.type === 'TSTypeAnnotation' ? property.typeAnnotation.typeAnnotation : null);
          const format = tsMapped.format ?? inferFormatFromName(fieldName, tsMapped.type);
          fields.push({
            name: fieldName,
            type: tsMapped.type,
            required: true,
            ...(format ? { format } : {}),
          });
          identifiers.push(fieldName);
          continue;
        }

        if (columnDecorator) {
          const colInfo = parseColumnDecorator(columnDecorator);
          let mapped: { type: FieldType; format?: FieldFormat };
          if (colInfo.columnType && COLUMN_TYPE_MAP[colInfo.columnType]) {
            mapped = COLUMN_TYPE_MAP[colInfo.columnType];
          } else {
            mapped = mapTsTypeAnnotation(property.typeAnnotation?.type === 'TSTypeAnnotation' ? property.typeAnnotation.typeAnnotation : null);
          }
          const required = !(isOptional || colInfo.nullable === true);
          const format = mapped.format ?? inferFormatFromName(fieldName, mapped.type);
          fields.push({
            name: fieldName,
            type: mapped.type,
            required,
            ...(format ? { format } : {}),
          });
          continue;
        }
      }

      entities.push({
        name: entityName,
        source: 'typeorm',
        filePath,
        fields,
        ...(identifiers.length > 0 ? { identifiers } : {}),
      });
    },
  });

  return { entities, relations };
}

const TYPEORM_GLOBS = [
  'src/entities/**/*.{ts,js}',
  'src/entity/**/*.{ts,js}',
  'entities/**/*.{ts,js}',
  'entity/**/*.{ts,js}',
  'src/models/**/*.{ts,js}',
  'models/**/*.{ts,js}',
];

export async function parseTypeOrmEntities(rootDir: string): Promise<TypeOrmParseResult> {
  const files = await fg(TYPEORM_GLOBS, {
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
    if (!/from\s+['"]typeorm['"]/.test(content) && !/@Entity\b/.test(content)) continue;

    const result = parseTypeOrmContent(content, relative(rootDir, file));
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
