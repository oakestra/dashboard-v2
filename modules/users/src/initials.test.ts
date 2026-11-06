import { describe, expect, it } from 'vitest';

import { initials } from './initials';

describe('initials', () => {
  it.each([
    ['alice', 'AL'],
    ['Ada Lovelace', 'AL'],
    ['john.doe', 'JD'],
    ['x', 'X'],
    ['', ''],
  ])('%s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});
