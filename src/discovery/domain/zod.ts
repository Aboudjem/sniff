import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type {
  CallExpression,
  VariableDeclarator,
  ObjectExpression,
  ObjectProperty,
  Expression,
} from '@babel/types';
import type { DomainEntity, DomainField, FieldFormat, FieldType } from '../types.js';

const traverse = (
  typeof _traverse === 'function' ? _traverse : (_traverse as unknown as { default: typeof _traverse }).default
) as unknown as (ast: unknown, opts: unknown) => void;

interface ZodChain {
  baseMethod: string;
  modifiers: Set<string>;
  arrayInner?: string;
  enumValues?: string[];
}

function inspectZodChain(expr: Expression): ZodChain {
  const modifiers = new Set<string>();
  let baseMethod = 'unknown';
  let arrayInner: string | undefined;
  let enumValues: string[] | undefined;
  let cursor: Expression = expr;

  while (cursor.type === 'CallExpression') {
    const call = cursor as CallExpression;
    const callee = call.callee;

    if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
      const name = callee.property.name;
      if (callee.object.type === 'Identifier' && callee.object.name === 'z') {
        baseMethod = name;
        if (name === 'array' && call.arguments[0]?.type === 'CallExpression') {
          const inner = inspectZodChain(call.arguments[0] as Expression);
          arrayInner = inner.baseMethod;
        }
        if (name === 'enum' && call.arguments[0]?.type === 'ArrayExpression') {
          enumValues = call.arguments[0].elements
            .filter((el): el is import('@babel/types').StringLiteral => el !== null && el.type === 'StringLiteral')
            .map((el) => el.value);
        }
        break;
      }
      modifiers.add(name);
      cursor = callee.object as Expression;
      continue;
    }

    break;
  }

  return { baseMethod, modifiers, arrayInner, enumValues };
}

function mapZodBase(base: string): { type: FieldType; format?: FieldFormat } {
  switch (base) {
    case 'string': return { type: 'string' };
    case 'number': return { type: 'number' };
    case 'bigint': return { type: 'number', format: 'integer' };
    case 'boolean': return { type: 'boolean' };
    case 'date': return { type: 'date', format: 'iso-date' };
    case 'object': return { type: 'object' };
    case 'array': return { type: 'list' };
    case 'enum': return { type: 'enum' };
    case 'nativeEnum': return { type: 'enum' };
    case 'record': return { type: 'object' };
    case 'literal': return { type: 'string' };
    default: return { type: 'unknown' };
  }
}

function modifierToFormat(modifiers: Set<string>): FieldFormat | undefined {
  if (modifiers.has('email')) return 'email';
  if (modifiers.has('url')) return 'url';
  if (modifiers.has('uuid')) return 'uuid';
  if (modifiers.has('int')) return 'integer';
  return undefined;
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

function stripEntitySuffix(name: string): string {
  return name
    .replace(/Schema$/, '')
    .replace(/DTO$/, '')
    .replace(/Dto$/, '')
    .replace(/Shape$/, '');
}

function fieldFromZodChain(fieldName: string, chain: ZodChain): DomainField {
  const mapped = mapZodBase(chain.baseMethod);
  const modifierFormat = modifierToFormat(chain.modifiers);
  const inferredFormat = inferFormatFromName(fieldName, mapped.type);
  const required = !chain.modifiers.has('optional') && !chain.modifiers.has('nullish');
  const finalFormat = modifierFormat ?? inferredFormat ?? mapped.format;

  const field: DomainField = {
    name: fieldName,
    type: mapped.type,
    required,
  };

  if (finalFormat) field.format = finalFormat;
  if (chain.enumValues) field.enum = chain.enumValues;

  return field;
}

export interface ZodParseResult {
  entities: DomainEntity[];
}

export function parseZodContent(content: string, filePath: string): ZodParseResult {
  const entities: DomainEntity[] = [];

  let ast;
  try {
    ast = babelParse(content, { sourceType: 'module', plugins: ['typescript'] });
  } catch {
    return { entities: [] };
  }

  traverse(ast, {
    VariableDeclarator(path: NodePath<VariableDeclarator>) {
      const init = path.node.init;
      if (!init) return;
      if (path.node.id.type !== 'Identifier') return;

      let objectCall: CallExpression | null = null;
      let cursor: Expression | null = init;
      while (cursor && cursor.type === 'CallExpression') {
        const callee = cursor.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'z' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'object'
        ) {
          objectCall = cursor;
          break;
        }
        if (callee.type === 'MemberExpression') {
          cursor = callee.object as Expression;
          continue;
        }
        break;
      }

      if (!objectCall) return;

      const shapeArg = objectCall.arguments[0];
      if (!shapeArg || shapeArg.type !== 'ObjectExpression') return;

      const rawName = path.node.id.name;
      const entityName = stripEntitySuffix(rawName);
      const fields: DomainField[] = [];

      for (const property of (shapeArg as ObjectExpression).properties) {
        if (property.type !== 'ObjectProperty') continue;
        const prop = property as ObjectProperty;
        let fieldName: string;
        if (prop.key.type === 'Identifier') fieldName = prop.key.name;
        else if (prop.key.type === 'StringLiteral') fieldName = prop.key.value;
        else continue;

        if (prop.value.type !== 'CallExpression' && prop.value.type !== 'MemberExpression') continue;
        const chain = inspectZodChain(prop.value as Expression);
        fields.push(fieldFromZodChain(fieldName, chain));
      }

      if (fields.length === 0) return;

      entities.push({
        name: entityName,
        source: 'zod',
        filePath,
        fields,
      });
    },
  });

  return { entities };
}

const ZOD_GLOBS = [
  'src/schemas/**/*.{ts,tsx,js,jsx}',
  'schemas/**/*.{ts,tsx,js,jsx}',
  'src/types/**/*.{ts,tsx,js,jsx}',
  'types/**/*.{ts,tsx,js,jsx}',
  'src/validators/**/*.{ts,tsx,js,jsx}',
  'validators/**/*.{ts,tsx,js,jsx}',
  'src/models/**/*.{ts,tsx,js,jsx}',
  'src/lib/**/*.{ts,tsx,js,jsx}',
  'app/**/*.{ts,tsx,js,jsx}',
  'src/app/**/*.{ts,tsx,js,jsx}',
];

export async function parseZodSchemas(rootDir: string): Promise<ZodParseResult> {
  const files = await fg(ZOD_GLOBS, {
    cwd: rootDir,
    absolute: true,
    ignore: ['node_modules/**', 'dist/**', 'build/**', '.next/**'],
  });

  const allEntities: DomainEntity[] = [];
  const seenEntities = new Set<string>();

  for (const file of files) {
    let content: string;
    try {
      content = await readFile(file, 'utf-8');
    } catch {
      continue;
    }
    if (!content.includes('zod')) continue;
    if (!/\bz\s*\.\s*object\s*\(/.test(content)) continue;

    const result = parseZodContent(content, relative(rootDir, file));
    for (const entity of result.entities) {
      if (!seenEntities.has(entity.name)) {
        seenEntities.add(entity.name);
        allEntities.push(entity);
      }
    }
  }

  return { entities: allEntities };
}
