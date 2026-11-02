import { EventEmitter } from 'node:events';

import type { ProxyOptions } from 'vite';
import { describe, expect, it } from 'vitest';

import { BACKEND_RESPONSE_HEADERS, isolated } from './dev-proxy';

describe('isolated dev proxy', () => {
  it('forces the headers that keep backend bodies from rendering on the dev origin', () => {
    const proxy = new EventEmitter();
    const options = isolated({ target: 'http://localhost:11101' });
    options.configure?.(proxy as never, options);

    // A backend answering text/html with script in a JSON string, as the addons-manager does.
    const response = { headers: { 'content-type': 'text/html; charset=utf-8' } };
    proxy.emit('proxyRes', response);

    expect(response.headers).toMatchObject({
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; sandbox",
      'content-disposition': 'attachment',
      'x-content-type-options': 'nosniff',
    });
    expect(BACKEND_RESPONSE_HEADERS['content-security-policy']).toContain('sandbox');
  });

  it('keeps the proxy options and an existing configure hook', () => {
    let configured = false;
    const base: ProxyOptions = {
      target: 'http://x',
      changeOrigin: true,
      configure: () => {
        configured = true;
      },
    };
    const options = isolated(base);
    options.configure?.(new EventEmitter() as never, options);
    expect(configured).toBe(true);
    expect(options).toMatchObject({ target: 'http://x', changeOrigin: true });
  });
});
