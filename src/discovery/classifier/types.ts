export type AppType =
  | 'ecommerce'
  | 'booking'
  | 'social'
  | 'saas'
  | 'content'
  | 'crm'
  | 'auth-only'
  | 'marketing'
  | 'admin'
  | 'blank';

export type SignalKind = 'route' | 'element' | 'dep' | 'schema' | 'env' | 'pkg';

export interface Evidence {
  signal: SignalKind;
  value: string;
  weight: number;
}

export interface AppTypeGuess {
  type: AppType;
  confidence: number;
  evidence: Evidence[];
  rawScore: number;
}

export interface Signature {
  type: AppType;
  routes: Record<string, number>;
  elements: Record<string, number>;
  deps: Record<string, number>;
  schema: Record<string, number>;
}
