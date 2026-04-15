import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractElements } from '../../src/analyzers/element-extractor.js';

describe('extractElements', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'sniff-elem-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('finds button with data-testid and text content', async () => {
    const file = join(tmpDir, 'Button.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return <button data-testid="submit-btn">Submit</button>;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([
      expect.objectContaining({
        tag: 'button',
        testId: 'submit-btn',
        text: 'Submit',
      }),
    ]);
  });

  it('finds input with type, name, and id', async () => {
    const file = join(tmpDir, 'Input.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return <input type="email" name="email" id="email-input" />;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([
      expect.objectContaining({
        tag: 'input',
        type: 'email',
        name: 'email',
        id: 'email-input',
      }),
    ]);
  });

  it('finds anchor with href, aria-label, and text content', async () => {
    const file = join(tmpDir, 'Link.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return <a href="/about" aria-label="About page">About</a>;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([
      expect.objectContaining({
        tag: 'a',
        href: '/about',
        ariaLabel: 'About page',
        text: 'About',
      }),
    ]);
  });

  it('finds form with role attribute', async () => {
    const file = join(tmpDir, 'Form.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return <form role="search"><input name="q" /></form>;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    const form = elements.find((e) => e.tag === 'form');
    expect(form).toEqual(
      expect.objectContaining({
        tag: 'form',
        role: 'search',
      }),
    );
  });

  it('finds select and textarea elements', async () => {
    const file = join(tmpDir, 'Fields.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return (
    <div>
      <select name="country"><option>US</option></select>
      <textarea name="bio"></textarea>
    </div>
  );
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    const tags = elements.map((e) => e.tag);
    expect(tags).toContain('select');
    expect(tags).toContain('textarea');
    expect(elements.find((e) => e.tag === 'select')?.name).toBe('country');
    expect(elements.find((e) => e.tag === 'textarea')?.name).toBe('bio');
  });

  it('ignores non-interactive elements like div, span, p', async () => {
    const file = join(tmpDir, 'Static.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return <div><span>Hello</span><p>World</p></div>;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([]);
  });

  it('returns correct line numbers for each element', async () => {
    const file = join(tmpDir, 'Lines.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return (
    <div>
      <button>One</button>
      <input name="two" />
    </div>
  );
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    const button = elements.find((e) => e.tag === 'button');
    const input = elements.find((e) => e.tag === 'input');
    expect(button?.line).toBe(4);
    expect(input?.line).toBe(5);
  });

  it('handles TSX files with TypeScript syntax (generics, type annotations)', async () => {
    const file = join(tmpDir, 'Generic.tsx');
    await writeFile(
      file,
      `import { useState } from 'react';

interface Props {
  label: string;
}

export default function Page({ label }: Props) {
  const [val, setVal] = useState<string>('');
  return <button data-testid="ts-btn">{label}</button>;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([
      expect.objectContaining({
        tag: 'button',
        testId: 'ts-btn',
      }),
    ]);
  });

  it('returns empty array for files with no interactive elements', async () => {
    const file = join(tmpDir, 'Empty.tsx');
    await writeFile(
      file,
      `export default function Page() {
  return <div>No interactive elements here</div>;
}`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([]);
  });

  it('handles parse errors gracefully (returns empty array, does not throw)', async () => {
    const file = join(tmpDir, 'Bad.tsx');
    await writeFile(file, `this is not valid {{{ typescript jsx`);

    const { elements } = await extractElements([file], tmpDir);

    expect(elements).toEqual([]);
  });

  it('parses Vue .vue SFC template and extracts interactive elements with attributes', async () => {
    const file = join(tmpDir, 'Page.vue');
    await writeFile(
      file,
      `<template>
  <div>
    <button data-testid="vue-btn">Click</button>
    <input type="text" name="username" id="user-input" />
    <a href="/home" aria-label="Home link">Home</a>
    <form role="form">
      <select name="lang"><option>EN</option></select>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>`,
    );

    const { elements } = await extractElements([file], tmpDir);

    expect(elements.length).toBeGreaterThanOrEqual(5);

    const button = elements.find((e) => e.tag === 'button');
    expect(button).toEqual(
      expect.objectContaining({
        tag: 'button',
        testId: 'vue-btn',
        text: 'Click',
      }),
    );

    const input = elements.find((e) => e.tag === 'input');
    expect(input).toEqual(
      expect.objectContaining({
        tag: 'input',
        type: 'text',
        name: 'username',
        id: 'user-input',
      }),
    );

    const link = elements.find((e) => e.tag === 'a');
    expect(link).toEqual(
      expect.objectContaining({
        tag: 'a',
        href: '/home',
        ariaLabel: 'Home link',
        text: 'Home',
      }),
    );
  });

  it('handles Vue template with v-bind shorthand :href and extracts static string values', async () => {
    const file = join(tmpDir, 'VueBind.vue');
    await writeFile(
      file,
      `<template>
  <a :href="'/about'">About</a>
</template>`,
    );

    const { elements } = await extractElements([file], tmpDir);

    const link = elements.find((e) => e.tag === 'a');
    expect(link).toEqual(
      expect.objectContaining({
        tag: 'a',
        href: '/about',
        text: 'About',
      }),
    );
  });

  it('builds ComponentInfo with exports and elements', async () => {
    const file = join(tmpDir, 'MyComponent.tsx');
    await writeFile(
      file,
      `export function helper() {}

export default function MyComponent() {
  return <button data-testid="comp-btn">Click</button>;
}`,
    );

    const { components } = await extractElements([file], tmpDir);

    expect(components.length).toBe(1);
    expect(components[0]).toEqual(
      expect.objectContaining({
        name: 'MyComponent',
        hasDefaultExport: true,
        elements: [
          expect.objectContaining({
            tag: 'button',
            testId: 'comp-btn',
          }),
        ],
      }),
    );
    expect(components[0].exports).toContain('helper');
  });
});
