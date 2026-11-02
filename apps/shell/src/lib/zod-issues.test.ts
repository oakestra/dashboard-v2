import { describe, expect, it } from 'vitest';

import { formatIssue, formatIssuePath } from './zod-issues';

describe('formatIssuePath', () => {
  it('writes array indices in brackets', () => {
    expect(formatIssuePath(['services', 0, 'image'])).toBe('services[0].image');
    expect(formatIssuePath([])).toBe('');
  });
});

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

  it('names the subject when the whole document is missing', () => {
    const issue = {
      code: 'invalid_type',
      message: 'Invalid input: expected object, received undefined',
      path: [],
    };
    expect(formatIssue(issue, 'The definition')).toBe('The definition is required');
    expect(formatIssue(issue)).toBe('The value is required');
  });

  it('keeps other messages with their path', () => {
    expect(
      formatIssue(
        { code: 'custom', message: 'Not a valid semver range', path: ['ui', 'sdk'] },
        'The definition',
      ),
    ).toBe('ui.sdk: Not a valid semver range');
  });
});
