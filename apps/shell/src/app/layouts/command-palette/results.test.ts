import type { CommandContext } from '@oakestra/dashboard-sdk';
import { createCommandContext } from '@oakestra/dashboard-sdk/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { commandContextFor, isAppPath, type CommandHost } from './context';
import { MAX_RESULTS_PER_SOURCE, parseResults, searchSource, SEARCH_TIMEOUT_MS } from './results';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('isAppPath', () => {
  it.each(['/', '/applications', '/addons/x/a%20b?y=1#z'])('accepts %s', (path) => {
    expect(isAppPath(path)).toBe(true);
  });

  it.each([
    '',
    'applications',
    './x',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'https://evil.example/',
    'javascript:alert(1)',
  ])('rejects %j', (path) => {
    expect(isAppPath(path)).toBe(false);
  });
});

describe('parseResults', () => {
  const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

  it('keeps valid results and what they carry', () => {
    const run = () => undefined;
    const results = parseResults('Jobs', [
      { id: '1', label: 'One', path: '/jobs/1', description: 'First', tone: 'warning' },
      { id: '2', label: 'Two', run },
    ]);
    expect(results).toEqual([
      { id: '1', label: 'One', path: '/jobs/1', description: 'First', tone: 'warning' },
      { id: '2', label: 'Two', run },
    ]);
  });

  it('fails when the source did not return a list', () => {
    expect(() => parseResults('Jobs', { results: [] })).toThrow(/did not return an array/);
  });

  it.each([
    ['no id', { label: 'A', path: '/a' }],
    ['no label', { id: 'a', path: '/a' }],
    ['neither path nor run', { id: 'a', label: 'A' }],
    ['both path and run', { id: 'a', label: 'A', path: '/a', run: () => undefined }],
    ['a relative path', { id: 'a', label: 'A', path: 'a' }],
    ['another origin', { id: 'a', label: 'A', path: '//evil.example/a' }],
    ['not even an object', 'a'],
  ])('drops a result with %s and keeps the others', (_name, bad) => {
    const warn = quiet();
    const results = parseResults('Jobs', [bad, { id: 'ok', label: 'OK', path: '/ok' }]);
    expect(results.map((result) => result.id)).toEqual(['ok']);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('drops repeated ids, which would be one row to the palette', () => {
    quiet();
    const result = { id: 'a', label: 'A', path: '/a' };
    expect(parseResults('Jobs', [result, result])).toHaveLength(1);
  });

  it('keeps a result whose decoration it does not understand', () => {
    const [result] = parseResults('Jobs', [
      { id: 'a', label: 'A', path: '/a', tone: 'sparkly', icon: 'x', description: 3 },
    ]);
    expect(result).toEqual({ id: 'a', label: 'A', path: '/a' });
  });

  it('limits what one source can add', () => {
    const many = Array.from({ length: 50 }, (_, id) => ({ id: `${id}`, label: 'A', path: '/a' }));
    expect(parseResults('Jobs', many)).toHaveLength(MAX_RESULTS_PER_SOURCE);
  });
});

describe('searchSource', () => {
  const ctx: CommandContext = createCommandContext();
  const signal = () => new AbortController().signal;

  it('passes the query and the context on and validates the answer', async () => {
    const search = vi.fn(() => Promise.resolve([{ id: 'a', label: 'A', path: '/a' }]));
    await expect(searchSource({ label: 'Jobs', search }, 'ab', ctx, signal())).resolves.toEqual([
      { id: 'a', label: 'A', path: '/a' },
    ]);
    expect(search).toHaveBeenCalledWith('ab', ctx, expect.any(AbortSignal));
  });

  it('turns a synchronous throw into a rejection', async () => {
    const search = () => {
      throw new Error('boom');
    };
    await expect(searchSource({ label: 'Jobs', search }, 'ab', ctx, signal())).rejects.toThrow(
      'boom',
    );
  });

  it('gives up on a source that never settles and aborts it', async () => {
    vi.useFakeTimers();
    let seen: AbortSignal | undefined;
    const search = (_query: string, _ctx: CommandContext, inner: AbortSignal) => {
      seen = inner;
      return new Promise<never>(() => {});
    };
    const result = searchSource({ label: 'Jobs', search }, 'ab', ctx, signal());
    const assertion = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(SEARCH_TIMEOUT_MS);
    await assertion;
    expect(seen?.aborted).toBe(true);
  });

  it('forwards the abort of the query', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const search = (_query: string, _ctx: CommandContext, inner: AbortSignal) => {
      seen = inner;
      return Promise.resolve([]);
    };
    await searchSource({ label: 'Jobs', search }, 'ab', ctx, controller.signal);
    expect(seen?.aborted).toBe(false);

    const pending = searchSource(
      {
        label: 'Jobs',
        search: (_query, _ctx, inner) =>
          new Promise((_resolve, reject) => {
            inner.addEventListener('abort', () => reject(new Error('aborted')));
          }),
      },
      'ab',
      ctx,
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
  });
});

describe('commandContextFor', () => {
  const navigate = vi.fn();
  const { api, notify, isFeatureEnabled, user, queryClient } = createCommandContext();
  const host: CommandHost = {
    host: { api, notify, isFeatureEnabled },
    user,
    queryClient,
    navigate,
  };

  it('has no addon for a core module', () => {
    const context = commandContextFor(host, { kind: 'core', id: 'x', label: 'X' });
    expect(context.addon).toBeUndefined();
  });

  it('builds paths below the mount of the addon', () => {
    const context = commandContextFor(host, {
      kind: 'addon',
      id: 'fleet',
      label: 'Fleet',
      addon: { addonId: 'fleet', version: '1.0.0', basePath: '/fleet' },
    });
    expect(context.addon?.path('a/b', 1)).toBe('/fleet/a%2Fb/1');
  });

  it('refuses to navigate anywhere but to a page of the dashboard', () => {
    const context = commandContextFor(host, { kind: 'core', id: 'x', label: 'X' });
    expect(() => context.navigate('jobs')).toThrow(/absolute/);
    expect(() => context.navigate('//evil.example')).toThrow(/absolute/);
    expect(navigate).not.toHaveBeenCalled();
    context.navigate('/jobs');
    expect(navigate).toHaveBeenCalledWith('/jobs');
  });
});
