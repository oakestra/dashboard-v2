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

const LEGACY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * Parses the date strings the backend stores for users: `dd/mm/yyyy hh:mm` (with or without a
 * comma, written by the old and the new dashboard) or ISO 8601. `new Date()` would read the
 * legacy form as month-first, so it has to be matched by hand. Returns undefined for anything else.
 */
export function parseLegacyDate(value: string | null | undefined): Date | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  const legacy = LEGACY_DATE.exec(text);
  if (legacy) {
    const [day = 0, month = 0, year = 0, hour = 0, minute = 0, second = 0] = legacy
      .slice(1)
      .map((part) => Number(part ?? 0));
    const date = new Date(year, month - 1, day, hour, minute, second);
    // Date rolls 31/02 over to March; treat that as invalid input instead.
    return date.getMonth() === month - 1 && date.getDate() === day ? date : undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return undefined;
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? undefined : iso;
}

const dayFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const dayTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

/** "Nov 1, 2026" in the viewer's locale. */
export function formatDate(date: Date): string {
  return dayFormat.format(date);
}

/** "Nov 1, 2026, 4:34 PM", for tooltips next to a `formatDate` cell. */
export function formatDateTime(date: Date): string {
  return dayTimeFormat.format(date);
}

function trimTrailingZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
