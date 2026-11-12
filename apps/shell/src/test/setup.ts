import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { mockAddons, mockServer, mockStore } from './msw';

// jsdom has no matchMedia; the theme store and the sidebar's mobile check need one.
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom lacks what Radix Select, Checkbox and Popover measure and capture with.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
// React Flow reads transforms through DOMMatrixReadOnly; nodes still render without it measuring.
globalThis.DOMMatrixReadOnly ??= class {
  m22 = 1;
  constructor(transform?: string) {
    const scale = /scale\(([\d.]+)\)/.exec(transform ?? '')?.[1];
    this.m22 = scale ? Number(scale) : 1;
  }
} as unknown as typeof DOMMatrixReadOnly;
Object.assign(Element.prototype, {
  scrollIntoView: () => {},
  hasPointerCapture: () => false,
  releasePointerCapture: () => {},
});

// jsdom's getContext logs "Not implemented" on every call. Pages with a map would print that for
// each test; returning null is what a browser without WebGL does, so maps show their fallback.
HTMLCanvasElement.prototype.getContext = () => null;

beforeAll(() => mockServer.listen({ onUnhandledFrame: 'error' }));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.className = '';
  mockServer.resetHandlers();
  mockStore.reset();
  mockAddons.reset();
});

afterAll(() => mockServer.close());
