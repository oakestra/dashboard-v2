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
