import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library does not unmount between tests on its own.
afterEach(cleanup);

// jsdom lacks what Radix components measure and scroll with.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Object.assign(Element.prototype, { scrollIntoView: () => {} });

// React Flow reads transforms through DOMMatrixReadOnly; nodes still render without layout metrics.
globalThis.DOMMatrixReadOnly ??= class {
  m22 = 1;
  constructor(transform?: string) {
    const scale = /scale\(([\d.]+)\)/.exec(transform ?? '')?.[1];
    this.m22 = scale ? Number(scale) : 1;
  }
} as unknown as typeof DOMMatrixReadOnly;
