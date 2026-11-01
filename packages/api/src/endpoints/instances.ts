import type { OakestraClient } from '../client.ts';
import { send } from './request.ts';

export interface InstanceEndpoints {
  /** Asks the scheduler for one more instance of the service. Placement happens asynchronously. */
  deploy(serviceId: string): Promise<void>;
  undeploy(serviceId: string, instanceNumber: number): Promise<void>;
}

export function createInstanceEndpoints(client: OakestraClient): InstanceEndpoints {
  return {
    async deploy(serviceId) {
      await send({ method: 'POST', path: `/service/${serviceId}/instance` }, () =>
        client.POST('/service/{serviceid}/instance', {
          params: { path: { serviceid: serviceId } },
        }),
      );
    },
    async undeploy(serviceId, instanceNumber) {
      await send(
        { method: 'DELETE', path: `/service/${serviceId}/instance/${instanceNumber}` },
        () =>
          client.DELETE('/service/{serviceid}/instance/{instance_number}', {
            params: { path: { serviceid: serviceId, instance_number: String(instanceNumber) } },
          }),
      );
    },
  };
}
