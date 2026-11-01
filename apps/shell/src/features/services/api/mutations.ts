import { useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { applicationKeys } from '../../applications/keys';
import { serviceKeys } from './queries';

function useInvalidateServices() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: serviceKeys.all });
}

export function useDeployInstance() {
  const api = useOakestraApi();
  const notify = useNotify();
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: (serviceId: string) => api.instances.deploy(serviceId),
    meta: { errorMessage: 'Could not deploy an instance' },
    onSuccess: async () => {
      notify.success('Instance requested');
      await invalidate();
    },
  });
}

/** Deploys one instance of each given service, like "Deploy all" in the old dashboard. */
export function useDeployAll() {
  const api = useOakestraApi();
  const notify = useNotify();
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: async (serviceIds: readonly string[]) => {
      const results = await Promise.allSettled(serviceIds.map((id) => api.instances.deploy(id)));
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length === results.length && failed[0]) throw failed[0].reason;
      return { requested: results.length - failed.length, failed: failed.length };
    },
    meta: { errorMessage: 'Could not deploy the services' },
    onSuccess: async ({ requested, failed }) => {
      if (failed > 0) notify.warning(`${requested} deployed, ${failed} failed`);
      else
        notify.success(requested === 1 ? 'Instance requested' : `${requested} instances requested`);
      await invalidate();
    },
  });
}

export function useUndeployInstance() {
  const api = useOakestraApi();
  const notify = useNotify();
  const invalidate = useInvalidateServices();
  return useMutation({
    mutationFn: ({ serviceId, instanceNumber }: { serviceId: string; instanceNumber: number }) =>
      api.instances.undeploy(serviceId, instanceNumber),
    meta: { errorMessage: 'Could not undeploy the instance' },
    onSuccess: async () => {
      notify.success('Instance undeployed');
      await invalidate();
    },
  });
}

export function useDeleteService() {
  const api = useOakestraApi();
  const notify = useNotify();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serviceId: string) => api.services.delete(serviceId),
    meta: { errorMessage: 'Could not delete the service' },
    onSuccess: async (_result, serviceId) => {
      notify.success('Service deleted');
      // The open detail page would otherwise refetch the deleted service and flash a load error.
      queryClient.removeQueries({ queryKey: serviceKeys.detail(serviceId) });
      // The application lists its service ids, so its cached copy is stale too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: serviceKeys.all }),
        queryClient.invalidateQueries({ queryKey: applicationKeys.all }),
      ]);
    },
  });
}
