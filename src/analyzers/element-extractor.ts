import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { parse as babelParse } from '@babel/parser';
import _traverse from '@babel/traverse';
import type { JSXAttribute, JSXOpeningElement, Node } from '@babel/types';
import type { ElementInfo, ComponentInfo } from './types.js';

// Handle CJS/ESM interop for @babel/traverse
const traverse = (
  typeof _traverse === 'function' ? _traverse : (_traverse as { default: typeof _traverse }).default
) as typeof _traverse;

const INTERACTIVE_TAGS = new Set([
  'form',
  'button',
  'a',
  'input',
  'select',
  'textarea',
]);

const ATTR_MAP: Record<string, keyof ElementInfo> = {
  'data-testid': 'testId',
  'id': 'id',
  'name': 'name',
  'aria-label': 'ariaLabel',
  'role': 'role',
  'type': 'type',
  'href': 'href',
};

/**
 * Extract interactive elements from JSX/TSX and Vue SFC files.
 * Uses @babel/parser for JSX/TSX and @vue/compiler-sfc for Vue templates.
 */
export async function extractElements(
  filePaths: string[],
  rootDir: string,
): Promise<{ elements: ElementInfo[]; components: ComponentInfo[] }> {
  const allElements: ElementInfo[] = [];
  const allComponents: ComponentInfo[] = [];

  // Process files in batches of 50
  for (let i = 0; i < filePaths.length; i += 50) {
    const batch = filePaths.slice(i, i + 50);
    const batchResults = await Promise.all(
      batch.map((filePath) => processFile(filePath, rootDir)),
    );
    for (const result of batchResults) {
      allElements.push(...result.elements);
      if (result.component) {
        allComponents.push(result.component);
      }
    }
  }

  return { elements: allElements, components: allComponents };
}

interface FileResult {
  elements: ElementInfo[];
  component: ComponentInfo | null;
}

async function processFile(
  filePath: string,
  rootDir: string,
): Promise<FileResult> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const relPath = relative(rootDir, filePath);

    if (filePath.endsWith('.vue')) {
      return processVueFile(content, relPath);
    }
    return processJSXFile(content, relPath);
  } catch {
    return { elements: [], component: null };
  }
}

function getJSXAttrValue(attr: JSXAttribute): string | undefined {
  if (!attr.value) return undefined;
  if (attr.value.type === 'StringLiteral') return attr.value.value;
  if (
    attr.value.type === 'JSXExpressionContainer' &&
    attr.value.expression.type === 'StringLiteral'
  ) {
    return attr.value.expression.value;
  }
  return undefined;
}

function getJSXTextContent(node: Node): string | undefined {
  // Look at parent's children for JSXText
  if (node.type !== 'JSXOpeningElement') return undefined;
  return undefined; // Text extraction happens in the visitor via parent
}

function extractTextFromJSXElement(
  path: { parent: Node },
): string | undefined {
  const parent = path.parent;
  if (parent.type !== 'JSXElement') return undefined;

  const texts: string[] = [];
  for (const child of parent.children) {
    if (child.type === 'JSXText') {
      const trimmed = child.value.trim();
      if (trimmed) texts.push(trimmed);
    }
  }
  return texts.length > 0 ? texts.join(' ') : undefined;
}

