import { z } from 'zod';

/**
 * A number the backend may also send as a string. Instance metrics arrive as `"6336512.000000"`,
 * cluster metrics as real numbers; callers should only ever see numbers.
 */
export const numeric = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const parsed = typeof value === 'number' ? value : value.trim() === '' ? NaN : Number(value);
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: 'custom', message: `"${String(value)}" is not a number`, input: value });
    return z.NEVER;
  }
  return parsed;
});

/**
 * An optional metric. A malformed value becomes `undefined` instead of failing the whole response:
 * one odd field in a monitoring payload is not a reason to hide the service it belongs to.
 */
export const optionalNumber = numeric.optional().catch(undefined);

/** Epoch seconds below this are seconds, above it milliseconds (it is the year 33658 in seconds). */
const MILLISECONDS_THRESHOLD = 1e12;

function fromEpoch(value: number): Date {
  return new Date(value < MILLISECONDS_THRESHOLD ? value * 1000 : value);
}

/**
 * Cluster history uses epoch seconds (`1790583581.45`), instance history ISO strings
 * (`"2026-11-01T15:34:12.046672+00:00"`). Both become Dates.
 */
export const timestamp = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const date =
    typeof value === 'number'
      ? fromEpoch(value)
      : /^\d+(\.\d+)?$/.test(value.trim())
        ? fromEpoch(Number(value))
        : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({
      code: 'custom',
      message: `"${String(value)}" is not a timestamp`,
      input: value,
    });
    return z.NEVER;
  }
  return date;
});

export const historyPointSchema = z.looseObject({ timestamp, value: numeric });
export type HistoryPoint = z.infer<typeof historyPointSchema>;

/**
 * Parses each item on its own and drops the ones that do not match, so one malformed entry cannot
 * hide all the others. Dropped items are reported once per parse so they do not go unnoticed.
 */
export function lenientArray<T extends z.ZodType>(item: T, label: string) {
  return z.array(z.unknown()).transform((items) => {
    const parsed: z.output<T>[] = [];
    let dropped = 0;
    for (const candidate of items) {
      const result = item.safeParse(candidate);
      if (result.success) parsed.push(result.data);
      else dropped += 1;
    }
    if (dropped > 0) console.warn(`[@oakestra/api] ignored ${dropped} malformed ${label}`);
    return parsed;
  });
}

/** Metric history; unparseable points are dropped rather than failing the whole entity. */
export const historySchema = lenientArray(historyPointSchema, 'history points')
  .optional()
  .transform((points) => points ?? []);

/** Missing, null and empty lists all mean "nothing here". */
export function list<T extends z.ZodType>(item: T) {
  return z
    .array(item)
    .nullish()
    .transform((items): z.output<T>[] => items ?? []);
}

/** The backend sometimes sends `null` for strings it has no value for. */
export const optionalString = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);
