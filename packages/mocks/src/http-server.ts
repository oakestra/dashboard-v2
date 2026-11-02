import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

// The dashboard calls the mocks straight from the browser, from whatever origin it is served on.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '600',
};

export interface MockHttpServerOptions {
  /** Prefix of logged errors. */
  name: string;
  /**
   * Origin the incoming requests are rebuilt against, whatever Host header the browser sent. MSW
   * handlers match on absolute URLs, so it must be the origin they were created for.
   */
  origin: string;
  handle: (request: Request) => Promise<Response> | Response;
}

/**
 * Serves a `Request -> Response` function over node:http, for the mock tools of the e2e stack,
 * where the dashboard runs as a production image and MSW cannot intercept anything. Answers CORS
 * preflights itself and marks every response `no-store`.
 */
export function createMockHttpServer({ name, origin, handle }: MockHttpServerOptions): Server {
  return createServer((incoming, outgoing) => {
    serve(incoming, outgoing).catch((error: unknown) => {
      // Only reached when writing the response failed, so no status can be sent any more.
      console.error(`[${name}]`, error);
      outgoing.destroy();
    });
  });

  async function serve(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    let response: Response;
    try {
      response = await respond(incoming);
    } catch (error) {
      console.error(`[${name}]`, error);
      response = Response.json({ message: String(error) }, { status: 500 });
    }
    const headers: Record<string, string> = { ...CORS_HEADERS, 'Cache-Control': 'no-store' };
    const contentType = response.headers.get('Content-Type');
    if (contentType) headers['Content-Type'] = contentType;
    outgoing.writeHead(response.status, headers);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }

  async function respond(incoming: IncomingMessage): Promise<Response> {
    const method = incoming.method ?? 'GET';
    if (method === 'OPTIONS') return new Response(null, { status: 204 });

    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (typeof value === 'string') headers.set(key, value);
    }
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(incoming);
    return handle(new Request(`${origin}${incoming.url ?? '/'}`, { method, headers, body }));
  }
}

async function readBody(request: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new Uint8Array(Buffer.concat(chunks));
}
