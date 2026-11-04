import { describe, expect, it } from 'vitest';

import {
  formatBytes,
  formatLegacyDate,
  formatMegabytes,
  formatPercent,
  formatRelativeTime,
  parseLegacyDate,
  plural,
} from './format';

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

describe('parseLegacyDate', () => {
  it.each([
    ['01/11/2026, 16:34', new Date(2026, 10, 1, 16, 34)],
    ['01/11/2026 20:46', new Date(2026, 10, 1, 20, 46)],
    ['31/07/2026 22:49', new Date(2026, 6, 31, 22, 49)],
    ['31/07/2026', new Date(2026, 6, 31)],
    ['2026-07-31T22:49:00Z', new Date('2026-07-31T22:49:00Z')],
  ])('parses %s', (input, expected) => {
    expect(parseLegacyDate(input)?.getTime()).toBe(expected.getTime());
  });

  it('reads day first, so dates sort by calendar and not as strings', () => {
    const july = parseLegacyDate('31/07/2026 22:49')!;
    const november = parseLegacyDate('01/11/2026 16:34')!;
    expect(july.getTime()).toBeLessThan(november.getTime());
  });

  it.each([[''], [undefined], [null], ['yesterday'], ['31/02/2026 10:00'], ['13/13/2026']])(
    'returns undefined for %s',
    (input) => {
      expect(parseLegacyDate(input)).toBeUndefined();
    },
  );
});

describe('formatMegabytes', () => {
  it('formats megabytes with binary steps', () => {
    expect(formatMegabytes(512)).toBe('512 MB');
    expect(formatMegabytes(1536)).toBe('1.5 GB');
    expect(formatMegabytes(undefined)).toBe('-');
  });
});

describe('plural', () => {
  it('picks the form by count', () => {
    expect(plural(1, 'service')).toBe('1 service');
    expect(plural(0, 'service')).toBe('0 services');
    expect(plural(2, 'policy', 'policies')).toBe('2 policies');
  });
});

describe('formatLegacyDate', () => {
  it('round-trips through parseLegacyDate', () => {
    const date = new Date(2026, 0, 5, 7, 9);
    expect(formatLegacyDate(date)).toBe('05/01/2026 07:09');
    expect(parseLegacyDate(formatLegacyDate(date))).toEqual(date);
  });
});
