import type { AnalysisResult, RouteInfo } from '../analyzers/types.js';

export type EntitySource =
  | 'prisma'
  | 'drizzle'
  | 'typeorm'
  | 'zod'
  | 'ts'
  | 'graphql'
  | 'openapi'
  | 'form';

export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'ref'
  | 'list'
  | 'object'
  | 'unknown';

export type FieldFormat =
  | 'email'
  | 'url'
  | 'uuid'
  | 'phone'
  | 'iso-date'
  | 'decimal'
  | 'integer'
  | 'password';

export interface DomainField {
  name: string;
  type: FieldType;
  required?: boolean;
  format?: FieldFormat;
  refTo?: string;
  enum?: string[];
}

export interface DomainEntity {
  name: string;
  source: EntitySource;
  filePath: string;
  fields: DomainField[];
  identifiers?: string[];
}

export type Cardinality = '1:1' | '1:N' | 'N:M';

export interface DomainRelation {
  from: string;
  to: string;
  cardinality: Cardinality;
  field: string;
}

export type FormIntent =
  | 'sign-in'
  | 'sign-up'
  | 'reset-password'
  | 'search'
  | 'checkout'
  | 'contact'
  | 'create'
  | 'update'
  | 'subscribe'
  | 'unknown';

export interface DomainFormField {
  selector?: string;
  name: string;
  type: string;
  required: boolean;
  placeholder?: string;
  ariaLabel?: string;
}

export interface DomainForm {
  route: string;
  filePath: string;
  fields: DomainFormField[];
  submitTo?: string;
  intent: FormIntent;
  intentConfidence: number;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  filePath?: string;
  bodySchema?: string;
  auth?: boolean;
}

export interface DomainVocabulary {
  routes: string[];
  elements: string[];
  deps: string[];
}

export interface DomainSnapshot {
  project: AnalysisResult['project'];
  routes: RouteInfo[];
  forms: DomainForm[];
  entities: DomainEntity[];
  relations: DomainRelation[];
  apiEndpoints: ApiEndpoint[];
  vocabulary: DomainVocabulary;
  metadata: {
    analyzedAt: string;
    duration: number;
  };
}
