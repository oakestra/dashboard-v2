import type { ApplicationUpdate } from '@oakestra/api';
import {
  platformQueryKeys,
  useCurrentUser,
  useNotify,
  useOakestraApi,
} from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { invalidateAfterDelete } from '../queries';
import type { ApplicationFormValues } from './schema';

export function useCreateApplication() {
  const api = useOakestraApi();
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: async (values: ApplicationFormValues) => {
      const all = await api.applications.create({
        sla_version: 'v2.0',
        // The token's organization claim is the SLA's customerID (see AGENTS.md).
        customerID: user?.organization ?? '',
        applications: [{ ...values, microservices: [] }],
      });
      // The backend answers with all of the user's applications; the new one is found by name
      // so the caller can open it. Undefined when the response is not as expected.
      return all.find(
        (app) =>
          app.application_name === values.application_name &&
          app.application_namespace === values.application_namespace,
      );
    },
    // The dialog shows the backend's reason (e.g. duplicate name) next to the form.
    meta: { silent: true },
    onSuccess: async () => {
      notify.success('Application created');
      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.applications() });
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
      await queryClient.invalidateQueries({ queryKey: platformQueryKeys.applications() });
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
      // The backend removes the application's services with it.
      await invalidateAfterDelete(queryClient, {
        id: applicationId,
        deleted: [
          platformQueryKeys.application(applicationId),
          platformQueryKeys.servicesByApplication(applicationId),
        ],
        refresh: [platformQueryKeys.applications(), platformQueryKeys.services()],
      });
    },
  });
}
