import type { UserCreateInput } from '@oakestra/api';
import { platformQueryKeys, useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

// Organizations list their members and users carry organization roles, so a change on either
// side stales both caches. Both are platform keys: the organizations package cannot be imported.
function invalidateUsersAndOrganizations(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: platformQueryKeys.users() }),
    queryClient.invalidateQueries({ queryKey: platformQueryKeys.organizations() }),
  ]);
}

export function useCreateUser() {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (input: UserCreateInput) => api.users.create(input),
    // The dialog shows the backend's reason ("Username already exists") itself.
    meta: { silent: true },
    onSuccess: async (_data, input) => {
      notify.success(`User ${input.name} created`);
      await invalidateUsersAndOrganizations(queryClient);
    },
  });
}

export function useUpdateUserRoles() {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    // Only `roles`: the backend $sets every field it receives.
    mutationFn: ({ username, roles }: { username: string; roles: string[] }) =>
      api.users.update(username, { roles }),
    meta: { errorMessage: 'Could not update the roles' },
    onSuccess: async (_data, { username }) => {
      notify.success(`Roles of ${username} updated`);
      await invalidateUsersAndOrganizations(queryClient);
    },
  });
}

export function useDeleteUser() {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (username: string) => api.users.delete(username),
    meta: { errorMessage: 'Could not delete the user' },
    onSuccess: async (_data, username) => {
      notify.success(`User ${username} deleted`);
      await invalidateUsersAndOrganizations(queryClient);
    },
  });
}
