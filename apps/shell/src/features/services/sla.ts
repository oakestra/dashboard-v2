import type { Service, SlaV2 } from '@oakestra/api';

import { serviceToSlaMicroservice } from '../sla';

/** Rebuilds an importable SLA from a stored service. */
export function serviceToSla(service: Service, customerId: string): SlaV2 {
  return {
    sla_version: 'v2.0',
    customerID: customerId,
    applications: [
      {
        applicationID: service.applicationID,
        application_name: service.app_name ?? '',
        application_namespace: service.app_ns ?? '',
        microservices: [serviceToSlaMicroservice(service)],
      },
    ],
  };
}

const REDACTED = '********';

/** Environment values may be secrets: the on-screen JSON keeps the keys and masks the values. */
export function redactEnvironment<T extends { environment?: readonly string[] | undefined }>(
  value: T,
): T {
  if (!value.environment) return value;
  return {
    ...value,
    environment: value.environment.map((entry) => {
      const separator = entry.indexOf('=');
      return separator === -1 ? entry : `${entry.slice(0, separator)}=${REDACTED}`;
    }),
  };
}

/** Same masking for an SLA document, whose services carry `environment` too. */
export function redactSlaEnvironment(sla: SlaV2): SlaV2 {
  return {
    ...sla,
    applications: sla.applications.map((application) => ({
      ...application,
      microservices: application.microservices.map((microservice) =>
        redactEnvironment(microservice as { environment?: string[] }),
      ) as typeof application.microservices,
    })),
  };
}

export function environmentKeys(environment: readonly string[]): string[] {
  return environment.map((entry) => entry.split('=')[0] ?? entry).filter(Boolean);
}
