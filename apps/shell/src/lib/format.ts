const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const;

/**
 * Formats a byte count with binary steps (1 KB = 1024 B), the way the backend's memory figures
 * are meant to be read. Non-finite or negative input renders as "-".
 */
export function formatBytes(bytes: number | null | undefined, fractionDigits = 1): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '-';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${trimTrailingZeros(value.toFixed(fractionDigits))} ${BYTE_UNITS[exponent]}`;
}

/** Formats a value that is already a percentage (`42.5` becomes `42.5%`), not a 0..1 ratio. */
export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${trimTrailingZeros(value.toFixed(fractionDigits))}%`;
}

const RELATIVE_UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "5 minutes ago", "in 2 hours", "now". `now` is injectable so tests do not depend on the clock. */
export function formatRelativeTime(
  date: Date | string | number | null | undefined,
  now: Date | number = Date.now(),
): string {
  if (date === null || date === undefined) return '-';
  const time = new Date(date).getTime();
  if (Number.isNaN(time)) return '-';
  const seconds = Math.round((time - new Date(now).getTime()) / 1000);
  if (Math.abs(seconds) < 10) return 'now';
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
  }
  return relativeFormat.format(seconds, 'second');
}

function trimTrailingZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
