import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// The translated READMEs must not drift from the English one.
// Code blocks and pictures stay verbatim; the heading structure stays the same.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LANGS = ["fr", "es", "ja", "zh-CN"];
const read = (f: string) => readFileSync(join(ROOT, f), "utf8");

const FENCE = /^```[^\n]*\n[\s\S]*?^```$/gm;
const codeBlocks = (md: string) => md.match(FENCE) ?? [];
const headingLevels = (md: string) =>
  md
    .replace(FENCE, "")
    .split("\n")
    .filter((l) => /^#{1,6} /.test(l))
    .map((l) => l.match(/^#+/)![0].length);
const pictures = (md: string) =>
  md.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];
const images = (md: string) =>
  (md.match(/<img [^>]*src="https:[^"]+"/g) ?? []).map(
    (t) => t.match(/src="([^"]+)"/)![1],
  );

describe("translated READMEs", () => {
  const en = read("README.md");

  it("the English README has code blocks and headings to compare", () => {
    expect(codeBlocks(en).length).toBeGreaterThan(5);
    expect(headingLevels(en).length).toBeGreaterThan(5);
  });

  for (const lang of LANGS) {
    const file = `READMEs/${lang}.md`;
    const md = read(file);

    it(`${file} keeps every fenced code block of the English README verbatim and in order`, () => {
      expect(codeBlocks(md)).toEqual(codeBlocks(en));
    });

    it(`${file} has the same heading levels in the same order`, () => {
      expect(headingLevels(md)).toEqual(headingLevels(en));
    });

    it(`${file} keeps the picture tags and image URLs`, () => {
      expect(pictures(md)).toEqual(pictures(en));
      expect(images(md)).toEqual(images(en));
    });

    it(`${file} has no stars badge and no em dash`, () => {
      expect(md).not.toMatch(/stargazers|github\/stars/);
      expect(md.includes(String.fromCharCode(0x2014))).toBe(false);
      expect(md).not.toMatch(/&mdash;|&#8212;/);
    });

    it(`${file} ends with the machine-assisted translation note`, () => {
      const last = md.trimEnd().split("\n").pop() ?? "";
      expect(last).toMatch(
        /<sub>.*<a href="\.\.\/README\.md">README\.md<\/a>.*<\/sub>/,
      );
    });
  }
});
