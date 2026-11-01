import type { ApplicationUpdate } from '@oakestra/api';
import { useCurrentUser, useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { serviceKeys } from '../../services/keys';
import type { ApplicationFormValues } from '../schema';
import { applicationKeys } from './queries';

export function useCreateApplication() {
  const api = useOakestraApi();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (values: ApplicationFormValues) =>
      api.applications.create({
        sla_version: 'v2.0',
        // The token's organization claim is the SLA's customerID (see AGENTS.md).
        customerID: user?.organization ?? '',
        applications: [{ ...values, microservices: [] }],
      }),
    // The dialog shows the backend's reason (e.g. duplicate name) next to the form.
    meta: { silent: true },
    onSuccess: async () => {
      notify.success('Application created');
      await queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
}

export function useUpdateApplication(applicationId: string) {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (update: ApplicationUpdate) => api.applications.update(applicationId, update),
    meta: { silent: true },
    onSuccess: async () => {
      notify.success('Application updated');
      await queryClient.invalidateQueries({ queryKey: applicationKeys.all });
    },
  });
}

export function useDeleteApplication() {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: (applicationId: string) => api.applications.delete(applicationId),
    meta: { errorMessage: 'Could not delete the application' },
    onSuccess: async (_result, applicationId) => {
      notify.success('Application deleted');
      // Drop what the open detail page is showing instead of refetching it, which would flash a
      // load error just before the page navigates away.
      queryClient.removeQueries({ queryKey: applicationKeys.detail(applicationId) });
      queryClient.removeQueries({ queryKey: serviceKeys.byApplication(applicationId) });
      // The backend removes the application's services with it.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
        queryClient.invalidateQueries({ queryKey: serviceKeys.all }),
      ]);
    },
  });
}
