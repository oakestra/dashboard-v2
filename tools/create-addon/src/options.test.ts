import { describe, expect, it } from 'vitest';

import {
  defaultPrefix,
  nextFreePort,
  parseCliArgs,
  resolveOptions,
  titleCase,
  UsageError,
  type WorkspaceState,
} from './options.ts';

const state: WorkspaceState = { addonNames: ['example'], prefixes: ['ex'], ports: [5174] };
const resolve = (dir: string) => `/abs/${dir}`;
const options = (argv: string[], workspace = state) =>
  resolveOptions(parseCliArgs(argv), workspace, resolve);

describe('parseCliArgs', () => {
  it('reads the name and flags', () => {
    expect(
      parseCliArgs(['insights', '--prefix', 'ins', '--port', '5180', '--no-install']),
    ).toMatchObject({ name: 'insights', prefix: 'ins', port: '5180', install: false });
  });

  it('rejects unknown flags and extra names', () => {
    expect(() => parseCliArgs(['a', '--bogus'])).toThrow(UsageError);
    expect(() => parseCliArgs(['a', 'b'])).toThrow(/one addon name/);
  });
});

describe('resolveOptions defaults', () => {
  it('derives prefix, label and the next free port', () => {
    expect(options(['my-insights'])).toMatchObject({
      name: 'my-insights',
      prefix: 'myinsights',
      label: 'My Insights',
      port: 5175,
      dir: undefined,
    });
  });

  it('resolves --dir', () => {
    expect(options(['x', '--dir', 'out']).dir).toBe('/abs/out');
  });

  it('helpers', () => {
    expect(titleCase('a-b2')).toBe('A B2');
    expect(defaultPrefix('a1-b')).toBe('ab');
    expect(nextFreePort([])).toBe(5174);
    expect(nextFreePort([5174, 5190])).toBe(5191);
  });
});

describe('resolveOptions validation', () => {
  it.each(['', 'Upper', 'under_score', 'sp ace', '../x'])('rejects the name %j', (name) => {
    expect(() => options(name ? [name] : [])).toThrow(UsageError);
  });

  it('rejects an existing addon', () => {
    expect(() => options(['example'])).toThrow(/already exists/);
  });

  it('rejects bad prefixes and collisions', () => {
    expect(() => options(['a', '--prefix', 'A1'])).toThrow(/Invalid prefix/);
    expect(() => options(['a', '--prefix', 'ex'])).toThrow(/already used/);
    expect(() => options(['ex'], { ...state, addonNames: [] })).toThrow(/already used/);
    expect(() => options(['123'])).toThrow(/--prefix/);
  });

  it('rejects bad or taken ports', () => {
    expect(() => options(['a', '--port', 'abc'])).toThrow(/Invalid port/);
    expect(() => options(['a', '--port', '80'])).toThrow(/Invalid port/);
    expect(() => options(['a', '--port', '5173'])).toThrow(/shell/);
    expect(() => options(['a', '--port', '5174'])).toThrow(/already used/);
  });

  it('rejects labels that would break the generated files', () => {
    expect(() => options(['a', '--label', "it's"])).toThrow(/not allowed/);
    expect(() => options(['a', '--label', '<b>'])).toThrow(/not allowed/);
    expect(() => options(['a', '--label', 'x'.repeat(41)])).toThrow(/longer/);
  });
});
