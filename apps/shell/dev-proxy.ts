import type { ProxyOptions } from 'vite';

/**
 * Same response headers as the nginx locations for these proxies: the addon services answer with
 * unescaped user input (addon names, logs), which must not be renderable on the dev origin.
 */
export const BACKEND_RESPONSE_HEADERS = {
  'content-security-policy': "default-src 'none'; sandbox",
  'content-disposition': 'attachment',
  'x-content-type-options': 'nosniff',
} as const;

export function isolated(options: ProxyOptions): ProxyOptions {
  return {
    ...options,
    configure(proxy, proxyOptions) {
      options.configure?.(proxy, proxyOptions);
      proxy.on('proxyRes', (response) => {
        Object.assign(response.headers, BACKEND_RESPONSE_HEADERS);
      });
    },
  };
}
