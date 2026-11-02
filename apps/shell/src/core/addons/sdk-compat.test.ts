import { describe, expect, it } from 'vitest';

import { checkSdkCompatibility } from './sdk-compat';

describe('checkSdkCompatibility', () => {
  it.each([
    ['0.1.0', '^0.1.0', true],
    ['0.1.5', '^0.1.0', true],
    ['0.2.0', '^0.1.0', false],
    ['1.4.0', '^1.0.0', true],
    ['2.0.0', '^1.0.0', false],
    ['1.0.0', '>=1.0.0 <3', true],
    ['1.1.0-rc.1', '^1.0.0', true],
    ['1.0.0', '*', true],
  ])('shell SDK %s against addon range %s -> %s', (shell, range, compatible) => {
    expect(checkSdkCompatibility(shell, range).compatible).toBe(compatible);
  });

  it('explains why an addon is incompatible', () => {
    expect(checkSdkCompatibility('0.2.0', '^0.1.0')).toEqual({
      compatible: false,
      reason: 'Addon requires dashboard SDK ^0.1.0, this dashboard provides 0.2.0',
    });
  });

  it('rejects ranges that are not semver', () => {
    expect(checkSdkCompatibility('1.0.0', 'latest')).toMatchObject({ compatible: false });
  });
});
