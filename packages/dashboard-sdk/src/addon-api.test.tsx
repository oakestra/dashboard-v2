import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { addonApiBasePath, resolveAddonApiUrl } from './addon-api';
import { useAddonApi } from './hooks';
import { renderInHost, createTestHost, TestHostProvider } from './testing';
import type { ReactNode } from 'react';

const origin = window.location.origin;

function setup(options: Parameters<typeof createTestHost>[0] = {}) {
  const addonFetch = vi.fn((_request: Request) => Promise.resolve(new Response('ok')));
  const testHost = createTestHost({ addonFetch, ...options });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <TestHostProvider testHost={testHost}>{children}</TestHostProvider>
  );
  const { result, rerender } = renderHook(() => useAddonApi(), { wrapper });
  return { api: result.current, result, rerender, addonFetch };
}

describe('useAddonApi', () => {
  it('points at the addon-assets proxy of the calling addon', () => {
    const { api } = setup({ addon: { addonId: 'sla-gen' } });
    expect(api.baseUrl).toBe('/addon-assets/sla-gen/api');
  });

  it('resolves paths below the base URL, with or without a leading slash', async () => {
    const { api, addonFetch } = setup({ addon: { addonId: 'a' } });
    await api.fetch('/runs?limit=2');
    await api.fetch('runs');
    expect(addonFetch.mock.calls.map(([request]) => request.url)).toEqual([
      `${origin}/addon-assets/a/api/runs?limit=2`,
      `${origin}/addon-assets/a/api/runs`,
    ]);
  });

  it('passes the init through and returns the response untouched', async () => {
    const { api, addonFetch } = setup();
    const response = await api.fetch('/runs', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    const request = addonFetch.mock.calls[0]![0];
    expect(request.method).toBe('POST');
    expect(request.headers.get('Content-Type')).toBe('application/json');
    expect(response.bodyUsed).toBe(false);
  });

  it('hands streams through without reading them', async () => {
    const stream = new ReadableStream<Uint8Array>();
    const { api } = setup({ addonFetch: () => Promise.resolve(new Response(stream)) });
    const response = await api.fetch('/events');
    expect(response.body).toBe(stream);
    expect(stream.locked).toBe(false);
  });

  it('rejects URLs and escaping paths before anything is sent', async () => {
    const { api, addonFetch } = setup();
    await expect(api.fetch('https://evil.example/steal')).rejects.toThrow(/takes a path below/);
    await expect(api.fetch('../../../addons-api/x')).rejects.toThrow(/refuses/);
    expect(addonFetch).not.toHaveBeenCalled();
  });

  it('keeps a stable object while nothing changes', () => {
    const { api, result, rerender } = setup();
    rerender();
    expect(result.current).toBe(api);
  });

  it('fails with a hint when the test did not mock addonFetch', async () => {
    let api!: ReturnType<typeof useAddonApi>;
    function Probe() {
      api = useAddonApi();
      return null;
    }
    renderInHost(<Probe />);
    await expect(api.fetch('/x')).rejects.toThrow(/did not mock it/);
  });
});

describe('resolveAddonApiUrl', () => {
  const base = '/addon-assets/a/api';

  it.each([
    'https://evil.example/x',
    '//evil.example/x',
    'HTTP://evil.example/x',
    'javascript:alert(1)',
    'http://localhost.evil.example/x',
    `${origin}/addon-assets/b/api/x`,
    `${origin}/addon-assets/a/api/x`,
  ])('rejects the URL %s, naming the base', (path) => {
    expect(() => resolveAddonApiUrl(base, path, origin)).toThrow(
      'takes a path below /addon-assets/a/api/',
    );
  });

  it.each([
    '..',
    '../x',
    '../../addons-api/x',
    '/runs/../../x',
    '%2e%2e/x',
    '.%2E/x',
    '..%2fx',
    '..%5cx',
    'runs/%2e%2e%2f..%2f..%2faddons-api/x',
  ])('rejects %s, which leaves the base', (path) => {
    expect(() => resolveAddonApiUrl(base, path, origin)).toThrow(/refuses .* outside/);
  });

  it.each([
    ['', '/addon-assets/a/api/'],
    ['?limit=2', '/addon-assets/a/api/?limit=2'],
    ['#top', '/addon-assets/a/api/#top'],
    ['runs/../jobs', '/addon-assets/a/api/jobs'],
    ['./runs', '/addon-assets/a/api/runs'],
  ])('keeps %s below the base', (path, expected) => {
    const url = resolveAddonApiUrl(base, path, origin);
    expect(url.href).toBe(`${origin}${expected}`);
  });

  it.each(['\\\\evil.example\\x', '/\\evil.example/x', '@evil.example/x'])(
    'cannot be redirected to another host by %s',
    (path) => {
      const url = resolveAddonApiUrl(base, path, origin);
      expect(url.origin).toBe(origin);
      expect(url.pathname.startsWith(`${base}/`)).toBe(true);
    },
  );

  it('encodes the addon id of the base path', () => {
    expect(addonApiBasePath('a b')).toBe('/addon-assets/a%20b/api');
  });
});
