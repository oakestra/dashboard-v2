import type { Server } from 'node:http';

import {
  createMockFetchHandler,
  createMockStore,
  withPlacementDemo,
  type MockApiOptions,
} from '@oakestra/mocks';
import { createMockHttpServer } from '@oakestra/mocks/http';

/**
 * Serves the @oakestra/mocks system-manager over HTTP, for the e2e stack where the dashboard runs
 * as a production image and MSW cannot intercept anything. Same data, same rules as in unit tests
 * and `pnpm dev:mock`. `POST /__test/reset` restores the fixtures between tests.
 */
export interface MockSystemManagerOptions {
  accessTokenTtlSeconds?: number;
  instanceStartupMs?: number;
  /** Adds the clusters, instances and placement failures of `withPlacementDemo` to the seed. */
  placementDemo?: boolean;
}

// Handlers match on absolute URLs. Requests are rebuilt against this origin, whatever Host header
// the browser sent.
const INTERNAL_ORIGIN = 'http://mock-system-manager';

export function createMockSystemManager(options: MockSystemManagerOptions = {}): Server {
  const { placementDemo, ...mockOptions } = options;
  const store = createMockStore(placementDemo ? withPlacementDemo : undefined);
  const apiOptions: MockApiOptions = { baseUrl: `${INTERNAL_ORIGIN}/api`, store, ...mockOptions };
  const handleApi = createMockFetchHandler(apiOptions);

  return createMockHttpServer({ name: 'mock-system-manager', origin: INTERNAL_ORIGIN, handle });

  async function handle(request: Request): Promise<Response> {
    const { method } = request;
    const path = request.url.slice(INTERNAL_ORIGIN.length);

    if (method === 'GET' && path === '/healthz') return Response.json({ ok: true });
    if (method === 'POST' && path === '/__test/reset') {
      store.reset();
      return Response.json({ ok: true });
    }

    return (
      (await handleApi(request)) ??
      Response.json({ code: 404, status: 'Not Found' }, { status: 404 })
    );
  }
}
