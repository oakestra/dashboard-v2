import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyMapWorkerUrl, getMapWorkerUrl, setMapWorkerUrl } from './map-worker';

const KEY = Symbol.for('oakestra.ui.mapWorkerUrl');

function fakeLib(initial = '') {
  let url = initial;
  return {
    getWorkerUrl: vi.fn(() => url),
    setWorkerUrl: vi.fn((next: string) => {
      url = next;
    }),
  };
}

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[KEY];
});

describe('map worker URL', () => {
  it('is shared through a global symbol, so separately bundled copies see the same value', () => {
    setMapWorkerUrl('/assets/worker-abc.mjs');
    expect((globalThis as Record<symbol, unknown>)[KEY]).toBe('/assets/worker-abc.mjs');
    expect(getMapWorkerUrl()).toBe('/assets/worker-abc.mjs');
  });

  it('hands the registered URL to MapLibre', () => {
    setMapWorkerUrl('/assets/worker-abc.mjs');
    const lib = fakeLib();
    applyMapWorkerUrl(lib);
    expect(lib.setWorkerUrl).toHaveBeenCalledWith('/assets/worker-abc.mjs');
  });

  it('leaves a URL MapLibre already has alone', () => {
    setMapWorkerUrl('/assets/worker-abc.mjs');
    const lib = fakeLib('https://elsewhere/worker.mjs');
    applyMapWorkerUrl(lib);
    expect(lib.setWorkerUrl).not.toHaveBeenCalled();
  });

  it('fails loudly when the host never registered a URL', () => {
    expect(() => applyMapWorkerUrl(fakeLib())).toThrow(/setMapWorkerUrl/);
  });
});
