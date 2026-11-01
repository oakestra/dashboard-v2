import { getResponse } from 'msw';

import { createHandlers, type MockApiOptions } from './handlers.ts';

/**
 * The mock system-manager as a plain `Request -> Response` function, for serving it from a real
 * HTTP server (tools/mock-system-manager) instead of intercepting requests. Resolves to undefined
 * when no handler matches.
 */
export function createMockFetchHandler(
  options: MockApiOptions,
): (request: Request) => Promise<Response | undefined> {
  const handlers = createHandlers(options);
  return (request) => getResponse(handlers, request);
}
