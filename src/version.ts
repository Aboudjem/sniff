import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Single source of truth for the version string.
 * Reads from package.json at build time via the bundled constant,
 * or falls back to reading package.json at runtime.
 */
let _version = '';
let _pkg: PackageJson | null | undefined;

export interface PackageJson {
  name?: string;
  version?: string;
  engineDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/** The package.json that ships with sniff, or null when it cannot be read. */
export function getPackageJson(): PackageJson | null {
  if (_pkg !== undefined) return _pkg;
  _pkg = null;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const paths = [
      join(__dirname, '..', 'package.json'),
      join(__dirname, '..', '..', 'package.json'),
    ];
    for (const p of paths) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf-8')) as PackageJson;
        if (pkg.version) {
          _pkg = pkg;
          break;
        }
      } catch {
        continue;
      }
    }
  } catch {
    // fallback below
  }
  return _pkg;
}

export function getVersion(): string {
  if (_version) return _version;
  _version = (getPackageJson()?.version as string | undefined) ?? '0.0.0';
  return _version;
}
