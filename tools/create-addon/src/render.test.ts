import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listFiles, renderTemplate } from './render.ts';
import { scaffold } from './scaffold.ts';
import { templateRoot } from './workspace.ts';

describe('renderTemplate', () => {
  it('replaces every occurrence', () => {
    expect(renderTemplate('__A__-__A__ __B__', { A: '1', B: '2' })).toBe('1-1 2');
  });

  it('fails on an unknown placeholder', () => {
    expect(() => renderTemplate('__NOPE__', {}, 'f.ts')).toThrow(/__NOPE__ in template f.ts/);
  });
});

describe('scaffold', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const tmp = () => {
    const dir = mkdtempSync(join(tmpdir(), 'create-addon-test-'));
    dirs.push(dir);
    return dir;
  };

  it('writes a standalone addon with every placeholder filled in', () => {
    const dir = join(tmp(), 'addon');
    const { files } = scaffold({
      name: 'my-insights',
      prefix: 'ins',
      label: 'My Insights',
      port: 5180,
      dir,
      install: false,
    });
    expect(files).toEqual(
      expect.arrayContaining(['package.json', 'tsconfig.json', '.gitignore', 'README.md']),
    );
    for (const file of files)
      expect(readFileSync(join(dir, file), 'utf8')).not.toMatch(/__[A-Z]+__/);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@oakestra/dashboard-sdk']).toMatch(/^\^\d/);
    expect(pkg.devDependencies['@oakestra/tsconfig']).toBeUndefined();
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf8')).toContain(
      "name: 'my-insights', prefix: 'ins', port: 5180",
    );
  });

  it('never writes into a non-empty directory', () => {
    const dir = tmp();
    expect(() =>
      scaffold({ name: 'a', prefix: 'a', label: 'A', port: 5180, dir, install: false }),
    ).not.toThrow();
    expect(() =>
      scaffold({ name: 'a', prefix: 'a', label: 'A', port: 5180, dir, install: false }),
    ).toThrow(/not empty/);
  });

  it('refuses a directory inside the repository', () => {
    const dir = join(templateRoot, '../../../zz-should-not-exist');
    expect(() =>
      scaffold({ name: 'a', prefix: 'a', label: 'A', port: 5180, dir, install: false }),
    ).toThrow(/outside the repository/);
    expect(existsSync(dir)).toBe(false);
  });

  it('template has no files the renderer skips', () => {
    expect(listFiles(join(templateRoot, 'common'))).toContain('src/addon.css');
  });
});
