import { describe, it, expect } from 'vitest';
import {
  normalizeUrl,
  sameOrigin,
  isIgnorableRequest,
  isExpectedAuthStatus,
  isEngineInducedFailure,
  isConsoleNoise,
  PLACEHOLDER_PATTERNS,
} from '../../src/crawl/noise.js';

describe('normalizeUrl', () => {
  it('drops the fragment and trailing slash, lowercases host', () => {
    expect(normalizeUrl('http://Example.com/foo/#section')).toBe('http://example.com/foo');
    expect(normalizeUrl('http://example.com/')).toBe('http://example.com/');
    expect(normalizeUrl('http://example.com/a/b/')).toBe('http://example.com/a/b');
  });
});

describe('sameOrigin', () => {
  it('compares origins', () => {
    expect(sameOrigin('http://localhost:3000/x', 'http://localhost:3000')).toBe(true);
    expect(sameOrigin('http://localhost:3001/x', 'http://localhost:3000')).toBe(false);
    expect(sameOrigin('https://evil.com', 'http://localhost:3000')).toBe(false);
  });
});

describe('isIgnorableRequest', () => {
  it('drops favicons, analytics, HMR, sourcemaps', () => {
    expect(isIgnorableRequest('http://localhost:3000/favicon.ico')).toBe(true);
    expect(isIgnorableRequest('https://www.google-analytics.com/collect')).toBe(true);
    expect(isIgnorableRequest('http://localhost:3000/@vite/client')).toBe(true);
    expect(isIgnorableRequest('http://localhost:3000/app.js.map')).toBe(true);
    expect(isIgnorableRequest('https://fonts.googleapis.com/css')).toBe(true);
  });
  it('keeps first-party app requests', () => {
    expect(isIgnorableRequest('http://localhost:3000/api/orders')).toBe(false);
    expect(isIgnorableRequest('http://localhost:3000/dashboard')).toBe(false);
  });
});

describe('status + failure filters', () => {
  it('treats 401/403 as expected auth', () => {
    expect(isExpectedAuthStatus(401)).toBe(true);
    expect(isExpectedAuthStatus(403)).toBe(true);
    expect(isExpectedAuthStatus(404)).toBe(false);
    expect(isExpectedAuthStatus(500)).toBe(false);
  });
  it('ignores engine-induced aborts', () => {
    expect(isEngineInducedFailure('net::ERR_ABORTED')).toBe(true);
    expect(isEngineInducedFailure('Target closed')).toBe(true);
    expect(isEngineInducedFailure('net::ERR_NAME_NOT_RESOLVED')).toBe(false);
    expect(isEngineInducedFailure(undefined)).toBe(false);
  });
  it('filters dev/library console chatter', () => {
    expect(isConsoleNoise('Download the React DevTools for a better experience')).toBe(true);
    expect(isConsoleNoise('[vite] connecting...')).toBe(true);
    expect(isConsoleNoise('Uncaught ReferenceError: renderWelcomeBanner is not defined')).toBe(false);
  });
});

describe('placeholder patterns', () => {
  const match = (text: string) => PLACEHOLDER_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.id);
  it('flags lorem, test emails, TODO, placeholder names', () => {
    expect(match('Lorem ipsum dolor sit amet')).toContain('lorem');
    expect(match('contact test@test.com today')).toContain('test-email');
    expect(match('TODO: replace this')).toContain('todo');
    expect(match('Signed, John Doe')).toContain('lipsum-name');
  });
  it('does not flag normal product copy', () => {
    expect(match('Acme Shop has shipped quality goods since 2014 from Lisbon and Berlin.')).toEqual([]);
  });
});
