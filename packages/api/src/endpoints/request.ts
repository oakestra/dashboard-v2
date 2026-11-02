import type { z } from 'zod';

import { ApiError, messageFromErrorBody } from '../errors.ts';

/** Options every read accepts, so TanStack Query can cancel requests it no longer needs. */
export interface RequestOptions {
  signal?: AbortSignal;
}

interface RawResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

export interface Call {
  method: string;
  /** Concrete path for error messages, e.g. `/user/Admin`. */
  path: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** For a request that threw before a response arrived: the service was not reached. */
export function rethrowAsNetworkError(error: unknown, call: Call, message: string): never {
  // Cancellation is not a failure; TanStack Query expects the AbortError to come through as is.
  if (isAbortError(error) || error instanceof ApiError) throw error;
  throw new ApiError(message, { kind: 'network', status: 0, ...call, cause: error });
}

/** Runs one openapi-fetch call and turns every failure into an ApiError. */
export async function send(call: Call, run: () => Promise<RawResult>): Promise<unknown> {
  let result: RawResult;
  try {
    result = await run();
  } catch (error) {
    rethrowAsNetworkError(
      error,
      call,
      'Could not reach the Oakestra API. Check your connection and try again.',
    );
  }
  const { response } = result;
  if (!response.ok) {
    throw new ApiError(messageFromErrorBody(result.error, response.status), {
      kind: 'http',
      status: response.status,
      ...call,
      body: result.error,
    });
  }
  return result.data;
}

export function parse<T extends z.ZodType>(schema: T, data: unknown, call: Call): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError('The Oakestra API returned data in an unexpected format.', {
      kind: 'invalid-response',
      status: 200,
      ...call,
      body: data,
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Request bodies are typed by our models, not by the spec: most endpoints declare no request body
 * at all, and the ones that do are sometimes wrong (login documents `organization`, the backend
 * reads `organization_name`). This hands a model-typed body to openapi-fetch.
 */
export function body<T>(value: T): never {
  return value as never;
}
