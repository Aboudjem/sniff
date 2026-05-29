// Noise filtering — the single biggest lever on trust. The old engine flagged
// every console.error and every HTTP>=400 (favicons, analytics, expected auth)
// as high/critical, which is the #1 reason QA tools get abandoned. These
// helpers keep first-party, user-visible signal and drop the rest.

/** Normalize a URL for de-dupe: drop fragment, trailing slash, lowercase host. */
export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    let s = u.toString();
    // strip a single trailing slash on the path (but keep root "/")
    s = s.replace(/\/(?=$|\?)/, (m, off) => (u.pathname === '/' ? m : ''));
    return s.replace(/\/$/, (m) => (u.pathname === '/' ? m : ''));
  } catch {
    return raw;
  }
}

export function sameOrigin(url: string, baseOrigin: string): boolean {
  try {
    return new URL(url).origin === baseOrigin;
  } catch {
    return false;
  }
}

/** Third-party hosts whose requests are never the app's own bug. */
const THIRD_PARTY_HOST = /(google-analytics|googletagmanager|doubleclick|google\.com\/(ads|pagead)|segment\.(io|com)|sentry\.io|hotjar|posthog|datadoghq|mixpanel|amplitude|fullstory|intercom|facebook\.(com|net)|connect\.facebook|fonts\.(googleapis|gstatic)|gstatic\.com|cloudflareinsights|newrelic|nr-data|bugsnag|launchdarkly|stripe\.com\/v\d)/i;

/** Paths that are framework/dev-server plumbing, not the user's app. */
const PLUMBING_PATH = /(\/favicon\.ico|\.map(\?|$)|\/robots\.txt|\/sitemap\.xml|\/_next\/static\/.*\.js\.map|\/__nextjs|\/_next\/webpack-hmr|\/@vite\/|\/__vite_ping|\/@react-refresh|\/sockjs-node|\/_nuxt\/|\/__webpack_hmr|hot-update\.json|\/\.well-known\/)/i;

/** Static asset extensions we don't treat as broken "pages" or "links". */
export const ASSET_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|woff2?|ttf|eot|map|json|webmanifest|mp4|webm|wasm)(\?|$)/i;

/** Is this request URL irrelevant to "did the app break" (so 4xx/5xx is noise)? */
export function isIgnorableRequest(url: string): boolean {
  return THIRD_PARTY_HOST.test(url) || PLUMBING_PATH.test(url);
}

/** Expected/authentication statuses we downgrade rather than flag as failures. */
export function isExpectedAuthStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/** Failures caused by the engine itself (aborted navigations, our own cancels). */
export function isEngineInducedFailure(errorText: string | undefined): boolean {
  if (!errorText) return false;
  return /ERR_ABORTED|net::ERR_BLOCKED_BY_CLIENT|context (or browser )?(was )?closed|Target closed|frame was detached/i.test(
    errorText,
  );
}

/** Console lines that are dev/library chatter, never the app's own defect. */
const CONSOLE_NOISE = /(Download the React DevTools|\[vite\]|\[HMR\]|\[webpack|Lighthouse|DevTools failed to load|source ?map|React Router Future Flag|was preloaded using link preload but not used|Slow network is detected|Tracking Prevention|net::ERR_|favicon|Failed to load resource)/i;

export function isConsoleNoise(text: string): boolean {
  return CONSOLE_NOISE.test(text);
}

/** Visible-text placeholder/mock tokens that should never ship to production. */
export const PLACEHOLDER_PATTERNS: Array<{ id: string; re: RegExp; label: string }> = [
  { id: 'lorem', re: /\blorem ipsum\b/i, label: 'Lorem ipsum placeholder text' },
  { id: 'todo', re: /\b(TODO|FIXME|TBD|XXX)\b[:\s]/, label: 'TODO/FIXME placeholder note' },
  { id: 'test-email', re: /\b(test@test\.com|test@example\.com|user@example\.com|admin@admin\.com|foo@bar\.com)\b/i, label: 'Test/placeholder email address' },
  { id: 'example-email', re: /\b[a-z0-9._%+-]+@example\.(com|org|net)\b/i, label: 'example.com placeholder email' },
  { id: 'placeholder-phone', re: /\b(123[-.\s]?456[-.\s]?7890|555[-.\s]?555[-.\s]?5555|000[-.\s]?000[-.\s]?0000)\b/, label: 'Placeholder phone number' },
  { id: 'lipsum-name', re: /\b(John Doe|Jane Doe|Lorem Ipsum)\b/, label: 'Placeholder name' },
  { id: 'dummy', re: /\b(dummy (text|data|content)|placeholder (text|content)|your text here|insert .* here)\b/i, label: 'Dummy/placeholder content' },
];
