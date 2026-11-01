import { describe, expect, it } from 'vitest';

import { ApiError, isApiError, messageFromErrorBody } from './errors.ts';

describe('messageFromErrorBody', () => {
  it.each([
    [{ message: 'You have not enough permissions!' }, 403, 'You have not enough permissions!'],
    [{ msg: 'Token has expired' }, 401, 'Token has expired'],
    [{ message: { message: 'Nested' } }, 404, 'Nested'],
    [{ error: 'Missing or invalid JSON body' }, 400, 'Missing or invalid JSON body'],
    [{ code: 404, status: 'Not Found' }, 404, 'The requested item does not exist.'],
    ['Job not deleted', 500, 'Job not deleted'],
    ['<html><body>Bad Gateway</body></html>', 502, 'The Oakestra backend ran into an error.'],
    [
      { code: 422, status: 'Unprocessable Entity', errors: { json: { ui: ['Unknown field.'] } } },
      422,
      'ui: Unknown field.',
    ],
    [
      {
        code: 422,
        errors: {
          json: {
            services: { '0': { image: ['Missing data for required field.'] } },
            name: ['Not a valid string.', 'Too short.'],
          },
        },
      },
      422,
      'services[0].image: Missing data for required field. name: Not a valid string. name: Too short.',
    ],
    [
      { code: 422, errors: { query: { status: ['Must be one of: a, b.'] } } },
      422,
      'query.status: Must be one of: a, b.',
    ],
    [
      { code: 422, errors: { json: { _schema: ['Invalid input type.'] } } },
      422,
      'Invalid input type.',
    ],
    [
      { errors: { json: Object.fromEntries('abcdefg'.split('').map((k) => [k, ['bad']])) } },
      422,
      'a: bad b: bad c: bad d: bad e: bad (and 2 more)',
    ],
    [{ code: 422, errors: {} }, 422, 'The request was not accepted.'],
    [undefined, 418, 'The request failed with HTTP 418.'],
  ])('%j (%i) -> %s', (body, status, expected) => {
    expect(messageFromErrorBody(body, status)).toBe(expected);
  });
});

describe('isApiError', () => {
  it('recognizes ApiErrors without relying on instanceof', () => {
    const error = new ApiError('x', { kind: 'http', status: 403, method: 'GET', path: '/a' });
    expect(isApiError(error)).toBe(true);
    expect(isApiError({ name: 'ApiError', status: 500 })).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });
});
