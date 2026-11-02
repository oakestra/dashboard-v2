import type { OakestraApi } from '@oakestra/dashboard-sdk';
import { queryOptions } from '@tanstack/react-query';

/**
 * Query keys of this feature. Every key starts with the feature id, so
 * `invalidateQueries({ queryKey: profileKeys.all })` reaches all of them and nothing else.
 */
export const profileKeys = {
  all: ['profile'] as const,
  user: (username: string) => [...profileKeys.all, 'user', username] as const,
};

export function profileQuery(api: OakestraApi, username: string) {
  return queryOptions({
    queryKey: profileKeys.user(username),
    queryFn: ({ signal }) => api.users.get(username, { signal }),
  });
}
