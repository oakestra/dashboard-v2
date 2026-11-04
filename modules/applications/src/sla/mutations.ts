import type { ServiceCreateResult, SlaV2 } from '@oakestra/api';
import { platformQueryKeys, useNotify, useOakestraApi } from '@oakestra/dashboard-sdk';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function describeFailures(failed: ServiceCreateResult['failed_services']): string {
  const reasons = failed.map((entry) => {
    const name = entry.service_name ? `${entry.service_name}: ` : '';
    return `${name}${entry.message ?? 'the backend gave no reason'}`;
  });
  return `Could not create ${failed.length === 1 ? 'the service' : 'the services'}. ${reasons.join('; ')}`;
}

export function useCreateServices(applicationId: string) {
  const api = useOakestraApi();
  const queryClient = useQueryClient();
  const notify = useNotify();
  return useMutation({
    mutationFn: async (sla: SlaV2) => {
      const result = await api.services.create(sla);
      // The backend answers 200 even when it refused every service, with the reason (if it has
      // one) in `failed_services`.
      if (result.failed_services.length > 0 && result.deployed_services.length === 0) {
        throw new Error(describeFailures(result.failed_services));
      }
      return result;
    },
    // The form shows the backend's reason inline.
    meta: { silent: true },
    onSuccess: async (result) => {
      notify.success(
        result.deployed_services.length > 1 ? 'Services created' : 'Service created',
        result.failed_services.length > 0
          ? { description: describeFailures(result.failed_services) }
          : undefined,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: platformQueryKeys.servicesByApplication(applicationId),
        }),
        // The backend appends the new ids to application.microservices.
        queryClient.invalidateQueries({ queryKey: platformQueryKeys.applications() }),
      ]);
    },
  });
}
