import { delay, http, HttpResponse, type HttpHandler } from 'msw';

import type { AddonsBackend, BackendResponse } from './addons-backend.ts';

export interface AddonsHandlersOptions {
  /** The configured `addonsManagerUrl`, absolute (e.g. `http://api.test/addons-api`). */
  managerUrl: string;
  /** The configured `marketplaceUrl`, absolute. */
  marketplaceUrl: string;
  backend: AddonsBackend;
  /** Added to every response, so loading states are visible in the browser. */
  delayMs?: number;
}

/** Hands the backend's raw text and content type to MSW unchanged, so quirks survive. */
function respond({ status, text, contentType }: BackendResponse): Response {
  if (text === undefined) return new HttpResponse(null, { status });
  return new HttpResponse(text, {
    status,
    headers: contentType ? { 'Content-Type': contentType } : {},
  });
}

/** Like webargs, which flask-smorest parses with: an empty body is `{}`, invalid JSON undefined. */
async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return undefined;
  }
}

// MSW has already decoded the path parameter.
const idOf = (params: Record<string, string | readonly string[] | undefined>) => String(params.id);

/**
 * MSW handlers for both addon backends, as the shell reaches them: `${managerUrl}/` and
 * `${managerUrl}/<id>` (with or without a trailing slash). The bearer token is accepted but never
 * checked, like the real services.
 */
export function createAddonsHandlers(options: AddonsHandlersOptions): HttpHandler[] {
  const { backend } = options;
  const manager = options.managerUrl.replace(/\/+$/, '');
  const market = options.marketplaceUrl.replace(/\/+$/, '');

  const handlers = [
    // A bare base URL also matches its trailing slash form.
    http.get(manager, ({ request }) =>
      respond(backend.manager.list({ status: new URL(request.url).searchParams.get('status') })),
    ),
    http.post(manager, async ({ request }) =>
      respond(backend.manager.install(await readJson(request))),
    ),
    http.get(`${manager}/:id`, ({ params }) => respond(backend.manager.get(idOf(params)))),
    http.patch(`${manager}/:id`, async ({ params, request }) =>
      respond(backend.manager.patch(idOf(params), await readJson(request))),
    ),
    http.delete(`${manager}/:id`, ({ params }) => respond(backend.manager.remove(idOf(params)))),

    http.get(market, ({ request }) =>
      respond(backend.marketplace.list({ name: new URL(request.url).searchParams.get('name') })),
    ),
    http.post(market, async ({ request }) =>
      respond(backend.marketplace.register(await readJson(request))),
    ),
    http.get(`${market}/:id`, ({ params }) => respond(backend.marketplace.get(idOf(params)))),
    http.delete(`${market}/:id`, ({ params }) => respond(backend.marketplace.remove(idOf(params)))),
  ];

  if (!options.delayMs) return handlers;
  const delayMs = options.delayMs;
  // A resolver that returns nothing falls through to the next matching handler.
  const wait = async () => void (await delay(delayMs));
  return [http.all(`${manager}*`, wait), http.all(`${market}*`, wait), ...handlers];
}
