import type { SniffUserConfig } from './schema.js';

/**
 * Helper for TypeScript autocomplete in sniff.config.ts
 * Usage: export default defineConfig({ ... })
 */
export function defineConfig(config: SniffUserConfig): SniffUserConfig {
  return config;
}
