import { getResponse, type HttpHandler } from 'msw';

import { createAddonsHandlers, type AddonsHandlersOptions } from './addons-handlers.ts';
import { createHandlers, type MockApiOptions } from './handlers.ts';

type FetchHandler = (request: Request) => Promise<Response | undefined>;

/**
 * The MSW handlers as a plain `Request -> Response` function, for serving them from a real HTTP
 * server (the tools/mock-* servers) instead of intercepting requests. Resolves to undefined when
 * no handler matches.
 */
function toFetchHandler(handlers: HttpHandler[]): FetchHandler {
  return (request) => getResponse(handlers, request);
}

/** The mock system-manager, see `toFetchHandler`. */
export function createMockFetchHandler(options: MockApiOptions): FetchHandler {
  return toFetchHandler(createHandlers(options));
}

/** The mock addons-manager and marketplace-manager, see `toFetchHandler`. */
export function createAddonsFetchHandler(options: AddonsHandlersOptions): FetchHandler {
  return toFetchHandler(createAddonsHandlers(options));
}
