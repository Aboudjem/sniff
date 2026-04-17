const FRONTMATTER_OPEN = '---json';
const FRONTMATTER_CLOSE = '---';

export interface FrontmatterResult<T> {
  data: T | null;
  body: string;
  error?: string;
}

export function parseJsonFrontmatter<T>(content: string): FrontmatterResult<T> {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith(FRONTMATTER_OPEN)) {
    return { data: null, body: normalized, error: 'missing ---json opening marker' };
  }

  const afterOpen = normalized.slice(FRONTMATTER_OPEN.length);
  if (!afterOpen.startsWith('\n')) {
    return { data: null, body: normalized, error: 'expected newline after ---json' };
  }

  const rest = afterOpen.slice(1);
  const closeMatch = rest.match(/\n---(?=\n|$)/);
  if (!closeMatch || closeMatch.index === undefined) {
    return { data: null, body: normalized, error: 'missing --- closing marker' };
  }

  const jsonPart = rest.slice(0, closeMatch.index);
  const bodyStart = closeMatch.index + closeMatch[0].length;
  const body = rest.slice(bodyStart).replace(/^\n/, '');

  try {
    const data = JSON.parse(jsonPart) as T;
    return { data, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, body, error: `invalid JSON: ${message}` };
  }
}

export function serializeJsonFrontmatter<T>(data: T, body: string = ''): string {
  const json = JSON.stringify(data, null, 2);
  const trailing = body ? `\n${body.replace(/^\n+/, '')}` : '';
  return `${FRONTMATTER_OPEN}\n${json}\n${FRONTMATTER_CLOSE}\n${trailing}`;
}
