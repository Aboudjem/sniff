import { readFile, writeFile } from 'node:fs/promises';
import { relative } from 'node:path';
import fg from 'fast-glob';

export interface FixOptions {
  rootDir: string;
  dryRun: boolean;
  json: boolean;
}

interface FixResult {
  filePath: string;
  line: number;
  rule: string;
  removed: string;
}

// Patterns that are safe to auto-remove (entire line)
const FIXABLE_RULES: Array<{
  id: string;
  pattern: RegExp;
  label: string;
}> = [
  {
    id: 'debug-debugger',
    pattern: /^\s*debugger\s*;?\s*$/,
    label: 'debugger statement',
  },
  {
    id: 'debug-console-log',
    pattern: /^\s*console\.(log|debug|info)\s*\(.*\)\s*;?\s*$/,
    label: 'console.log/debug/info',
  },
];

export async function fixCommand(options: FixOptions): Promise<void> {
  const pc = (await import('picocolors')).default;

  if (!options.json) {
    console.log(`\n${pc.bold('sniff')} v0.2.1 --fix\n`);
  }

  const files = await fg(['**/*.{ts,tsx,js,jsx}'], {
    cwd: options.rootDir,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**',
      '**/.next/**', '**/.nuxt/**', '**/.svelte-kit/**',
      '**/*.test.*', '**/*.spec.*', '**/*.config.*',
    ],
    absolute: true,
  });

  const fixes: FixResult[] = [];
  const fileChanges = new Map<string, { original: string; fixed: string }>();

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(options.rootDir, filePath);
    let changed = false;
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let removed = false;

      for (const rule of FIXABLE_RULES) {
        if (rule.pattern.test(line)) {
          fixes.push({
            filePath: relPath,
            line: i + 1,
            rule: rule.id,
            removed: line.trim(),
          });
          removed = true;
          changed = true;
          break;
        }
      }

      if (!removed) {
        newLines.push(line);
      }
    }

    if (changed) {
      fileChanges.set(filePath, { original: content, fixed: newLines.join('\n') });
    }
  }

  if (fixes.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ fixes: [], filesChanged: 0 }));
    } else {
      console.log(`${pc.green('No auto-fixable issues found.')} Your code is clean.\n`);
    }
    return;
  }

  if (options.json) {
    console.log(JSON.stringify({
      dryRun: options.dryRun,
      fixes,
      filesChanged: fileChanges.size,
    }, null, 2));
    return;
  }

  // Show what will be / was fixed
  const verb = options.dryRun ? 'Would remove' : 'Removed';

  for (const fix of fixes) {
    const severity = fix.rule === 'debug-debugger' ? pc.red('HIGH') : pc.yellow('MED');
    console.log(`  ${severity}  ${pc.dim(fix.filePath)}:${fix.line}  ${verb}: ${pc.strikethrough(fix.removed)}`);
  }

  console.log('');

  if (options.dryRun) {
    console.log(`${pc.yellow('Dry run:')} ${fixes.length} issue${fixes.length !== 1 ? 's' : ''} in ${fileChanges.size} file${fileChanges.size !== 1 ? 's' : ''} would be fixed.`);
    console.log(`${pc.dim('Run without --check to apply fixes.')}\n`);
    return;
  }

  // Apply fixes
  for (const [filePath, { fixed }] of fileChanges) {
    await writeFile(filePath, fixed, 'utf-8');
  }

  console.log(`${pc.green('Fixed:')} ${fixes.length} issue${fixes.length !== 1 ? 's' : ''} in ${fileChanges.size} file${fileChanges.size !== 1 ? 's' : ''}.\n`);
}
