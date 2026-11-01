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

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const idOf = (params: Record<string, string | readonly string[] | undefined>) =>
  decodeURIComponent(String(params.id));

/**
 * MSW handlers for both addon backends, as the shell reaches them: `${managerUrl}/` and
 * `${managerUrl}/<id>`. The bearer token is accepted but never checked, like the real services.
 */
export function createAddonsHandlers(options: AddonsHandlersOptions): HttpHandler[] {
  const { backend } = options;
  const manager = options.managerUrl.replace(/\/+$/, '');
  const market = options.marketplaceUrl.replace(/\/+$/, '');
  const wait = () => (options.delayMs ? delay(options.delayMs) : undefined);

  return [
    http.get(`${manager}/`, async ({ request }) => {
      await wait();
      return respond(
        backend.manager.list({ status: new URL(request.url).searchParams.get('status') }),
      );
    }),
    http.post(`${manager}/`, async ({ request }) => {
      await wait();
      return respond(backend.manager.install(await readJson(request)));
    }),
    http.get(`${manager}/:id`, async ({ params }) => {
      await wait();
      return respond(backend.manager.get(idOf(params)));
    }),
    http.patch(`${manager}/:id`, async ({ params, request }) => {
      await wait();
      return respond(backend.manager.patch(idOf(params), await readJson(request)));
    }),
    http.delete(`${manager}/:id`, async ({ params }) => {
      await wait();
      return respond(backend.manager.remove(idOf(params)));
    }),

    http.get(`${market}/`, async ({ request }) => {
      await wait();
      return respond(
        backend.marketplace.list({ name: new URL(request.url).searchParams.get('name') }),
      );
    }),
    http.post(`${market}/`, async ({ request }) => {
      await wait();
      return respond(backend.marketplace.register(await readJson(request)));
    }),
    http.get(`${market}/:id`, async ({ params }) => {
      await wait();
      return respond(backend.marketplace.get(idOf(params)));
    }),
    http.delete(`${market}/:id`, async ({ params }) => {
      await wait();
      return respond(backend.marketplace.remove(idOf(params)));
    }),
  ];
}
