import type {
  CommandContext,
  CommandResult,
  CommandResultTone,
  CommandSource,
} from '@oakestra/dashboard-sdk';
import { z } from 'zod';

import { callable, reactComponent } from '../../../core/addons/definition';
import { isAppPath } from './context';

export const SEARCH_TIMEOUT_MS = 5_000;

/** Enough to find something by name. A broad query should not bury the other groups. */
export const MAX_RESULTS_PER_SOURCE = 20;

// Optional fields that only decorate fall back to nothing, like the hints in addon definitions: an
// addon built against a newer SDK may set a tone this shell does not know.
const resultSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional().catch(undefined),
    icon: reactComponent.optional().catch(undefined),
    tone: z
      .enum(['warning', 'destructive'] as const satisfies readonly CommandResultTone[])
      .optional()
      .catch(undefined),
    path: z.string().refine(isAppPath, 'must be an absolute path of the dashboard').optional(),
    run: callable.optional(),
  })
  .refine((result) => (result.path === undefined) !== (result.run === undefined), {
    message: 'must set either `path` or `run`',
  });

/**
 * Definitions are validated when an addon loads, results only exist now. One bad result is dropped
 * and the others stay, a source that does not return a list at all has failed.
 */
export function parseResults(sourceLabel: string, value: unknown): CommandResult[] {
  if (!Array.isArray(value)) throw new Error(`${sourceLabel}: search() did not return an array`);
  const seen = new Set<string>();
  const results: CommandResult[] = [];
  for (const candidate of value as unknown[]) {
    if (results.length === MAX_RESULTS_PER_SOURCE) break;
    const parsed = resultSchema.safeParse(candidate);
    if (!parsed.success) {
      console.warn(`[commands] ${sourceLabel}: ignoring invalid result`, parsed.error.issues);
      continue;
    }
    if (seen.has(parsed.data.id)) {
      console.warn(`[commands] ${sourceLabel}: ignoring duplicate result "${parsed.data.id}"`);
      continue;
    }
    seen.add(parsed.data.id);
    results.push(parsed.data as CommandResult);
  }
  return results;
}

/**
 * Calls `search` and settles within SEARCH_TIMEOUT_MS whatever the source does: a promise that
 * never settles would otherwise leave the palette saying "Searching" for as long as it is open.
 * A synchronous throw counts as a failure too.
 */
export async function searchSource(
  source: Pick<CommandSource, 'label' | 'search'>,
  query: string,
  context: CommandContext,
  signal: AbortSignal,
): Promise<CommandResult[]> {
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) abort();
  signal.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${source.label}: search() timed out`));
      controller.abort();
    }, SEARCH_TIMEOUT_MS);
  });
  try {
    const search = (async () => source.search(query, context, controller.signal))();
    return parseResults(source.label, await Promise.race([search, timeout]));
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
