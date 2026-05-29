import { describe, it, expect } from 'vitest';
import { isCrawlable } from '../../src/crawl/crawler.js';

const ORIGIN = 'http://localhost:3000';

describe('isCrawlable', () => {
  it('crawls same-origin HTML routes', () => {
    expect(isCrawlable('http://localhost:3000/', ORIGIN)).toBe(true);
    expect(isCrawlable('http://localhost:3000/dashboard', ORIGIN)).toBe(true);
    expect(isCrawlable('http://localhost:3000/orders/123', ORIGIN)).toBe(true);
  });
  it('skips cross-origin URLs', () => {
    expect(isCrawlable('https://example.com/page', ORIGIN)).toBe(false);
  });
  it('skips static assets', () => {
    expect(isCrawlable('http://localhost:3000/styles.css', ORIGIN)).toBe(false);
    expect(isCrawlable('http://localhost:3000/logo.png', ORIGIN)).toBe(false);
    expect(isCrawlable('http://localhost:3000/app.js', ORIGIN)).toBe(false);
  });
  it('skips API endpoints (not pages)', () => {
    expect(isCrawlable('http://localhost:3000/api/orders', ORIGIN)).toBe(false);
  });
});
