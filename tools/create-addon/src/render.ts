import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PLACEHOLDER = /__[A-Z][A-Z_]*__/g;

/** Replaces `__KEY__` with `values[KEY]`. An unknown placeholder is a template bug, not input. */
export function renderTemplate(source: string, values: Record<string, string>, file = ''): string {
  return source.replace(PLACEHOLDER, (match) => {
    const value = values[match.slice(2, -2)];
    if (value === undefined) throw new Error(`Unknown placeholder ${match} in template ${file}`);
    return value;
  });
}

/** Files below `dir`, as paths relative to it, in a stable order. */
export function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(join(dir, prefix))
    .sort()
    .flatMap((entry) => {
      const relative = prefix ? `${prefix}/${entry}` : entry;
      return statSync(join(dir, relative)).isDirectory() ? listFiles(dir, relative) : [relative];
    });
}

/**
 * Renders every file of the template directories into `target`, later directories overriding
 * earlier ones. Returns the written paths, relative to `target`. Files named in `rename` are
 * written under another name (npm and git treat `.gitignore` specially, so the template keeps it
 * as `gitignore`).
 */
export function renderTree(
  templateDirs: string[],
  target: string,
  values: Record<string, string>,
  rename: Record<string, string> = {},
): string[] {
  const files = new Map<string, string>();
  for (const dir of templateDirs) {
    for (const file of listFiles(dir)) files.set(file, join(dir, file));
  }
  const written: string[] = [];
  for (const [file, source] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    const outFile = rename[file] ?? file;
    const out = join(target, outFile);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderTemplate(readFileSync(source, 'utf8'), values, file));
    written.push(outFile);
  }
  return written;
}
