import { slaMicroserviceSchema, type Service, type SlaV2 } from '@oakestra/api';

import { withoutRoundRobinIps } from '../sla';

const SLA_FIELDS = Object.keys(slaMicroserviceSchema.shape).filter(
  (key) => key !== 'microserviceID',
);

/**
 * Rebuilds an importable SLA from a stored service. The service object also carries runtime state
 * (instances, status, job names) that the backend would reject or ignore on import.
 */
export function serviceToSla(service: Service, customerId: string): SlaV2 {
  const microservice: Record<string, unknown> = {};
  for (const key of SLA_FIELDS) {
    const value = (service as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) microservice[key] = value;
  }
  // The allocated round-robin addresses belong to this service; importing them elsewhere would
  // collide in net-manager.
  if (microservice.addresses) {
    microservice.addresses = withoutRoundRobinIps(service.addresses);
  }
  return {
    sla_version: 'v2.0',
    customerID: customerId,
    applications: [
      {
        applicationID: service.applicationID,
        application_name: service.app_name ?? '',
        application_namespace: service.app_ns ?? '',
        microservices: [microservice as SlaV2['applications'][number]['microservices'][number]],
      },
    ],
  };
}
