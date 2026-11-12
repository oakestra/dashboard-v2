import { delay, http, HttpResponse, type HttpHandler } from 'msw';

import type { AddonsBackend, BackendResponse } from './addons-backend.ts';

export interface AddonsHandlersOptions {
  /** The configured `addonsManagerUrl`, absolute (e.g. `http://api.test/addons-api`). */
  managerUrl: string;
  /** The configured `marketplaceUrl`, the marketplace's API root, absolute. */
  marketplaceUrl: string;
  backend: AddonsBackend;
  /** Added to every response, so loading states are visible in the browser. */
  delayMs?: number;
}

/** Hands the backend's raw text and content type to MSW unchanged. */
function respond({ status, text, contentType }: BackendResponse): Response {
  if (text === undefined) return new HttpResponse(null, { status });
  return new HttpResponse(text, {
    status,
    headers: contentType ? { 'Content-Type': contentType } : {},
  });
}

/** Invalid JSON becomes undefined, which the backend answers like the Go decoder does. */
async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

// MSW has already decoded the path parameters.
type Params = Record<string, string | readonly string[] | undefined>;
const param = (params: Params, key: string) => String(params[key]);

/**
 * MSW handlers for both addon services, as the shell reaches them: `${managerUrl}/[<id>[/update
 * |/approve]]` and `${marketplaceUrl}/addons...` / `/sources...` (collections with or without a
 * trailing slash). The bearer token is accepted but never checked.
 */
export function createAddonsHandlers(options: AddonsHandlersOptions): HttpHandler[] {
  const { backend } = options;
  const manager = options.managerUrl.replace(/\/+$/, '');
  const market = options.marketplaceUrl.replace(/\/+$/, '');
  const { sources } = backend.marketplace;

  const handlers = [
    // A bare base URL also matches its trailing slash form.
    http.get(manager, ({ request }) =>
      respond(backend.manager.list({ status: new URL(request.url).searchParams.get('status') })),
    ),
    http.post(manager, async ({ request }) =>
      respond(backend.manager.install(await readJson(request))),
    ),
    http.get(`${manager}/:id`, ({ params }) => respond(backend.manager.get(param(params, 'id')))),
    http.post(`${manager}/:id/update`, async ({ params, request }) =>
      respond(backend.manager.update(param(params, 'id'), await readJson(request))),
    ),
    http.post(`${manager}/:id/approve`, async ({ params, request }) =>
      respond(backend.manager.approve(param(params, 'id'), await readJson(request))),
    ),
    http.delete(`${manager}/:id`, ({ params }) =>
      respond(backend.manager.remove(param(params, 'id'))),
    ),

    http.get(`${market}/addons`, ({ request }) => {
      const query = new URL(request.url).searchParams;
      return respond(
        backend.marketplace.list({ source: query.get('source'), name: query.get('name') }),
      );
    }),
    http.post(`${market}/addons`, async ({ request }) =>
      respond(backend.marketplace.register(await readJson(request))),
    ),
    http.get(`${market}/addons/:source/:name`, ({ params }) =>
      respond(backend.marketplace.get(param(params, 'source'), param(params, 'name'))),
    ),
    http.delete(`${market}/addons/local/:name`, ({ params }) =>
      respond(backend.marketplace.removeLocal(param(params, 'name'))),
    ),

    http.get(`${market}/sources`, () => respond(sources.list())),
    http.post(`${market}/sources`, async ({ request }) =>
      respond(sources.add(await readJson(request))),
    ),
    http.delete(`${market}/sources/:name`, ({ params }) =>
      respond(sources.remove(param(params, 'name'))),
    ),
    http.post(`${market}/sources/:name/sync`, ({ params }) =>
      respond(sources.sync(param(params, 'name'))),
    ),
    http.post(`${market}/sources/:name/import`, async ({ params, request }) =>
      respond(sources.importIndex(param(params, 'name'), await readJson(request))),
    ),
  ];

  if (!options.delayMs) return handlers;
  const delayMs = options.delayMs;
  // A resolver that returns nothing falls through to the next matching handler.
  const wait = async () => void (await delay(delayMs));
  return [http.all(`${manager}*`, wait), http.all(`${market}*`, wait), ...handlers];
}
