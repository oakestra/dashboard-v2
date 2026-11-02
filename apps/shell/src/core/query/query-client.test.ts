import { ApiError } from '@oakestra/api';
import type { Notify } from '@oakestra/dashboard-sdk';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from './query-client';

function setup() {
  const error = vi.fn();
  const notify: Notify = { success: vi.fn(), info: vi.fn(), warning: vi.fn(), error };
  return { notifyError: error, client: createQueryClient(notify) };
}

const forbidden = new ApiError('You have not enough permissions!', {
  kind: 'http',
  status: 403,
  method: 'GET',
  path: '/x',
});

describe('query client error policy', () => {
  it('toasts failed mutations with the meta title and the backend message', async () => {
    const { notifyError, client } = setup();
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(forbidden),
        meta: { errorMessage: 'Could not delete' },
      })
      .execute(undefined)
      .catch(() => {});
    expect(notifyError).toHaveBeenCalledWith('Could not delete', {
      description: 'You have not enough permissions!',
    });
  });

  it('stays quiet for silent mutations and for ended sessions', async () => {
    const { notifyError, client } = setup();
    const expired = new ApiError('x', { kind: 'http', status: 401, method: 'GET', path: '/' });
    for (const options of [
      { mutationFn: () => Promise.reject(forbidden), meta: { silent: true } },
      { mutationFn: () => Promise.reject(expired) },
    ]) {
      await client
        .getMutationCache()
        .build(client, options)
        .execute(undefined)
        .catch(() => {});
    }
    expect(notifyError).not.toHaveBeenCalled();
  });

  it('toasts query errors only when data is already on screen', async () => {
    const { notifyError, client } = setup();
    await client
      .fetchQuery({ queryKey: ['a'], queryFn: () => Promise.reject(forbidden) })
      .catch(() => {});
    expect(notifyError).not.toHaveBeenCalled();

    client.setQueryData(['b'], 'cached');
    await client
      .fetchQuery({ queryKey: ['b'], queryFn: () => Promise.reject(forbidden), staleTime: 0 })
      .catch(() => {});
    expect(notifyError).toHaveBeenCalledWith('Could not refresh the data on this page', {
      description: 'You have not enough permissions!',
      id: expect.stringContaining('query-error:'),
    });
  });

  it('does not retry client errors', async () => {
    const { client } = setup();
    const queryFn = vi.fn(() => Promise.reject(forbidden));
    await client.fetchQuery({ queryKey: ['c'], queryFn }).catch(() => {});
    expect(queryFn).toHaveBeenCalledOnce();
  });
});
