import { describe, expect, it } from 'vitest';

import { formatBytes, formatPercent, formatRelativeTime } from './format';

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5 MB'],
    [1024 ** 3 * 2.25, '2.3 GB'],
    [1024 ** 5 * 3, '3 PB'],
    [1024 ** 6, '1024 PB'],
  ])('formats %d as %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });

  it('honors the fraction digits', () => {
    expect(formatBytes(1024 ** 3 * 2.25, 2)).toBe('2.25 GB');
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'returns a placeholder for %s',
    (input) => {
      expect(formatBytes(input)).toBe('-');
    },
  );
});

describe('formatPercent', () => {
  it('keeps the value as a percentage and trims zeros', () => {
    expect(formatPercent(42.5)).toBe('42.5%');
    expect(formatPercent(50)).toBe('50%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(12.345, 2)).toBe('12.35%');
  });

  it('returns a placeholder for missing values', () => {
    expect(formatPercent(null)).toBe('-');
    expect(formatPercent(Number.NaN)).toBe('-');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-03-01T12:00:00Z');

  it.each([
    ['2026-03-01T11:59:55Z', 'now'],
    ['2026-03-01T11:59:30Z', '30 seconds ago'],
    ['2026-03-01T11:55:00Z', '5 minutes ago'],
    ['2026-03-01T09:00:00Z', '3 hours ago'],
    ['2026-02-28T12:00:00Z', 'yesterday'],
    ['2026-02-20T12:00:00Z', '9 days ago'],
    ['2026-03-01T14:00:00Z', 'in 2 hours'],
    ['2024-03-01T12:00:00Z', '2 years ago'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatRelativeTime(input, now)).toBe(expected);
  });

  it('accepts dates and timestamps', () => {
    expect(formatRelativeTime(new Date('2026-03-01T11:55:00Z'), now)).toBe('5 minutes ago');
    expect(formatRelativeTime(now.getTime() - 3600_000, now)).toBe('1 hour ago');
  });

  it('returns a placeholder for missing or invalid dates', () => {
    expect(formatRelativeTime(null)).toBe('-');
    expect(formatRelativeTime('not a date')).toBe('-');
  });
});
