import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parsePreset } from '../core/config/preset';
import { coreModules, linkedAddons } from './modules';
import { applyPreset } from './preset';

// The examples are copied by operators, so a module rename or a schema change must not leave one
// of them failing at startup.
// Vitest runs with apps/shell as the working directory.
const dir = resolve(process.cwd(), 'presets');
const files = readdirSync(dir).filter((file) => file.endsWith('.json'));

describe('example presets', () => {
  it('finds the examples', () => {
    expect(files).toEqual(expect.arrayContaining(['default.json', 'minimal.json']));
  });

  it.each(files)('%s is a valid preset for the built-in modules', (file) => {
    const preset = parsePreset(JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')), file);
    expect(() => applyPreset(coreModules, linkedAddons, preset)).not.toThrow();
  });

  it('default.json enables every module and linked addon', () => {
    const preset = parsePreset(JSON.parse(readFileSync(`${dir}/default.json`, 'utf8')));
    const { modules, linked } = applyPreset(coreModules, linkedAddons, preset);
    expect(modules.map((module) => module.id)).toEqual(coreModules.map((module) => module.id));
    expect(linked).toEqual(linkedAddons);
  });
});
