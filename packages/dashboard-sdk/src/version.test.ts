import { describe, expect, it } from 'vitest';

import pkg from '../package.json';
import { SDK_VERSION } from './version';

describe('SDK_VERSION', () => {
  it('matches the package version', () => {
    expect(SDK_VERSION).toBe(pkg.version);
  });
});
