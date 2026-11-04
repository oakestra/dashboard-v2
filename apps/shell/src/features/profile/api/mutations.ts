import type { PasswordChange } from '@oakestra/api';
import { platformQueryKeys, useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateEmail(username: string) {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (email: string) => api.users.update(username, { email }),
    // Failures are toasted centrally with this title (see core/query/query-client.ts).
    meta: { errorMessage: 'Could not update the email address' },
    onSuccess: async () => {
      notify.success('Email address updated');
      // Returning the promise keeps the mutation pending until the page shows the new value.
      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.user(username) });
    },
  });
}

export function useChangePassword(username: string) {
  const api = useOakestraApi();
  const notify = useNotify();
  return useMutation({
    mutationFn: (change: PasswordChange) => api.users.changePassword(username, change),
    // The dialog shows the backend's reason ("Old password is not valid!") next to the form.
    meta: { silent: true },
    onSuccess: () => notify.success('Password changed'),
  });
}
