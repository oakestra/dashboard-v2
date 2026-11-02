import type { Service } from '@oakestra/api';

import { plural } from '../../lib/format';
import { isUndeployed, summarizeStatuses, type StatusTone } from '../services';

export interface ApplicationHealth {
  tone: StatusTone;
  label: string;
  services: number;
  /** Services without an instance that the scheduler is not working on either. */
  undeployed: number;
  instances: { total: number; running: number; pending: number; failed: number };
}

/**
 * Folds an application's services and their instances into one badge. The service status alone
 * would miss a crashed instance of a service that still reads RUNNING, so both are summarized.
 */
export function applicationHealth(services: readonly Service[]): ApplicationHealth {
  const instanceStatuses = services.flatMap((service) =>
    service.instance_list.map((instance) => instance.status),
  );
  const instances = summarizeStatuses(instanceStatuses);
  const summary = summarizeStatuses([
    ...services.map((service) => service.status),
    ...instanceStatuses,
  ]);
  const undeployed = services.filter(isUndeployed).length;
  const counts = {
    total: instances.total,
    running: instances.running,
    pending: instances.pending,
    failed: instances.failed,
  };
  const base = { services: services.length, undeployed, instances: counts };

  if (services.length === 0) return { ...base, tone: 'neutral', label: 'Empty' };
  if (summary.tone === 'destructive') return { ...base, tone: 'destructive', label: 'Failing' };
  if (summary.tone === 'warning') return { ...base, tone: 'warning', label: 'Degraded' };
  if (summary.tone === 'info') return { ...base, tone: 'info', label: 'Deploying' };
  if (undeployed === services.length) return { ...base, tone: 'neutral', label: 'Not deployed' };
  return { ...base, tone: 'success', label: 'Healthy' };
}

/** "3 services, 4/4 running", or just the service count when nothing runs. */
export function describeServiceCounts(health: ApplicationHealth): string {
  const services = plural(health.services, 'service');
  if (health.instances.total === 0) return services;
  return `${services}, ${health.instances.running}/${health.instances.total} running`;
}
