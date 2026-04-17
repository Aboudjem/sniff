import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type {
  ApiEndpoint,
  DomainEntity,
  DomainField,
  FieldFormat,
  FieldType,
  HttpMethod,
} from '../types.js';

interface OpenApiSchema {
  type?: string;
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  enum?: unknown[];
  $ref?: string;
  allOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
}

interface OpenApiMethodSpec {
  operationId?: string;
  requestBody?: {
    content?: Record<string, { schema?: OpenApiSchema }>;
  };
  security?: unknown[];
  parameters?: unknown[];
}

interface OpenApiDocument {
  openapi?: string;
  swagger?: string;
  paths?: Record<string, Record<string, OpenApiMethodSpec>>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
  definitions?: Record<string, OpenApiSchema>;
  security?: unknown[];
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const OPENAPI_FORMAT_MAP: Record<string, FieldFormat> = {
  email: 'email',
  uri: 'url',
  url: 'url',
  uuid: 'uuid',
  'date-time': 'iso-date',
  date: 'iso-date',
  password: 'password',
  int32: 'integer',
  int64: 'integer',
  float: 'decimal',
  double: 'decimal',
};

function refToEntityName(ref: string): string | null {
  const match = /#\/components\/schemas\/([A-Z]\w+)/.exec(ref) ?? /#\/definitions\/([A-Z]\w+)/.exec(ref);
  return match ? match[1] : null;
}

function mapSchemaToField(
  fieldName: string,
  schema: OpenApiSchema,
  required: boolean,
): DomainField {
  if (schema.$ref) {
    const refName = refToEntityName(schema.$ref);
    if (refName) {
      return { name: fieldName, type: 'ref', refTo: refName, required };
    }
  }

  if (schema.enum) {
    const values = schema.enum.filter((v): v is string => typeof v === 'string');
    return { name: fieldName, type: 'enum', required, enum: values };
  }

  if (schema.type === 'array') {
    if (schema.items?.$ref) {
      const refName = refToEntityName(schema.items.$ref);
      if (refName) {
        return { name: fieldName, type: 'ref', refTo: refName, required };
      }
    }
    return { name: fieldName, type: 'list', required };
  }

  const baseType = schemaTypeToFieldType(schema.type);
  const format = schema.format ? OPENAPI_FORMAT_MAP[schema.format] : undefined;
  const field: DomainField = { name: fieldName, type: baseType, required };
  if (format) field.format = format;
  return field;
}

function schemaTypeToFieldType(openApiType: string | undefined): FieldType {
  switch (openApiType) {
    case 'string': return 'string';
    case 'integer':
    case 'number':  return 'number';
    case 'boolean': return 'boolean';
    case 'object':  return 'object';
    case 'array':   return 'list';
    default:        return 'unknown';
  }
}

function schemaToEntity(name: string, schema: OpenApiSchema, filePath: string): DomainEntity | null {
  if (!schema.properties) return null;
  const requiredSet = new Set(schema.required ?? []);
  const fields: DomainField[] = [];
  for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
    fields.push(mapSchemaToField(fieldName, fieldSchema, requiredSet.has(fieldName)));
  }
  if (fields.length === 0) return null;

  const identifiers = fields.filter((f) => f.name === 'id' || f.format === 'uuid').map((f) => f.name).slice(0, 1);

  return {
    name,
    source: 'openapi',
    filePath,
    fields,
    ...(identifiers.length > 0 ? { identifiers } : {}),
  };
}

function extractRequestBodyEntityName(method: OpenApiMethodSpec): string | undefined {
  const content = method.requestBody?.content;
  if (!content) return undefined;
  for (const mediaType of Object.values(content)) {
    const schema = mediaType.schema;
    if (!schema) continue;
    if (schema.$ref) {
      const name = refToEntityName(schema.$ref);
      if (name) return name;
    }
  }
  return undefined;
}

function hasAuthRequirement(method: OpenApiMethodSpec, global: unknown[] | undefined): boolean {
  if (Array.isArray(method.security) && method.security.length > 0) return true;
  if (Array.isArray(global) && global.length > 0 && method.security === undefined) return true;
  return false;
}

export interface OpenApiParseResult {
  entities: DomainEntity[];
  endpoints: ApiEndpoint[];
}

export function parseOpenApiDocument(doc: OpenApiDocument, filePath: string): OpenApiParseResult {
  const entities: DomainEntity[] = [];
  const endpoints: ApiEndpoint[] = [];

  const schemas = doc.components?.schemas ?? doc.definitions ?? {};
  for (const [name, schema] of Object.entries(schemas)) {
    const entity = schemaToEntity(name, schema, filePath);
    if (entity) entities.push(entity);
  }

  if (doc.paths) {
    for (const [path, methods] of Object.entries(doc.paths)) {
      for (const [methodLower, spec] of Object.entries(methods)) {
        const method = methodLower.toUpperCase() as HttpMethod;
        if (!HTTP_METHODS.includes(method)) continue;
        const bodySchema = extractRequestBodyEntityName(spec);
        endpoints.push({
          method,
          path,
          filePath,
          ...(bodySchema ? { bodySchema } : {}),
          auth: hasAuthRequirement(spec, doc.security),
        });
      }
    }
  }

  return { entities, endpoints };
}

export async function parseOpenApiSpec(rootDir: string): Promise<OpenApiParseResult> {
  const candidates = [
    'openapi.json',
    'swagger.json',
    'api/openapi.json',
    'api/swagger.json',
    'docs/openapi.json',
    'docs/swagger.json',
    'src/openapi.json',
  ];

  for (const candidate of candidates) {
    const path = join(rootDir, candidate);
    let content: string;
    try {
      content = await readFile(path, 'utf-8');
    } catch {
      continue;
    }

    let doc: OpenApiDocument;
    try {
      doc = JSON.parse(content) as OpenApiDocument;
    } catch {
      continue;
    }

    return parseOpenApiDocument(doc, relative(rootDir, path));
  }

  return { entities: [], endpoints: [] };
}
