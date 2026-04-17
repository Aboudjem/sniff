import type { ComponentInfo, ElementInfo, RouteInfo } from '../../analyzers/types.js';
import type { DomainForm, DomainFormField, FormIntent } from '../types.js';

const INPUT_TAGS = new Set(['input', 'select', 'textarea']);

const INTENT_KEYWORDS: Record<FormIntent, { fields: string[]; buttons: string[]; routes: string[] }> = {
  'sign-in': {
    fields: [],
    buttons: ['sign in', 'log in', 'login', 'signin'],
    routes: ['/login', '/signin', '/sign-in', '/auth/login', '/auth/signin'],
  },
  'sign-up': {
    fields: [],
    buttons: ['sign up', 'register', 'create account', 'get started', 'join'],
    routes: ['/signup', '/sign-up', '/register', '/auth/register', '/auth/signup', '/join'],
  },
  'reset-password': {
    fields: [],
    buttons: ['reset password', 'forgot password', 'send reset link', 'recover'],
    routes: ['/forgot-password', '/reset-password', '/auth/forgot', '/auth/reset', '/recover'],
  },
  search: {
    fields: ['search', 'query', 'q', 'keywords', 'term'],
    buttons: ['search', 'find', 'lookup'],
    routes: ['/search', '/results'],
  },
  checkout: {
    fields: ['card', 'cardnumber', 'card-number', 'cvv', 'cvc', 'expiry', 'exp-month', 'expmonth', 'shipping', 'billing'],
    buttons: ['checkout', 'pay', 'place order', 'buy now', 'complete purchase', 'confirm order'],
    routes: ['/checkout', '/cart/checkout', '/pay', '/payment'],
  },
  contact: {
    fields: ['message', 'subject', 'inquiry', 'comments'],
    buttons: ['send message', 'contact us', 'send'],
    routes: ['/contact', '/support', '/help/contact'],
  },
  subscribe: {
    fields: ['newsletter', 'subscribe'],
    buttons: ['subscribe', 'sign me up', 'join newsletter', 'get updates'],
    routes: ['/subscribe', '/newsletter'],
  },
  create: {
    fields: [],
    buttons: ['create', 'add', 'new', 'save'],
    routes: ['/new', '/create'],
  },
  update: {
    fields: [],
    buttons: ['update', 'save changes', 'apply'],
    routes: ['/edit', '/settings'],
  },
  unknown: { fields: [], buttons: [], routes: [] },
};

interface Signals {
  fieldNames: string[];
  buttonTexts: string[];
  componentPath: string;
  routePath: string | null;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function includesPhrase(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function scoreIntent(intent: FormIntent, signals: Signals): number {
  if (intent === 'unknown') return 0;
  const keys = INTENT_KEYWORDS[intent];
  let score = 0;

  for (const field of signals.fieldNames) {
    const tokens = new Set(tokenize(field));
    for (const fieldKey of keys.fields) {
      const kTokens = tokenize(fieldKey);
      const matchesAll = kTokens.every((t) => tokens.has(t));
      if (matchesAll) score += 3;
    }
  }

  const allButtonText = signals.buttonTexts.join(' ');
  for (const phrase of keys.buttons) {
    if (includesPhrase(allButtonText, phrase)) score += 2;
  }

  if (signals.routePath) {
    for (const routePattern of keys.routes) {
      if (signals.routePath === routePattern || signals.routePath.startsWith(routePattern + '/')) {
        score += 4;
      }
    }
  }

  return score;
}

function hasField(fieldNames: string[], token: string): boolean {
  const needle = token.toLowerCase();
  return fieldNames.some((n) => tokenize(n).includes(needle));
}

function applyStructuralBoost(intent: FormIntent, signals: Signals, baseScore: number): number {
  let score = baseScore;
  const hasPassword = hasField(signals.fieldNames, 'password');
  const hasEmail = hasField(signals.fieldNames, 'email');
  const hasName = hasField(signals.fieldNames, 'name') ||
    hasField(signals.fieldNames, 'firstname') ||
    hasField(signals.fieldNames, 'lastname') ||
    hasField(signals.fieldNames, 'username');

  if (intent === 'sign-in' && hasPassword && hasEmail) score += 3;
  if (intent === 'sign-up' && hasPassword && hasEmail && hasName) score += 4;
  if (intent === 'reset-password' && hasEmail && !hasPassword) score += 2;
  if (intent === 'reset-password' && hasPassword && !hasEmail) score += 3;

  return score;
}

function classifyIntent(signals: Signals): { intent: FormIntent; confidence: number } {
  const intents: FormIntent[] = [
    'sign-in', 'sign-up', 'reset-password', 'search', 'checkout',
    'contact', 'subscribe', 'create', 'update',
  ];

  let best: FormIntent = 'unknown';
  let bestScore = 0;

  for (const intent of intents) {
    let score = scoreIntent(intent, signals);
    score = applyStructuralBoost(intent, signals, score);
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  if (bestScore === 0) return { intent: 'unknown', confidence: 0 };
  const confidence = Math.min(bestScore / 10, 1);
  return { intent: best, confidence };
}

function matchRouteForFile(filePath: string, routes: RouteInfo[]): RouteInfo | null {
  const direct = routes.find((r) => r.filePath === filePath);
  if (direct) return direct;
  const byDir = routes.find((r) => filePath.startsWith(r.filePath.replace(/\/[^/]+$/, '')));
  if (byDir) return byDir;
  return null;
}

function toFormField(element: ElementInfo): DomainFormField | null {
  if (!INPUT_TAGS.has(element.tag)) return null;
  const name = element.name ?? element.testId ?? element.id ?? element.ariaLabel ?? '';
  if (!name) return null;
  return {
    name,
    type: element.type ?? element.tag,
    required: false,
    ...(element.testId ? { selector: `[data-testid="${element.testId}"]` } : {}),
    ...(element.ariaLabel ? { ariaLabel: element.ariaLabel } : {}),
  };
}

function extractButtonTexts(component: ComponentInfo): string[] {
  return component.elements
    .filter((e) => e.tag === 'button' || (e.tag === 'input' && e.type === 'submit'))
    .map((e) => e.text ?? e.ariaLabel ?? e.name ?? '')
    .filter(Boolean);
}

export function extractForms(components: ComponentInfo[], routes: RouteInfo[]): DomainForm[] {
  const forms: DomainForm[] = [];

  for (const component of components) {
    const inputFields = component.elements
      .map(toFormField)
      .filter((f): f is DomainFormField => f !== null);

    if (inputFields.length === 0) continue;

    const matchedRoute = matchRouteForFile(component.filePath, routes);
    const fieldNames = inputFields.map((f) => f.name);
    const buttonTexts = extractButtonTexts(component);

    const signals: Signals = {
      fieldNames,
      buttonTexts,
      componentPath: component.filePath,
      routePath: matchedRoute?.path ?? null,
    };

    const { intent, confidence } = classifyIntent(signals);

    forms.push({
      route: matchedRoute?.path ?? component.filePath,
      filePath: component.filePath,
      fields: inputFields,
      intent,
      intentConfidence: confidence,
    });
  }

  return forms;
}
