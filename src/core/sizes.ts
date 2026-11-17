// The one place sniff states how big its one-time downloads are. Every
// message (CLI hints, `sniff doctor`, the MCP `needsSetup` payload, the
// sniff_install tool description) reads these numbers, and a test checks the
// README states the same figures, so they cannot drift apart again.
//
// Measured on macOS arm64 with empty caches, 2026-11-17, sniff 0.9.2 install
// (Playwright 1.59.1):
//   engine:   npm fetched 38 MiB of package tarballs and 140 MiB of registry
//             metadata; the engine folder held 194 MB (`du -sm`).
//   chromium: Playwright downloaded Chrome for Testing (165.5 MiB), the
//             Chromium headless shell (92 MiB) and FFmpeg (1 MiB); the
//             browsers folder held 535 MB.
//   firefox:  97.1 MiB download, 271 MB on disk (plus FFmpeg).
//   webkit:   75.4 MiB download, 289 MB on disk (plus FFmpeg).
// Sizes vary by platform and version, so every message says "about".

import type { BrowserProject } from "../config/schema.js";

export interface DownloadSize {
  /** What comes over the network, in MB. */
  downloadMb: number;
  /** What it fills on disk once unpacked, in MB. */
  diskMb: number;
}

/** Playwright, axe-core, Lighthouse and chrome-launcher, installed by npm. */
export const ENGINE_SIZE: DownloadSize = { downloadMb: 180, diskMb: 195 };

/** One browser build, as `sniff install <browser>` downloads it. */
export const BROWSER_SIZE: Record<BrowserProject, DownloadSize> = {
  chromium: { downloadMb: 260, diskMb: 535 },
  firefox: { downloadMb: 100, diskMb: 270 },
  webkit: { downloadMb: 75, diskMb: 290 },
};

/** Where the figures were measured, for messages that say so. */
export const SIZE_MEASURED_ON = "measured on macOS arm64, varies by platform";

/** The sum of the given parts. */
export function totalSize(parts: readonly DownloadSize[]): DownloadSize {
  return parts.reduce(
    (sum, p) => ({
      downloadMb: sum.downloadMb + p.downloadMb,
      diskMb: sum.diskMb + p.diskMb,
    }),
    { downloadMb: 0, diskMb: 0 },
  );
}

/** Size of the given browsers, plus the engine when `withEngine` is true. */
export function setupSize(
  projects: readonly BrowserProject[],
  withEngine: boolean,
): DownloadSize {
  const parts = projects.map((p) => BROWSER_SIZE[p]);
  return totalSize(withEngine ? [ENGINE_SIZE, ...parts] : parts);
}

/** "about 440 MB to download, about 730 MB on disk" */
export function describeSize(size: DownloadSize): string {
  return `about ${size.downloadMb} MB to download, about ${size.diskMb} MB on disk`;
}
