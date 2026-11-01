import { describe, expect, it } from 'vitest';

import { formatIssue } from './RegisterAddonDialog';

describe('formatIssue', () => {
  it('says "is required" for a missing field instead of the zod wording', () => {
    expect(
      formatIssue({
        code: 'invalid_type',
        message: 'Invalid input: expected string, received undefined',
        path: ['services', 0, 'image'],
      }),
    ).toBe('services[0].image is required');
  });

  it('keeps other messages with their path', () => {
    expect(
      formatIssue({ code: 'custom', message: 'Not a valid semver range', path: ['ui', 'sdk'] }),
    ).toBe('ui.sdk: Not a valid semver range');
  });
});
