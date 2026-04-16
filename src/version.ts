import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Single source of truth for the version string.
 * Reads from package.json at build time via the bundled constant,
 * or falls back to reading package.json at runtime.
 */
let _version = '';

export function getVersion(): string {
  if (_version) return _version;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const paths = [
      join(__dirname, '..', 'package.json'),
      join(__dirname, '..', '..', 'package.json'),
    ];

    for (const p of paths) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf-8'));
        if (pkg.version) {
          _version = pkg.version as string;
          return _version;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // fallback
  }

  _version = '0.0.0';
  return _version;
}
