import createClient, { type Client, type Middleware } from 'openapi-fetch';

import type { paths } from './generated/schema';

export type OakestraPaths = paths;
export type OakestraClient = Client<paths>;

export interface OakestraClientOptions {
  /** The configured `apiUrl`, e.g. `http://localhost:10000/api`. */
  baseUrl: string;
  /** Defaults to the global fetch, looked up per request so test interceptors are honoured. */
  fetch?: (request: Request) => Promise<Response>;
  middleware?: readonly Middleware[];
}

export function createOakestraClient(options: OakestraClientOptions): OakestraClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    fetch: options.fetch ?? ((request) => globalThis.fetch(request)),
  });
  if (options.middleware?.length) client.use(...options.middleware);
  return client;
}

export type { Middleware };