function processJSXFile(content: string, relPath: string): FileResult {
  try {
    const ast = babelParse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });

    const elements: ElementInfo[] = [];
    const namedExports: string[] = [];
    let defaultExportName: string | undefined;
    let hasDefaultExport = false;

    traverse(ast, {
      JSXOpeningElement(path) {
        const node = path.node as JSXOpeningElement;
        const tagName =
          node.name.type === 'JSXIdentifier' ? node.name.name : null;
        if (!tagName || !INTERACTIVE_TAGS.has(tagName)) return;

        const info: ElementInfo = {
          tag: tagName,
          filePath: relPath,
          line: node.loc?.start.line ?? 0,
        };

        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') continue;
          const attrName = attr.name.name;
          // Handle hyphenated attribute names
          const fullName =
            attr.name.type === 'JSXIdentifier' ? attr.name.name : undefined;
          if (!fullName) continue;

          const mappedKey = ATTR_MAP[fullName];
          if (mappedKey) {
            const val = getJSXAttrValue(attr);
            if (val !== undefined) {
              (info as Record<string, unknown>)[mappedKey] = val;
            }
          }
        }

        // Handle hyphenated JSX attribute names (data-testid, aria-label)
        for (const attr of node.attributes) {
          if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXNamespacedName') continue;
          // JSXNamespacedName has namespace and name
          const ns = attr.name.namespace.name;
          const name = attr.name.name.name;
          const fullName = `${ns}-${name}`;
          const mappedKey = ATTR_MAP[fullName];
          if (mappedKey) {
            const val = getJSXAttrValue(attr);
            if (val !== undefined) {
              (info as Record<string, unknown>)[mappedKey] = val;
            }
          }
        }

        // Extract text content from parent JSXElement children
        const text = extractTextFromJSXElement(path);
        if (text) info.text = text;

        elements.push(info);
      },

      ExportDefaultDeclaration(path) {
        hasDefaultExport = true;
        const decl = path.node.declaration;
        if (decl.type === 'FunctionDeclaration' && decl.id) {
          defaultExportName = decl.id.name;
        } else if (decl.type === 'Identifier') {
          defaultExportName = decl.name;
        }
      },

      ExportNamedDeclaration(path) {
        const decl = path.node.declaration;
        if (decl?.type === 'FunctionDeclaration' && decl.id) {
          namedExports.push(decl.id.name);
        } else if (
          decl?.type === 'VariableDeclaration'
        ) {
          for (const d of decl.declarations) {
            if (d.id.type === 'Identifier') {
              namedExports.push(d.id.name);
            }
          }
        }
      },
    });

    const componentName =
      defaultExportName ?? deriveComponentName(relPath);

    const component: ComponentInfo | null =
      hasDefaultExport || namedExports.length > 0
        ? {
            name: componentName,
            filePath: relPath,
            exports: namedExports,
            hasDefaultExport,
            elements,
            routes: [],
          }
        : null;

    return { elements, component };
  } catch {
    return { elements: [], component: null };
  }
}

async function processVueFile(
  content: string,
  relPath: string,
): Promise<FileResult> {
  try {
    const { parse } = await import('@vue/compiler-sfc');
    const { descriptor } = parse(content);
    const templateAst = descriptor.template?.ast;
    if (!templateAst) return { elements: [], component: null };

    const elements: ElementInfo[] = [];
    walkVueAst(templateAst, relPath, elements);

    const component: ComponentInfo = {
      name: deriveComponentName(relPath),
      filePath: relPath,
      exports: [],
      hasDefaultExport: !!descriptor.scriptSetup || !!descriptor.script,
      elements,
      routes: [],
    };

    return { elements, component: elements.length > 0 ? component : null };
  } catch {
    return { elements: [], component: null };
  }
}

function walkVueAst(
  node: unknown,
  relPath: string,
  elements: ElementInfo[],
): void {
  const n = node as Record<string, unknown>;
  // Element nodes have type 1
  if (n.type === 1 && typeof n.tag === 'string') {
    const tag = n.tag as string;
    if (INTERACTIVE_TAGS.has(tag)) {
      const info: ElementInfo = {
        tag,
        filePath: relPath,
        line: (n.loc as { start: { line: number } })?.start?.line ?? 0,
      };

      const props = n.props as Array<Record<string, unknown>> | undefined;
      if (props) {
        for (const prop of props) {
          // type 6 = attribute
          if (prop.type === 6) {
            const attrName = prop.name as string;
            const mappedKey = ATTR_MAP[attrName];
            if (mappedKey) {
              const val = (prop.value as { content?: string })?.content;
              if (val !== undefined) {
                (info as Record<string, unknown>)[mappedKey] = val;
              }
            }
          }
          // type 7 = directive (v-bind / :)
          if (prop.type === 7) {
            const arg = prop.arg as { content?: string } | undefined;
            const exp = prop.exp as {
              content?: string;
              isStatic?: boolean;
            } | undefined;
            if (arg?.content && exp?.content) {
              const mappedKey = ATTR_MAP[arg.content];
              if (mappedKey) {
                // Extract static string value: strip surrounding quotes
                const raw = exp.content;
                const match = /^['"](.+)['"]$/.exec(raw);
                if (match) {
                  (info as Record<string, unknown>)[mappedKey] = match[1];
                }
              }
            }
          }
        }
      }

      // Extract text content from children
      const children = n.children as Array<Record<string, unknown>> | undefined;
      if (children) {
        const texts: string[] = [];
        for (const child of children) {
          // type 2 = text node
          if (child.type === 2 && typeof child.content === 'string') {
            const trimmed = (child.content as string).trim();
            if (trimmed) texts.push(trimmed);
          }
        }
        if (texts.length > 0) {
          info.text = texts.join(' ');
        }
      }

      elements.push(info);
    }
  }

  // Recurse into children
  const children = (n.children as Array<Record<string, unknown>>) ?? [];
  if (Array.isArray(children)) {
    for (const child of children) {
      walkVueAst(child, relPath, elements);
    }
  }
}

function deriveComponentName(relPath: string): string {
  const base = relPath.split('/').pop() ?? relPath;
  const name = base.replace(/\.\w+$/, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
}
