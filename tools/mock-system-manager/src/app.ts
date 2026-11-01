import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { createMockFetchHandler, createMockStore, type MockApiOptions } from '@oakestra/mocks';

/**
 * Serves the @oakestra/mocks system-manager over HTTP, for the e2e stack where the dashboard runs
 * as a production image and MSW cannot intercept anything. Same data, same rules as in unit tests
 * and `pnpm dev:mock`. `POST /__test/reset` restores the fixtures between tests.
 */
export interface MockSystemManagerOptions {
  accessTokenTtlSeconds?: number;
  instanceStartupMs?: number;
}

// Handlers match on absolute URLs. Requests are rebuilt against this origin, whatever Host header
// the browser sent.
const INTERNAL_ORIGIN = 'http://mock-system-manager';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '600',
};

export function createMockSystemManager(options: MockSystemManagerOptions = {}): Server {
  const store = createMockStore();
  const apiOptions: MockApiOptions = { baseUrl: `${INTERNAL_ORIGIN}/api`, store, ...options };
  const handle = createMockFetchHandler(apiOptions);

  return createServer((request, response) => {
    serve(request, response).catch((error: unknown) => {
      console.error('[mock-system-manager]', error);
      send(response, 500, { message: String(error) });
    });
  });

  async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? 'GET';
    const path = request.url ?? '/';

    if (method === 'OPTIONS') {
      response.writeHead(204, CORS_HEADERS).end();
      return;
    }
    if (method === 'GET' && path === '/healthz') return send(response, 200, { ok: true });
    if (method === 'POST' && path === '/__test/reset') {
      store.reset();
      return send(response, 200, { ok: true });
    }

    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') headers.set(name, value);
    }
    const mocked = await handle(
      new Request(`${INTERNAL_ORIGIN}${path}`, { method, headers, body }),
    );
    if (!mocked) return send(response, 404, { code: 404, status: 'Not Found' });

    response.writeHead(mocked.status, {
      ...CORS_HEADERS,
      'Content-Type': mocked.headers.get('Content-Type') ?? 'application/json',
      'Cache-Control': 'no-store',
    });
    response.end(Buffer.from(await mocked.arrayBuffer()));
  }
}

async function readBody(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    ...CORS_HEADERS,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}
